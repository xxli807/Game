// Audio begins only after a player's gesture; this module owns its context.
export class BattleSound {
  private context?: AudioContext
  muted = false
  play(kind: 'hit' | 'dash' | 'capture' | 'hurt' | 'win') {
    if (this.muted) return
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
      const ctx = this.context, time = ctx.currentTime
      const oscillator = ctx.createOscillator(), gain = ctx.createGain()
      const freq = { hit: 160, dash: 360, capture: 523, hurt: 75, win: 784 }[kind]
      oscillator.type = kind === 'capture' || kind === 'win' ? 'sine' : 'triangle'
      oscillator.frequency.setValueAtTime(freq, time)
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'capture' ? 1046 : freq * .45, time + .18)
      gain.gain.setValueAtTime(.035, time)
      gain.gain.exponentialRampToValueAtTime(.001, time + .22)
      oscillator.connect(gain); gain.connect(ctx.destination)
      oscillator.start(); oscillator.stop(time + .23)
    } catch { /* Audio is optional; a browser restriction must not stop combat. */ }
  }
  destroy() { void this.context?.close().catch(() => {}) }
}
