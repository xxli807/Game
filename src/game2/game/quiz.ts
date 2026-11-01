// 边玩边学：二年级奥数 / 英语奥赛题库与出题逻辑。
// 纯数据 + 纯逻辑，不依赖 React 与引擎，可以单独用 node 跑回归。
//
// 两科都走**竞赛题型**，不是课本练习：
//   数学——找规律、鸡兔同笼、植树、盈亏、年龄、周期、排列、页码、还原问题；
//   英语——字母重排、藏词、词链、构词、逻辑推理、odd-one-out、谜语。
// 所以第 1 档也是「○△○△○ 接什么」而不是「5 + 3 = ?」。
//
// 难度分 6 档，由易到难；答对升档，连错两题降档，孩子不会卡在同一个难度上。

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

export const TIER_NAMES = ['入门', '熟练', '进阶', '挑战', '奥赛', '奥赛·难']
export const SUBJECT_NAMES: Record<QuizSubject, string> = { math: '数学', english: '英语' }
export const SUBJECT_ICONS: Record<QuizSubject, string> = { math: '🔢', english: '🔤' }

// 题库：每档数学 6 题 + 英语 6 题。题面尽量短，一眼能读完——下潜途中不该停太久。
export const QUESTIONS: QuizQuestion[] = [
  // ---------- 第 1 档：入门（找规律、简单推理，不是单纯算式） ----------
  { id: 'm1-1', subject: 'math', tier: 1, prompt: '找规律：○ △ ○ △ ○ ?', sub: 'What comes next: circle, triangle, circle, triangle, circle, ?', choices: ['○', '△', '□', '☆'], answer: 1, explain: '圆、三角两个一组不停重复，圆后面就该轮到三角。' },
  { id: 'm1-2', subject: 'math', tier: 1, prompt: '哥哥比弟弟高，弟弟比妹妹高。谁最高？', sub: 'Brother is taller than the younger brother, who is taller than sister. Who is tallest?', choices: ['哥哥', '弟弟', '妹妹', '一样高'], answer: 0, explain: '排一排：哥哥 > 弟弟 > 妹妹，所以哥哥最高。' },
  { id: 'm1-3', subject: 'math', tier: 1, prompt: '小明左手 2 颗糖，右手 3 颗糖。一共几颗？', sub: '2 sweets in one hand, 3 in the other.', choices: ['4 颗', '5 颗', '6 颗', '3 颗'], answer: 1, explain: '两只手合起来：2 + 3 = 5 颗。' },
  { id: 'm1-4', subject: 'math', tier: 1, prompt: '找规律：2, 4, 6, 8, ?', sub: 'What comes next: 2, 4, 6, 8, ?', choices: ['9', '12', '10', '11'], answer: 2, explain: '每次加 2：8 + 2 = 10。' },
  { id: 'm1-5', subject: 'math', tier: 1, prompt: '一个三角形有几条边？', sub: 'How many sides does a triangle have?', choices: ['2 条', '3 条', '4 条', '5 条'], answer: 1, explain: '「三角形」的三就是三条边、三个角。' },
  { id: 'm1-6', subject: 'math', tier: 1, prompt: '1 2 3 4 5 排成一排，正中间的是几？', sub: 'In 1 2 3 4 5, which number is in the middle?', choices: ['2', '3', '4', '5'], answer: 1, explain: '左右各有两个数，中间那个是 3。' },

  { id: 'e1-1', subject: 'english', tier: 1, prompt: 'Put these letters in order: o d g', sub: '把这三个字母排成一个单词', choices: ['dog', 'log', 'dig', 'bag'], answer: 0, explain: 'o、d、g 三个字母只能拼成 dog（狗）。log、dig、bag 都用到了别的字母。' },
  { id: 'e1-2', subject: 'english', tier: 1, prompt: 'Which word is hidden inside "rainbow"?', sub: 'rainbow 里面藏着哪个单词？', choices: ['rain', 'rail', 'robe', 'nose'], answer: 0, explain: 'rainbow 的前四个字母连起来就是 rain（雨）。' },
  { id: 'e1-3', subject: 'english', tier: 1, prompt: 'I have four legs and you sit on me. What am I?', sub: '我有四条腿，你坐在我身上。我是什么？', choices: ['a chair', 'an apple', 'a river', 'a cloud'], answer: 0, explain: 'chair（椅子）有四条腿，可以坐。' },
  { id: 'e1-4', subject: 'english', tier: 1, prompt: 'Which word rhymes with "cat"?', sub: '哪个词和 cat 押韵？', choices: ['dog', 'hat', 'sun', 'cup'], answer: 1, explain: 'cat 和 hat 都以 -at 结尾，读起来押韵。' },
  { id: 'e1-5', subject: 'english', tier: 1, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['red', 'blue', 'apple', 'green'], answer: 2, explain: 'red、blue、green 都是颜色，只有 apple（苹果）是水果。' },
  { id: 'e1-6', subject: 'english', tier: 1, prompt: 'How many letters are in the word "book"?', sub: 'book 这个词有几个字母？', choices: ['3', '4', '5', '6'], answer: 1, explain: 'b-o-o-k，四个字母（两个 o 要分开数）。' },

  // ---------- 第 2 档：熟练（排队、年龄、周期） ----------
  { id: 'm2-1', subject: 'math', tier: 2, prompt: '小红从前面数是第 3 个，从后面数是第 2 个。这队一共几人？', sub: 'She is 3rd from the front and 2nd from the back. How many in the queue?', choices: ['3 人', '4 人', '5 人', '6 人'], answer: 1, explain: '小红被数了两次：3 + 2 − 1 = 4 人。' },
  { id: 'm2-2', subject: 'math', tier: 2, prompt: '我今年 8 岁，妹妹比我小 2 岁。妹妹几岁？', sub: 'I am 8. My sister is 2 years younger.', choices: ['5 岁', '6 岁', '7 岁', '10 岁'], answer: 1, explain: '小 2 岁就是减去 2：8 − 2 = 6 岁。' },
  { id: 'm2-3', subject: 'math', tier: 2, prompt: '找规律：1, 3, 5, 7, ?', sub: 'What comes next: 1, 3, 5, 7, ?', choices: ['8', '9', '10', '11'], answer: 1, explain: '都是单数，每次加 2：7 + 2 = 9。' },
  { id: 'm2-4', subject: 'math', tier: 2, prompt: '一只小鸡有 2 条腿，3 只小鸡一共几条腿？', sub: '3 chicks have how many legs?', choices: ['5', '6', '8', '9'], answer: 1, explain: '每只 2 条，3 只就是 2 × 3 = 6 条。' },
  { id: 'm2-5', subject: 'math', tier: 2, prompt: '妈妈买了 5 个苹果，吃掉 2 个，又买了 3 个。现在有几个？', sub: 'Bought 5 apples, ate 2, bought 3 more.', choices: ['5 个', '6 个', '7 个', '8 个'], answer: 1, explain: '一步一步算：5 − 2 = 3，3 + 3 = 6 个。' },
  { id: 'm2-6', subject: 'math', tier: 2, prompt: '18 的一半是多少？', sub: 'What is half of 18?', choices: ['8', '9', '10', '12'], answer: 1, explain: '一半就是平均分成 2 份：18 ÷ 2 = 9。' },

  { id: 'e2-1', subject: 'english', tier: 2, prompt: 'Put these letters in order to make an animal: i p g', sub: '把字母排成一种动物', choices: ['pig', 'big', 'dig', 'wig'], answer: 0, explain: 'i、p、g 拼成 pig（猪）。big、dig、wig 用的字母不一样。' },
  { id: 'e2-2', subject: 'english', tier: 2, prompt: 'Which word is hidden inside "brother"?', sub: 'brother 里面藏着哪个单词？', choices: ['other', 'mother', 'bother', 'there'], answer: 0, explain: 'b-r-other，后面五个字母连起来就是 other。另外三个词的字母在 brother 里不是连着的。' },
  { id: 'e2-3', subject: 'english', tier: 2, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['Monday', 'Tuesday', 'summer', 'Friday'], answer: 2, explain: 'Monday、Tuesday、Friday 都是星期几，只有 summer（夏天）是季节。' },
  { id: 'e2-4', subject: 'english', tier: 2, prompt: 'I eat ___ apple.', sub: '用 a / an 填空', choices: ['a', 'an', 'the two', 'one of'], answer: 1, explain: 'apple 以元音音素开头，所以用 an：an apple。' },
  { id: 'e2-5', subject: 'english', tier: 2, prompt: 'What is the opposite of "hot"?', sub: 'hot（热）的反义词是？', choices: ['warm', 'cold', 'wet', 'fast'], answer: 1, explain: 'hot（热）↔ cold（冷）。warm 是温暖，不是反义词。' },
  { id: 'e2-6', subject: 'english', tier: 2, prompt: 'If today is Monday, what day is tomorrow?', sub: '今天星期一，明天星期几？', choices: ['Sunday', 'Tuesday', 'Wednesday', 'Friday'], answer: 1, explain: '星期的顺序是 Monday → Tuesday → Wednesday…，明天是 Tuesday。' },

  // ---------- 第 3 档：进阶（两步应用、数列、语法推理） ----------
  { id: 'm3-1', subject: 'math', tier: 3, prompt: '小明有 12 颗糖，给弟弟 5 颗，又买了 4 颗。现在有几颗？', sub: '12 sweets, gives away 5, buys 4 more.', choices: ['10', '11', '12', '13'], answer: 1, explain: '一步一步算：12 − 5 = 7，7 + 4 = 11 颗。' },
  { id: 'm3-2', subject: 'math', tier: 3, prompt: '一个星期有 7 天，3 个星期有几天？', sub: 'How many days are in 3 weeks?', choices: ['14', '21', '24', '28'], answer: 1, explain: '7 × 3 = 21 天。' },
  { id: 'm3-3', subject: 'math', tier: 3, prompt: '5 只兔子和 3 只鸡，一共有几条腿？', sub: '5 rabbits and 3 chickens — how many legs?', choices: ['24', '26', '28', '30'], answer: 1, explain: '兔子 4 条腿：5 × 4 = 20；鸡 2 条腿：3 × 2 = 6。20 + 6 = 26 条。' },
  { id: 'm3-4', subject: 'math', tier: 3, prompt: '找规律：1, 2, 4, 7, 11, ?', sub: 'What comes next: 1, 2, 4, 7, 11, ?', choices: ['14', '15', '16', '18'], answer: 2, explain: '每次多加 1：+1、+2、+3、+4，接下来 +5，11 + 5 = 16。' },
  { id: 'm3-5', subject: 'math', tier: 3, prompt: '爸爸 35 岁，比小华大 28 岁。小华几岁？', sub: 'Dad is 35, which is 28 more than Xiaohua.', choices: ['6', '7', '8', '9'], answer: 1, explain: '大 28 岁就是减去 28：35 − 28 = 7 岁。' },
  { id: 'm3-6', subject: 'math', tier: 3, prompt: '一本书 40 页，已经读了一半，还剩几页？', sub: 'A 40-page book, half read. Pages left?', choices: ['10', '15', '20', '25'], answer: 2, explain: '一半是 40 ÷ 2 = 20，剩下的也是 20 页。' },
  { id: 'm3-7', subject: 'math', tier: 3, prompt: '把 24 个苹果平均分给 4 个人，每人几个？', sub: '24 apples shared equally among 4 people.', choices: ['4 个', '5 个', '6 个', '8 个'], answer: 2, explain: '平均分就是除法：24 ÷ 4 = 6 个。' },
  { id: 'm3-8', subject: 'math', tier: 3, prompt: '一个数的 3 倍是 21，这个数是几？', sub: '3 times a number is 21. What is it?', choices: ['6', '7', '8', '9'], answer: 1, explain: '倒过来除：21 ÷ 3 = 7。' },
  { id: 'm3-9', subject: 'math', tier: 3, prompt: '1 到 20 里，一共有几个单数（奇数）？', sub: 'How many odd numbers from 1 to 20?', choices: ['9 个', '10 个', '11 个', '12 个'], answer: 1, explain: '1、3、5…19，单数双数各占一半：20 ÷ 2 = 10 个。' },
  { id: 'm3-10', subject: 'math', tier: 3, prompt: '小明排队，前面有 5 人，后面有 3 人。这队一共几人？', sub: '5 people ahead, 3 behind. How many in the queue?', choices: ['8 人', '9 人', '10 人', '7 人'], answer: 1, explain: '别忘了小明自己：5 + 1 + 3 = 9 人。' },
  { id: 'm3-11', subject: 'math', tier: 3, prompt: '一盒有 12 支笔，3 盒一共几支？', sub: '12 pens per box, 3 boxes.', choices: ['24 支', '30 支', '36 支', '32 支'], answer: 2, explain: '12 × 3 = 36 支。' },
  { id: 'm3-12', subject: 'math', tier: 3, prompt: '一排有 9 个座位，3 排一共几个座位？', sub: '9 seats per row, 3 rows.', choices: ['24', '27', '29', '18'], answer: 1, explain: '9 × 3 = 27。也可以想成 10 × 3 = 30，再减 3。' },

  { id: 'e3-1', subject: 'english', tier: 3, prompt: 'One child, two ___ ?', sub: 'child 的复数是什么？', choices: ['childs', 'childes', 'children', 'childrens'], answer: 2, explain: 'child 是不规则名词，复数是 children，不加 -s。' },
  { id: 'e3-2', subject: 'english', tier: 3, prompt: 'She ___ to school every day.', sub: '用 go / goes / going 填空', choices: ['go', 'goes', 'going', 'gone'], answer: 1, explain: '主语是 she（第三人称单数），动词加 -es：goes。' },
  { id: 'e3-3', subject: 'english', tier: 3, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['apple', 'banana', 'carrot', 'orange'], answer: 2, explain: 'apple、banana、orange 都是水果，只有 carrot（胡萝卜）是蔬菜。' },
  { id: 'e3-4', subject: 'english', tier: 3, prompt: 'There ___ two books on the desk.', sub: '用 is / are 填空', choices: ['is', 'are', 'am', 'be'], answer: 1, explain: 'two books 是复数，所以用 are。' },
  { id: 'e3-5', subject: 'english', tier: 3, prompt: 'Put these letters in order: e l p p a', sub: '把字母排成一个单词', choices: ['apple', 'maple', 'pale', 'leap'], answer: 0, explain: '给的字母是 a、p、p、l、e，正好拼成 apple。maple 要用 m，pale 和 leap 都少一个 p。' },
  { id: 'e3-6', subject: 'english', tier: 3, prompt: 'All birds have wings. A parrot is a bird. So a parrot has ___ .', sub: '所有鸟都有翅膀，鹦鹉是鸟，所以鹦鹉有……', choices: ['wings', 'wheels', 'fins', 'horns'], answer: 0, explain: '既然所有鸟都有 wings（翅膀），鹦鹉是鸟，它当然也有翅膀。' },
  { id: 'e3-7', subject: 'english', tier: 3, prompt: 'Yesterday I ___ to the park.', sub: 'go 的过去式是什么？', choices: ['go', 'goed', 'went', 'going'], answer: 2, explain: 'go 是不规则动词，过去式是 went。' },
  { id: 'e3-8', subject: 'english', tier: 3, prompt: 'What is the opposite of "early"?', sub: 'early（早）的反义词是？', choices: ['fast', 'late', 'slow', 'long'], answer: 1, explain: 'early（早）↔ late（晚）。' },

  // ---------- 第 4 档：挑战（和差、周期、余数） ----------
  { id: 'm4-1', subject: 'math', tier: 4, prompt: '笼子里鸡和兔共 5 只，脚共 14 只。兔有几只？', sub: 'Chickens and rabbits: 5 heads, 14 feet. How many rabbits?', choices: ['1 只', '2 只', '3 只', '4 只'], answer: 1, explain: '假设全是鸡：5 × 2 = 10 只脚，少了 4 只。每把一只鸡换成兔多 2 只脚，4 ÷ 2 = 2 只兔。' },
  { id: 'm4-2', subject: 'math', tier: 4, prompt: '1 + 2 + 3 + … + 10 = ?', sub: 'Add all numbers from 1 to 10.', choices: ['45', '50', '55', '60'], answer: 2, explain: '首尾配对：1+10、2+9、3+8、4+7、5+6，5 对各 11，5 × 11 = 55。' },
  { id: 'm4-3', subject: 'math', tier: 4, prompt: '三个连续的数加起来是 12，最小的是几？', sub: 'Three numbers in a row add to 12. The smallest?', choices: ['2', '3', '4', '5'], answer: 1, explain: '中间那个是 12 ÷ 3 = 4，所以是 3、4、5，最小的是 3。' },
  { id: 'm4-4', subject: 'math', tier: 4, prompt: '一根绳子剪 3 刀，被分成几段？', sub: 'Cut a rope 3 times. How many pieces?', choices: ['3 段', '4 段', '5 段', '6 段'], answer: 1, explain: '剪 1 刀 2 段，剪 2 刀 3 段——段数总比刀数多 1，所以 3 刀是 4 段。' },
  { id: 'm4-5', subject: 'math', tier: 4, prompt: '5 个小朋友互相握手一次，一共握几次？', sub: '5 friends each shake hands once. How many handshakes?', choices: ['5 次', '8 次', '10 次', '20 次'], answer: 2, explain: '每人和另外 4 人握：5 × 4 = 20，但每次握手算了两遍，20 ÷ 2 = 10 次。' },
  { id: 'm4-6', subject: 'math', tier: 4, prompt: '3 点整的时候，时针和分针夹角是多少度？', sub: 'At 3 o\'clock, the angle between the hands?', choices: ['30 度', '60 度', '90 度', '120 度'], answer: 2, explain: '钟面 12 格，每格 30 度。3 点整相差 3 格：3 × 30 = 90 度，正好是直角。' },
  { id: 'm4-7', subject: 'math', tier: 4, prompt: '两个数的和是 10，差是 2。大的那个数是几？', sub: 'Two numbers add to 10, differ by 2. The larger?', choices: ['5', '6', '7', '8'], answer: 1, explain: '大数 =（和 + 差）÷ 2 =（10 + 2）÷ 2 = 6，小数是 4。' },
  { id: 'm4-8', subject: 'math', tier: 4, prompt: '长方形长 5 厘米、宽 3 厘米，周长是多少？', sub: 'A rectangle 5 cm by 3 cm. Perimeter?', choices: ['15 厘米', '16 厘米', '18 厘米', '13 厘米'], answer: 1, explain: '周长 =（长 + 宽）× 2 =（5 + 3）× 2 = 16 厘米。' },
  { id: 'm4-9', subject: 'math', tier: 4, prompt: '找规律：1, 4, 9, 16, ?', sub: 'What comes next: 1, 4, 9, 16, ?', choices: ['20', '24', '25', '36'], answer: 2, explain: '它们是 1×1、2×2、3×3、4×4，下一个是 5×5 = 25。' },
  { id: 'm4-10', subject: 'math', tier: 4, prompt: '小红有 8 张卡，小明比小红的 2 倍少 3 张。小明几张？', sub: 'She has 8. He has 3 less than twice hers.', choices: ['11 张', '13 张', '16 张', '19 张'], answer: 1, explain: '先算 2 倍：8 × 2 = 16，再少 3 张：16 − 3 = 13 张。' },
  { id: 'm4-11', subject: 'math', tier: 4, prompt: '今天是星期三，10 天后是星期几？', sub: 'Today is Wednesday. What day in 10 days?', choices: ['星期五', '星期六', '星期日', '星期一'], answer: 1, explain: '每 7 天轮一圈：10 ÷ 7 = 1 圈余 3 天，星期三往后数 3 天是星期六。' },
  { id: 'm4-12', subject: 'math', tier: 4, prompt: '2 + 4 + 6 + 8 + 10 = ?', sub: 'Add the even numbers from 2 to 10.', choices: ['24', '28', '30', '32'], answer: 2, explain: '首尾配对：2+10=12、4+8=12，中间剩 6，12+12+6 = 30。' },
  { id: 'm4-13', subject: 'math', tier: 4, prompt: '一个数除以 5，商是 4 余 3。这个数是几？', sub: 'A number divided by 5 gives 4 remainder 3.', choices: ['17', '20', '23', '26'], answer: 2, explain: '被除数 = 商 × 除数 + 余数 = 4 × 5 + 3 = 23。' },

  { id: 'e4-1', subject: 'english', tier: 4, prompt: 'One mouse, two ___ ?', sub: 'mouse 的复数是什么？', choices: ['mouses', 'mice', 'mouse', 'mices'], answer: 1, explain: 'mouse 是不规则名词，复数是 mice。' },
  { id: 'e4-2', subject: 'english', tier: 4, prompt: 'Which word means "very big"?', sub: '哪个词表示「非常大」？', choices: ['tiny', 'thin', 'huge', 'short'], answer: 2, explain: 'huge 是巨大的。tiny 微小、thin 瘦、short 矮。' },
  { id: 'e4-3', subject: 'english', tier: 4, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['Monday', 'Tuesday', 'March', 'Friday'], answer: 2, explain: 'Monday、Tuesday、Friday 是星期几，只有 March（三月）是月份。' },
  { id: 'e4-4', subject: 'english', tier: 4, prompt: 'What is the opposite of "always"?', sub: 'always（总是）的反义词是？', choices: ['often', 'never', 'sometimes', 'usually'], answer: 1, explain: 'always（总是）↔ never（从不）。sometimes 是「有时」，在中间。' },
  { id: 'e4-5', subject: 'english', tier: 4, prompt: 'I have ___ orange and ___ banana.', sub: '两个空分别用 a 还是 an？', choices: ['a … a', 'an … an', 'an … a', 'a … an'], answer: 2, explain: 'orange 以元音音素开头用 an；banana 以辅音音素开头用 a。' },
  { id: 'e4-6', subject: 'english', tier: 4, prompt: 'A baby cat is called a ___ .', sub: '小猫叫什么？', choices: ['puppy', 'kitten', 'calf', 'chick'], answer: 1, explain: 'kitten 是小猫；puppy 小狗、calf 小牛、chick 小鸡。' },
  { id: 'e4-7', subject: 'english', tier: 4, prompt: 'cat → tiger → rabbit → ? Each word starts with the last letter of the word before.', sub: '每个词都以前一个词的最后一个字母开头，下一个是？', choices: ['tree', 'apple', 'dog', 'snake'], answer: 0, explain: 'cat 以 t 结尾 → tiger；tiger 以 r 结尾 → rabbit；rabbit 以 t 结尾，所以下一个要用 t 开头：tree。' },
  { id: 'e4-8', subject: 'english', tier: 4, prompt: 'How many letters are in the word "elephant"?', sub: 'elephant 有几个字母？', choices: ['7', '8', '9', '10'], answer: 1, explain: 'e-l-e-p-h-a-n-t，一共 8 个字母。' },

  // ---------- 第 5 档：奥赛（植树、年龄、倍数、排列） ----------
  { id: 'm5-1', subject: 'math', tier: 5, prompt: '找规律：1, 1, 2, 3, 5, 8, ?', sub: 'What comes next: 1, 1, 2, 3, 5, 8, ?', choices: ['11', '12', '13', '16'], answer: 2, explain: '每个数是前两个数之和：5 + 8 = 13。这叫斐波那契数列。' },
  { id: 'm5-2', subject: 'math', tier: 5, prompt: '笼子里鸡兔共 8 个头、26 只脚。兔有几只？', sub: '8 heads, 26 feet. How many rabbits?', choices: ['3 只', '4 只', '5 只', '6 只'], answer: 2, explain: '假设全是鸡：8 × 2 = 16 只脚，少 10 只。每换一只兔多 2 只脚，10 ÷ 2 = 5 只兔。' },
  { id: 'm5-3', subject: 'math', tier: 5, prompt: '一个数加 3 以后再乘 2，结果是 16。这个数是几？', sub: '(n + 3) × 2 = 16. What is n?', choices: ['4', '5', '6', '8'], answer: 1, explain: '倒着算：16 ÷ 2 = 8，8 − 3 = 5。' },
  { id: 'm5-4', subject: 'math', tier: 5, prompt: '从 1 楼走到 3 楼有 24 级台阶。从 1 楼走到 6 楼有几级？', sub: '1F to 3F is 24 steps. 1F to 6F?', choices: ['48 级', '60 级', '72 级', '40 级'], answer: 1, explain: '1 楼到 3 楼只爬 2 层，每层 24 ÷ 2 = 12 级。1 楼到 6 楼爬 5 层：12 × 5 = 60 级。' },
  { id: 'm5-5', subject: 'math', tier: 5, prompt: '钟敲 6 下用 5 秒，敲 12 下用几秒？', sub: '6 chimes take 5 seconds. How long for 12?', choices: ['10 秒', '11 秒', '12 秒', '15 秒'], answer: 1, explain: '敲 6 下中间有 5 个间隔，5 ÷ 5 = 每个间隔 1 秒。敲 12 下有 11 个间隔，所以 11 秒。' },
  { id: 'm5-6', subject: 'math', tier: 5, prompt: '用 1、2、3 组成没有重复数字的三位数，一共有几个？', sub: 'Three-digit numbers using 1, 2, 3 with no repeats?', choices: ['3 个', '6 个', '9 个', '12 个'], answer: 1, explain: '百位 3 种选法，十位剩 2 种，个位剩 1 种：3 × 2 × 1 = 6 个。' },
  { id: 'm5-7', subject: 'math', tier: 5, prompt: '一条 20 米的路，每隔 5 米种一棵树，两头都种。一共种几棵？', sub: '20 m road, a tree every 5 m, trees at both ends.', choices: ['4 棵', '5 棵', '6 棵', '8 棵'], answer: 1, explain: '20 ÷ 5 = 4 段，两头都种，棵数比段数多 1：4 + 1 = 5 棵。' },
  { id: 'm5-8', subject: 'math', tier: 5, prompt: '小明 6 岁，爸爸 36 岁。几年后爸爸的年龄正好是小明的 3 倍？', sub: 'He is 6, dad is 36. When is dad exactly 3× his age?', choices: ['6 年后', '9 年后', '12 年后', '15 年后'], answer: 1, explain: '年龄差永远是 30 岁。爸爸是 3 倍时，差就是小明的 2 倍，所以小明 15 岁，还要 9 年。' },
  { id: 'm5-9', subject: 'math', tier: 5, prompt: '最大的三位数减最小的三位数，等于多少？', sub: 'Largest 3-digit number minus the smallest.', choices: ['899', '900', '989', '999'], answer: 0, explain: '最大是 999，最小是 100，999 − 100 = 899。' },
  { id: 'm5-10', subject: 'math', tier: 5, prompt: '一个正方形的周长是 20 厘米，它的面积是多少？', sub: 'A square has perimeter 20 cm. Its area?', choices: ['16 平方厘米', '20 平方厘米', '25 平方厘米', '100 平方厘米'], answer: 2, explain: '边长 = 20 ÷ 4 = 5 厘米，面积 = 5 × 5 = 25 平方厘米。' },
  { id: 'm5-11', subject: 'math', tier: 5, prompt: '1 到 20 里，既是 2 的倍数又是 3 的倍数的数有几个？', sub: 'From 1 to 20, how many are multiples of both 2 and 3?', choices: ['2 个', '3 个', '4 个', '6 个'], answer: 1, explain: '同时是 2 和 3 的倍数，就是 6 的倍数：6、12、18，共 3 个。' },
  { id: 'm5-12', subject: 'math', tier: 5, prompt: '红、黄、蓝三个球排成一排，有几种不同的排法？', sub: 'Three balls in a row. How many orders?', choices: ['3 种', '6 种', '9 种', '12 种'], answer: 1, explain: '第一个位置 3 种选法，第二个剩 2 种，第三个剩 1 种：3 × 2 × 1 = 6 种。' },

  { id: 'e5-1', subject: 'english', tier: 5, prompt: 'One foot, two ___ ?', sub: 'foot 的复数是什么？', choices: ['foots', 'feet', 'feets', 'footes'], answer: 1, explain: 'foot 是不规则名词，复数是 feet。' },
  { id: 'e5-2', subject: 'english', tier: 5, prompt: 'Yesterday he ___ the ball.', sub: 'catch 的过去式是什么？', choices: ['catched', 'caught', 'catches', 'catching'], answer: 1, explain: 'catch 是不规则动词，过去式是 caught。' },
  { id: 'e5-3', subject: 'english', tier: 5, prompt: 'Which sentence is correct?', sub: '哪句是对的？', choices: ['He don\'t like milk.', 'He doesn\'t like milk.', 'He not like milk.', 'He no likes milk.'], answer: 1, explain: '主语是 he（第三人称单数），否定用 doesn\'t，后面动词用原形 like。' },
  { id: 'e5-4', subject: 'english', tier: 5, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['swim', 'run', 'jump', 'chair'], answer: 3, explain: 'swim、run、jump 都是动词（动作），chair（椅子）是名词。' },
  { id: 'e5-5', subject: 'english', tier: 5, prompt: 'The cat is sleeping ___ the table.', sub: '猫睡在桌子上面，用哪个介词？', choices: ['in', 'on', 'under', 'between'], answer: 1, explain: '在物体表面上用 on。in 在里面，under 在下面，between 在两者之间。' },
  { id: 'e5-6', subject: 'english', tier: 5, prompt: 'What is the opposite of "ask"?', sub: 'ask（问）的反义词是？', choices: ['answer', 'say', 'talk', 'tell'], answer: 0, explain: 'ask（问）↔ answer（答）。' },
  { id: 'e5-7', subject: 'english', tier: 5, prompt: 'Put these letters in order: t h g i n', sub: '把字母排成一个单词', choices: ['night', 'light', 'right', 'sight'], answer: 0, explain: '给的字母是 n、i、g、h、t，只能拼成 night（夜晚）。light、right、sight 都要用到 l、r、s。' },
  { id: 'e5-8', subject: 'english', tier: 5, prompt: 'Tom is taller than Sam. Sam is taller than Ben. Who is the shortest?', sub: 'Tom 比 Sam 高，Sam 比 Ben 高。谁最矮？', choices: ['Tom', 'Sam', 'Ben', 'We cannot tell'], answer: 2, explain: '排一排：Tom > Sam > Ben，所以 Ben 最矮（shortest）。' },

  // ---------- 第 6 档：奥赛·难（还原、盈亏、页码、构词） ----------
  { id: 'm6-1', subject: 'math', tier: 6, prompt: '鸡比兔多 2 只，脚一共 22 只。兔有几只？', sub: '2 more chickens than rabbits, 22 feet in all. Rabbits?', choices: ['2 只', '3 只', '4 只', '5 只'], answer: 1, explain: '设兔 x 只，鸡 x+2 只：4x + 2(x+2) = 22 → 6x + 4 = 22 → x = 3。兔 3 只、鸡 5 只，脚 12 + 10 = 22。' },
  { id: 'm6-2', subject: 'math', tier: 6, prompt: '找规律：2, 6, 12, 20, 30, ?', sub: 'What comes next: 2, 6, 12, 20, 30, ?', choices: ['36', '40', '42', '45'], answer: 2, explain: '相邻两数的差是 4、6、8、10，下一个差是 12：30 + 12 = 42。' },
  { id: 'm6-3', subject: 'math', tier: 6, prompt: '一堆糖，吃掉一半又多 1 颗，还剩 5 颗。原来有几颗？', sub: 'Ate half plus 1 more, 5 left. How many at first?', choices: ['10 颗', '11 颗', '12 颗', '14 颗'], answer: 2, explain: '倒着推：剩的 5 颗加上多吃的 1 颗是 6 颗，这正好是一半，所以原来 6 × 2 = 12 颗。' },
  { id: 'm6-4', subject: 'math', tier: 6, prompt: '5 个人排成一排照相，小明必须站正中间。有几种排法？', sub: '5 people in a row, one fixed in the middle.', choices: ['12 种', '20 种', '24 种', '60 种'], answer: 2, explain: '小明位置定死，剩下 4 人排 4 个位置：4 × 3 × 2 × 1 = 24 种。' },
  { id: 'm6-5', subject: 'math', tier: 6, prompt: '分糖：每人 5 颗多出 3 颗，每人 6 颗差 2 颗。一共几个人？', sub: '5 each leaves 3 over; 6 each is 2 short. How many people?', choices: ['4 人', '5 人', '6 人', '8 人'], answer: 1, explain: '每人多给 1 颗，就从多 3 颗变成少 2 颗，相差 5 颗，所以有 5 人（糖 5×5+3 = 28 颗）。' },
  { id: 'm6-6', subject: 'math', tier: 6, prompt: '1 + 3 + 5 + 7 + … + 19 = ?', sub: 'Add all odd numbers from 1 to 19.', choices: ['80', '90', '100', '110'], answer: 2, explain: '一共 10 个奇数，首尾配对 1+19=20、3+17=20…共 5 对，5 × 20 = 100。（n 个奇数的和就是 n×n）' },
  { id: 'm6-7', subject: 'math', tier: 6, prompt: '一本书的页码一共用了 33 个数字。这本书有几页？', sub: 'Page numbers use 33 digits in total. How many pages?', choices: ['18 页', '21 页', '24 页', '33 页'], answer: 1, explain: '1~9 页每页 1 个数字，用掉 9 个；剩 33 − 9 = 24 个，两位数每页 2 个，24 ÷ 2 = 12 页，9 + 12 = 21 页。' },
  { id: 'm6-8', subject: 'math', tier: 6, prompt: '一个数加 5、再减 3、然后乘 2，结果是 16。这个数是几？', sub: '((n + 5) − 3) × 2 = 16. Find n.', choices: ['4', '5', '6', '7'], answer: 2, explain: '倒着算：16 ÷ 2 = 8，8 + 3 = 11，11 − 5 = 6。' },

  { id: 'e6-1', subject: 'english', tier: 6, prompt: 'One sheep, two ___ ?', sub: 'sheep 的复数是什么？', choices: ['sheeps', 'sheep', 'sheepes', 'sheepen'], answer: 1, explain: 'sheep 单复数同形，two sheep 不加 -s。' },
  { id: 'e6-2', subject: 'english', tier: 6, prompt: 'Last year she ___ us English.', sub: 'teach 的过去式是什么？', choices: ['teached', 'taught', 'teaches', 'teaching'], answer: 1, explain: 'teach 是不规则动词，过去式是 taught。' },
  { id: 'e6-3', subject: 'english', tier: 6, prompt: 'This box is ___ than that one.', sub: '「更重」用哪个形式？', choices: ['heavy', 'heavier', 'heaviest', 'more heavy'], answer: 1, explain: '两者比较用比较级；heavy 结尾是辅音 + y，把 y 变 i 再加 -er：heavier。' },
  { id: 'e6-4', subject: 'english', tier: 6, prompt: 'Which is the odd one out?', sub: '哪个和其它三个不是一类？', choices: ['June', 'July', 'Sunday', 'April'], answer: 2, explain: 'June、July、April 都是月份，只有 Sunday（星期日）是星期。' },
  { id: 'e6-5', subject: 'english', tier: 6, prompt: 'A person who teaches is a ___ .', sub: '教书的人叫什么？', choices: ['teacher', 'doctor', 'farmer', 'driver'], answer: 0, explain: 'teach + -er = teacher（老师）。doctor 医生、farmer 农民、driver 司机。' },
  { id: 'e6-6', subject: 'english', tier: 6, prompt: 'What is the opposite of "ancient"?', sub: 'ancient（古老的）的反义词是？', choices: ['old', 'modern', 'quiet', 'heavy'], answer: 1, explain: 'ancient（古老的）↔ modern（现代的）。' },
  { id: 'e6-7', subject: 'english', tier: 6, prompt: 'Which word can go BEFORE all three: ___ball, ___man, ___flake?', sub: '哪个词放在这三个词前面都能组成新词？', choices: ['snow', 'rain', 'sun', 'ice'], answer: 0, explain: 'snowball（雪球）、snowman（雪人）、snowflake（雪花）——只有 snow 三个都能组成。' },
  { id: 'e6-8', subject: 'english', tier: 6, prompt: 'I have hands but I cannot clap. What am I?', sub: '我有手，却不能拍手。我是什么？', choices: ['a clock', 'a tree', 'a book', 'a door'], answer: 0, explain: '钟表的指针在英文里叫 hands（时针 hour hand、分针 minute hand），但它不会拍手。' },
]

// 开场先答一题，之后每隔这么久再来一题。
export const QUIZ_INTERVAL = 180 // 秒
// 层主（第 3/6/9/12 关）开打前连考几道——这是一局里最该停下来动脑的时刻。
export const BOSS_QUIZ_COUNT = 3

// 进层主关该不该拦下来考一组题。lastGatedStage 保证同一关只拦一次。
export function shouldGateBoss(o: {
  learnMode: boolean
  status: string
  bossStage: boolean
  stage: number
  lastGatedStage: number
  quizOpen: boolean
  storyActive: boolean
}): boolean {
  if (!o.learnMode || o.quizOpen || o.storyActive) return false
  if (o.status !== 'playing' || !o.bossStage) return false
  return o.stage > o.lastGatedStage
}

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
