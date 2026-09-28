class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  constructor() {
    // Try to load user preference
    const saved = localStorage.getItem('contra_sound_enabled');
    if (saved !== null) {
      this.enabled = saved === 'true';
    }
  }

  public toggleMute(): boolean {
    this.enabled = !this.enabled;
    localStorage.setItem('contra_sound_enabled', String(this.enabled));
    if (this.enabled) {
      this.init();
      this.playTone(523.25, 0.1, 'sine', 0.1);
    }
    return this.enabled;
  }

  public init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private playTone(freq: number, duration: number, type: OscillatorType = 'square', gainVal: number = 0.15, freqEnd?: number) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (freqEnd !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), this.ctx.currentTime + duration);
      }

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  private playNoise(duration: number, gainVal: number = 0.2) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + duration);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
      noise.stop(this.ctx.currentTime + duration);
    } catch {}
  }

  // Player shoot sounds
  public timerTick() {
    this.playTone(520, 0.04, 'square', 0.06);
  }

  public shootNormal() {
    this.playTone(600, 0.08, 'square', 0.12, 120);
  }

  public shootMachineGun() {
    this.playTone(720, 0.06, 'sawtooth', 0.14, 180);
    this.playNoise(0.04, 0.15);
  }

  public shootSpread() {
    this.playTone(750, 0.1, 'square', 0.15, 200);
    setTimeout(() => this.playTone(550, 0.08, 'sawtooth', 0.1, 150), 20);
  }

  public shootLaser() {
    this.playTone(1200, 0.15, 'sawtooth', 0.16, 250);
  }

  public shootRocket() {
    this.playTone(280, 0.2, 'sawtooth', 0.22, 100);
    this.playNoise(0.18, 0.3);
  }

  public shootEnemy() {
    this.playTone(320, 0.12, 'sawtooth', 0.08, 90);
  }

  public jump() {
    this.playTone(220, 0.14, 'square', 0.12, 480);
  }

  public hit() {
    this.playNoise(0.12, 0.25);
    this.playTone(180, 0.1, 'sawtooth', 0.15, 80);
  }

  public explosion() {
    this.playNoise(0.35, 0.35);
    this.playTone(120, 0.3, 'sawtooth', 0.2, 30);
  }

  public supplyDrop() {
    this.playTone(800, 0.2, 'triangle', 0.15, 400);
  }

  public itemPickup() {
    // Upward arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 0.12, 'sine', 0.18);
      }, idx * 60);
    });
  }

  public shieldActivate() {
    this.playTone(200, 0.3, 'sine', 0.2, 800);
    setTimeout(() => this.playTone(600, 0.25, 'triangle', 0.18, 1200), 100);
  }

  public quizCorrect() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, 0.16, 'triangle', 0.2);
      }, idx * 70);
    });
  }

  public quizWrong() {
    this.playTone(140, 0.2, 'sawtooth', 0.22, 100);
    setTimeout(() => this.playTone(110, 0.3, 'sawtooth', 0.25, 80), 180);
  }

  public zombieGroan() {
    this.playTone(85, 0.28, 'sawtooth', 0.12, 60);
    this.playNoise(0.18, 0.08);
  }

  public zombieBite() {
    this.playNoise(0.12, 0.25);
    this.playTone(150, 0.1, 'square', 0.18, 80);
  }

  public zombieRoar() {
    this.playTone(95, 0.5, 'sawtooth', 0.25, 45);
    this.playNoise(0.35, 0.2);
  }

  public victory() {
    const melody = [
      { f: 523.25, d: 150 },
      { f: 659.25, d: 150 },
      { f: 783.99, d: 150 },
      { f: 1046.5, d: 350 },
      { f: 880.0, d: 200 },
      { f: 1046.5, d: 500 },
    ];
    let time = 0;
    melody.forEach((note) => {
      setTimeout(() => {
        this.playTone(note.f, note.d / 1000, 'square', 0.2);
      }, time);
      time += note.d + 30;
    });
  }

  public gameOver() {
    const melody = [
      { f: 440.0, d: 200 },
      { f: 415.3, d: 200 },
      { f: 392.0, d: 200 },
      { f: 349.23, d: 450 },
    ];
    let time = 0;
    melody.forEach((note) => {
      setTimeout(() => {
        this.playTone(note.f, note.d / 1000, 'sawtooth', 0.2);
      }, time);
      time += note.d + 40;
    });
  }
}

export const sounds = new SoundEngine();
