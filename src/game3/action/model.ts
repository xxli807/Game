import type { ArmyCommand } from './army'
import type { ContactId, VillageStory } from './stories'
import type { CouncilAudience } from './diplomacy'
export const WORLD = { width: 1800, height: 1200 }
export type Status = 'playing' | 'paused' | 'decision' | 'orderdone' | 'audience' | 'story'
export type Skill = 'dash' | 'storm' | 'volley'
export type Vec = { x: number; y: number }
export type Enemy = Vec & { id: number; kind: 'soldier' | 'archer' | 'brute'; hp: number; maxHp: number; speed: number; radius: number; cooldown: number; windup: number; target: Vec; flash: number; step: number }
export type City = Vec & { name: string; title: string; progress: number; owned: boolean }
export type Particle = Vec & { vx: number; vy: number; life: number; maxLife: number; size: number; color: string }
export type Projectile = Vec & { vx: number; vy: number; life: number; friendly: boolean; damage: number }
export type FloatText = Vec & { text: string; life: number; color: string }
export type Slash = Vec & { angle: number; radius: number; life: number; maxLife: number; circle: boolean }
export type Snapshot = {
  status: Status; hp: number; maxHp: number; kills: number; seconds: number; captured: number;
  cities: City[]; cooldowns: Record<Skill, number>; objective: string; notice: string; orderProgress: number; orderRequired: number; orderKind: string; orderSuccess: boolean; carrying: boolean; canInteract: boolean; interactLabel: string; worldChange: string; ritual: number; audience: number;
  army: { allies: number; enemies: number; command: ArmyCommand; field: boolean; available: boolean; units: (Vec & { friendly: boolean })[] };
  player: Vec; facing: number; enemyCount: number;
  combat: { stamina: number; guarding: boolean; combo: number; counter: boolean; closeCamera: boolean };
  storyLog: string[]; story: VillageStory | null; activeStory: VillageStory | null; contacts: (Vec & { id: ContactId; name: string; available: boolean; completed: boolean; tracked: boolean })[];
  cargoCount: number; deliveries: (Vec & { name: string; complete: boolean; target: boolean })[];
  councilBudget: number; councilSpent: number; councilSupport: number; councilAudience: CouncilAudience | null;
}
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y)
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
