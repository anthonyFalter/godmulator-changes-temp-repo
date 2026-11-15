class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.08,
    pitchSlide = 1.0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const jitter = 1 + (Math.random() - 0.5) * 0.12;
    osc.type = type;
    osc.frequency.setValueAtTime(freq * jitter, now);
    if (pitchSlide !== 1.0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * pitchSlide), now + duration);
    }

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playClick(): void {
    this.playTone(460, 0.06, 'triangle', 0.05, 1.15);
  }

  public playBuild(): void {
    this.playTone(220, 0.12, 'square', 0.06, 1.35);
    setTimeout(() => this.playTone(330, 0.15, 'triangle', 0.07, 1.2), 70);
  }

  public playSculpt(): void {
    this.playTone(150, 0.09, 'sine', 0.07, 1.18);
  }

  public playSpawn(): void {
    this.playTone(380, 0.11, 'sine', 0.06, 1.4);
  }

  public playBlessing(): void {
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.25, 'sine', 0.06, 1.04), idx * 55);
    });
  }

  public playCurse(): void {
    this.playTone(190, 0.35, 'sawtooth', 0.06, 0.55);
  }

  public playMeteorIncoming(): void {
    // High-altitude whistle descending into deep atmospheric re-entry rumble over 1.1s
    this.playTone(620, 1.05, 'sine', 0.055, 0.22);
    this.playTone(180, 1.1, 'sawtooth', 0.045, 0.45);
  }

  public playHeavyImpact(): void {
    // Earth-shattering detonation + sub-bass shockwave rumble
    this.playTone(110, 0.65, 'sawtooth', 0.14, 0.25);
    setTimeout(() => this.playTone(68, 0.85, 'square', 0.12, 0.3), 35);
    setTimeout(() => this.playTone(48, 1.05, 'triangle', 0.14, 0.45), 90);
  }

  public playEarthquake(): void {
    // Deep sustained tectonic rumble + grinding seismic fault cracks
    this.playTone(54, 1.6, 'sawtooth', 0.14, 0.68);
    setTimeout(() => this.playTone(42, 1.5, 'triangle', 0.16, 0.85), 60);
    setTimeout(() => this.playTone(95, 0.35, 'square', 0.08, 0.32), 180);
    setTimeout(() => this.playTone(60, 1.2, 'sawtooth', 0.11, 0.72), 460);
    setTimeout(() => this.playTone(84, 0.4, 'square', 0.07, 0.38), 720);
  }

  public playEpochAscend(): void {
    const chord = [261.63, 329.63, 392.0, 523.25, 659.25];
    chord.forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.42, 'triangle', 0.07, 1.02), idx * 75);
    });
  }

  public playBombFuse(): void {
    this.playTone(540, 0.14, 'triangle', 0.05, 0.65);
  }

  public playMegaExplosion(): void {
    this.playTone(75, 1.4, 'sawtooth', 0.17, 0.22);
    setTimeout(() => this.playTone(46, 1.6, 'square', 0.15, 0.28), 55);
    setTimeout(() => this.playTone(36, 1.85, 'triangle', 0.16, 0.35), 140);
  }

  public playFreeze(): void {
    [987.77, 1318.51, 1760].forEach((n, idx) => {
      setTimeout(() => this.playTone(n, 0.22, 'sine', 0.05, 0.92), idx * 45);
    });
  }

  public playHeatWave(): void {
    this.playTone(210, 0.45, 'sawtooth', 0.07, 1.35);
    setTimeout(() => this.playTone(310, 0.38, 'triangle', 0.06, 0.72), 60);
  }

  public playTornado(): void {
    this.playTone(135, 0.7, 'sawtooth', 0.08, 1.65);
    setTimeout(() => this.playTone(240, 0.6, 'triangle', 0.07, 0.65), 110);
  }

  public playTsunami(): void {
    this.playTone(92, 0.95, 'triangle', 0.13, 0.48);
    setTimeout(() => this.playTone(148, 0.75, 'sine', 0.09, 0.62), 90);
  }

  public playGrab(): void {
    this.playTone(420, 0.1, 'sine', 0.06, 1.45);
  }

  public playThrow(): void {
    this.playTone(520, 0.14, 'triangle', 0.07, 0.52);
  }
}

export const soundEngine = new SoundEngine();
