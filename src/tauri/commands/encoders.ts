import { core } from '@tauri-apps/api'

import { Chip } from '@/types/compression'

export function getAvailableChips(): Promise<Chip[]> {
  return core.invoke('get_available_chips')
}
