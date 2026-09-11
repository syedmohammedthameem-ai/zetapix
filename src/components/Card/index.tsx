import {
  HTMLHeroUIProps,
  Card as NextUICard,
  CardBody as NextUICardBody,
  CardFooter as NextUICardFooter,
  type CardFooterProps as NextUICardFooterProps,
  type CardProps as NextUICardProps,
} from '@heroui/react'

interface CardProps extends NextUICardProps {}

function Card(props: CardProps) {
  return <NextUICard {...props} />
}

interface CardBodyProps extends HTMLHeroUIProps<'div'> {}

export function CardBody(props: CardBodyProps) {
  return <NextUICardBody {...props} />
}

interface CardFooterProps extends NextUICardFooterProps {}

export function CardFooter(props: CardFooterProps) {
  return <NextUICardFooter {...props} />
}

export default Card
