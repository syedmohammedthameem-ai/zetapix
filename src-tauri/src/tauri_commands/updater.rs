use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use tauri::Emitter;

use crate::core::domain::UpdateInfo;

#[tauri::command]
pub async fn check_update(app_handle: tauri::AppHandle) -> Result<UpdateInfo, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app_handle
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    let current_version = app_handle.package_info().version.to_string();

    let response = match updater.check().await {
        Ok(Some(response)) => response,
        Ok(None) => {
            return Ok(UpdateInfo {
                is_update_available: false,
                current_version: current_version,
                latest_version: None,
                body: None,
                date: None,
            });
        }
        Err(e) => return Err(format!("Failed to check for updates: {}", e)),
    };

    let date_str = response.date.map(|d| d.to_string());

    Ok(UpdateInfo {
        is_update_available: true,
        current_version: current_version,
        latest_version: Some(response.version.clone()),
        body: Some(response.body.clone().unwrap_or_default()),
        date: date_str,
    })
}

#[tauri::command]
pub async fn download_and_install_update(app_handle: tauri::AppHandle) -> Result<String, String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app_handle
        .updater()
        .map_err(|e| format!("Failed to get updater: {}", e))?;

    let response = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for update: {}", e))?
        .ok_or("No update available")?;

    let downloaded = AtomicUsize::new(0);
    let total_size = AtomicU64::new(0);
    let _bytes = response
        .download_and_install(
            &|chunk_length, content_length| {
                let prev = downloaded.fetch_add(chunk_length, Ordering::SeqCst);

                if total_size.load(Ordering::SeqCst) == 0 {
                    if let Some(len) = content_length {
                        total_size.store(len, Ordering::SeqCst);
                    }
                }

                let total = total_size.load(Ordering::SeqCst);
                if total > 0 {
                    let progress = ((prev as f64 / total as f64) * 100.0) as u32;
                    let _ = app_handle.emit("update-event", progress.to_string());
                }
            },
            &|| {
                let _ = app_handle.emit("update-event", "100");
            },
        )
        .await
        .map_err(|e| format!("Failed to download update: {}", e))?;
    Ok("Update downloaded and installed successfully.".to_string())
}
