import { TimelineAction } from '@xzdarcy/timeline-engine'

import { App, MediaMetadataConfig } from '@/types/app'
import {
  ImageCompressionConfig,
  MediaTransformHistory,
  resolveVideoOutputExtension,
  VideoCompressionConfig,
  VideoTrimSegment,
} from '@/types/compression'

type MediaItem = App['media'][number]

export type VideoMedia = Extract<MediaItem, { type: 'video' }>
export type ImageMedia = Extract<MediaItem, { type: 'image' }>

/**
 * Builds the payload the Rust side expects for one video. Shared by the
 * interactive flow and the watched-folder queue so that a file compresses
 * identically however it reached the app.
 */
export function buildVideoCompressionConfig(
  v: VideoMedia,
): VideoCompressionConfig {
  return {
    videoId: v.id!,
    videoPath: v.pathRaw!,
    convertToExtension: resolveVideoOutputExtension(
      v.config?.convertToExtension === '-'
        ? v.extension
        : v.config.convertToExtension,
    ),
    presetName: !v.config?.shouldDisableCompression
      ? v.config.presetName
      : null,
    quality: !v.config?.shouldDisableCompression
      ? (v.config?.quality as number)
      : 101,
    targetReduction:
      !v.config?.shouldDisableCompression &&
      v.config?.shouldEnableTargetReduction &&
      resolveVideoOutputExtension(
        v.config?.convertToExtension === '-'
          ? v.extension
          : v.config?.convertToExtension,
      ) !== 'gif'
        ? (v.config.targetReduction ?? 99)
        : null,
    audioConfig: {
      volume: v.config?.audioConfig?.volume ?? 100,
      audioChannelConfig:
        (v.config?.audioConfig?.volume ?? 100) !== 0
          ? (v.config?.audioConfig?.audioChannelConfig ?? null)
          : null,
      bitrate:
        (v.config?.audioConfig?.volume ?? 100) !== 0
          ? (v.config?.audioConfig?.bitrate ?? null)
          : null,
      audioCodec:
        v.config?.shouldEnableCustomAudioCodec &&
        v.config.audioConfig?.audioCodec !== '-'
          ? (v.config?.audioConfig?.audioCodec ?? null)
          : null,
      selectedAudioTracks:
        v.config?.shouldEnableAudioTrackSelection &&
        (v.config?.audioConfig?.volume ?? 100) !== 0
          ? (v.config?.selectedAudioTracks ?? null)
          : null,
    },
    dimensions:
      v.config?.shouldEnableCustomDimensions && v.config.customDimensions
        ? ([
            Math.round(v.config.customDimensions[0]),
            Math.round(v.config.customDimensions[1]),
          ] as [number, number])
        : null,

    speed:
      v.config?.shouldEnableCustomSpeed && v.config.customSpeed !== 1
        ? v.config.customSpeed
        : null,
    fps: v.config?.shouldEnableCustomFPS
      ? v.config.customFPS?.toString?.()
      : null,
    videoCodec:
      v.config?.shouldEnableCustomVideoCodec &&
      v.config?.customVideoCodec !== '-'
        ? v.config.customVideoCodec
        : null,
    transformHistory: v.config?.shouldTransformVideo
      ? ((v.config.transformVideoConfig?.transformHistory ??
          []) as MediaTransformHistory[])
      : null,
    chip: v.config?.chip ?? null,
    forceTarget: v.config?.forceTarget ?? null,
    targetVideoBitrateBps: v.config?.targetVideoBitrateBps ?? null,
    effort: v.config?.effort ?? null,
    stripMetadata: v.config?.shouldStripMetadata,
    metadataConfig:
      !v.config?.shouldStripMetadata && v.config?.metadataConfig
        ? Object.entries(
            v.config?.metadataConfig as MediaMetadataConfig,
          ).reduce(
            (a, [key, value]: [string, any]) => {
              a[key] = value?.length > 0 ? value : null
              return a
            },
            {} as Record<string, string>,
          )
        : null,
    customThumbnailPath:
      v.config?.shouldEnableCustomThumbnail &&
      v.config?.customThumbnailPath?.length
        ? v.config.customThumbnailPath
        : null,
    trimSegments:
      v.config?.shouldTrimVideo && Array.isArray(v.config?.trimConfig)
        ? (v.config.trimConfig
            .filter((a) => a.end >= a.start)
            .map(
              (action: TimelineAction): VideoTrimSegment => ({
                start: action.start,
                end: action.end,
              }),
            ) as VideoTrimSegment[])
        : null,
    subtitlesConfig:
      (v.config?.subtitlesConfig?.shouldEnableSubtitles &&
        v.config?.subtitlesConfig?.subtitles?.length > 0) ||
      v.config?.subtitlesConfig?.preserveExistingSubtitles === true
        ? {
            subtitles:
              v.config.subtitlesConfig?.subtitles?.map((s) => ({
                subtitlePath: s.subtitlePath ?? null,
                language: s.language || 'eng',
                fileName: s.fileName ?? null,
                title: s.title,
              })) ?? [],
            shouldEnableSubtitles:
              v.config.subtitlesConfig.shouldEnableSubtitles ?? false,
            preserveExistingSubtitles:
              v.config.subtitlesConfig.preserveExistingSubtitles,
          }
        : null,
  }
}

/** Image counterpart of `buildVideoCompressionConfig`. */
export function buildImageCompressionConfig(
  v: ImageMedia,
): ImageCompressionConfig {
  return {
    imageId: v.id!,
    convertToExtension: (v.config.convertToExtension === '-'
      ? v.extension
      : v.config.convertToExtension)!,
    imagePath: v.pathRaw!,
    isLossless: v.config.isLossless,
    quality: v.config.isLossless ? 100 : (v.config.quality ?? 100),
    stripMetadata: v.config.shouldStripMetadata,
    svgScaleFactor: v.config.svgScaleFactor ?? null,
    svgConfig: v.config?.shouldEnableAdvancedSvgSetting
      ? (v.config.svgConfig ?? null)
      : null,
    dimensions:
      v.config?.shouldEnableCustomDimensions && v.config.customDimensions
        ? ([v.config.customDimensions[0], v.config.customDimensions[1]] as [
            number,
            number,
          ])
        : null,
    transformHistory: v.config?.shouldTransformImage
      ? (v.config.transformImageConfig?.transformHistory as
          | MediaTransformHistory[]
          | null)
      : null,
  }
}
