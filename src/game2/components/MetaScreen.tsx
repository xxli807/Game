import { ClassId, CLASSES, MetaState, META_UPGRADES, upgradeCost } from '../game/types'
import { audio, Sfx } from '../game/audio'
import { LAYERS, STAGES_PER_LAYER, FINAL_STAGE, chapterRecap, weaponNoun } from '../game/story'

interface Props {
  meta: MetaState
  classId: ClassId
  onClassChange: (classId: ClassId) => void
  onBuy: (id: string) => void
  lastEarned: number
  onStart: () => void
}

// The Last Ember — the campfire you return to between descents.
// This is the story hub: what has happened so far, how deep you've been,
// which champions you've laid to rest, and Cael waiting to go again.
export default function MetaScreen({ meta, classId, onClassChange, onBuy, lastEarned, onStart }: Props) {
  const selectedClass = CLASSES[classId]
  const deepest = Math.min(meta.deepestLayer, LAYERS.length)
  const firstRun = meta.runs === 0

  return (
    <div className="menu-scroll ember-screen">
      <div className="menu">
        <div className="ember-mark">🔥</div>
        <h1 className="title ember-title">最后的余烬</h1>
        <p className="tagline ember-tagline">
          奥德米尔已被掏空。你是最后的誓约者——而你手中的{weaponNoun(classId)}里，
          还封着你最老的朋友。
        </p>

        <div className="ember-purse">
          🔥 余烬 <b>{meta.embers}</b>
          {lastEarned > 0 && <span className="ember-gain"> 上次下潜 +{lastEarned}</span>}
        </div>

        <div className="ember-story">
          <div className="ember-chapter">
            {meta.victories > 0 ? '终章' : `第 ${Math.min(deepest + 1, LAYERS.length)} 章`}
          </div>
          <p className="ember-recap">{chapterRecap(deepest, meta.victories)}</p>
          <p className="ember-cael">
            “{firstRun
              ? '起来。这誓言是我们一起立下的，记得吗？下去吧。'
              : meta.victories > 0
                ? '我们夺回来了。还没什么真实感，对吧？……再来一次？'
                : '重新站起来。深渊还没打倒我们。'}”
            <span className="ember-cael-tag">—— 凯尔</span>
          </p>
        </div>

        {/* The descent: four layers, each ending with a champion you knew */}
        <h2 className="forge-title">🕯️ 下潜之路</h2>
        <div className="descent-list">
          {LAYERS.map((layer) => {
            const reached = deepest >= layer.index
            const rested = meta.lordsLaidToRest.includes(layer.relic.key)
            return (
              <div key={layer.index} className={`descent-row${reached ? ' reached' : ''}`}>
                <div className="descent-numeral">{layer.numeral}</div>
                <div className="descent-body">
                  <div className="descent-name">
                    {reached ? layer.name : `第${layer.numeral}层 —— 尚未踏足`}
                  </div>
                  <div className="descent-lord">
                    {rested ? `✓ ${layer.lord} —— 已安息` : reached ? layer.lord : layer.teaser}
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
            <div className="sword-lvl">{selectedClass.icon} 以{selectedClass.name}的身份立誓</div>
            <div className="sword-stats">
              {firstRun
                ? `${FINAL_STAGE} 关，四层深渊，一座待夺回的王座。`
                : `最深：${deepest > 0 ? LAYERS[deepest - 1].name : '地表'} · 第 ${meta.bestStage}/${FINAL_STAGE} 关 · 击败 ${meta.totalKills} 个空蚀之物 · 下潜 ${meta.runs} 次${meta.victories > 0 ? ` · 👑 通关 ${meta.victories} 次` : ''}`}
            </div>
          </div>
          <div className="class-picker" aria-label="选择职业">
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
          <button className="play-btn descend-btn" onClick={onStart}>▼ 下潜</button>
        </div>

        {/* Rekindling Aldermere: permanent upgrades bought with embers */}
        <h2 className="forge-title">🔨 重燃奥德米尔</h2>
        <p className="forge-note">
          无论输赢，每次下潜都会带回余烬。在这里消费它们；这些提升是永久的。
        </p>
        <div className="upgrade-grid">
          {META_UPGRADES.map((u) => {
            const level = meta.upgrades[u.id] ?? 0
            const maxed = level >= u.maxLevel
            const cost = upgradeCost(u, level)
            const afford = meta.embers >= cost
            return (
              <button
                key={u.id}
                className={`upgrade${maxed ? ' maxed' : afford ? ' afford' : ''}`}
                onClick={() => onBuy(u.id)}
                disabled={maxed || !afford}
              >
                <div className="upgrade-top">
                  <span className="upgrade-icon">{u.icon}</span>
                  <span className="upgrade-name">{u.name}</span>
                  <span className="upgrade-lvl">{level}/{u.maxLevel}</span>
                </div>
                <small>{u.desc}</small>
                <div className="upgrade-cost">{maxed ? '已满级' : `🔥 ${cost}`}</div>
              </button>
            )
          })}
        </div>

        {/* Sound check — click any sound to hear it in isolation. */}
        <details className="sound-check">
          <summary>🔊 音效试听</summary>
          <div className="sound-grid">
            {([
              ['hit', '普通命中'], ['crit', '暴击'], ['kill', '击杀'],
              ['gem', '经验宝石'], ['pickup', '拾取道具'], ['stage', '通关'],
              ['cast', '释放技能'], ['hurt', '受伤'], ['lordWarn', '层主蓄力'],
              ['lordHit', '层主重击'], ['relic', '获得遗物'], ['victory', '胜利'],
              ['death', '死亡'], ['ui', '界面点击'],
            ] as [Sfx, string][]).map(([id, label]) => (
              <button key={id} className="sound-btn" onClick={() => { audio.resume(); audio.play(id) }}>
                {label}
              </button>
            ))}
          </div>
        </details>

        <div className="how-to">
          <h3>玩法说明</h3>
          <ul>
            <li>用 <b>WASD</b> 或<b>方向键</b>移动——手机上<b>任意位置拖动</b>即可。</li>
            <li>武器会<b>自动攻击</b>——只管靠近空蚀之物，其余交给它。</li>
            <li>空蚀<b>源源不断</b>——每关都是一个<b>击杀指标</b>，达成即可深入。</li>
            <li>每 <b>{STAGES_PER_LAYER}</b> 关会遇到一位<b>层主</b>——凯尔认识的勇士。</li>
            <li>每关结束后<b>三选一</b>选技能（共五个槽位，部分可组合进化）。</li>
            <li>击败层主必得一件<b>奥德米尔遗物</b>——别处无法获得的强力增益。</li>
            <li>拾取地面道具：<b>❤️ 生命、🧲 磁石、💣 炸弹、⏱️ 冻结</b>，以及可<b>免费额外选一项技能</b>的 <b>🎁 宝箱</b>。</li>
            <li>抵达第 <b>{FINAL_STAGE}</b> 关击败<b>空蚀之王</b>，夺回王国。</li>
            <li>主动技能对应 <b>Q</b>、<b>E</b>、<b>空格</b>、<b>R</b>、<b>F</b>。按 <b>P</b> 暂停。</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
