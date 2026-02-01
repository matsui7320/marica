export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  // Engine (multi-layer)
  private engineNodes: {
    osc1: OscillatorNode;   // fundamental sawtooth
    osc2: OscillatorNode;   // 2nd harmonic
    sub: OscillatorNode;    // sub-bass sine
    lfo: OscillatorNode;    // vibrato
    lfoGain: GainNode;      // vibrato depth
    filter: BiquadFilterNode;
    gain: GainNode;
    noise: AudioBufferSourceNode; // exhaust
    noiseGain: GainNode;
    noiseFilter: BiquadFilterNode;
  } | null = null;
  private driftNoise: AudioBufferSourceNode | null = null;
  private driftGain: GainNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;
  private started = false;
  private muted = false;

  // BGM
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private bgmCache = new Map<string, AudioBuffer>();
  private bgmCurrentUrl = '';
  private bgmVolume = 0.7;

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.3;
    this.masterGain.connect(this.ctx.destination);
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.started = true;
  }

  get isReady(): boolean {
    return this.started && this.ctx !== null;
  }

  private ensureCtx(): AudioContext | null {
    if (!this.started || !this.ctx || this.muted) return null;
    return this.ctx;
  }

  startEngine(): void {
    const ctx = this.ensureCtx();
    if (!ctx || this.engineNodes) return;

    // ── Fundamental: sawtooth (main engine tone) ──
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 45;

    // ── 2nd harmonic: sawtooth at 2× freq (adds bite/richness) ──
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 90;

    // ── Sub-bass: sine at 0.5× freq (deep rumble) ──
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 22;

    // ── LFO: modulates fundamental frequency (engine vibration) ──
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 2; // ±2 Hz vibrato
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    // ── Mixer: blend oscillators ──
    const osc1Gain = ctx.createGain();
    osc1Gain.gain.value = 0.35;
    const osc2Gain = ctx.createGain();
    osc2Gain.gain.value = 0.15;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.25;

    // ── Dynamic low-pass filter (brighter at higher RPM) ──
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 2;

    // ── Exhaust noise (filtered noise, adds texture) ──
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 300;
    noiseFilter.Q.value = 0.8;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.04;

    // ── Master engine gain ──
    const gain = ctx.createGain();
    gain.gain.value = 0.14;

    // Wiring: oscillators → individual gains → filter → master gain
    osc1.connect(osc1Gain);
    osc2.connect(osc2Gain);
    sub.connect(subGain);
    osc1Gain.connect(filter);
    osc2Gain.connect(filter);
    subGain.connect(filter);
    filter.connect(gain);

    // Noise chain
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(gain);

    gain.connect(this.masterGain);

    osc1.start();
    osc2.start();
    sub.start();
    lfo.start();
    noise.start();

    this.engineNodes = { osc1, osc2, sub, lfo, lfoGain, filter, gain, noise, noiseGain, noiseFilter };
  }

  updateEngine(speedRatio: number, shrunk = false): void {
    const e = this.engineNodes;
    if (!e) return;

    // When shrunk by lightning, pitch up ~1.6× for a comical high-rev whine
    const pitchMul = shrunk ? 1.6 : 1.0;
    const baseFreq = (45 + speedRatio * 165) * pitchMul;
    e.osc1.frequency.value = baseFreq;
    e.osc2.frequency.value = baseFreq * 2;
    e.sub.frequency.value = baseFreq * 0.5;

    // LFO speed increases with RPM (idle wobble → high-rev buzz)
    e.lfo.frequency.value = (5 + speedRatio * 15) * pitchMul;
    e.lfoGain.gain.value = 2 + speedRatio * 4;

    // Filter opens up at higher speed; shrunk = brighter/thinner
    const filterBase = shrunk ? 1200 : 600;
    e.filter.frequency.value = filterBase + speedRatio * 1800;

    // Exhaust noise increases with speed
    e.noiseFilter.frequency.value = (shrunk ? 600 : 300) + speedRatio * 600;
    e.noiseGain.gain.value = 0.03 + speedRatio * 0.08;

    // Overall volume (slightly quieter when shrunk)
    e.gain.gain.value = (shrunk ? 0.10 : 0.14) + speedRatio * 0.20;
  }

  stopEngine(): void {
    if (this.engineNodes) {
      const e = this.engineNodes;
      e.osc1.stop(); e.osc1.disconnect();
      e.osc2.stop(); e.osc2.disconnect();
      e.sub.stop(); e.sub.disconnect();
      e.lfo.stop(); e.lfo.disconnect();
      e.noise.stop(); e.noise.disconnect();
      e.gain.disconnect();
      this.engineNodes = null;
    }
  }

  startDrift(): void {
    const ctx = this.ensureCtx();
    if (!ctx || this.driftNoise) return;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.driftNoise = ctx.createBufferSource();
    this.driftNoise.buffer = buffer;
    this.driftNoise.loop = true;

    this.driftFilter = ctx.createBiquadFilter();
    this.driftFilter.type = 'bandpass';
    this.driftFilter.frequency.value = 2000;
    this.driftFilter.Q.value = 2;

    this.driftGain = ctx.createGain();
    this.driftGain.gain.value = 0.1;

    this.driftNoise.connect(this.driftFilter);
    this.driftFilter.connect(this.driftGain);
    this.driftGain.connect(this.masterGain);
    this.driftNoise.start();
  }

  updateDrift(intensity: number): void {
    if (!this.driftFilter || !this.driftGain) return;
    this.driftFilter.frequency.value = 1500 + intensity * 3000;
    this.driftGain.gain.value = 0.05 + intensity * 0.15;
  }

  stopDrift(): void {
    if (this.driftNoise) {
      this.driftNoise.stop();
      this.driftNoise.disconnect();
      this.driftNoise = null;
      this.driftGain = null;
      this.driftFilter = null;
    }
  }

  playBoost(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.3);

    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 300;
    filter.frequency.exponentialRampToValueAtTime(2000, ctx.currentTime + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  playItemGet(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.2);
    });
  }

  playHit(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // ── Layer 1: sharp impact crack (bright, punchy) ──
    {
      const len = ctx.sampleRate * 0.12;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.015));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.45, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.masterGain);
      src.start(now);
    }

    // ── Layer 2: heavy bass thud (sub-frequency punch) ──
    {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.4);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.4);
    }

    // ── Layer 3: crunch / shatter (mid-range filtered noise, debris feel) ──
    {
      const len = ctx.sampleRate * 0.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = Math.exp(-i / (ctx.sampleRate * 0.06)) * 0.7
                  + Math.exp(-i / (ctx.sampleRate * 0.25)) * 0.3;
        // Gritty noise with some tonal character
        d[i] = (Math.random() * 2 - 1) * env;
        if (i % 4 < 2) d[i] *= 0.6; // bit-crush style grittiness
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200;
      bp.Q.value = 0.8;
      const g = ctx.createGain();
      g.gain.value = 0.35;
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(now);
    }

    // ── Layer 4: metallic ring (short pitched impact tone) ──
    {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.25);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
    }

    // ── Layer 5: delayed scatter (secondary debris bounce) ──
    {
      const len = ctx.sampleRate * 0.3;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.05));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200;
      bp.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.setValueAtTime(0.2, now + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(now + 0.1);
    }
  }

  playCountdown(final: boolean): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = final ? 880 : 440;

    const gain = ctx.createGain();
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (final ? 0.6 : 0.3));

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(ctx.currentTime + (final ? 0.6 : 0.3));
  }

  playLightning(): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // ── Layer 1: sharp initial crack (bright, short) ──
    {
      const len = ctx.sampleRate * 0.15;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      src.connect(hp);
      hp.connect(g);
      g.connect(this.masterGain);
      src.start(now);
    }

    // ── Layer 2: main crackle (mid-range noise, longer decay) ──
    {
      const len = ctx.sampleRate * 1.2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        // Double-decay envelope: fast attack + slow roll-off
        const env = Math.exp(-i / (ctx.sampleRate * 0.08)) * 0.6
                  + Math.exp(-i / (ctx.sampleRate * 0.4)) * 0.4;
        d[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.6;
      const g = ctx.createGain();
      g.gain.value = 0.45;
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(now);
    }

    // ── Layer 3: deep rumbling thunder (low freq, slow build + decay) ──
    {
      const len = ctx.sampleRate * 2.0;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / ctx.sampleRate;
        // Slow attack (peaks ~0.15s), long decay
        const env = Math.min(t / 0.15, 1) * Math.exp(-(t - 0.15) / 0.7);
        d[i] = (Math.random() * 2 - 1) * env;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 400;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(lp);
      lp.connect(g);
      g.connect(this.masterGain);
      src.start(now);
    }

    // ── Layer 4: re-strike crackle (delayed secondary crack) ──
    {
      const len = ctx.sampleRate * 0.4;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.06));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500;
      bp.Q.value = 0.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, now);
      g.gain.setValueAtTime(0.35, now + 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.masterGain);
      src.start(now + 0.18);
    }
  }

  /** Celebratory finish fanfare. Returns duration in seconds. */
  playFinish(): number {
    const ctx = this.ensureCtx();
    if (!ctx) return 0;
    const now = ctx.currentTime;
    const duration = 4.5;
    const mg = this.masterGain!;

    // ── Cymbal crash + ride shimmer ──
    {
      const len = ctx.sampleRate * 3.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.9));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 5000;
      const bp = ctx.createBiquadFilter();
      bp.type = 'peaking';
      bp.frequency.value = 8000;
      bp.gain.value = 6;
      bp.Q.value = 1;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now + 0.48);
      g.gain.linearRampToValueAtTime(0.15, now + 0.52);
      g.gain.setValueAtTime(0.12, now + 1.0);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
      src.connect(hp);
      hp.connect(bp);
      bp.connect(g);
      g.connect(mg);
      src.start(now + 0.48);
    }

    return duration;
  }

  /** Convert a track name like "Frozen Peaks" to "/bgm/frozen-peaks.mp3" */
  static trackBgmUrl(trackName: string): string {
    const slug = trackName.toLowerCase().replace(/\s+/g, '-');
    return `/bgm/${slug}.mp3`;
  }

  /**
   * Play a BGM file by URL. Loops indefinitely.
   * If the file doesn't exist (404), silently does nothing.
   * If already playing the same URL, does nothing.
   */
  async playBGM(url: string, fadeIn = 0.8): Promise<void> {
    if (url === this.bgmCurrentUrl && this.bgmSource) return;
    this.stopBGM(0.3);

    const ctx = this.ensureCtx();
    if (!ctx) return;

    let buffer = this.bgmCache.get(url);
    if (!buffer) {
      try {
        const res = await fetch(url);
        if (!res.ok) return; // file doesn't exist — skip silently
        const arrayBuf = await res.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuf);
        this.bgmCache.set(url, buffer);
      } catch {
        return; // decode error or network error — skip
      }
    }

    this.bgmCurrentUrl = url;
    this.bgmSource = ctx.createBufferSource();
    this.bgmSource.buffer = buffer;
    this.bgmSource.loop = true;

    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0, ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(
      this.muted ? 0 : this.bgmVolume,
      ctx.currentTime + fadeIn,
    );

    this.bgmSource.connect(this.bgmGain);
    this.bgmGain.connect(this.masterGain);
    this.bgmSource.start();
  }

  stopBGM(fadeOut = 0.5): void {
    if (!this.bgmSource || !this.bgmGain || !this.ctx) {
      this.bgmSource = null;
      this.bgmGain = null;
      this.bgmCurrentUrl = '';
      return;
    }

    const gain = this.bgmGain;
    const source = this.bgmSource;
    const now = this.ctx.currentTime;

    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeOut);

    setTimeout(() => {
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
      gain.disconnect();
    }, fadeOut * 1000 + 50);

    this.bgmSource = null;
    this.bgmGain = null;
    this.bgmCurrentUrl = '';
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain) {
      this.masterGain.gain.value = m ? 0 : 0.3;
    }
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(
        m ? 0 : this.bgmVolume,
        this.ctx.currentTime,
      );
    }
  }

  /**
   * Procedural cow moo — rich, layered vocalization.
   * @param volume 0-1 for distance-based attenuation
   */
  playMoo(volume = 0.5): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Randomise pitch for variety — each cow sounds slightly different
    const basePitch = 180 + Math.random() * 50; // 180-230 Hz fundamental
    const duration = 1.2 + Math.random() * 0.8; // 1.2-2.0 seconds
    const vol = volume * 0.55;

    // ── Layer 1: Fundamental — the core "moo" tone ──
    {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      // Pitch contour: rise → sustain → fall (characteristic moo shape)
      osc.frequency.setValueAtTime(basePitch * 0.85, now);
      osc.frequency.linearRampToValueAtTime(basePitch, now + 0.15);
      osc.frequency.setValueAtTime(basePitch, now + duration * 0.6);
      osc.frequency.linearRampToValueAtTime(basePitch * 0.75, now + duration);

      // Vibrato LFO
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5 + Math.random() * 2; // 5-7 Hz
      const vibratoGain = ctx.createGain();
      vibratoGain.gain.value = 3 + Math.random() * 2; // ±3-5 Hz wobble
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.start(now + 0.15);
      vibrato.stop(now + duration);

      // Formant filter — vowel-like resonance
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(500, now);
      formant.frequency.linearRampToValueAtTime(600, now + 0.2);
      formant.frequency.linearRampToValueAtTime(400, now + duration);
      formant.Q.value = 3;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.08);
      gain.gain.setValueAtTime(vol, now + duration * 0.5);
      gain.gain.linearRampToValueAtTime(0.001, now + duration);

      osc.connect(formant);
      formant.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }

    // ── Layer 2: Second formant — nasal / "oo" quality ──
    {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(basePitch * 1.01, now);
      osc.frequency.linearRampToValueAtTime(basePitch * 1.01, now + duration * 0.6);
      osc.frequency.linearRampToValueAtTime(basePitch * 0.76, now + duration);

      const formant2 = ctx.createBiquadFilter();
      formant2.type = 'bandpass';
      formant2.frequency.setValueAtTime(900, now);
      formant2.frequency.linearRampToValueAtTime(700, now + duration);
      formant2.Q.value = 4;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * 0.4, now + 0.12);
      gain.gain.linearRampToValueAtTime(0.001, now + duration);

      osc.connect(formant2);
      formant2.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }

    // ── Layer 3: Sub-bass body rumble ──
    {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(basePitch * 0.5, now);
      osc.frequency.linearRampToValueAtTime(basePitch * 0.38, now + duration);

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 200;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * 0.5, now + 0.1);
      gain.gain.linearRampToValueAtTime(0.001, now + duration * 0.9);

      osc.connect(lp);
      lp.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    }

    // ── Layer 4: Breathy noise — air turbulence of vocal cords ──
    {
      const len = ctx.sampleRate * duration;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(basePitch * 3, now);
      bp.frequency.linearRampToValueAtTime(basePitch * 2, now + duration);
      bp.Q.value = 1.5;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol * 0.12, now + 0.1);
      gain.gain.setValueAtTime(vol * 0.12, now + duration * 0.4);
      gain.gain.linearRampToValueAtTime(0.001, now + duration);

      src.connect(bp);
      bp.connect(gain);
      gain.connect(this.masterGain!);
      src.start(now);
      src.stop(now + duration + 0.05);
    }
  }

  dispose(): void {
    this.stopBGM(0);
    this.stopEngine();
    this.stopDrift();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
