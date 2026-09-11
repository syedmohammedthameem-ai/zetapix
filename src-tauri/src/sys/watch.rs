use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::core::domain::CustomEvents;
use crate::sys::fs::collect_files;
use crate::tauri_commands::fs::allow_asset_scopes;

/// How often the watched directory is listed again.
const POLL_INTERVAL: Duration = Duration::from_millis(1500);

/// Consecutive polls a file must report the same size before it is handed to
/// the compressor. A file still being copied into the watched directory is
/// therefore never read half written.
const STABLE_POLLS: u8 = 2;

/// True when `path` sits inside `directory`.
///
/// Windows path comparison ignores case, so a case-sensitive test would let an
/// output folder nested inside the watched folder slip through, and the app
/// would queue its own results as fresh input and compress forever. Comparing
/// components rather than string prefixes also stops `/media/output2` from
/// looking like it sits inside `/media/output`.
fn is_within(path: &Path, directory: &Path) -> bool {
    let mut wanted = directory.components();
    let mut actual = path.components();

    loop {
        match (wanted.next(), actual.next()) {
            (None, _) => return true,
            (Some(_), None) => return false,
            (Some(expected), Some(found)) => {
                let matches = if cfg!(windows) {
                    expected
                        .as_os_str()
                        .to_string_lossy()
                        .eq_ignore_ascii_case(&found.as_os_str().to_string_lossy())
                } else {
                    expected == found
                };

                if !matches {
                    return false;
                }
            }
        }
    }
}

/// Tracks how long each path has held its size. A file is only ready once it
/// has stopped growing, which is what keeps a file still being copied into the
/// watched directory from being handed over half written.
#[derive(Default)]
struct StabilityTracker {
    sizes: HashMap<String, (u64, u8)>,
}

impl StabilityTracker {
    /// Records the size seen for `path` and reports whether it has now been
    /// stable for long enough to compress.
    fn observe(&mut self, path: &str, size: u64) -> bool {
        let entry = self.sizes.entry(path.to_string()).or_insert((size, 0));

        if entry.0 == size {
            entry.1 += 1;
        } else {
            *entry = (size, 0);
        }

        if entry.1 >= STABLE_POLLS {
            self.sizes.remove(path);
            true
        } else {
            false
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WatchDiscovery {
    pub paths: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WatchFailure {
    pub message: String,
}

/// Watch bookkeeping. `generation` is bumped whenever a watch starts or stops,
/// which is how a running loop learns that it has been superseded.
pub struct WatchState {
    generation: Arc<Mutex<u64>>,
}

impl WatchState {
    pub fn new() -> Self {
        Self {
            generation: Arc::new(Mutex::new(0)),
        }
    }

    fn next_generation(&self) -> u64 {
        let mut generation = self.generation.lock().unwrap();
        *generation += 1;
        *generation
    }

    fn current_generation(&self) -> u64 {
        *self.generation.lock().unwrap()
    }
}

impl Default for WatchState {
    fn default() -> Self {
        Self::new()
    }
}

/// Starts watching `source_dir`. Files already present are announced on the
/// first pass, so pointing the app at a folder of existing footage and
/// pressing start processes it.
pub fn start(
    app: &AppHandle,
    source_dir: &str,
    output_dir: &str,
    include_subfolders: bool,
) -> Result<(), String> {
    let source = PathBuf::from(source_dir);
    if !source.is_dir() {
        return Err(format!("Source directory does not exist: {}", source_dir));
    }

    let output = PathBuf::from(output_dir);
    if !output.is_dir() {
        return Err(format!("Output directory does not exist: {}", output_dir));
    }

    // Writing results back into the directory being watched would queue every
    // output as fresh input.
    if source.canonicalize().ok() == output.canonicalize().ok() {
        return Err(String::from(
            "The source and output directories must be different.",
        ));
    }

    let generation = app.state::<WatchState>().next_generation();
    let app_handle = app.clone();
    let watched = source_dir.to_string();

    tokio::spawn(async move {
        watch_loop(app_handle, source, output, generation, include_subfolders).await;
        log::info!("[watch] stopped watching {}", watched);
    });

    log::info!("[watch] watching {} -> {}", source_dir, output_dir);
    Ok(())
}

/// Stops the current watch, if any. Bumping the generation is enough: the
/// running loop notices on its next tick and returns.
pub fn stop(app: &AppHandle) {
    app.state::<WatchState>().next_generation();
}

async fn watch_loop(
    app: AppHandle,
    source: PathBuf,
    output: PathBuf,
    generation: u64,
    include_subfolders: bool,
) {
    // `None` recurses without limit; `Some(0)` stays in the top directory.
    let depth = if include_subfolders { None } else { Some(0) };
    let mut tracker = StabilityTracker::default();
    // Paths already handed to the renderer.
    let mut announced: HashSet<String> = HashSet::new();

    loop {
        if app.state::<WatchState>().current_generation() != generation {
            return;
        }

        match collect_files(&source.to_string_lossy(), depth) {
            Ok(files) => {
                let mut ready: Vec<String> = Vec::new();

                for file in files {
                    if announced.contains(&file) {
                        continue;
                    }

                    // An output directory nested inside the watched directory
                    // would otherwise feed compressed files back in forever.
                    if is_within(Path::new(&file), &output) {
                        continue;
                    }

                    let size = match std::fs::metadata(&file) {
                        Ok(metadata) => metadata.len(),
                        Err(_) => continue,
                    };

                    if tracker.observe(&file, size) {
                        announced.insert(file.clone());
                        ready.push(file);
                    }
                }

                if !ready.is_empty() {
                    // The renderer reads and previews these paths, so they have
                    // to be inside the fs and asset scopes first.
                    if let Err(err) = allow_asset_scopes(&app, ready.clone(), Some(0)) {
                        log::error!("[watch] could not allow scopes: {}", err);
                    }

                    log::info!("[watch] discovered {} file(s)", ready.len());
                    let _ = app.emit(
                        CustomEvents::WatchFilesDiscovered.as_ref(),
                        WatchDiscovery { paths: ready },
                    );
                }
            }
            Err(err) => {
                let _ = app.emit(
                    CustomEvents::WatchFailed.as_ref(),
                    WatchFailure {
                        message: err.to_string(),
                    },
                );
                return;
            }
        }

        tokio::time::sleep(POLL_INTERVAL).await;
    }
}

#[cfg(test)]
mod tests {
    use super::{is_within, StabilityTracker};
    use std::path::Path;

    #[test]
    fn spots_a_file_inside_the_output_directory() {
        assert!(is_within(
            Path::new("/media/out/clip.mp4"),
            Path::new("/media/out")
        ));
        assert!(!is_within(
            Path::new("/media/in/clip.mp4"),
            Path::new("/media/out")
        ));
    }

    #[test]
    fn a_sibling_with_a_shared_prefix_is_not_inside() {
        // A plain string prefix test would wrongly call this a match.
        assert!(!is_within(
            Path::new("/media/output2/clip.mp4"),
            Path::new("/media/output")
        ));
    }

    #[test]
    #[cfg(windows)]
    fn windows_path_case_does_not_matter() {
        assert!(is_within(
            Path::new(r"C:\Media\Out\clip.mp4"),
            Path::new(r"c:\media\out")
        ));
    }

    #[test]
    fn holds_a_file_back_until_its_size_settles() {
        let mut tracker = StabilityTracker::default();

        // Still being copied in: the size climbs on every poll.
        assert!(!tracker.observe("clip.mov", 1_000));
        assert!(!tracker.observe("clip.mov", 5_000));
        assert!(!tracker.observe("clip.mov", 9_000));

        // The copy has finished, so the size now repeats.
        assert!(!tracker.observe("clip.mov", 9_000));
        assert!(tracker.observe("clip.mov", 9_000));
    }

    #[test]
    fn a_file_that_never_changes_is_ready_on_the_second_poll() {
        let mut tracker = StabilityTracker::default();

        assert!(!tracker.observe("still.png", 4_096));
        assert!(tracker.observe("still.png", 4_096));
    }

    #[test]
    fn tracks_each_path_independently() {
        let mut tracker = StabilityTracker::default();

        assert!(!tracker.observe("a.mp4", 100));
        assert!(!tracker.observe("b.mp4", 200));
        assert!(!tracker.observe("a.mp4", 900));
        assert!(tracker.observe("b.mp4", 200));
    }
}
