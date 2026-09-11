import {
  Slider as NextUISlider,
  type SliderProps as NextUISliderProps,
} from '@heroui/react'

interface SliderProps extends NextUISliderProps {}

function Slider(props: SliderProps) {
  return <NextUISlider size="lg" {...props} />
}

export default Slider
