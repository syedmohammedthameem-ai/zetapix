import { useCallback, useEffect, useRef } from 'react'
import { proxy, useSnapshot } from 'valtio'
import { subscribeKey } from 'valtio/utils'

type UseSyncStateOptions<T> = {
  globalValue: T | undefined
  setGlobalValue: (value: T) => void
  defaultValue: T
  debounceMs?: number
}

/**
 * Custom hook for bidirectional sync between local and global state.
 *
 * Local state updates immediately (for responsive UI). Syncing to global state
 * can be immediate or debounced based on `debounceMs`:
 * - `debounceMs = 0` (default): Immediate sync
 * - `debounceMs > 0`: Debounced sync (useful for sliders, batch compression)
 *
 * Global state changes sync back to local state immediately, but changes initiated
 * by this hook won't trigger a re-sync (to avoid loops).
 *
 * @param options - Configuration options
 * @returns [localValue, setLocalValue] tuple similar to useState
 */
export function useSyncState<T>({
  globalValue,
  setGlobalValue,
  defaultValue,
  debounceMs = 0,
}: UseSyncStateOptions<T>) {
  const stateProxy = useRef(
    proxy<{ state: T }>({ state: globalValue ?? defaultValue }),
  )
  const { state: localValue } = useSnapshot(stateProxy.current)

  const isUpdatingRef = useRef<boolean>(false)
  const debounceTimerRef = useRef<NodeJS.Timeout>()
  const setGlobalValueRef = useRef(setGlobalValue)

  useEffect(() => {
    setGlobalValueRef.current = setGlobalValue
  }, [setGlobalValue])

  useEffect(() => {
    if (!isUpdatingRef.current && globalValue !== undefined) {
      stateProxy.current.state = globalValue
    }
  }, [globalValue])

  useEffect(() => {
    let unsubscribe: () => void
    if (stateProxy.current) {
      unsubscribe = subscribeKey(
        stateProxy.current,
        'state',
        (newLocalValue) => {
          if (debounceMs === 0) {
            isUpdatingRef.current = true
            setGlobalValueRef.current(newLocalValue)
            setTimeout(() => {
              isUpdatingRef.current = false
            }, 0)
          } else {
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current)
            }
            debounceTimerRef.current = setTimeout(() => {
              isUpdatingRef.current = true
              setGlobalValueRef.current(newLocalValue)
              setTimeout(() => {
                isUpdatingRef.current = false
              }, 0)
            }, debounceMs)
          }
        },
      )
    }
    return () => {
      unsubscribe?.()
      clearTimeout(debounceTimerRef.current)
    }
  }, [debounceMs])

  const setLocalValue = useCallback((value: T | ((prev: T) => T)) => {
    if (stateProxy.current) {
      if (typeof value === 'function') {
        const prev = stateProxy.current.state
        const newVal = (value as (prev: T) => T)(prev)
        stateProxy.current.state = newVal
        return stateProxy.current.state
      }

      stateProxy.current.state = value
      return stateProxy.current.state
    }
    return null
  }, [])

  return [localValue, setLocalValue] as const
}
