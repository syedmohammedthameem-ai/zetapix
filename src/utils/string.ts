/**
 *  Converts string duration to milliseconds
 *
 * @param {string} duration: Time Duration. The format can be "HH:MM:SS" or "HH:MM:SS.mm"
 * @returns {number}: The converted milliseconds. If the format is wrong, it'll return 0.
 */
export function convertDurationToMilliseconds(duration: string) {
  try {
    const [h, m, s] = duration.split(':')
    const hours = Number.parseInt(h, 10)
    const minutes = Number.parseInt(m, 10)
    const seconds = Number.parseFloat(s)
    const milliseconds =
      hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000
    return Number.isNaN(milliseconds) ? 0 : milliseconds
  } catch (_) {
    return 0
  }
}

/**
 *  Converts duration in seconds to HH:MM:SS.mm
 *
 * @param {number} totalSeconds: Time duration in seconds
 * @returns {string}: Formatted duration in HH:MM::SS.mm
 */
export function formatDuration(
  totalSeconds: number,
  options: { enableHoursWhenZero?: boolean; disableMilliseconds?: boolean } = {
    enableHoursWhenZero: false,
    disableMilliseconds: false,
  },
): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  const milliseconds = Math.floor(
    (totalSeconds - Math.floor(totalSeconds)) * 100,
  )

  const pad = (n: number, size = 2) => n.toString().padStart(size, '0')
  const hoursPart =
    (options?.enableHoursWhenZero && hours === 0) || hours !== 0
      ? `${pad(hours)}:`
      : ''
  return `${hoursPart}${pad(minutes)}:${pad(seconds)}${!options?.disableMilliseconds ? `.${pad(milliseconds)}` : ''}`
}
