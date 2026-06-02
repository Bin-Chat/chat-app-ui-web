type BrowserAudioContext = AudioContext;

class CallRingtone {
  private ctx: BrowserAudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlocked = false;
  private unlockCleanup: (() => void) | null = null;

  installUnlockListeners() {
    if (this.unlockCleanup || typeof window === 'undefined') {
      return () => {};
    }

    const unlock = () => {
      void this.unlock();
    };

    const events = ['pointerdown', 'click', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, unlock, { passive: true }));

    this.unlockCleanup = () => {
      events.forEach((event) => window.removeEventListener(event, unlock));
      this.unlockCleanup = null;
    };

    return this.unlockCleanup;
  }

  async unlock() {
    const ctx = this.getContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    this.unlocked = ctx.state === 'running';
    if (this.unlocked) {
      this.unlockCleanup?.();
    }
    return this.unlocked;
  }

  start() {
    if (this.timer) return;

    void this.unlock().finally(() => {
      this.playPattern();
      this.timer = setInterval(() => this.playPattern(), 1600);
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private getContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return null;
      this.ctx = new AudioContextCtor();
    }
    return this.ctx;
  }

  private playTone(startOffset: number, duration: number, frequency: number) {
    const ctx = this.getContext();
    if (!ctx || ctx.state !== 'running') return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const startAt = ctx.currentTime + startOffset;
    const endAt = startAt + duration;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.22, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }

  private playPattern() {
    if (!this.unlocked) return;
    this.playTone(0, 0.28, 520);
    this.playTone(0.42, 0.28, 620);
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export const callRingtone = new CallRingtone();
