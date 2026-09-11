import {
  Image as NextUIImage,
  type ImageProps as NextUIImageProps,
} from '@heroui/react'
import React, { useEffect, useRef } from 'react'

interface ImageProps extends Omit<NextUIImageProps, 'src' | 'onError'> {
  src: string
  alt: string
  onError?: (evt: ErrorEvent) => void
}
function Image(props: ImageProps) {
  const { src, onLoadedData, onError, ...restProps } = props

  const imageSrcRef = useRef<string | null>(src)

  const [isFallbackImage, setIsFallbackImage] = React.useState(false)

  useEffect(() => {
    if (src !== imageSrcRef.current) {
      setIsFallbackImage(false)
      imageSrcRef.current = src
    }
  }, [src])

  return (
    <NextUIImage
      onLoadedData={(evt) => {
        onLoadedData?.(evt)
        setIsFallbackImage(false)
      }}
      // @ts-ignore
      onError={(evt: any) => {
        onError?.(evt)
        setIsFallbackImage(true)
      }}
      {...restProps}
      src={
        isFallbackImage
          ? (restProps?.fallbackSrc?.toString() ?? '/default-blurred.jpg')
          : src
      }
      {...(isFallbackImage
        ? {
            fallbackSrc: null,
          }
        : {})}
    />
  )
}

export default Image
