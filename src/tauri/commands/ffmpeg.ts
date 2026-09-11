import { core } from '@tauri-apps/api'

import {
  BatchCompressionResult,
  VideoCompressionConfig,
  VideoThumbnail,
} from '@/types/compression'

export function compressVideos(
  batchId: string,
  videos: VideoCompressionConfig[],
): Promise<BatchCompressionResult> {
  return core.invoke('compress_videos_batch', {
    batchId,
    videos,
  })
}

export function generateVideoThumbnail(
  videoPath: string,
  timestamp?: string,
): Promise<VideoThumbnail> {
  return core.invoke('generate_video_thumbnail', { videoPath, timestamp })
}

export function extractSubtitle(
  videoPath: string,
  streamIndex: number,
  outputPath: string,
  format?: 'srt' | 'vtt',
): Promise<string> {
  return core.invoke('extract_subtitle', {
    videoPath,
    streamIndex,
    outputPath,
    format: format || 'srt',
  })
}
