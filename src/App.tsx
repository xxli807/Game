import { useEffect, useRef, useState } from 'react'
import { GameEngine, WIDTH, HEIGHT } from './game/engine'
import { baseStats, HudState, MetaState } from './game/types'
import { loadMeta, saveMeta } from './game/meta'
import HUD from './components/HUD'
import LevelUpModal from './components/LevelUpModal'
import MetaScreen from './components/MetaScreen'

export default function App() {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta())
  const [inRun, setInRun] = useState(false)

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
        <MetaScreen meta={meta} onStart={() => setInRun(true)} />
      </div>
    )
  }

  return (
    <div className="app">
      <GameScreen
        onStageCleared={handleStageCleared}
        onRunEnd={handleRunEnd}
        onExit={() => setInRun(false)}
      />
    </div>
  )
}

function GameScreen({
  onStageCleared,
  onRunEnd,
  onExit,
}: {
  onStageCleared: (stage: number) => void
  onRunEnd: (r: { clearedStage: number; kills: number }) => void
  onExit: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const endedRef = useRef(false)
  const [hud, setHud] = useState<HudState | null>(null)

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
      onState: setHud,
      onStageCleared,
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

      {hud?.status === 'paused' && (
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
            <h1>💀 Game Over</h1>
            <p>You reached <b>Stage {hud.stage}</b> and beat <b>{hud.runKills}</b> monsters!</p>
            <p className="essence-earned">Stages cleared: {Math.max(0, hud.stage - 1)}</p>
            <p className="death-hint">Build a different five-skill loadout next run.</p>
            <button className="play-btn" onClick={onExit}>🏠 Back to Menu</button>
          </div>
        </div>
      )}

      {hud && hud.status !== 'dead' && (
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
