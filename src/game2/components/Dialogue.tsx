import { useEffect, useState } from 'react'
import { StoryEvent } from '../game/story'

// Cael's talking-sword dialogue: an optional title card + advanceable lines.
// Tap / click to advance; lines also auto-advance so it never blocks the player.
export default function Dialogue({ event, onDone }: { event: StoryEvent; onDone: () => void }) {
  const lines = event.lines ?? []
  const [i, setI] = useState(0)

  useEffect(() => { setI(0) }, [event])

  const advance = () => {
    setI((prev) => {
      if (prev + 1 < lines.length) return prev + 1
      onDone()
      return prev
    })
  }

  // auto-advance so it reads on its own on a train
  useEffect(() => {
    const t = setTimeout(advance, lines.length ? 3600 : 2200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, event])

  return (
    <div className="story-overlay" onClick={advance}>
      {(event.title || event.numeral) && (
        <div className="story-title">
          {event.numeral && <div className="story-numeral">{event.numeral}</div>}
          {event.title && <div className="story-name">{event.title}</div>}
          {event.subtitle && <div className="story-sub">{event.subtitle}</div>}
        </div>
      )}
      {lines.length > 0 && (
        <div className="story-dialogue">
          <div className="story-speaker">⚔️ CAEL</div>
          <div className="story-line">{lines[i]}</div>
          <div className="story-hint">tap to continue ▸</div>
        </div>
      )}
    </div>
  )
}
