/// <reference types="vite/client" />

import type { ScreenToolsApi } from '@screentools/contracts'

declare global {
  interface Window {
    readonly screenTools: Readonly<ScreenToolsApi>
  }
}

export {}
