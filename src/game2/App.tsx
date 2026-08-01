import { useEffect, useRef, useState } from 'react'
import { GameEngine, WIDTH, HEIGHT } from './game/engine'
import { baseStats, ClassId, HudState, MetaState } from './game/types'
import { loadMeta, saveMeta } from './game/meta'
import HUD from './components/HUD'
import LevelUpModal from './components/LevelUpModal'
import MetaScreen from './components/MetaScreen'
import Dialogue from './components/Dialogue'
import { StoryEvent, DEATH_LINES, VICTORY_LINES, randomLine } from './game/story'

export default function App() {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta())
  const [inRun, setInRun] = useState(false)
  const [classId, setClassId] = useState<ClassId>('warrior')

  const handleStageCleared = (stage: number) => {
    setMeta((m) => {
      if (stage <= m.bestStage) return m
      const next = { ...m, bestStage: stage }
      saveMeta(next)
      return next
    })
  }

  const handleRunEnd = (r: { clearedStage: number; kills: number }) => {
    setMeta((m) => {
      const next: MetaState = {
        ...m,
        bestStage: Math.max(m.bestStage, r.clearedStage),
        totalKills: m.totalKills + r.kills,
        runs: m.runs + 1,
      }
      saveMeta(next)
      return next
    })
  }

  if (!inRun) {
    return (
      <div className="app">
        <MetaScreen meta={meta} classId={classId} onClassChange={setClassId} onStart={() => setInRun(true)} />
      </div>
    )
  }

  return (
    <div className="app">
      <GameScreen
        classId={classId}
        onStageCleared={handleStageCleared}
        onRunEnd={handleRunEnd}
        onExit={() => setInRun(false)}
      />
    </div>
  )
}

function GameScreen({
  classId,
  onStageCleared,
  onRunEnd,
  onExit,
}: {
  classId: ClassId
  onStageCleared: (stage: number) => void
  onRunEnd: (r: { clearedStage: number; kills: number }) => void
  onExit: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const endedRef = useRef(false)
  const [hud, setHud] = useState<HudState | null>(null)

  // Cael's story dialogue: queued events, shown one at a time; the world pauses while one is up.
  const [story, setStory] = useState<StoryEvent | null>(null)
  const storyQueue = useRef<StoryEvent[]>([])
  const storyActive = useRef(false)
  const popStory = () => {
    const next = storyQueue.current.shift()
    if (next) { storyActive.current = true; setStory(next); engineRef.current?.pause() }
    else { storyActive.current = false; setStory(null); engineRef.current?.resume() }
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
      stats: baseStats(),
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
          onPick={(id) => engineRef.current?.chooseCard(id)}
        />
      )}

      {story && <Dialogue event={story} onDone={popStory} />}

      {hud?.status === 'paused' && !story && (
        <div className="overlay">
          <div className="death-card">
            <h1>⏸ Paused</h1>
            <p>Stage <b>{hud.stage}</b> · <b>{hud.kills}</b> monsters beaten</p>
            <button className="play-btn" onClick={() => engineRef.current?.resume()}>▶ Resume</button>
            <button className="exit-btn-inline" onClick={onExit}>Quit to Menu</button>
          </div>
        </div>
      )}

      {hud?.status === 'dead' && (
        <div className="overlay">
          <div className="death-card">
            <h1>💀 You Fell</h1>
            <p className="cael-line">“{randomLine(DEATH_LINES)}”<br /><span className="cael-tag">— Cael</span></p>
            <p>You reached <b>Stage {hud.stage}</b> and laid <b>{hud.runKills}</b> of the Hollow to rest.</p>
            <p className="death-hint">The Ember calls you back. Descend again.</p>
            <button className="play-btn" onClick={onExit}>🔥 Back to the Ember</button>
          </div>
        </div>
      )}

      {hud?.status === 'victory' && (
        <div className="overlay">
          <div className="death-card victory-card">
            <h1>👑 Aldermere Reclaimed</h1>
            <p className="cael-line">“{VICTORY_LINES[0]}”<br />“{VICTORY_LINES[1]}”<br /><span className="cael-tag">— Cael</span></p>
            <p>You cleared all <b>{hud.stage}</b> stages and took back the throne.</p>
            <button className="play-btn" onClick={onExit}>🏰 Return to the Ember</button>
          </div>
        </div>
      )}

      {hud && hud.status !== 'dead' && hud.status !== 'victory' && !story && (
        <button className="pause-btn" onClick={() => engineRef.current?.togglePause()}>
          {hud.status === 'paused' ? '▶' : '⏸'}
        </button>
      )}
      <button className="fs-btn" onClick={toggleFullscreen} title="Fullscreen">⛶</button>
      <button className="exit-btn" onClick={onExit}>✕</button>
    </div>
    </div>
  )
}
