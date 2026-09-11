import {
  ScrollShadow as NextUIScrollShadow,
  type ScrollShadowProps as NextUIScrollShadowProps,
} from '@heroui/react'

interface ScrollShadowProps extends NextUIScrollShadowProps {}

function ScrollShadow(props: ScrollShadowProps) {
  return <NextUIScrollShadow {...props} />
}

export default ScrollShadow
