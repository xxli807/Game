import { useEffect, useState } from 'react'
import { QuizQuestion, SUBJECT_ICONS, SUBJECT_NAMES, TIER_NAMES } from '../game/quiz'

interface Props {
  question: QuizQuestion
  index: number // 这是本局第几道题
  correctSoFar: number
  streak: number
  reason: 'opening' | 'timer' | 'boss'
  nth: number // 这一组里的第几道
  total: number // 这一组一共几道
  onAnswer: (picked: number) => void // 作答即上报，用于结算奖励
  onDone: () => void // 看完讲解，继续游戏
}

// 边玩边学的提问框。答完先讲解再放行——做错的那道题才是真正要学的那道。
export default function QuizModal({ question, index, correctSoFar, streak, reason, nth, total, onAnswer, onDone }: Props) {
  const [picked, setPicked] = useState<number | null>(null)

  useEffect(() => { setPicked(null) }, [question.id])

  // 作答后用回车 / 空格继续，手不用离开键盘。
  useEffect(() => {
    if (picked === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDone() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, onDone])

  const answered = picked !== null
  const correct = picked === question.answer

  const choose = (i: number) => {
    if (answered) return
    setPicked(i)
    onAnswer(i)
  }

  return (
    <div className="overlay quiz-overlay">
      <div className="quiz-card">
        <div className="quiz-top">
          <span className="quiz-subject">{SUBJECT_ICONS[question.subject]} {SUBJECT_NAMES[question.subject]}</span>
          <span className="quiz-tier">{TIER_NAMES[question.tier - 1]} · 第 {question.tier} 档</span>
          <span className="quiz-score">答对 {correctSoFar}/{index}{streak >= 2 ? ` · 连对 ${streak} 🔥` : ''}</span>
        </div>

        {reason === 'boss' && (
          <p className="quiz-boss">⚔️ 层主就在前面——先过 {total} 道题，再去迎战。</p>
        )}
        <p className="quiz-lead">
          {reason === 'opening' ? '出发前，先答一题。' : reason === 'boss' ? `第 ${nth} / ${total} 道` : '稍等一下——先答一题，再继续下潜。'}
        </p>

        <h2 className="quiz-prompt">{question.prompt}</h2>
        {question.sub && <p className="quiz-sub">{question.sub}</p>}

        <div className="quiz-choices">
          {question.choices.map((choice, i) => {
            const state = !answered ? '' : i === question.answer ? ' right' : i === picked ? ' wrong' : ' dim'
            return (
              <button key={i} className={`quiz-choice${state}`} onClick={() => choose(i)} disabled={answered}>
                <span className="quiz-letter">{'ABCD'[i]}</span>
                <span className="quiz-text">{choice}</span>
                {answered && i === question.answer && <span className="quiz-mark">✓</span>}
                {answered && i === picked && i !== question.answer && <span className="quiz-mark">✗</span>}
              </button>
            )
          })}
        </div>

        {answered && (
          <div className={`quiz-feedback${correct ? ' good' : ''}`}>
            <b>{correct ? '🎉 答对了！+15% 生命 · 护盾 · 20 金币' : '💡 这次没答对，看看为什么：'}</b>
            <p>{question.explain}</p>
          </div>
        )}

        <button className="play-btn quiz-go" onClick={onDone} disabled={!answered}>
          {!answered ? '先选一个答案'
            : nth < total ? `下一题 (${nth + 1}/${total}) ▸`
            : reason === 'opening' ? '▼ 开始下潜'
            : reason === 'boss' ? '⚔️ 迎战层主'
            : '▶ 继续'}
        </button>
      </div>
    </div>
  )
}
