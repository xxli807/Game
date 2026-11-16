import { PointerEvent, useEffect, useRef, useState } from 'react'
import { CLASS_NAMES, DIFFICULTIES, HEROES, ULT_LEVEL, heroByName } from './data'
import { ArenaGame, type ArenaHud, type NetRole } from './game'
import { cleanCode, hostRoom, joinRoom, type Link, type Room } from './net'
import type { ArenaOptions } from './sim'
import './arena.css'

// 逐鹿：三路推塔对战。React 只负责赛前说明、HUD 与结算；每帧的东西都在 ArenaGame 里。

type Props = {
  hero: string
  /** Called once when the match ends; returns a newly unlocked monarch, if any. */
  onFinish: (result: { won: boolean; kills: number; bestStreak: number }) => string | undefined
  onExit: () => void
}
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

type Mode = 'coop' | 'versus'
type Online = { role: 'host' | 'guest'; link: Link; options: ArenaOptions; round: number; mode: Mode }
type Lobby =
  | { phase: 'idle'; error?: string }
  | { phase: 'opening'; mode: Mode }
  | { phase: 'hosting'; mode: Mode; room: Room; link?: Link; friend?: string }
  | { phase: 'joining'; code: string }
  | { phase: 'joined'; link: Link; mode?: Mode; host?: string }
const MODE_NAMES: Record<Mode, string> = { coop: '同队合作', versus: '对战' }

export default function Arena({ hero, onFinish, onExit }: Props) {
  const [difficulty, setDifficulty] = useState(1)
  const [match, setMatch] = useState(0) // 0 = briefing; each new match gets a fresh key
  // 逐鹿可用全部十二位君王：起始四位全是近战，不该让人赢两局才摸到法师和射手。
  const [pick, setPick] = useState(hero)
  const [lobby, setLobby] = useState<Lobby>({ phase: 'idle' })
  const [online, setOnline] = useState<Online | null>(null)
  const [code, setCode] = useState('')
  const pickRef = useRef(pick); pickRef.current = pick
  const lobbyRef = useRef(lobby); lobbyRef.current = lobby
  const def = heroByName(pick)

  const leave = () => {
    const l = lobbyRef.current
    if (l.phase === 'hosting') { l.link?.close(); l.room.close() }
    if (l.phase === 'joined') l.link.close()
    online?.link.close(); setOnline(null); setLobby({ phase: 'idle' })
  }
  useEffect(() => () => { const l = lobbyRef.current; if (l.phase === 'hosting') { l.link?.close(); l.room.close() } if (l.phase === 'joined') l.link.close() }, [])
  // Tell the other side which hero this player has picked, whenever it changes.
  useEffect(() => { const l = lobby; const link = l.phase === 'joined' ? l.link : l.phase === 'hosting' ? l.link : undefined; link?.send({ t: 'hero', hero: pick }) }, [pick, lobby.phase, lobby.phase === 'hosting' ? lobby.link : undefined])
  const host = async (mode: Mode) => {
    setLobby({ phase: 'opening', mode })
    try {
      const room = await hostRoom()
      setLobby({ phase: 'hosting', mode, room })
      const link = await room.guest
      link.onMessage(m => { if (m.t === 'hero') setLobby(l => l.phase === 'hosting' ? { ...l, friend: String(m.hero) } : l) })
      // A match in progress keeps going with the AI in the friend's seat; only the room closes.
      link.onClose(() => setLobby({ phase: 'idle', error: '好友离开了房间' }))
      link.send({ t: 'room', mode, hero: pickRef.current })
      setLobby(l => l.phase === 'hosting' ? { ...l, link } : l)
    } catch (error) { setLobby({ phase: 'idle', error: (error as Error).message }) }
  }
  const join = async () => {
    const room = cleanCode(code)
    if (room.length !== 4) { setLobby({ phase: 'idle', error: '房间号是四个字符' }); return }
    setLobby({ phase: 'joining', code: room })
    try {
      const link = await joinRoom(room)
      // Enter the joined state before listening, so the host's greeting (held until now) lands in it.
      setLobby({ phase: 'joined', link })
      link.onMessage(m => {
        if (m.t === 'room' || m.t === 'hero') setLobby(l => l.phase === 'joined' ? { ...l, mode: (m.mode as Mode) ?? l.mode, host: String(m.hero ?? l.host) } : l)
        // The host starts (and restarts) matches; each start is a fresh round with its own seed.
        if (m.t === 'start') setOnline(o => ({ role: 'guest', link, options: m.options as ArenaOptions, mode: m.mode as Mode, round: (o?.round ?? 0) + 1 }))
      })
      link.onClose(() => { setLobby(l => l.phase === 'joined' ? { phase: 'idle', error: '与房主的连接已断开' } : l) })
      link.send({ t: 'hero', hero: pickRef.current })
    } catch (error) { setLobby({ phase: 'idle', error: (error as Error).message }) }
  }
  const startOnline = (l: Extract<Lobby, { phase: 'hosting' }>, round: number) => {
    if (!l.link || !l.friend) return
    const options: ArenaOptions = { hero: pickRef.current, seed: Math.floor(Math.random() * 2e9), difficulty: l.mode === 'coop' ? difficulty : 1, guest: { hero: l.friend, team: l.mode === 'coop' ? 0 : 1 } }
    l.link.send({ t: 'start', options, mode: l.mode })
    setOnline({ role: 'host', link: l.link, options, mode: l.mode, round })
  }

  if (online) return <Match key={`online-${online.round}`} hero={online.options.hero} difficulty={online.options.difficulty ?? 1} options={online.options} net={{ role: online.role, link: online.link }} mode={online.mode}
    onFinish={onFinish} onExit={leave} onBrief={() => setOnline(null)}
    onAgain={() => { const l = lobbyRef.current; if (online.role === 'host' && l.phase === 'hosting' && l.link) startOnline(l, online.round + 1); else { setOnline(null); setMatch(m => m + 1) } }} />
  if (match > 0) return <Match key={match} hero={pick} difficulty={difficulty} onFinish={onFinish} onExit={onExit} onAgain={() => setMatch(m => m + 1)} onBrief={() => setMatch(0)} />
  return <main className="arena arena-brief">
    <section className="arena-brief-card">
      <p className="arena-eyebrow">逐鹿 · 三路对战</p>
      <div className="arena-picks" role="group" aria-label="选择出战君王">
        {HEROES.map(h => <button key={h.name} className={h.name === pick ? 'on' : ''} aria-pressed={h.name === pick} aria-label={`${h.name} · ${CLASS_NAMES[h.cls]}`} onClick={() => setPick(h.name)}><i style={{ background: h.color }}>{h.name.slice(0, 1)}</i><b>{h.name}</b><small>{CLASS_NAMES[h.cls]}</small></button>)}
      </div>
      <h1><i style={{ background: def.color }}>{def.name.slice(0, 1)}</i>{def.name}<small>{def.epithet} · {CLASS_NAMES[def.cls]}</small></h1>
      <p className="arena-tagline">「{def.tagline}」</p>
      <ul className="arena-kit">
        {def.skills.map((s, i) => <li key={s.name}><b>{s.glyph}</b><div><strong>{s.name}{i === 2 && <em>大招 · {ULT_LEVEL} 级解锁</em>}</strong><span>{s.desc}</span></div></li>)}
      </ul>
      <div className="arena-rules">
        <p><b>目标</b>带着兵线推掉一路的两座防御塔，再击毁敌方大鼎。</p>
        <p><b>规矩</b>没有己方小兵在场时，塔和鼎几乎打不动，塔还会专打你。</p>
        <p><b>成长</b>补兵、击败敌将得金币与经验；金币够了点「推荐装备」一键购买。</p>
        <p><b>手感</b>普攻每连续第三下是重击；「闪现」可瞬移一小段，追人逃命都靠它。</p>
        <p><b>天命卷</b>开局和每次升级都能三选一：精进技能（第三阶觉醒变形）、习得会自己出手的新武学（飞剑、雷法、箭雨……）、或修一门心法。每局都不一样。</p>
      </div>
      <fieldset className="arena-levels">
        <legend>敌军强度</legend>
        {DIFFICULTIES.map(d => <button key={d.id} className={difficulty === d.id ? 'on' : ''} aria-pressed={difficulty === d.id} onClick={() => setDifficulty(d.id)}><b>{d.name}</b><small>{d.note}</small></button>)}
      </fieldset>
      <button className="arena-go" onClick={() => setMatch(1)} disabled={lobby.phase !== 'idle'}>单人开战 →</button>
      <section className="arena-friends" aria-label="与好友同玩">
        <h2>与好友同玩</h2>
        {lobby.phase === 'idle' && <>
          <p>开一个房间，把房间号发给好友；或者输入好友给你的房间号加入。双方先各自选好君王。</p>
          <div className="arena-room-actions">
            <button onClick={() => host('coop')}><b>开房 · 同队合作</b><small>你们同一边，AI 补齐其余</small></button>
            <button onClick={() => host('versus')}><b>开房 · 对战</b><small>你蓝方、好友红方</small></button>
          </div>
          <div className="arena-join"><input aria-label="房间号" placeholder="房间号" maxLength={6} value={code} onChange={e => setCode(cleanCode(e.target.value))} onKeyDown={e => { if (e.key === 'Enter') void join() }} /><button onClick={() => void join()} disabled={cleanCode(code).length !== 4}>加入</button></div>
          {lobby.error && <p className="arena-room-error" role="alert">{lobby.error}</p>}
        </>}
        {lobby.phase === 'opening' && <p role="status">正在开房…</p>}
        {lobby.phase === 'hosting' && <div className="arena-room" role="status">
          <p>房间号（{MODE_NAMES[lobby.mode]}）</p><strong className="arena-code">{lobby.room.code}</strong>
          {lobby.link ? <p>好友已加入{lobby.friend ? `，选了 ${lobby.friend}` : ''}。{lobby.mode === 'versus' ? '你在蓝方，好友在红方。' : '你们同在蓝方。'}</p> : <p>把房间号发给好友，等待加入…</p>}
          <button className="arena-go" onClick={() => startOnline(lobby, 1)} disabled={!lobby.link || !lobby.friend}>开始联机对局 →</button>
          <button className="arena-back" onClick={leave}>关闭房间</button>
        </div>}
        {lobby.phase === 'joining' && <p role="status">正在加入房间 {lobby.code}…</p>}
        {lobby.phase === 'joined' && <div className="arena-room" role="status">
          <p>已进入房间{lobby.mode ? ` · ${MODE_NAMES[lobby.mode]}` : ''}{lobby.host ? ` · 房主选了 ${lobby.host}` : ''}</p>
          <p>等待房主开始对局。开始前你仍可换君王。</p>
          <button className="arena-back" onClick={leave}>离开房间</button>
        </div>}
        <p className="arena-room-note">联机通过 PeerJS 免费服务牵线，之后两台设备直接相连；少数网络（部分手机流量、校园或公司网络）可能连不上。房主关掉页面，对局即结束。</p>
      </section>
      <button className="arena-back" onClick={onExit}>返回大厅</button>
    </section>
  </main>
}

function Match({ hero, difficulty, onFinish, onExit, onAgain, onBrief, options, net, mode }: Props & { difficulty: number; onAgain: () => void; onBrief: () => void; options?: ArenaOptions; net?: NetRole; mode?: Mode }) {
  const canvas = useRef<HTMLCanvasElement>(null), map = useRef<HTMLCanvasElement>(null), game = useRef<ArenaGame | null>(null)
  const [hud, setHud] = useState<ArenaHud | null>(null)
  const [error, setError] = useState(false)
  const [muted, setMuted] = useState(false)
  const [board, setBoard] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [unlocked, setUnlocked] = useState<string>()
  const [stick, setStick] = useState({ x: 0, y: 0 })
  const stickPointer = useRef<number | null>(null)
  const settled = useRef(false)

  useEffect(() => {
    if (!canvas.current) return
    try {
      const created = new ArenaGame(canvas.current, options ?? { hero, difficulty }, setHud, net)
      game.current = created
      // Test mode only (?net=local): expose the match so the two-player regression can inspect both sides.
      if (new URLSearchParams(location.search).get('net') === 'local') (window as unknown as { __arena: ArenaGame }).__arena = created
      return () => { created.destroy(); game.current = null }
    } catch { setError(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const ctx = map.current?.getContext('2d')
    if (ctx && map.current) game.current?.drawMinimap(ctx, map.current.width)
  }, [hud?.time, hud?.status])
  useEffect(() => {
    if (hud?.status !== 'ended' || settled.current) return
    settled.current = true
    setUnlocked(onFinish({ won: hud.winner === hud.team, kills: hud.me.k, bestStreak: hud.me.bestStreak }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud?.status])
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Tab') { e.preventDefault(); setBoard(true) } }
    const up = (e: KeyboardEvent) => { if (e.key === 'Tab') setBoard(false) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const moveStick = (e: PointerEvent<HTMLDivElement>) => {
    if (stickPointer.current !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect(), x = (e.clientX - rect.left - rect.width / 2) / (rect.width * 0.36), y = (e.clientY - rect.top - rect.height / 2) / (rect.height * 0.36)
    const length = Math.max(1, Math.hypot(x, y)), next = { x: x / length, y: y / length }
    game.current?.setStick(next.x, next.y); setStick(next)
  }
  const stopStick = () => { stickPointer.current = null; game.current?.setStick(0, 0); setStick({ x: 0, y: 0 }) }
  const hold = (prefer: 'auto' | 'minion' | 'tower') => ({
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => { e.currentTarget.setPointerCapture(e.pointerId); game.current?.setAttack(true, prefer) },
    onPointerUp: () => game.current?.setAttack(false), onPointerCancel: () => game.current?.setAttack(false), onLostPointerCapture: () => game.current?.setAttack(false),
  })

  if (error) return <main className="arena arena-brief"><section className="arena-brief-card"><h1>无法开始对战</h1><p className="arena-tagline">这台设备的浏览器不支持 WebGL2，逐鹿模式需要它来绘制战场。文字抉择模式仍可正常游玩。</p><button className="arena-go" onClick={onExit}>返回君王选择</button></section></main>

  const me = hud?.me, modal = hud?.status === 'paused' || hud?.status === 'ended' || hud?.status === 'lost'
  const mvp = hud?.status === 'ended' ? hud.board.slice().sort((a, b) => (b.k * 3 + b.a - b.d) - (a.k * 3 + a.a - a.d))[0] : undefined
  return <main className={`arena${me && !me.alive ? ' arena-dead' : ''}`}>
    <canvas ref={canvas} className="arena-canvas" tabIndex={0} aria-label="逐鹿战场。WASD 移动，J 或空格攻击，Q E R 释放技能，B 回城，F 治疗，C 闪现，G 购买推荐装备。" />
    {hud?.status === 'loading' && <p className="arena-loading" role="status">战场布阵中…</p>}
    {hud && me && <div className="arena-hud" {...(modal ? { inert: '' } : {})}>
      <canvas ref={map} className="arena-map" width={300} height={300} aria-label="小地图" />
      <header className="arena-score" aria-label="比分">
        <span className="blue"><b>{hud.kills[0]}</b><small>塔 {hud.towers[0]}</small></span>
        <time>{clock(hud.time)}</time>
        <span className="red"><b>{hud.kills[1]}</b><small>塔 {hud.towers[1]}</small></span>
      </header>
      <div className="arena-tools">
        {hud.online && <span className={`arena-online ${hud.team ? 'red' : 'blue'}`} title={mode === 'versus' ? '联机对战' : '联机同队'}>{mode === 'versus' ? `对战 · 你是${hud.team ? '红' : '蓝'}方` : '同队'}{hud.friend && ` · 好友 ${hud.friend.name}${hud.friend.left ? '（已断开）' : hud.friend.alive ? '' : '（阵亡）'}`}</span>}
        <span className="arena-kda" aria-label="击杀 阵亡 助攻">{me.k} / {me.d} / {me.a}</span>
        <button aria-pressed={hud.auto} className={hud.auto ? 'on' : ''} onClick={() => game.current?.toggleAuto()}>托管</button>
        <button aria-label="战绩" onClick={() => setBoard(b => !b)}>榜</button>
        <button aria-label={muted ? '开启音效' : '关闭音效'} onClick={() => { game.current?.setMuted(!muted); setMuted(!muted) }}>{muted ? '静' : '♪'}</button>
        <button aria-label="暂停" onClick={() => game.current?.togglePause()}>Ⅱ</button>
      </div>
      {hud.cutin && <div key={hud.cutin.id} className="arena-cutin" aria-hidden="true" style={{ ['--hero' as string]: hud.cutin.color }}><b>{hud.cutin.glyph}</b><span>{hud.cutin.name}</span></div>}
      {hud.announce && <p key={hud.announce.id} className={`arena-announce ${hud.announce.tone}`} role="status">{hud.announce.text}</p>}
      <ul className="arena-feed" aria-label="战报">{hud.feed.map(line => <li key={line.id} className={line.tone}>{line.text}</li>)}</ul>
      {(hud.boss[0] > 0 || hud.boss[1] > 0) && <p className={`arena-buff ${hud.boss[0] > 0 ? 'good' : 'bad'}`}>铁牛之力 · {hud.boss[0] > 0 ? '我方' : '敌方'} {Math.ceil(Math.max(hud.boss[0], hud.boss[1]))} 秒</p>}
      {!me.alive && <p className="arena-respawn" role="status">阵亡 · <b>{Math.ceil(me.respawn)}</b> 秒后在泉水重生</p>}

      {hud.next && <button className={`arena-shop${hud.next.can ? ' can' : ''}`} disabled={!hud.next.can} onClick={() => game.current?.buyNext()} title={hud.next.desc}>
        <i>{hud.next.glyph}</i><span><b>{hud.next.name}</b><small>{hud.next.can ? hud.next.desc : `还差 ${hud.next.cost - me.gold} 金`}</small></span><em>{hud.next.cost}<kbd>G</kbd></em>
      </button>}

      {me.offer && <section className="arena-offer" aria-label="升级三选一">
        <p>{me.picks > 1 ? `天命卷 · 还有 ${me.picks} 次选择` : '天命卷 · 选一项'}<small>按 1 / 2 / 3 或点选</small></p>
        <div>{me.offer.map((card, i) => <button key={`${card.title}${i}`} className={`arena-card${card.tag === '觉醒' ? ' awake' : card.tag === '新武学' ? ' fresh' : ''}`} style={{ ['--card' as string]: card.color }} onClick={() => game.current?.pick(i)}>
          <kbd>{i + 1}</kbd><em>{card.tag}</em><b>{card.glyph}</b><strong>{card.title}</strong><span>{card.desc}</span>
          {card.max > 1 && <i className="arena-pips">{Array.from({ length: card.max }, (_, n) => <u key={n} className={n <= card.rank ? 'on' : ''} />)}</i>}
        </button>)}</div>
      </section>}
      {(me.autos.length > 0 || me.perks.length > 0) && <ul className="arena-kit-owned" aria-label="已得武学与心法">
        {me.autos.map(a => <li key={a.name} className="auto" style={{ ['--card' as string]: a.color }} title={`${a.name} ${a.rank} 阶`}><b>{a.glyph}</b><small>{'Ⅰ Ⅱ Ⅲ'.split(' ')[a.rank - 1]}</small></li>)}
        {me.perks.map(p => <li key={p.name} title={`${p.name} ×${p.count}`}><b>{p.glyph}</b><small>×{p.count}</small></li>)}
      </ul>}

      <section className="arena-plate" aria-label="我的状态">
        <div className="arena-face" style={{ background: heroByName(me.name).color }}>{me.name.slice(0, 1)}<b>{me.level}</b></div>
        <div className="arena-vitals">
          <div className="arena-hp" role="meter" aria-label="生命" aria-valuemin={0} aria-valuemax={me.maxHp} aria-valuenow={me.hp}><i style={{ width: `${me.hp / me.maxHp * 100}%` }} /><u style={{ width: `${Math.min(100, me.shield / me.maxHp * 100)}%` }} /><span>{me.hp} / {me.maxHp}</span></div>
          <div className="arena-xp"><i style={{ width: `${me.xp * 100}%` }} /></div>
          <div className={`arena-combo${me.combo === 2 ? ' ready' : ''}`} aria-label={`连击 ${me.combo} / 3${me.combo === 2 ? '，下次普攻重击' : ''}`}>
            {[1, 2, 3].map(n => <i key={n} className={me.combo >= n ? 'lit' : ''} />)}<span>{me.combo === 2 ? '下次重击' : me.combo === 3 ? '重击！' : '三连重击'}</span>
          </div>
          <div className="arena-items">{Array.from({ length: 6 }, (_, i) => <i key={i} title={me.items[i] ? `${me.items[i].name}：${me.items[i].desc}` : '空'}>{me.items[i]?.glyph ?? ''}</i>)}<span className="arena-gold">{me.gold} 金</span></div>
        </div>
        <div className="arena-spells">
          <button onClick={() => game.current?.recall()} disabled={!me.alive} className={me.recall > 0 ? 'busy' : ''} style={{ ['--p' as string]: me.recall }}><kbd>B</kbd>回城</button>
          <button onClick={() => game.current?.heal()} disabled={!me.alive || me.heal > 0}><kbd>F</kbd>{me.heal > 0 ? `${Math.ceil(me.heal)}` : '治疗'}</button>
          <button aria-label="闪现" title="朝移动或瞄准方向瞬移，冷却 75 秒" onClick={() => game.current?.flash()} disabled={!me.alive || me.flash > 0}><kbd>C</kbd>{me.flash > 0 ? `${Math.ceil(me.flash)}` : '闪现'}</button>
        </div>
      </section>

      <div className="arena-pad" aria-label="战斗操作">
        {me.skills.map((s, i) => <SkillButton key={s.name} index={i} skill={s} game={game} dead={!me.alive} />)}
        <button className="arena-attack" aria-label="普通攻击" disabled={!me.alive} {...hold('auto')}><kbd>J</kbd>攻击</button>
        <button className="arena-prefer minion" aria-label="优先攻击小兵" disabled={!me.alive} {...hold('minion')}>兵</button>
        <button className="arena-prefer tower" aria-label="优先攻击防御塔" disabled={!me.alive} {...hold('tower')}>塔</button>
      </div>
      <div className="arena-stick" role="group" aria-label="移动摇杆" onPointerDown={e => { if (stickPointer.current !== null) return; stickPointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); moveStick(e) }} onPointerMove={moveStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}><i style={{ transform: `translate(${stick.x * 38}px, ${stick.y * 38}px)` }} /></div>
      <p className="arena-help">WASD 移动 · J / 空格 / 鼠标左键 攻击 · Q E R 技能（轻点自动瞄准敌将，按住可手动瞄准） · B 回城 · F 治疗 · C 闪现 · G 买装 · Tab 战绩</p>
      {board && <Board hud={hud} />}
    </div>}

    {hud && me && modal && <section className="arena-modal" role="dialog" aria-modal="true" aria-label={hud.status === 'ended' ? '对战结算' : '暂停'}>
      {hud.status === 'lost' ? <div className="arena-dialog lose">
        <small>联机</small><h2>与房主的连接已断开</h2>
        <p>可能是房主关掉了页面，或网络中断。这一局无法继续。</p>
        <button autoFocus className="arena-go" onClick={onExit}>返回大厅</button>
      </div> : hud.status === 'ended' ? <div className={`arena-dialog ${hud.winner === hud.team ? 'win' : 'lose'}`}>
        <small>逐鹿 · {clock(hud.time)}</small>
        <h2>{hud.winner === hud.team ? '敌鼎已破，天下归心' : '大鼎倾覆，来日再战'}</h2>
        <div className="arena-stats"><span><b>{me.k} / {me.d} / {me.a}</b>击杀 / 阵亡 / 助攻</span><span><b>{me.dealt.toLocaleString()}</b>对敌将伤害</span><span><b>{hud.kills[0]} : {hud.kills[1]}</b>总比分</span></div>
        {mvp && <p className="arena-mvp">本场最佳：<b>{mvp.name}</b>（{mvp.team === 0 ? '我方' : '敌方'} · {mvp.k}/{mvp.d}/{mvp.a}）{mvp.me && ' —— 就是你'}</p>}
        {unlocked && <p className="arena-unlock">新君王已解锁：<b>{unlocked}</b></p>}
        <Board hud={hud} inline />
        {hud.online === 'guest' ? <p className="arena-room-note">等待房主开始下一局…</p> : <button autoFocus className="arena-go" onClick={onAgain}>再战一局 →</button>}
        <button className="arena-back" onClick={onBrief}>{hud.online ? '回到房间' : '换一位君王'}</button>
        <button className="arena-back" onClick={onExit}>{hud.online ? '离开房间' : '返回大厅'}</button>
      </div> : <div className="arena-dialog">
        <small>逐鹿 · {clock(hud.time)}</small>
        <h2>{leaving ? '放弃这一局？' : hud.online ? '菜单' : '已暂停'}</h2>
        {hud.online && !leaving && <p className="arena-room-note">联机对局不会暂停——你的英雄仍在战场上，请尽快回来。</p>}
        {leaving ? <><p>这一局不会计入战绩。</p><button autoFocus className="arena-go" onClick={() => setLeaving(false)}>继续对战</button><button className="arena-back" onClick={onExit}>放弃并返回</button></>
          : <><p>推掉一路的两座塔，再击毁敌方大鼎。塔下没有己方小兵时不要硬闯。</p><button autoFocus className="arena-go" onClick={() => game.current?.togglePause()}>继续对战</button><button className="arena-back" onClick={() => setLeaving(true)}>返回君王选择</button></>}
      </div>}
    </section>}
  </main>
}

function SkillButton({ index, skill, game, dead }: { index: number; skill: ArenaHud['me']['skills'][number]; game: React.MutableRefObject<ArenaGame | null>; dead: boolean }) {
  const origin = useRef<{ x: number; y: number; r: number } | null>(null)
  const off = dead || skill.locked || skill.left > 0
  const drag = (e: PointerEvent<HTMLButtonElement>) => { const o = origin.current; if (o) game.current?.aimDrag(index, (e.clientX - o.x) / o.r, (e.clientY - o.y) / o.r) }
  return <button className={`arena-skill s${index}${index === 2 ? ' ult' : ''}${off ? ' off' : ''}${skill.rank >= 3 ? ' awake' : ''}`} aria-label={`${skill.name}：${skill.desc}`} aria-disabled={off} title={`${skill.name}：${skill.desc}`}
    style={{ ['--cd' as string]: skill.total ? skill.left / skill.total : 0 }}
    onPointerDown={e => {
      if (off) return
      const rect = e.currentTarget.getBoundingClientRect()
      origin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, r: rect.width * 0.9 }
      e.currentTarget.setPointerCapture(e.pointerId); game.current?.aimStart(index)
    }}
    onPointerMove={drag}
    onPointerUp={() => { if (origin.current) { origin.current = null; game.current?.aimRelease(index) } }}
    onPointerCancel={() => { origin.current = null; game.current?.aimCancel() }}
    onLostPointerCapture={() => { if (origin.current) { origin.current = null; game.current?.aimCancel() } }}
    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !off) { e.preventDefault(); game.current?.aimStart(index); game.current?.aimRelease(index) } }}>
    <b>{skill.glyph}</b>
    <small>{skill.locked ? `${ULT_LEVEL} 级` : skill.left > 0 ? Math.ceil(skill.left) : skill.name}</small>
    <kbd>{'QER'[index]}</kbd>
    {skill.rank > 0 && <i className="arena-rank">{Array.from({ length: skill.rank }, (_, n) => <u key={n} />)}</i>}
  </button>
}

function Board({ hud, inline }: { hud: ArenaHud; inline?: boolean }) {
  return <table className={`arena-board${inline ? ' inline' : ''}`}>
    <thead><tr><th>将领</th><th>等级</th><th>击杀</th><th>阵亡</th><th>助攻</th></tr></thead>
    <tbody>{hud.board.map(row => <tr key={`${row.team}${row.name}`} className={`${row.team === 0 ? 'blue' : 'red'}${row.me ? ' me' : ''}${row.alive ? '' : ' down'}`}>
      <td>{row.name}<small>{CLASS_NAMES[row.cls as keyof typeof CLASS_NAMES]}</small></td><td>{row.level}</td><td>{row.k}</td><td>{row.d}</td><td>{row.a}</td>
    </tr>)}</tbody>
  </table>
}
