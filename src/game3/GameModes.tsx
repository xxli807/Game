export type GameMode = 'chronicle' | 'world'

export function GameModes({ onStart }: { onStart: (mode: GameMode) => void }) {
  return <section className="game-modes" aria-label="选择游玩方式">
    <article className="game-mode">
      <p className="eyebrow">文字抉择</p>
      <h2>读局势，定天下</h2>
      <p>阅读事件、权衡选择，以政令与谋略书写王朝。按自己的节奏思考。</p>
      <button className="start-btn" data-mode="chronicle" onClick={() => onStart('chronicle')}>进入天下 <span aria-hidden="true">→</span></button>
    </article>
    <article className="game-mode game-mode-world">
      <p className="eyebrow">3D 亲历天下</p>
      <h2>走进你的王朝</h2>
      <p>亲自移动、战斗、护送与交涉。在连续的村庄世界里执行你的选择。</p>
      <button className="start-playing-btn" data-mode="world" onClick={() => onStart('world')}>Start Playing <span aria-hidden="true">→</span></button>
    </article>
  </section>
}
