import { useEffect, useRef, useState } from 'react'
import { GameEngine, WIDTH, HEIGHT } from './game/engine'
import {
  HudState,
  MetaState,
  statsFromMeta,
  swordLevel,
  FORGE,
  forgeCost,
  ForgeId,
} from './game/types'
import { loadMeta, saveMeta } from './game/meta'
import HUD from './components/HUD'
import LevelUpModal from './components/LevelUpModal'
import MetaScreen from './components/MetaScreen'

export default function App() {
  const [meta, setMeta] = useState<MetaState>(() => loadMeta())
  const [inRun, setInRun] = useState(false)

  const buyForge = (id: string) => {
    const u = FORGE.find((f) => f.id === id)!
    setMeta((m) => {
      const level = m.forge[id as ForgeId]
      if (level >= u.maxLevel) return m
      const cost = forgeCost(u, level)
      if (m.essence < cost) return m
      const next: MetaState = {
        ...m,
        essence: m.essence - cost,
        forge: { ...m.forge, [id]: level + 1 },
      }
      saveMeta(next)
      return next
    })
  }

  const handleRunEnd = (r: { wave: number; kills: number; essence: number }) => {
    setMeta((m) => {
      const next: MetaState = {
        ...m,
        essence: m.essence + r.essence,
        bestWave: Math.max(m.bestWave, r.wave),
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
        <MetaScreen meta={meta} onBuy={buyForge} onStart={() => setInRun(true)} />
      </div>
    )
  }

  return (
    <div className="app">
      <GameScreen meta={meta} onRunEnd={handleRunEnd} onExit={() => setInRun(false)} />
    </div>
  )
}

function GameScreen({
  meta,
  onRunEnd,
  onExit,
}: {
  meta: MetaState
  onRunEnd: (r: { wave: number; kills: number; essence: number }) => void
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
      stats: statsFromMeta(meta),
      swordLvl: swordLevel(meta),
      onState: setHud,
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

      {hud?.status === 'levelup' && (
        <LevelUpModal cards={hud.cards} onPick={(id) => engineRef.current?.chooseCard(id)} />
      )}

      {hud?.status === 'paused' && (
        <div className="overlay">
          <div className="death-card">
            <h1>⏸ Paused</h1>
            <p>Level <b>{hud.level}</b> · <b>{hud.kills}</b> monsters beaten</p>
            <button className="play-btn" onClick={() => engineRef.current?.resume()}>▶ Resume</button>
            <button className="exit-btn-inline" onClick={onExit}>Quit to Menu</button>
          </div>
        </div>
      )}

      {hud?.status === 'dead' && (
        <div className="overlay">
          <div className="death-card">
            <h1>💀 Game Over</h1>
            <p>You reached <b>Level {hud.level}</b> and beat <b>{hud.runKills}</b> monsters!</p>
            <p className="essence-earned">🪙 +{hud.essenceEarned} coins earned</p>
            <p className="death-hint">Spend your coins on upgrades to get further next time.</p>
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
