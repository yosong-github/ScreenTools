import type { DisplayControlService } from '@screentools/display-control'
import { createDisplayService } from '../services/display-service'

export function createScreenToolsCore(displays: DisplayControlService = createDisplayService()) {
  return {
    getDisplaySnapshot: () => displays.getSnapshot(),
    subscribe: (listener: () => void) => displays.subscribe(listener),
    dispose: () => displays.dispose(),
  }
}

export type ScreenToolsCore = ReturnType<typeof createScreenToolsCore>
