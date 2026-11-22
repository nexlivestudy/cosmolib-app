import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Coffee,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatTimerDisplay, shouldTriggerScheduledBreak } from '../utils/studyLogic';

type SoundscapeType = 'off' | 'lofi' | 'rain' | 'binaural40';
type BlockMode = 'normal' | 'ultra';

interface FocusTimerModuleProps {
  isUltraBlockActive: boolean;
  onUltraBlockChange: (active: boolean) => void;
  onLogStudyMinute: () => void;
}

export const FocusTimerModule: React.FC<FocusTimerModuleProps> = ({
  isUltraBlockActive,
  onUltraBlockChange,
  onLogStudyMinute,
}) => {
  const [targetMins, setTargetMins] = useState(60);
  const [remainingSecs, setRemainingSecs] = useState(60 * 60);
  const [elapsedFocusSecs, setElapsedFocusSecs] = useState(0);
  const [running, setRunning] = useState(false);
  const [blockMode, setBlockMode] = useState<BlockMode>('normal');
  const [soundscape, setSoundscape] = useState<SoundscapeType>('off');
  const [alarmTone, setAlarmTone] = useState<'chime' | 'bell' | 'pulse'>('chime');
  const [onBreak, setOnBreak] = useState(false);
  const [breakRemainingSecs, setBreakRemainingSecs] = useState(300);
  const [urgentBreakConfirm, setUrgentBreakConfirm] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundNodesRef = useRef<{ stop: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const stopAmbientAudio = () => {
    soundNodesRef.current?.stop();
    soundNodesRef.current = null;
  };

  const playAlarmChime = (tone: 'chime' | 'bell' | 'pulse') => {
    try {
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone === 'pulse' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(tone === 'bell' ? 880 : tone === 'pulse' ? 520 : 660, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.15);
    } catch {
      // ignore autoplay block
    }
  };

  // Web Audio API synthesizer for Lo-Fi drone, Rain noise, and 40Hz Gamma Binaural beats
  useEffect(() => {
    stopAmbientAudio();
    if (soundscape === 'off') return;

    try {
      const ctx = audioCtxRef.current || new AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const master = ctx.createGain();
      master.gain.value = 0.08;
      master.connect(ctx.destination);

      if (soundscape === 'binaural40') {
        const leftOsc = ctx.createOscillator();
        const rightOsc = ctx.createOscillator();
        const merger = ctx.createChannelMerger(2);
        leftOsc.frequency.value = 200;
        rightOsc.frequency.value = 240; // 40Hz binaural beat difference
        leftOsc.connect(merger, 0, 0);
        rightOsc.connect(merger, 0, 1);
        merger.connect(master);
        leftOsc.start();
        rightOsc.start();
        soundNodesRef.current = {
          stop: () => {
            leftOsc.stop();
            rightOsc.stop();
            master.disconnect();
          },
        };
      } else if (soundscape === 'rain') {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = buffer.getChannelData(0);
        let b0 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.96 * b0 + white * 0.04;
          output[i] = b0 * 2.5;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 950;
        noise.connect(filter);
        filter.connect(master);
        noise.start();
        soundNodesRef.current = {
          stop: () => {
            noise.stop();
            master.disconnect();
          },
        };
      } else if (soundscape === 'lofi') {
        // Warm major-7th lo-fi pad chord
        const freqs = [174.61, 220.0, 261.63, 329.63];
        const oscs = freqs.map((f) => {
          const osc = ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.value = f;
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 420;
          osc.connect(lp);
          lp.connect(master);
          osc.start();
          return osc;
        });
        soundNodesRef.current = {
          stop: () => {
            oscs.forEach((o) => o.stop());
            master.disconnect();
          },
        };
      }
    } catch {
      // ignore audio errors
    }

    return () => stopAmbientAudio();
  }, [soundscape]);

  // Countdown Tick Loop
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (onBreak) {
        setBreakRemainingSecs((prev) => {
          if (prev <= 1) {
            setOnBreak(false);
            playAlarmChime(alarmTone);
            return 300;
          }
          return prev - 1;
        });
        return;
      }

      setRemainingSecs((prev) => {
        if (prev <= 1) {
          setRunning(false);
          onUltraBlockChange(false);
          playAlarmChime(alarmTone);
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
          }
          return 0;
        }
        return prev - 1;
      });

      setElapsedFocusSecs((prev) => {
        const next = prev + 1;
        if (next % 60 === 0) {
          onLogStudyMinute();
        }
        if (shouldTriggerScheduledBreak(next)) {
          setOnBreak(true);
          setBreakRemainingSecs(300);
          playAlarmChime(alarmTone);
        }
        return next;
      });
    }, 1000);

    return () => window.clearInterval(id);
  }, [running, onBreak, alarmTone, onUltraBlockChange, onLogStudyMinute]);

  const handleToggleStart = async () => {
    if (!running) {
      setRunning(true);
      if (blockMode === 'ultra') {
        onUltraBlockChange(true);
        try {
          await containerRef.current?.requestFullscreen();
        } catch {
          // fullscreen may be blocked in embedded iframe; CSS lockdown overlay still applies
        }
      }
    } else {
      if (blockMode === 'ultra') {
        setUrgentBreakConfirm(true);
        return;
      }
      setRunning(false);
    }
  };

  const handleReset = () => {
    setRunning(false);
    setOnBreak(false);
    setElapsedFocusSecs(0);
    setRemainingSecs(targetMins * 60);
    onUltraBlockChange(false);
    setUrgentBreakConfirm(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  };

  const handleTriggerUrgentBreak = () => {
    setOnBreak(true);
    setBreakRemainingSecs(300);
    setUrgentBreakConfirm(false);
    playAlarmChime(alarmTone);
  };

  const handleExitUltraBlock = () => {
    setRunning(false);
    onUltraBlockChange(false);
    setUrgentBreakConfirm(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  };

  const nextBreakInSecs = 1800 - (elapsedFocusSecs % 1800);

  return (
    <div
      ref={containerRef}
      className={`space-y-6 ${
        isUltraBlockActive
          ? 'fixed inset-0 z-50 flex flex-col justify-center bg-[#0B0F19] p-6 sm:p-12 overflow-y-auto'
          : ''
      }`}
    >
      {/* Main Focus Console with Atmospheric Backdrop */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white dark:border-slate-800">
        <img
          src="/src/assets/images/nexlive_focus_ambient_1795318946779.jpg"
          alt="Quiet twilight library desk overlooking rain-streaked glass"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19]/95 via-[#0B0F19]/75 to-[#0B0F19]/60" />

        <div className="relative z-10 flex flex-col items-center px-6 py-12 text-center sm:py-16">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-cyan-300">
            <span>{blockMode === 'ultra' ? 'Ultra Block Lockdown' : 'Normal Focus Block'}</span>
            <span aria-hidden="true">·</span>
            <span>5-Min Break Every 30 Min</span>
            {isUltraBlockActive && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300">Buddy Alerts Suppressed</span>
              </>
            )}
          </div>

          {onBreak ? (
            <div className="mt-6">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <Coffee className="h-4 w-4" />
                <span>Scheduled Recovery Break — Step Away &amp; Hydrate</span>
              </div>
              <div className="mt-3 font-mono text-6xl font-bold tracking-tight tabular-nums sm:text-7xl">
                {formatTimerDisplay(breakRemainingSecs)}
              </div>
              <button
                type="button"
                onClick={() => setOnBreak(false)}
                className="mt-5 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20"
              >
                Skip Break &amp; Resume Focus
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <div className="font-mono text-6xl font-bold tracking-tight tabular-nums sm:text-8xl">
                {formatTimerDisplay(remainingSecs)}
              </div>
              <p className="mt-3 text-xs text-slate-300 tabular-nums">
                Next automatic 5-min break in {formatTimerDisplay(nextBreakInSecs)} · Focused this session:{' '}
                {Math.floor(elapsedFocusSecs / 60)}m
              </p>
            </div>
          )}

          {/* Primary Controls */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleToggleStart}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running
                ? blockMode === 'ultra'
                  ? 'Locked (Request Break)'
                  : 'Pause Focus'
                : blockMode === 'ultra'
                ? 'Start Ultra Block Lockdown'
                : 'Start Focus Session'}
            </button>

            <button
              type="button"
              onClick={handleTriggerUrgentBreak}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20"
            >
              <Coffee className="h-4 w-4 text-amber-300" />
              Urgent Manual Break
            </button>

            {!isUltraBlockActive && (
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset focus timer"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/30 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            )}
          </div>

          {urgentBreakConfirm && (
            <div className="mt-6 max-w-md rounded-xl border border-amber-400/40 bg-[#111827] p-4 text-left text-xs text-slate-200">
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <AlertTriangle className="h-4 w-4" />
                <span>Ultra Block Lockdown Active</span>
              </div>
              <p className="mt-1 text-slate-300">
                Take a 5-minute Urgent Manual Break without breaking your streak, or force-exit fullscreen lockdown.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleTriggerUrgentBreak}
                  className="rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-950 hover:bg-amber-400"
                >
                  Take 5-Min Urgent Break
                </button>
                <button
                  type="button"
                  onClick={handleExitUltraBlock}
                  className="rounded-lg border border-slate-600 px-3 py-1.5 font-semibold text-slate-200 hover:bg-slate-800"
                >
                  End Lockdown
                </button>
                <button
                  type="button"
                  onClick={() => setUrgentBreakConfirm(false)}
                  className="rounded-lg px-3 py-1.5 text-slate-400 hover:text-white"
                >
                  Stay Locked
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Configuration Deck */}
      {!isUltraBlockActive && (
        <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Duration Presets */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Session Duration
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Automatic 5-minute break triggers every 30 minutes of focus.
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[30, 60, 90, 120].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setTargetMins(m);
                    setRemainingSecs(m * 60);
                    setElapsedFocusSecs(0);
                  }}
                  className={`rounded-lg border py-2 font-mono text-xs font-semibold tabular-nums transition-colors ${
                    targetMins === m
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-300'
                  }`}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="custom-focus-mins" className="text-xs text-slate-600 dark:text-slate-400">
                Custom (mins):
              </label>
              <input
                id="custom-focus-mins"
                type="number"
                min={5}
                max={360}
                value={targetMins}
                onChange={(e) => {
                  const val = Math.max(5, Math.min(360, Number(e.target.value) || 30));
                  setRunning(false);
                  setTargetMins(val);
                  setRemainingSecs(val * 60);
                  setElapsedFocusSecs(0);
                }}
                className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-mono text-xs tabular-nums dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
              />
            </div>
          </div>

          {/* Normal Block vs Ultra Block */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
              Lockdown Strictness
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ultra Block engages fullscreen focus and suppresses all buddy alerts.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setBlockMode('normal')}
                className={`flex items-center justify-between rounded-lg border p-3 text-left text-xs ${
                  blockMode === 'normal'
                    ? 'border-cyan-500 bg-cyan-500/10 font-semibold text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>Normal Block (Flexible Pause)</span>
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setBlockMode('ultra')}
                className={`flex items-center justify-between rounded-lg border p-3 text-left text-xs ${
                  blockMode === 'ultra'
                    ? 'border-indigo-500 bg-indigo-500/10 font-semibold text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  Ultra Block (Fullscreen Lockdown)
                </span>
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Ambient Audio & Alarm Tone */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                Focus Soundscape
              </h2>
              {soundscape === 'off' ? (
                <VolumeX className="h-4 w-4 text-slate-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-cyan-500" />
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'off', label: 'Silent' },
                  { id: 'lofi', label: 'Lo-Fi Warm Pad' },
                  { id: 'rain', label: 'Soft Rain' },
                  { id: 'binaural40', label: '40Hz Binaural' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSoundscape(s.id)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                    soundscape === s.id
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Alarm Tone</span>
              <div className="flex gap-1.5">
                {(['chime', 'bell', 'pulse'] as const).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => {
                      setAlarmTone(tone);
                      playAlarmChime(tone);
                    }}
                    className={`rounded px-2 py-1 capitalize ${
                      alarmTone === tone
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {tone}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
