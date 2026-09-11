use serde::{Deserialize, Serialize};

/// Codecs that store every frame whole. They carry enormous redundancy between
/// frames, which is exactly the redundancy an inter-frame encoder removes, so
/// they have far more headroom than an already-compressed source.
const INTRA_ONLY_CODECS: [&str; 7] = [
    "mjpeg", "prores", "dnxhd", "dnxhr", "rawvideo", "v210", "huffyuv",
];

/// How much room the target bitrate leaves per pixel per frame.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Density {
    /// 0.10 bpp and above.
    Ok,
    /// 0.04 up to 0.10 bpp.
    Marginal,
    /// Below 0.04 bpp.
    Aggressive,
}

/// How much the source itself can still give up.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Headroom {
    High,
    Medium,
    Low,
}

impl Headroom {
    /// Ratio band that is realistic for a source with this much headroom.
    fn band(self) -> (f64, f64) {
        match self {
            Headroom::High => (15.0, 50.0),
            Headroom::Medium => (3.0, 10.0),
            Headroom::Low => (1.5, 3.0),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FeasibilityReport {
    pub source_codec: String,
    pub source_bitrate_bps: u64,
    pub source_bpp: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub is_intra_only: bool,

    pub requested_ratio: f64,
    pub target_video_bitrate_bps: u64,
    pub target_bpp: f64,

    pub density: Density,
    pub headroom: Headroom,
    pub plausible_min_ratio: f64,
    pub plausible_max_ratio: f64,
    pub is_plausible: bool,
    /// Populated only when the request sits outside the plausible band.
    pub reason: Option<String>,
}

fn is_intra_only(codec: &str) -> bool {
    let codec = codec.to_ascii_lowercase();
    INTRA_ONLY_CODECS
        .iter()
        .any(|known| codec.starts_with(known))
}

/// Human name for a codec, for text an operator reads.
fn codec_label(codec: &str) -> String {
    match codec.to_ascii_lowercase().as_str() {
        "hevc" | "h265" => String::from("H.265"),
        "h264" | "avc" => String::from("H.264"),
        "av1" => String::from("AV1"),
        "vp9" => String::from("VP9"),
        "vp8" => String::from("VP8"),
        "mpeg2video" => String::from("MPEG-2"),
        "prores" => String::from("ProRes"),
        "mjpeg" => String::from("Motion JPEG"),
        other => other.to_uppercase(),
    }
}

fn classify_density(bpp: f64) -> Density {
    if bpp >= 0.10 {
        Density::Ok
    } else if bpp >= 0.04 {
        Density::Marginal
    } else {
        Density::Aggressive
    }
}

fn classify_headroom(codec: &str, source_bpp: f64) -> Headroom {
    if is_intra_only(codec) {
        Headroom::High
    } else if source_bpp > 0.15 {
        Headroom::Medium
    } else {
        Headroom::Low
    }
}

/// Judges a requested ratio against what the source can realistically give.
///
/// `total_bitrate_bps` is the whole file, `audio_bitrate_bps` the part that
/// survives untouched, and the difference is what the video encoder is left to
/// work with.
#[allow(clippy::too_many_arguments)]
pub fn assess(
    source_codec: &str,
    source_video_bitrate_bps: u64,
    total_bitrate_bps: u64,
    audio_bitrate_bps: u64,
    width: u32,
    height: u32,
    fps: f64,
    requested_ratio: f64,
) -> Result<FeasibilityReport, String> {
    if width == 0 || height == 0 || fps <= 0.0 {
        return Err(String::from(
            "The source reports no usable resolution or frame rate.",
        ));
    }
    if requested_ratio <= 1.0 {
        return Err(String::from("A compression ratio must be above 1:1."));
    }

    let pixels_per_second = width as f64 * height as f64 * fps;
    let source_bpp = source_video_bitrate_bps as f64 / pixels_per_second;

    // The ratio applies to the whole file, and a 2% container allowance comes
    // off before the video encoder sees its share.
    let target_total_bps = total_bitrate_bps as f64 / requested_ratio;
    let target_video_bps = target_total_bps * 0.98 - audio_bitrate_bps as f64;

    if target_video_bps <= 0.0 {
        return Err(format!(
            "{:.0}:1 leaves nothing for video once the {} kbps audio is kept.",
            requested_ratio,
            audio_bitrate_bps / 1000
        ));
    }

    let target_bpp = target_video_bps / pixels_per_second;
    let headroom = classify_headroom(source_codec, source_bpp);
    let (plausible_min_ratio, plausible_max_ratio) = headroom.band();
    let is_plausible = requested_ratio <= plausible_max_ratio;

    let reason = if is_plausible {
        None
    } else {
        Some(format!(
            "Source is {} at {:.2} bpp, {}. {:.0}:1 is achievable in file size but not in quality. Realistic range for this file: {}:1 to {}:1.",
            codec_label(source_codec),
            source_bpp,
            match headroom {
                Headroom::High => "stored frame by frame with room to spare",
                Headroom::Medium => "moderately compressed already",
                Headroom::Low => "already efficiently encoded",
            },
            requested_ratio,
            format_ratio(plausible_min_ratio),
            format_ratio(plausible_max_ratio),
        ))
    };

    Ok(FeasibilityReport {
        source_codec: String::from(source_codec),
        source_bitrate_bps: source_video_bitrate_bps,
        source_bpp,
        width,
        height,
        fps,
        is_intra_only: is_intra_only(source_codec),
        requested_ratio,
        target_video_bitrate_bps: target_video_bps.round().max(0.0) as u64,
        target_bpp,
        density: classify_density(target_bpp),
        headroom,
        plausible_min_ratio,
        plausible_max_ratio,
        is_plausible,
        reason,
    })
}

fn format_ratio(ratio: f64) -> String {
    if (ratio - ratio.round()).abs() < 0.05 {
        format!("{:.0}", ratio)
    } else {
        format!("{:.1}", ratio)
    }
}

#[cfg(test)]
mod tests {
    use super::{assess, Density, Headroom};

    /// The 4K60 HEVC phone clip that prompted this check: 46.8 Mbps of video
    /// in 3840x2160 at 59.94, which is already an efficient encode.
    fn efficient_hevc(ratio: f64) -> super::FeasibilityReport {
        assess(
            "hevc",
            46_825_734,
            47_879_931,
            128_000,
            3840,
            2160,
            59.94,
            ratio,
        )
        .expect("a report")
    }

    #[test]
    fn an_efficient_source_has_low_headroom() {
        let report = efficient_hevc(10.0);

        assert_eq!(report.headroom, Headroom::Low);
        assert!(report.source_bpp < 0.15, "bpp was {}", report.source_bpp);
        assert_eq!((report.plausible_min_ratio, report.plausible_max_ratio), (1.5, 3.0));
    }

    #[test]
    fn ten_to_one_on_that_source_is_refused_with_a_reason() {
        let report = efficient_hevc(10.0);

        assert!(!report.is_plausible);
        let reason = report.reason.expect("a reason");
        assert!(reason.contains("H.265"), "{}", reason);
        assert!(reason.contains("1.5:1 to 3:1"), "{}", reason);
    }

    #[test]
    fn a_modest_ratio_on_that_source_is_allowed() {
        let report = efficient_hevc(2.5);

        assert!(report.is_plausible);
        assert!(report.reason.is_none());
    }

    #[test]
    fn an_intra_only_source_has_high_headroom() {
        // ProRes 422 HQ at 1080p25 runs around 220 Mbps.
        let report = assess(
            "prores", 220_000_000, 221_000_000, 1_536_000, 1920, 1080, 25.0, 30.0,
        )
        .expect("a report");

        assert!(report.is_intra_only);
        assert_eq!(report.headroom, Headroom::High);
        assert!(report.is_plausible, "30:1 should be fine for ProRes");
    }

    #[test]
    fn the_two_sample_codecs_land_in_different_bands() {
        let intra = assess(
            "prores", 220_000_000, 221_000_000, 1_536_000, 1920, 1080, 25.0, 20.0,
        )
        .expect("a report");
        let inter = efficient_hevc(20.0);

        assert_ne!(intra.headroom, inter.headroom);
        assert!(intra.is_plausible);
        assert!(!inter.is_plausible);
    }

    #[test]
    fn density_falls_as_the_ratio_climbs() {
        let gentle = efficient_hevc(2.0);
        let hard = efficient_hevc(10.0);
        let extreme = efficient_hevc(40.0);

        assert!(gentle.target_bpp > hard.target_bpp);
        assert!(hard.target_bpp > extreme.target_bpp);

        // 0.10 bpp at 4K60 is 49.7 Mbps, so even a gentle ratio on this clip
        // is already below the comfortable band.
        assert_eq!(gentle.density, Density::Marginal);
        assert_eq!(extreme.density, Density::Aggressive);
    }

    #[test]
    fn a_gentle_ratio_at_1080p_stays_in_the_comfortable_band() {
        // 20 Mbps H.264 at 1080p30 halved still leaves 0.12 bpp.
        let report = assess(
            "h264", 20_000_000, 20_128_000, 128_000, 1920, 1080, 30.0, 2.5,
        )
        .expect("a report");

        assert_eq!(report.density, Density::Ok);
    }

    #[test]
    fn a_ratio_of_one_or_below_is_rejected() {
        assert!(assess("h264", 8_000_000, 8_100_000, 128_000, 1920, 1080, 30.0, 1.0).is_err());
        assert!(assess("h264", 8_000_000, 8_100_000, 128_000, 1920, 1080, 30.0, 0.5).is_err());
    }

    #[test]
    fn a_target_below_the_kept_audio_is_rejected() {
        // 320 kbps audio against a 400 kbps total leaves no room at 100:1.
        assert!(assess("h264", 8_000_000, 8_100_000, 320_000, 1920, 1080, 30.0, 100.0).is_err());
    }

    #[test]
    fn unusable_source_geometry_is_rejected() {
        assert!(assess("h264", 8_000_000, 8_100_000, 128_000, 0, 1080, 30.0, 4.0).is_err());
        assert!(assess("h264", 8_000_000, 8_100_000, 128_000, 1920, 1080, 0.0, 4.0).is_err());
    }
}
