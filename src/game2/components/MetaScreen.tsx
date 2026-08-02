import { ClassId, CLASSES, MetaState } from '../game/types'
import { LAYERS, STAGES_PER_LAYER, FINAL_STAGE, chapterRecap, weaponNoun } from '../game/story'

interface Props {
  meta: MetaState
  classId: ClassId
  onClassChange: (classId: ClassId) => void
  onStart: () => void
}

// The Last Ember — the campfire you return to between descents.
// This is the story hub: what has happened so far, how deep you've been,
// which champions you've laid to rest, and Cael waiting to go again.
export default function MetaScreen({ meta, classId, onClassChange, onStart }: Props) {
  const selectedClass = CLASSES[classId]
  const deepest = Math.min(meta.deepestLayer, LAYERS.length)
  const firstRun = meta.runs === 0

  return (
    <div className="menu-scroll ember-screen">
      <div className="menu">
        <div className="ember-mark">🔥</div>
        <h1 className="title ember-title">The Last Ember</h1>
        <p className="tagline ember-tagline">
          Aldermere is hollow. You are the last of the Oathbound — and the {weaponNoun(classId)} you
          carry still has your oldest friend inside it.
        </p>

        <div className="ember-story">
          <div className="ember-chapter">
            {meta.victories > 0 ? 'EPILOGUE' : `CHAPTER ${Math.min(deepest + 1, LAYERS.length)}`}
          </div>
          <p className="ember-recap">{chapterRecap(deepest, meta.victories)}</p>
          <p className="ember-cael">
            “{firstRun
              ? 'Up you get. We swore this oath together, remember? Down we go.'
              : meta.victories > 0
                ? 'We took it back. Doesn’t feel real yet, does it? ...Again?'
                : 'Back on your feet. The Depths haven’t beaten us yet.'}”
            <span className="ember-cael-tag">— Cael</span>
          </p>
        </div>

        {/* The descent: four layers, each ending with a champion you knew */}
        <h2 className="forge-title">🕯️ The Descent</h2>
        <div className="descent-list">
          {LAYERS.map((layer) => {
            const reached = deepest >= layer.index
            const rested = meta.lordsLaidToRest.includes(layer.relic.key)
            return (
              <div key={layer.index} className={`descent-row${reached ? ' reached' : ''}`}>
                <div className="descent-numeral">{layer.numeral}</div>
                <div className="descent-body">
                  <div className="descent-name">
                    {reached ? layer.name : `Depth ${layer.numeral} — not yet walked`}
                  </div>
                  <div className="descent-lord">
                    {rested ? `✓ ${layer.lord} — at rest` : reached ? layer.lord : layer.teaser}
                  </div>
                </div>
                <div className="descent-relic" title={layer.relic.name}>
                  {meta.relicsFound.includes(layer.relic.key) ? layer.relic.icon : '·'}
                </div>
              </div>
            )
          })}
        </div>

        <div className="sword-panel">
          <div className="sword-meta">
            <div className="sword-lvl">{selectedClass.icon} Take up the oath as {selectedClass.name}</div>
            <div className="sword-stats">
              {firstRun
                ? `${FINAL_STAGE} stages down. Four layers. One throne to take back.`
                : `Deepest: ${deepest > 0 ? LAYERS[deepest - 1].name : 'the surface'} · stage ${meta.bestStage}/${FINAL_STAGE} · ${meta.totalKills} of the Hollow put down · ${meta.runs} descents${meta.victories > 0 ? ` · 👑 ${meta.victories} won` : ''}`}
            </div>
          </div>
          <div className="class-picker" aria-label="Choose a class">
            {(Object.keys(CLASSES) as ClassId[]).map((id) => (
              <button
                key={id}
                className={`class-choice${classId === id ? ' selected' : ''}`}
                onClick={() => onClassChange(id)}
              >
                <span>{CLASSES[id].icon} {CLASSES[id].name}</span>
                <small>{CLASSES[id].description}</small>
              </button>
            ))}
          </div>
          <button className="play-btn descend-btn" onClick={onStart}>▼ Descend</button>
        </div>

        <div className="how-to">
          <h3>How to play</h3>
          <ul>
            <li><b>Move</b> with <b>WASD</b> or <b>arrow</b> keys — on a phone, <b>drag anywhere</b>.</li>
            <li>Your weapon <b>attacks by itself</b> — steer into the Hollow and it does the rest.</li>
            <li>Each stage has a <b>fixed number of enemies</b>. Clear them to press deeper.</li>
            <li>Every <b>{STAGES_PER_LAYER} stages</b> a <b>layer-lord</b> waits — a champion Cael knew.</li>
            <li>After each stage, <b>pick one of three skills</b> (five slots; some combine into evolutions).</li>
            <li>Each layer hides one <b>relic of Aldermere</b> — a powerful boon found nowhere else.</li>
            <li>Reach <b>stage {FINAL_STAGE}</b> and beat the <b>Hollow King</b> to reclaim the kingdom.</li>
            <li>Active skills use <b>Q</b>, <b>E</b>, <b>Space</b>, <b>R</b>, <b>F</b>. <b>Pause</b> with <b>P</b>.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
