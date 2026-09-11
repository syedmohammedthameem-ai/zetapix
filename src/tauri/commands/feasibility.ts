import { core } from '@tauri-apps/api'

import { FeasibilityReport } from '@/types/compression'

/**
 * Judges a ratio against one file without encoding it. Probe only, so it is
 * cheap enough to run before every job.
 */
export function estimateCompression(
  videoPath: string,
  ratio: number,
): Promise<FeasibilityReport> {
  return core.invoke('estimate_compression', { videoPath, ratio })
}
