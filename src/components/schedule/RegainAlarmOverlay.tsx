import React, { useEffect, useState } from 'react';
import { BellRing, Flame, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import {
  ALARM_TONES,
  MOTIVATIONAL_QUOTES,
  formatClockFromDate,
  type ScheduleAlarm,
} from '../../utils/scheduleEngine';

interface RegainAlarmOverlayProps {
  alarm: ScheduleAlarm;
  now: Date;
  streakDays: number;
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onToggleMute: () => void;
  onAwakeStartStudy: () => void;
  onSnooze5Min: () => void;
  onDismiss: () => void;
}

export const RegainAlarmOverlay: React.FC<RegainAlarmOverlayProps> = ({
  alarm,
  now,
  streakDays,
  volume,
  muted,
  onVolumeChange,
  onToggleMute,
  onAwakeStartStudy,
  onSnooze5Min,
  onDismiss,
}) => {
  const [quoteIdx, setQuoteIdx] = useState(() => Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length));

  // Auto-rotate motivational quote every 5 seconds while alarm is ringing
  useEffect(() => {
    const id = window.setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  // Gentle mobile vibration pulse while active (browser-safe)
  useEffect(() => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate([300, 150, 300]);
    const id = window.setInterval(() => {
      try {
        navigator.vibrate([300, 150, 300]);
      } catch {
        // ignore unsupported vibration
      }
    }, 2400);
    return () => {
      window.clearInterval(id);
      try {
        navigator.vibrate(0);
      } catch {
        // ignore
      }
    };
  }, []);

  const quote = MOTIVATIONAL_QUOTES[quoteIdx];
  const toneMeta = ALARM_TONES.find((t) => t.id === alarm.tone);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="alarm-overlay-title"
      data-testid="alarm-overlay"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#060913]/95 p-4 text-white backdrop-blur-md"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-[#0D1324] p-6 sm:p-10 shadow-2xl">
        {/* Top Meta Strip (Zero-Pill Clean Typography) */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 text-xs text-slate-400">
          <div className="flex items-center gap-2 font-semibold text-cyan-400">
            <BellRing className="h-4 w-4" />
            <span>COSMOLIB Schedule Alarm</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-300 tabular-nums">
              {alarm.startTime} – {alarm.endTime}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-amber-300 tabular-nums">
            <Flame className="h-4 w-4" />
            <span>{streakDays} Day Study Streak</span>
          </div>
        </div>

        {/* Center Time & Label */}
        <div className="mt-7 text-center">
          <p className="text-xs font-medium text-slate-400">Scheduled Session Ready</p>
          <h1
            id="alarm-overlay-title"
            className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl"
          >
            {alarm.label || 'Deep Study Block'}
          </h1>
          <div className="mt-4 font-mono text-5xl font-bold tracking-tight text-cyan-300 tabular-nums sm:text-7xl">
            {formatClockFromDate(now)}
          </div>
        </div>

        {/* Rotating Motivational Quote */}
        <div
          data-testid="alarm-motivational-quote"
          className="mt-7 rounded-xl border border-slate-800 bg-[#080C17] p-5 text-center"
        >
          <blockquote className="text-base font-medium leading-relaxed text-slate-100 sm:text-lg">
            &ldquo;{quote.text}&rdquo;
          </blockquote>
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
            <span>— {quote.author}</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setQuoteIdx((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length)}
              className="inline-flex items-center gap-1 font-semibold text-cyan-400 hover:text-cyan-300"
            >
              <RefreshCw className="h-3 w-3" />
              Next Quote
            </button>
          </div>
        </div>

        {/* Audio Volume & Tone Control */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-[#0A101E] px-4 py-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute alarm sound' : 'Mute alarm sound'}
              className="rounded-md p-1.5 text-cyan-400 hover:bg-slate-800"
            >
              {muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <span>
              Tone: <strong className="text-white">{toneMeta?.name || alarm.tone}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <label htmlFor="alarm-ring-volume" className="text-slate-400">
              Volume
            </label>
            <input
              id="alarm-ring-volume"
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              className="h-1.5 w-28 accent-cyan-500"
            />
          </div>
        </div>

        {/* Primary & Secondary CTAs */}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          <button
            type="button"
            data-testid="alarm-start-study-cta"
            onClick={onAwakeStartStudy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-400 whitespace-nowrap"
          >
            I&apos;m Awake — Start Study
          </button>
          <button
            type="button"
            onClick={onSnooze5Min}
            className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-5 py-3.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 whitespace-nowrap"
          >
            Snooze 5 Min
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex items-center justify-center rounded-xl border border-slate-800 px-4 py-3.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-white whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
