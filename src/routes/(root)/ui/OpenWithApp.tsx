import { event } from '@tauri-apps/api'
import { useEffect } from 'react'

type OpenWithAppProps = {
  onFiles: (files: string[]) => void
}

// Listen for the `Open with AICompress` event triggered by file explorers.
function OpenWithApp({ onFiles }: OpenWithAppProps) {
  useEffect(() => {
    const unlistenPromise = event.listen<string[]>('open-with-app', (evt) => {
      const filePaths = evt.payload
      if (filePaths && filePaths.length > 0) {
        onFiles(filePaths)
      }
    })

    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [onFiles])

  return null
}

export default OpenWithApp
