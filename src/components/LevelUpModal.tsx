import { useEffect } from 'react'
import {
  DraftChoice,
  OwnedSkill,
  SKILLS,
  SKILL_SYNERGIES,
  SkillId,
} from '../game/types'

interface Props {
  cards: DraftChoice[]
  skills: OwnedSkill[]
  clearedStage: number
  onPick: (id: string) => void
}

export default function LevelUpModal({ cards, skills, clearedStage, onPick }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '1' && cards[0]) onPick(cards[0].id)
      if (e.key === '2' && cards[1]) onPick(cards[1].id)
      if (e.key === '3' && cards[2]) onPick(cards[2].id)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cards, onPick])

  return (
    <div className="overlay">
      <div className="levelup">
        <h2>✓ STAGE {clearedStage} CLEARED!</h2>
        <p className="levelup-sub">Choose a skill before the next stage</p>
        <div className="levelup-loadout">
          <span className="levelup-loadout-label">Current skills</span>
          <div className="levelup-skills">
            {skills.map((skill) => {
              const definition = SKILLS[skill.id]
              return (
                <div
                  key={skill.id}
                  className="levelup-skill"
                  title={`${definition.name} · Level ${skill.level}`}
                >
                  <span className="levelup-skill-icon">{definition.icon}</span>
                  <span className="levelup-skill-name">{definition.name}</span>
                  <span className="levelup-skill-level">Lv {skill.level}</span>
                </div>
              )
            })}
            {Array.from({ length: Math.max(0, 5 - skills.length) }, (_, index) => (
              <div key={`empty-${index}`} className="levelup-skill levelup-skill-empty">
                Empty slot
              </div>
            ))}
          </div>
        </div>
        <div className="card-row">
          {cards.map((c, i) => {
            const synergies = getNewSkillSynergies(c, skills)
            return (
              <button
                key={c.id}
                className={`card card-${c.rarity}${synergies.length ? ' card-synergy' : ''}`}
                onClick={() => onPick(c.id)}
              >
                <div className="card-num">{i + 1}</div>
                {c.tag && <div className="card-tag">{c.tag}</div>}
                <div className="card-icon">{c.icon}</div>
                <div className="card-name">{c.name}</div>
                <div className="card-rarity">{c.rarity}</div>
                <div className="card-desc">{c.desc}</div>
                {synergies.map(({ ownedIds, resultId }) => (
                  <div className="card-synergy-note" key={resultId}>
                    <span className="card-synergy-label">✨ SYNERGY</span>
                    <span>
                      + {ownedIds.map((id) => `${SKILLS[id].icon} ${SKILLS[id].name}`).join(' + ')}
                      {' → '}
                      {SKILLS[resultId].name}
                    </span>
                  </div>
                ))}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getNewSkillSynergies(card: DraftChoice, skills: OwnedSkill[]) {
  if (!card.id.startsWith('new-')) return []

  const candidateId = card.id.slice(4) as SkillId
  if (!SKILLS[candidateId]) return []

  const ownedIds = new Set(skills.map((skill) => skill.id))
  return SKILL_SYNERGIES.flatMap((synergy) => {
    if (ownedIds.has(synergy.result) || !synergy.ingredients.includes(candidateId)) return []
    const requiredOwnedIds = synergy.ingredients.filter((ingredient) => ingredient !== candidateId)
    return requiredOwnedIds.every((ingredient) => ownedIds.has(ingredient))
      ? [{ ownedIds: requiredOwnedIds, resultId: synergy.result }]
      : []
  })
}
