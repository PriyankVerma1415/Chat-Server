class RingtonePlayer {
  private audioCtx: AudioContext | null = null;
  private oscillator1: OscillatorNode | null = null;
  private oscillator2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isPlaying = false;
  private stopTimerId: NodeJS.Timeout | null = null;

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.stopTimerId) {
      clearTimeout(this.stopTimerId);
      this.stopTimerId = null;
    }
    
    try {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      
      this.playRing();
      // US style: 2s ring, 4s silence. So interval is 4 seconds total
      this.intervalId = setInterval(() => {
        if (this.isPlaying) this.playRing();
      }, 4000);
    } catch (e) {
      console.error("Audio Context not supported", e);
    }
  }

  private playRing() {
    if (!this.audioCtx) return;
    
    this.oscillator1 = this.audioCtx.createOscillator();
    this.oscillator2 = this.audioCtx.createOscillator();
    this.gainNode = this.audioCtx.createGain();

    // Standard dial tone / ring frequencies
    this.oscillator1.type = 'sine';
    this.oscillator1.frequency.value = 440;
    
    this.oscillator2.type = 'sine';
    this.oscillator2.frequency.value = 480;

    this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
    
    // Quick fade in
    this.gainNode.gain.linearRampToValueAtTime(0.5, this.audioCtx.currentTime + 0.05);
    // Hold for 2 seconds
    this.gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime + 1.95);
    // Quick fade out
    this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 2.0);

    this.oscillator1.connect(this.gainNode);
    this.oscillator2.connect(this.gainNode);
    this.gainNode.connect(this.audioCtx.destination);

    this.oscillator1.start(this.audioCtx.currentTime);
    this.oscillator2.start(this.audioCtx.currentTime);
    
    this.oscillator1.stop(this.audioCtx.currentTime + 2.0);
    this.oscillator2.stop(this.audioCtx.currentTime + 2.0);
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.gainNode && this.audioCtx) {
        this.gainNode.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.1);
    }
    
    if (this.stopTimerId) clearTimeout(this.stopTimerId);
    this.stopTimerId = setTimeout(() => {
        if (!this.isPlaying && this.audioCtx?.state !== 'closed') {
            this.audioCtx?.close().catch(() => {});
            this.audioCtx = null;
        }
    }, 200);
  }
}

export const ringtonePlayer = new RingtonePlayer();
