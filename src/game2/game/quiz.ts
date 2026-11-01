// 边玩边学：二年级奥数 / 英语题库与出题逻辑。
// 纯数据 + 纯逻辑，不依赖 React 与引擎，可以单独用 node 跑回归。
// 题目难度分 5 档，由易到难；答对升档，连错两题降档，所以孩子不会卡在同一个难度上。

export type QuizSubject = 'math' | 'english'

export interface QuizQuestion {
  id: string
  subject: QuizSubject
  tier: number // 1..5，1 最易
  prompt: string // 主问题（数学为中文，英语为英文原题）
  sub?: string // 第二行：数学题的英文版 / 英语题的中文提示
  choices: string[]
  answer: number // choices 的下标
  explain: string // 答完才显示的讲解，答错时尤其重要
}

export const TIER_NAMES = ['入门', '熟练', '进阶', '挑战', '奥赛']
export const SUBJECT_NAMES: Record<QuizSubject, string> = { math: '数学', english: '英语' }
export const SUBJECT_ICONS: Record<QuizSubject, string> = { math: '🔢', english: '🔤' }

// 题库：每档数学 6 题 + 英语 6 题。题面尽量短，一眼能读完——下潜途中不该停太久。
export const QUESTIONS: QuizQuestion[] = [
  // ---------- 第 1 档：20 以内加减、基础词汇 ----------
  { id: 'm1-1', subject: 'math', tier: 1, prompt: '5 + 3 = ?', sub: 'What is 5 plus 3?', choices: ['7', '8', '9', '6'], answer: 1, explain: '5 再数 3 个：6、7、8。所以 5 + 3 = 8。' },
  { id: 'm1-2', subject: 'math', tier: 1, prompt: '10 − 4 = ?', sub: 'What is 10 minus 4?', choices: ['5', '7', '6', '4'], answer: 2, explain: '从 10 往回数 4 个：9、8、7、6。所以 10 − 4 = 6。' },
  { id: 'm1-3', subject: 'math', tier: 1, prompt: '下面哪个是双数（偶数）？', sub: 'Which number is even?', choices: ['3', '6', '9', '7'], answer: 1, explain: '能两个两个分完的就是双数。6 = 3 对，所以 6 是双数。' },
  { id: 'm1-4', subject: 'math', tier: 1, prompt: '2 + 2 + 2 = ?', sub: 'What is 2 + 2 + 2?', choices: ['4', '8', '6', '5'], answer: 2, explain: '三个 2 相加就是 2 × 3 = 6。' },
  { id: 'm1-5', subject: 'math', tier: 1, prompt: '接下去是几？2, 4, 6, 8, ?', sub: 'What comes next: 2, 4, 6, 8, ?', choices: ['9', '12', '10', '11'], answer: 2, explain: '每次加 2：8 + 2 = 10。' },
  { id: 'm1-6', subject: 'math', tier: 1, prompt: '7 + 6 = ?', sub: 'What is 7 plus 6?', choices: ['12', '13', '14', '11'], answer: 1, explain: '先凑十：7 + 3 = 10，还剩 3，10 + 3 = 13。' },

  { id: 'e1-1', subject: 'english', tier: 1, prompt: 'Which animal says "meow"?', sub: '哪种动物会「喵喵」叫？', choices: ['dog', 'cat', 'cow', 'duck'], answer: 1, explain: 'cat（猫）叫 meow；dog 汪汪 woof，cow 哞 moo，duck 嘎嘎 quack。' },
  { id: 'e1-2', subject: 'english', tier: 1, prompt: 'What colour is the sun?', sub: '太阳是什么颜色？', choices: ['blue', 'green', 'yellow', 'purple'], answer: 2, explain: 'yellow 是黄色。blue 蓝、green 绿、purple 紫。' },
  { id: 'e1-3', subject: 'english', tier: 1, prompt: 'One cat, two ___ ?', sub: 'cat 的复数是什么？', choices: ['cats', 'cates', 'caties', 'cat'], answer: 0, explain: '大部分名词变复数直接加 -s：cat → cats。' },
  { id: 'e1-4', subject: 'english', tier: 1, prompt: 'What is the opposite of "big"?', sub: 'big（大）的反义词是？', choices: ['tall', 'small', 'long', 'fat'], answer: 1, explain: 'big（大）↔ small（小）。' },
  { id: 'e1-5', subject: 'english', tier: 1, prompt: 'Which one is a fruit?', sub: '哪个是水果？', choices: ['chair', 'book', 'apple', 'shoe'], answer: 2, explain: 'apple 是苹果；chair 椅子、book 书、shoe 鞋都不能吃。' },
  { id: 'e1-6', subject: 'english', tier: 1, prompt: 'How many legs does a dog have?', sub: '狗有几条腿？', choices: ['two', 'four', 'six', 'eight'], answer: 1, explain: '狗有四条腿，four = 4。' },

  // ---------- 第 2 档：100 以内、找规律、单复数与 a/an ----------
  { id: 'm2-1', subject: 'math', tier: 2, prompt: '15 + 7 = ?', sub: 'What is 15 plus 7?', choices: ['21', '22', '23', '20'], answer: 1, explain: '先凑十：15 + 5 = 20，还剩 2，20 + 2 = 22。' },
  { id: 'm2-2', subject: 'math', tier: 2, prompt: '30 − 12 = ?', sub: 'What is 30 minus 12?', choices: ['18', '17', '22', '19'], answer: 0, explain: '30 − 10 = 20，再减 2 = 18。' },
  { id: 'm2-3', subject: 'math', tier: 2, prompt: '接下去是几？3, 6, 9, 12, ?', sub: 'What comes next: 3, 6, 9, 12, ?', choices: ['14', '16', '15', '18'], answer: 2, explain: '每次加 3：12 + 3 = 15。' },
  { id: 'm2-4', subject: 'math', tier: 2, prompt: '一只小鸡有 2 条腿，3 只小鸡一共几条腿？', sub: '3 chicks have how many legs?', choices: ['5', '6', '8', '9'], answer: 1, explain: '每只 2 条，3 只就是 2 × 3 = 6 条。' },
  { id: 'm2-5', subject: 'math', tier: 2, prompt: '18 的一半是多少？', sub: 'What is half of 18?', choices: ['8', '9', '10', '12'], answer: 1, explain: '一半就是平均分成 2 份：18 ÷ 2 = 9。' },
  { id: 'm2-6', subject: 'math', tier: 2, prompt: '小红有 25 元，用掉 10 元，还剩多少？', sub: 'She has 25 yuan and spends 10. How much is left?', choices: ['15 元', '10 元', '20 元', '35 元'], answer: 0, explain: '25 − 10 = 15 元。' },

  { id: 'e2-1', subject: 'english', tier: 2, prompt: 'One box, two ___ ?', sub: 'box 的复数是什么？', choices: ['boxs', 'boxes', 'boxies', 'box'], answer: 1, explain: '以 x、s、sh、ch 结尾的名词加 -es：box → boxes。' },
  { id: 'e2-2', subject: 'english', tier: 2, prompt: 'What is the opposite of "hot"?', sub: 'hot（热）的反义词是？', choices: ['warm', 'cold', 'wet', 'fast'], answer: 1, explain: 'hot（热）↔ cold（冷）。warm 是温暖，不是反义词。' },
  { id: 'e2-3', subject: 'english', tier: 2, prompt: 'I ___ a student.', sub: '用 am / is / are 填空', choices: ['am', 'is', 'are', 'be'], answer: 0, explain: '主语是 I 时用 am：I am a student.' },
  { id: 'e2-4', subject: 'english', tier: 2, prompt: 'Which word rhymes with "cat"?', sub: '哪个词和 cat 押韵？', choices: ['dog', 'hat', 'sun', 'cup'], answer: 1, explain: 'cat 和 hat 都以 -at 结尾，读起来押韵。' },
  { id: 'e2-5', subject: 'english', tier: 2, prompt: 'I eat ___ apple.', sub: '用 a / an 填空', choices: ['a', 'an', 'the two', 'one of'], answer: 1, explain: 'apple 以元音音素开头，所以用 an：an apple。' },
  { id: 'e2-6', subject: 'english', tier: 2, prompt: 'Which one is a vegetable?', sub: '哪个是蔬菜？', choices: ['tiger', 'carrot', 'shoe', 'cake'], answer: 1, explain: 'carrot 是胡萝卜，蔬菜。tiger 是老虎。' },

  // ---------- 第 3 档：两步应用题、不规则复数、第三人称单数 ----------
  { id: 'm3-1', subject: 'math', tier: 3, prompt: '小明有 12 颗糖，给弟弟 5 颗，又买了 4 颗。现在有几颗？', sub: '12 sweets, gives away 5, buys 4 more.', choices: ['10', '11', '12', '13'], answer: 1, explain: '一步一步算：12 − 5 = 7，7 + 4 = 11 颗。' },
  { id: 'm3-2', subject: 'math', tier: 3, prompt: '一个星期有 7 天，3 个星期有几天？', sub: 'How many days are in 3 weeks?', choices: ['14', '21', '24', '28'], answer: 1, explain: '7 × 3 = 21 天。' },
  { id: 'm3-3', subject: 'math', tier: 3, prompt: '5 只兔子和 3 只鸡，一共有几条腿？', sub: '5 rabbits and 3 chickens — how many legs?', choices: ['24', '26', '28', '30'], answer: 1, explain: '兔子 4 条腿：5 × 4 = 20；鸡 2 条腿：3 × 2 = 6。20 + 6 = 26 条。' },
  { id: 'm3-4', subject: 'math', tier: 3, prompt: '找规律：1, 2, 4, 7, 11, ?', sub: 'What comes next: 1, 2, 4, 7, 11, ?', choices: ['14', '15', '16', '18'], answer: 2, explain: '每次多加 1：+1、+2、+3、+4，接下来 +5，11 + 5 = 16。' },
  { id: 'm3-5', subject: 'math', tier: 3, prompt: '爸爸 35 岁，比小华大 28 岁。小华几岁？', sub: 'Dad is 35, which is 28 more than Xiaohua.', choices: ['6', '7', '8', '9'], answer: 1, explain: '大 28 岁就是减去 28：35 − 28 = 7 岁。' },
  { id: 'm3-6', subject: 'math', tier: 3, prompt: '一本书 40 页，已经读了一半，还剩几页？', sub: 'A 40-page book, half read. Pages left?', choices: ['10', '15', '20', '25'], answer: 2, explain: '一半是 40 ÷ 2 = 20，剩下的也是 20 页。' },

  { id: 'e3-1', subject: 'english', tier: 3, prompt: 'One child, two ___ ?', sub: 'child 的复数是什么？', choices: ['childs', 'childes', 'children', 'childrens'], answer: 2, explain: 'child 是不规则名词，复数是 children，不加 -s。' },
  { id: 'e3-2', subject: 'english', tier: 3, prompt: 'She ___ to school every day.', sub: '用 go / goes / going 填空', choices: ['go', 'goes', 'going', 'gone'], answer: 1, explain: '主语是 she（第三人称单数），动词加 -es：goes。' },
  { id: 'e3-3', subject: 'english', tier: 3, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['apple', 'banana', 'carrot', 'orange'], answer: 2, explain: 'apple、banana、orange 都是水果，只有 carrot（胡萝卜）是蔬菜。' },
  { id: 'e3-4', subject: 'english', tier: 3, prompt: 'There ___ two books on the desk.', sub: '用 is / are 填空', choices: ['is', 'are', 'am', 'be'], answer: 1, explain: 'two books 是复数，所以用 are。' },
  { id: 'e3-5', subject: 'english', tier: 3, prompt: 'What is the opposite of "early"?', sub: 'early（早）的反义词是？', choices: ['fast', 'late', 'slow', 'long'], answer: 1, explain: 'early（早）↔ late（晚）。' },
  { id: 'e3-6', subject: 'english', tier: 3, prompt: 'Yesterday I ___ to the park.', sub: 'go 的过去式是什么？', choices: ['go', 'goed', 'went', 'going'], answer: 2, explain: 'go 是不规则动词，过去式是 went。' },

  // ---------- 第 4 档：奥数经典题型、不规则变化 ----------
  { id: 'm4-1', subject: 'math', tier: 4, prompt: '笼子里鸡和兔共 5 只，脚共 14 只。兔有几只？', sub: 'Chickens and rabbits: 5 heads, 14 feet. How many rabbits?', choices: ['1 只', '2 只', '3 只', '4 只'], answer: 1, explain: '假设全是鸡：5 × 2 = 10 只脚，少了 4 只。每把一只鸡换成兔多 2 只脚，4 ÷ 2 = 2 只兔。' },
  { id: 'm4-2', subject: 'math', tier: 4, prompt: '1 + 2 + 3 + … + 10 = ?', sub: 'Add all numbers from 1 to 10.', choices: ['45', '50', '55', '60'], answer: 2, explain: '首尾配对：1+10、2+9、3+8、4+7、5+6，5 对各 11，5 × 11 = 55。' },
  { id: 'm4-3', subject: 'math', tier: 4, prompt: '三个连续的数加起来是 12，最小的是几？', sub: 'Three numbers in a row add to 12. The smallest?', choices: ['2', '3', '4', '5'], answer: 1, explain: '中间那个是 12 ÷ 3 = 4，所以是 3、4、5，最小的是 3。' },
  { id: 'm4-4', subject: 'math', tier: 4, prompt: '一根绳子剪 3 刀，被分成几段？', sub: 'Cut a rope 3 times. How many pieces?', choices: ['3 段', '4 段', '5 段', '6 段'], answer: 1, explain: '剪 1 刀 2 段，剪 2 刀 3 段——段数总比刀数多 1，所以 3 刀是 4 段。' },
  { id: 'm4-5', subject: 'math', tier: 4, prompt: '5 个小朋友互相握手一次，一共握几次？', sub: '5 friends each shake hands once. How many handshakes?', choices: ['5 次', '8 次', '10 次', '20 次'], answer: 2, explain: '每人和另外 4 人握：5 × 4 = 20，但每次握手算了两遍，20 ÷ 2 = 10 次。' },
  { id: 'm4-6', subject: 'math', tier: 4, prompt: '3 点整的时候，时针和分针夹角是多少度？', sub: 'At 3 o\'clock, the angle between the hands?', choices: ['30 度', '60 度', '90 度', '120 度'], answer: 2, explain: '钟面 12 格，每格 30 度。3 点整相差 3 格：3 × 30 = 90 度，正好是直角。' },

  { id: 'e4-1', subject: 'english', tier: 4, prompt: 'One mouse, two ___ ?', sub: 'mouse 的复数是什么？', choices: ['mouses', 'mice', 'mouse', 'mices'], answer: 1, explain: 'mouse 是不规则名词，复数是 mice。' },
  { id: 'e4-2', subject: 'english', tier: 4, prompt: 'Which word means "very big"?', sub: '哪个词表示「非常大」？', choices: ['tiny', 'thin', 'huge', 'short'], answer: 2, explain: 'huge 是巨大的。tiny 微小、thin 瘦、short 矮。' },
  { id: 'e4-3', subject: 'english', tier: 4, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['Monday', 'Tuesday', 'March', 'Friday'], answer: 2, explain: 'Monday、Tuesday、Friday 是星期几，只有 March（三月）是月份。' },
  { id: 'e4-4', subject: 'english', tier: 4, prompt: 'What is the opposite of "always"?', sub: 'always（总是）的反义词是？', choices: ['often', 'never', 'sometimes', 'usually'], answer: 1, explain: 'always（总是）↔ never（从不）。sometimes 是「有时」，在中间。' },
  { id: 'e4-5', subject: 'english', tier: 4, prompt: 'I have ___ orange and ___ banana.', sub: '两个空分别用 a 还是 an？', choices: ['a … a', 'an … an', 'an … a', 'a … an'], answer: 2, explain: 'orange 以元音音素开头用 an；banana 以辅音音素开头用 a。' },
  { id: 'e4-6', subject: 'english', tier: 4, prompt: 'A baby cat is called a ___ .', sub: '小猫叫什么？', choices: ['puppy', 'kitten', 'calf', 'chick'], answer: 1, explain: 'kitten 是小猫；puppy 小狗、calf 小牛、chick 小鸡。' },

  // ---------- 第 5 档：奥赛难度 ----------
  { id: 'm5-1', subject: 'math', tier: 5, prompt: '找规律：1, 1, 2, 3, 5, 8, ?', sub: 'What comes next: 1, 1, 2, 3, 5, 8, ?', choices: ['11', '12', '13', '16'], answer: 2, explain: '每个数是前两个数之和：5 + 8 = 13。这叫斐波那契数列。' },
  { id: 'm5-2', subject: 'math', tier: 5, prompt: '笼子里鸡兔共 8 个头、26 只脚。兔有几只？', sub: '8 heads, 26 feet. How many rabbits?', choices: ['3 只', '4 只', '5 只', '6 只'], answer: 2, explain: '假设全是鸡：8 × 2 = 16 只脚，少 10 只。每换一只兔多 2 只脚，10 ÷ 2 = 5 只兔。' },
  { id: 'm5-3', subject: 'math', tier: 5, prompt: '一个数加 3 以后再乘 2，结果是 16。这个数是几？', sub: '(n + 3) × 2 = 16. What is n?', choices: ['4', '5', '6', '8'], answer: 1, explain: '倒着算：16 ÷ 2 = 8，8 − 3 = 5。' },
  { id: 'm5-4', subject: 'math', tier: 5, prompt: '从 1 楼走到 3 楼有 24 级台阶。从 1 楼走到 6 楼有几级？', sub: '1F to 3F is 24 steps. 1F to 6F?', choices: ['48 级', '60 级', '72 级', '40 级'], answer: 1, explain: '1 楼到 3 楼只爬 2 层，每层 24 ÷ 2 = 12 级。1 楼到 6 楼爬 5 层：12 × 5 = 60 级。' },
  { id: 'm5-5', subject: 'math', tier: 5, prompt: '钟敲 6 下用 5 秒，敲 12 下用几秒？', sub: '6 chimes take 5 seconds. How long for 12?', choices: ['10 秒', '11 秒', '12 秒', '15 秒'], answer: 1, explain: '敲 6 下中间有 5 个间隔，5 ÷ 5 = 每个间隔 1 秒。敲 12 下有 11 个间隔，所以 11 秒。' },
  { id: 'm5-6', subject: 'math', tier: 5, prompt: '用 1、2、3 组成没有重复数字的三位数，一共有几个？', sub: 'Three-digit numbers using 1, 2, 3 with no repeats?', choices: ['3 个', '6 个', '9 个', '12 个'], answer: 1, explain: '百位 3 种选法，十位剩 2 种，个位剩 1 种：3 × 2 × 1 = 6 个。' },

  { id: 'e5-1', subject: 'english', tier: 5, prompt: 'One foot, two ___ ?', sub: 'foot 的复数是什么？', choices: ['foots', 'feet', 'feets', 'footes'], answer: 1, explain: 'foot 是不规则名词，复数是 feet。' },
  { id: 'e5-2', subject: 'english', tier: 5, prompt: 'Yesterday he ___ the ball.', sub: 'catch 的过去式是什么？', choices: ['catched', 'caught', 'catches', 'catching'], answer: 1, explain: 'catch 是不规则动词，过去式是 caught。' },
  { id: 'e5-3', subject: 'english', tier: 5, prompt: 'Which sentence is correct?', sub: '哪句是对的？', choices: ['He don\'t like milk.', 'He doesn\'t like milk.', 'He not like milk.', 'He no likes milk.'], answer: 1, explain: '主语是 he（第三人称单数），否定用 doesn\'t，后面动词用原形 like。' },
  { id: 'e5-4', subject: 'english', tier: 5, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['swim', 'run', 'jump', 'chair'], answer: 3, explain: 'swim、run、jump 都是动词（动作），chair（椅子）是名词。' },
  { id: 'e5-5', subject: 'english', tier: 5, prompt: 'The cat is sleeping ___ the table.', sub: '猫睡在桌子上面，用哪个介词？', choices: ['in', 'on', 'under', 'between'], answer: 1, explain: '在物体表面上用 on。in 在里面，under 在下面，between 在两者之间。' },
  { id: 'e5-6', subject: 'english', tier: 5, prompt: 'What is the opposite of "ask"?', sub: 'ask（问）的反义词是？', choices: ['answer', 'say', 'talk', 'tell'], answer: 0, explain: 'ask（问）↔ answer（答）。' },
]

// 开场先答一题，之后每隔这么久再来一题。
export const QUIZ_INTERVAL = 180 // 秒

// 该不该现在提问。单独拎出来是为了能脱离浏览器回归：
// 选技能、剧情、死亡、已暂停时都不插队，免得盖住别的弹窗或打断结算。
export function shouldAskNow(o: {
  learnMode: boolean
  status: string
  time: number
  nextAt: number
  quizOpen: boolean
  storyActive: boolean
}): boolean {
  if (!o.learnMode || o.quizOpen || o.storyActive) return false
  if (o.status !== 'playing') return false
  return o.time >= o.nextAt
}

export interface QuizResult {
  question: QuizQuestion
  picked: number
  correct: boolean
}

// 一局之内的出题器：记住问过哪些题、现在该出多难的，以及答题战绩。
export class QuizRunner {
  tier = 1
  asked = 0
  correct = 0
  streak = 0 // 当前连对
  bestStreak = 0
  private wrongStreak = 0
  private used = new Set<string>()
  private order: QuizQuestion[]

  constructor(seed = Date.now()) {
    // 固定洗牌：同一局里顺序稳定，不同局不一样，避免每次都背同样几道。
    let s = seed % 2147483647
    if (s <= 0) s += 2147483646
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647
    this.order = [...QUESTIONS]
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[this.order[i], this.order[j]] = [this.order[j], this.order[i]]
    }
  }

  // 优先出当前难度的新题；该档出完了就就近找别的档，始终保证有题可出。
  next(): QuizQuestion {
    for (let spread = 0; spread < TIER_NAMES.length; spread++) {
      for (const tier of [this.tier + spread, this.tier - spread]) {
        if (tier < 1 || tier > TIER_NAMES.length) continue
        const q = this.order.find((x) => x.tier === tier && !this.used.has(x.id))
        if (q) { this.used.add(q.id); return q }
      }
    }
    this.used.clear() // 全部答过一轮，重新开始
    const q = this.order.find((x) => x.tier === this.tier) ?? this.order[0]
    this.used.add(q.id)
    return q
  }

  // 记录作答并调整难度：答对就升一档，连错两题降一档。
  record(question: QuizQuestion, picked: number): QuizResult {
    const correct = picked === question.answer
    this.asked++
    if (correct) {
      this.correct++
      this.streak++
      this.bestStreak = Math.max(this.bestStreak, this.streak)
      this.wrongStreak = 0
      this.tier = Math.min(TIER_NAMES.length, this.tier + 1)
    } else {
      this.streak = 0
      this.wrongStreak++
      if (this.wrongStreak >= 2) { this.tier = Math.max(1, this.tier - 1); this.wrongStreak = 0 }
    }
    return { question, picked, correct }
  }
}
