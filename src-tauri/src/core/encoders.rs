use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::core::ffmpeg::FFMPEG;
use crate::core::media_process::MediaProcessExecutorBuilder;

/// A chip the user can hand the encode to. `cpu` is always present; the rest
/// appear only when the bundled FFmpeg actually carries their encoder, so the
/// picker never offers hardware that would fail at encode time.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Chip {
    pub id: String,
    pub label: String,
    pub encoder_h264: Option<String>,
    pub encoder_hevc: Option<String>,
}

/// Vendor to the encoder names that prove it is usable, in UI order.
const VENDORS: [(&str, &str, &str, &str); 4] = [
    ("nvidia", "NVIDIA", "h264_nvenc", "hevc_nvenc"),
    ("amd", "AMD", "h264_amf", "hevc_amf"),
    ("intel", "Intel", "h264_qsv", "hevc_qsv"),
    ("apple", "Apple", "h264_videotoolbox", "hevc_videotoolbox"),
];

static ENCODER_CACHE: Mutex<Option<Vec<String>>> = Mutex::new(None);

/// Encoder names the bundled FFmpeg reports. Probed once, then cached, because
/// `ffmpeg -encoders` costs a process spawn and the answer cannot change while
/// the app is running.
pub async fn encoder_names(app: &AppHandle) -> Result<Vec<String>, String> {
    {
        let cached = ENCODER_CACHE.lock().map_err(|err| err.to_string())?;
        if let Some(names) = cached.as_ref() {
            return Ok(names.clone());
        }
    }

    let names = probe_encoder_names(app).await?;

    let mut cached = ENCODER_CACHE.lock().map_err(|err| err.to_string())?;
    *cached = Some(names.clone());
    Ok(names)
}

async fn probe_encoder_names(app: &AppHandle) -> Result<Vec<String>, String> {
    let ffmpeg = FFMPEG::new(app)?;
    let mut command = ffmpeg.get_ffmpeg_command()?;
    command.args(["-hide_banner", "-encoders"]);

    let output = MediaProcessExecutorBuilder::new(app.clone())
        .command(command)
        .build()?
        .spawn_and_wait_with_output()
        .await?;

    if !output.success() {
        return Err(String::from("Could not read the encoder list from FFmpeg."));
    }

    Ok(parse_encoder_names(&output.stdout))
}

/// Pulls the encoder name out of each row of `ffmpeg -encoders`. Rows look like
/// ` V....D hevc_videotoolbox    VideoToolbox H.265 Encoder`, and the header
/// above the `------` separator is skipped.
fn parse_encoder_names(listing: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut past_header = false;

    for line in listing.lines() {
        if !past_header {
            if line.trim_start().starts_with("------") {
                past_header = true;
            }
            continue;
        }

        let mut fields = line.split_whitespace();
        let flags = match fields.next() {
            Some(flags) => flags,
            None => continue,
        };
        // The flag column is six characters of capability letters and dots.
        if flags.len() < 6 {
            continue;
        }
        if let Some(name) = fields.next() {
            names.push(name.to_string());
        }
    }

    names
}

/// Builds the chip list for the picker from the probed encoder names.
pub fn chips_from_encoders(encoders: &[String]) -> Vec<Chip> {
    let mut chips = vec![Chip {
        id: String::from("cpu"),
        label: String::from("CPU"),
        encoder_h264: Some(String::from("libx264")),
        encoder_hevc: Some(String::from("libx265")),
    }];

    for (id, label, h264, hevc) in VENDORS {
        let has_h264 = encoders.iter().any(|name| name == h264);
        let has_hevc = encoders.iter().any(|name| name == hevc);

        if has_h264 || has_hevc {
            chips.push(Chip {
                id: String::from(id),
                label: String::from(label),
                encoder_h264: has_h264.then(|| String::from(h264)),
                encoder_hevc: has_hevc.then(|| String::from(hevc)),
            });
        }
    }

    chips
}

/// Encoder to use for `chip`, or `None` to leave the choice to the caller.
/// `prefer_hevc` picks the HEVC encoder where the chip has one.
pub fn hardware_encoder(chip: &str, prefer_hevc: bool, encoders: &[String]) -> Option<String> {
    if chip == "cpu" {
        return None;
    }

    let (_, _, h264, hevc) = VENDORS.iter().find(|(id, _, _, _)| *id == chip)?;
    let preferred = if prefer_hevc { hevc } else { h264 };

    if encoders.iter().any(|name| name == preferred) {
        return Some(String::from(*preferred));
    }

    // A chip may carry only one of the two families.
    let fallback = if prefer_hevc { h264 } else { hevc };
    encoders
        .iter()
        .any(|name| name == fallback)
        .then(|| String::from(*fallback))
}

/// First hardware encoder this build can actually use, in vendor order.
/// `None` means the machine has none and the encode belongs on the CPU.
pub fn best_hardware_encoder(encoders: &[String], prefer_hevc: bool) -> Option<String> {
    VENDORS
        .iter()
        .find_map(|(id, _, _, _)| hardware_encoder(id, prefer_hevc, encoders))
}

/// True when `encoder` is a hardware encoder, which changes how quality and
/// rate are expressed on the command line.
pub fn is_hardware_encoder(encoder: &str) -> bool {
    encoder.ends_with("_nvenc")
        || encoder.ends_with("_amf")
        || encoder.ends_with("_qsv")
        || encoder.ends_with("_videotoolbox")
}

/// Quality flag for a hardware encoder, mapped from the 0-100 quality slider.
/// Each vendor spells constant quality differently.
pub fn hardware_quality_args(encoder: &str, quality: u16) -> Vec<String> {
    let quality = quality.min(100);

    if encoder.ends_with("_videotoolbox") {
        // VideoToolbox takes 1-100 where higher is better, matching the slider.
        return vec![String::from("-q:v"), format!("{}", quality.max(1))];
    }

    // The rest take a quantiser where lower is better, so the slider inverts.
    let qp = 51 - (51 * quality as u32 / 100);
    if encoder.ends_with("_nvenc") {
        vec![String::from("-cq"), format!("{}", qp)]
    } else if encoder.ends_with("_qsv") {
        vec![String::from("-global_quality"), format!("{}", qp)]
    } else {
        vec![String::from("-qp"), format!("{}", qp)]
    }
}

#[cfg(test)]
mod tests {
    use super::{
        chips_from_encoders, hardware_encoder, hardware_quality_args, is_hardware_encoder,
        parse_encoder_names,
    };

    const LISTING: &str = "Encoders:
 V..... = Video
 ------
 V....D h264_videotoolbox    VideoToolbox H.264 Encoder
 V....D hevc_videotoolbox    VideoToolbox H.265 Encoder
 V....D libx264              libx264 H.264 / AVC
 A....D aac                  AAC (Advanced Audio Coding)
";

    #[test]
    fn reads_encoder_names_from_the_listing() {
        let names = parse_encoder_names(LISTING);
        assert!(names.contains(&String::from("h264_videotoolbox")));
        assert!(names.contains(&String::from("libx264")));
        assert!(names.contains(&String::from("aac")));
        assert!(!names.contains(&String::from("Encoders:")));
    }

    #[test]
    fn offers_only_chips_the_build_can_actually_use() {
        let chips = chips_from_encoders(&parse_encoder_names(LISTING));
        let ids: Vec<&str> = chips.iter().map(|chip| chip.id.as_str()).collect();

        assert_eq!(ids, vec!["cpu", "apple"]);
    }

    #[test]
    fn cpu_never_resolves_to_a_hardware_encoder() {
        let encoders = parse_encoder_names(LISTING);
        assert_eq!(hardware_encoder("cpu", true, &encoders), None);
    }

    #[test]
    fn picks_the_requested_family_then_falls_back() {
        let encoders = vec![String::from("h264_nvenc")];

        assert_eq!(
            hardware_encoder("nvidia", false, &encoders),
            Some(String::from("h264_nvenc"))
        );
        // No HEVC encoder on this build, so the H.264 one stands in.
        assert_eq!(
            hardware_encoder("nvidia", true, &encoders),
            Some(String::from("h264_nvenc"))
        );
    }

    #[test]
    fn a_missing_chip_resolves_to_nothing() {
        assert_eq!(hardware_encoder("nvidia", true, &[]), None);
    }

    #[test]
    fn finds_whatever_hardware_the_build_carries() {
        use super::best_hardware_encoder;

        let encoders = parse_encoder_names(LISTING);
        assert_eq!(
            best_hardware_encoder(&encoders, true),
            Some(String::from("hevc_videotoolbox"))
        );
        assert_eq!(best_hardware_encoder(&[], true), None);
    }

    #[test]
    fn recognises_hardware_encoders() {
        assert!(is_hardware_encoder("hevc_nvenc"));
        assert!(is_hardware_encoder("h264_videotoolbox"));
        assert!(!is_hardware_encoder("libx265"));
    }

    #[test]
    fn maps_the_quality_slider_per_vendor() {
        assert_eq!(
            hardware_quality_args("h264_videotoolbox", 50),
            vec![String::from("-q:v"), String::from("50")]
        );
        // Higher slider means a lower quantiser for the rest.
        assert_eq!(
            hardware_quality_args("hevc_nvenc", 100),
            vec![String::from("-cq"), String::from("0")]
        );
        assert_eq!(
            hardware_quality_args("hevc_nvenc", 0),
            vec![String::from("-cq"), String::from("51")]
        );
    }
}
