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
  teaser: string // what Cael will say of it before you've been there
  relic: LayerRelic // a story-themed boon found only in this layer
  enter: string[] // Cael, on entering the layer
  lordIntro: string[] // Cael, when the layer-lord appears (boss stage)
}

export const LAYERS: Layer[] = [
  {
    index: 1, numeral: 'I', name: 'The Sunken Keep', teaser: 'Drowned halls, and something that still keeps watch', biome: 'dungeon',
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
    index: 2, numeral: 'II', name: 'The Rotwood', teaser: 'A greenwood gone wrong, below the Keep', biome: 'forest',
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
    index: 3, numeral: 'III', name: 'The Frozen Vaults', teaser: 'Where the kingdom locked away what it feared', biome: 'snow',
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
    index: 4, numeral: 'IV', name: 'The Molten Heart', teaser: 'The wound at the bottom of the world', biome: 'volcano',
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

/**
 * The descent is short on purpose: a whole run fits a commute, and every run
 * actually travels through all four layers of the story instead of stalling in
 * the first one. Each layer ends with its layer-lord.
 * Stage 3 = Roderin · 6 = Maren · 9 = Yll · 12 = the Hollow King (finale).
 */
export const STAGES_PER_LAYER = 3
export const FINAL_STAGE = LAYERS.length * STAGES_PER_LAYER

export function layerForStage(stage: number): Layer {
  const i = Math.max(0, Math.min(LAYERS.length - 1, Math.floor((stage - 1) / STAGES_PER_LAYER)))
  return LAYERS[i]
}

/** A layer-lord waits at the end of every layer. */
export function isLordStage(stage: number): boolean {
  return stage % STAGES_PER_LAYER === 0
}

/** How deep the run has gone, 1..4. */
export function depthForStage(stage: number): number {
  return layerForStage(stage).index
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

/** Cael when a layer-lord falls — the emotional payoff of each layer. */
export const LORD_DOWN: string[][] = [
  ['Rest easy, Roderin. You held the gate longer than any of us.'],
  ["Sleep, Maren. The greenwood remembers you, even if it's rotted."],
  ['Goodbye, Yll. You were right about everything, as usual.'],
  ['...It’s over. The Hollow King is dead. Aldermere is ours again.'],
]

/** Short in-run barks — keep them rare so they land. */
export const BARKS = {
  lowHp: [
    'Bleeding out is a TERRIBLE look on you. MOVE.',
    "Don't you dare. I am NOT doing this alone.",
    "That's too much blood. Even for you.",
  ],
  relic: [
    'Old Aldermere craft. It still remembers whose side it’s on.',
    'Take it. The kingdom owes you that much.',
  ],
  evolve: [
    'Now THAT’S old Aldermere steel. Just like the drills.',
    "Feels good, doesn't it? Don't let it go to your head.",
  ],
  swarm: [
    'They just keep coming. Fine. More for us.',
    'Whole lot of them. Stay moving.',
  ],
} as const

/** One-line "story so far" for the Ember hub, based on how deep you've reached. */
export function chapterRecap(deepestLayer: number, victories: number): string {
  if (victories > 0) {
    return 'The Hollow King has fallen and the throne stands empty — waiting for a rightful heir. Aldermere breathes again. But the Depths are patient, and the Ember still burns.'
  }
  switch (deepestLayer) {
    case 0:
      return 'The kingdom of Aldermere is hollowed out and silent. One knight still stands at the last ember, with a sword that will not let them rest.'
    case 1:
      return 'You have walked the drowned halls of the Sunken Keep and laid Sir Roderin to rest. Below, the rotted greenwood waits.'
    case 2:
      return "Roderin and Maren are at peace. The cold beneath the Rotwood runs deeper than either of you expected."
    case 3:
      return "Three champions laid to rest. Only the Molten Heart remains — and the thing wearing the king's crown."
    default:
      return 'The Heart is close. Cael has gone quiet, which is somehow worse.'
  }
}
