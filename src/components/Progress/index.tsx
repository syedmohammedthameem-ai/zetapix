import {
  CircularProgress as NextUICircularProgress,
  type CircularProgressProps as NextUICircularProgressProps,
  Progress as NextUIProgress,
  type ProgressProps as NextUIProgressProps,
} from '@heroui/react'

interface CircularProgressProps extends NextUICircularProgressProps {}

export function CircularProgress(props: CircularProgressProps) {
  return <NextUICircularProgress {...props} />
}

interface ProgressProps extends NextUIProgressProps {}

function Progress(props: ProgressProps) {
  return <NextUIProgress {...props} />
}

export default Progress
