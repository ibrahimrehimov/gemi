// Lightweight Web Audio sound engine — no external assets.
// All effects are synthesised procedurally so the game stays self-contained.
// Music is a soft, looping ambient pad built from layered oscillators.

type SfxName = 'shoot' | 'splash' | 'explosion' | 'sunk' | 'win' | 'lose' | 'click' | 'place';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private musicPlaying = false;
  private musicNodes: OscillatorNode[] = [];

  sfxOn = true;
  musicOn = false;

  get isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.7;
      this.sfxGain.connect(this.master);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  // ---- SFX ---------------------------------------------------------------

  play(name: SfxName): void {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    switch (name) {
      case 'shoot':
        this.shoot(ctx);
        break;
      case 'splash':
        this.splash(ctx);
        break;
      case 'explosion':
        this.explosion(ctx);
        break;
      case 'sunk':
        this.sunk(ctx);
        break;
      case 'win':
        this.fanfare(ctx, true);
        break;
      case 'lose':
        this.fanfare(ctx, false);
        break;
      case 'click':
        this.click(ctx);
        break;
      case 'place':
        this.place(ctx);
        break;
    }
  }

  private tone(
    ctx: AudioContext,
    opts: { freq: number; type?: OscillatorType; dur: number; gain?: number; slideTo?: number; delay?: number }
  ): void {
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(opts.freq, t0);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t0 + opts.dur);
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g);
    g.connect(this.sfxGain!);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  private noise(ctx: AudioContext, dur: number, gain: number, filterFreq: number, delay = 0): void {
    const t0 = ctx.currentTime + delay;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, filterFreq * 0.3), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain!);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  private shoot(ctx: AudioContext): void {
    // quick descending whistle (shell flight)
    this.tone(ctx, { freq: 900, slideTo: 220, type: 'triangle', dur: 0.32, gain: 0.18 });
  }

  private splash(ctx: AudioContext): void {
    // water splash: short noise burst + soft high tone
    this.noise(ctx, 0.35, 0.25, 2200);
    this.tone(ctx, { freq: 520, slideTo: 300, type: 'sine', dur: 0.3, gain: 0.12, delay: 0.02 });
  }

  private explosion(ctx: AudioContext): void {
    // bassy boom + crackling noise
    this.tone(ctx, { freq: 140, slideTo: 45, type: 'sawtooth', dur: 0.5, gain: 0.32 });
    this.noise(ctx, 0.4, 0.3, 1600);
  }

  private sunk(ctx: AudioContext): void {
    // deep descending groan + rumble
    this.tone(ctx, { freq: 200, slideTo: 50, type: 'sawtooth', dur: 0.9, gain: 0.3 });
    this.noise(ctx, 0.7, 0.25, 900, 0.05);
    this.tone(ctx, { freq: 90, slideTo: 40, type: 'square', dur: 0.8, gain: 0.12, delay: 0.1 });
  }

  private fanfare(ctx: AudioContext, win: boolean): void {
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262, 196];
    notes.forEach((f, i) => {
      this.tone(ctx, { freq: f, type: 'triangle', dur: 0.45, gain: 0.25, delay: i * 0.16 });
    });
    if (win) this.noise(ctx, 0.5, 0.15, 3000, 0.5);
  }

  private click(ctx: AudioContext): void {
    this.tone(ctx, { freq: 440, type: 'square', dur: 0.06, gain: 0.12 });
  }

  private place(ctx: AudioContext): void {
    this.tone(ctx, { freq: 300, slideTo: 500, type: 'sine', dur: 0.12, gain: 0.18 });
  }

  // ---- Music -------------------------------------------------------------

  startMusic(): void {
    if (this.musicPlaying) return;
    const ctx = this.ensure();
    this.musicPlaying = true;
    this.musicOn = true;
    // Soft ambient pad: root + fifth + octave, slightly detuned.
    const freqs = [110, 164.81, 220, 329.63];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = f;
      // gentle slow LFO on gain for a breathing effect
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.07 + i * 0.02;
      lfoGain.gain.value = 0.04;
      lfo.connect(lfoGain);
      lfoGain.connect(g.gain);
      g.gain.value = 0.05;
      osc.connect(g);
      g.connect(this.musicGain!);
      osc.start();
      lfo.start();
      this.musicNodes.push(osc, lfo);
    });
    this.musicGain!.gain.setTargetAtTime(0.5, ctx.currentTime, 1.2);
  }

  stopMusic(): void {
    if (!this.ctx || !this.musicPlaying) return;
    this.musicOn = false;
    this.musicPlaying = false;
    this.musicGain!.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    const nodes = this.musicNodes;
    this.musicNodes = [];
    setTimeout(() => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
    }, 800);
  }

  toggleMusic(): boolean {
    if (this.musicPlaying) this.stopMusic();
    else this.startMusic();
    return this.musicOn;
  }

  toggleSfx(): boolean {
    this.sfxOn = !this.sfxOn;
    return this.sfxOn;
  }
}

export const sound = new SoundEngine();
