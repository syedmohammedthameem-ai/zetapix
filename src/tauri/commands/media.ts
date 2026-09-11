import { core } from '@tauri-apps/api'

import {
  ImageCompressionConfig,
  MediaBatchCompressionResult,
  VideoCompressionConfig,
} from '@/types/compression'

export async function compressMediaBatch(
  batchId: string,
  media: {
    videoConfig?: VideoCompressionConfig
    imageConfig?: ImageCompressionConfig
  }[],
): Promise<MediaBatchCompressionResult> {
  return core.invoke('compress_media_batch', {
    batchId,
    media,
  })
}
