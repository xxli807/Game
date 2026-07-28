import { HudState, SKILLS } from '../game/types'

export default function HUD({ state, onAbility }: { state: HudState; onAbility: (key: string) => void }) {
  const hpPct = (state.hp / state.maxHp) * 100
  const ragePct = (state.rage / state.maxRage) * 100
  const stagePct = (state.stageKills / state.stageEnemyTotal) * 100
  const remaining = Math.max(0, state.stageEnemyTotal - state.stageKills)

  const mm = Math.floor(state.time / 60)
  const ss = Math.floor(state.time % 60)

  return (
    <>
      {/* full-width progress for the current finite stage */}
      <div className={`stage-strip${state.bossStage ? ' stage-strip-boss' : ''}`}>
        <div className="stage-strip-fill" style={{ width: `${Math.max(0, Math.min(100, stagePct))}%` }} />
        <span className="stage-strip-label">
          {state.bossStage ? 'BOSS ' : ''}STAGE {state.stage} · {state.stageKills}/{state.stageEnemyTotal}
        </span>
      </div>

      {/* survival clock */}
      <div className="clock">{mm}:{ss.toString().padStart(2, '0')}</div>

      {/* top-left vitals */}
      <div className="hud-top">
        <div className="vitals">
          <Bar className="hp" pct={hpPct} label={`❤️ ${state.hp}/${state.maxHp}`} />
          <Bar
            className={state.resourceName === 'Mana' ? 'mana' : 'rage'}
            pct={ragePct}
            label={`${state.resourceName === 'Mana' ? '💧' : '🔥'} ${state.resourceName.toUpperCase()} ${state.rage}/${state.maxRage}`}
          />
        </div>
        <div className="weapons">
          {state.skills.map((skill) => {
            const definition = SKILLS[skill.id]
            return (
            <div key={skill.id} className="weapon-chip" title={`${definition.name} · Level ${skill.level}`}>
              <span className="weapon-icon">{definition.icon}</span>
              <span className="weapon-lvl">{skill.level}</span>
            </div>
            )
          })}
        </div>
      </div>

      {/* top-right run info */}
      <div className="hud-info">
        <div className="chip">⚔️ {state.className}</div>
        <div className="chip">👹 {remaining} remaining</div>
        <div className="chip">📍 {state.biome}</div>
        <div className="chip">💀 {state.kills}</div>
        <div className="chip">🪙 {state.gold}</div>
        <div className="chip chip-sword">
          {state.className === 'Mage'
            ? `🪄 Arcane Focus · T${state.swordTier}`
            : `${state.swordStyleIcon} ${state.swordStyleName} · T${state.swordTier}`}
        </div>
      </div>

      {/* ability bar */}
      <div className="ability-bar">
        {state.abilities.map((a) => {
          const ready = a.cdLeft <= 0.001
          const pct = a.cdMax > 0 ? (a.cdLeft / a.cdMax) * 100 : 0
          return (
            <button
              key={a.key}
              className={`ability ${ready ? 'ready' : ''}${state.rage < a.rageCost ? ' unaffordable' : ''}`}
              onPointerDown={(e) => { e.preventDefault(); onAbility(a.key) }}
            >
              <div className="ability-icon">{a.icon}</div>
              {!ready && <div className="ability-cd" style={{ height: `${pct}%` }} />}
              {!ready && <div className="ability-cd-text">{a.cdLeft.toFixed(1)}</div>}
              <div className="ability-key">{a.key}</div>
              <div className="ability-rage">{a.rageCost}</div>
            </button>
          )
        })}
      </div>
    </>
  )
}

function Bar({ pct, label, className, thin }: { pct: number; label: string; className: string; thin?: boolean }) {
  return (
    <div className={`stat-bar ${thin ? 'thin' : ''}`}>
      <div className={`stat-fill ${className}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      <span className="stat-label">{label}</span>
    </div>
  )
}
