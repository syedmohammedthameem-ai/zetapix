/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare global {
  interface Window {
    __appVersion: string
    __envMode: string
    __serverUrl: string | null
  }

  declare const __appVersion: string
  declare const __envMode: string
  declare const __serverUrl: string
}

export {}
