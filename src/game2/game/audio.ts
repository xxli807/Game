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
      this.master.gain.value = this.muted ? 0 : 0.45
      // Soften the whole mix: a gentle low-pass takes the harsh digital edge off
      // synthesised tones, and a compressor keeps a busy fight from spiking.
      const tame = this.ctx.createBiquadFilter()
      tame.type = 'lowpass'
      tame.frequency.value = 5200
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.knee.value = 24
      comp.ratio.value = 8
      comp.attack.value = 0.004
      comp.release.value = 0.18
      this.master.connect(tame)
      tame.connect(comp)
      comp.connect(this.ctx.destination)
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
      // A sword hit = a soft thump with body, not a hiss.
      case 'hit': {
        this.noise(t, 0.035, 420, 0.07)
        return this.tone(t, 'sine', 190 + intensity * 60, 95, 0.075, 0.13)
      }
      case 'crit': {
        this.noise(t, 0.05, 900, 0.09)
        this.tone(t, 'sine', 250, 110, 0.1, 0.15)
        return this.tone(t + 0.02, 'triangle', 880, 660, 0.1, 0.06)
      }
      case 'kill': return this.tone(t, 'triangle', 420 + intensity * 260, 210, 0.1, 0.09)
      case 'gem': return this.tone(t, 'sine', 780 + intensity * 420, 1180 + intensity * 420, 0.06, 0.055)
      case 'pickup': {
        this.tone(t, 'sine', 660, 880, 0.08, 0.09)
        return this.tone(t + 0.06, 'sine', 990, 1320, 0.09, 0.07)
      }
      case 'stage': return this.arp(t, [523, 659, 784, 1047], 0.09, 0.1)
      case 'cast': return this.tone(t, 'triangle', 330, 620, 0.11, 0.07)
      case 'hurt': {
        this.noise(t, 0.1, 300, 0.1)
        return this.tone(t, 'sine', 230, 110, 0.16, 0.12)
      }
      case 'death': return this.arp(t, [392, 330, 262, 196], 0.28, 0.13)
      case 'lordWarn': return this.tone(t, 'triangle', 160, 140, 0.45, 0.075)
      case 'lordHit': {
        this.noise(t, 0.22, 260, 0.14)
        return this.tone(t, 'sine', 120, 55, 0.34, 0.18)
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
