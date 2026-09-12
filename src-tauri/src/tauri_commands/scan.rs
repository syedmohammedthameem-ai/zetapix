use serde::Serialize;
use tauri::AppHandle;

use crate::sys::fs::collect_files;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub path: String,
    pub file_name: String,
    pub extension: String,
    pub size_bytes: u64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FolderScan {
    pub files: Vec<ScannedFile>,
    pub total_bytes: u64,
}

/// Lists what is sitting in a folder, with sizes. Cheap on purpose: it reads
/// directory entries only, never opening a file, so it can run every time the
/// operator changes a setting. Deciding which entries are media is left to the
/// renderer, which already owns the format list.
#[tauri::command]
pub async fn scan_folder(
    _app: AppHandle,
    directory: String,
    include_subfolders: bool,
) -> Result<FolderScan, String> {
    let depth = if include_subfolders { None } else { Some(0) };
    let paths = collect_files(&directory, depth).map_err(|err| err.to_string())?;

    let mut files = Vec::new();
    let mut total_bytes = 0u64;

    for path in paths {
        let metadata = match std::fs::metadata(&path) {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };

        let as_path = std::path::Path::new(&path);
        let file_name = as_path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_default();

        // Skip the dotfiles every folder accumulates.
        if file_name.starts_with('.') {
            continue;
        }

        let extension = as_path
            .extension()
            .map(|ext| ext.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        total_bytes += metadata.len();
        files.push(ScannedFile {
            path,
            file_name,
            extension,
            size_bytes: metadata.len(),
        });
    }

    Ok(FolderScan { files, total_bytes })
}
