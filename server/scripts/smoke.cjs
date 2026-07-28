/*
 * Server smoke test — exercises the sync server without needing the React client.
 *
 *   npm run smoke:write   -> realtime fanout + room isolation, leaves state on disk
 *   (restart the server)
 *   npm run smoke:read    -> confirms that state was restored from LevelDB
 *
 * Each `smoke:write` mints a fresh pair of room ids and records them in
 * .smoke-run.json, which `smoke:read` picks up. Without that the test would only
 * pass against an empty ./data folder — persistence means a second run would find
 * the previous run's notes already in the room and fail the "starts empty" check.
 */
const fs = require('node:fs')
const path = require('node:path')
const Y = require('yjs')
const WS = require('ws')
const { WebsocketProvider } = require('y-websocket')

const SERVER_HTTP = process.env.SMOKE_URL ?? 'http://localhost:1234'
const SERVER_WS = SERVER_HTTP.replace(/^http/, 'ws')
const RUN_FILE = path.join(__dirname, '..', '.smoke-run.json')

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(boardId) {
  const doc = new Y.Doc()
  const provider = new WebsocketProvider(SERVER_WS, boardId, doc, {
    WebSocketPolyfill: WS,
    connect: true
  })
  return { doc, provider, notes: doc.getMap('notes') }
}

function synced(provider) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timed out waiting for sync')), 8000)
    if (provider.synced) { clearTimeout(t); resolve(); return }
    provider.once('sync', () => { clearTimeout(t); resolve() })
  })
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`)
}

async function runWrite() {
  const runId = `smoke-${Date.now().toString(36)}`
  const alphaId = `${runId}-alpha`
  const betaId = `${runId}-beta`
  console.log(`rooms for this run: ${alphaId}, ${betaId}\n`)

  const a = connect(alphaId)
  await synced(a.provider)
  check('client A synced to alpha room', true)
  check('new room starts empty', a.notes.size === 0, `size=${a.notes.size}`)

  a.notes.set('note-1', { text: 'hello from A', x: 40, y: 60, color: 'butter' })
  await wait(300)

  const b = connect(alphaId)
  await synced(b.provider)
  await wait(500)
  const got = b.notes.get('note-1')
  check("client B sees A's note (realtime fanout)", got?.text === 'hello from A', JSON.stringify(got))

  b.notes.set('note-2', { text: 'hello from B', x: 200, y: 120, color: 'sage' })
  await wait(500)
  check("client A sees B's note (bidirectional)", a.notes.get('note-2')?.text === 'hello from B')

  const c = connect(betaId)
  await synced(c.provider)
  await wait(500)
  check('beta room is isolated from alpha', c.notes.size === 0, `beta size=${c.notes.size}`)

  c.notes.set('beta-note', { text: 'only in beta' })
  await wait(300)
  check('alpha unaffected by beta writes', a.notes.size === 2, `alpha size=${a.notes.size}`)

  const health = await fetch(`${SERVER_HTTP}/health`).then((r) => r.json())
  const live = health.rooms.filter((r) => r.boardId === alphaId || r.boardId === betaId)
  check('health endpoint reports both rooms', live.length === 2, JSON.stringify(live))

  a.provider.destroy(); b.provider.destroy(); c.provider.destroy()
  await wait(500)

  fs.writeFileSync(RUN_FILE, JSON.stringify({ alphaId, betaId }, null, 2))
  console.log(`\nwrote ${path.basename(RUN_FILE)} — restart the server, then: npm run smoke:read`)
}

async function runRead() {
  if (!fs.existsSync(RUN_FILE)) {
    console.error('no .smoke-run.json found — run `npm run smoke:write` first')
    process.exit(1)
  }
  const { alphaId, betaId } = JSON.parse(fs.readFileSync(RUN_FILE, 'utf8'))
  console.log(`reading back rooms: ${alphaId}, ${betaId}\n`)

  const a = connect(alphaId)
  await synced(a.provider)
  await wait(600)
  check('alpha state survived server restart', a.notes.size === 2, `keys=${JSON.stringify([...a.notes.keys()])}`)
  check('note content intact', a.notes.get('note-1')?.text === 'hello from A', JSON.stringify(a.notes.get('note-1')))

  const c = connect(betaId)
  await synced(c.provider)
  await wait(600)
  check('beta state survived independently', c.notes.get('beta-note')?.text === 'only in beta')
  check('beta did not absorb alpha notes', c.notes.size === 1, `beta size=${c.notes.size}`)

  a.provider.destroy(); c.provider.destroy()
  await wait(300)
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'write') await runWrite()
  else if (mode === 'read') await runRead()
  else {
    console.error('usage: node scripts/smoke.cjs <write|read>')
    process.exit(1)
  }

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} checks passed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error('HARNESS ERROR', e); process.exit(1) })
