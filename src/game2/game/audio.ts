// ---------- Procedural audio ----------
// Every sound is synthesised at runtime with the Web Audio API: no files to
// download, so the game still has full audio on a train with no signal (and the
// PWA cache stays tiny). Envelopes are short and levels conservative so rapid
// combat never turns into clipping mush.

export type Sfx =
  | 'hit' | 'crit' | 'kill' | 'gem' | 'pickup' | 'stage' | 'cast'
  | 'hurt' | 'death' | 'lordWarn' | 'lordHit' | 'relic' | 'victory' | 'ui'

const MUTE_KEY = 'sword-of-the-depths:v2:muted'

export class AudioKit {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false
  /** Per-sound cooldowns so a swarm of hits doesn't stack into noise. */
  private last: Partial<Record<Sfx, number>> = {}
  /** Voices started this frame — a hard cap protects against dogpiles. */
  private voices = 0
  private voiceReset = 0
  /** Test hook: how many sounds have actually been triggered. */
  played = 0

  constructor() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1' } catch { /* ignore */ }
  }

  /** Must be called from a real user gesture (browsers block audio otherwise). */
  resume() {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.muted ? 0 : 0.5
      this.master.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  isMuted() { return this.muted }

  toggleMute(): boolean {
    this.muted = !this.muted
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0') } catch { /* ignore */ }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02)
    }
    return this.muted
  }

  /**
   * Fire a sound. `intensity` (0..1) nudges pitch/level so repeated sounds
   * (e.g. a kill combo) escalate instead of flatlining.
   */
  play(name: Sfx, intensity = 0) {
    const ctx = this.ctx
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime
    // frame-based voice cap
    if (t - this.voiceReset > 0.05) { this.voiceReset = t; this.voices = 0 }
    if (this.voices >= 6) return
    // per-sound throttle
    const gap = MIN_GAP[name] ?? 0
    if (gap && t - (this.last[name] ?? -1) < gap) return
    this.last[name] = t
    this.voices++
    this.played++

    switch (name) {
      case 'hit': return this.noise(t, 0.05, 900 + intensity * 700, 0.13)
      case 'crit': {
        this.noise(t, 0.08, 1800, 0.2)
        return this.tone(t, 'square', 620, 300, 0.09, 0.1)
      }
      case 'kill': return this.tone(t, 'triangle', 300 + intensity * 260, 90, 0.12, 0.11)
      case 'gem': return this.tone(t, 'sine', 700 + intensity * 500, 1150 + intensity * 500, 0.07, 0.075)
      case 'pickup': {
        this.tone(t, 'sine', 620, 900, 0.09, 0.11)
        return this.tone(t + 0.07, 'sine', 900, 1320, 0.1, 0.09)
      }
      case 'stage': return this.arp(t, [523, 659, 784, 1047], 0.09, 0.12)
      case 'cast': return this.tone(t, 'sawtooth', 260, 620, 0.14, 0.085)
      case 'hurt': {
        this.noise(t, 0.14, 420, 0.16)
        return this.tone(t, 'sawtooth', 200, 90, 0.18, 0.1)
      }
      case 'death': return this.arp(t, [392, 330, 262, 196], 0.28, 0.16)
      case 'lordWarn': return this.tone(t, 'square', 150, 150, 0.5, 0.09)
      case 'lordHit': {
        this.noise(t, 0.3, 220, 0.28)
        return this.tone(t, 'sawtooth', 110, 55, 0.36, 0.16)
      }
      case 'relic': return this.arp(t, [523, 784, 1047, 1319], 0.16, 0.13)
      case 'victory': return this.arp(t, [523, 659, 784, 1047, 1319], 0.3, 0.16)
      case 'ui': return this.tone(t, 'sine', 520, 700, 0.06, 0.07)
    }
  }

  // ---- tiny synth helpers ----
  private tone(at: number, type: OscillatorType, from: number, to: number, dur: number, peak: number) {
    const ctx = this.ctx!
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(from, at)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(peak, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(g); g.connect(this.master!)
    osc.start(at); osc.stop(at + dur + 0.02)
  }

  private noise(at: number, dur: number, cutoff: number, peak: number) {
    const ctx = this.ctx!
    const frames = Math.max(1, Math.floor(ctx.sampleRate * dur))
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const g = ctx.createGain()
    g.gain.setValueAtTime(peak, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(filter); filter.connect(g); g.connect(this.master!)
    src.start(at); src.stop(at + dur + 0.02)
  }

  private arp(at: number, notes: number[], dur: number, peak: number) {
    const step = dur / notes.length
    notes.forEach((n, i) => this.tone(at + i * step, 'triangle', n, n, step * 1.6, peak))
  }
}

/** Minimum seconds between repeats of the same sound. */
const MIN_GAP: Partial<Record<Sfx, number>> = {
  hit: 0.045,
  crit: 0.08,
  kill: 0.05,
  gem: 0.045,
  hurt: 0.18,
  cast: 0.06,
  lordWarn: 0.4,
}

export const audio = new AudioKit()
