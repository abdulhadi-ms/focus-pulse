/**
 * Procedural Web Audio API soundscape & notification synthesizer.
 * Generates ambient focus audio in real time without any external media files.
 */
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.activeNodes = [];
    this.currentPreset = "off";
    this.volume = 0.35;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setVolume(value) {
    this.volume = Math.min(Math.max(Number(value) || 0, 0), 1);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  stopAmbient() {
    for (const node of this.activeNodes) {
      try {
        if (typeof node.stop === "function") node.stop();
        if (typeof node.disconnect === "function") node.disconnect();
      } catch {
        // Ignore already-stopped audio nodes
      }
    }
    this.activeNodes = [];
    this.currentPreset = "off";
  }

  setAmbient(preset) {
    this.stopAmbient();
    if (!preset || preset === "off") return;

    const ctx = this._ensureContext();
    if (!ctx) return;

    this.currentPreset = preset;

    if (preset === "brown") {
      this._startBrownNoise(ctx);
    } else if (preset === "rain") {
      this._startSoftRain(ctx);
    } else if (preset === "hum") {
      this._startFocusHum(ctx);
    }
  }

  _createNoiseBuffer(ctx, type) {
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === "brown") {
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i += 1) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.2;
      }
    } else {
      // Pink-ish noise for rain
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i += 1) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  _startBrownNoise(ctx) {
    const source = ctx.createBufferSource();
    source.buffer = this._createNoiseBuffer(ctx, "brown");
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 380;

    const gain = ctx.createGain();
    gain.gain.value = 0.65;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();

    this.activeNodes.push(source, filter, gain);
  }

  _startSoftRain(ctx) {
    const source = ctx.createBufferSource();
    source.buffer = this._createNoiseBuffer(ctx, "pink");
    source.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 1100;
    bandpass.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.5;

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.masterGain);
    source.start();

    this.activeNodes.push(source, bandpass, gain);
  }

  _startFocusHum(ctx) {
    const oscLeft = ctx.createOscillator();
    const oscRight = ctx.createOscillator();
    oscLeft.type = "sine";
    oscRight.type = "sine";
    oscLeft.frequency.value = 174;
    oscRight.frequency.value = 178; // 4 Hz gentle theta/alpha beat

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 260;

    const gain = ctx.createGain();
    gain.gain.value = 0.18;

    oscLeft.connect(filter);
    oscRight.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    oscLeft.start();
    oscRight.start();

    this.activeNodes.push(oscLeft, oscRight, filter, gain);
  }

  playChime() {
    const ctx = this._ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 triad

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);

      gain.gain.setValueAtTime(0.001, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.18, now + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.95);
    });
  }
}
