# Trailboard

A real-time collaborative sticky-note whiteboard. Every note, drag, keystroke, and
cursor is shared live between everyone on the same board URL, and boards survive a
server restart.

Built on [Yjs](https://github.com/yjs/yjs) CRDTs over a custom WebSocket server,
with LevelDB persistence.

For the full design rationale — the sync protocol message by message, why the
schema is nested the way it is, and the known limits — see
[docs/architecture.md](docs/architecture.md).

## Quick start

Two processes, two terminals.

```bash
# terminal 1 — sync server on :1234
cd server
npm install
npm run dev

# terminal 2 — Vite dev server on :5173
cd client
npm install
npm run dev
```

Open <http://localhost:5173>. You'll be redirected to a freshly minted board id.
Share that URL — or just open it in a second tab — to collaborate.

To check the server on its own, without the client:

```bash
cd server
npm run smoke:write   # realtime fanout + room isolation, leaves state on disk
# restart the server
npm run smoke:read    # confirms the state came back out of LevelDB
```

## Layout

```
server/   Node + TypeScript WebSocket sync server (ws, y-websocket, y-leveldb)
client/   Vite + React + TypeScript board UI (yjs, y-websocket, y-protocols)
```

Each folder is an independent npm package with its own lockfile.

## How sync works

**A board is a Yjs document, and the WebSocket path is its name.** Connecting to
`ws://localhost:1234/abc123` joins room `abc123`. The server validates the id
before the HTTP upgrade completes, so a malformed path never creates a document.

**Rejoining is a delta exchange, not a download.** The server sends its *state
vector* — a summary of which updates from which peers it has already seen — and
the client replies with only what's missing, in both directions. A reconnecting
client therefore transfers just the edits it missed. A first-time visitor still
receives the whole board, but that's the current compacted state rather than the
full edit history, since Yjs garbage collects the content of deleted items.

**The server never merges anything.** It relays updates to the other sockets in
the room. Conflict resolution happens identically and independently inside every
peer's CRDT, which is why a client can go offline, keep editing, reconnect, and
converge with no server-side reconciliation.

**Conflict granularity is a schema decision.** The root `notes` map holds one
nested `Y.Map` per note rather than a plain object, so `x`/`y` and `color` are
independent keys — drag a note while someone else recolours it and both edits
survive. Note bodies go one level finer as `Y.Text`, which merges per character,
so two people typing in the same note interleave instead of clobbering.

**Cursors deliberately live outside the CRDT.** Presence rides the `y-protocols`
Awareness protocol over the same socket: ephemeral, per-client, never persisted,
and dropped automatically on disconnect. A CRDT keeps history so it can merge,
which is exactly wrong for a pointer position.

**Persistence is append-then-compact.** Every update is streamed to LevelDB as it
arrives; when the last client leaves a room, the update log is flushed into a
single snapshot. The `update` subscription is registered synchronously before any
`await`, because `y-websocket` starts syncing clients before the hydrate finishes
and edits landing in that window would otherwise never reach disk.

## Configuration

| Variable | Where | Default | Purpose |
| --- | --- | --- | --- |
| `PORT` | server | `1234` | WebSocket / HTTP port |
| `HOST` | server | `0.0.0.0` | Bind address |
| `DATA_DIR` | server | `./data` | LevelDB location |
| `VITE_WS_URL` | client | `ws://localhost:1234` | Sync server to connect to |

`GET /health` on the server reports uptime plus live rooms with their connection
and awareness counts.

## Notable implementation details

- **Render granularity matches mutation granularity.** `useNoteIds` subscribes to
  the root map with `observe` (fires only on add/remove) while `useNote`
  subscribes to a single note's own map, so dragging re-renders one component
  rather than the board. Presence is split the same way: the avatar stack ignores
  cursor movement entirely.
- **Writes are coalesced to one per animation frame.** Pointer events outpace the
  display, and each write is a CRDT update plus a WebSocket frame.
- **Cursors are broadcast in board coordinates**, not viewport coordinates, so
  they land in the right place regardless of anyone's window size or scroll.
- **Note tilt is hashed from the note id** (FNV-1a, mapped to ±3°) — stable across
  renders and identical for every collaborator, without storing the angle.
- **The cursor trail fades in CSS, not React.** Dots are rationed by both distance
  and elapsed time, and each fades independently from birth, so the 0.6→0.1 ramp
  emerges from their ages rather than being recomputed every frame.
- **`prefers-reduced-motion` is honoured in JS as well as CSS**: trail dots are
  never created at all, and easing is removed.

## Dependency notes

Pinned to the Yjs **v13** line. `y-leveldb` supports only v13, while the newer
`@y/websocket-server` package requires the v14 prerelease — mixing them breaks at
runtime. So the coherent set is `yjs@13` + `y-websocket@1.5` (which still ships the
`bin/utils.js` `setupWSConnection` server utilities) + `y-protocols@1` +
`y-leveldb@0.2`, all stable releases.

Both packages carry an npm `override` pinning `y-leveldb` to 0.2, because
`y-websocket@1.5` declares an old 0.1 that drags in the deprecated native
`leveldown` build. See the `comments` field in each `package.json`.

`y-websocket/bin/utils.js` ships as untyped CommonJS, so
`server/src/types/y-websocket-server.d.ts` declares exactly the surface we use and
the server stays fully typed with no `any`.
