import { quality, Resources } from '../rules'
import { Order, PLACES, WorldEvent } from './orders'
import { distance, Vec } from './model'
import { ENVOYS, HOMES, ROAD_NODES, STALLS, convoyRoute, freeSpot, moveWithCollisions, nearestNode, neighbours } from './layout'

// The village is the visible half of every dynasty choice: who walks the roads, what they gather around,
// what they say, and what stays standing after an order is carried out. Purely derived from engine state.
export type Role = 'farmer' | 'elder' | 'child' | 'merchant' | 'guard' | 'settler' | 'official' | 'protester'
export type Mood = 'calm' | 'afraid' | 'cheer' | 'watch'
export type Villager = Vec & { id: number; role: Role; tint: string; home: Vec; goal: Vec; node: number; post?: Vec; speed: number; step: number; heading: number; wait: number; stuck: number; mood: Mood; talk: number; line: string; moving: boolean; dest?: Vec; path: Vec[] }
export type LegacyKind = 'garrison' | 'scorched' | 'supplies' | 'wreck' | 'settlers' | 'clinic' | 'rampart' | 'school' | 'treasury' | 'kitchen' | 'aid' | 'pavilion' | 'protest' | 'stele'
export type Legacy = Vec & { id: number; kind: LegacyKind; title: string; count: number }
export type Realm = Record<keyof Resources, number>
// Structural view of the engine, so the village never imports it.
export type WorldState = { player: Vec; enemies: Vec[]; order: Order | null; carrying: boolean; orderProgress: number; status: string; orderSuccess: boolean }

const BANDS = ['危殆', '疲弱', '尚可', '稳健', '鼎盛']
export const band = (value: number) => BANDS.indexOf(quality(value)) + 1
export const ROLE_NAMES: Record<Role, string> = { farmer: '农人', elder: '乡老', child: '孩童', merchant: '商贩', guard: '巡卒', settler: '新来的流民', official: '属吏', protester: '请愿百姓' }
const TINTS: Record<Role, string[]> = {
  farmer: ['#8c7a55', '#6f7a5c', '#7d6a4f'], elder: ['#6c6a5e', '#857a66'], child: ['#a3704f', '#7b8c62'], merchant: ['#6a5a86', '#8a5a3c', '#476d78'],
  guard: ['#3e5c4c'], settler: ['#8d8069', '#766b58'], official: ['#33474f'], protester: ['#8a7057', '#6d6250'],
}
const DOORS = [...HOMES, { x: 560, y: 1140 }, { x: 1430, y: 1132 }]
const SLOTS: Record<LegacyKind, Vec[]> = {
  garrison: [{ x: 380, y: 405 }, { x: 525, y: 405 }, { x: 315, y: 470 }, { x: 610, y: 480 }, { x: 260, y: 385 }],
  scorched: [{ x: 500, y: 470 }, { x: 395, y: 480 }, { x: 610, y: 420 }, { x: 330, y: 425 }],
  supplies: [{ x: 700, y: 950 }, { x: 1050, y: 1020 }, { x: 650, y: 1000 }, { x: 1100, y: 955 }],
  wreck: [],
  settlers: [{ x: 480, y: 950 }, { x: 250, y: 1100 }, { x: 1320, y: 1130 }, { x: 1600, y: 1100 }],
  clinic: [{ x: 330, y: 620 }, { x: 1560, y: 1010 }],
  rampart: [],
  school: [{ x: 760, y: 380 }, { x: 1150, y: 600 }],
  treasury: [{ x: 1220, y: 380 }, { x: 1500, y: 420 }],
  kitchen: [{ x: 1040, y: 1010 }, { x: 700, y: 1045 }],
  aid: [],
  pavilion: [{ x: 790, y: 225 }, { x: 1110, y: 370 }, { x: 700, y: 170 }, { x: 1200, y: 400 }],
  protest: [{ x: 1000, y: 335 }],
  stele: [{ x: 300, y: 790 }, { x: 480, y: 790 }, { x: 270, y: 905 }, { x: 510, y: 905 }, { x: 330, y: 965 }, { x: 450, y: 965 }],
}
const PROTEST_SPOTS = [{ x: 900, y: 330 }, { x: 960, y: 345 }, { x: 1020, y: 330 }, { x: 870, y: 360 }, { x: 990, y: 375 }, { x: 930, y: 385 }]
const PATROL = [0, 1, 3, 2]
const WORLD_CHANGE: Record<LegacyKind, string> = {
  garrison: '关隘升起了你的旗号，两名巡卒留下驻守。', scorched: '关隘前留下焦土，守军仍在，百姓绕道而行。',
  supplies: '辎重在城镇卸下，集市旁堆起了货箱。', wreck: '车队在路上被劫，残车还横在道旁。',
  settlers: '随行的人在村外搭起帐篷，成了新的乡邻。', clinic: '城镇边支起了医帐，药香飘了一条街。',
  rampart: '关隘旁的墙垣补上了新夯的土。', school: '一座义学亭子立了起来，孩子们有了去处。',
  treasury: '粮仓旁多了几口钱箱，商路上的人更多了。', kitchen: '城镇广场架起了粥锅，排队的人不再争抢。',
  aid: '门口放下了物资，屋里的灯重新亮了。', pavilion: '行宫前添了一座议事亭，属吏在此听讼。',
  protest: '行宫前聚起了请愿的百姓，他们不肯散去。', stele: '祭坛旁立起新碑，刻着你颁下的诏令。',
}

export class Village {
  people: Villager[] = []
  legacy: Legacy[] = []
  realm: Realm = { military: 3, politics: 3, economy: 3, destiny: 3 }
  private id = 0
  private legacyId = 0
  private cheer = 0
  private seed = 20260912
  constructor() { this.populate() }
  private random() { this.seed = this.seed * 16807 % 2147483647; return this.seed / 2147483647 }
  private pick<T>(list: T[]) { return list[Math.floor(this.random() * list.length)] }
  setRealm(res: Resources) {
    const next = { military: band(res.military), politics: band(res.politics), economy: band(res.economy), destiny: band(res.destiny) }
    if ((Object.keys(next) as (keyof Realm)[]).every(k => next[k] === this.realm[k])) return
    this.realm = next; this.populate()
  }
  private count(kind: LegacyKind) { return this.legacy.filter(l => l.kind === kind).reduce((n, l) => n + l.count, 0) }
  // Crowd composition follows the realm: markets open with the economy, patrols with the army.
  private populate() {
    const want: Record<Role, number> = {
      farmer: 3 + Math.floor((this.realm.economy + this.realm.politics) / 3), elder: 2, child: 1 + Math.floor(this.realm.destiny / 2),
      merchant: this.realm.economy, guard: Math.max(0, this.realm.military - 1) + this.count('garrison') * 2,
      settler: Math.min(6, this.count('settlers') * 2), official: Math.min(4, this.count('pavilion')), protester: Math.min(6, this.count('protest') * 3),
    }
    for (const role of Object.keys(want) as Role[]) {
      const current = this.people.filter(p => p.role === role)
      for (const extra of current.slice(want[role])) this.people.splice(this.people.indexOf(extra), 1)
      for (let i = current.length; i < want[role]; i++) this.add(role, i)
    }
  }
  private add(role: Role, index: number) {
    const home = DOORS[this.id % DOORS.length]
    const post = role === 'merchant' ? { x: STALLS[index % STALLS.length].x, y: STALLS[index % STALLS.length].y - 42 } : role === 'protester' ? PROTEST_SPOTS[index % PROTEST_SPOTS.length] : undefined
    const start = freeSpot(post ?? (role === 'guard' || role === 'official' ? ROAD_NODES[this.pick([0, 2, 3])] : ROAD_NODES[nearestNode(home)]), 12)
    this.people.push({ ...start, id: this.id++, role, tint: this.pick(TINTS[role]), home, goal: { ...start }, node: nearestNode(start), post, speed: role === 'child' ? 70 : role === 'elder' ? 38 : 52, step: this.random() * 6, heading: Math.PI, wait: this.random() * 3, stuck: 0, mood: 'calm', talk: 0, line: '', moving: false, path: [] })
  }
  near(point: Vec, radius: number) {
    let best: Villager | undefined, d = radius
    for (const v of this.people) if (distance(v, point) < d) { d = distance(v, point); best = v }
    return best
  }
  deliver(order: Order, index: number) {
    const door = (order.deliveries ?? HOMES)[index]
    if (!door) return
    if (order.cargo === '修墙木料') this.place('rampart', order.cargo, { x: door.x, y: door.y - 45 })
    else this.place('aid', order.cargo ?? '救济物资', { x: door.x + 48, y: door.y - 18 })
    for (const v of this.people) if (distance(v.home, door) < 5 || distance(v, door) < 120) { v.mood = 'cheer'; v.wait = 2.5 }
  }
  // Returns one sentence describing what changed, so the HUD can point the player at it.
  record(order: Order, event: WorldEvent | null, success: boolean, wagon: Vec): string {
    const title = order.title || event?.title || ''
    let kind: LegacyKind | undefined
    if (order.kind === 'assault') kind = success ? 'garrison' : 'scorched'
    if (order.kind === 'escort') kind = success ? order.convoy === 'people' ? 'settlers' : 'supplies' : 'wreck'
    if (order.kind === 'relief') kind = order.cargo === '药材' ? 'clinic' : order.cargo === '义学物资' ? 'school' : order.cargo === '款项' ? 'treasury' : order.cargo === '修墙木料' ? 'rampart' : 'kitchen'
    if (order.kind === 'council') kind = success ? 'pavilion' : 'protest'
    if (order.kind === 'ceremony' && success) kind = 'stele'
    if (!kind) return ''
    if (kind !== 'rampart') this.place(kind, title, kind === 'wreck' ? wagon : undefined)
    if (success) this.cheer = 4
    this.populate()
    return WORLD_CHANGE[kind]
  }
  private place(kind: LegacyKind, title: string, at?: Vec) {
    const slots = SLOTS[kind], used = this.legacy.filter(l => l.kind === kind)
    const spot = at ?? slots[used.length % Math.max(1, slots.length)]
    const same = this.legacy.find(l => l.kind === kind && distance(l, spot) < 10)
    if (same) { same.count++; same.title = title; return }
    this.legacy.push({ ...spot, id: this.legacyId++, kind, title, count: 1 })
  }
  update(dt: number, world: WorldState) {
    this.cheer = Math.max(0, this.cheer - dt)
    const queue = this.people.filter(p => p.role !== 'merchant' && p.role !== 'guard' && p.role !== 'protester' && p.role !== 'official' && !HOMES.some(h => distance(h, p.home) < 5))
    for (const v of this.people) {
      v.talk = Math.max(0, v.talk - dt)
      if (v.talk > 0) { v.moving = false; v.heading = Math.atan2(world.player.x - v.x, world.player.y - v.y); continue }
      const threat = world.enemies.find(e => distance(e, v) < 620)
      let goal: Vec | undefined, mood: Mood = 'calm', pace = 1
      if (threat && v.role === 'guard') { goal = { x: world.player.x - 70 + (v.id % 3) * 50, y: world.player.y + 80 }; mood = 'watch'; pace = 2.2 }
      else if (threat) { goal = v.home; mood = 'afraid'; pace = 2.1 }
      else if (this.cheer > 0 && v.role !== 'protester') { mood = 'cheer' }
      else if (v.post) { goal = v.post; mood = v.role === 'protester' ? 'watch' : 'calm' }
      else if (v.role === 'guard' || v.role === 'official') goal = undefined
      else if (world.order?.kind === 'relief') {
        const resident = HOMES.findIndex(h => distance(h, v.home) < 5)
        if (resident >= 0) { goal = { x: v.home.x - 30 + (v.id % 2) * 60, y: v.home.y + 20 }; mood = 'watch' }
        else { const k = queue.indexOf(v); goal = { x: 1330 - k * 28, y: 400 + (k % 2) * 16 }; mood = 'watch' }
      } else if (world.order?.kind === 'council') {
        const envoy = ENVOYS[Math.min(2, world.orderProgress)], a = v.id * 2.4
        goal = { x: envoy.x + Math.cos(a) * 95, y: envoy.y + 40 + Math.abs(Math.sin(a)) * 60 }; mood = 'watch'
      } else if (world.order?.kind === 'ceremony' && world.carrying) {
        const a = .25 + (v.id % 9) / 8 * 2.6
        goal = { x: PLACES.altar.x + Math.cos(a) * 150, y: PLACES.altar.y + 10 + Math.sin(a) * 110 }; mood = 'watch'
      }
      if (mood === 'cheer' || (v.mood === 'cheer' && v.wait > 0 && !threat)) { v.mood = 'cheer'; v.moving = false; v.wait -= dt; v.heading = Math.atan2(world.player.x - v.x, world.player.y - v.y); continue }
      v.mood = mood
      if (!goal) goal = this.wander(v, dt)
      if (!goal) { v.moving = false; continue }
      this.walk(v, goal, pace, dt)
      if (mood === 'watch' && !v.moving) v.heading = v.role === 'protester' ? Math.PI : Math.atan2(world.player.x - v.x, world.player.y - v.y)
    }
  }
  // Road-following wander: pause at a junction, then set off toward a neighbouring one.
  private wander(v: Villager, dt: number): Vec | undefined {
    if (distance(v, v.goal) > 8) return v.goal
    v.wait -= dt
    if (v.wait > 0) return undefined
    const route = v.role === 'guard' ? PATROL : undefined
    const next = route ? route[(route.indexOf(v.node) + 1) % route.length] : this.random() < .18 ? nearestNode(v.home) : this.pick(neighbours(v.node))
    v.node = next; v.wait = 1.2 + this.random() * 3.5
    const jitter = (this.random() - .5) * 60
    v.goal = this.random() < .12 && !route ? { ...v.home } : freeSpot({ x: ROAD_NODES[next].x + jitter, y: ROAD_NODES[next].y + (this.random() - .5) * 50 }, 12)
    return v.goal
  }
  // Long trips follow the roads (like the player's convoys); short hops go straight.
  private walk(v: Villager, goal: Vec, pace: number, dt: number) {
    if (distance(goal, v) < 6) { v.moving = false; return }
    if (!v.dest || distance(v.dest, goal) > 20) { v.dest = { ...goal }; v.path = distance(v, goal) > 160 ? convoyRoute(v, goal).slice(1) : [{ ...goal }] }
    if (v.path.length > 1 && distance(v, v.path[0]) < 12) v.path.shift()
    const step = v.path[0] ?? goal, d = Math.max(.001, distance(v, step))
    const speed = Math.min(d, v.speed * pace * dt), dx = (step.x - v.x) / d * speed, dy = (step.y - v.y) / d * speed
    const next = moveWithCollisions(v, dx, dy, 12)
    const moved = distance(next, v)
    v.stuck = moved < speed * .2 ? v.stuck + dt : 0
    if (v.stuck > 1.2) { v.stuck = 0; v.dest = undefined; v.node = nearestNode(v); v.goal = freeSpot({ ...ROAD_NODES[v.node] }, 12); v.wait = 0 }
    v.x = next.x; v.y = next.y; v.moving = moved > .01; v.step += dt * 9 * pace
    if (v.moving) v.heading = Math.atan2(dx, dy)
  }
  talk(v: Villager, world: WorldState, carryName?: string): string {
    v.talk = 3.2
    const lines: string[] = []
    if (v.role === 'protester') lines.push('衙门说一套做一套，我们要个说法！', '话说得好听，可我们没见到半点好处。', '不给个交代，我们就不走。')
    else if (world.enemies.length) lines.push('快躲起来！那边打起来了！', '大人小心，贼兵就在前面！', '我家门都闩上了，您可千万要赢啊。')
    else if (world.order?.kind === 'relief') lines.push(`听说要发${carryName ?? '物资'}？我家排在后头也行，先顾着病弱的。`, '粮仓那边排了好长的队，总算有盼头了。')
    else if (world.order?.kind === 'council') lines.push('那几位大人都等着您呢，可别说空话。', '您去讲道理吧，大伙儿都在旁边听着。')
    else if (world.order?.kind === 'ceremony') lines.push('要在祭坛颁诏？全村人都想去看看。', '听说新诏令要刻在碑上，子孙都能看见。')
    else if (world.order?.kind === 'escort') lines.push('车队走大路稳当些，那边常有劫道的。', '护着车队的人可得跟紧了。')
    else if (world.order?.kind === 'assault') lines.push('关隘那边的兵不好惹，您多保重。')
    const recent = this.legacy.slice(-3)
    const memory: Record<LegacyKind, string> = {
      garrison: '关隘换了旗号，夜里总算能睡安稳觉了。', scorched: '关隘那一仗没打下来，路上都是焦土。', supplies: '集市那几箱货一到，价钱就落下来了。',
      wreck: '那辆被劫的车还倒在路边，看着就心慌。', settlers: '村外来了新人家，干活勤快，就是口音听不惯。', clinic: '医帐的药救了我娘一命。',
      rampart: '墙补好了，孩子们不用再听见夜里的号角。', school: '我家小子去了义学，回来会念诗了！', treasury: '钱箱一摆，商贩都说这里有规矩。',
      kitchen: '广场上的粥锅是救命的，谁都不用抢。', aid: '门口那袋粮，够我们撑过这个月了。', pavilion: '议事亭里的属吏真能把状子听完。',
      protest: '行宫前那些人还没散呢，衙门得给个说法。', stele: `碑上刻着「${recent.find(l => l.kind === 'stele')?.title ?? '新诏'}」，识字的人念给大家听。`,
    }
    for (const item of recent) lines.push(memory[item.kind])
    if (this.realm.economy <= 2) lines.push('米价又涨了，集市上一半铺子都关着。')
    if (this.realm.economy >= 4) lines.push('集市热闹得很，外乡的货都往这儿来。')
    if (this.realm.military <= 2) lines.push('巡逻的兵越来越少，晚上都不敢出门。')
    if (this.realm.military >= 4) lines.push('关上的兵多了，贼人不敢往这边来。')
    if (this.realm.politics <= 2) lines.push('衙门的告示贴了又撕，谁知道明天听谁的。')
    if (this.realm.destiny <= 2) lines.push('天色一直阴着，老人说天命还没定。')
    if (this.realm.destiny >= 4) lines.push('这几日天光正好，都说是新朝的吉兆。')
    if (!lines.length) lines.push(v.role === 'child' ? '您就是那位要改天换地的人吗？' : v.role === 'guard' ? '属下巡到这边，一切安好。' : '日子总得往下过，您说是不是？')
    v.line = this.pick(lines)
    return `${ROLE_NAMES[v.role]}：「${v.line}」`
  }
}
