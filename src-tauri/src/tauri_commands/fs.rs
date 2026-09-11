use std::path::PathBuf;

use clipboard_rs::{common::RustImage, Clipboard, ClipboardContext};
use tauri::{AppHandle, Manager, Url};
use tauri_plugin_fs::FsExt;

use crate::core::{domain::FileMetadata, ffmpeg};
use crate::sys::fs::{self, collect_files};

#[tauri::command]
pub async fn get_file_metadata(file_path: &str) -> Result<FileMetadata, String> {
    fs::get_file_metadata(file_path)
}

#[tauri::command]
pub async fn get_image_dimension(image_path: &str) -> Result<(u32, u32), String> {
    fs::get_image_dimension(image_path)
}

#[tauri::command]
pub async fn get_svg_dimension(image_path: &str) -> Result<(u32, u32), String> {
    fs::get_svg_dimension(image_path)
}

#[tauri::command]
pub async fn move_file(from: &str, to: &str) -> Result<(), String> {
    if let Err(err) = fs::copy_file(from, to).await {
        return Err(err.to_string());
    }

    if let Err(err) = fs::delete_file(from).await {
        return Err(err.to_string());
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_file(path: &str) -> Result<(), String> {
    if let Err(err) = fs::delete_file(path).await {
        return Err(err.to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_cache(app: tauri::AppHandle) -> Result<(), String> {
    let ffmpeg = ffmpeg::FFMPEG::new(&app)?;
    if let Err(err) = fs::delete_stale_files(&ffmpeg.get_asset_dir(), 0).await {
        return Err(err.to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn copy_file_to_clipboard(_: tauri::AppHandle, file_path: &str) -> Result<(), String> {
    let ctx = ClipboardContext::new().map_err(|err| err.to_string())?;
    ctx.set_files(vec![file_path.to_owned()])
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn read_files_from_clipboard(
    app_handle: tauri::AppHandle,
) -> Result<Vec<String>, String> {
    let ctx = ClipboardContext::new().map_err(|err| err.to_string())?;

    let files_result = ctx.get_files();

    if let Ok(paths) = files_result {
        if !paths.is_empty() {
            return Ok(allow_asset_scopes(&app_handle, paths, Some(0))?);
        }
    }

    // If no files found, try to get image from clipboard
    let image_result = ctx.get_image();

    if let Ok(img) = image_result {
        let assets_dir = fs::ensure_assets_dir(&app_handle)?;

        let filename = format!("{}.png", nanoid::nanoid!());
        let image_path = assets_dir.join(&filename);

        img.save_to_path(image_path.to_str().unwrap())
            .map_err(|err| err.to_string())?;

        let fs_scope = app_handle.fs_scope();
        let asset_scope = app_handle.asset_protocol_scope();
        let _ = fs_scope.allow_file(image_path.to_str().unwrap());
        let _ = asset_scope.allow_file(image_path.to_str().unwrap());

        return Ok(vec![image_path.to_str().unwrap().to_string()]);
    }

    Err("No files or images found in clipboard".to_string())
}

#[tauri::command]
pub async fn read_files_from_paths(
    app_handle: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<Vec<String>, String> {
    Ok(allow_asset_scopes(&app_handle, paths, Some(0))?)
}

/// Allow asset scopes to all the files within paths with configurable depth
///
/// # Arguments
/// * `paths` - The file or directory paths to allow scopes
/// * `depth` - Optional depth level for directory traversal. See `@src-tauri/src/lib/fs.rs#collect_files` depth param for more info.
///
/// # Returns
/// A vector of file paths where asset scopes are applied
pub fn allow_asset_scopes(
    app_handle: &AppHandle,
    paths: Vec<String>,
    depth: Option<u32>,
) -> Result<Vec<String>, String> {
    let fs_scope = app_handle.fs_scope();
    let asset_scope = app_handle.asset_protocol_scope();

    let mut all_files = Vec::new();

    for path in &paths {
        let path_buf: PathBuf = if path.starts_with("file://") {
            Url::parse(path)
                .map_err(|e| e.to_string())?
                .to_file_path()
                .map_err(|_| "Invalid file URL".to_string())?
        } else {
            PathBuf::from(path)
        };

        let files =
            collect_files(path_buf.to_str().unwrap(), depth).map_err(|err| err.to_string())?;

        for file in &files {
            let _ = fs_scope.allow_file(file);
            let _ = asset_scope.allow_file(file);
        }

        all_files.extend(files);
    }

    Ok(all_files)
}
