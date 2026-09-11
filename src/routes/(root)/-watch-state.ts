import { event } from '@tauri-apps/api'
import { emitTo } from '@tauri-apps/api/event'
import clamp from 'lodash/clamp'
import cloneDeep from 'lodash/cloneDeep'
import { proxy } from 'valtio'

import { getAvailableChips } from '@/tauri/commands/encoders'
import { estimateCompression } from '@/tauri/commands/feasibility'
import { getVideoBasicInfo } from '@/tauri/commands/ffprobe'
import { getFileMetadata, moveFile } from '@/tauri/commands/fs'
import { compressMediaBatch } from '@/tauri/commands/media'
import { startDirectoryWatch, stopDirectoryWatch } from '@/tauri/commands/watch'
import {
  BatchMediaCompressionProgress,
  Chip,
  CustomEvents,
  EncodeEffort,
  FeasibilityReport,
  imageQualityForRatio,
  isImageInputExtension,
  isSupportedMediaExtension,
  normalizeExtension,
  resolveVideoOutputExtension,
  WatchDiscovery,
  WatchFailure,
} from '@/types/compression'
import { convertDurationToMilliseconds } from '@/utils/string'
import {
  buildImageCompressionConfig,
  buildVideoCompressionConfig,
  ImageMedia,
  VideoMedia,
} from './-compression-config'
import { imageConfigInitialState, videoConfigInitialState } from './-state'

export type WatchItemStatus = 'compressing' | 'done' | 'failed' | 'skipped'

export type WatchItem = {
  id: string
  path: string
  fileName: string
  status: WatchItemStatus
  /** 0-100 while encoding. */
  progress: number
  sizeInBytes: number
  /** Why the requested ratio was not realistic for this source, if it wasn't. */
  reason?: string
  outputSizeInBytes?: number
  outputPath?: string
  message?: string
}

export type WatchState = {
  sourceDir: string
  outputDir: string
  /** Target compression ratio, e.g. 26 for 26:1. The only quality control. */
  ratio: number
  /** Where the encode runs and how hard it works. Size is unaffected. */
  effort: EncodeEffort
  /** Hardware the machine has, used only to label what Fast will use. */
  chips: Chip[]
  includeSubfolders: boolean
  /** Comma-separated extensions. Empty means every supported format. */
  filter: string
  /** When off, Start makes one pass and stops instead of staying armed. */
  autoCompress: boolean
  isWatching: boolean
  isProcessing: boolean
  error: string | null
  queue: string[]
  items: WatchItem[]
  bytesIn: number
  bytesOut: number
}

const watchInitialState: WatchState = {
  sourceDir: '',
  outputDir: '',
  ratio: 10,
  effort: 'fast',
  chips: [],
  includeSubfolders: false,
  filter: '',
  autoCompress: true,
  isWatching: false,
  isProcessing: false,
  error: null,
  queue: [],
  items: [],
  bytesIn: 0,
  bytesOut: 0,
}

/** How long a one-shot run waits for new arrivals before standing down. */
const SETTLE_MS = 5000

export const watchProxy = proxy<WatchState>(cloneDeep(watchInitialState))

let unlistenDiscovery: event.UnlistenFn | undefined
let unlistenFailure: event.UnlistenFn | undefined
let sequence = 0
let sawFirstBatch = false
let lastDiscoveryAt = 0
/** The job the encoder is on right now, so Stop can actually stop it. */
let activeCompressionId: string | null = null

/**
 * Records what hardware this machine has. Nothing selects a chip any more, but
 * the Fast setting names the one it will use.
 */
export async function loadChips(): Promise<void> {
  try {
    watchProxy.chips = await getAvailableChips()
  } catch (error) {
    watchProxy.error = messageFrom(error)
  }
}

/** Hardware the Fast setting will run on, or null when there is none. */
export function hardwareLabel(): string | null {
  return watchProxy.chips.find((chip) => chip.id !== 'cpu')?.label ?? null
}

/**
 * Arms the watcher. Files already in the source folder are picked up on the
 * first pass, and anything landing there afterwards is queued as it appears.
 */
export async function startWatching(): Promise<void> {
  if (watchProxy.isWatching) return

  const { sourceDir, outputDir, includeSubfolders } = watchProxy
  if (!sourceDir || !outputDir) {
    watchProxy.error = 'Choose a source and an output folder first.'
    return
  }

  watchProxy.error = null
  sawFirstBatch = false

  unlistenDiscovery = await event.listen<WatchDiscovery>(
    CustomEvents.WatchFilesDiscovered,
    (evt) => {
      sawFirstBatch = true
      lastDiscoveryAt = Date.now()
      for (const path of evt.payload.paths) {
        if (!watchProxy.queue.includes(path)) {
          watchProxy.queue.push(path)
        }
      }
      void drainQueue()
    },
  )

  unlistenFailure = await event.listen<WatchFailure>(
    CustomEvents.WatchFailed,
    (evt) => {
      watchProxy.error = evt.payload.message
      void stopWatching()
    },
  )

  try {
    await startDirectoryWatch(sourceDir, outputDir, includeSubfolders)
    watchProxy.isWatching = true
  } catch (error) {
    await releaseListeners()
    watchProxy.error = messageFrom(error)
  }
}

/**
 * Disarms the watcher and drops anything still queued. A file already being
 * encoded finishes, because cancelling mid-encode leaves a partial output.
 */
export async function stopWatching(): Promise<void> {
  watchProxy.isWatching = false
  watchProxy.queue.splice(0, watchProxy.queue.length)

  // Disarming the watcher is not enough on its own: without this the current
  // encode keeps running invisibly until the app is closed.
  if (activeCompressionId) {
    try {
      await emitTo('main', CustomEvents.CancelInProgressCompression, {
        ids: [activeCompressionId],
      })
    } catch {
      // The encoder may have finished between the check and the emit.
    }
  }

  await releaseListeners()
  try {
    await stopDirectoryWatch()
  } catch (error) {
    watchProxy.error = messageFrom(error)
  }
}

/** Clears the processed log and the running totals. */
export function clearWatchLog(): void {
  watchProxy.items.splice(0, watchProxy.items.length)
  watchProxy.bytesIn = 0
  watchProxy.bytesOut = 0
  watchProxy.error = null
}

async function releaseListeners(): Promise<void> {
  unlistenDiscovery?.()
  unlistenFailure?.()
  unlistenDiscovery = undefined
  unlistenFailure = undefined
}

async function drainQueue(): Promise<void> {
  if (watchProxy.isProcessing) return

  watchProxy.isProcessing = true
  try {
    while (watchProxy.isWatching && watchProxy.queue.length > 0) {
      const path = watchProxy.queue.shift()
      if (!path) break
      await processFile(path)
    }
  } finally {
    watchProxy.isProcessing = false
  }

  if (!watchProxy.autoCompress && sawFirstBatch && watchProxy.isWatching) {
    // A folder settles over several polls, because each file has to hold a
    // steady size before it is announced. Standing down the moment the first
    // batch drains would miss anything that was still being written, so a
    // one-shot run waits for the folder to go quiet first.
    const quietFor = Date.now() - lastDiscoveryAt
    if (quietFor < SETTLE_MS) {
      await new Promise((resolve) => setTimeout(resolve, SETTLE_MS - quietFor))
    }

    if (watchProxy.queue.length > 0) {
      void drainQueue()
      return
    }

    if (watchProxy.isWatching) {
      await stopWatching()
    }
  }
}

/** True when the filter box allows this extension. Empty means allow all. */
function passesFilter(extension: string): boolean {
  const filter = watchProxy.filter.trim()
  if (!filter) return true

  return filter
    .split(',')
    .map((entry) => normalizeExtension(entry.replace('*', '')))
    .filter((entry) => entry.length > 0)
    .includes(extension)
}

async function processFile(path: string): Promise<void> {
  sequence += 1
  const id = `watch-${sequence}-${+new Date()}`
  const fileName = path.split(/[/\\]/).pop() ?? path

  watchProxy.items.unshift({
    id,
    path,
    fileName,
    status: 'compressing',
    progress: 0,
    sizeInBytes: 0,
  })

  try {
    const metadata = await getFileMetadata(path)
    const extension =
      normalizeExtension(metadata?.extension) ||
      normalizeExtension(path.split('.').pop())

    if (!isSupportedMediaExtension(extension)) {
      patchItem(id, { status: 'skipped', message: 'Not a media file' })
      return
    }

    if (!passesFilter(extension)) {
      patchItem(id, { status: 'skipped', message: 'Filtered out' })
      return
    }

    patchItem(id, { sizeInBytes: metadata.size })

    const isImage = isImageInputExtension(extension)
    const outputExtension = isImage
      ? extension
      : resolveVideoOutputExtension(extension)

    let targetVideoBitrateBps: number | null = null
    if (!isImage) {
      const report = await estimateOf(path, watchProxy.ratio)
      if (report) {
        // This is what actually shrinks the file. The ratio is applied as
        // written; whether it flatters the source is what the reason says.
        targetVideoBitrateBps = report.targetVideoBitrateBps
        if (!report.isPlausible && report.reason) {
          patchItem(id, { reason: report.reason })
        }
      }
    }

    const media = isImage
      ? {
          imageConfig: buildImageCompressionConfig(
            imageMediaFor(id, path, fileName, extension),
          ),
        }
      : {
          videoConfig: buildVideoCompressionConfig(
            videoMediaFor(id, path, fileName, extension, targetVideoBitrateBps),
          ),
        }

    // A video reports how far into the timeline it has encoded, so the total
    // duration is what turns that into a percentage.
    const durationSeconds = isImage ? 0 : await durationOf(path)
    const unlistenProgress = await followProgress(id, isImage, durationSeconds)

    let results: Awaited<ReturnType<typeof compressMediaBatch>>['results']
    activeCompressionId = id
    try {
      ;({ results } = await compressMediaBatch(id, [media]))
    } finally {
      activeCompressionId = null
      unlistenProgress()
    }
    const outputPath = results?.[id]?.fileMetadata?.path
    if (!outputPath) {
      throw new Error('The encoder produced no output.')
    }

    const destination = await freeDestination(
      watchProxy.outputDir,
      baseName(fileName),
      outputExtension,
    )
    await moveFile(outputPath, destination)
    const written = await getFileMetadata(destination)

    patchItem(id, {
      status: 'done',
      progress: 100,
      outputPath: destination,
      outputSizeInBytes: written.size,
    })
    watchProxy.bytesIn += metadata.size
    watchProxy.bytesOut += written.size
  } catch (error) {
    patchItem(id, { status: 'failed', message: messageFrom(error) })
  }
}

/**
 * Judges the ratio against this file. Advisory only: a probe failure must not
 * stop the job, so it resolves to null instead of throwing.
 */
async function estimateOf(
  path: string,
  ratio: number,
): Promise<FeasibilityReport | null> {
  try {
    return await estimateCompression(path, ratio)
  } catch {
    return null
  }
}

/** Total duration in seconds, or 0 when it cannot be read. */
async function durationOf(path: string): Promise<number> {
  try {
    const info = await getVideoBasicInfo(path)
    return info?.duration ?? 0
  } catch {
    return 0
  }
}

/**
 * Mirrors the encoder's progress onto the item. Videos report a timestamp on
 * the timeline, images report a percentage outright.
 */
async function followProgress(
  id: string,
  isImage: boolean,
  durationSeconds: number,
): Promise<event.UnlistenFn> {
  return event.listen<BatchMediaCompressionProgress>(
    CustomEvents.BatchMediaCompressionProgress,
    (evt) => {
      const payload = evt?.payload
      if (payload?.batchId !== id) return

      if (isImage && payload.mediaProgress.mediaType === 'image') {
        patchItem(id, {
          progress: clamp(payload.mediaProgress.progress, 0, 100),
        })
        return
      }

      if (payload.mediaProgress.mediaType === 'video' && durationSeconds > 0) {
        const elapsed = convertDurationToMilliseconds(
          payload.mediaProgress.currentDuration,
        )
        if (elapsed > 0) {
          patchItem(id, {
            progress: clamp(elapsed / 10 / durationSeconds, 0, 100),
          })
        }
      }
    },
  )
}

function patchItem(id: string, patch: Partial<WatchItem>): void {
  const target = watchProxy.items.find((item) => item.id === id)
  if (target) {
    Object.assign(target, patch)
  }
}

function videoMediaFor(
  id: string,
  path: string,
  fileName: string,
  extension: string,
  targetVideoBitrateBps: number | null,
): VideoMedia {
  const config = cloneDeep(videoConfigInitialState)
  config.effort = watchProxy.effort
  config.targetVideoBitrateBps = targetVideoBitrateBps

  // The old percentage path exists for other callers and would re-introduce
  // the safeguard that used to cancel the target, so it stays off here.
  config.shouldEnableTargetReduction = false
  config.targetReduction = null

  return {
    type: 'video',
    id,
    pathRaw: path,
    path,
    fileName,
    extension,
    config,
  }
}

function imageMediaFor(
  id: string,
  path: string,
  fileName: string,
  extension: string,
): ImageMedia {
  const config = cloneDeep(imageConfigInitialState)
  config.quality = imageQualityForRatio(watchProxy.ratio)

  return {
    type: 'image',
    id,
    pathRaw: path,
    path,
    fileName,
    extension,
    config,
  }
}

/**
 * Finds a name that is not taken in the output folder, so a second run over the
 * same source never silently overwrites an earlier result. There is no exists
 * command, and `getFileMetadata` rejects for a missing path, which asks the
 * same question a different way.
 */
async function freeDestination(
  directory: string,
  base: string,
  extension: string,
): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt}`
    const candidate = joinPath(directory, `${base}${suffix}.${extension}`)
    try {
      await getFileMetadata(candidate)
    } catch {
      return candidate
    }
  }
  throw new Error(`Too many files named ${base} in the output folder.`)
}

/**
 * Joins a directory and a file name using whichever separator the directory
 * already uses. Windows accepts a forward slash, but a path that reads
 * `C:\\Media\\Out/clip.mp4` looks broken to anyone reading the results table.
 */
function joinPath(directory: string, name: string): string {
  const trimmed = directory.replace(/[/\\]+$/, '')
  const separator =
    trimmed.includes('\\') && !trimmed.includes('/') ? '\\' : '/'
  return `${trimmed}${separator}${name}`
}

function baseName(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot > 0 ? fileName.slice(0, dot) : fileName
}

function messageFrom(error: unknown): string {
  if (error instanceof Error) return error.message
  return typeof error === 'string' ? error : 'Compression failed.'
}
