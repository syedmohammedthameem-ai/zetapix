import { core } from '@tauri-apps/api'

export type ScannedFile = {
  path: string
  fileName: string
  extension: string
  sizeBytes: number
}

export type FolderScan = {
  files: ScannedFile[]
  totalBytes: number
}

/** Lists a folder's contents with sizes. Reads directory entries only. */
export function scanFolder(
  directory: string,
  includeSubfolders: boolean,
): Promise<FolderScan> {
  return core.invoke('scan_folder', { directory, includeSubfolders })
}
