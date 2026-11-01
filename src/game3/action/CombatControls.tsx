import type { Snapshot } from './model'

export function CombatControls({ combat, attack, guard }: { combat: Snapshot['combat']; attack: (held: boolean) => void; guard: (held: boolean) => void }) {
  return <div className="combat-controls" aria-label="近战操作">
    <div className="guard-stamina" role="meter" aria-label="招架体力" aria-valuemin={0} aria-valuemax={100} aria-valuenow={combat.stamina}><i style={{ width: `${combat.stamina}%` }} /><span>{combat.counter ? '架开！挥刀反击' : combat.guarding ? '招架中' : '挥刀连击 · 迎击招架'}</span></div>
    {([{ key: 'J', label: '挥刀', action: attack }, { key: 'K', label: '招架', action: guard }] as const).map(item => <button key={item.key} className={item.key === 'J' ? 'combat-strike' : 'combat-guard'} aria-label={item.label} aria-pressed={item.key === 'K' ? combat.guarding : undefined}
      onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); item.action(true) }}
      onPointerUp={() => item.action(false)} onPointerCancel={() => item.action(false)} onLostPointerCapture={() => item.action(false)}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); item.action(true) } }}
      onKeyUp={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.action(false) } }}
      onBlur={() => item.action(false)}><kbd>{item.key}</kbd>{item.label}</button>)}
  </div>
}
