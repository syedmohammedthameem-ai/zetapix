import { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine'
import { FC } from 'react'

import { formatDuration } from '@/utils/string'

export const BoundaryRowActionRender: FC<{
  action: TimelineAction
  row: TimelineRow
}> = ({ action }) => {
  return (
    <div className="flex justify-center items-center bg-primary h-[2px] mt-3 rounded-lg">
      <p className="text-[11px] text-center text-zinc-800 dark:text-zinc-300 bg-zinc-200 dark:bg-zinc-800 rounded-lg px-2">{`${(
        action.end - action.start
      ).toFixed(2)}s`}</p>
    </div>
  )
}

export const ScaleRender: FC<{
  scale: number
}> = ({ scale }) => {
  const formatted = formatDuration(scale, { disableMilliseconds: true })
  return (
    <span className="text-[11px] text-zinc-700 dark:text-zinc-400">
      {formatted}
    </span>
  )
}
