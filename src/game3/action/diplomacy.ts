import { domainFor, type Resources } from '../rules'
import type { Order, WorldEvent } from './orders'

export const CONCESSION_COST = 4
export type CouncilChoice = 'appeal' | 'concede' | 'defer'
export type CouncilAudience = { name: string; concern: string; concession: string; appeal: string; supported: boolean; reason: string }
type Brief = { concern: string; concession: string; appeal: string; pillar: keyof Resources }
type Topic = 'military' | 'supply' | 'commerce' | 'government'
const topics: Record<string, Topic> = {
  't-granary': 'supply', 'f-tuntian': 'supply', 'f-price': 'supply', 'z-supply': 'supply', 'z-flood': 'supply', 'z-locust': 'supply',
  't-salt': 'commerce', 'f-navy': 'commerce', 'w-canal': 'commerce', 'w-hangzhou': 'commerce', 'j-sea': 'commerce', 'j-budget': 'commerce',
  't-veteran': 'military', 't-smith': 'military', 'f-guard': 'military', 'z-general': 'military', 'z-cavalry': 'military', 'j-garrison': 'military',
}
const briefs: Record<Topic, Brief[]> = {
  military: [
    { concern: '兵籍若不清，粮饷会落入冒名者手中。谁来查验这批人？', concession: '拨款设验籍书吏，军户逐一核实', appeal: '以现有属吏公开核验兵籍', pillar: 'politics' },
    { concern: '壮丁都进营，家里的田谁来种？乡里要一份能过日子的安排。', concession: '拨给农具与种粮，补贴留守家庭', appeal: '以现有粮储支持轮番耕种', pillar: 'economy' },
    { concern: '招来的人不会自然成阵。教头、轮值和操练都要有人负责。', concession: '拨饷聘教头，补齐操练器具', appeal: '交给现有军官编伍操练', pillar: 'military' },
  ],
  supply: [
    { concern: '出仓之后怎样销账？有名册与凭据，才不会被说成私分仓粮。', concession: '拨款增设仓吏，逐笔登记', appeal: '凭现有政令公开核验仓簿', pillar: 'politics' },
    { concern: '眼下能救急，来年还得下种。乡里最怕这次之后再无余粮。', concession: '拨款另备种粮，给乡里留余地', appeal: '以现有府库保障后续接济', pillar: 'economy' },
    { concern: '粮车若半路被截，仓里的账再好看也没用。谁来守路？', concession: '增拨护粮脚费，组织沿途接应', appeal: '调现有巡卒接力护粮', pillar: 'military' },
  ],
  commerce: [
    { concern: '商路上的规矩要稳定。沿途若人人伸手，客商不会再来。', concession: '拨款巡查关卡，核对收支', appeal: '凭现有政令整饬沿路关卡', pillar: 'politics' },
    { concern: '通商的好处不能只有大户拿走。普通人也要买得起日用粮盐。', concession: '拨款接济贫户，缓冲物价波动', appeal: '以现有府库维持集市供应', pillar: 'economy' },
    { concern: '路通之后，人货都多了。守军需要保证自己能看住这条路。', concession: '拨给巡路粮饷，增设接应', appeal: '以现有军势保障沿途秩序', pillar: 'military' },
  ],
  government: [
    { concern: '这道决定怎样传到县里？臣要的是能执行的章程与负责的人。', concession: '拨款设专吏，逐县督办', appeal: '交由现有属吏按章推行', pillar: 'politics' },
    { concern: '百姓听过太多好听的承诺。这次谁来负担实施的代价？', concession: '由府库拨给地方实施所需', appeal: '以现有府库承担地方开支', pillar: 'economy' },
    { concern: '政令落地时若有人抗命，军中既要能办事，也要有明确职责。', concession: '拨饷设轮值，落实执行责任', appeal: '以现有军制维持执行秩序', pillar: 'military' },
  ],
}

export function councilAudience(event: WorldEvent | null, order: Order, index: number, realm: Resources): CouncilAudience {
  const domain = event ? domainFor(event.source) : 'political'
  const topic = (event && topics[event.id]) || (domain === 'military' ? 'military' : domain === 'economic' ? 'supply' : 'government')
  const brief = briefs[topic][index] ?? briefs[topic][0]
  const benefit = (order.proposal?.[brief.pillar] ?? 0) as number
  const strong = realm[brief.pillar] >= 56, helps = benefit >= 10
  const pillarName = { military: '军势', politics: '朝局', economy: '府库', destiny: '天命' }[brief.pillar]
  return { ...brief, name: ['行宫文官', '城镇乡老', '关隘军官'][index] ?? '地方代表', supported: strong || helps,
    reason: strong ? `${pillarName}稳健，对方认可现有安排。` : helps ? '这道政令直接回应其所需，对方愿意支持。' : `${pillarName}尚不足以作保；坚持现有安排，对方将保留意见。` }
}

// Deduct after passive/reward modifiers, on both success and failure.
export function payCouncilCost(resources: Resources, spent: number): Resources {
  const count = Number.isFinite(spent) ? Math.max(0, Math.min(2, Math.floor(spent))) : 0
  return { ...resources, economy: Math.max(0, resources.economy - count * CONCESSION_COST) }
}
