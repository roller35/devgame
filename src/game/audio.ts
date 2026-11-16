import { MotorcycleSpecs } from './types';

export class MotorcycleAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private started = false;
  private muted = false;
  private lastGear = 1;

  public unlock(): void {
    if (this.started) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.28;
      this.masterGain.connect(this.ctx.destination);

      this.exhaustFilter = this.ctx.createBiquadFilter();
      this.exhaustFilter.type = 'lowpass';
      this.exhaustFilter.frequency.value = 320;
      this.exhaustFilter.Q.value = 2.4;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;

      this.oscPrimary = this.ctx.createOscillator();
      this.oscPrimary.type = 'sawtooth';
      this.oscPrimary.frequency.value = 42;

      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = 'triangle';
      this.oscSub.frequency.value = 21;

      this.oscPrimary.connect(this.exhaustFilter);
      this.oscSub.connect(this.exhaustFilter);
      this.exhaustFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.oscPrimary.start();
      this.oscSub.start();
      this.started = true;
    } catch {
      // AudioContext blocked or unsupported
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.28, this.ctx.currentTime, 0.05);
    }
  }

  public updateEngine(
    rpm: number,
    specs: MotorcycleSpecs,
    throttle: number,
    gear: number,
    active: boolean
  ): void {
    if (!this.started || !this.ctx || !this.oscPrimary || !this.oscSub || !this.exhaustFilter || !this.engineGain) {
      return;
    }
    const now = this.ctx.currentTime;

    if (!active) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // Distinct exhaust pitch signature per motorcycle class
    let baseFreqScale = 1.0;
    let subRatio = 0.5;
    let wave: OscillatorType = 'sawtooth';
    if (specs.exhaustTone === 'thumper') {
      baseFreqScale = 0.78;
      subRatio = 0.5;
      wave = 'sawtooth';
    } else if (specs.exhaustTone === 'cruiser') {
      baseFreqScale = 0.68;
      subRatio = 0.5;
      wave = 'sawtooth';
    } else if (specs.exhaustTone === 'inline4') {
      baseFreqScale = 1.45;
      subRatio = 0.75;
      wave = 'sawtooth';
    } else if (specs.exhaustTone === 'dirt_2t') {
      baseFreqScale = 1.2;
      subRatio = 0.5;
      wave = 'square';
    } else if (specs.exhaustTone === 'scooter') {
      baseFreqScale = 1.1;
      subRatio = 1.0;
      wave = 'triangle';
    }

    if (this.oscPrimary.type !== wave) {
      this.oscPrimary.type = wave;
    }

    const rpmNorm = Math.max(0, Math.min(1, (rpm - specs.idleRpm) / Math.max(1000, specs.maxRpm - specs.idleRpm)));
    const freq = (28 + rpmNorm * 145) * baseFreqScale;

    this.oscPrimary.frequency.setTargetAtTime(freq, now, 0.03);
    this.oscSub.frequency.setTargetAtTime(freq * subRatio, now, 0.03);
    this.exhaustFilter.frequency.setTargetAtTime(220 + rpmNorm * 1100 + throttle * 520, now, 0.04);
    this.engineGain.gain.setTargetAtTime(0.16 + throttle * 0.22 + rpmNorm * 0.14, now, 0.04);

    if (gear !== this.lastGear) {
      this.lastGear = gear;
      this.playGearShift();
    }
  }

  public playGearShift(): void {
    if (!this.started || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.07);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playHorn(): void {
    this.unlock();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const o1 = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = 392;
    o2.frequency.value = 494;
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    o1.connect(g);
    o2.connect(g);
    g.connect(this.masterGain);
    o1.start(now);
    o2.start(now);
    o1.stop(now + 0.3);
    o2.stop(now + 0.3);
  }

  public playCheckpointChime(completed = false): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = completed ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      const t = now + idx * 0.07;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      o.connect(g);
      g.connect(this.masterGain);
      o.start(t);
      o.stop(t + 0.26);
    });
  }

  public playLandingThud(intensity: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, now);
    o.frequency.exponentialRampToValueAtTime(36, now + 0.14);
    g.gain.setValueAtTime(Math.min(0.4, intensity * 0.35), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.connect(g);
    g.connect(this.masterGain);
    o.start(now);
    o.stop(now + 0.18);
  }

  public dispose(): void {
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.started = false;
  }
}
