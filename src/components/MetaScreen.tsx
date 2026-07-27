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
          Fight off waves of monsters, level up, and see how long you can survive!
        </p>

        <div className="sword-panel">
          <div className="sword-big">🗡️</div>
          <div className="sword-meta">
            <div className="sword-lvl">Five-Skill Survival</div>
            <div className="sword-stats">
              {meta.runs === 0
                ? 'Your first game awaits — good luck!'
                : `Best monster level: ${meta.bestWave} · ${meta.totalKills} monsters beaten · ${meta.runs} games played`}
            </div>
          </div>
          <button className="play-btn" onClick={onStart}>▶ Start Game</button>
        </div>

        <h2 className="forge-title">⚡ Build Your Skills Each Run</h2>
        <p className="forge-note">
          Every level offers three new or upgraded skills. You can hold five skills total.
          Discover matching pairs to evolve them into stronger combined skills and free a slot.
        </p>

        <div className="how-to">
          <h3>How to play</h3>
          <ul>
            <li><b>Move</b> with the <b>WASD</b> or <b>arrow</b> keys — on a phone, just <b>drag anywhere</b> to move.</li>
            <li>Your <b>sword attacks by itself</b> — steer your hero into the monsters and it does the rest.</li>
            <li>Beaten monsters drop <b>glowing gems</b>. Walk over them to collect and <b>level up</b>.</li>
            <li>Each level, <b>pick one of three skills</b>. New skills and upgrades share the same five slots.</li>
            <li>Some skill pairs <b>combine into evolved skills</b>, removing both ingredients and freeing one slot.</li>
            <li>Grab items on the ground: <b>❤️ health, 🧲 magnet, 💣 bomb, ⏱️ freeze, 🎁 treasure</b>.</li>
            <li>Monsters <b>level up every minute</b>, and a <b>boss appears every two minutes</b>.</li>
            <li>Active skills use <b>Q</b>, <b>E</b>, <b>Space</b>, <b>R</b>, and <b>F</b> in skill-slot order.</li>
            <li>Need a break? <b>Pause</b> with the <b>⏸</b> button or the <b>P</b> key.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
