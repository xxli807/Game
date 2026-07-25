import { HudState } from '../game/types'

export default function HUD({ state, onAbility }: { state: HudState; onAbility: (key: string) => void }) {
  const hpPct = (state.hp / state.maxHp) * 100
  const mpPct = (state.mana / state.maxMana) * 100
  const xpPct = (state.xp / state.xpToNext) * 100

  const mm = Math.floor(state.time / 60)
  const ss = Math.floor(state.time % 60)

  return (
    <>
      {/* full-width XP bar across the very top (Vampire-Survivors style) */}
      <div className="xp-strip">
        <div className="xp-strip-fill" style={{ width: `${Math.max(0, Math.min(100, xpPct))}%` }} />
        <span className="xp-strip-label">LV {state.level}</span>
      </div>

      {/* survival clock */}
      <div className="clock">{mm}:{ss.toString().padStart(2, '0')}</div>

      {/* top-left vitals */}
      <div className="hud-top">
        <div className="vitals">
          <Bar className="hp" pct={hpPct} label={`❤️ ${state.hp}/${state.maxHp}`} />
          <Bar className="mp" pct={mpPct} label={`🔵 ${state.mana}/${state.maxMana}`} />
        </div>
      </div>

      {/* top-right run info */}
      <div className="hud-info">
        <div className="chip">📍 {state.biome}</div>
        <div className="chip">💀 {state.kills}</div>
        <div className="chip">🪙 {state.gold}</div>
        <div className="chip chip-sword">{state.swordStyleIcon} {state.swordStyleName} · T{state.swordTier}</div>
      </div>

      {/* ability bar */}
      <div className="ability-bar">
        {state.abilities.map((a) => {
          const ready = a.cdLeft <= 0.001
          const pct = a.cdMax > 0 ? (a.cdLeft / a.cdMax) * 100 : 0
          return (
            <button
              key={a.key}
              className={`ability ${ready ? 'ready' : ''}`}
              onPointerDown={(e) => { e.preventDefault(); onAbility(a.key) }}
            >
              <div className="ability-icon">{a.icon}</div>
              {!ready && <div className="ability-cd" style={{ height: `${pct}%` }} />}
              {!ready && <div className="ability-cd-text">{a.cdLeft.toFixed(1)}</div>}
              <div className="ability-key">{a.key}</div>
              <div className="ability-mana">{a.manaCost}</div>
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
