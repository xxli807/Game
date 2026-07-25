import { useEffect } from 'react'
import { Card } from '../game/types'

interface Props {
  cards: Card[]
  onPick: (id: string) => void
}

export default function LevelUpModal({ cards, onPick }: Props) {
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
        <h2>⚡ LEVEL UP! ⚡</h2>
        <p className="levelup-sub">Choose an upgrade</p>
        <div className="card-row">
          {cards.map((c, i) => (
            <button key={c.id} className={`card card-${c.rarity}`} onClick={() => onPick(c.id)}>
              <div className="card-num">{i + 1}</div>
              <div className="card-icon">{c.icon}</div>
              <div className="card-name">{c.name}</div>
              <div className="card-rarity">{c.rarity}</div>
              <div className="card-desc">{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
