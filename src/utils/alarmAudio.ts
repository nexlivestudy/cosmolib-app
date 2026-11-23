import type { AlarmToneId, SoundscapeId } from './scheduleEngine';

/**
 * 100% Free Client-Side WebAudio Synthesizer for COSMOLIB Schedule.
 * Zero external MP3/WAV files — generates 6 studio-grade alarm melodies
 * (with looping + volume + preview) and 4 ambient focus soundscapes.
 */
class CosmolibAudioEngine {
  private ctx: AudioContext | null = null;
  private alarmIntervalId: number | null = null;
  private alarmActive = false;
  private alarmGainNode: GainNode | null = null;
  private ambientStopper: (() => void) | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playPatternOnce(tone: AlarmToneId, volume: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const safeVol = Math.max(0.05, Math.min(1, volume)) * 0.35;

    const master = ctx.createGain();
    master.gain.setValueAtTime(safeVol, now);
    master.connect(ctx.destination);
    this.alarmGainNode = master;

    const triggerNote = (
      freq: number,
      startOffset: number,
      duration: number,
      type: OscillatorType = 'sine',
      gainScale = 1
    ) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      env.gain.setValueAtTime(0.0001, now + startOffset);
      env.gain.exponentialRampToValueAtTime(Math.max(0.001, gainScale), now + startOffset + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
      osc.connect(env);
      env.connect(master);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.04);
    };

    switch (tone) {
      case 'sunrise_bell':
        triggerNote(523.25, 0.0, 0.7, 'sine', 0.9);
        triggerNote(783.99, 0.0, 0.6, 'sine', 0.35);
        triggerNote(659.25, 0.35, 0.8, 'sine', 0.85);
        triggerNote(1046.5, 0.75, 1.0, 'sine', 0.7);
        break;
      case 'temple_chime':
        // Pentatonic D-major shimmer
        triggerNote(587.33, 0.0, 0.9, 'sine', 0.85);
        triggerNote(659.25, 0.25, 0.9, 'sine', 0.75);
        triggerNote(880.0, 0.5, 1.0, 'sine', 0.8);
        triggerNote(1174.66, 0.8, 1.1, 'triangle', 0.45);
        break;
      case 'cyber_pulse':
        triggerNote(660, 0.0, 0.16, 'triangle', 0.95);
        triggerNote(880, 0.2, 0.16, 'triangle', 0.95);
        triggerNote(1108.73, 0.4, 0.28, 'triangle', 0.9);
        triggerNote(880, 0.8, 0.18, 'triangle', 0.85);
        triggerNote(1318.5, 1.02, 0.45, 'sine', 0.8);
        break;
      case 'deep_focus_chord':
        // Lush Fmaj9 chord swell
        [174.61, 220.0, 261.63, 329.63, 392.0].forEach((f, idx) => {
          triggerNote(f, idx * 0.08, 1.6, 'triangle', 0.38);
        });
        break;
      case 'zen_gong':
        triggerNote(196.0, 0.0, 1.9, 'sine', 1.0);
        triggerNote(293.66, 0.02, 1.7, 'sine', 0.45);
        triggerNote(392.0, 0.05, 1.4, 'triangle', 0.25);
        triggerNote(587.33, 0.12, 1.1, 'sine', 0.18);
        break;
      case 'morning_arpeggio':
        [523.25, 659.25, 783.99, 987.77, 1046.5].forEach((f, i) => {
          triggerNote(f, i * 0.16, 0.42, 'sine', 0.8);
        });
        break;
    }
  }

  public previewTone(tone: AlarmToneId, volume: number): void {
    try {
      this.playPatternOnce(tone, volume);
    } catch {
      // ignore autoplay block before user interaction
    }
  }

  public startAlarmLoop(tone: AlarmToneId, volume: number): void {
    this.stopAlarmLoop();
    this.alarmActive = true;
    try {
      this.playPatternOnce(tone, volume);
    } catch {
      // ignore autoplay block
    }
    this.alarmIntervalId = window.setInterval(() => {
      if (!this.alarmActive) return;
      try {
        this.playPatternOnce(tone, volume);
      } catch {
        // ignore
      }
    }, 2200);
  }

  public updateAlarmVolume(volume: number): void {
    if (this.alarmGainNode && this.ctx) {
      const safeVol = Math.max(0.05, Math.min(1, volume)) * 0.35;
      this.alarmGainNode.gain.setTargetAtTime(safeVol, this.ctx.currentTime, 0.05);
    }
  }

  public stopAlarmLoop(): void {
    this.alarmActive = false;
    if (this.alarmIntervalId !== null) {
      window.clearInterval(this.alarmIntervalId);
      this.alarmIntervalId = null;
    }
    if (this.alarmGainNode && this.ctx) {
      try {
        this.alarmGainNode.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
      } catch {
        // ignore
      }
    }
    this.alarmGainNode = null;
  }

  public isAlarmPlaying(): boolean {
    return this.alarmActive;
  }

  public startAmbient(soundscape: SoundscapeId): void {
    this.stopAmbient();
    if (soundscape === 'off') return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.4);
      master.connect(ctx.destination);

      if (soundscape === 'binaural40') {
        const left = ctx.createOscillator();
        const right = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);
        left.frequency.value = 200;
        right.frequency.value = 240; // 40Hz Gamma beat
        left.connect(merger, 0, 0);
        right.connect(merger, 0, 1);
        merger.connect(master);
        left.start();
        right.start();
        this.ambientStopper = () => {
          try {
            left.stop();
            right.stop();
            master.disconnect();
          } catch {
            // ignore
          }
        };
      } else if (soundscape === 'rain' || soundscape === 'brown_noise') {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        let lastOut = 0;
        const factor = soundscape === 'brown_noise' ? 0.985 : 0.955;
        const mix = soundscape === 'brown_noise' ? 0.02 : 0.045;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          lastOut = factor * lastOut + white * mix;
          output[i] = Math.max(-1, Math.min(1, lastOut * 2.8));
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = soundscape === 'brown_noise' ? 420 : 1050;
        noise.connect(filter);
        filter.connect(master);
        noise.start();
        this.ambientStopper = () => {
          try {
            noise.stop();
            master.disconnect();
          } catch {
            // ignore
          }
        };
      } else if (soundscape === 'lofi') {
        const freqs = [174.61, 220.0, 261.63, 329.63];
        const oscs = freqs.map((f) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = f;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 400;
          osc.connect(lp);
          lp.connect(master);
          osc.start();
          return osc;
        });
        this.ambientStopper = () => {
          try {
            oscs.forEach((o) => o.stop());
            master.disconnect();
          } catch {
            // ignore
          }
        };
      }
    } catch {
      // ignore audio errors
    }
  }

  public stopAmbient(): void {
    if (this.ambientStopper) {
      this.ambientStopper();
      this.ambientStopper = null;
    }
  }
}

export const cosmolibAudio = new CosmolibAudioEngine();
