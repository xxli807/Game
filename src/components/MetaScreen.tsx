import { MetaState } from '../game/types'

interface Props {
  meta: MetaState
  onStart: () => void
}

export default function MetaScreen({ meta, onStart }: Props) {
  return (
    <div className="menu-scroll">
      <div className="menu">
        <h1 className="title">⚔️ Sword of the Depths</h1>
        <p className="tagline">
          Clear enemy stages, build a five-skill loadout, and conquer every tenth-stage boss!
        </p>

        <div className="sword-panel">
          <div className="sword-big">🗡️</div>
          <div className="sword-meta">
            <div className="sword-lvl">⚔️ Warrior · Five-Skill Survival</div>
            <div className="sword-stats">
              {meta.runs === 0
                ? 'Your first game awaits — good luck!'
                : `Highest stage cleared: ${meta.bestStage} · ${meta.totalKills} monsters beaten · ${meta.runs} games played`}
            </div>
          </div>
          <button className="play-btn" onClick={onStart}>▶ Start Game</button>
        </div>

        <h2 className="forge-title">⚡ Build Your Skills Each Run</h2>
        <p className="forge-note">
          Every cleared stage offers three new or upgraded Warrior skills. You can hold five skills total.
          Discover branching combinations of two or three skills to unlock powerful evolutions.
        </p>

        <div className="how-to">
          <h3>How to play</h3>
          <ul>
            <li><b>Move</b> with the <b>WASD</b> or <b>arrow</b> keys — on a phone, just <b>drag anywhere</b> to move.</li>
            <li>Your <b>sword attacks by itself</b> — steer your hero into the monsters and it does the rest.</li>
            <li>Chop monsters down to gain <b>Rage</b>. Warrior skills consume Rage, which resets to zero every stage.</li>
            <li>Base Warrior skills have <b>no cooldown</b>; Rage is their only casting limit.</li>
            <li>Each stage has a <b>fixed number of monsters</b>. Beat them all to advance.</li>
            <li>After every stage, <b>pick one of three skills</b>. New skills and upgrades share the same five slots.</li>
            <li>Some groups of <b>two or three skills combine</b>, consuming their ingredients and freeing loadout slots.</li>
            <li>Grab items on the ground: <b>❤️ health, 🧲 magnet, 💣 bomb, ⏱️ freeze, 🎁 treasure</b>.</li>
            <li>Stages <b>10, 20, 30, and beyond</b> contain one powerful boss monster.</li>
            <li>Active skills use <b>Q</b>, <b>E</b>, <b>Space</b>, <b>R</b>, and <b>F</b> in skill-slot order.</li>
            <li>Need a break? <b>Pause</b> with the <b>⏸</b> button or the <b>P</b> key.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
