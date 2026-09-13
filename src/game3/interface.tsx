const positions: Record<string, [number, number]> = {
  '西安': [34, 46], '太原': [49, 31], '北京': [64, 18], '济南': [69, 38],
  '南京': [73, 57], '武昌': [49, 62], '成都': [20, 65], '杭州': [80, 73],
  '广州': [49, 88], '山海关': [83, 9],
}

export function RealmMap({ cities, owned, capital }: { cities: string[]; owned: string[]; capital: string }) {
  return <section className="realm-map" aria-label={`疆域舆图，已占领${owned.length}座城池`}>
    <svg viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">
      <path className="map-land" d="M18 55 76 25 124 44 183 12 279 22 270 76 233 99 251 139 269 182 224 241 172 287 108 253 60 268 36 201 12 159Z" />
      <path className="map-river" d="M30 145 Q75 119 109 151 T220 180 L267 170 M85 54 Q125 105 154 92 T243 106" />
      <path className="map-ridge" d="m34 96 14-17 14 17m-4 13 17-22 17 22m-42 77 16-25 16 25m22-59 17-25 17 25" />
    </svg>
    {cities.map(city => <span key={city} style={{ left: `${positions[city][0]}%`, top: `${positions[city][1]}%` }} className={`map-city${owned.includes(city) ? ' owned' : ''}${city === capital ? ' capital' : ''}`} aria-label={`${city}${owned.includes(city) ? '，已占领' : '，未占领'}${city === capital ? '，当前驻地' : ''}`}>{city}</span>)}
    <small className="map-caption">疆域示意 · 朱印为已得城池</small>
  </section>
}

export function PlayGuide({ compact = false }: { compact?: boolean }) {
  return <details className={`play-guide${compact ? ' compact' : ''}`}>
    <summary>如何立国 <span>读局势 · 作抉择 · 定天下</span></summary>
    <div className="guide-content">
      <p><b>一 · 阅读局势</b>　查看事件与四柱国势，权衡每个选项的影响。文字模式点击选项即可推进，思考时不会流逝时间。</p>
      <p><b>二 · 作出抉择</b>　人才、军制与姻亲会持续影响政令。统兵与招揽并非必成，军势、朝局与天命会影响结果。</p>
      <p><b>三 · 建立新朝</b>　让军事、政治、经济至少两项强盛，并保住天命。城池、人才与姻亲会影响王朝走向。</p>
      {!compact && <p><b>想亲自执行？</b>　选择 Start Playing 进入 3D 世界。WASD / 方向键移动、E 交互；手机用摇杆。跟随目标战斗、护送与施政，Esc 或右上角暂停。</p>}
      <p>刷新会结束当前局；已解锁君王保留。两种玩法都可建立新朝。</p>
    </div>
  </details>
}
