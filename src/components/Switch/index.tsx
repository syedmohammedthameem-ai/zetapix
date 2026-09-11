import {
  Switch as NextUISwitch,
  type SwitchProps as NextUISwitchProps,
} from '@heroui/react'

interface SwitchProps extends NextUISwitchProps {}

function Switch(props: SwitchProps) {
  return <NextUISwitch size="sm" {...props} />
}

export default Switch
