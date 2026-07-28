import * as path from 'node:path'
import * as Y from 'yjs'
import { LeveldbPersistence } from 'y-leveldb'
import {
  setPersistence,
  type Persistence,
  type WSSharedDoc
} from 'y-websocket/bin/utils'

import { log } from './log'

/**
 * y-websocket can read a `YPERSISTENCE` env var and build its own LevelDB layer,
 * but we install ours explicitly with `setPersistence` instead. That buys us three
 * things: typed access to the LevelDB handle, logging around load/flush, and a
 * real `writeState` that compacts the update log when a room empties out (the
 * built-in one is a no-op).
 *
 * Only ever create ONE LeveldbPersistence per directory in a process — LevelDB
 * takes an exclusive lock on its folder.
 */
/** Origin tag for updates we ourselves replayed out of LevelDB. */
const LEVELDB_ORIGIN = Symbol('leveldb')

export function attachLevelDbPersistence(dataDir: string): LeveldbPersistence {
  const location = path.resolve(dataDir)
  const ldb = new LeveldbPersistence(location)

  const persistence: Persistence = {
    provider: ldb,

    /**
     * Called by y-websocket the first time a room is opened (i.e. when the first
     * client connects and there is no in-memory doc yet).
     *
     * Ordering here is load-bearing. `getYDoc` invokes bindState WITHOUT awaiting
     * it, and `setupWSConnection` starts syncing the client on the very next line.
     * So the client can connect, sync, and write a note while we are still
     * awaiting the read from disk. If we subscribed to `update` after those
     * awaits — which is what y-websocket's own reference implementation does —
     * every edit landing inside that window would be applied to the in-memory doc
     * and silently never written to disk. So: subscribe synchronously first,
     * reconcile with disk second.
     *
     * The CRDT part that matters: we never "load a document" in the classic
     * sense. Disk state and live state are both just Yjs *updates*, and we merge
     * each into the other. Because updates are commutative and idempotent, doing
     * both directions is safe and order-independent — the result is the union of
     * the two states, not a last-write-wins overwrite.
     */
    bindState: async (docName: string, ydoc: WSSharedDoc) => {
      // Runs before the first await: no edit can slip through unrecorded.
      ydoc.on('update', (update: Uint8Array, origin: unknown) => {
        // Skip the echo from our own hydration below — already on disk.
        if (origin === LEVELDB_ORIGIN) return
        void ldb
          .storeUpdate(docName, update)
          .catch((err) => log.error(`failed to persist update for "${docName}"`, err))
      })

      const persistedYDoc = await ldb.getYDoc(docName)

      // Anything the live doc already knows that disk doesn't (i.e. edits that
      // arrived during the await above, plus anything a peer synced in early).
      const liveDiff = Y.encodeStateAsUpdate(ydoc, Y.encodeStateVector(persistedYDoc))
      if (liveDiff.length > 0) {
        await ldb.storeUpdate(docName, liveDiff)
      }

      // Anything disk knows that the live doc doesn't.
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYDoc), LEVELDB_ORIGIN)
      persistedYDoc.destroy()

      log.info(
        `room "${docName}" hydrated from disk (${Y.encodeStateAsUpdate(ydoc).byteLength} bytes of state)`
      )
    },

    /**
     * Called when the last connection to a room drops. Every update is already
     * durable by this point, so this is purely housekeeping: collapse the
     * append-only update log into a single snapshot so the next hydrate is fast
     * and the folder doesn't grow without bound.
     */
    writeState: async (docName: string) => {
      await ldb.flushDocument(docName)
      log.info(`room "${docName}" flushed and compacted`)
    }
  }

  setPersistence(persistence)
  log.info(`persisting boards to ${location}`)

  return ldb
}
