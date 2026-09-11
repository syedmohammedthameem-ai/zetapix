import { AudioConfig, MediaMetadataConfig, SubtitlesConfig } from './app'
import { FileMetadata } from './fs'

export const extensions = {
  video: {
    mp4: 'mp4',
    mov: 'mov',
    mkv: 'mkv',
    webm: 'webm',
    avi: 'avi',
    gif: 'gif',
  },
  image: {
    png: 'png',
    jpg: 'jpg',
    jpeg: 'jpeg',
    webp: 'webp',
    gif: 'gif',
    svg: 'svg',
  },
} as const

export type VideoExtension = keyof typeof extensions.video
export type ImageExtension = keyof typeof extensions.image

/**
 * Container formats accepted as video input. FFmpeg demuxes all of them, so
 * intake is deliberately wider than `extensions.video`, which lists only the
 * containers AICompress can write. `gif` is absent on purpose: it arrives
 * through the image path.
 */
export const videoInputExtensions = [
  '3g2',
  '3gp',
  'asf',
  'avi',
  'divx',
  'dv',
  'f4v',
  'flv',
  'm2t',
  'm2ts',
  'm2v',
  'm4v',
  'mjpeg',
  'mkv',
  'mod',
  'mov',
  'mp4',
  'mpe',
  'mpeg',
  'mpg',
  'mts',
  'mxf',
  'ogm',
  'ogv',
  'qt',
  'rm',
  'rmvb',
  'swf',
  'tod',
  'ts',
  'vob',
  'webm',
  'wmv',
  'y4m',
  'yuv',
] as const

export type VideoInputExtension = (typeof videoInputExtensions)[number]

/**
 * Compression ratio and space saving are one fact stated two ways:
 *   R = sizeIn / sizeOut,  S = 1 - 1/R,  R = 1 / (1 - S)
 * The encoder takes a whole-percent reduction, so a ratio chosen here is
 * converted, and anything above roughly 25:1 lands on a coarse step.
 */
export const compressionRatios = [
  2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 75, 100,
] as const

export const minCompressionRatio = 2
export const maxCompressionRatio = 100

export function reductionFromRatio(ratio: number): number {
  const clamped = Math.min(
    Math.max(ratio, minCompressionRatio),
    maxCompressionRatio,
  )
  return (1 - 1 / clamped) * 100
}

export function ratioFromReduction(reductionPct: number): number {
  const fraction = Math.min(Math.max(reductionPct, 0), 99) / 100
  return 1 / (1 - fraction)
}

/** The whole-percent reduction the encoder is actually given for a ratio. */
export function encoderReductionForRatio(ratio: number): number {
  return Math.round(reductionFromRatio(ratio))
}

/** The ratio that whole-percent reduction really represents. */
export function effectiveRatio(ratio: number): number {
  return ratioFromReduction(encoderReductionForRatio(ratio))
}

/**
 * Image quality implied by a ratio. Images have no bitrate to target, so the
 * same reduction is expressed on the encoder's 1-100 quality scale instead.
 */
export function imageQualityForRatio(ratio: number): number {
  const quality = Math.round(100 - reductionFromRatio(ratio))
  return Math.min(Math.max(quality, 10), 95)
}

/**
 * Where an encode runs and how hard it works. The ratio still fixes the output
 * size in every case; only the time taken and the picture at that size change.
 */
export const encodeEfforts = [
  {
    id: 'fast',
    label: 'Fast',
    detail: 'Hardware encoder. Around a minute for a 4K clip.',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    detail: 'CPU, medium preset. Roughly 2 VMAF better than Fast.',
  },
  {
    id: 'best',
    label: 'Best',
    detail: 'CPU, slow preset, two-pass. About 4.6 VMAF better, far slower.',
  },
] as const

export type EncodeEffort = (typeof encodeEfforts)[number]['id']

export type FeasibilityReport = {
  sourceCodec: string
  sourceBitrateBps: number
  sourceBpp: number
  width: number
  height: number
  fps: number
  isIntraOnly: boolean
  requestedRatio: number
  targetVideoBitrateBps: number
  targetBpp: number
  density: 'ok' | 'marginal' | 'aggressive'
  headroom: 'high' | 'medium' | 'low'
  plausibleMinRatio: number
  plausibleMaxRatio: number
  isPlausible: boolean
  reason: string | null
}

export type Chip = {
  id: string
  label: string
  encoderH264: string | null
  encoderHevc: string | null
}

/** Container written when the source container cannot be written back. */
export const defaultVideoOutputExtension: VideoExtension = 'mp4'

const videoInputExtensionSet: ReadonlySet<string> = new Set(
  videoInputExtensions,
)
const videoOutputExtensionSet: ReadonlySet<string> = new Set(
  Object.keys(extensions.video),
)
const imageExtensionSet: ReadonlySet<string> = new Set(
  Object.keys(extensions.image),
)

/** Lower-cases an extension and drops a leading dot. */
export function normalizeExtension(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/^\./, '')
}

export function isVideoInputExtension(value?: string | null): boolean {
  return videoInputExtensionSet.has(normalizeExtension(value))
}

export function isImageInputExtension(value?: string | null): boolean {
  return imageExtensionSet.has(normalizeExtension(value))
}

export function isSupportedMediaExtension(value?: string | null): boolean {
  return isVideoInputExtension(value) || isImageInputExtension(value)
}

/**
 * Maps a source container to the container the output is written to. Sources
 * AICompress can write back keep their container; every other accepted source
 * is remuxed into MP4.
 */
export function resolveVideoOutputExtension(
  value?: string | null,
): VideoExtension {
  const extension = normalizeExtension(value)
  return videoOutputExtensionSet.has(extension)
    ? (extension as VideoExtension)
    : defaultVideoOutputExtension
}

export const compressionPresets = {
  ironclad: 'ironclad',
  thunderbolt: 'thunderbolt',
} as const

export type VideoCompressionResult = {
  videoId: string
  fileName: string
  filePath: string
  fileMetadata: FileMetadata
}

export enum CustomEvents {
  VideoCompressionProgress = 'VideoCompressionProgress',
  CancelInProgressCompression = 'CancelInProgressCompression',
  BatchVideoCompressionProgress = 'BatchVideoCompressionProgress',
  BatchVideoIndividualCompressionCompletion = 'BatchVideoIndividualCompressionCompletion',
  ImageCompressionProgress = 'ImageCompressionProgress',
  BatchImageCompressionProgress = 'BatchImageCompressionProgress',
  BatchImageIndividualCompressionCompletion = 'BatchImageIndividualCompressionCompletion',
  BatchMediaCompressionProgress = 'BatchMediaCompressionProgress',
  BatchMediaIndividualCompressionCompletion = 'BatchMediaIndividualCompressionCompletion',
  WatchFilesDiscovered = 'WatchFilesDiscovered',
  WatchFailed = 'WatchFailed',
}

export type WatchDiscovery = {
  paths: string[]
}

export type WatchFailure = {
  message: string
}

export type VideoCompressionProgress = {
  videoId: string
  batchId: string
  currentDuration: string
}
export type BatchVideoIndividualCompressionResult = {
  batchId: string
  result: VideoCompressionResult
}

export type VideoThumbnail = {
  id: string
  fileName: string
  filePath: string
}

export type VideoInfo = {
  duration: number
  dimensions: [number, number]
  fps: number
}

export type VideoStream = {
  codec: string
  codecLongName: string
  profile: string
  codecType: string

  width: number
  height: number
  codedWidth: number
  codedHeight: number

  rFrameRate: string
  avgFrameRate: string

  pixFmt: string
  colorSpace: string | null
  colorRange: string | null
  colorPrimaries: string | null
  colorTransfer: string | null
  chromaLocation: string | null

  bitRate: string | null
  duration: string | null

  nbFrames: string | null
  refs: number | null

  gopSize: number | null
  level: number | null

  fieldOrder: string
  timeBase: string
  rotation: number | null
}

export type AudioStream = {
  codec: string
  codecLongName: string
  codecType: string
  profile: string | null

  channels: string
  channelLayout: string

  sampleRate: string
  sampleFmt: string | null
  bitsPerSample: number | null

  bitRate: string | null
  duration: string | null

  tags: readonly (readonly [string, string])[] | null
}

export type SubtitleStream = {
  index: number
  codec: string
  codecLongName: string
  codecType: string
  language: string | null
  title: string | null
  disposition: {
    default: boolean
    forced: boolean
    attachedPic: boolean
    comment: boolean
    karaoke: boolean
    lyrics: boolean
  }
}

export type Chapter = {
  id: number
  timeBase: string
  start: number
  end: number
  title: string | null
}

export type ContainerInfo = {
  filename: string
  formatName: string
  formatLongName: string
  duration: number | null
  size: number
  bitRate: number | null
  nbStreams: number
  tags: [string, string][] | null
}

export type MediaTransforms = {
  crop: { top: number; left: number; width: number; height: number }
  rotate: number
  flip: { horizontal: boolean; vertical: boolean }
}

export type MediaTransformHistory =
  | {
      type: 'crop'
      value: { top: number; left: number; width: number; height: number }
    }
  | { type: 'rotate'; value: number }
  | { type: 'flip'; value: { horizontal: boolean; vertical: boolean } }

export type BatchCompressionResult = {
  results: Record<string, VideoCompressionResult>
}

export type BatchVideoCompressionProgress = {
  batchId: string
  currentIndex: number
  totalCount: number
  videoProgress: VideoCompressionProgress
}

export type VideoFileMetadata = {
  id: string
  fileName: string
  path: string
  size: number
  thumbnailPath?: string
  duration?: string
  dimensions?: [number, number]
  fps?: number
}

export type VideoTrimSegment = {
  start: number
  end: number
}

export type AudioChannelConfig = {
  channelLayout: 'mono' | 'stereo' | null
  monoSource?: { left: boolean; right: boolean }
  stereoSwapChannels?: boolean
}

export type VideoCompressionConfig = {
  videoPath: string
  convertToExtension: string
  presetName?: string | null
  videoId: string
  batchId?: string | null
  audioConfig: AudioConfig
  quality: number
  targetReduction?: number | null
  dimensions?: [number, number] | null
  fps?: string | null
  videoCodec?: string | null
  transformHistory?: MediaTransformHistory[] | null
  stripMetadata?: boolean
  metadataConfig?: MediaMetadataConfig | null
  customThumbnailPath?: string | null
  trimSegments?: VideoTrimSegment[] | null
  subtitlesConfig?: SubtitlesConfig | null
  speed?: number | null
  chip?: string | null
  forceTarget?: boolean | null
  targetVideoBitrateBps?: number | null
  effort?: string | null
}

export type ImageCompressionProgress = {
  imageId: string
  batchId: string
  progress: number
}

export type ImageCompressionResult = {
  imageId: string
  fileName: string
  filePath: string
  fileMetadata?: FileMetadata
}

export type SvgConfig = {
  filterSpeckle?: number | null
  colorPrecision?: number | null
  layerDifference?: number | null
  cornerThreshold?: number | null
  lengthThreshold?: number | null
  spliceThreshold?: number | null
  isBw?: boolean | null
}

export type ImageCompressionConfig = {
  imageId: string
  imagePath: string
  convertToExtension: string
  isLossless: boolean
  quality: number
  stripMetadata: boolean
  svgScaleFactor: number | null
  svgConfig?: SvgConfig | null
  dimensions?: [number, number] | null
  transformHistory?: MediaTransformHistory[] | null
}

export type MediaItem = {
  videoConfig?: VideoCompressionConfig
  imageConfig?: ImageCompressionConfig
}

export type MediaCompressionProgress =
  | ({ mediaType: 'video' } & VideoCompressionProgress)
  | ({ mediaType: 'image' } & ImageCompressionProgress)

export type MediaCompressionResult =
  | ({ mediaType: 'video' } & VideoCompressionResult)
  | ({ mediaType: 'image' } & ImageCompressionResult)

export type BatchMediaCompressionProgress = {
  batchId: string
  currentIndex: number
  totalCount: number
  mediaProgress: MediaCompressionProgress
}

export type BatchMediaIndividualCompressionResult = {
  batchId: string
  result: MediaCompressionResult
}

export type MediaBatchCompressionResult = {
  results: Record<string, MediaCompressionResult>
}

export type ImageBasicInfo = {
  filename: string
  format: string
  formatLongName: string
  mimeType: string
  size: number
}

export type ImageDimensions = {
  width: number
  height: number
  aspectRatio: string
  orientation: number | null
  dpi: [number, number] | null
  megapixels: number
}

export type ImageColorInfo = {
  colorType: string
  bitDepth: number
  hasAlpha: boolean
  colorSpace: string | null
  pixelFormat: string
}

export type ExifTag = {
  key: string
  value: string
  category: string
}

export type ExifInfo = {
  tags: ExifTag[]
  make: string | null
  model: string | null
  software: string | null
  dateTimeOriginal: string | null
  dateTimeDigitized: string | null
  copyright: string | null
  artist: string | null
  gpsCoordinates: [number, number] | null
  lensModel: string | null
  iso: number | null
  exposureTime: string | null
  fNumber: string | null
  focalLength: string | null
  flash: string | null
}
