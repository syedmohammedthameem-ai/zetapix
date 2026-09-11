import { Variants } from 'framer-motion'

export const zoomIn: Variants = {
  enter: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
}

export const topToBottom: Variants = {
  enter: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    y: -20,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
}

export const bottomToTop: Variants = {
  enter: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    y: 20,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
}

const variants = { zoomIn, topToBottom, bottomToTop }

export default variants
