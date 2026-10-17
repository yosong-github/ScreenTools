import type { DisplaySnapshot } from '@screentools/contracts'

export interface DisplayControlService {
  getSnapshot(): Promise<DisplaySnapshot>
  subscribe(listener: () => void): () => void
  dispose(): void
}
