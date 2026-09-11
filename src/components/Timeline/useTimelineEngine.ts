import { TimelineState } from '@xzdarcy/react-timeline-editor'
import React, { useCallback, useEffect } from 'react'

type UseEngineProps = {
  timelineState: React.RefObject<TimelineState>
  totalDuration: number
  onPlay?: () => void
  onPause?: () => void
  onSeek?: (time: number) => void
  onTimeChange?: (time: number) => void
  onEnd?: () => void
}

export type TimelineScales = {
  scale: number
  scaleWidth: number
  startLeft: number
}

function useTimelineEngine({
  timelineState,
  totalDuration,
  onPause,
  onPlay,
  onEnd,
  onSeek,
  onTimeChange,
}: UseEngineProps) {
  const disableAnimationTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: <>
  useEffect(() => {
    if (!timelineState.current) return
    const engine = timelineState.current
    engine.listener.on('play', () => onPlay?.())
    engine.listener.on('paused', () => onPause?.())
    engine.listener.on('ended', () => onEnd?.())
    engine.listener.on('afterSetTime', ({ time }) => {
      onSeek?.(time)
      onTimeChange?.(time)
    })
    engine.listener.on('beforeSetTime', () => {
      timelineState.current?.pause()
    })
    engine.listener.on('setTimeByTick', ({ time }) => {
      onTimeChange?.(time)
    })

    return () => {
      if (!engine) return
      engine.pause()
      engine.listener.offAll()
    }
  }, [timelineState.current])

  const autoScrollCursorToCurrentTime = useCallback(
    (
      scales: TimelineScales,
      options: { onlyOnOutOfView?: boolean; smoothScrolling?: boolean } = {
        onlyOnOutOfView: true,
        smoothScrolling: false,
      },
    ) => {
      if (!timelineState.current) return

      function manageSmoothScrolling() {
        if (options.smoothScrolling) {
          const target = timelineState.current?.target
          if (!target) return
          target.classList.add('enable-smooth-scrolling')
          if (disableAnimationTimeoutRef.current) {
            clearTimeout(disableAnimationTimeoutRef.current)
          }
          disableAnimationTimeoutRef.current = setTimeout(() => {
            target.classList.remove('enable-smooth-scrolling')
          }, 250)
        }
      }

      const target = timelineState.current.target
      if (!target) return

      const currentTime = timelineState.current.getTime()

      const { width: timelineWidth, x: timelineX } =
        timelineState.current.target.getBoundingClientRect()
      if (options.onlyOnOutOfView) {
        const { x: cursorX } = timelineState.current.target
          .querySelector(':scope > .timeline-editor-cursor')
          ?.getBoundingClientRect() || { x: 0 }

        const isCursorOutOfView =
          timelineWidth - (cursorX - timelineX) < 0 ||
          timelineWidth - (cursorX - timelineX) > timelineWidth

        if (isCursorOutOfView) {
          const left =
            currentTime * (scales.scaleWidth / scales.scale) + scales.startLeft
          manageSmoothScrolling()
          timelineState.current.setScrollLeft(left)
        }
      } else {
        const left =
          currentTime * (scales.scaleWidth / scales.scale) +
          scales.startLeft -
          timelineWidth / 2
        manageSmoothScrolling()
        timelineState.current.setScrollLeft(left)
      }
    },
    [timelineState.current],
  )

  const playOrPause = useCallback(() => {
    if (!timelineState.current) return
    if (timelineState.current.isPlaying) {
      timelineState.current.pause()
    } else {
      if (timelineState.current.getTime() === totalDuration) {
        timelineState.current.setTime(0)
        timelineState.current.setScrollLeft(0)
      }
      timelineState.current.play({ autoEnd: false, toTime: totalDuration })
    }
  }, [timelineState.current, totalDuration])

  const restart = useCallback(() => {
    if (!timelineState.current) return
    timelineState.current.setTime(0)
  }, [timelineState.current])

  const seekRightBy = useCallback(
    (time: number) => {
      if (!time || !timelineState.current) return
      const next = timelineState.current.getTime() + time
      timelineState.current.setTime(next > totalDuration ? totalDuration : next)
    },
    [timelineState.current, totalDuration],
  )

  const seekLeftBy = useCallback(
    (time: number) => {
      if (!time || !timelineState.current) return
      const next = timelineState.current.getTime() - time
      timelineState.current.setTime(next < 0 ? 0 : next)
    },
    [timelineState.current],
  )

  const setTime = useCallback(
    (time: number) => {
      if (!timelineState.current) return
      timelineState.current.setTime(time)
    },
    [timelineState.current],
  )

  const refreshTimeline = useCallback(() => {
    if (!timelineState.current) return
    timelineState.current.reRender()
  }, [timelineState.current])

  return {
    playOrPause,
    restart,
    seekLeftBy,
    seekRightBy,
    setTime,
    autoScrollCursorToCurrentTime,
    refreshTimeline,
  }
}

export default useTimelineEngine
