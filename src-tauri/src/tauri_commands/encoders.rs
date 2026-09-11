use tauri::AppHandle;

use crate::core::encoders::{chips_from_encoders, encoder_names, Chip};

/// Chips this machine can actually encode on, in picker order. CPU is always
/// first; a vendor appears only when the bundled FFmpeg carries its encoder.
#[tauri::command]
pub async fn get_available_chips(app: AppHandle) -> Result<Vec<Chip>, String> {
    let names = encoder_names(&app).await?;
    let chips = chips_from_encoders(&names);

    log::info!(
        "[encoders] {} encoder(s) reported, chips available: {}",
        names.len(),
        chips
            .iter()
            .map(|chip| chip.id.as_str())
            .collect::<Vec<_>>()
            .join(", ")
    );

    Ok(chips)
}
