import { SelectItem } from '@heroui/react'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect } from 'react'
import { useSnapshot } from 'valtio'

import Button from '@/components/Button'
import Checkbox from '@/components/Checkbox'
import Icon from '@/components/Icon'
import Progress from '@/components/Progress'
import Select from '@/components/Select'
import TextInput from '@/components/TextInput'
import { showItemInFileManager } from '@/tauri/commands/fs'
import {
  compressionRatios,
  EncodeEffort,
  effectiveRatio,
  encodeEfforts,
  reductionFromRatio,
} from '@/types/compression'
import { formatBytes } from '@/utils/fs'
import { cn } from '@/utils/tailwind'
import {
  clearWatchLog,
  loadChips,
  refreshPreview,
  startWatching,
  stopWatching,
  WatchItem,
  watchProxy,
} from '../-watch-state'

/**
 * The reductions people actually ask for, and the ratio each one means. Both
 * describe the same target; the percentage leads because operators think in
 * terabytes saved rather than in ratios.
 */
const reductionPresets = [
  { percent: 50, ratio: 2 },
  { percent: 75, ratio: 4 },
  { percent: 90, ratio: 10 },
  { percent: 95, ratio: 20 },
] as const

function savingPercent(sizeIn: number, sizeOut: number): number {
  if (!sizeIn || !sizeOut) return 0
  return (1 - sizeOut / sizeIn) * 100
}

function statusLabel(item: WatchItem): string {
  if (item.status === 'skipped') return item.message ?? 'Skipped'
  if (item.status === 'failed') return item.message ?? 'Failed'
  return ''
}

function Workstation() {
  const {
    sourceDir,
    outputDir,
    ratio,
    effort,
    chips,
    includeSubfolders,
    filter,
    autoCompress,
    preview,
    isWatching,
    isProcessing,
    error,
    queue,
    items,
    bytesIn,
    bytesOut,
  } = useSnapshot(watchProxy)

  useEffect(() => {
    void loadChips()
    void refreshPreview()
  }, [])

  const pickDirectory = useCallback(
    async (field: 'sourceDir' | 'outputDir', title: string) => {
      const selected = await open({ directory: true, multiple: false, title })
      if (typeof selected === 'string') {
        watchProxy[field] = selected
        watchProxy.error = null
        if (field === 'sourceDir') void refreshPreview()
      }
    },
    [],
  )

  const done = items.filter((item) => item.status === 'done').length
  const failed = items.filter((item) => item.status === 'failed').length
  const activeItem = items.find((item) => item.status === 'compressing')
  const settled = items.length - (activeItem ? 1 : 0)
  const totalKnown = items.length + queue.length
  const overallProgress =
    totalKnown > 0
      ? ((settled + (activeItem ? activeItem.progress / 100 : 0)) /
          totalKnown) *
        100
      : 0

  const hardware = chips.find((entry) => entry.id !== 'cpu')?.label ?? null
  const canStart = sourceDir.length > 0 && outputDir.length > 0
  const latestReason = items.find((item) => item.reason)?.reason

  const appliedRatio = effectiveRatio(ratio)
  const targetReduction = reductionFromRatio(appliedRatio)
  const projectedBytes = preview.totalBytes / appliedRatio
  const projectedSaving = preview.totalBytes - projectedBytes

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          AICompress
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Resolution, frame rate and colour are always preserved.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
        <div className="flex items-end gap-2 mb-3">
          <TextInput
            label="Source folder"
            aria-label="Source folder"
            placeholder="Files here are compressed"
            value={sourceDir}
            isDisabled={isWatching}
            onValueChange={(value) => {
              watchProxy.sourceDir = value
            }}
            onBlur={() => void refreshPreview()}
          />
          <Button
            className="flex-shrink-0"
            isDisabled={isWatching}
            onPress={() =>
              pickDirectory('sourceDir', 'Select the source folder')
            }
          >
            Browse
          </Button>
        </div>

        <div className="flex items-end gap-2">
          <TextInput
            label="Output folder"
            aria-label="Output folder"
            placeholder="Compressed files are written here"
            value={outputDir}
            isDisabled={isWatching}
            onValueChange={(value) => {
              watchProxy.outputDir = value
            }}
          />
          <Button
            className="flex-shrink-0"
            isDisabled={isWatching}
            onPress={() =>
              pickDirectory('outputDir', 'Select the output folder')
            }
          >
            Browse
          </Button>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
        {preview.isScanning ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Reading the source folder…
          </p>
        ) : preview.fileCount === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {sourceDir
              ? 'No media files there yet. Anything dropped in will be picked up once watching starts.'
              : 'Choose a source folder to see what will happen.'}
          </p>
        ) : (
          <>
            <p className="text-[11px] text-primary font-medium">
              {preview.fileCount} file{preview.fileCount === 1 ? '' : 's'} ·{' '}
              {formatBytes(preview.totalBytes)}
              {preview.skippedCount > 0
                ? ` · ${preview.skippedCount} not media`
                : ''}
            </p>
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
              {targetReduction.toFixed(0)}% smaller
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
              {formatBytes(preview.totalBytes)} → about{' '}
              {formatBytes(projectedBytes)} · saves{' '}
              {formatBytes(projectedSaving)}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {appliedRatio.toFixed(1)}:1 · a target, not a promise
            </p>
            <Progress
              aria-label="Projected reduction"
              size="sm"
              value={targetReduction}
              color="primary"
              className="mt-3"
            />
          </>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-5">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          How much smaller
        </p>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {reductionPresets.map((preset) => (
            <Button
              key={preset.percent}
              size="sm"
              color={ratio === preset.ratio ? 'primary' : 'default'}
              isDisabled={isWatching}
              onPress={() => {
                watchProxy.ratio = preset.ratio
              }}
            >
              {preset.percent}%
            </Button>
          ))}
          <Select
            aria-label="Exact ratio"
            className="w-36"
            selectedKeys={[String(ratio)]}
            isDisabled={isWatching}
            onChange={(evt) => {
              const next = Number(evt.target.value)
              if (Number.isFinite(next) && next > 0) {
                watchProxy.ratio = next
              }
            }}
          >
            {compressionRatios.map((value) => (
              <SelectItem key={String(value)} textValue={`${value}:1`}>
                {value}:1
              </SelectItem>
            ))}
          </Select>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Effort · same file size either way
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {encodeEfforts.map((entry) => (
            <Button
              key={entry.id}
              size="sm"
              color={effort === entry.id ? 'primary' : 'default'}
              isDisabled={isWatching}
              onPress={() => {
                watchProxy.effort = entry.id as EncodeEffort
              }}
            >
              {entry.label}
              {entry.id === 'fast' && hardware ? ` · ${hardware}` : ''}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-5 mt-5">
          <Checkbox
            isSelected={autoCompress}
            isDisabled={isWatching}
            onValueChange={(value) => {
              watchProxy.autoCompress = value
            }}
          >
            <span className="text-xs">Keep watching for new files</span>
          </Checkbox>
          <Checkbox
            isSelected={includeSubfolders}
            isDisabled={isWatching}
            onValueChange={(value) => {
              watchProxy.includeSubfolders = value
              void refreshPreview()
            }}
          >
            <span className="text-xs">Include subfolders</span>
          </Checkbox>
          <TextInput
            aria-label="Filter"
            size="sm"
            className="w-48"
            placeholder="Filter: mp4, mov"
            value={filter}
            isDisabled={isWatching}
            onValueChange={(value) => {
              watchProxy.filter = value
            }}
          />
        </div>

        {latestReason ? (
          <p className="mt-4 text-xs text-warning-600 dark:text-warning-400 flex items-start gap-1.5">
            <Icon name="warning" size={13} className="mt-0.5 flex-shrink-0" />
            <span>{latestReason}</span>
          </p>
        ) : null}

        {error ? (
          <p className="mt-3 text-xs text-danger flex items-center gap-1">
            <Icon name="warning" size={13} />
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2 mt-5">
          <Button
            color="primary"
            isDisabled={!canStart || isWatching}
            onPress={() => void startWatching()}
            startContent={<Icon name="play" size={14} />}
          >
            {preview.fileCount > 0
              ? `Compress ${preview.fileCount} file${preview.fileCount === 1 ? '' : 's'}`
              : 'Start'}
          </Button>
          <Button
            color="danger"
            isDisabled={!isWatching}
            onPress={() => void stopWatching()}
            startContent={<Icon name="pause" size={14} />}
          >
            Stop
          </Button>
          <Button
            isDisabled={outputDir.length === 0}
            onPress={() => void showItemInFileManager(outputDir)}
          >
            Open output folder
          </Button>
        </div>
      </div>

      {isProcessing || queue.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {activeItem
                ? `${activeItem.fileName} — ${activeItem.progress.toFixed(0)}%`
                : 'Preparing…'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {done} of {totalKnown} done
              {failed > 0 ? `, ${failed} failed` : ''}
            </p>
          </div>
          <Progress
            aria-label="Overall progress"
            size="sm"
            value={overallProgress}
            color="primary"
          />
        </div>
      ) : null}

      {bytesIn > 0 ? (
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <p className="text-2xl font-semibold text-success">
              {formatBytes(bytesIn - bytesOut)}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-1">
              Saved
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {savingPercent(bytesIn, bytesOut).toFixed(0)}%
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-1">
              Smaller
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 px-4 py-3">
            <p className="text-2xl font-semibold text-primary">{done}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-1">
              Files done
            </p>
          </div>
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-zinc-100 dark:bg-zinc-900">
            <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
              Processed
            </p>
            <Button size="sm" variant="light" onPress={clearWatchLog}>
              Clear
            </Button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const saved = savingPercent(
                item.sizeInBytes,
                item.outputSizeInBytes ?? 0,
              )

              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-4 py-2.5 border-t border-zinc-100 dark:border-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate text-gray-800 dark:text-gray-200">
                      {item.fileName}
                    </p>
                    {item.status === 'done' ? (
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {formatBytes(item.sizeInBytes)} →{' '}
                        {formatBytes(item.outputSizeInBytes ?? 0)}
                      </p>
                    ) : null}
                  </div>

                  {item.status === 'done' ? (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-24 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{ width: `${Math.max(saved, 0)}%` }}
                        />
                      </div>
                      <p className="text-xs text-success w-10 text-right">
                        {saved.toFixed(0)}%
                      </p>
                    </div>
                  ) : item.status === 'compressing' ? (
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="w-24">
                        <Progress
                          aria-label={`${item.fileName} progress`}
                          size="sm"
                          value={item.progress}
                          color="primary"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                        {item.progress.toFixed(0)}%
                      </p>
                    </div>
                  ) : (
                    <p
                      className={cn([
                        'text-xs flex-shrink-0',
                        item.status === 'failed'
                          ? 'text-danger'
                          : 'text-gray-500 dark:text-gray-400',
                      ])}
                    >
                      {statusLabel(item)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default Workstation
