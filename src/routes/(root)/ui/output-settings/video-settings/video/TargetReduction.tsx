import { AnimatePresence, motion } from 'framer-motion'
import { useCallback } from 'react'
import { useSnapshot } from 'valtio'

import Slider from '@/components/Slider'
import Switch from '@/components/Switch'
import { useSyncState } from '@/hooks/useSyncState'
import { slideDownTransition } from '@/utils/animation'
import { appProxy, normalizeBatchMediaConfig } from '../../../../-state'

const DEFAULT_TARGET_REDUCTION = 99

type TargetReductionProps = {
  mediaIndex: number
}

function TargetReduction({ mediaIndex }: TargetReductionProps) {
  const {
    state: {
      isCompressing,
      isProcessCompleted,
      media,
      commonConfigForBatchCompression,
      isLoadingMediaFiles,
    },
  } = useSnapshot(appProxy)
  const video =
    media.length > 0 && mediaIndex >= 0 && media[mediaIndex].type === 'video'
      ? media[mediaIndex]
      : null
  const { config, extension } = video ?? {}
  const {
    shouldEnableTargetReduction,
    targetReduction,
    shouldDisableCompression,
    convertToExtension,
  } = config ?? commonConfigForBatchCompression.videoConfig ?? {}

  const handleSwitchToggle = useCallback(() => {
    if (mediaIndex >= 0 && appProxy.state.media[mediaIndex].type === 'video') {
      const targetConfig = appProxy.state.media[mediaIndex].config
      targetConfig.shouldEnableTargetReduction =
        !targetConfig.shouldEnableTargetReduction
      targetConfig.targetReduction ??= DEFAULT_TARGET_REDUCTION
      appProxy.state.media[mediaIndex].isConfigDirty = true
    } else if (appProxy.state.media.length > 1) {
      const targetConfig =
        appProxy.state.commonConfigForBatchCompression.videoConfig
      targetConfig.shouldEnableTargetReduction =
        !targetConfig.shouldEnableTargetReduction
      targetConfig.targetReduction ??= DEFAULT_TARGET_REDUCTION
      normalizeBatchMediaConfig()
    }
  }, [mediaIndex])

  const setTargetReductionGlobal = useCallback(
    (value: number) => {
      if (
        mediaIndex >= 0 &&
        appProxy.state.media[mediaIndex].type === 'video'
      ) {
        appProxy.state.media[mediaIndex].config.targetReduction = value
        appProxy.state.media[mediaIndex].isConfigDirty = true
      } else if (appProxy.state.media.length > 1) {
        appProxy.state.commonConfigForBatchCompression.videoConfig.targetReduction =
          value
        normalizeBatchMediaConfig()
      }
    },
    [mediaIndex],
  )

  const [target, setTarget] = useSyncState<number>({
    globalValue: targetReduction ?? undefined,
    setGlobalValue: setTargetReductionGlobal,
    defaultValue: DEFAULT_TARGET_REDUCTION,
    debounceMs: 500,
  })

  const isGifTarget =
    convertToExtension === 'gif' ||
    (convertToExtension === '-' && extension === 'gif')
  const shouldDisableInput =
    media.length === 0 ||
    isCompressing ||
    isProcessCompleted ||
    isLoadingMediaFiles ||
    shouldDisableCompression ||
    isGifTarget

  return (
    <div>
      <Switch
        isSelected={shouldEnableTargetReduction}
        onValueChange={handleSwitchToggle}
        isDisabled={shouldDisableInput}
      >
        <p className="text-gray-600 dark:text-gray-400 text-sm mr-2 w-full">
          Best-case reduction target
        </p>
      </Switch>
      <AnimatePresence mode="wait">
        {shouldEnableTargetReduction ? (
          <motion.div {...slideDownTransition} className="mt-4">
            <Slider
              label="Target size reduction"
              aria-label="Target size reduction"
              minValue={50}
              maxValue={99}
              step={1}
              value={target}
              renderValue={() => (
                <p className="text-primary text-xs">Up to {target}%</p>
              )}
              onChange={(value) => {
                if (typeof value === 'number') {
                  setTarget(value)
                }
              }}
              isDisabled={shouldDisableInput}
              classNames={{
                label: 'text-xs',
                value: 'text-xs',
              }}
            />
            <p className="mt-3 text-[11px] leading-4 text-gray-500 dark:text-gray-400">
              AICompress uses an efficient codec and protects the selected
              visual quality. The actual reduction may be lower than this
              best-case target.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default TargetReduction
