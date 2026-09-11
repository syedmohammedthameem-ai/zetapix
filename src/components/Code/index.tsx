import {
  Code as NextUICode,
  type CodeProps as NextUICodeProps,
} from '@heroui/react'

interface CodeProps extends NextUICodeProps {}

function Code(props: CodeProps) {
  return <NextUICode {...props} />
}

export default Code
