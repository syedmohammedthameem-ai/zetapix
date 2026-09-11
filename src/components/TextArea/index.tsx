import {
  Textarea as NextUITextArea,
  type TextAreaProps as NextUITextAreaProps,
} from '@heroui/react'

interface TextAreaProps extends NextUITextAreaProps {}

function TextArea(props: TextAreaProps) {
  return (
    <NextUITextArea
      size="sm"
      labelPlacement="outside"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      isMultiline
      {...props}
    />
  )
}

export default TextArea
