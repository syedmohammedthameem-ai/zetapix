import {
  ReactCompareSlider,
  type ReactCompareSliderProps,
} from 'react-compare-slider'

type CompareSliderProps = {
  style?: React.CSSProperties
} & ReactCompareSliderProps

function CompareSlider({ ...props }: CompareSliderProps) {
  return <ReactCompareSlider {...props} />
}

export default CompareSlider
