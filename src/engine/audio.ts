// Fully procedural audio: ambience beds (sea, wind, rain, crickets, gulls), tool SFX and a
// gentle generative score. No audio files are downloaded.
export class Sound {
  ctx!: AudioContext;
  master!: GainNode;
  sfxBus!: GainNode;
  ambBus!: GainNode;
  musBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private beds: Record<string, { gain: GainNode; target: number }> = {};
  private loops: Record<string, { gain: GainNode; on: boolean }> = {};
  private eng?: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode };
  started = false;
  musicOn = true;
  vol = { master: 0.8, music: 0.5, sfx: 0.9 };
  private nextNote = 0;
  private bar = 0;
  private gullT = 6;
  night = 0;
  sea = 0.5;

  start() {
    if (this.started) { this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.started = true;
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.vol.master;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.sfxBus = c.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
    this.ambBus = c.createGain(); this.ambBus.gain.value = 0.55; this.ambBus.connect(this.master);
    this.musBus = c.createGain(); this.musBus.gain.value = this.vol.music * 0.5; this.musBus.connect(this.master);
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.bed('sea', 'lowpass', 520, 0.6, 0.11);
    this.bed('wind', 'bandpass', 380, 0.5, 0.07);
    this.bed('rain', 'highpass', 2400, 0.4, 0);
    this.loop('paint', 'bandpass', 1400, 1.2);
    this.loop('wash', 'highpass', 1800, 0.5);
    this.loop('saw', 'bandpass', 900, 3);
    this.nextNote = c.currentTime + 1;
  }
  applyVolumes() {
    if (!this.started) return;
    this.master.gain.value = this.vol.master;
    this.sfxBus.gain.value = this.vol.sfx;
    this.musBus.gain.value = this.musicOn ? this.vol.music * 0.5 : 0;
  }
  private src() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.playbackRate.value = 0.8 + Math.random() * 0.4; return s; }
  private bed(name: string, type: BiquadFilterType, freq: number, q: number, lfo: number) {
    const s = this.src(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    s.connect(f).connect(g).connect(this.ambBus); s.start();
    if (lfo) { const o = this.ctx.createOscillator(), og = this.ctx.createGain(); o.frequency.value = lfo; og.gain.value = freq * 0.35; o.connect(og).connect(f.frequency); o.start(); }
    this.beds[name] = { gain: g, target: 0 };
  }
  private loop(name: string, type: BiquadFilterType, freq: number, q: number) {
    const s = this.src(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    s.connect(f).connect(g).connect(this.sfxBus); s.start();
    this.loops[name] = { gain: g, on: false };
  }
  setLoop(name: string, on: boolean, vol = 0.25) {
    const l = this.loops[name];
    if (!l || l.on === on) return;
    l.on = on;
    l.gain.gain.setTargetAtTime(on ? vol : 0, this.ctx.currentTime, 0.04);
  }
  setBed(name: string, v: number) { if (this.beds[name]) this.beds[name].target = v; }

  tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.15, slide = 0, delay = 0, bus?: GainNode) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(bus ?? this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur: number, vol = 0.2, type: BiquadFilterType = 'lowpass', freq = 1200, q = 1, delay = 0) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.loopStart = Math.random(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(this.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  sfx(name: string) {
    if (!this.started) return;
    switch (name) {
      case 'ui': this.tone(660, 0.05, 'square', 0.06); break;
      case 'select': this.tone(520, 0.06, 'square', 0.07); this.tone(780, 0.08, 'square', 0.07, 0, 0.05); break;
      case 'back': this.tone(420, 0.07, 'square', 0.06, -120); break;
      case 'talk': this.tone(300 + Math.random() * 160, 0.035, 'square', 0.035); break;
      case 'error': this.tone(160, 0.14, 'sawtooth', 0.09, -40); break;
      case 'coin': this.tone(988, 0.07, 'square', 0.08); this.tone(1319, 0.22, 'square', 0.08, 0, 0.07); break;
      case 'quest': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.14, 0, i * 0.11)); break;
      case 'level': [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'square', 0.08, 0, i * 0.08)); break;
      case 'hammer': this.noise(0.07, 0.4, 'bandpass', 1900, 2); this.tone(210, 0.09, 'triangle', 0.25, -90); break;
      case 'nail': this.noise(0.05, 0.3, 'highpass', 3200, 1); this.tone(1200, 0.04, 'square', 0.08, -500); break;
      case 'nailgun': this.noise(0.09, 0.5, 'bandpass', 1300, 1); this.tone(140, 0.07, 'square', 0.22, -60); this.noise(0.18, 0.12, 'highpass', 5000, 1, 0.04); break;
      case 'place': this.tone(150, 0.1, 'triangle', 0.3, -50); this.noise(0.08, 0.2, 'lowpass', 900); break;
      case 'smash': this.noise(0.35, 0.6, 'lowpass', 700, 0.7); this.tone(90, 0.25, 'sawtooth', 0.3, -50); this.noise(0.5, 0.2, 'bandpass', 2600, 2, 0.05); break;
      case 'thud': this.tone(100, 0.14, 'triangle', 0.4, -50); this.noise(0.1, 0.3, 'lowpass', 500); break;
      case 'step': this.noise(0.05, 0.05, 'lowpass', 700 + Math.random() * 500, 1); break;
      case 'door': this.tone(180, 0.1, 'triangle', 0.2, -40); this.tone(120, 0.14, 'triangle', 0.2, -30, 0.12); break;
      case 'engine': this.noise(0.6, 0.25, 'lowpass', 300, 2); this.tone(70, 0.5, 'sawtooth', 0.2, 50); break;
      case 'splash': this.noise(0.4, 0.3, 'bandpass', 1500, 0.8); break;
      case 'cut': this.noise(0.25, 0.4, 'bandpass', 1100, 4); this.tone(260, 0.15, 'triangle', 0.2, -120, 0.2); break;
      case 'sparkle': [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.07, 0, i * 0.06)); break;
      case 'horn': this.tone(196, 1.6, 'sawtooth', 0.12, -6); this.tone(147, 1.6, 'sawtooth', 0.1, -4); break;
      case 'firework': this.noise(0.5, 0.35, 'lowpass', 500, 0.5); this.noise(0.9, 0.15, 'highpass', 3000, 0.6, 0.1); break;
      case 'page': this.noise(0.12, 0.15, 'highpass', 2600, 0.6); break;
    }
  }

  engine(on: boolean, speed = 0) {
    if (!this.started) return;
    if (on && !this.eng) {
      const c = this.ctx, o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 320; g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g).connect(this.sfxBus); o1.start(); o2.start();
      this.eng = { o1, o2, g, f };
    }
    if (!this.eng) return;
    const t = this.ctx.currentTime, base = 42 + Math.abs(speed) * 5.5;
    this.eng.o1.frequency.setTargetAtTime(base, t, 0.08);
    this.eng.o2.frequency.setTargetAtTime(base * 0.5 + 1.5, t, 0.08);
    this.eng.f.frequency.setTargetAtTime(260 + Math.abs(speed) * 40, t, 0.1);
    this.eng.g.gain.setTargetAtTime(on ? 0.085 : 0, t, 0.15);
  }

  // D major-ish palette; evening drifts to B minor.
  private chords = [[146.8, 220, 293.7, 370], [123.5, 185, 246.9, 293.7], [98, 196, 246.9, 293.7], [110, 220, 277.2, 329.6]];
  private scale = [293.7, 329.6, 370, 440, 493.9, 587.3, 659.3, 740];

  update(dt: number) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    for (const k in this.beds) { const b = this.beds[k]; b.gain.gain.setTargetAtTime(b.target, t, 0.8); }
    // gulls by day, crickets by night
    this.gullT -= dt;
    if (this.gullT <= 0) {
      this.gullT = 5 + Math.random() * 14;
      if (this.night < 0.5 && this.sea > 0.15) {
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this.tone(1500 + Math.random() * 500, 0.22, 'sawtooth', 0.02 * this.sea * 2, -600, i * 0.28, this.ambBus);
      } else if (this.night >= 0.5) {
        for (let i = 0; i < 10; i++) this.tone(4200, 0.03, 'sine', 0.025, 0, i * 0.07, this.ambBus);
        this.gullT = 1.2 + Math.random() * 2.5;
      }
    }
    // music: slow pad + sparse plucks
    if (this.musicOn && t > this.nextNote - 0.2) {
      const ch = this.chords[this.bar % 4];
      const dur = 4.8;
      ch.forEach((f, i) => {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain(), fl = this.ctx.createBiquadFilter();
        o.type = i === 0 ? 'triangle' : 'sine'; o.frequency.value = f * (this.night > 0.5 ? 0.5 : 1); o.detune.value = (Math.random() - 0.5) * 10;
        fl.type = 'lowpass'; fl.frequency.value = 900;
        g.gain.setValueAtTime(0, this.nextNote); g.gain.linearRampToValueAtTime(0.05, this.nextNote + 1.6); g.gain.linearRampToValueAtTime(0, this.nextNote + dur + 0.6);
        o.connect(fl).connect(g).connect(this.musBus); o.start(this.nextNote); o.stop(this.nextNote + dur + 0.7);
      });
      const beats = 8;
      for (let i = 0; i < beats; i++) {
        if (Math.random() < 0.48) {
          const f = this.scale[Math.floor(Math.random() * this.scale.length)] * (Math.random() < 0.25 ? 2 : 1);
          this.tone(f, 1.1, 'triangle', 0.06, 0, this.nextNote - t + (i * dur) / beats, this.musBus);
        }
      }
      this.nextNote += dur;
      this.bar++;
    }
  }
}
