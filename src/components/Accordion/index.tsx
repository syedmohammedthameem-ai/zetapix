import {
  Accordion as NextUIAccordion,
  type AccordionProps as NextUIAccordionProps,
} from '@heroui/react'

interface AccordionProps extends NextUIAccordionProps {}

function Accordion(props: AccordionProps) {
  return <NextUIAccordion {...props} />
}

export default Accordion
