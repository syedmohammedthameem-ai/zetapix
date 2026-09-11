import { core } from '@tauri-apps/api'

export function startDirectoryWatch(
  sourceDir: string,
  outputDir: string,
  includeSubfolders: boolean,
) {
  return core.invoke<void>('start_directory_watch', {
    sourceDir,
    outputDir,
    includeSubfolders,
  })
}

export function stopDirectoryWatch() {
  return core.invoke<void>('stop_directory_watch')
}
