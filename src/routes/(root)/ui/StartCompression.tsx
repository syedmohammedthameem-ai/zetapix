import { core, event } from '@tauri-apps/api'
import { motion } from 'framer-motion'
import { useCallback } from 'react'
import { toast } from 'sonner'
import { snapshot, useSnapshot } from 'valtio'

import Button from '@/components/Button'
import { compressMediaBatch } from '@/tauri/commands/media'
import { CustomEvents, MediaBatchCompressionResult } from '@/types/compression'
import { formatBytes } from '@/utils/fs'
import CancelCompression from './CancelCompression'
import SaveMedia from './SaveMedia'
import {
  buildImageCompressionConfig,
  buildVideoCompressionConfig,
} from '../-compression-config'
import { appProxy } from '../-state'

function StartCompression() {
  const {
    state: {
      selectedMediaIndexForCustomization,
      isCompressing,
      isProcessCompleted,
      isLoadingMediaFiles,
    },
  } = useSnapshot(appProxy)

  const handleCompression = useCallback(async () => {
    const appSnapshot = snapshot(appProxy)
    if (appSnapshot.state.isCompressing) return

    // Resets
    appProxy.clearSnapshots()
    appProxy.state.isBatchCompressionCancelled = false
    appProxy.state.selectedMediaIndexForCustomization = -1
    appProxy.state.showMediaInfo = false
    for (const index in appProxy.state.media) {
      if (appProxy.state.media[index].type === 'video') {
        appProxy.state.media[index].config.isVideoTransformEditMode = false
        appProxy.state.media[index].config.isVideoTrimEditMode = false
      } else if (appProxy.state.media[index].type === 'image') {
        appProxy.state.media[index].config.isImageTransformEditMode = false
      }
    }

    appProxy.takeSnapshot('beforeCompressionStarted')

    try {
      appProxy.state.isCompressing = true

      for (const index in appProxy.state.media) {
        if (appProxy.state.media[index].type === 'video') {
          if (
            appProxy.state.media[index]?.config?.shouldTransformVideo &&
            appProxy.state.media[index].config?.transformVideoConfig?.previewUrl
          ) {
            appProxy.state.media[index].thumbnailPath =
              appProxy.state.media[
                index
              ]?.config?.transformVideoConfig?.previewUrl
          }
          appProxy.state.media[index].config.isVideoTransformEditMode = false
        } else if (appProxy.state.media[index].type === 'image') {
          if (
            appProxy.state.media[index]?.config?.shouldTransformImage &&
            appProxy.state.media[index].config?.transformImageConfig?.previewUrl
          ) {
            appProxy.state.media[index].thumbnailPath =
              appProxy.state.media[
                index
              ]?.config?.transformImageConfig?.previewUrl
          }
          appProxy.state.media[index].config.isImageTransformEditMode = false
        }
      }

      const batchId = `${+new Date()}`
      appProxy.state.batchId = batchId

      const abortController = new AbortController()
      const unlisten = await event.listen(
        CustomEvents.CancelInProgressCompression,
        () => {
          abortController.abort()
        },
      )

      const { results } = (await Promise.race([
        compressMediaBatch(
          batchId,
          appProxy.state.media.map((v) => ({
            videoConfig:
              v.type === 'video' ? buildVideoCompressionConfig(v) : undefined,
            imageConfig:
              v.type === 'image' ? buildImageCompressionConfig(v) : undefined,
          })),
        ),
        new Promise((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            unlisten()
            reject('CANCELLED')
          })
        }),
      ])) as MediaBatchCompressionResult

      unlisten()

      if (Object.keys(results).length === 0) {
        throw new Error()
      }

      appProxy.state.isCompressing = false
      appProxy.state.isProcessCompleted = true

      for (const index in appProxy.state.media) {
        if (appProxy.state.media[index].type === 'video') {
          const video = appProxy.state.media[index]
          const videoResult = results[video.id!] || null

          appProxy.state.media[index].isProcessCompleted = true
          appProxy.state.media[index].compressedFile = {
            isSuccessful: !(videoResult == null),
            fileName: videoResult?.fileMetadata?.fileName ?? video.fileName,
            fileNameToDisplay: `${video?.fileName?.slice(
              0,
              -((video?.extension?.length ?? 0) + 1),
            )}.${videoResult?.fileMetadata?.extension}`,
            pathRaw: videoResult?.fileMetadata?.path,
            path: core.convertFileSrc(videoResult?.fileMetadata?.path ?? ''),
            mimeType: videoResult?.fileMetadata?.mimeType,
            sizeInBytes: videoResult?.fileMetadata?.size,
            size: formatBytes(videoResult?.fileMetadata?.size ?? 0),
            extension: videoResult?.fileMetadata?.extension,
          }
        } else if (appProxy.state.media[index].type === 'image') {
          const image = appProxy.state.media[index]
          const imageResult = results[image.id!] || null

          appProxy.state.media[index].isProcessCompleted = true
          appProxy.state.media[index].compressedFile = {
            isSuccessful: !(imageResult == null),
            fileName: imageResult?.fileName ?? image.fileName,
            fileNameToDisplay: `${image?.fileName?.slice(
              0,
              -((image?.extension?.length ?? 0) + 1),
            )}.${imageResult?.fileMetadata?.extension}`,
            pathRaw: imageResult?.fileMetadata?.path,
            path: core.convertFileSrc(imageResult?.fileMetadata?.path ?? ''),
            mimeType: imageResult?.fileMetadata?.mimeType,
            sizeInBytes: imageResult?.fileMetadata?.size,
            size: formatBytes(imageResult?.fileMetadata?.size ?? 0),
            extension: imageResult?.fileMetadata?.extension,
          }
        }
      }
    } catch (error) {
      if (error !== 'CANCELLED') {
        toast.error('Something went wrong during compression.')
        appProxy.timeTravel('beforeCompressionStarted')
      }
    }
  }, [])

  return selectedMediaIndexForCustomization < 0 ? (
    <div className="mt-4">
      {isCompressing ? (
        <CancelCompression />
      ) : isProcessCompleted ? (
        <SaveMedia />
      ) : (
        <Button
          as={motion.button}
          onPress={handleCompression}
          fullWidth
          className="w-full text-primary bg-primary/20"
          isDisabled={isLoadingMediaFiles}
        >
          Process
        </Button>
      )}
    </div>
  ) : null
}

export default StartCompression
