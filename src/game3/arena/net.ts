// 逐鹿联机：两台浏览器之间的一条消息通道。
// PeerJS 的免费公共服务只用来牵线（交换连接信息），之后的游戏数据走浏览器之间的直连（WebRTC）。
// PeerJS 只在开房 / 进房时才按需加载，单机玩家不会下载它。
// URL 带 ?net=local 时改用同一浏览器内的 BroadcastChannel——只给回归测试用，不碰任何外部服务。

export type Msg = { t: string; [key: string]: unknown }
export type Link = {
  send(message: Msg): void
  /** Returns a function that stops listening (a finished match must not keep reacting). */
  onMessage(handler: (message: Msg) => void): () => void
  onClose(handler: () => void): () => void
  close(): void
}
export type Room = { code: string; guest: Promise<Link>; close(): void }

const PREFIX = 'dingge-zhulu-v1-'
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O, 1/I/L
const HEARTBEAT = 2000, SILENCE = 9000
export const roomCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')
export const cleanCode = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
const localMode = () => new URLSearchParams(location.search).get('net') === 'local'

/** Wrap a raw channel with a heartbeat, so a vanished peer (closed laptop, lost signal) is noticed. */
function linkOver(send: (m: Msg) => void, listen: (fn: (m: Msg) => void) => void, closeRaw: () => void, onRawClose: (fn: () => void) => void): Link {
  const handlers: ((m: Msg) => void)[] = [], closers: (() => void)[] = [], waiting: Msg[] = []
  let heard = Date.now(), closed = false
  const finish = () => { if (closed) return; closed = true; clearInterval(beat); closers.forEach(fn => fn()); try { closeRaw() } catch { /* already gone */ } }
  const beat = setInterval(() => { if (Date.now() - heard > SILENCE) finish(); else try { send({ t: 'ping' }) } catch { finish() } }, HEARTBEAT)
  // Messages that arrive before anyone listens (the host greets the instant the guest connects) are held, not lost.
  listen(m => { heard = Date.now(); if (m.t === 'ping') return; if (handlers.length) handlers.forEach(fn => fn(m)); else waiting.push(m) })
  onRawClose(finish)
  return {
    send: m => { if (!closed) try { send(m) } catch { finish() } },
    onMessage: fn => { handlers.push(fn); for (const m of waiting.splice(0)) fn(m); return () => { const i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1) } },
    onClose: fn => { if (closed) { fn(); return () => {} } closers.push(fn); return () => { const i = closers.indexOf(fn); if (i >= 0) closers.splice(i, 1) } },
    close: finish,
  }
}

// ---------- local channel (tests) ----------
function localLink(code: string, role: 'host' | 'guest'): Link {
  const channel = new BroadcastChannel(`dingge-net-${code}`), other = role === 'host' ? 'guest' : 'host'
  let gone: (() => void) | null = null
  return linkOver(
    m => channel.postMessage({ from: role, m }),
    fn => { channel.onmessage = e => { if (e.data.from !== other || e.data.m.t === 'knock' || e.data.m.t === 'welcome') return; if (e.data.m.t === 'bye') gone?.(); else fn(e.data.m) } },
    () => { channel.postMessage({ from: role, m: { t: 'bye' } }); channel.close() },
    fn => { gone = fn },
  )
}
function localHost(code: string): Room {
  const channel = new BroadcastChannel(`dingge-net-${code}`)
  const guest = new Promise<Link>(resolve => {
    // Open the host's end before answering, so nothing the guest sends next can miss it.
    channel.onmessage = e => { if (e.data.from === 'guest' && e.data.m.t === 'knock') { const link = localLink(code, 'host'); channel.postMessage({ from: 'host', m: { t: 'welcome' } }); channel.close(); resolve(link) } }
  })
  return { code, guest, close: () => channel.close() }
}
function localJoin(code: string): Promise<Link> {
  return new Promise((resolve, reject) => {
    const channel = new BroadcastChannel(`dingge-net-${code}`)
    // The guest's end listens before knocking: the host greets the instant it answers.
    const link = localLink(code, 'guest')
    const timer = setTimeout(() => { channel.close(); link.close(); reject(new Error('没有找到这个房间')) }, 4000)
    channel.onmessage = e => { if (e.data.from === 'host' && e.data.m.t === 'welcome') { clearTimeout(timer); channel.close(); resolve(link) } }
    channel.postMessage({ from: 'guest', m: { t: 'knock' } })
  })
}

// ---------- PeerJS ----------
async function peerLink(conn: import('peerjs').DataConnection, peer: import('peerjs').Peer): Promise<Link> {
  if (!conn.open) await new Promise<void>((resolve, reject) => { conn.on('open', () => resolve()); conn.on('error', reject) })
  return linkOver(
    m => conn.send(m),
    fn => conn.on('data', data => fn(data as Msg)),
    () => { conn.close(); peer.destroy() },
    fn => { conn.on('close', fn); conn.on('error', fn); peer.on('disconnected', fn) },
  )
}

/** Open a room and wait for one friend. Retries a few codes if one is already taken. */
export async function hostRoom(): Promise<Room> {
  if (localMode()) return localHost(roomCode())
  const { Peer } = await import('peerjs')
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = roomCode(), peer = new Peer(PREFIX + code, { debug: 0 })
    const opened = await new Promise<boolean | Error>(resolve => {
      peer.on('open', () => resolve(true))
      peer.on('error', error => resolve((error as { type?: string }).type === 'unavailable-id' ? false : error))
    })
    if (opened === false) { peer.destroy(); continue }
    if (opened instanceof Error) { peer.destroy(); throw new Error('连不上联机服务，请检查网络后再试') }
    const guest = new Promise<Link>(resolve => peer.on('connection', conn => { void peerLink(conn, peer).then(resolve) }))
    return { code, guest, close: () => peer.destroy() }
  }
  throw new Error('暂时开不了房间，请稍后再试')
}

/** Join a friend's room by its four-character code. */
export async function joinRoom(code: string): Promise<Link> {
  if (localMode()) return localJoin(code)
  const { Peer } = await import('peerjs')
  const peer = new Peer({ debug: 0 })
  await new Promise<void>((resolve, reject) => { peer.on('open', () => resolve()); peer.on('error', () => reject(new Error('连不上联机服务，请检查网络后再试'))) })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { peer.destroy(); reject(new Error('连接超时：房间号不对，或双方网络无法直连')) }, 12000)
    peer.on('error', error => { clearTimeout(timer); peer.destroy(); reject(new Error((error as { type?: string }).type === 'peer-unavailable' ? '没有找到这个房间' : '连接失败，请再试一次')) })
    const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' })
    void peerLink(conn, peer).then(link => { clearTimeout(timer); resolve(link) }, () => { clearTimeout(timer); peer.destroy(); reject(new Error('连接失败，请再试一次')) })
  })
}
