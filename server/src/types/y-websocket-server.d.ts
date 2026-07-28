/**
 * Ambient types for the two untyped CommonJS modules we depend on.
 *
 * `y-websocket/bin/utils.js` is shipped as plain JS with JSDoc annotations and no
 * `.d.ts`, and `y-leveldb` ships no types at all. Rather than sprinkling `any`
 * through the server, we describe the exact surface we use in one place.
 */

declare module 'y-websocket/bin/utils' {
  import type { Doc } from 'yjs'
  import type { Awareness } from 'y-protocols/awareness'
  import type { WebSocket } from 'ws'
  import type { IncomingMessage } from 'node:http'

  /**
   * The Y.Doc subclass y-websocket keeps in memory for each room. It owns the
   * set of live connections and the server-side Awareness instance.
   */
  export interface WSSharedDoc extends Doc {
    name: string
    conns: Map<WebSocket, Set<number>>
    awareness: Awareness
  }

  export interface Persistence {
    bindState: (docName: string, ydoc: WSSharedDoc) => void | Promise<void>
    writeState: (docName: string, ydoc: WSSharedDoc) => Promise<unknown>
    provider: unknown
  }

  export function setPersistence(persistence: Persistence | null): void
  export function getPersistence(): Persistence | null

  /** Live rooms, keyed by document name. */
  export const docs: Map<string, WSSharedDoc>

  export function getYDoc(docName: string, gc?: boolean): WSSharedDoc

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    opts?: { docName?: string; gc?: boolean }
  ): void
}

declare module 'y-leveldb' {
  import type { Doc } from 'yjs'

  export class LeveldbPersistence {
    constructor(location: string, opts?: { level?: unknown; levelOptions?: unknown })
    getYDoc(docName: string): Promise<Doc>
    storeUpdate(docName: string, update: Uint8Array): Promise<unknown>
    getStateVector(docName: string): Promise<Uint8Array>
    getDiff(docName: string, stateVector: Uint8Array): Promise<Uint8Array>
    clearDocument(docName: string): Promise<void>
    /** Merges the stored update log for a doc into a single snapshot. */
    flushDocument(docName: string): Promise<unknown>
    getAllDocNames(): Promise<string[]>
    destroy(): Promise<void>
  }
}
