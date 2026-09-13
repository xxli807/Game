import { domainFor, EffectLike } from '../rules'
import { Vec } from './model'

export type OrderKind = 'assault' | 'escort' | 'relief' | 'council' | 'ceremony'
export type WorldOption = { label: string; detail: string; effect: EffectLike; success?: number; reward?: EffectLike }
export type WorldEvent = { id: string; title: string; body: string; source: string; phase: string; options: WorldOption[] }
export type Order = { kind: OrderKind; title: string; brief: string; target: Vec; required: number; pickup?: Vec; deliveries?: Vec[]; cargo?: string; convoy?: 'people' }
export const PLACES = {
  gate: { x: 450, y: 330, name: '关隘', title: '军营 · 城防' },
  granary: { x: 1380, y: 320, name: '粮仓', title: '仓储 · 商路' },
  town: { x: 900, y: 915, name: '城镇', title: '民生 · 朝政' },
  court: { x: 950, y: 240, name: '行宫', title: '人才 · 盟约' },
  altar: { x: 390, y: 850, name: '祭坛', title: '诏令 · 天命' },
}
// Stable event IDs and option indices distinguish peaceful and forceful approaches.
// New events still receive a playable order from their existing effect/domain metadata.
const OVERRIDES: Record<string, OrderKind[]> = {
  't-temple': ['relief', 'relief'], 't-warrant': ['escort', 'ceremony'], 't-lotus': ['ceremony', 'council'],
  't-deserters': ['relief', 'relief'], 't-snow': ['escort', 'assault'], 't-smith': ['council', 'escort'],
  't-salt': ['escort', 'council'], 't-feud': ['assault', 'council'], 't-diviner': ['ceremony', 'council'],
  't-granary': ['escort', 'council'], 't-veteran': ['council', 'council'], 't-children': ['escort', 'escort'],
  't-physician': ['relief', 'relief'], 't-scholar': ['council', 'relief'], 't-river': ['council', 'relief'],
  't-teller': ['council', 'council'], 't-spoils': ['relief', 'escort'], 't-banner': ['ceremony', 'ceremony'],
  'f-tuntian': ['relief', 'escort'], 'f-tax': ['ceremony', 'ceremony'], 'f-discipline': ['ceremony', 'relief'],
  'f-marry-guan': ['ceremony', 'escort'], 'f-marry-liao': ['ceremony', 'escort'], 'f-marry-salt': ['ceremony', 'council'],
  'f-mint': ['relief', 'escort'], 'f-navy': ['council', 'escort'], 'f-guard': ['council', 'council'],
  'f-wall': ['relief', 'relief'], 'f-school': ['relief', 'council'], 'f-lawsuit': ['council', 'council'],
  'f-official': ['council', 'council'], 'f-price': ['council', 'relief'], 'f-stockade': ['ceremony', 'council'],
  'f-hospital': ['relief', 'relief'], 'f-spies': ['council', 'council'], 'f-rite': ['ceremony', 'ceremony'],
  'z-field': ['assault', 'council'], 'z-alliance': ['ceremony', 'council'], 'z-supply': ['escort', 'assault'],
  'z-siege': ['council', 'assault'], 'z-defect': ['council', 'council'], 'z-plague': ['relief', 'escort'],
  'z-scorch': ['escort', 'relief'], 'z-prisoners': ['council', 'escort'], 'z-rumor': ['relief', 'council'],
  'z-flood': ['council', 'council'], 'z-cannon': ['escort', 'escort'], 'z-cavalry': ['council', 'council'],
  'z-mole': ['council', 'council'], 'z-winter': ['assault', 'relief'], 'z-pass': ['assault', 'escort'],
  'z-general': ['council', 'council'], 'z-marry-general': ['ceremony', 'council'], 'z-locust': ['relief', 'relief'],
  'w-king': ['ceremony', 'council'], 'w-scholars': ['council', 'council'], 'w-prince': ['ceremony', 'council'],
  'w-marry-royal': ['ceremony', 'council'], 'w-canal': ['assault', 'council'], 'w-parley': ['ceremony', 'council'],
  'w-massacre': ['assault', 'relief'], 'w-seal': ['ceremony', 'ceremony'], 'w-era': ['ceremony', 'ceremony'],
  'w-warlord': ['council', 'council'], 'w-heir': ['ceremony', 'council'], 'w-capital': ['ceremony', 'ceremony'],
  'w-hangzhou': ['council', 'escort'], 'w-border': ['ceremony', 'relief'], 'w-heaven': ['ceremony', 'council'],
  'w-nightraid': ['assault', 'council'], 'w-officials': ['council', 'ceremony'],
  'j-rewards': ['relief', 'ceremony'], 'j-land': ['ceremony', 'council'], 'j-code': ['ceremony', 'ceremony'],
  'j-exam': ['council', 'council'], 'j-eunuch': ['council', 'council'], 'j-garrison': ['council', 'council'],
  'j-loyalists': ['council', 'council'], 'j-historian': ['ceremony', 'council'], 'j-budget': ['council', 'council'],
  'j-amnesty': ['ceremony', 'ceremony'], 'j-migrate': ['escort', 'relief'], 'j-raid': ['assault', 'council'],
  'j-treasury': ['escort', 'relief'], 'j-sea': ['escort', 'ceremony'], 'j-river': ['relief', 'relief'],
  'j-court': ['council', 'ceremony'], 'j-oldgeneral': ['council', 'council'], 'j-westland': ['escort', 'council'],
  'j-lingnan': ['council', 'council'],
  station: ['assault', 'relief'], oath: ['council', 'ceremony'], salt: ['escort', 'assault'],
  general: ['council', 'assault'], marriage: ['ceremony', 'council'], army: ['assault', 'assault'],
  city: ['assault', 'assault'], foreign: ['escort', 'escort'], famine: ['relief', 'escort'],
  spy: ['council', 'council'], imperial: ['ceremony', 'ceremony'], capital: ['assault', 'council'],
  edict: ['ceremony', 'council'], newlaw: ['relief', 'assault'], plague: ['relief', 'relief'],
  arrow: ['assault', 'council'], palace: ['council', 'council'], founding: ['ceremony', 'ceremony'],
  'challenge-1': ['escort', 'escort'], 'challenge-2': ['assault', 'council'],
  'challenge-3': ['assault', 'council'], 'challenge-4': ['assault', 'council'], 'challenge-5': ['assault', 'council'],
}
export function eventPlace(event: WorldEvent) {
  if (event.id === 'challenge-2') return PLACES.granary
  if (event.id.startsWith('challenge-')) return event.id === 'challenge-5' ? PLACES.court : PLACES.gate
  const domain = domainFor(event.source)
  return domain === 'military' ? PLACES.gate : domain === 'economic' ? PLACES.granary : domain === 'political' ? PLACES.court : PLACES.altar
}
export function orderFor(event: WorldEvent, index: number): Order {
  const option = event.options[index], effect = option.reward ?? option.effect, domain = domainFor(event.source)
  const kind = OVERRIDES[event.id]?.[index] ?? (effect.city && !effect.death ? 'assault' : effect.talent || effect.spouse ? 'council' : domain === 'military' ? 'assault' : domain === 'economic' ? 'relief' : domain === 'political' ? 'council' : 'ceremony')
  const config: Record<OrderKind, Omit<Order, 'kind' | 'title'>> = {
    assault: { brief: '前往关隘，击退驻防军，再留在旗帜旁接管防务。红色预警落下前闪避。', target: PLACES.gate, required: 1 },
    escort: { brief: '到粮仓接应辎重车，沿商路护送到城镇。靠近车队才会继续前进；击退沿途劫匪。', target: PLACES.town, required: 1 },
    relief: { brief: '从粮仓领取物资，亲自送到三处民居。每次携带一份；靠近光标按 E 或「交互」。', target: PLACES.granary, required: 3 },
    council: { brief: '在行宫、城镇与关隘拜访三方代表。靠近使者交互，依次处理他们的诉求，让这道决定落地。', target: PLACES.court, required: 3 },
    ceremony: { brief: '到行宫领取文书，将它带到祭坛。按住交互，在游标进入金色区间时松开，完成三次礼制校准。', target: PLACES.altar, required: 3 },
  }
  const order: Order = { kind, title: option.label, ...config[kind] }
  if (kind === 'assault' && event.id === 'challenge-2') { order.target = PLACES.granary; order.brief = '前往粮仓，击退守军，再留在旗帜旁接管仓储。' }
  if (kind === 'escort' && ['t-children', 't-warrant', 'z-prisoners', 'j-migrate', 'challenge-1'].includes(event.id)) {
    order.convoy = 'people'; order.pickup = { x: 540, y: 440 }
    if (event.id === 't-children' && index === 0) order.target = { x: 1290, y: 430 }
    order.brief = '到关隘旁接应随行人员，亲自护送到目的地。保持在队伍附近，并击退拦路的敌兵。'
  }
  if (kind === 'relief') {
    order.cargo = ['f-hospital', 't-physician', 'z-plague', 'plague'].includes(event.id) ? '药材' : event.id === 'f-wall' ? '修墙木料' : event.id === 'f-school' ? '义学物资' : ['t-spoils', 't-river', 'f-mint'].includes(event.id) ? '款项' : '救济物资'
    if (event.id === 'f-wall') order.deliveries = [{ x: 300, y: 345 }, { x: 450, y: 490 }, { x: 600, y: 340 }]
    order.brief = `到粮仓领取${order.cargo}，送到三处标记。每次携带一份；靠近光标按 E 或「交互」。`
  }
  return order
}
export const KIND_NAMES: Record<OrderKind, string> = { assault: '统兵行动', escort: '护送辎重', relief: '安民施政', council: '朝野交涉', ceremony: '礼制诏令' }
