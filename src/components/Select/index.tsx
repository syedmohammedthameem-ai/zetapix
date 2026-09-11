import {
  Select as NextUISelect,
  SelectItem as NextUISelectItem,
  type SelectItemProps as NextUISelectItemProps,
  type SelectProps as NextUISelectProps,
} from '@heroui/react'

interface SelectProps extends NextUISelectProps {}
function Select(props: SelectProps) {
  return (
    <NextUISelect radius="md" size="sm" labelPlacement="outside" {...props} />
  )
}

export type SelectItemProps = NextUISelectItemProps

/**
 * Re-exported rather than wrapped. React Aria builds its collection by reading
 * `getCollectionNode` off the child element's type, and a wrapper component
 * does not carry that static, so wrapping breaks every Select it is used in.
 */
export const SelectItem = NextUISelectItem

export default Select
