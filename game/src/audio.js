// Synthesized sound: every effect and the ambient pad are generated with
// WebAudio oscillators and filtered noise. No audio files, no network.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambient = null;
    this.beamOsc = null;
    this.beamGain = null;
  }

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
      } catch (err) {
        return false;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
    return this.muted;
  }

  tone({ freq = 440, to = null, dur = 0.12, type = 'sine', vol = 0.2, delay = 0 }) {
    if (!this.ensure() || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (err) { /* audio is decorative; never break the game */ }
  }

  noise({ dur = 0.25, vol = 0.25, freq = 900, q = 0.8, delay = 0 }) {
    if (!this.ensure() || this.muted) return;
    try {
      const t0 = this.ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter).connect(g).connect(this.master);
      src.start(t0);
    } catch (err) { /* ignore */ }
  }

  // --- Game effects, each a tiny signature ---

  uiClick() { this.tone({ freq: 660, to: 880, dur: 0.07, type: 'triangle', vol: 0.14 }); }
  beamTick() { this.tone({ freq: 1320, to: 1180, dur: 0.05, type: 'sine', vol: 0.05 }); }
  prismPing(chain) {
    const base = 720 + Math.min(chain, 6) * 110;
    this.tone({ freq: base, to: base * 1.5, dur: 0.16, type: 'sine', vol: 0.16 });
    this.tone({ freq: base * 2, dur: 0.1, type: 'sine', vol: 0.06, delay: 0.02 });
  }
  enemyDie() {
    this.noise({ dur: 0.22, vol: 0.22, freq: 700 });
    this.tone({ freq: 320, to: 90, dur: 0.2, type: 'triangle', vol: 0.16 });
  }
  playerHit() {
    this.noise({ dur: 0.3, vol: 0.3, freq: 300, q: 0.5 });
    this.tone({ freq: 180, to: 60, dur: 0.3, type: 'sawtooth', vol: 0.18 });
  }
  shard() { this.tone({ freq: 1046, to: 1568, dur: 0.09, type: 'sine', vol: 0.12 }); }
  dash() { this.noise({ dur: 0.16, vol: 0.16, freq: 1600, q: 0.6 }); }
  relic() {
    this.tone({ freq: 523, dur: 0.14, type: 'triangle', vol: 0.16 });
    this.tone({ freq: 659, dur: 0.14, type: 'triangle', vol: 0.16, delay: 0.09 });
    this.tone({ freq: 784, dur: 0.22, type: 'triangle', vol: 0.18, delay: 0.18 });
  }
  waveClear() {
    this.tone({ freq: 392, dur: 0.12, type: 'triangle', vol: 0.15 });
    this.tone({ freq: 523, dur: 0.12, type: 'triangle', vol: 0.15, delay: 0.1 });
    this.tone({ freq: 659, dur: 0.2, type: 'triangle', vol: 0.15, delay: 0.2 });
  }
  bossRoar() {
    this.tone({ freq: 90, to: 45, dur: 0.9, type: 'sawtooth', vol: 0.22 });
    this.noise({ dur: 0.8, vol: 0.18, freq: 220, q: 0.4 });
  }
  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.3, type: 'triangle', vol: 0.16, delay: i * 0.12 }));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.34, type: 'sine', vol: 0.16, delay: i * 0.16 }));
  }

  // Beam hum while the starlance is firing.
  setBeamHum(on) {
    if (!this.ensure()) return;
    try {
      if (on && !this.beamOsc) {
        this.beamOsc = this.ctx.createOscillator();
        this.beamOsc.type = 'sawtooth';
        this.beamOsc.frequency.value = 68;
        this.beamGain = this.ctx.createGain();
        this.beamGain.gain.value = 0.0;
        this.beamGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.08);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.beamOsc.connect(filter).connect(this.beamGain).connect(this.master);
        this.beamOsc.start();
      } else if (!on && this.beamOsc) {
        const osc = this.beamOsc;
        const g = this.beamGain;
        g.gain.linearRampToValueAtTime(0.0, this.ctx.currentTime + 0.08);
        setTimeout(() => { try { osc.stop(); } catch (err) {} }, 120);
        this.beamOsc = null;
        this.beamGain = null;
      }
    } catch (err) { /* ignore */ }
  }

  // Slow two-oscillator pad + a breathing lowpass: the night sea's voice.
  startAmbient() {
    if (!this.ensure() || this.ambient) return;
    try {
      const g = this.ctx.createGain();
      g.gain.value = 0.0;
      g.gain.linearRampToValueAtTime(0.055, this.ctx.currentTime + 2.5);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const o1 = this.ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.value = 110;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = 165.2;
      const o3 = this.ctx.createOscillator();
      o3.type = 'triangle';
      o3.frequency.value = 55;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain).connect(filter.frequency);
      o1.connect(filter);
      o2.connect(filter);
      o3.connect(filter);
      filter.connect(g).connect(this.master);
      o1.start(); o2.start(); o3.start(); lfo.start();
      this.ambient = { o1, o2, o3, lfo, g };
    } catch (err) { /* ignore */ }
  }
}
