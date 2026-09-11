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
} from '@/types/compression'
import { formatBytes } from '@/utils/fs'
import {
  clearWatchLog,
  loadChips,
  startWatching,
  stopWatching,
  WatchItem,
  watchProxy,
} from '../-watch-state'

function reductionPct(sizeIn: number, sizeOut: number): number {
  if (!sizeIn || !sizeOut) return 0
  return (1 - sizeOut / sizeIn) * 100
}

function ratioOf(sizeIn: number, sizeOut: number): number {
  if (!sizeIn || !sizeOut) return 0
  return sizeIn / sizeOut
}

function statusLabel(item: WatchItem): string {
  switch (item.status) {
    case 'skipped':
      return item.message ?? 'Skipped'
    case 'failed':
      return item.message ?? 'Failed'
    default:
      return ''
  }
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
  }, [])

  const pickDirectory = useCallback(
    async (field: 'sourceDir' | 'outputDir', title: string) => {
      const selected = await open({ directory: true, multiple: false, title })
      if (typeof selected === 'string') {
        watchProxy[field] = selected
        watchProxy.error = null
      }
    },
    [],
  )

  const done = items.filter((item) => item.status === 'done').length
  const failed = items.filter((item) => item.status === 'failed').length
  const remaining = queue.length + (isProcessing ? 1 : 0)
  const activeItem = items.find((item) => item.status === 'compressing')
  const settled = items.length - (activeItem ? 1 : 0)
  const totalKnown = items.length + queue.length
  // The newest file whose ratio the source could not realistically deliver.
  const latestReason = items.find((item) => item.reason)?.reason
  const overallProgress =
    totalKnown > 0
      ? ((settled + (activeItem ? activeItem.progress / 100 : 0)) /
          totalKnown) *
        100
      : 0
  const canStart = sourceDir.length > 0 && outputDir.length > 0
  const hardware = chips.find((entry) => entry.id !== 'cpu')?.label ?? null
  const effortDetail = encodeEfforts.find(
    (entry) => entry.id === effort,
  )?.detail
  const targetReduction = (1 - 1 / effectiveRatio(ratio)) * 100

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          AICompress
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Point it at a folder, choose a compression ratio, press start.
          Resolution and frame rate are always preserved.
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div>
            <Select
              label="Compression ratio"
              aria-label="Compression ratio"
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
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              Targets {targetReduction.toFixed(0)}% smaller. This also sets
              quality: a higher ratio means a lower bitrate.
            </p>
          </div>

          <div>
            <Select
              label="Encode effort"
              aria-label="Encode effort"
              selectedKeys={[effort]}
              isDisabled={isWatching}
              onChange={(evt) => {
                const next = evt.target.value as EncodeEffort
                if (next) {
                  watchProxy.effort = next
                }
              }}
            >
              {encodeEfforts.map((entry) => (
                <SelectItem key={entry.id} textValue={entry.label}>
                  {entry.label}
                </SelectItem>
              ))}
            </Select>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
              {effort === 'fast' && hardware
                ? `Runs on ${hardware}. Output size is the same either way.`
                : effortDetail}
            </p>
          </div>

          <TextInput
            label="Filter"
            aria-label="Filter"
            placeholder="mp4, mov (empty = all)"
            value={filter}
            isDisabled={isWatching}
            onValueChange={(value) => {
              watchProxy.filter = value
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-5 mt-5">
          <Checkbox
            isSelected={autoCompress}
            isDisabled={isWatching}
            onValueChange={(value) => {
              watchProxy.autoCompress = value
            }}
          >
            <span className="text-xs">Automatic compression</span>
          </Checkbox>
          <Checkbox
            isSelected={includeSubfolders}
            isDisabled={isWatching}
            onValueChange={(value) => {
              watchProxy.includeSubfolders = value
            }}
          >
            <span className="text-xs">Include subfolders</span>
          </Checkbox>
        </div>

        {latestReason ? (
          <div className="mt-4 rounded-xl border border-warning-300 dark:border-warning-800 bg-warning-50 dark:bg-warning-950/40 px-4 py-3">
            <p className="text-xs text-warning-800 dark:text-warning-300 leading-5">
              {latestReason}
            </p>
            <p className="text-[11px] text-warning-700 dark:text-warning-400 mt-2">
              The ratio is applied regardless. Expect visible quality loss on
              this source.
            </p>
          </div>
        ) : null}

        <div className="flex items-center gap-2 mt-6">
          <Button
            color="primary"
            isDisabled={!canStart || isWatching}
            onPress={() => void startWatching()}
            startContent={<Icon name="play" size={14} />}
          >
            Start
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
          {items.length > 0 ? (
            <Button variant="light" onPress={clearWatchLog}>
              Clear
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-4 text-xs text-danger flex items-center gap-1">
            <Icon name="warning" size={13} />
            {error}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 mt-5 px-1">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isWatching
            ? `Watching. ${done} done, ${remaining} to go${
                failed > 0 ? `, ${failed} failed` : ''
              }.`
            : 'Idle.'}
        </p>
        {bytesIn > 0 ? (
          <>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {formatBytes(bytesIn - bytesOut)} saved,{' '}
              {reductionPct(bytesIn, bytesOut).toFixed(1)}% smaller
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatBytes(bytesIn)} in, {formatBytes(bytesOut)} out, overall{' '}
              {ratioOf(bytesIn, bytesOut).toFixed(2)}:1
            </p>
          </>
        ) : null}
      </div>

      {isProcessing || queue.length > 0 ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
              {activeItem
                ? `${activeItem.fileName} — ${activeItem.progress.toFixed(0)}%`
                : 'Preparing…'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {overallProgress.toFixed(0)}% of {totalKnown} file
              {totalKnown === 1 ? '' : 's'}
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

      <div className="mt-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-zinc-100 dark:bg-zinc-900 text-[11px] font-medium text-gray-600 dark:text-gray-400">
          <p className="col-span-4">File</p>
          <p className="col-span-4">Path</p>
          <p className="col-span-2 text-right">Size</p>
          <p className="col-span-2 text-right">Result</p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-xs text-gray-500 dark:text-gray-400">
              Nothing processed yet.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-3 px-4 py-2 border-t border-zinc-100 dark:border-zinc-900 text-xs"
              >
                <div className="col-span-4 min-w-0">
                  <p className="truncate text-gray-800 dark:text-gray-200">
                    {item.fileName}
                  </p>
                  {item.reason ? (
                    <p className="text-[11px] text-warning-600 dark:text-warning-400 truncate">
                      {item.reason}
                    </p>
                  ) : null}
                </div>
                <p className="col-span-4 truncate text-gray-500 dark:text-gray-400">
                  {item.outputPath ?? item.path}
                </p>
                <p className="col-span-2 text-right text-gray-500 dark:text-gray-400">
                  {item.sizeInBytes > 0 ? formatBytes(item.sizeInBytes) : '—'}
                </p>
                {item.status === 'compressing' ? (
                  <div className="col-span-2">
                    <p className="text-right text-gray-800 dark:text-gray-200">
                      {item.progress.toFixed(0)}%
                    </p>
                    <Progress
                      aria-label={`${item.fileName} progress`}
                      size="sm"
                      value={item.progress}
                      color="primary"
                      className="mt-1"
                    />
                  </div>
                ) : item.status === 'done' ? (
                  <p className="col-span-2 text-right text-gray-800 dark:text-gray-200">
                    {formatBytes(item.outputSizeInBytes ?? 0)}
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                      {reductionPct(
                        item.sizeInBytes,
                        item.outputSizeInBytes ?? 0,
                      ).toFixed(0)}
                      % smaller
                    </span>
                  </p>
                ) : (
                  <p
                    className={`col-span-2 text-right ${
                      item.status === 'failed'
                        ? 'text-danger'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {statusLabel(item)}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default Workstation
