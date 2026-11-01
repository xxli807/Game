import { COMMANDS } from './army'
import { CombatControls } from './CombatControls'
import { StoryDialog } from './StoryDialog'
import { PointerEvent, useEffect, useRef, useState } from 'react'
import { DynastyBattle } from './engine'
import { Skill, Snapshot, WORLD } from './model'
import { KIND_NAMES, orderFor, WorldEvent, WorldOption } from './orders'
import { describeEffect, quality, Resources } from '../rules'
import './world.css'
import { FoundingGoal, HistoricalContext } from '../ChronicleGuide'
import { ROAD_EDGES, ROAD_NODES } from './layout'
const mapRoads = ROAD_EDGES.map(([a, b]) => `M${ROAD_NODES[a].x} ${ROAD_NODES[a].y}L${ROAD_NODES[b].x} ${ROAD_NODES[b].y}`).join(' ')

type Props = {
  event: WorldEvent; turn: number; monarch: string; resources: Resources; log: string[];
  active: string; activeUsed: boolean; onActive: () => void;
  onResolve: (option: WorldOption, success: boolean, councilSpent: number) => void;
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
  useEffect(() => { engine.current?.setEvent(props.event, props.turn); setSelected(null) }, [props.event.id, props.turn])
  useEffect(() => { if (props.ending) engine.current?.freeze() }, [props.ending?.title])
  // The village reads the four pillars: markets, patrols, crowds and weather follow them.
  useEffect(() => { engine.current?.setRealm(props.resources) }, [props.resources.military, props.resources.politics, props.resources.economy, props.resources.destiny])
  const isModal = hud?.status === 'story' || hud?.status === 'decision' || hud?.status === 'audience' || hud?.status === 'orderdone' || hud?.status === 'paused' || Boolean(props.ending)
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
    if (hud?.army.field) { engine.current?.returnFromBattle(); return }
    if (hud?.activeStory) { engine.current?.finishStory(); return }
    if (selected === null || !hud || settled.current) return
    settled.current = true
    props.onResolve(props.event.options[selected], hud.orderSuccess, hud.orderKind === 'council' ? hud.councilSpent : 0)
  }
  const modalKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Tab') return
    const buttons = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href]')].filter(item => item.getClientRects().length > 0)
    const first = buttons[0], last = buttons[buttons.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
  }
  const storyChoice = hud?.activeStory?.choices.find(c => c.id === hud.activeStory?.choice)
  const activityTitle = hud?.army.field ? '关隘争夺 · 列阵迎敌' : storyChoice?.label ?? (selected === null ? props.event.title : props.event.options[selected].label)
  return <main className={`dynasty-world${hud?.orderKind === 'assault' ? ' is-battle' : ''}`}>
    <canvas ref={canvas} tabIndex={0} className="world-canvas" aria-label="鼎革连续世界。WASD或方向键移动，E交互或与村民交谈，1进攻、2跟随、3坚守，J挥刀连击，K招架，空格闪避，Q横扫，R齐射，Z与C旋转视角，V切换近身与俯瞰视角。" />
    <div className="world-interface" {...(isModal ? { inert: '' } : {})}>
      <header className="world-top">
        <div className="world-brand"><span>鼎</span><div><b>{props.monarch}的天下</b><small>{props.event.phase} · 第 {props.turn + 1} 道抉择</small></div></div>
        <div className="world-resources">{(['military', 'politics', 'economy', 'destiny'] as const).map((key, index) => <div key={key}><small>{['军事', '政治', '经济', '天命'][index]}</small><b>{quality(props.resources[key])}</b></div>)}</div>
        <div className="world-tools">{hud && (hud.enemyCount > 0 || hud.orderKind === 'assault') && <button aria-label="切换战斗视角" onClick={() => engine.current?.toggleCombatCamera()}>V · {hud.combat.closeCamera ? '俯瞰' : '近身'}</button>}<button aria-label={muted ? '开启音效' : '关闭音效'} onClick={() => { if (engine.current) { engine.current.sound.muted = !muted; setMuted(!muted) } }}>{muted ? '音 ×' : '音 ♪'}</button><button aria-label="暂停" onClick={() => engine.current?.togglePause()}>Ⅱ</button></div>
      </header>
      <section className="world-objective"><small>{hud?.army.field ? '两军交锋' : hud?.activeStory ? `乡里人情 · ${hud.activeStory.name}` : selected === null ? '天下来信' : KIND_NAMES[orderFor(props.event, selected).kind]}</small><h1>{activityTitle}</h1><p>{hud?.objective}</p>{hud?.army.available && <button className="battle-launch" onClick={() => engine.current?.startFieldBattle()}>出城迎战 · 率军出击 →</button>}{hud?.orderKind === 'assault' && <div className="army-controls"><div><b>青旗 · 我军 {hud.army.allies}</b><b>赤旗 · 敌军 {hud.army.enemies}</b></div><p>长枪接敌 · 弓手掩护 · 绕侧破盾</p><nav aria-label="军令">{COMMANDS.map(command => <button key={command.id} aria-pressed={hud.army.command === command.id} onClick={() => engine.current?.commandArmy(command.id)}><kbd>{command.key}</kbd>{command.label}</button>)}</nav></div>}{hud && hud.orderRequired > 0 && <div className="order-dots">{Array.from({ length: hud.orderRequired }, (_, i) => <i className={i < hud.orderProgress ? 'done' : ''} key={i} />)}</div>}{hud?.orderKind === 'relief' && <details className="delivery-route"><summary>配送清单 · 已送 {hud.orderProgress} / {hud.deliveries.length}</summary><div>{hud.deliveries.map((stop, index) => <button key={index} disabled={stop.complete} aria-pressed={stop.target && !stop.complete} onClick={() => engine.current?.selectDelivery(index)}>{stop.complete ? '✓ ' : stop.target ? '➤ ' : ''}{stop.name}</button>)}</div><small>点选路线；靠近任一未送达地点都可交付。</small></details>}{hud && !hud.orderKind && <details className="village-contacts"><summary>乡里人情{hud.contacts.some(c => c.available) ? ' · 有人等你' : ''}</summary>{hud.contacts.map(c => <button key={c.id} aria-pressed={c.tracked} onClick={() => engine.current?.trackContact(c.id)}><b>{c.name}</b><span>{c.available ? '新委托' : c.completed ? '再叙旧事' : '认识一下'}{c.tracked ? ' · 已标记' : ''}</span></button>)}</details>}</section>
      <aside className="world-map" aria-label="天下舆图"><svg viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} role="img" aria-label="建筑与当前位置"><rect width={WORLD.width} height={WORLD.height} fill="#24382d" /><path d={mapRoads} fill="none" stroke="#a38e5f" strokeWidth="18" />{hud?.cities.map(city => <g key={city.name}><rect x={city.x - 38} y={city.y - 38} width="76" height="76" fill={city.owned ? '#8cc3a0' : '#d7b16e'} /><text x={city.x} y={city.y + 120} textAnchor="middle" fill="#e4d9b5" fontSize="85">{city.name}</text></g>)}{hud?.deliveries.map((stop, i) => <g key={`delivery-${i}`}><circle cx={stop.x} cy={stop.y} r="32" fill={stop.complete ? "#8cc3a0" : stop.target ? "#fff0a5" : "#cda373"} /><text x={stop.x} y={stop.y + 85} textAnchor="middle" fill="#fff0d3" fontSize="58">{stop.name}</text></g>)}{hud?.contacts.filter(c => c.available || c.tracked).map(c => <g key={c.id}><path d={`M${c.x} ${c.y-35}l30 35-30 35-30-35Z`} fill={c.tracked ? '#fff0a5' : '#8ad7c5'} /><text x={c.x} y={c.y+100} textAnchor="middle" fill="#fff0d3" fontSize="62">{c.name}</text></g>)}{hud?.army.units.map((unit, i) => <g key={`unit-${i}`}><circle cx={unit.x} cy={unit.y} r="15" fill={unit.friendly ? '#8de4d0' : '#f07358'} /></g>)}{hud && <circle cx={hud.player.x} cy={hud.player.y} r="40" fill="#fff5d0" stroke="#af493b" strokeWidth="16" />}</svg><small>同一片天下 · 步行抵达</small></aside>
      {hud?.notice && <p className="world-notice" role="status">{hud.notice}</p>}
      {hud?.orderKind === 'ceremony' && hud.carrying && <div className="ritual-meter"><span>按住 E / 交互，金色区间内松开</span><div><i /><b style={{ left: `${hud.ritual * 100}%` }} /></div></div>}
      <footer className="world-bottom"><div className="world-vitals"><span>气血 <b>{hud?.hp ?? 0} / {hud?.maxHp ?? 0}</b></span><div><i style={{ width: `${hud ? hud.hp / hud.maxHp * 100 : 100}%` }} /></div><small>J 挥刀 · K 招架 · V 切换视角 · 第三击破盾 · 红色为敌方预警</small></div><div className="world-actions"><button className="interact-button" disabled={!hud?.canInteract} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.interact() }} onPointerUp={() => engine.current?.releaseInteract()} onPointerCancel={() => engine.current?.releaseInteract()} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) engine.current?.interact() }} onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') engine.current?.releaseInteract() }}><kbd>E</kbd>{hud?.interactLabel ?? '交互'}</button>{([{ id: 'dash', key: '空格', name: '闪避' }, { id: 'storm', key: 'Q', name: '横扫' }, { id: 'volley', key: 'R', name: '齐射' }] as const).map(item => <button key={item.id} disabled={(hud?.cooldowns[item.id] ?? 0) > 0} onClick={() => skill(item.id)}><kbd>{item.key}</kbd>{(hud?.cooldowns[item.id] ?? 0) > 0 ? `${hud!.cooldowns[item.id].toFixed(1)}秒` : item.name}</button>)}</div></footer>
      {hud && (hud.enemyCount > 0 || hud.orderKind === 'assault') && <CombatControls combat={hud.combat} attack={held => engine.current?.setAttack(held)} guard={held => engine.current?.setGuard(held)} />}
      <div className="world-stick" role="group" aria-label="触摸摇杆" onPointerDown={e => { if (stickPointer.current !== null) return; stickPointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); moveStick(e) }} onPointerMove={moveStick} onPointerUp={stopStick} onPointerCancel={stopStick} onLostPointerCapture={stopStick}><i style={{ transform: `translate(${stick.x * 35}px, ${stick.y * 35}px)` }} /><span>移动</span></div>
      <div className="world-help">W A S D 移动 · E 交互 / 交谈 · 左键挥刀 · 右键招架 · 拖动或 Z C 转视角 · Esc 暂停</div>
    </div>
    {isModal && <section className="world-modal" role="dialog" aria-modal="true" aria-label={props.ending ? '王朝结局' : hud?.status === 'decision' ? props.event.title : '天下议事'} onKeyDown={modalKey}>
      <div className="world-dialog">
      {props.ending ? <><small>史官落笔 · {props.ending.victory ? '新朝已立' : '天命未成'}</small><h2>{props.ending.title}</h2><p>{props.ending.text}</p>{props.ending.unlocked && <p>新君王已解锁：{props.ending.unlocked}</p>}<button ref={buttonRef} className="world-primary" onClick={props.onExit}>返回君王选择</button></> : hud?.status === 'story' && hud.story ? <StoryDialog story={hud.story} firstButton={buttonRef} onChoose={id => engine.current?.beginStory(id)} onClose={() => engine.current?.closeStory()} /> : hud?.status === 'decision' ? <>
        <small>{props.event.phase} · {props.event.source}</small><h2>{props.event.title}</h2><p>{props.event.body}</p><FoundingGoal resources={props.resources} /><HistoricalContext eventId={props.event.id} />
        <div className="world-options">{props.event.options.map((option, index) => <button ref={index === 0 ? buttonRef : undefined} key={index} onClick={() => select(index)}><b>{option.label}</b><span>{describeEffect(option.reward ?? option.effect, props.event.phase)}</span><em>{KIND_NAMES[orderFor(props.event, index).kind]} · 亲自执行 →</em></button>)}</div>
        {!props.activeUsed && <button className="world-secondary" onClick={props.onActive}>君王专属 · {props.active}</button>}
        <button className="world-quiet" onClick={() => engine.current?.closeDecision()}>离开对话，回到世界</button>{hud.army.available && <button className="world-primary" onClick={() => engine.current?.startFieldBattle()}>出城迎战 · 率军实战 →</button>}
      </> : hud?.status === 'audience' && hud.councilAudience ? <><small>朝野交涉 · {hud.orderProgress + 1} / 3</small><h2>{hud.councilAudience.name}</h2><p>关于「{selected === null ? '' : props.event.options[selected].label}」：</p><blockquote>{hud.councilAudience.concern}</blockquote><p className="council-readout">已得 {hud.councilSupport} / 2 方支持 · 尚可筹措 {hud.councilBudget} 次</p><div className="world-options">
        <button ref={buttonRef} onClick={() => engine.current?.answerAudience('appeal')}><b>{hud.councilAudience.appeal}</b><span>{hud.councilAudience.reason}不额外动用府库。</span></button>
        <button disabled={hud.councilBudget <= 0} onClick={() => engine.current?.answerAudience('concede')}><b>{hud.councilAudience.concession}</b><span>{hud.councilBudget > 0 ? '确定获得支持；占用一次筹措，结算时国库略有损耗。' : '本次筹措已用尽，或府库无力承担。'}</span></button>
        <button onClick={() => engine.current?.answerAudience('defer')}><b>暂不承诺，保留府库</b><span>此方保留意见；至少两方支持即可通过。</span></button>
      </div></> : hud?.status === 'orderdone' ? <><small>{hud.army.field ? '两军战报' : '政令回报'}</small><h2>{hud.orderSuccess ? '此事已办妥' : '执行受挫'}</h2><p>「{activityTitle}」{hud.army.field ? hud.orderSuccess ? '敌阵已破，关旗已夺。我军已经控制关隘；回村继续处理政务。' : '此战失利，先收拢队伍回村。等待中的政务仍需你来决断。' : hud.activeStory ? hud.orderSuccess ? '已经办妥。它留下的变化与这段乡里人情，会伴随你继续巡视。' : '这次没能办成。先照顾回来的人，再回到尚待决断的政务。' : hud.orderSuccess ? '已在这片土地上付诸行动。返回政务，查看它对王朝的影响。' : '未能如愿。此次损失将影响国势，天下仍待你继续经营。'}</p>{hud.orderKind === 'council' && <p className="council-readout">{hud.councilSupport} 方支持 · 已承诺 {hud.councilSpent} 项拨款。{hud.councilSpent > 0 ? '无论议事成败，拨款都将随本次政令结算。' : '本次未额外动用府库。'}</p>}{hud.activeStory?.result && <blockquote>{hud.activeStory.result}</blockquote>}{hud.worldChange && <p className="world-change">村中变化 · {hud.worldChange}</p>}<button ref={buttonRef} className="world-primary" onClick={finish}>{hud.army.field ? '收兵，回到世界 →' : hud.activeStory ? '记下乡里故事，继续巡视 →' : '记入起居注，继续巡视 →'}</button></> : <><small>天下暂歇</small><h2>{leaving ? '返回君王选择？' : '已暂停'}</h2>{leaving ? <><p>当前王朝的进度不会保留；已解锁的君王仍在。</p><button ref={buttonRef} className="world-primary" onClick={() => setLeaving(false)}>留在此局</button><button className="world-secondary" onClick={props.onExit}>结束本局并返回</button></> : <><p>WASD / 方向键移动，J 挥刀（可按住连击），K 招架（迎击瞬间架开可反击），空格闪避，Q 横扫，R 弓手齐射；1 进攻、2 跟随、3 坚守。E 交互；走近村民按 E 交谈。鼠标左键挥刀、按住右键招架；拖动画面或按 Z / C 旋转视角，滚轮缩放，V 切换近身 / 俯瞰。手机用左下摇杆和右下按钮，单指拖动画面转视角，双指缩放。你的每个决定都会留在村子里。</p><FoundingGoal resources={props.resources} /><button ref={buttonRef} className="world-primary" onClick={() => { setJournal(false); engine.current?.togglePause() }}>继续巡视</button><button className="world-secondary" onClick={() => setJournal(!journal)}>查看起居注</button>{journal && <div className="world-journal">{props.log.map((line, i) => <p key={i}>{line}</p>)}{Boolean(hud?.storyLog.length) && <><b>乡里旧事</b>{hud?.storyLog.map((line, i) => <p key={`story-${i}`}>{line}</p>)}</>}</div>}<button className="world-quiet" onClick={() => setLeaving(true)}>返回君王选择</button></>}</>}
      </div>
    </section>}
  </main>
}
