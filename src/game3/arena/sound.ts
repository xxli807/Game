// Procedural arena sounds; no audio files. The context starts on the first player gesture.
export type ArenaSfx = 'hit' | 'cast' | 'ult' | 'kill' | 'death' | 'tower' | 'level' | 'buy' | 'win' | 'lose' | 'horn' | 'whoosh' | 'slash' | 'boom' | 'coin'
const NOTES: Record<ArenaSfx, [number, number, number, OscillatorType][]> = {
  // [frequency, start, length, wave]
  hit: [[180, 0, 0.07, 'triangle']],
  cast: [[420, 0, 0.1, 'sine'], [640, 0.05, 0.12, 'sine']],
  ult: [[220, 0, 0.18, 'sawtooth'], [330, 0.08, 0.2, 'sawtooth'], [520, 0.16, 0.3, 'sine']],
  kill: [[523, 0, 0.12, 'sine'], [784, 0.1, 0.22, 'sine']],
  death: [[200, 0, 0.2, 'sawtooth'], [110, 0.15, 0.4, 'sawtooth']],
  tower: [[90, 0, 0.35, 'sawtooth'], [60, 0.2, 0.5, 'triangle']],
  level: [[440, 0, 0.1, 'sine'], [554, 0.08, 0.1, 'sine'], [659, 0.16, 0.2, 'sine']],
  buy: [[880, 0, 0.06, 'sine'], [1175, 0.05, 0.1, 'sine']],
  win: [[392, 0, 0.2, 'sine'], [523, 0.18, 0.2, 'sine'], [659, 0.36, 0.2, 'sine'], [784, 0.54, 0.5, 'sine']],
  lose: [[330, 0, 0.3, 'triangle'], [262, 0.28, 0.3, 'triangle'], [196, 0.56, 0.6, 'triangle']],
  horn: [[147, 0, 0.5, 'sawtooth'], [196, 0.3, 0.6, 'sawtooth']],
  whoosh: [], slash: [[900, 0, 0.05, 'triangle']], boom: [[110, 0, 0.3, 'sine'], [55, 0.05, 0.45, 'sine']],
  coin: [[1320, 0, 0.05, 'sine'], [1760, 0.05, 0.09, 'sine']],
}
// Filtered noise gives the airy part of a swing, a dash or a blast: [start Hz, end Hz, length, gain].
const NOISE: Partial<Record<ArenaSfx, [number, number, number, number]>> = {
  whoosh: [500, 2600, 0.24, 0.5], slash: [3200, 900, 0.12, 0.6], boom: [900, 90, 0.5, 1], ult: [400, 3000, 0.4, 0.5], tower: [700, 80, 0.7, 0.9], hit: [1800, 700, 0.05, 0.25],
}
export class ArenaSound {
  muted = false
  private context?: AudioContext
  private last = new Map<ArenaSfx, number>()
  private noise?: AudioBuffer
  play(kind: ArenaSfx, volume = 1) {
    if (this.muted) return
    try {
      this.context ??= new AudioContext()
      const ctx = this.context, now = ctx.currentTime
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
      // Dozens of hits can land in one frame; one voice per kind per 50 ms is plenty.
      if (now - (this.last.get(kind) ?? -1) < 0.05) return
      this.last.set(kind, now)
      for (const [freq, start, length, wave] of NOTES[kind]) {
        const osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.type = wave; osc.frequency.setValueAtTime(freq, now + start)
        gain.gain.setValueAtTime(0.0001, now + start); gain.gain.exponentialRampToValueAtTime(0.05 * volume, now + start + 0.015); gain.gain.exponentialRampToValueAtTime(0.0001, now + start + length)
        osc.connect(gain); gain.connect(ctx.destination); osc.start(now + start); osc.stop(now + start + length + 0.02)
      }
      const air = NOISE[kind]
      if (air) {
        if (!this.noise) { this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1 }
        const [from, to, length, level] = air, source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain()
        source.buffer = this.noise; filter.type = 'bandpass'; filter.Q.value = 0.9
        filter.frequency.setValueAtTime(from, now); filter.frequency.exponentialRampToValueAtTime(to, now + length)
        gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.09 * level * volume, now + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, now + length)
        source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); source.start(now); source.stop(now + length + 0.02)
      }
    } catch { /* audio is optional */ }
  }
  /** Build the audio engine and noise buffer up front. Creating them on the first hit cost a
   *  ~160 ms freeze mid-fight; the match start (right after the 开战 click) is the right moment. */
  warm() {
    try {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
      if (!this.noise) { const ctx = this.context; this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1 }
    } catch { /* audio is optional */ }
  }
  destroy() { void this.context?.close().catch(() => {}) }
}
