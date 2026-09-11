import {
  Popover as NextUIPopover,
  PopoverContent as NextUIPopoverContent,
  type PopoverProps as NextUIPopoverProps,
  PopoverTrigger as NextUIPopoverTrigger,
} from '@heroui/react'

interface PopoverProps extends NextUIPopoverProps {}

function Popover(props: PopoverProps) {
  return <NextUIPopover {...props} />
}

export function PopoverContent(
  props: React.ComponentProps<typeof NextUIPopoverContent>,
) {
  return <NextUIPopoverContent {...props} />
}

export function PopoverTrigger(
  props: React.ComponentProps<typeof NextUIPopoverTrigger>,
) {
  return <NextUIPopoverTrigger {...props} />
}

export default Popover
