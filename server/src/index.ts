import * as http from 'node:http'
import { WebSocketServer, type WebSocket } from 'ws'
import { setupWSConnection, docs } from 'y-websocket/bin/utils'

import { attachLevelDbPersistence } from './persistence'
import { parseBoardId, listRooms } from './rooms'
import { log } from './log'

const PORT = Number(process.env.PORT ?? 1234)
const HOST = process.env.HOST ?? '0.0.0.0'
const DATA_DIR = process.env.DATA_DIR ?? './data'

// Must run before the first connection: y-websocket calls persistence.bindState
// lazily, the first time each room's document is created.
const ldb = attachLevelDbPersistence(DATA_DIR)

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    const body = JSON.stringify(
      { status: 'ok', uptime: process.uptime(), rooms: listRooms() },
      null,
      2
    )
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(body)
    return
  }

  res.writeHead(200, { 'content-type': 'text/plain' })
  res.end('trailboard sync server\n')
})

/**
 * `noServer: true` means ws does not attach its own HTTP listener. We handle the
 * `upgrade` event ourselves so we can validate the board id and reject bad
 * handshakes before any Yjs document gets created.
 */
const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (conn: WebSocket, req: http.IncomingMessage, boardId: string) => {
  const isNewRoom = !docs.has(boardId)

  /**
   * This is the whole sync engine in one call. setupWSConnection:
   *   1. looks up (or creates) the WSSharedDoc for `docName` — our board id;
   *   2. runs persistence.bindState on a brand new room, hydrating it from LevelDB;
   *   3. sends sync step 1 (this peer's state vector) to the client, which replies
   *      with step 2 (only the updates the server is missing) — a two-round-trip
   *      delta handshake rather than shipping the whole document;
   *   4. relays every later update and awareness message to the other connections
   *      in the same room;
   *   5. tears down the client's awareness state on disconnect, and keeps the
   *      socket honest with a 30s ping/pong.
   */
  setupWSConnection(conn, req, { docName: boardId })

  const room = docs.get(boardId)
  log.info(
    `client joined "${boardId}"${isNewRoom ? ' (new room)' : ''} — ` +
      `${room?.conns.size ?? 0} connection(s) in room, ${docs.size} room(s) live`
  )

  conn.on('close', () => {
    log.info(
      `client left "${boardId}" — ${docs.get(boardId)?.conns.size ?? 0} connection(s) remaining`
    )
  })
})

server.on('upgrade', (req, socket, head) => {
  const boardId = parseBoardId(req.url)

  if (boardId === null) {
    log.warn(`rejected upgrade for invalid board path: ${req.url}`)
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
    socket.destroy()
    return
  }

  wss.handleUpgrade(req, socket, head, (conn) => {
    wss.emit('connection', conn, req, boardId)
  })
})

server.listen(PORT, HOST, () => {
  log.info(`trailboard sync server listening on ws://localhost:${PORT}/:boardId`)
  log.info(`health check at http://localhost:${PORT}/health`)
})

const shutdown = async (signal: string): Promise<void> => {
  log.info(`${signal} received, shutting down`)
  wss.clients.forEach((c) => c.close(1001, 'server shutting down'))
  server.close()
  try {
    await ldb.destroy()
  } catch (err) {
    log.error('failed to close LevelDB cleanly', err)
  }
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
