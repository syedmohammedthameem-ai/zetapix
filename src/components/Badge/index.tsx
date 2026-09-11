import {
  Badge as NextUIBadge,
  type BadgeProps as NextUIBadgeProps,
} from '@heroui/react'

interface BadgeProps extends NextUIBadgeProps {}

function Badge(props: BadgeProps) {
  return <NextUIBadge {...props} />
}

export default Badge
