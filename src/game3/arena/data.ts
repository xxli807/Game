// 逐鹿 — three-lane arena data. Pure data and geometry: no DOM, no three.js, no React,
// so the whole match can be simulated headlessly (see .claude/skills/verify/v3-arena.mjs).
//
// The format (lanes, towers, minion waves, a kit with an ultimate) is genre convention.
// Every hero kit, name, item and number here is original to this game.

export type Vec = { x: number; y: number }
export type Team = 0 | 1 // 0 = 玩家一方（蓝，左下），1 = 敌方（红，右上）
export type LaneId = 'top' | 'mid' | 'bot'
export const MAP = 3600
export const LANE_IDS: LaneId[] = ['top', 'mid', 'bot']

// The two sides mirror across the river (the line y = x), so every lane maps onto itself.
export const mirror = (p: Vec): Vec => ({ x: p.y, y: p.x })
const both = (p: Vec): [Vec, Vec] => [p, mirror(p)]

export const BASE = both({ x: 520, y: 3080 })
export const FOUNTAIN = both({ x: 250, y: 3350 })
// Waypoints run from the blue base to the red base; red minions walk them in reverse.
export const LANES: Record<LaneId, Vec[]> = {
  top: [{ x: 520, y: 2760 }, { x: 520, y: 820 }, { x: 600, y: 600 }, { x: 820, y: 520 }, { x: 2760, y: 520 }],
  mid: [{ x: 800, y: 2800 }, { x: 1800, y: 1800 }, { x: 2800, y: 800 }],
  bot: [{ x: 840, y: 3080 }, { x: 2780, y: 3080 }, { x: 3000, y: 3000 }, { x: 3080, y: 2780 }, { x: 3080, y: 840 }],
}
// Blue towers, set just off the lane so waves pass beside them; red towers are the mirror.
// They sit on the far side of the lane from the camera, so they never stand in front of a fight.
const BLUE_TOWERS: { lane: LaneId; tier: 'outer' | 'inner'; at: Vec }[] = [
  { lane: 'top', tier: 'outer', at: { x: 440, y: 1350 } }, { lane: 'top', tier: 'inner', at: { x: 440, y: 2250 } },
  { lane: 'mid', tier: 'outer', at: { x: 1380, y: 2120 } }, { lane: 'mid', tier: 'inner', at: { x: 1040, y: 2460 } },
  { lane: 'bot', tier: 'outer', at: { x: 2250, y: 2990 } }, { lane: 'bot', tier: 'inner', at: { x: 1350, y: 2990 } },
]
export const TOWERS = [
  ...BLUE_TOWERS.map(t => ({ ...t, team: 0 as Team })),
  ...BLUE_TOWERS.map(t => ({ ...t, at: mirror(t.at), team: 1 as Team })),
]
export const CAMPS: Vec[] = [{ x: 1000, y: 1700 }, { x: 1900, y: 2650 }].flatMap(both)
export const BOSS_PIT: Vec = { x: 2400, y: 2400 } // 镇河铁牛，守在下游河道

// ---- lane geometry helpers ----
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
export const laneLength = (lane: LaneId) => LANES[lane].slice(1).reduce((sum, p, i) => sum + dist(LANES[lane][i], p), 0)
/** Distance along the lane (from the blue end) of the point on it nearest to p. */
export function laneProgress(lane: LaneId, p: Vec): number {
  const pts = LANES[lane]
  let best = Infinity, at = 0, walked = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = dist(a, b)
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / (len * len)))
    const d = Math.hypot(p.x - a.x - (b.x - a.x) * t, p.y - a.y - (b.y - a.y) * t)
    if (d < best) { best = d; at = walked + len * t }
    walked += len
  }
  return at
}
export function lanePoint(lane: LaneId, s: number): Vec {
  const pts = LANES[lane]
  let left = Math.max(0, s)
  for (let i = 0; i < pts.length - 1; i++) {
    const len = dist(pts[i], pts[i + 1])
    if (left <= len) return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * left / len, y: pts[i].y + (pts[i + 1].y - pts[i].y) * left / len }
    left -= len
  }
  return { ...pts[pts.length - 1] }
}
export function nearestLane(p: Vec): LaneId {
  let best: LaneId = 'mid', d = Infinity
  for (const lane of LANE_IDS) { const q = lanePoint(lane, laneProgress(lane, p)), dd = dist(p, q); if (dd < d) { d = dd; best = lane } }
  return best
}

// Tree clumps fill the jungle between lanes. Deterministic, mirrored, and kept clear of
// lanes, camps, bases and the river crossing so nothing ever needs pathfinding around them.
export const TREES: (Vec & { r: number })[] = (() => {
  let seed = 99
  const rand = () => (seed = seed * 16807 % 2147483647) / 2147483647
  const out: (Vec & { r: number })[] = []
  const clear = (p: Vec) => {
    if (LANE_IDS.some(lane => dist(p, lanePoint(lane, laneProgress(lane, p))) < 230)) return false
    if (CAMPS.some(c => dist(c, p) < 300) || dist(BOSS_PIT, p) < 380 || dist(mirror(BOSS_PIT), p) < 200) return false
    if (BASE.some(b => dist(b, p) < 620) || FOUNTAIN.some(f => dist(f, p) < 500)) return false
    return Math.abs(p.x - p.y) > 150 // keep the river open
  }
  for (let i = 0; i < 6000 && out.length < 64; i++) {
    const p = { x: 300 + rand() * 3000, y: 300 + rand() * 3000 }
    if (p.y < p.x || !clear(p) || out.some(t => dist(t, p) < 150)) continue
    const r = 38 + rand() * 22
    out.push({ ...p, r }, { ...mirror(p), r })
  }
  return out
})()

// ---- heroes ----
export type HeroClass = 'tank' | 'fighter' | 'mage' | 'marksman'
/** [base, per hero level, ratio of attack] */
export type Scale = [number, number, number]
export type Effect =
  | { t: 'dash'; dist: number; dmg?: Scale; width?: number; stun?: number; slow?: number }
  | { t: 'shot'; speed: number; range: number; width: number; dmg: Scale; pierce?: boolean; stun?: number; slow?: number; count?: number; spread?: number }
  | { t: 'cone'; radius: number; arc: number; dmg: Scale; stun?: number; slow?: number }
  | { t: 'blast'; radius: number; delay: number; dmg: Scale; stun?: number; slow?: number }
  | { t: 'zone'; radius: number; duration: number; dmg: Scale; slow?: number }
  | { t: 'buff'; dur: number; atk?: number; speed?: number; aspd?: number; lifesteal?: number; shield?: Scale; heal?: Scale; allies?: number }
  | { t: 'blink' }
export type SkillDef = { name: string; glyph: string; desc: string; cd: number; aim: 'dir' | 'point' | 'self'; range: number; fx: Effect[] }
export type HeroDef = { name: string; epithet: string; cls: HeroClass; color: string; rig: 'player' | 'soldier' | 'archer' | 'brute'; tagline: string; skills: [SkillDef, SkillDef, SkillDef] }

export const CLASS_NAMES: Record<HeroClass, string> = { tank: '坦克', fighter: '战士', mage: '法师', marksman: '射手' }
export const CLASS_STATS: Record<HeroClass, { hp: number; atk: number; armor: number; range: number; interval: number; speed: number; ranged: boolean; power: number }> = {
  tank: { hp: 2800, atk: 140, armor: 70, range: 125, interval: 1.05, speed: 300, ranged: false, power: 1 },
  fighter: { hp: 2400, atk: 170, armor: 45, range: 130, interval: 0.95, speed: 310, ranged: false, power: 1 },
  mage: { hp: 1950, atk: 135, armor: 25, range: 430, interval: 1.1, speed: 300, ranged: true, power: 1.2 },
  marksman: { hp: 2000, atk: 175, armor: 25, range: 470, interval: 0.85, speed: 305, ranged: true, power: 0.9 },
}
export const ULT_LEVEL = 4
export const MAX_LEVEL = 15

export const HEROES: HeroDef[] = [
  { name: '刘邦', epithet: '汉高祖', cls: 'tank', color: '#8d5b31', rig: 'soldier', tagline: '护住同伴，再一声号令压上去', skills: [
    { name: '斩蛇', glyph: '斩', desc: '向前劈出一道弧光，伤害并减速面前的敌人。', cd: 6, aim: 'dir', range: 230, fx: [{ t: 'cone', radius: 250, arc: 2, dmg: [265, 34, 1], slow: 2 }] },
    { name: '约法三章', glyph: '约', desc: '为自己和附近友军套上护盾。', cd: 14, aim: 'self', range: 450, fx: [{ t: 'buff', dur: 4, shield: [320, 45, 0.6], allies: 450 }] },
    { name: '大风歌', glyph: '风', desc: '震慑四周敌人使其晕眩，并让友军加速冲锋。', cd: 42, aim: 'self', range: 330, fx: [{ t: 'blast', radius: 360, delay: 0.3, dmg: [400, 64, 1.1], stun: 1.4 }, { t: 'buff', dur: 5, speed: 1.3, allies: 600 }] },
  ] },
  { name: '李世民', epithet: '唐太宗', cls: 'fighter', color: '#4b688d', rig: 'player', tagline: '冲进去，站得住，打得久', skills: [
    { name: '破阵', glyph: '破', desc: '向前突进，撞伤并减速沿途敌人。', cd: 7, aim: 'dir', range: 380, fx: [{ t: 'dash', dist: 380, dmg: [265, 34, 0.9], width: 90, slow: 1.2 }] },
    { name: '纳谏', glyph: '谏', desc: '回复生命并获得护盾。', cd: 13, aim: 'self', range: 300, fx: [{ t: 'buff', dur: 4, heal: [340, 46, 0.6], shield: [240, 34, 0.5] }] },
    { name: '天可汗', glyph: '汗', desc: '震击四周，并在一段时间内大幅提升攻击。', cd: 40, aim: 'self', range: 320, fx: [{ t: 'blast', radius: 330, delay: 0.3, dmg: [460, 74, 1.2] }, { t: 'buff', dur: 7, atk: 1.45 }] },
  ] },
  { name: '朱元璋', epithet: '明太祖', cls: 'fighter', color: '#a33b36', rig: 'brute', tagline: '越打越硬的草根', skills: [
    { name: '劈山', glyph: '劈', desc: '大刀横劈，重创面前的敌人。', cd: 6, aim: 'dir', range: 240, fx: [{ t: 'cone', radius: 255, arc: 1.7, dmg: [250, 34, 1] }] },
    { name: '屯田', glyph: '屯', desc: '大量回复生命并短暂加速。', cd: 13, aim: 'self', range: 300, fx: [{ t: 'buff', dur: 3, heal: [380, 52, 0.6], speed: 1.15 }] },
    { name: '洪武', glyph: '洪', desc: '一声怒喝，晕眩并重创四周敌人。', cd: 40, aim: 'self', range: 340, fx: [{ t: 'blast', radius: 340, delay: 0.4, dmg: [400, 65, 1.1], stun: 1.2 }] },
  ] },
  { name: '曹操', epithet: '魏武帝', cls: 'fighter', color: '#47515c', rig: 'brute', tagline: '以战养战，越杀越回血', skills: [
    { name: '奇袭', glyph: '袭', desc: '突进并减速撞到的敌人。', cd: 7, aim: 'dir', range: 360, fx: [{ t: 'dash', dist: 360, dmg: [200, 28, 0.8], width: 80, slow: 1.5 }] },
    { name: '枭雄', glyph: '枭', desc: '横扫四周，并在数秒内普攻吸血。', cd: 10, aim: 'self', range: 280, fx: [{ t: 'blast', radius: 290, delay: 0.2, dmg: [260, 34, 0.9] }, { t: 'buff', dur: 5, lifesteal: 0.45 }] },
    { name: '挟天子', glyph: '挟', desc: '获得护盾，攻击与吸血大幅提升。', cd: 40, aim: 'self', range: 300, fx: [{ t: 'buff', dur: 7, atk: 1.45, lifesteal: 0.3, shield: [440, 65, 0.6] }] },
  ] },
  { name: '赵匡胤', epithet: '宋太祖', cls: 'tank', color: '#53735c', rig: 'soldier', tagline: '先手开团的铁壁', skills: [
    { name: '长拳', glyph: '拳', desc: '一拳震晕面前的敌人。', cd: 8, aim: 'dir', range: 200, fx: [{ t: 'cone', radius: 215, arc: 1.6, dmg: [210, 28, 0.8], stun: 0.7 }] },
    { name: '杯酒', glyph: '酒', desc: '让四周敌人大幅减速。', cd: 11, aim: 'self', range: 300, fx: [{ t: 'blast', radius: 300, delay: 0.25, dmg: [180, 26, 0.6], slow: 2.5 }] },
    { name: '黄袍加身', glyph: '袍', desc: '披上护盾长驱直入，撞晕沿途所有敌人。', cd: 40, aim: 'dir', range: 520, fx: [{ t: 'buff', dur: 4, shield: [360, 54, 0.5] }, { t: 'dash', dist: 520, dmg: [280, 46, 0.9], width: 100, stun: 0.9 }] },
  ] },
  { name: '刘彻', epithet: '汉武帝', cls: 'marksman', color: '#6a4b88', rig: 'archer', tagline: '隔着半个战场取人性命', skills: [
    { name: '推恩箭', glyph: '恩', desc: '射出一支减速箭。', cd: 6, aim: 'dir', range: 820, fx: [{ t: 'shot', speed: 1200, range: 840, width: 60, dmg: [290, 38, 1.1], slow: 2 }] },
    { name: '骠骑', glyph: '骠', desc: '快速位移，随后攻速大增。', cd: 10, aim: 'dir', range: 330, fx: [{ t: 'dash', dist: 330 }, { t: 'buff', dur: 3, aspd: 1.5 }] },
    { name: '封狼居胥', glyph: '狼', desc: '一支贯穿全场的重箭，穿透沿途所有敌人。', cd: 40, aim: 'dir', range: 1500, fx: [{ t: 'shot', speed: 1600, range: 1500, width: 130, dmg: [640, 100, 1.6], pierce: true }] },
  ] },
  { name: '武曌', epithet: '武则天', cls: 'mage', color: '#8c3d68', rig: 'player', tagline: '把战场划成她的棋盘', skills: [
    { name: '制诏', glyph: '诏', desc: '掷出一道诏令，伤害并减速命中的敌人。', cd: 6, aim: 'dir', range: 760, fx: [{ t: 'shot', speed: 950, range: 760, width: 60, dmg: [270, 38, 0.9], slow: 1.2 }] },
    { name: '铜匦', glyph: '匦', desc: '在指定位置引爆，减速范围内的敌人。', cd: 9, aim: 'point', range: 600, fx: [{ t: 'blast', radius: 210, delay: 0.45, dmg: [270, 38, 0.9], slow: 2 }] },
    { name: '日月当空', glyph: '曌', desc: '在一大片区域持续灼烧并减速敌人。', cd: 40, aim: 'point', range: 650, fx: [{ t: 'zone', radius: 290, duration: 4, dmg: [110, 16, 0.3], slow: 0.6 }] },
  ] },
  { name: '朱棣', epithet: '永乐帝', cls: 'fighter', color: '#3f6d78', rig: 'player', tagline: '从天而降的突袭者', skills: [
    { name: '奔袭', glyph: '奔', desc: '向前突进并伤害沿途敌人。', cd: 7, aim: 'dir', range: 400, fx: [{ t: 'dash', dist: 400, dmg: [210, 28, 0.8], width: 80 }] },
    { name: '横扫', glyph: '扫', desc: '大范围横扫并减速。', cd: 6, aim: 'dir', range: 230, fx: [{ t: 'cone', radius: 245, arc: 2.4, dmg: [230, 32, 0.9], slow: 1.2 }] },
    { name: '靖难', glyph: '靖', desc: '瞬间跃至指定位置并震击四周。', cd: 38, aim: 'point', range: 600, fx: [{ t: 'blink' }, { t: 'blast', radius: 270, delay: 0.2, dmg: [410, 68, 1.1] }] },
  ] },
  { name: '司马懿', epithet: '晋宣帝', cls: 'mage', color: '#53636a', rig: 'player', tagline: '忍到最后，一击定局', skills: [
    { name: '锁喉', glyph: '锁', desc: '射出一道暗劲，晕眩沿途所有敌人。', cd: 8, aim: 'dir', range: 720, fx: [{ t: 'shot', speed: 1100, range: 760, width: 65, dmg: [250, 34, 0.85], stun: 0.65, pierce: true }] },
    { name: '蛰伏', glyph: '蛰', desc: '闪现到指定位置，短暂加速并强化攻击。', cd: 9, aim: 'point', range: 420, fx: [{ t: 'blink' }, { t: 'buff', dur: 3, speed: 1.2, atk: 1.15 }] },
    { name: '高平陵', glyph: '陵', desc: '短暂蓄势后在指定位置爆发巨额伤害。', cd: 36, aim: 'point', range: 680, fx: [{ t: 'blast', radius: 270, delay: 0.75, dmg: [560, 90, 1.4] }] },
  ] },
  { name: '忽必烈', epithet: '元世祖', cls: 'marksman', color: '#5b6b43', rig: 'archer', tagline: '用泥沼和箭雨控住整条路', skills: [
    { name: '鸣镝', glyph: '镝', desc: '射出一支响箭。', cd: 6, aim: 'dir', range: 800, fx: [{ t: 'shot', speed: 1100, range: 800, width: 50, dmg: [230, 32, 0.9] }] },
    { name: '泥沼', glyph: '沼', desc: '在指定位置留下一片减速泥沼。', cd: 11, aim: 'point', range: 600, fx: [{ t: 'zone', radius: 220, duration: 3, dmg: [40, 6, 0.15], slow: 0.6 }] },
    { name: '四海', glyph: '海', desc: '箭雨覆盖一大片区域，伤害并减速。', cd: 40, aim: 'point', range: 800, fx: [{ t: 'blast', radius: 290, delay: 0.85, dmg: [420, 70, 1.2], slow: 2 }] },
  ] },
  { name: '铁木真', epithet: '成吉思汗', cls: 'marksman', color: '#6d7352', rig: 'archer', tagline: '边跑边射，谁也追不上', skills: [
    { name: '驰射', glyph: '驰', desc: '快速位移，随后移速与攻速提升。', cd: 7, aim: 'dir', range: 300, fx: [{ t: 'dash', dist: 300 }, { t: 'buff', dur: 3, speed: 1.25, aspd: 1.35 }] },
    { name: '连珠', glyph: '珠', desc: '扇形射出五支穿透箭。', cd: 7, aim: 'dir', range: 700, fx: [{ t: 'shot', speed: 1100, range: 720, width: 50, dmg: [150, 20, 0.55], count: 5, spread: 0.13, pierce: true }] },
    { name: '万户', glyph: '万', desc: '攻速与移速在数秒内暴涨，并获得吸血。', cd: 38, aim: 'self', range: 500, fx: [{ t: 'buff', dur: 6, aspd: 1.9, speed: 1.3, lifesteal: 0.2 }] },
  ] },
  { name: '嬴政', epithet: '秦始皇', cls: 'mage', color: '#b64b3b', rig: 'player', tagline: '律令所至，无人能立', skills: [
    { name: '律令', glyph: '律', desc: '射出一道穿透一切敌人的律令。', cd: 6, aim: 'dir', range: 780, fx: [{ t: 'shot', speed: 900, range: 780, width: 60, dmg: [210, 30, 0.8], pierce: true }] },
    { name: '筑城', glyph: '筑', desc: '在指定位置筑起减速并灼伤敌人的城垣。', cd: 11, aim: 'point', range: 560, fx: [{ t: 'zone', radius: 190, duration: 3, dmg: [42, 7, 0.15], slow: 0.6 }] },
    { name: '俑阵', glyph: '俑', desc: '兵马俑破土而出，重创并晕眩一大片敌人。', cd: 38, aim: 'point', range: 700, fx: [{ t: 'blast', radius: 260, delay: 0.9, dmg: [470, 74, 1.2], stun: 0.9 }] },
  ] },
]
export const heroByName = (name: string) => HEROES.find(h => h.name === name) ?? HEROES[0]

// ---- items ----
export type ItemDef = { id: string; name: string; glyph: string; cost: number; desc: string; atk?: number; hp?: number; armor?: number; speed?: number; aspd?: number; lifesteal?: number; cdr?: number }
export const ITEMS: ItemDef[] = [
  { id: 'sword', name: '环首刀', glyph: '刀', cost: 300, desc: '攻击 +35', atk: 35 },
  { id: 'armor', name: '札甲', glyph: '甲', cost: 300, desc: '生命 +380 · 护甲 +15', hp: 380, armor: 15 },
  { id: 'boots', name: '快靴', glyph: '靴', cost: 280, desc: '移速 +40', speed: 40 },
  { id: 'bow', name: '连弩', glyph: '弩', cost: 720, desc: '攻击 +45 · 攻速 +30%', atk: 45, aspd: 0.3 },
  { id: 'blade', name: '饮血刀', glyph: '血', cost: 780, desc: '攻击 +80 · 普攻吸血 12%', atk: 80, lifesteal: 0.12 },
  { id: 'plate', name: '明光铠', glyph: '铠', cost: 780, desc: '生命 +900 · 护甲 +45', hp: 900, armor: 45 },
  { id: 'tally', name: '虎符', glyph: '符', cost: 700, desc: '攻击 +40 · 生命 +300 · 冷却 −20%', atk: 40, hp: 300, cdr: 0.2 },
  { id: 'seal', name: '传国玉玺', glyph: '玺', cost: 1400, desc: '攻击 +110 · 生命 +600 · 冷却 −10%', atk: 110, hp: 600, cdr: 0.1 },
]
export const itemById = (id: string) => ITEMS.find(i => i.id === id)!
export const MAX_ITEMS = 6
/** Recommended build order; also what the AI buys. */
export const BUILDS: Record<HeroClass, string[]> = {
  tank: ['armor', 'boots', 'plate', 'tally', 'blade', 'seal'],
  fighter: ['sword', 'boots', 'blade', 'plate', 'tally', 'seal'],
  mage: ['sword', 'boots', 'tally', 'seal', 'plate', 'blade'],
  marksman: ['sword', 'boots', 'bow', 'blade', 'seal', 'plate'],
}

export const DIFFICULTIES = [
  { id: 0, name: '新兵', note: '敌将反应慢、下手轻，适合熟悉操作', enemy: 0.85, react: 0.9, nerve: 0.85 },
  { id: 1, name: '校尉', note: '势均力敌，胜负看你', enemy: 1, react: 0.5, nerve: 1 },
  { id: 2, name: '名将', note: '敌将更强、更快、更敢打', enemy: 1.07, react: 0.25, nerve: 1.1 },
]
