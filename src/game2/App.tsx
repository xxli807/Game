import { useEffect, useRef, useState } from 'react'
import { GameEngine, WIDTH, HEIGHT } from './game/engine'
import { ClassId, HudState, MetaState, META_UPGRADES, statsFromMeta, upgradeCost, embersEarned } from './game/types'
import { loadMeta, saveMeta } from './game/meta'
import HUD from './components/HUD'
import LevelUpModal from './components/LevelUpModal'
import MetaScreen from './components/MetaScreen'
import Dialogue from './components/Dialogue'
import QuizModal from './components/QuizModal'
import { QuizQuestion, QuizRunner, QUIZ_INTERVAL, shouldAskNow } from './game/quiz'
import { audio } from './game/audio'
import {
  StoryEvent, DEATH_LINES, VICTORY_LINES, randomLine,
  depthForStage, isLordStage, layerForStage, FINAL_STAGE,
} from './game/story'

export default function App() {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta())
  const [inRun, setInRun] = useState(false)
  const [learnMode, setLearnMode] = useState(false)
  const [classId, setClassId] = useState<ClassId>('warrior')

  // Record story progress as the descent happens: how deep, which champions
  // are at rest, and (on the final stage) the kingdom reclaimed.
  const handleStageCleared = (stage: number) => {
    setMeta((m) => {
      const layer = layerForStage(stage)
      const next: MetaState = {
        ...m,
        bestStage: Math.max(m.bestStage, stage),
        deepestLayer: Math.max(m.deepestLayer, depthForStage(stage)),
        lordsLaidToRest: isLordStage(stage) && !m.lordsLaidToRest.includes(layer.relic.key)
          ? [...m.lordsLaidToRest, layer.relic.key]
          : m.lordsLaidToRest,
        victories: stage >= FINAL_STAGE ? m.victories + 1 : m.victories,
      }
      saveMeta(next)
      return next
    })
  }

  const handleRelicFound = (key: string) => {
    setMeta((m) => {
      if (m.relicsFound.includes(key)) return m
      const next = { ...m, relicsFound: [...m.relicsFound, key] }
      saveMeta(next)
      return next
    })
  }

  const [earned, setEarned] = useState(0)

  const handleRunEnd = (r: { clearedStage: number; kills: number }) => {
    setMeta((m) => {
      // every descent pays out, win or lose — a failed run still moves you forward
      const won = r.clearedStage >= FINAL_STAGE
      const gained = embersEarned(m, r.clearedStage, r.kills, won)
      setEarned(gained)
      const next: MetaState = {
        ...m,
        bestStage: Math.max(m.bestStage, r.clearedStage),
        totalKills: m.totalKills + r.kills,
        runs: m.runs + 1,
        embers: m.embers + gained,
      }
      saveMeta(next)
      return next
    })
  }

  const buyUpgrade = (id: string) => {
    setMeta((m) => {
      const u = META_UPGRADES.find((x) => x.id === id)
      if (!u) return m
      const level = m.upgrades[id] ?? 0
      if (level >= u.maxLevel) return m
      const cost = upgradeCost(u, level)
      if (m.embers < cost) return m
      const next: MetaState = { ...m, embers: m.embers - cost, upgrades: { ...m.upgrades, [id]: level + 1 } }
      saveMeta(next)
      return next
    })
  }

  if (!inRun) {
    return (
      <div className="app">
        <MetaScreen
          meta={meta}
          classId={classId}
          onClassChange={setClassId}
          onBuy={buyUpgrade}
          lastEarned={earned}
          onStart={(learn) => { audio.resume(); audio.play('ui'); setLearnMode(learn); setInRun(true) }}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <GameScreen
        earned={earned}
        meta={meta}
        classId={classId}
        learnMode={learnMode}
        onStageCleared={handleStageCleared}
        onRelicFound={handleRelicFound}
        onRunEnd={handleRunEnd}
        onExit={() => setInRun(false)}
      />
    </div>
  )
}

function GameScreen({
  earned,
  meta,
  classId,
  learnMode,
  onStageCleared,
  onRelicFound,
  onRunEnd,
  onExit,
}: {
  earned: number
  meta: MetaState
  classId: ClassId
  learnMode: boolean
  onStageCleared: (stage: number) => void
  onRelicFound: (key: string) => void
  onRunEnd: (r: { clearedStage: number; kills: number }) => void
  onExit: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const endedRef = useRef(false)
  const [hud, setHud] = useState<HudState | null>(null)
  const [muted, setMuted] = useState(() => audio.isMuted())

  // 边玩边学：出题器、当前题目与本局战绩。关掉学习模式时这些全都不会用到。
  const quizRunner = useRef(new QuizRunner())
  const [quiz, setQuiz] = useState<{ question: QuizQuestion; opening: boolean } | null>(null)
  const [quizStats, setQuizStats] = useState({ asked: 0, correct: 0, best: 0 })
  const quizOpen = useRef(false)
  const nextQuizAt = useRef(QUIZ_INTERVAL)

  // Cael's story dialogue: queued events, shown one at a time; the world pauses while one is up.
  const [story, setStory] = useState<StoryEvent | null>(null)
  const storyQueue = useRef<StoryEvent[]>([])
  const storyActive = useRef(false)
  const popStory = () => {
    const next = storyQueue.current.shift()
    if (next) { storyActive.current = true; setStory(next); engineRef.current?.pause() }
    // 剧情播完了，但题目可能还开着——那就继续等答题，不要把世界放回去跑。
    else { storyActive.current = false; setStory(null); if (!quizOpen.current) engineRef.current?.resume() }
  }

  const askQuiz = () => {
    quizOpen.current = true
    setQuiz({ question: quizRunner.current.next(), opening: quizRunner.current.asked === 0 })
    engineRef.current?.pause()
  }

  const answerQuiz = (picked: number) => {
    if (!quiz) return
    const result = quizRunner.current.record(quiz.question, picked)
    engineRef.current?.studyBoon(result.correct)
    const r = quizRunner.current
    setQuizStats({ asked: r.asked, correct: r.correct, best: r.bestStreak })
  }

  const closeQuiz = () => {
    quizOpen.current = false
    setQuiz(null)
    // 从「现在」开始重新计时，而不是从上一次应该出题的时刻——否则暂停久了会连着弹好几道。
    nextQuizAt.current = (hud?.time ?? 0) + QUIZ_INTERVAL
    if (!storyActive.current) engineRef.current?.resume()
  }
  const pushStory = (e: StoryEvent) => {
    storyQueue.current.push(e)
    if (!storyActive.current) popStory()
  }

  const toggleFullscreen = () => {
    const el = wrapRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else el.requestFullscreen?.()
  }

  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new GameEngine(canvasRef.current, {
      stats: statsFromMeta(meta),
      classId,
      onState: setHud,
      onStageCleared,
      onStory: pushStory,
      onRunEnd: (r) => {
        if (endedRef.current) return
        endedRef.current = true
        onRunEnd(r)
      },
    })
    engineRef.current = engine
    return () => engine.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // remember relics of Aldermere recovered during the run
  useEffect(() => {
    for (const key of hud?.relics ?? []) onRelicFound(key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud?.relics?.length])

  // 开场那道题：引擎一建好就提问，答完才真正开始下潜。
  useEffect(() => {
    if (learnMode) askQuiz()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 之后每隔 QUIZ_INTERVAL 秒再来一题。只在正常游玩时打断：
  // 选技能、剧情、已死亡或已暂停的时候都不插队。
  useEffect(() => {
    if (!hud) return
    if (!shouldAskNow({
      learnMode,
      status: hud.status,
      time: hud.time,
      nextAt: nextQuizAt.current,
      quizOpen: quizOpen.current,
      storyActive: storyActive.current,
    })) return
    askQuiz()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud?.time, hud?.status])

  return (
    <div className="fs-wrap" ref={wrapRef}>
    <div className="game-frame">
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="game-canvas" />

      {hud && <HUD state={hud} onAbility={(key) => engineRef.current?.castAbility(key)} />}

      {hud?.status === 'skillselect' && (
        <LevelUpModal
          cards={hud.cards}
          skills={hud.skills}
          clearedStage={hud.stage}
          bonus={hud.bonusDraft}
          onPick={(id) => engineRef.current?.chooseCard(id)}
        />
      )}

      {story && !quiz && <Dialogue event={story} onDone={popStory} />}

      {quiz && (
        <QuizModal
          question={quiz.question}
          index={quizStats.asked}
          correctSoFar={quizStats.correct}
          streak={quizRunner.current.streak}
          opening={quiz.opening}
          onAnswer={answerQuiz}
          onDone={closeQuiz}
        />
      )}

      {hud?.status === 'paused' && !story && !quiz && (
        <div className="overlay">
          <div className="death-card">
            <h1>⏸ 已暂停</h1>
            <p>第 <b>{hud.stage}</b> 关 · 已击败 <b>{hud.kills}</b> 只怪物</p>
            <button className="play-btn" onClick={() => engineRef.current?.resume()}>▶ 继续</button>
            <button className="exit-btn-inline" onClick={onExit}>退出到主界面</button>
          </div>
        </div>
      )}

      {hud?.status === 'dead' && (
        <div className="overlay">
          <div className="death-card">
            <h1>💀 你倒下了</h1>
            <p className="cael-line">“{randomLine(DEATH_LINES)}”<br /><span className="cael-tag">— Cael</span></p>
            <p>你抵达了第 <b>{hud.stage}</b> 关，让 <b>{hud.runKills}</b> 个空蚀之物安息。</p>
            <p className="ember-earned">🔥 带回 {earned} 点余烬</p>
            {learnMode && quizStats.asked > 0 && (
              <p className="quiz-summary">📚 本局答题 {quizStats.correct}/{quizStats.asked} 正确{quizStats.best >= 2 ? ` · 最高连对 ${quizStats.best}` : ''}</p>
            )}
            <p className="death-hint">余烬在召唤你。花掉它们，然后再次下潜。</p>
            <button className="play-btn" onClick={onExit}>🔥 回到最后的余烬</button>
          </div>
        </div>
      )}

      {hud?.status === 'victory' && (
        <div className="overlay">
          <div className="death-card victory-card">
            <h1>👑 奥德米尔已夺回</h1>
            <p className="cael-line">“{VICTORY_LINES[0]}”<br />“{VICTORY_LINES[1]}”<br /><span className="cael-tag">— Cael</span></p>
            <p>你通关全部 <b>{hud.stage}</b> 关，夺回了王座。</p>
            <p className="ember-earned">🔥 +{earned} embers carried back</p>
            {learnMode && quizStats.asked > 0 && (
              <p className="quiz-summary">📚 本局答题 {quizStats.correct}/{quizStats.asked} 正确{quizStats.best >= 2 ? ` · 最高连对 ${quizStats.best}` : ''}</p>
            )}
            <button className="play-btn" onClick={onExit}>🏰 返回余烬营地</button>
          </div>
        </div>
      )}

      {hud && hud.status !== 'dead' && hud.status !== 'victory' && !story && !quiz && (
        <button className="pause-btn" onClick={() => engineRef.current?.togglePause()}>
          {hud.status === 'paused' ? '▶' : '⏸'}
        </button>
      )}
      <button className="mute-btn" onClick={() => { audio.resume(); setMuted(audio.toggleMute()) }} title={muted ? '取消静音' : '静音'}>{muted ? '🔇' : '🔊'}</button>
      <button className="fs-btn" onClick={toggleFullscreen} title="全屏">⛶</button>
      <button className="exit-btn" onClick={onExit}>✕</button>
    </div>
    </div>
  )
}
