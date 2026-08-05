import { HudState, SKILLS } from '../game/types'

export default function HUD({ state, onAbility }: { state: HudState; onAbility: (key: string) => void }) {
  // AoE can kill several at once, so clamp the display to the quota
  const shownKills = Math.min(state.stageKills, state.stageEnemyTotal)
  const stagePct = (shownKills / state.stageEnemyTotal) * 100
  const remaining = Math.max(0, state.stageEnemyTotal - shownKills)

  const mm = Math.floor(state.time / 60)
  const ss = Math.floor(state.time % 60)

  return (
    <>
      {/* full-width progress for the current finite stage */}
      <div className={`stage-strip${state.bossStage ? ' stage-strip-boss' : ''}`}>
        <div className="stage-strip-fill" style={{ width: `${Math.max(0, Math.min(100, stagePct))}%` }} />
        <span className="stage-strip-label">
          {state.bossStage ? '☠ 层主 · ' : ''}第 {state.stage}/{state.finalStage} 关 · {shownKills}/{state.stageEnemyTotal}
        </span>
      </div>

      {/* kill streak — climbs as you chain kills, drains when you stop */}
      {state.combo >= 3 && (
        <div className={`combo${state.combo >= 15 ? ' combo-hot' : ''}`}>
          <div className="combo-count">{state.combo}<span>×</span></div>
          <div className="combo-bar"><div className="combo-fill" style={{ width: `${state.comboPct * 100}%` }} /></div>
        </div>
      )}

      {/* survival clock */}
      <div className="clock">{mm}:{ss.toString().padStart(2, '0')}</div>

      {/* top-left loadout (health & resource render on the character itself) */}
      <div className="hud-top">
        <div className="weapons">
          {state.skills.map((skill) => {
            const definition = SKILLS[skill.id]
            return (
            <div key={skill.id} className="weapon-chip" title={`${definition.name} · 等级 ${skill.level}`}>
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
        <div className="chip">👹 剩余 {remaining}</div>
        <div className="chip chip-depth" title="你已下潜到第几层">
          🕯️ 第 {state.depth}/{state.maxDepth} 层 · {state.biome}
        </div>
        <div className="chip">💀 {state.kills}</div>
        {state.classId === 'necromancer' && <div className="chip">☠️ 已召唤 {state.minionCount}</div>}
        <div className="chip">🪙 {state.gold}</div>
        <div className="chip chip-sword">
          {state.classId === 'mage'
            ? `🪄 奥术法器 · ${state.swordTier} 阶`
            : state.classId === 'necromancer'
              ? `💀 骸骨法器 · ${state.swordTier} 阶`
            : `${state.swordStyleIcon} ${state.swordStyleName} · ${state.swordTier} 阶`}
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

