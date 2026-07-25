import { FORGE, MetaState, forgeCost, swordLevel } from '../game/types'

interface Props {
  meta: MetaState
  onBuy: (id: string) => void
  onStart: () => void
}

export default function MetaScreen({ meta, onBuy, onStart }: Props) {
  const lvl = swordLevel(meta)
  return (
    <div className="menu-scroll">
      <div className="menu">
        <h1 className="title">⚔️ Sword of the Depths</h1>
        <p className="tagline">A one-hero arena roguelike. Forge your blade — then descend.</p>

        <div className="sword-panel">
          <div className="sword-big">🗡️</div>
          <div className="sword-meta">
            <div className="sword-lvl">Sword Level {lvl}</div>
            <div className="sword-essence">🔮 {meta.essence} Essence</div>
            <div className="sword-stats">
              Best Wave {meta.bestWave} · {meta.totalKills} kills · {meta.runs} runs
            </div>
          </div>
          <button className="play-btn" onClick={onStart}>▶ Descend</button>
        </div>

        <h2 className="forge-title">🔥 The Forge — permanent upgrades</h2>
        <p className="forge-note">
          Every level poured into your sword makes the depths deadlier — enemies scale to match your power.
        </p>
        <div className="forge-grid">
          {FORGE.map((u) => {
            const level = meta.forge[u.id]
            const maxed = level >= u.maxLevel
            const cost = forgeCost(u, level)
            const affordable = meta.essence >= cost
            return (
              <div key={u.id} className="forge-item">
                <div className="forge-icon">{u.icon}</div>
                <div className="forge-info">
                  <div className="forge-name">
                    {u.name} <span className="forge-lvl">Lv {level}/{u.maxLevel}</span>
                  </div>
                  <div className="forge-desc">{u.description}</div>
                </div>
                <button
                  className="forge-buy"
                  disabled={maxed || !affordable}
                  onClick={() => onBuy(u.id)}
                >
                  {maxed ? 'MAX' : `🔮 ${cost}`}
                </button>
              </div>
            )
          })}
        </div>

        <div className="how-to">
          <h3>How to play</h3>
          <ul>
            <li><b>WASD / Arrows</b> — move · <b>Mouse</b> — aim · survive the endless horde as long as you can</li>
            <li>Your <b>sword swings automatically</b> in wide dynamic sweeps — just position yourself in the swarm</li>
            <li>Slain beasts drop <b>XP gems</b> that fly to you — grab them to <b>level up fast</b> and draft upgrades</li>
            <li><b>Q</b> Dash · <b>SPACE</b> Whirlwind · <b>E / Left-click</b> Fireball</li>
            <li><b>R</b> Meteor Storm (ultimate, aim with mouse) · <b>F</b> Battle Heal + shield</li>
            <li>Roam a <b>large 4-region world</b> — dungeon, forest, snow & volcano — each with its own beasts (see the minimap)</li>
            <li>Every run you're handed a <b>randomly forged sword</b> (steel, ember, stone, frost or storm) with its own look & bonus</li>
            <li>Kill enemies → <b>level up</b> → draft an upgrade card (1/2/3); hunt glowing <b>elite beasts</b> for bonus Essence</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
