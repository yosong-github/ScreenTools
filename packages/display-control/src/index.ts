import type { DisplaySummary } from '@screentools/contracts'

export interface DisplayControlService {
  listDisplays(): Promise<DisplaySummary[]>
}

export class EmptyDisplayControlService implements DisplayControlService {
  async listDisplays(): Promise<DisplaySummary[]> {
    return []
  }
}
