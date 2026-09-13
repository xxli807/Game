import { PLACES } from './orders'
import { clamp, distance, Vec, WORLD } from './model'

// The engine keeps its 1800 × 1200 plane; the 3D renderer lifts it into X/Z at 25 px per unit,
// so rules and the headless regression never depend on the renderer.
export const UNIT = 25
export type Building = { x: number; y: number; width: number; depth: number; kind: 'gate' | 'hall' | 'granary' | 'house' | 'altar'; name?: string }
export type Circle = Vec & { r: number }
export type Box = Vec & { width: number; depth: number }

// Delivery doorsteps. Each house stands just north of its doorstep so the facade faces the default camera,
// and the gaps beside the town hall stay wide enough for a wagon.
export const HOMES = [{ x: 640, y: 820 }, { x: 1170, y: 830 }, { x: 1180, y: 1060 }]
export const ENVOYS = [{ x: 1030, y: 275 }, { x: 990, y: 960 }, { x: 540, y: 360 }]
export const BUILDINGS: Building[] = [
  ...Object.entries(PLACES).map(([key, p]) => ({ x: p.x, y: p.y - 115, width: key === 'gate' ? 240 : 220, depth: 145, kind: (key === 'gate' ? 'gate' : key === 'granary' ? 'granary' : key === 'altar' ? 'altar' : 'hall') as Building['kind'], name: p.name })),
  ...HOMES.map(p => ({ x: p.x, y: p.y - 82, width: 115, depth: 90, kind: 'house' as const })),
  { x: 560, y: 1070, width: 130, depth: 100, kind: 'house' },
  { x: 1430, y: 1060, width: 130, depth: 100, kind: 'house' },
]
export const STALLS: Box[] = [760, 840, 920, 1000, 1080].map(x => ({ x, y: 1112, width: 62, depth: 40 }))
export const WELL: Circle = { x: 800, y: 1000, r: 30 }
export const POND: Circle = { x: 1520, y: 820, r: 95 }
// Trees inside the walkable field are solid; the forest band beyond the palisade is scenery only.
export const GROVE: Circle[] = [
  [230, 640], [175, 760], [250, 1010], [330, 1110], [650, 230], [720, 170], [1160, 150], [1640, 200], [1700, 330],
  [1660, 980], [1560, 1090], [1740, 700], [1410, 700], [1630, 900], [140, 470], [160, 230], [1250, 1150],
].map(([x, y]) => ({ x, y, r: 20 }))

// Roads double as wagon routes and villager paths; the ground texture paints the same edges.
export const ROAD_NODES: Vec[] = [
  { x: 450, y: 360 }, { x: 560, y: 440 }, { x: 950, y: 270 }, { x: 900, y: 590 }, { x: 1380, y: 350 }, { x: 1290, y: 450 },
  { x: 743, y: 640 }, { x: 743, y: 900 }, { x: 1061, y: 640 }, { x: 1061, y: 900 }, { x: 900, y: 930 }, { x: 390, y: 860 },
  { x: 1320, y: 900 }, { x: 900, y: 1050 }, { x: 1580, y: 560 }, { x: 1300, y: 1040 }, { x: 1180, y: 1095 },
]
export const ROAD_EDGES: [number, number][] = [
  [0, 1], [0, 2], [1, 3], [1, 6], [2, 3], [2, 4], [4, 5], [5, 3], [3, 6], [3, 8], [6, 7], [8, 9], [7, 10], [9, 10],
  [11, 7], [11, 0], [5, 12], [12, 9], [10, 13], [4, 14], [14, 12], [12, 15], [15, 16],
]

const inBox = (p: Vec, b: Box, radius: number) => Math.abs(p.x - b.x) < b.width / 2 + radius && Math.abs(p.y - b.y) < b.depth / 2 + radius
const solids = (): Box[] => [...BUILDINGS.filter(b => b.kind !== 'altar'), ...STALLS]
const circles = (): Circle[] => [WELL, POND, ...GROVE]
function blocker(p: Vec, radius: number): Box | Circle | undefined {
  return solids().find(b => inBox(p, b, radius)) ?? circles().find(c => distance(p, c) < c.r + radius)
}
export const blocked = (p: Vec, radius = 17) => Boolean(blocker(p, radius))

export function moveWithCollisions(point: Vec, dx: number, dy: number, radius = 17): Vec {
  const bound = (v: number, max: number) => clamp(v, radius + 35, max - radius - 35)
  const next = { x: bound(point.x + dx, WORLD.width), y: point.y }
  if (blocked(next, radius)) next.x = point.x
  next.y = bound(point.y + dy, WORLD.height)
  if (blocked(next, radius)) next.y = point.y
  // Head-on pushes: round obstacles are skirted, and a wall is rounded only near its corner,
  // so walking into a wall still stops you but clipping a corner does not snag.
  const wanted = Math.hypot(dx, dy), moved = Math.hypot(next.x - point.x, next.y - point.y)
  if (wanted > 0 && moved < wanted * .3) {
    const hit = blocker({ x: point.x + dx / wanted * (wanted + 3), y: point.y + dy / wanted * (wanted + 3) }, radius)
    if (hit) {
      // Slide strictly along one axis, so rounding can never nudge the walker into the face.
      const alongX = Math.abs(dy) >= Math.abs(dx), offset = alongX ? point.x - hit.x : point.y - hit.y, side = Math.abs(offset) > .01 ? Math.sign(offset) : 1
      const edge = 'r' in hit ? 0 : (alongX ? hit.width : hit.depth) / 2 + radius - Math.abs(offset)
      const slide = alongX ? { x: bound(point.x + side * wanted, WORLD.width), y: point.y } : { x: point.x, y: bound(point.y + side * wanted, WORLD.height) }
      if (edge < 26 && !blocked(slide, radius)) return slide
    }
  }
  return next
}
export function freeSpot(p: Vec, radius = 17): Vec {
  if (!blocked(p, radius)) return p
  for (let r = 12; r < 400; r += 12) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    const q = { x: clamp(p.x + Math.cos(a) * r, 60, WORLD.width - 60), y: clamp(p.y + Math.sin(a) * r, 60, WORLD.height - 60) }
    if (!blocked(q, radius)) return q
  }
  return p
}
export const nearestNode = (p: Vec) => ROAD_NODES.reduce((best, node, i) => distance(node, p) < distance(ROAD_NODES[best], p) ? i : best, 0)
export const neighbours = (node: number) => ROAD_EDGES.flatMap(([a, b]) => a === node ? [b] : b === node ? [a] : [])
// Shortest road path; a convoy leaves its pickup, follows roads, then pulls up at the destination.
export function convoyRoute(from: Vec, to: Vec): Vec[] {
  const start = nearestNode(from), goal = nearestNode(to), cost = ROAD_NODES.map(() => Infinity), previous: number[] = []
  const open = new Set(ROAD_NODES.map((_, i) => i)); cost[start] = 0
  while (open.size) {
    const node = [...open].reduce((a, b) => cost[a] <= cost[b] ? a : b); open.delete(node)
    if (node === goal) break
    for (const next of neighbours(node)) {
      const total = cost[node] + distance(ROAD_NODES[node], ROAD_NODES[next])
      if (total < cost[next]) { cost[next] = total; previous[next] = node }
    }
  }
  const path: Vec[] = []
  for (let node: number | undefined = goal; node !== undefined; node = node === start ? undefined : previous[node]) path.unshift({ ...ROAD_NODES[node] })
  return [{ ...from }, ...path, { ...to }]
}
