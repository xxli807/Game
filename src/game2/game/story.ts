// ---------- 奥德米尔的故事，由凯尔（附身于你武器中的挚友）讲述 ----------
// 毒舌又深情的下潜叙事。每段都很短，通勤路上也能读完一段。见 Plan/plan.md。
import { Biome } from './sprites'

export interface StoryEvent {
  id: string
  numeral?: string // "I".."IV" 层级标题
  title?: string // 大标题（层名或层主名）
  subtitle?: string
  lines?: string[] // 凯尔的台词，逐句推进
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
  lord: string // 层主（首领）——你们都认识的堕落勇士
  lordShort: string // 显示在首领血条上的名字
  lordForm: string // 空蚀把他们扭曲成的形态（贴图键名）
  teaser: string // 尚未抵达时的暗示文字
  relicTaken: string // 从遗骸中取走遗物时，凯尔说的话
  relic: LayerRelic // 只在该层获得的故事遗物
  enter: string[] // 进入该层时凯尔的话
  lordIntro: string[] // 层主现身时凯尔的话
}

export const LAYERS: Layer[] = [
  {
    index: 1, numeral: '一', name: '沉没要塞', teaser: '被水淹没的厅堂，仍有什么在值守', biome: 'dungeon',
    lord: '罗德林爵士，最先倒下的人',
    lordShort: '罗德林爵士', lordForm: 'enemy_brute',
    relicTaken: '他会希望你拿着的。收下吧——那道门他守得够久了。',
    relic: { key: 'keepstone', name: '守石壁垒', icon: '🏰', desc: '生命上限 +80，并持续回复——老要塞仍庇护着自己人。' },
    enter: [
      '沉没要塞。这里曾是家——在空蚀吞掉它之前。',
      '打起精神。下面每一个东西，从前都是我们认识的人。',
    ],
    lordIntro: [
      '罗德林。当年是他给我们俩授的骑士礼，记得吗？',
      '……如今空蚀占据了他。让他安息吧——尽量温柔些。',
    ],
  },
  {
    index: 2, numeral: '二', name: '腐林', teaser: '要塞之下，一片扭曲变质的绿林', biome: 'forest',
    lord: '青林玛伦',
    lordShort: '青林玛伦', lordForm: 'enemy_ironroot_colossus',
    relicTaken: '这是她从古老绿林里养出来的。现在归你了。',
    relic: { key: 'thornheart', name: '荆棘之心', icon: '🌿', desc: '你的攻击汲取生命，荆棘也会反噬——吸血与反伤。' },
    enter: [
      '王后的花园。我们就在这片绿荫下受训。',
      '天啊，看看现在的样子。烂透了。别停下。',
    ],
    lordIntro: [
      '玛伦。半个王国的箭术都是她教的。',
      '她不会愿意变成这样。了结它。',
    ],
  },
  {
    index: 3, numeral: '三', name: '冰封典藏', teaser: '王国把最恐惧之物封存的地方', biome: 'snow',
    lord: '典藏官伊尔',
    lordShort: '典藏官伊尔', lordForm: 'enemy_mire_oracle',
    relicTaken: '奥德米尔的每件遗物她都编过目录。这一件她会满意的。',
    relic: { key: 'rimebound', name: '霜缚之刃', icon: '🧊', desc: '冷静、耐心、精准——大幅提升暴击率与暴击伤害。' },
    enter: [
      '典藏库。王国写过的每一本书，都冻在这里。',
      '伊尔把自己封在里面，想阻止腐蚀蔓延。结果……并没有成功。',
    ],
    lordIntro: [
      '典藏官伊尔。奥德米尔最冷的嘴，最热的心。',
      '她还在里面某个地方。快一点。也温柔一点。',
    ],
  },
  {
    index: 4, numeral: '四', name: '熔心', teaser: '世界底部的那道伤口', biome: 'volcano',
    lord: '空蚀之王',
    lordShort: '空蚀之王', lordForm: 'boss_dragon',
    relicTaken: '拿着。这是熔心欠我们的。',
    relic: { key: 'emberwrath', name: '余烬之怒', icon: '🔥', desc: '熔心之怒灌入你的臂膀——武器伤害大幅提升。' },
    enter: [
      '熔心。空蚀诞生的地方。',
      '王座就在前面。如今坐在上面的东西……已经不是国王了。',
    ],
    lordIntro: [
      '就是它。毁掉我们家园的东西。',
      '再来一次，一起。为了奥德米尔。上！',
    ],
  },
]

/**
 * 下潜特意做得很短：一整局刚好够一趟通勤，而且每一局都能走完四层，
 * 而不是卡在第一层。每层结尾都有一位层主。
 * 第 3 关＝罗德林 · 6＝玛伦 · 9＝伊尔 · 12＝空蚀之王（终局）。
 */
export const STAGES_PER_LAYER = 3
export const FINAL_STAGE = LAYERS.length * STAGES_PER_LAYER

export function layerForStage(stage: number): Layer {
  const i = Math.max(0, Math.min(LAYERS.length - 1, Math.floor((stage - 1) / STAGES_PER_LAYER)))
  return LAYERS[i]
}

/** 每层末尾都有一位层主等着。 */
export function isLordStage(stage: number): boolean {
  return stage % STAGES_PER_LAYER === 0
}

/** 本局已下潜到第几层（1..4）。 */
export function depthForStage(stage: number): number {
  return layerForStage(stage).index
}

export const OPENING: string[] = [
  '起来。这誓言是我们一起立下的，记得吗？',
  '我不会让你一个人违誓。',
  '下去吧。夺回奥德米尔——不然就死在路上。……又一次。',
]

export const DEATH_LINES: string[] = [
  '回余烬那儿去。我知道——我也讨厌这样。',
  '歇会儿。然后我们把没做完的事做完。一起。',
]

export const VICTORY_LINES: string[] = [
  '结束了。空蚀之王倒下了。王座该还回去了。',
  '我们做到了——就像当初说好的那样。奥德米尔记得。',
]

export function randomLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)]
}

/**
 * 凯尔附身的是你携带的誓约信物，不一定是剑——
 * 这样法师与死灵法师的叙事也说得通。
 */
export function weaponNoun(classId: 'warrior' | 'mage' | 'necromancer'): string {
  return classId === 'mage' ? '法器' : classId === 'necromancer' ? '圣骸匣' : '刀刃'
}

/** 层主倒下时凯尔的话——每一层的情感落点。 */
export const LORD_DOWN: string[][] = [
  ['安息吧，罗德林。那道门你守得比我们任何人都久。'],
  ['睡吧，玛伦。绿林记得你，哪怕它已经烂了。'],
  ['再见，伊尔。你从来都是对的，一如既往。'],
  ['……结束了。空蚀之王死了。奥德米尔又是我们的了。'],
]

/** 战斗中的短句——保持稀有，才有分量。 */
export const BARKS = {
  lowHp: [
    '流血这造型可一点都不适合你。快躲开！',
    '你敢倒下试试。我可不想一个人干这活。',
    '血流得太多了。就算是你也太多了。',
  ],
  relic: [
    '奥德米尔的老手艺。它还记得自己站在哪一边。',
    '收下。王国至少欠你这个。',
  ],
  evolve: [
    '这才是奥德米尔的老手艺。跟当年的操练一模一样。',
    '感觉不错吧？别得意忘形。',
  ],
  swarm: [
    '它们没完没了。行啊，正好都归我们。',
    '这么多。别停下来。',
  ],
} as const

/** 余烬营地上的「前情提要」，随下潜进度变化。 */
export function chapterRecap(deepestLayer: number, victories: number): string {
  if (victories > 0) {
    return '空蚀之王已经倒下，王座空悬——等待真正的继承者。奥德米尔重新有了呼吸。但深渊很有耐心，而余烬仍在燃烧。'
  }
  switch (deepestLayer) {
    case 0:
      return '奥德米尔王国被掏空，一片死寂。只剩一名骑士还站在最后一簇余烬旁，怀里带着一位不肯让他安息的老友。'
    case 1:
      return '你走过了沉没要塞被水淹没的厅堂，让罗德林爵士安息。再往下，腐烂的绿林正在等你。'
    case 2:
      return '罗德林与玛伦都已安息。腐林之下的寒冷，比你们俩预想的都要深。'
    case 3:
      return '三位勇士已经安息。只剩熔心——以及那个戴着国王王冠的东西。'
    default:
      return '熔心近在眼前。凯尔安静了下来，这反而更让人不安。'
  }
}
