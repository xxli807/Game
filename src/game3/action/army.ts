import { distance, type Enemy, type Projectile, type Slash, type Vec } from './model'
import { freeSpot, moveWithCollisions } from './layout'

export type ArmyCommand = 'advance' | 'follow' | 'hold'
export type Ally = Enemy & { heading: number; swing: number; home: Vec; moving: boolean; opponent?: Enemy }
export const COMMANDS: { id: ArmyCommand; key: string; label: string }[] = [{ id: 'advance', key: '1', label: '全军进攻' }, { id: 'follow', key: '2', label: '随我突进' }, { id: 'hold', key: '3', label: '原地坚守' }]

export function musterAllies(center: Vec): Ally[] {
  return Array.from({ length: 10 }, (_, i) => {
    const at = freeSpot({ x: center.x + (i < 7 ? (i % 4 - 1.5) * 52 : (i - 8) * 62), y: center.y + (i < 4 ? 0 : i < 7 ? 46 : 115) }, 15)
    return { ...at, id: i, kind: i >= 7 ? 'archer' : 'soldier', hp: 72, maxHp: 72, radius: 15, speed: 92, cooldown: .3 + (i % 3) * .2, windup: 0, target: { ...at }, flash: 0, step: i, heading: Math.PI, swing: 0, home: { ...at }, moving: false }
  })
}

export function updateAllies(allies: Ally[], enemies: Enemy[], player: Vec, command: ArmyCommand, dt: number, damage: (enemy: Enemy, amount: number, source: Vec) => void, projectiles: Projectile[], slashes: Slash[]) {
  const engagements = new Map<number, number>()
  for (const ally of allies) {
    if (ally.hp <= 0) continue
    ally.cooldown -= dt; ally.flash = Math.max(0, ally.flash - dt); ally.swing = Math.max(0, ally.swing - dt); ally.moving = false
    let target: Enemy | undefined, nearest = Infinity
    for (const enemy of enemies) {
      const score = distance(ally, enemy) + (engagements.get(enemy.id) ?? 0) * 48
      if (enemy.hp > 0 && score < nearest) { target = enemy; nearest = score }
    }
    if (target) engagements.set(target.id, (engagements.get(target.id) ?? 0) + 1)
    const archer = ally.kind === 'archer', reach = archer ? 340 : 92
    if (ally.windup > 0) {
      ally.windup = Math.max(0, ally.windup - dt)
      if (!ally.windup && ally.opponent && ally.opponent.hp > 0) {
        const foe = ally.opponent, angle = Math.atan2(foe.y - ally.y, foe.x - ally.x)
        ally.swing = .3; ally.cooldown = archer ? 2.2 : 1.05
        if (archer) projectiles.push({ x: ally.x, y: ally.y, vx: Math.cos(angle) * 370, vy: Math.sin(angle) * 370, life: 1.3, damage: 12, friendly: true })
        else if (distance(ally, foe) < reach + 16) { damage(foe, 14, ally); slashes.push({ ...ally, angle, radius: 62, life: .14, maxLife: .14, circle: false }) }
        ally.opponent = undefined
      }
    } else if (target && distance(ally, target) < reach && ally.cooldown <= 0) {
      ally.heading = Math.atan2(target.x - ally.x, target.y - ally.y)
      ally.opponent = target; ally.windup = archer ? .6 : .32
    }
    const slot = { x: player.x + (ally.id % 5 - 2) * 42, y: player.y + 55 + Math.floor(ally.id / 5) * 40 }
    const goal = command === 'hold' ? ally.home : command === 'follow' ? slot : target ?? slot
    const d = distance(ally, goal), stop = command === 'advance' && target ? reach * .72 : 12
    if (archer && target && distance(ally, target) < 130 && command !== 'hold' && ally.windup <= 0) {
      const away = Math.max(1, distance(ally, target))
      Object.assign(ally, moveWithCollisions(ally, (ally.x - target.x) / away * ally.speed * dt, (ally.y - target.y) / away * ally.speed * dt, ally.radius))
      ally.moving = true; ally.step += dt * 9
    } else if (d > stop && ally.swing <= 0 && ally.windup <= 0) {
      const step = Math.min(d, ally.speed * dt), dx = (goal.x - ally.x) / d, dy = (goal.y - ally.y) / d
      Object.assign(ally, moveWithCollisions(ally, dx * step, dy * step, ally.radius))
      ally.heading = Math.atan2(dx, dy); ally.step += dt * 10; ally.moving = true
    }
    for (const other of allies) if (other.id > ally.id && other.hp > 0) {
      const d = distance(ally, other)
      if (d > 0 && d < 39) { const push = (39 - d) * .5; const x = (ally.x - other.x) / d * push, y = (ally.y - other.y) / d * push; Object.assign(ally, moveWithCollisions(ally, x, y, 15)); Object.assign(other, moveWithCollisions(other, -x, -y, 15)) }
    }
  }
}
