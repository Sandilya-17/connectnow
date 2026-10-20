// Web Audio API sound generator for seamless, zero-dependency corporate chimes

class SoundService {
  private ctx: AudioContext | null = null;
  private soundEnabled = true;

  constructor() {
    // Lazy initialize on first user gesture
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('connectnow_sound');
      if (stored !== null) {
        this.soundEnabled = stored === 'true';
      }
    }
  }

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('connectnow_sound', String(this.soundEnabled));
    return this.soundEnabled;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public playSendSound() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {
      // Audio playback ignored if browser restrictions apply
    }
  }

  public playReceiveSound() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.07); // E6

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.07);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.22);
    } catch {
      // Audio playback ignored
    }
  }

  public playPopSound() {
    if (!this.soundEnabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.04);

      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch {
      // Ignore
    }
  }
}

export const sound = new SoundService();
