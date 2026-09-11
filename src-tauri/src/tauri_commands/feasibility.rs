use tauri::AppHandle;

use crate::core::feasibility::{assess, FeasibilityReport};
use crate::core::ffprobe::FFPROBE;

/// Parses an FFmpeg rational such as "60000/1001" into frames per second.
fn parse_rate(rate: &str) -> Option<f64> {
    let (numerator, denominator) = rate.split_once('/')?;
    let numerator: f64 = numerator.parse().ok()?;
    let denominator: f64 = denominator.parse().ok()?;
    if denominator == 0.0 {
        return None;
    }
    Some(numerator / denominator)
}

/// Judges a requested ratio against one file, without encoding anything.
/// Probe only, so it is fast enough to run as the operator changes the ratio.
#[tauri::command]
pub async fn estimate_compression(
    app: AppHandle,
    video_path: String,
    ratio: f64,
) -> Result<FeasibilityReport, String> {
    let (video_streams, audio_streams, container) = {
        let mut ffprobe = FFPROBE::new(&app)?;
        let video = ffprobe.get_video_streams(&video_path).await?;
        let audio = ffprobe.get_audio_streams(&video_path).await?;
        let container = ffprobe.get_container_info(&video_path).await?;
        (video, audio, container)
    };

    let stream = video_streams
        .first()
        .ok_or_else(|| String::from("The file carries no video stream."))?;

    let audio_bitrate_bps: u64 = audio_streams
        .iter()
        .filter_map(|track| track.bit_rate.as_ref())
        .filter_map(|rate| rate.parse::<u64>().ok())
        .sum();

    let total_bitrate_bps = container.bit_rate.unwrap_or(0);

    // Some containers omit a per-stream bitrate, in which case what is left of
    // the file after audio is the best available estimate for the video.
    let video_bitrate_bps = stream
        .bit_rate
        .as_ref()
        .and_then(|rate| rate.parse::<u64>().ok())
        .unwrap_or_else(|| total_bitrate_bps.saturating_sub(audio_bitrate_bps));

    let fps = parse_rate(&stream.avg_frame_rate)
        .or_else(|| parse_rate(&stream.r_frame_rate))
        .unwrap_or(0.0);

    assess(
        &stream.codec,
        video_bitrate_bps,
        total_bitrate_bps,
        audio_bitrate_bps,
        stream.width,
        stream.height,
        fps,
        ratio,
    )
}
