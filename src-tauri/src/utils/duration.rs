/// Adds multiple "HH:MM:SS.MM" duration formats and returns the sum in the same format
pub fn add_durations(durations: &[&str]) -> Option<String> {
    let parse_time = |time_str: &str| -> Option<f64> {
        let parts: Vec<&str> = time_str.split(':').collect();
        if parts.len() != 3 {
            return None;
        }
        let hours: f64 = parts[0].parse().ok()?;
        let minutes: f64 = parts[1].parse().ok()?;
        let seconds: f64 = parts[2].parse().ok()?;
        Some(hours * 3600.0 + minutes * 60.0 + seconds)
    };

    let total_seconds: f64 = durations
        .iter()
        .map(|d| parse_time(d))
        .try_fold(0.0, |acc, val| Some(acc + val?))?;

    let hours = (total_seconds / 3600.0) as u32;
    let minutes = ((total_seconds % 3600.0) / 60.0) as u32;
    let seconds = total_seconds % 60.0;

    Some(format!("{:02}:{:02}:{:05.2}", hours, minutes, seconds))
}
