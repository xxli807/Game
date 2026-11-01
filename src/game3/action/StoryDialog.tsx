import type { Ref } from 'react'
import type { VillageStory } from './stories'

export function StoryDialog({ story, firstButton, onChoose, onClose }: { story: VillageStory; firstButton: Ref<HTMLButtonElement>; onChoose: (id: string) => void; onClose: () => void }) {
  return <><small>乡里人情 · {story.name}</small><h2>{story.title}</h2>
    <p className="story-cause">缘起 · {story.cause}</p><blockquote>{story.body}</blockquote>
    <div className="world-options">{story.choices.map((choice, i) => <button key={choice.id} ref={i === 0 ? firstButton : undefined} onClick={() => onChoose(choice.id)}><b>{choice.label}</b><span>{choice.detail}</span><em>亲自前往办理 →</em></button>)}</div>
    <p>有限的人手只能承担其中一项。可以稍后再来，当前政务仍会等候。</p>
    <button className="world-quiet" onClick={onClose}>记下此事，稍后再来</button>
  </>
}
