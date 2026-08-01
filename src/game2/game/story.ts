// ---------- The story of Aldermere, told by Cael (the sword) ----------
// Snarky & heartfelt narration for the descent. Delivered as short beats so a
// commuter gets a satisfying bite each run. See Plan/plan.md for the bible.
import { Biome } from './sprites'

export interface StoryEvent {
  id: string
  numeral?: string // "I".."IV" for the layer title card
  title?: string // big title (layer name or layer-lord name)
  subtitle?: string
  lines?: string[] // Cael's dialogue, advanced one at a time
}

export interface LayerRelic {
  key: string
  name: string
  icon: string
  desc: string
}

export interface Layer {
  index: number // 1..4
  numeral: string
  name: string
  biome: Biome
  lord: string // the layer-lord (boss) — a fallen champion you both knew
  relic: LayerRelic // a story-themed boon found only in this layer
  enter: string[] // Cael, on entering the layer
  lordIntro: string[] // Cael, when the layer-lord appears (boss stage)
}

export const LAYERS: Layer[] = [
  {
    index: 1, numeral: 'I', name: 'The Sunken Keep', biome: 'dungeon',
    lord: 'Sir Roderin, the First to Fall',
    relic: { key: 'keepstone', name: 'Keepstone Ward', icon: '🏰', desc: '+80 max health and steady regeneration — the old keep still shelters its own.' },
    enter: [
      'The Sunken Keep. Home — or it was, before the Hollowing took it.',
      'Stay sharp. Everything down here used to be someone we knew.',
    ],
    lordIntro: [
      'Roderin. He knighted us both, remember?',
      '...The Hollow has him now. Put him to rest — gently as you can.',
    ],
  },
  {
    index: 2, numeral: 'II', name: 'The Rotwood', biome: 'forest',
    lord: 'Maren the Green',
    relic: { key: 'thornheart', name: 'Thornheart', icon: '🌿', desc: 'Your strikes drink life and the thorns bite back — lifesteal and retaliation.' },
    enter: [
      "The queen's gardens. We trained here, under the greenwood.",
      'Gods, look at it now. Rotted through. Keep moving.',
    ],
    lordIntro: [
      'Maren. She taught half the realm to loose an arrow.',
      "She wouldn't want to be this. End it.",
    ],
  },
  {
    index: 3, numeral: 'III', name: 'The Frozen Vaults', biome: 'snow',
    lord: 'Archivist Yll',
    relic: { key: 'rimebound', name: 'Rimebound Edge', icon: '🧊', desc: 'Cold, patient, exact — a sharp rise in critical chance and critical damage.' },
    enter: [
      'The Vaults. Every book the kingdom ever wrote, frozen solid.',
      'Yll sealed herself in here to stop the rot spreading. It... did not work.',
    ],
    lordIntro: [
      'Archivist Yll. Coldest wit in Aldermere, warmest heart.',
      "She's still in there, somewhere. Be quick. Be kind.",
    ],
  },
  {
    index: 4, numeral: 'IV', name: 'The Molten Heart', biome: 'volcano',
    lord: 'the Hollow King',
    relic: { key: 'emberwrath', name: 'Emberwrath', icon: '🔥', desc: "The Heart's fury in your arm — a heavy surge of sword damage." },
    enter: [
      'The Molten Heart. Where the Hollowing was born.',
      "The throne's just ahead. Whatever sits on it now... it isn't the king anymore.",
    ],
    lordIntro: [
      'There it is. The thing that unmade our home.',
      'One more, together. For Aldermere. GO.',
    ],
  },
]

/** Bosses at stage 10/20/30/40; the Hollow King (40) is the finale. */
export const FINAL_STAGE = 40

export function layerForStage(stage: number): Layer {
  const i = Math.max(0, Math.min(LAYERS.length - 1, Math.floor((stage - 1) / 10)))
  return LAYERS[i]
}

export const OPENING: string[] = [
  'Up you get. We swore this oath together, remember?',
  "I'm not letting you break it alone.",
  'Down we go. Reclaim Aldermere — or die trying. ...Again.',
]

export const DEATH_LINES: string[] = [
  'Back to the Ember. I know — I hate it too.',
  'Rest. Then we finish what we started. Together.',
]

export const VICTORY_LINES: string[] = [
  'It’s done. The Hollow King falls. The throne is ours to give back.',
  'We did it — like we always said we would. Aldermere remembers.',
]

export function randomLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]
}
