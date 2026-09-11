import { useEffect } from 'react'
import { proxy, subscribe, useSnapshot } from 'valtio'

import * as constants from '@/constants'

export type PrimaryColorProxy = {
  color: string
  setColor: (newColor: string) => void
}

export const DEFAULT_PRIMARY_COLOR = '127 70 226' // rgb based

let persistedColor: string | null = localStorage.getItem(constants.primaryColor)

const primaryColorProxy: PrimaryColorProxy = proxy({
  color: persistedColor ?? DEFAULT_PRIMARY_COLOR,
  setColor(newColor) {
    primaryColorProxy.color = newColor
  },
})

function setPrimaryColorCSSVariables(color: string) {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.style.setProperty('--color-primary', color)
}

if (typeof document !== 'undefined') {
  setPrimaryColorCSSVariables(primaryColorProxy.color)
}

export function usePrimaryColor() {
  const snapshot = useSnapshot(primaryColorProxy)

  useEffect(() => {
    setPrimaryColorCSSVariables(snapshot.color)
  }, [snapshot.color])

  useEffect(() => {
    const unsubscribe = subscribe(primaryColorProxy, () => {
      localStorage.setItem(constants.primaryColor, primaryColorProxy.color)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  return snapshot
}
