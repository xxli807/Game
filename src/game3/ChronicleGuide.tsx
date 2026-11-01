import { foundingReadiness, Resources } from './rules'
import './chronicle-guide.css'

export function FoundingGoal({ resources, warned = false }: { resources: Resources; warned?: boolean }) {
  const goal = foundingReadiness(resources)
  return <section className="founding-goal" aria-label="立国之路">
    <div><b>立国之路</b><span>{goal.count} / 3 根基已稳 · 至少立住两项</span></div>
    <ul>{goal.pillars.map(p => <li className={p.ready ? 'ready' : ''} key={p.key}>{p.ready ? '✓' : '○'} {p.label}</li>)}<li className={goal.mandate ? 'ready' : ''}>{goal.mandate ? '✓' : '○'} 天命可承</li></ul>
    <p>{goal.ready ? '根基已具。稳住局势，走到建国大典，才能真正开创新朝。' : '从军势、朝局、国库中经营至少两项，同时保住天命。根基会随你的抉择变化。'}</p>
    {warned && <p className="mandate-warning" role="status"><b>危局未解</b> · 先争取提升天命的抉择，或动用能振奋天命的君王专属。天命恢复「稳健」可解除警讯；此前再遇变故可能覆亡。</p>}
  </section>
}

type Context = { title: string; fact: string; question: string; source: string; url: string }
const contexts: Record<string, Context> = {
  garrison: {
    title: '卫所：兵源与田地相连',
    fact: '明代卫所依靠世袭军户，并以屯田补充军粮。军士中有人耕种，有人守城操练；中后期的侵占与逃亡削弱了这套制度。',
    question: '眼前多一支队伍，明日就多一张粮饷账。招兵时，也要想谁来耕种与供给。',
    source: '故宫博物院 · 卫所制度', url: 'https://www.dpm.org.cn/court/system/236399.html',
  },
  canal: {
    title: '漕运：通路也是国力',
    fact: '明代迁都北京后，江南物资经运河北运供给京师。运输、船只与河道维护，是朝廷运转所依赖的实际事务。',
    question: '占下一处关口，只是开始。让粮食送得到、道路守得住，才能把疆域变成根基。',
    source: '故宫博物院院刊 · 明代的宫廷运输与运河交通', url: 'https://img.dpm.org.cn/Uploads/File/2019/12/15/u5df5ed4ebd0d9.pdf',
  },
  silver: {
    title: '赋役折银：有粮未必有钱',
    fact: '晚明的一条鞭改革，尝试合并繁杂税役，并把多种实物和劳役义务折为银两缴纳。税制简化，也让取得白银成为百姓面对的问题。',
    question: '征得到的银两与百姓承受得起的负担，未必是一回事。看国库，也要看朝局。',
    source: 'Madeleine Zelin · The Magistrate’s Tael，第 1 章', url: 'https://publishing.cdlib.org/ucpressebooks/public/book/the-magistrate-s-tael-rationalizing-fiscal-reform-in-eighteenth-century-ch-ing-china.html',
  },
}
const eventContext: Record<string, keyof typeof contexts> = {
  't-deserters': 'garrison', 't-veteran': 'garrison', 'f-tuntian': 'garrison', 'f-guard': 'garrison', 'j-garrison': 'garrison', army: 'garrison', general: 'garrison',
  'f-navy': 'canal', 'z-supply': 'canal', 'w-canal': 'canal', 'w-hangzhou': 'canal', 'j-river': 'canal', 'challenge-2': 'canal',
  'f-tax': 'silver', 'f-mint': 'silver', 'f-price': 'silver', 'j-budget': 'silver', 'j-treasury': 'silver', 't-salt': 'silver', salt: 'silver',
}
export function HistoricalContext({ eventId }: { eventId: string }) {
  const context = contexts[eventContext[eventId]]
  if (!context) return null
  return <details className="historical-context" key={eventId}>
    <summary>史事旁注 · {context.title}</summary>
    <p>{context.fact}</p><p><b>此局可想：</b>{context.question}</p>
    <small>制度有史可考；本局人物相遇、对白与结果为架空创作。</small>
    <a href={context.url} target="_blank" rel="noreferrer">史料与研究：{context.source} ↗</a>
  </details>
}
