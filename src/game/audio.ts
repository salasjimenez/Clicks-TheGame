export class GameAudio {
  private context: AudioContext | null = null;

  playClick(enabled: boolean, critical: boolean): void {
    if (!enabled) return;
    this.tone(critical ? 760 : 420, critical ? 0.09 : 0.045, critical ? 0.08 : 0.035, 'sine');
  }

  playSuccess(enabled: boolean): void {
    if (!enabled) return;
    this.tone(520, 0.08, 0.05, 'triangle');
    window.setTimeout(() => this.tone(760, 0.11, 0.045, 'triangle'), 70);
  }

  private tone(frequency: number, duration: number, volume: number, type: OscillatorType): void {
    try {
      this.context ??= new AudioContext();
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const start = this.context.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(this.context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    } catch {
      this.context = null;
    }
  }
}
