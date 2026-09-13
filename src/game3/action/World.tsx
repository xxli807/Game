import { PointerEvent, useEffect, useRef, useState } from 'react'
import { DynastyBattle } from './engine'
import { Skill, Snapshot, WORLD } from './model'
import { KIND_NAMES, orderFor, WorldEvent, WorldOption } from './orders'
import { describeEffect, quality, Resources } from '../rules'
import './world.css'

const AUDIENCES = [
  { name: '行宫文官', concern: '这道决定如何服众？臣担心政令朝令夕改。', options: [{ text: '写明施行章程，公开告示', supported: true }, { text: '先执行，章程以后再议', supported: false }] },
  { name: '城镇乡老', concern: '百姓已经疲惫，最怕新政再添负担。', options: [{ text: '先加派徭役，集中力量办事', supported: false }, { text: '分期施行，先照顾困顿人家', supported: true }] },
  { name: '关隘军官', concern: '军中愿意听令，但人手与粮饷如何安排？', options: [{ text: '明确轮值与补给，稳住军心', supported: true }, { text: '军令如山，不必解释', supported: false }] },
]
type Props = {
  event: WorldEvent; turn: number; monarch: string; resources: Resources; log: string[];
  active: string; activeUsed: boolean; onActive: () => void;
  onResolve: (option: WorldOption, success: boolean) => void;
  ending?: { title: string; text: string; victory: boolean; unlocked?: string };
  onExit: () => void;
}
export default function DynastyWorld(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), engine = useRef<DynastyBattle | null>(null)
  const [hud, setHud] = useState<Snapshot | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [journal, setJournal] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [stick, setStick] = useState({ x: 0, y: 0 })
  const stickPointer = useRef<number | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const settled = useRef(false)
  useEffect(() => {
    if (!canvas.current) return
    const battle = new DynastyBattle(canvas.current, setHud)
    engine.current = battle
    return () => { battle.destroy(); engine.current = null }
  }, [])
  useEffect(() => { engine.current?.setEvent(props.event); setSelected(null) }, [props.event.id, props.turn])
  useEffect(() => { if (props.ending) engine.current?.freeze() }, [props.ending?.title])
  // The village reads the four pillars: markets, patrols, crowds and weather follow them.
  useEffect(() => { engine.current?.setRealm(props.resources) }, [props.resources.military, props.resources.politics, props.resources.economy, props.resources.destiny])
  const isModal = hud?.status === 'decision' || hud?.status === 'audience' || hud?.status === 'orderdone' || hud?.status === 'paused' || Boolean(props.ending)
  useEffect(() => {
    if (isModal) { buttonRef.current?.focus(); setStick({ x: 0, y: 0 }); stickPointer.current = null }
    else canvas.current?.focus()
  }, [hud?.status, isModal])
  const moveStick = (e: PointerEvent<HTMLDivElement>) => {
    if (stickPointer.current !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect(), x = (e.clientX - rect.left - rect.width / 2) / 40, y = (e.clientY - rect.top - rect.height / 2) / 40
    const length = Math.max(1, Math.hypot(x, y)), next = { x: x / length, y: y / length }
    engine.current?.setStick(next.x, next.y); setStick(next)
  }
  const stopStick = () => { stickPointer.current = null; engine.current?.setStick(0, 0); setStick({ x: 0, y: 0 }) }
  const select = (index: number) => { settled.current = false; setSelected(index); engine.current?.beginOrder(orderFor(props.event, index)) }
  const skill = (id: Skill) => { engine.current?.cast(id); canvas.current?.focus() }
  const finish = () => {
    if (selected === null || !hud || settled.current) return
    settled.current = true
    props.onResolve(props.event.options[selected], hud.orderSuccess)
  }
  const modalKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab') return
    const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
    const first = buttons[0], last = buttons[buttons.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
  }
  return <main className="dynasty-world">
    <canvas ref={canvas} tabIndex={0} className="world-canvas" aria-label="鼎革连续世界。WASD或方向键移动，E交互或与村民交谈，空格闪避，Q破阵，R箭雨，Z与C旋转视角。" />
    <div className="world-interface" {...(isModal ? { inert: '' } : {})}>
      <header className="world-top">
        <div className="world-brand"><span>鼎</span><div><b>{props.monarch}的天下</b><small>{props.event.phase} · 第 {props.turn + 1} 道抉择</small></div></div>
        <div className="world-resources">{(['military', 'politics', 'economy', 'destiny'] as const).map((key, index) => <div key={key}><small>{['军事', '政治', '经济', '天命'][index]}</small><b>{quality(props.resources[key])}</b></div>)}</div>
        <div className="world-tools"><button aria-label={muted ? '开启音效' : '关闭音效'} onClick={() => { if (engine.current) { engine.current.sound.muted = !muted; setMuted(!muted) } }}>{muted ? '音 ×' : '音 ♪'}</button><button aria-label="暂停" onClick={() => engine.current?.togglePause()}>Ⅱ</button></div>
      </header>
      <section className="world-objective"><small>{selected === null ? '天下来信' : KIND_NAMES[orderFor(props.event, selected).kind]}</small><h1>{selected === null ? props.event.title : props.event.options[selected].label}</h1><p>{hud?.objective}</p>{hud && hud.orderRequired > 0 && <div className="order-dots">{Array.from({ length: hud.orderRequired }, (_, i) => <i className={i < hud.orderProgress ? 'done' : ''} key={i} />)}</div>}</section>
      <aside className="world-map" aria-label="天下舆图"><svg viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} role="img" aria-label="建筑与当前位置"><rect width={WORLD.width} height={WORLD.height} fill="#24382d" /><path d="M450 330 1380 320 900 915Z" fill="none" stroke="#a38e5f" strokeWidth="18" />{hud?.cities.map(city => <g key={city.name}><rect x={city.x - 38} y={city.y - 38} width="76" height="76" fill={city.owned ? '#8cc3a0' : '#d7b16e'} /><text x={city.x} y={city.y + 120} textAnchor="middle" fill="#e4d9b5" fontSize="85">{city.name}</text></g>)}{hud && <circle cx={hud.player.x} cy={hud.player.y} r="40" fill="#fff5d0" stroke="#af493b" strokeWidth="16" />}</svg><small>同一片天下 · 步行抵达</small></aside>
      {hud?.notice && <p className="world-notice" role="status">{hud.notice}</p>}
      {hud?.orderKind === 'ceremony' && hud.carrying && <div className="ritual-meter"><span>按住 E / 交互，金色区间内松开</span><div><i /><b style={{ left: `${hud.ritual * 100}%` }} /></div></div>}
      <footer className="world-bottom"><div className="world-vitals"><span>气血 <b>{hud?.hp ?? 0} / {hud?.maxHp ?? 0}</b></span><div><i style={{ width: `${hud ? hud.hp / hud.maxHp * 100 : 100}%` }} /></div><small>靠近敌人自动挥刀 · 红色区域是敌方预警</small></div><div className="world-actions"><button className="interact-button" disabled={!hud?.canInteract} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.interact() }} onPointerUp={() => engine.current?.releaseInteract()} onPointerCancel={() => engine.current?.releaseInteract()} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) engine.current?.interact() }} onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') engine.current?.releaseInteract() }}><kbd>E</kbd>{hud?.interactLabel ?? '交互'}</button>{([{ id: 'dash', key: '空格', name: '闪避' }, { id: 'storm', key: 'Q', name: '破阵' }, { id: 'volley', key: 'R', name: '箭雨' }] as const).map(item => <button key={item.id} disabled={(hud?.cooldowns[item.id] ?? 0) > 0} onClick={() => skill(item.id)}><kbd>{item.key}</kbd>{(hud?.cooldowns[item.id] ?? 0) > 0 ? `${hud!.cooldowns[item.id].toFixed(1)}秒` : item.name}</button>)}</div></footer>
      <div className="world-stick" role="group" aria-label="触摸摇杆" onPointerDown={e => { if (stickPointer.current !== null) return; stickPointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); moveStick(e) }} onPointerMove={moveStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}><i style={{ transform: `translate(${stick.x * 35}px, ${stick.y * 35}px)` }} /><span>移动</span></div>
      <div className="world-help">W A S D 移动 · E 交互 / 交谈 · 拖动或 Z C 转视角 · 滚轮缩放 · Esc 暂停</div>
    </div>
    {isModal && <section className="world-modal" role="dialog" aria-modal="true" aria-label={props.ending ? '王朝结局' : hud?.status === 'decision' ? props.event.title : '天下议事'} onKeyDown={modalKey}>
      <div className="world-dialog">
      {props.ending ? <><small>史官落笔 · {props.ending.victory ? '新朝已立' : '天命未成'}</small><h2>{props.ending.title}</h2><p>{props.ending.text}</p>{props.ending.unlocked && <p>新君王已解锁：{props.ending.unlocked}</p>}<button ref={buttonRef} className="world-primary" onClick={props.onExit}>返回君王选择</button></> : hud?.status === 'decision' ? <>
        <small>{props.event.phase} · {props.event.source}</small><h2>{props.event.title}</h2><p>{props.event.body}</p>
        <div className="world-options">{props.event.options.map((option, index) => <button ref={index === 0 ? buttonRef : undefined} key={index} onClick={() => select(index)}><b>{option.label}</b><span>{describeEffect(option.reward ?? option.effect, props.event.phase)}</span><em>{KIND_NAMES[orderFor(props.event, index).kind]} · 亲自执行 →</em></button>)}</div>
        {!props.activeUsed && <button className="world-secondary" onClick={props.onActive}>君王专属 · {props.active}</button>}
        <button className="world-quiet" onClick={() => engine.current?.closeDecision()}>稍后决断，继续巡视</button>
      </> : hud?.status === 'audience' ? <><small>朝野交涉 · {hud.orderProgress + 1} / 3</small><h2>{AUDIENCES[hud.audience].name}</h2><p>关于「{selected === null ? '' : props.event.options[selected].label}」：</p><blockquote>{AUDIENCES[hud.audience].concern}</blockquote><div className="world-options">{AUDIENCES[hud.audience].options.map((option, i) => <button key={i} ref={i === 0 ? buttonRef : undefined} onClick={() => engine.current?.answerAudience(option.supported)}>{option.text}</button>)}</div></> : hud?.status === 'orderdone' ? <><small>政令回报</small><h2>{hud.orderSuccess ? '此事已办妥' : '执行受挫'}</h2><p>「{selected === null ? '' : props.event.options[selected].label}」{hud.orderSuccess ? '已在这片土地上付诸行动。返回政务，查看它对王朝的影响。' : '未能如愿。此次损失将影响国势，天下仍待你继续经营。'}</p>{hud.worldChange && <p className="world-change">村中变化 · {hud.worldChange}</p>}<button ref={buttonRef} className="world-primary" onClick={finish}>记入起居注，继续巡视 →</button></> : <><small>天下暂歇</small><h2>{leaving ? '返回君王选择？' : '已暂停'}</h2>{leaving ? <><p>当前王朝的进度不会保留；已解锁的君王仍在。</p><button ref={buttonRef} className="world-primary" onClick={() => setLeaving(false)}>留在此局</button><button className="world-secondary" onClick={props.onExit}>结束本局并返回</button></> : <><p>WASD / 方向键移动，E 交互；走近村民按 E 交谈。拖动画面或按 Z / C 旋转视角，滚轮缩放。手机用左下摇杆和右下按钮，单指拖动画面转视角，双指缩放。你的每个决定都会留在村子里。</p><button ref={buttonRef} className="world-primary" onClick={() => { setJournal(false); engine.current?.togglePause() }}>继续巡视</button><button className="world-secondary" onClick={() => setJournal(!journal)}>查看起居注</button>{journal && <div className="world-journal">{props.log.map((line, i) => <p key={i}>{line}</p>)}</div>}<button className="world-quiet" onClick={() => setLeaving(true)}>返回君王选择</button></>}</>}
      </div>
    </section>}
  </main>
}
