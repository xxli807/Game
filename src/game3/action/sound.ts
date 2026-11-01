// Audio begins only after a player's gesture; this module owns its context.
export class BattleSound {
  private context?: AudioContext
  private noise?: AudioBuffer
  private lastHit = 0
  muted = false
  play(kind: 'hit' | 'dash' | 'capture' | 'hurt' | 'win' | 'swing' | 'parry' | 'drum' | 'gong' | 'volley') {
    if (this.muted) return
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
      const ctx = this.context, time = ctx.currentTime
      if (kind === 'hit' && time - this.lastHit < .07) return
      if (kind === 'hit') this.lastHit = time
      if (kind === 'swing' || kind === 'hit' || kind === 'parry' || kind === 'volley' || kind === 'drum' || kind === 'gong') {
        const tone = (frequency: number, duration: number, volume: number, delay = 0, end = frequency * .8) => {
          const osc = ctx.createOscillator(), envelope = ctx.createGain(), start = time + delay
          osc.type = 'sine'; osc.frequency.setValueAtTime(frequency, start); osc.frequency.exponentialRampToValueAtTime(end, start + duration)
          envelope.gain.setValueAtTime(.001, start); envelope.gain.linearRampToValueAtTime(volume, start + .007); envelope.gain.exponentialRampToValueAtTime(.0001, start + duration)
          osc.connect(envelope); envelope.connect(ctx.destination); osc.start(start); osc.stop(start + duration + .02)
          osc.onended = () => { osc.disconnect(); envelope.disconnect() }
        }
        if (kind === 'drum') { for (let i = 0; i < 3; i++) { tone(110, .32, .14, i * .19, 42); tone(180, .13, .025, i * .19, 64) }; return }
        if (kind === 'gong') { [155, 242, 397, 570].forEach((f, i) => tone(f, 1.15 - i * .14, .045 / (i + 1))); return }
        if (kind === 'parry') { [1150, 1760, 2480].forEach((f, i) => tone(f, .25 - i * .04, .024 / (i + 1))) }
        if (kind === 'hit') { tone(115, .13, .075, 0, 45); tone(920, .08, .015) }
        this.noise ??= ctx.createBuffer(1, ctx.sampleRate * .4, ctx.sampleRate)
        const samples = this.noise.getChannelData(0)
        if (!samples[0]) for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
        const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain()
        const duration = kind === 'swing' || kind === 'volley' ? .22 : .09
        source.buffer = this.noise; filter.type = 'bandpass'; filter.frequency.setValueAtTime(kind === 'swing' ? 650 : 2200, time); filter.Q.value = .7
        filter.frequency.exponentialRampToValueAtTime(200, time + duration)
        gain.gain.setValueAtTime(.001, time); gain.gain.linearRampToValueAtTime(.07, time + .025); gain.gain.exponentialRampToValueAtTime(.0001, time + duration)
        source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start(); source.stop(time + duration)
        source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect() }
        return
      }
      const oscillator = ctx.createOscillator(), gain = ctx.createGain()
      const freq = { hit: 160, dash: 360, capture: 523, hurt: 75, win: 784 }[kind]
      oscillator.type = kind === 'capture' || kind === 'win' ? 'sine' : 'triangle'
      oscillator.frequency.setValueAtTime(freq, time)
      oscillator.frequency.exponentialRampToValueAtTime(kind === 'capture' ? 1046 : freq * .45, time + .18)
      gain.gain.setValueAtTime(.035, time)
      gain.gain.exponentialRampToValueAtTime(.001, time + .22)
      oscillator.connect(gain); gain.connect(ctx.destination)
      oscillator.start(); oscillator.stop(time + .23)
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    } catch { /* Audio is optional; a browser restriction must not stop combat. */ }
  }
  destroy() { void this.context?.close().catch(() => {}) }
}
