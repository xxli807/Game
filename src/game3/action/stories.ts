import { PLACES, type Order } from './orders'
import type { Vec } from './model'

export type ContactId = 'qiao' | 'an' | 'wan'
export const CONTACTS: { id: ContactId; name: string; title: string; at: Vec; intro: string }[] = [
  { id: 'qiao', name: '沈桥', title: '木匠', at: { x: 640, y: 890 }, intro: '我叫沈桥。乱世里，先让一家人吃饱，才谈得上把日子重新搭起来。' },
  { id: 'an', name: '许安', title: '脚商', at: { x: 1260, y: 960 }, intro: '许安，跑脚的。路上的车、人和货，我都认得。护送一趟，咱们就知道彼此靠不靠得住。' },
  { id: 'wan', name: '林晚', title: '医者', at: { x: 550, y: 970 }, intro: '我是林晚，在此看诊。药不够时要想办法，人受了伤更不能只记在军报上。' },
]
export type StoryChoice = { id: string; label: string; detail: string; order: Order; after: string }
export type VillageStory = { id: ContactId; name: string; title: string; cause: string; body: string; availableTurn: number; choices: StoryChoice[]; state: 'available' | 'active' | 'completed'; choice?: string; success?: boolean; result?: string }
const relief = (title: string, cargo: string): Order => ({ kind: 'relief', title, cargo, brief: `到粮仓领取${cargo}，亲手送往三处标记。`, target: PLACES.granary, required: 3 })
const escort = (title: string, people = false): Order => ({ kind: 'escort', title, brief: people ? '到关隘接应乡民，护送他们到城镇。靠近队伍前进，击退沿途敌兵。' : '到粮仓接货，护送到城镇。靠近车队前进，击退沿途敌兵。', target: PLACES.town, required: 1, ...(people ? { convoy: 'people', pickup: { x: 540, y: 440 } } : {}) })

// Original fictional people. Requests follow actual mission results, not random event draws.
export class VillageStories {
  private entries: VillageStory[] = []
  active: ContactId | null = null
  record(order: Order, success: boolean, turn: number) {
    const add = (id: ContactId, title: string, body: string, choices: StoryChoice[]) => {
      if (this.entries.some(s => s.id === id)) return
      this.entries.push({ id, name: CONTACTS.find(c => c.id === id)!.name, title, body, cause: `此前「${order.title}」${success ? '办妥' : '受挫'}`, availableTurn: turn + 1, choices, state: 'available' })
    }
    if (order.kind === 'relief' && success) add('qiao', '沈桥的下一根梁', '那回送来的物资，让我们一家熬过了最难的日子。我和几个匠人凑出了人手，眼下只能先办一件：搭起义学，或修补关墙。您选哪一处，我就跟着把活做完。', [
      { id: 'school', label: '先让孩子有学可上', detail: '配送义学物资，村里会留下义学；关墙仍需日后料理。', order: relief('沈桥 · 为义学备料', '义学物资'), after: '沈桥：梁架好了，孩子们明日来念书。那回救急的恩，咱们用这间义学往下传。' },
      { id: 'wall', label: '先把关墙缺口补上', detail: '运送修墙木料到三处墙段；义学的梁先存着。', order: { ...relief('沈桥 · 补上关墙', '修墙木料'), deliveries: [{ x: 300, y: 345 }, { x: 450, y: 490 }, { x: 600, y: 340 }], deliveryNames: ['西墙', '南墙', '东墙'] }, after: '沈桥：新木撑住了关墙，夜里安心多了。义学那根梁我还留着，等日子宽裕了再说。' },
    ])
    if (order.kind === 'escort') add('an', success ? '路通以后，谁先回来' : '许安还记得那辆车', success ? '您护送的队伍进了城，外头的人开始相信这条路。我能再组织一趟，但人手只够一队：带货回来开市，还是先接离散的乡亲？' : '上回在路上散了队，我没忘。残车里的货还能追回，另有几户人家困在关外。这次先顾哪一头，得由您拿主意。', [
      { id: 'goods', label: success ? '护货入市，恢复生计' : '重返关隘，夺回货物', detail: success ? '再护一趟货车，集市增加物资。' : '击退关隘守军，追回货物；途中仍有战斗风险。', order: success ? escort('许安 · 重开商路') : { kind: 'assault', title: '许安 · 追回散失货物', brief: '击退关隘守军，并在旗旁守住位置，接回被扣货物。', target: PLACES.gate, required: 1 }, after: '许安：货进了城，摊主又肯开门了。往后说起这条路，我会记得您回来过。' },
      { id: 'people', label: '先接乡亲回家', detail: '到关隘接人并护送入镇；他们会在村里安顿下来。', order: escort('许安 · 接回乡亲', true), after: '许安：人平安进了村，比一车货重。新来的几户人家，已经在找地方生火。' },
    ])
    if ((order.kind === 'relief' && order.cargo === '药材' && success) || (order.kind === 'assault' && !success)) add('wan', '林晚的诊帐', success ? '上次药送得及时，几位病人已经能下地了。诊帐还缺照料的手和后续的药，眼下只能先走一趟。' : '关隘一仗没成，伤者还在。输赢可以等史官说，他们的伤不能等。请帮我先办一件实事。', [
      { id: 'medicine', label: '把药送到各户', detail: '补送三份药材，支起医帐，照顾留在村里的病人。', order: relief('林晚 · 续上救命药', '药材'), after: '林晚：药续上了，诊帐也立住了。您记得这些人，他们也记得您。' },
      { id: 'helpers', label: '护送照料者入村', detail: '从关隘接回照料者及其家人，让他们在村里安顿。', order: escort('林晚 · 接应照料者', true), after: '林晚：照料的人到了，有人换药，有人煮粥。新来的乡邻已经和大家搭上了手。' },
    ])
  }
  offer(id: ContactId, turn: number) { return this.entries.find(s => s.id === id && s.state === 'available' && s.availableTurn <= turn) }
  get current() { return this.entries.find(s => s.id === this.active) }
  begin(id: ContactId, choiceId: string, turn: number): StoryChoice | undefined {
    if (this.active) return
    const story = this.offer(id, turn), choice = story?.choices.find(c => c.id === choiceId)
    if (!story || !choice) return
    story.state = 'active'; story.choice = choice.id; this.active = id
    return choice
  }
  finish(success: boolean) {
    const story = this.current
    if (!story || story.state !== 'active') return
    story.state = 'completed'; story.success = success
    story.result = success ? story.choices.find(c => c.id === story.choice)!.after : `${story.name}：这趟没办成，我们先照顾回来的人。这件事我会记着，您也保重。`
  }
  acknowledge() { if (this.current?.state === 'completed') this.active = null }
  memory(id: ContactId) { return this.entries.find(s => s.id === id && s.state === 'completed')?.result }
  all() { return this.entries }
}
