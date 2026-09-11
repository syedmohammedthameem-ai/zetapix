import {
  Input as NextUITextInput,
  type InputProps as NextUITextInputProps,
} from '@heroui/react'

interface TextInputProps extends NextUITextInputProps {}

function TextInput(props: TextInputProps) {
  return (
    <NextUITextInput
      size="sm"
      labelPlacement="outside"
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      {...props}
    />
  )
}

export default TextInput
