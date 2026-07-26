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
        <p className="tagline">
          Fight off waves of monsters, level up, and see how long you can survive!
        </p>

        <div className="sword-panel">
          <div className="sword-big">🗡️</div>
          <div className="sword-meta">
            <div className="sword-lvl">Sword Level {lvl}</div>
            <div className="sword-essence">🪙 {meta.essence} Coins</div>
            <div className="sword-stats">
              {meta.runs === 0
                ? 'Your first game awaits — good luck!'
                : `Best game: wave ${meta.bestWave} · ${meta.totalKills} monsters beaten · ${meta.runs} games played`}
            </div>
          </div>
          <button className="play-btn" onClick={onStart}>▶ Start Game</button>
        </div>

        <h2 className="forge-title">🛠️ Permanent Upgrades</h2>
        <p className="forge-note">
          Spend the coins you earn to make your hero permanently stronger. These upgrades carry
          over to every game, so you get a little further each time.
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
                    {u.name} <span className="forge-lvl">Level {level} of {u.maxLevel}</span>
                  </div>
                  <div className="forge-desc">{u.description}</div>
                </div>
                <button
                  className="forge-buy"
                  disabled={maxed || !affordable}
                  onClick={() => onBuy(u.id)}
                >
                  {maxed ? 'MAX' : `🪙 ${cost}`}
                </button>
              </div>
            )
          })}
        </div>

        <div className="how-to">
          <h3>How to play</h3>
          <ul>
            <li><b>Move</b> with the <b>WASD</b> or <b>arrow</b> keys — on a phone, just <b>drag anywhere</b> to move.</li>
            <li>Your <b>sword attacks by itself</b> — steer your hero into the monsters and it does the rest.</li>
            <li>Beaten monsters drop <b>glowing gems</b>. Walk over them to collect and <b>level up</b>.</li>
            <li>Each level, <b>pick a new weapon or an upgrade</b> to slowly build an unstoppable hero.</li>
            <li>Grab items on the ground: <b>❤️ health, 🧲 magnet, 💣 bomb, ⏱️ freeze, 🎁 treasure</b>.</li>
            <li>A <b>big boss appears every 5 levels</b> — the game keeps getting harder, so keep leveling up!</li>
            <li>Extra skills: <b>Q</b> Dash · <b>Space</b> Whirlwind · <b>E</b> Fireball · <b>R</b> Meteor · <b>F</b> Heal (tap the buttons on a phone).</li>
            <li>Need a break? <b>Pause</b> with the <b>⏸</b> button or the <b>P</b> key.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
