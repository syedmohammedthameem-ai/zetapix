import {
  Autocomplete as NextUIAutocomplete,
  AutocompleteItem as NextUIAutocompleteItem,
  type AutocompleteItemProps as NextUIAutocompleteItemProps,
  type AutocompleteProps as NextUIAutocompleteProps,
} from '@heroui/react'

interface AutocompleteProps extends NextUIAutocompleteProps {}
function Autocomplete(props: AutocompleteProps) {
  return (
    <NextUIAutocomplete
      radius="md"
      size="sm"
      labelPlacement="outside"
      {...props}
    />
  )
}

interface AutocompleteItemProps extends NextUIAutocompleteItemProps {}
export function AutocompleteItem(props: AutocompleteItemProps) {
  return <NextUIAutocompleteItem {...props} />
}

export default Autocomplete
