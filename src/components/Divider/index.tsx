import {
  Divider as NextUIDivider,
  type DividerProps as NextUIDividerProps,
} from '@heroui/react'

import { cn } from '@/utils/tailwind'

interface DividerProps extends NextUIDividerProps {}

function Divider(props: DividerProps) {
  return (
    <NextUIDivider
      {...props}
      className={cn([
        'bg-zinc-400/30 dark:bg-zinc-700/50',
        props?.className ?? '',
      ])}
    />
  )
}

export default Divider
