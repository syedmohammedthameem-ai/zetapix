import { PhotoProvider } from 'react-photo-view'
import 'react-photo-view/dist/react-photo-view.css'

type ImageViewerProps = {
  children: React.ReactNode
  providerProps?: React.ComponentProps<typeof PhotoProvider>
}

function ImageViewer({ providerProps, children }: ImageViewerProps) {
  return <PhotoProvider {...(providerProps ?? {})}>{children}</PhotoProvider>
}

export default ImageViewer
