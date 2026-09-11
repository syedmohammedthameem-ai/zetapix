use tauri::AppHandle;

use crate::sys::watch;

#[tauri::command]
pub async fn start_directory_watch(
    app: AppHandle,
    source_dir: String,
    output_dir: String,
    include_subfolders: bool,
) -> Result<(), String> {
    watch::start(&app, &source_dir, &output_dir, include_subfolders)
}

#[tauri::command]
pub async fn stop_directory_watch(app: AppHandle) -> Result<(), String> {
    watch::stop(&app);
    Ok(())
}
