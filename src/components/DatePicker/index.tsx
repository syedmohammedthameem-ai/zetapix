import {
  DatePicker as NextUIDatePicker,
  DatePickerProps as NextUIDatePickerProps,
} from '@heroui/react'

interface DatePickerProps extends NextUIDatePickerProps {}

function DatePicker(props: DatePickerProps) {
  return <NextUIDatePicker size="sm" labelPlacement="outside" {...props} />
}

export default DatePicker
