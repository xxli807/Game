// WCAG 2.2 对比度计算：node contrast.mjs "#967757" "#efe1c4"
// 支持 #rgb / #rrggbb / rgb(r,g,b)；第二个参数省略时按 v3 的纸面底色 #efe1c4 算。
const parse = (s) => {
  const rgb = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i)
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]]
  let h = s.trim().replace(/^#/, '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`认不出这个颜色：${s}`)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const [fg, bg = '#efe1c4'] = process.argv.slice(2)
if (!fg) { console.error('用法: node contrast.mjs <前景色> [背景色]'); process.exit(2) }

const a = lum(parse(fg)), b = lum(parse(bg))
const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
const mark = (ok) => (ok ? '✓ 合格' : '✗ 不合格')
console.log(`${fg} on ${bg}  →  ${ratio.toFixed(2)}:1`)
console.log(`  正文 (AA 4.5:1)          ${mark(ratio >= 4.5)}`)
console.log(`  大字 (AA 3:1, ≥24px/粗18.66px)  ${mark(ratio >= 3)}`)
console.log(`  非文字（边框/图标 3:1）   ${mark(ratio >= 3)}`)
console.log(`  正文 (AAA 7:1)           ${mark(ratio >= 7)}`)
