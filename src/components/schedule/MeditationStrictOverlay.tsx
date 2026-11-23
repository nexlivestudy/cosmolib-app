import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Coffee,
  Eye,
  EyeOff,
  Lock,
  ShieldAlert,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  MOTIVATIONAL_QUOTES,
  formatDurationHms,
  type SoundscapeId,
  type StrictModeSettings,
} from '../../utils/scheduleEngine';

interface TabSwitchEvent {
  id: string;
  timestamp: number;
  reason: string;
  penaltySecs: number;
}

interface MeditationStrictOverlayProps {
  sessionLabel: string;
  remainingSecs: number;
  totalSecs: number;
  onBreak: boolean;
  breakRemainingSecs: number;
  settings: StrictModeSettings;
  onToggleHomeScreen: (visible: boolean) => void;
  soundscape: SoundscapeId;
  onChangeSoundscape: (s: SoundscapeId) => void;
  onSkipBreak: () => void;
  onAddPenaltySeconds: (secs: number) => void;
  onPenaltyPauseChange: (paused: boolean) => void;
  penaltyPaused: boolean;
  onAuthorizedExit: () => void;
}

const HOLD_EXIT_MS = 5000;

export const MeditationStrictOverlay: React.FC<MeditationStrictOverlayProps> = ({
  sessionLabel,
  remainingSecs,
  totalSecs,
  onBreak,
  breakRemainingSecs,
  settings,
  onToggleHomeScreen,
  soundscape,
  onChangeSoundscape,
  onSkipBreak,
  onAddPenaltySeconds,
  onPenaltyPauseChange,
  penaltyPaused,
  onAuthorizedExit,
}) => {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [tabLogs, setTabLogs] = useState<TabSwitchEvent[]>([]);
  const [showReturnOverlay, setShowReturnOverlay] = useState(false);

  // Hold-to-exit 5s + confirm + optional 4-digit PIN
  const [holdProgressPct, setHoldProgressPct] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [exitStage, setExitStage] = useState<'locked' | 'confirm'>('locked');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const holdStartRef = useRef<number | null>(null);
  const holdRafRef = useRef<number | null>(null);
  const lastViolationAtRef = useRef<number>(0);

  // Rotate calm quote every 15s
  useEffect(() => {
    const id = window.setInterval(() => {
      setQuoteIdx((prev) => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  // Anti-exit: beforeunload warning + visibilitychange / blur detection + penalty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Meditation Strict Mode is active. Stay focused until your session finishes.';
    };

    const recordLeaveAttempt = (reason: string) => {
      const now = Date.now();
      if (now - lastViolationAtRef.current < 1500) return;
      lastViolationAtRef.current = now;

      const penalty = settings.tabSwitchPenaltyEnabled ? settings.tabSwitchPenaltySecs : 0;
      setTabSwitchCount((c) => c + 1);
      setTabLogs((prev) => [
        { id: `leave-${now}`, timestamp: now, reason, penaltySecs: penalty },
        ...prev.slice(0, 14),
      ]);
      setShowReturnOverlay(true);
      if (settings.tabSwitchPenaltyEnabled) {
        onPenaltyPauseChange(true);
      }
      if (penalty > 0) {
        onAddPenaltySeconds(penalty);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        recordLeaveAttempt('Switched browser tab');
      }
    };

    const handleBlur = () => {
      recordLeaveAttempt('Window lost focus');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [
    settings.tabSwitchPenaltyEnabled,
    settings.tabSwitchPenaltySecs,
    onAddPenaltySeconds,
    onPenaltyPauseChange,
  ]);

  // Hold-to-exit 5s smooth rAF tracker
  const cancelHold = () => {
    setIsHolding(false);
    holdStartRef.current = null;
    if (holdRafRef.current !== null) {
      cancelAnimationFrame(holdRafRef.current);
      holdRafRef.current = null;
    }
    setHoldProgressPct(0);
  };

  const startHold = () => {
    cancelHold();
    setIsHolding(true);
    holdStartRef.current = performance.now();

    const tick = (now: number) => {
      if (holdStartRef.current === null) return;
      const elapsed = now - holdStartRef.current;
      const pct = Math.min(100, (elapsed / HOLD_EXIT_MS) * 100);
      setHoldProgressPct(pct);
      if (elapsed >= HOLD_EXIT_MS) {
        cancelHold();
        setPinError(null);
        setPinInput('');
        setExitStage('confirm');
        return;
      }
      holdRafRef.current = requestAnimationFrame(tick);
    };
    holdRafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (holdRafRef.current !== null) cancelAnimationFrame(holdRafRef.current);
    };
  }, []);

  const handleConfirmFinalExit = () => {
    if (settings.exitPin && settings.exitPin.length === 4) {
      if (pinInput.trim() !== settings.exitPin) {
        setPinError('Incorrect 4-digit exit PIN. Stay locked in.');
        return;
      }
    }
    onAuthorizedExit();
  };

  const progressRatio = totalSecs > 0 ? Math.max(0, Math.min(1, (totalSecs - remainingSecs) / totalSecs)) : 0;
  const radius = 112;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progressRatio);
  const quote = MOTIVATIONAL_QUOTES[quoteIdx];
  const isMinimalHomeOff = !settings.homeScreenVisible;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Meditation Strict Mode Focus Lock"
      data-testid="strict-mode-overlay"
      data-homescreen={settings.homeScreenVisible ? 'on' : 'off'}
      className="fixed inset-0 z-[65] flex flex-col justify-between overflow-y-auto bg-[#050811] p-5 text-white sm:p-8"
    >
      {/* Top Bar: Minimal lock identity + Home-screen ON/OFF toggle */}
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Lock className="h-4 w-4 text-cyan-400" />
          <span className="font-semibold text-white">Meditation Strict Mode</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">{sessionLabel}</span>
          {tabSwitchCount > 0 && (
            <>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span data-testid="strict-violation-count" className="font-mono text-amber-300 tabular-nums">
                {tabSwitchCount} focus {tabSwitchCount === 1 ? 'leave' : 'leaves'} logged
              </span>
            </>
          )}
        </div>

        {/* Home Screen ON / OFF toggle directly inside Meditation Strict Mode */}
        <div className="flex items-center gap-2.5">
          {settings.homeScreenVisible ? (
            <Eye className="h-4 w-4 text-cyan-400" />
          ) : (
            <EyeOff className="h-4 w-4 text-slate-400" />
          )}
          <span className="text-xs font-medium text-slate-300">Home Screen</span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.homeScreenVisible}
            aria-label="Toggle Home Screen visibility in Meditation Strict Mode"
            data-testid="strict-homescreen-toggle"
            onClick={() => onToggleHomeScreen(!settings.homeScreenVisible)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              settings.homeScreenVisible ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                settings.homeScreenVisible ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="font-mono text-xs text-slate-400">
            {settings.homeScreenVisible ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* Main Center Display */}
      <div className="mx-auto my-auto flex w-full max-w-4xl flex-col items-center py-8 text-center">
        {/* SVG Progress Ring + Tabular Countdown */}
        <div className="relative flex items-center justify-center">
          <svg className="h-64 w-64 -rotate-90 sm:h-72 sm:w-72" viewBox="0 0 260 260">
            <circle
              cx="130"
              cy="130"
              r={radius}
              fill="none"
              className="stroke-slate-800/80"
              strokeWidth="6"
            />
            <circle
              cx="130"
              cy="130"
              r={radius}
              fill="none"
              className={onBreak ? 'stroke-emerald-400' : 'stroke-cyan-400'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {onBreak ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                  <Coffee className="h-3.5 w-3.5" />
                  Pomodoro Recovery Break
                </span>
                <div className="mt-1 font-mono text-4xl font-bold tracking-tight tabular-nums text-white sm:text-5xl">
                  {formatDurationHms(breakRemainingSecs)}
                </div>
                <button
                  type="button"
                  onClick={onSkipBreak}
                  className="mt-3 rounded-lg border border-emerald-500/40 px-3 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/15"
                >
                  Resume Study
                </button>
              </>
            ) : (
              <>
                <span className="text-xs font-medium text-cyan-300">
                  {isMinimalHomeOff ? 'Zero-Distraction Minimal Lock' : 'Deep Study Remaining'}
                </span>
                <div
                  data-testid="strict-countdown"
                  className="mt-1 font-mono text-4xl font-bold tracking-tight tabular-nums text-white sm:text-5xl"
                >
                  {formatDurationHms(remainingSecs)}
                </div>
                <span className="mt-1.5 font-mono text-xs tabular-nums text-slate-400">
                  {Math.round(progressRatio * 100)}% complete
                </span>
              </>
            )}
          </div>
        </div>

        {/* Calm Motivational Quote (Always visible in both Minimal OFF and Home ON modes) */}
        <div data-testid="strict-quote" className="mt-6 max-w-xl">
          <p className="text-base font-medium leading-relaxed text-slate-200 sm:text-lg">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="mt-1.5 text-xs text-slate-500">— {quote.author}</p>
        </div>

        {/* Extra Controls — ONLY shown when Home Screen is ON */}
        {!isMinimalHomeOff && (
          <div
            data-testid="strict-homescreen-controls"
            className="mt-8 grid w-full max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-2"
          >
            {/* Ambient Soundscape Switcher */}
            <div className="rounded-xl border border-slate-800 bg-[#0D1324] p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span>Ambient Focus Noise</span>
                {soundscape === 'off' ? (
                  <VolumeX className="h-4 w-4 text-slate-500" />
                ) : (
                  <Volume2 className="h-4 w-4 text-cyan-400" />
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'off', label: 'Silent' },
                    { id: 'rain', label: 'Rain' },
                    { id: 'brown_noise', label: 'Brown Noise' },
                    { id: 'binaural40', label: '40Hz Gamma' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChangeSoundscape(s.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      soundscape === s.id
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300'
                        : 'border-slate-800 bg-[#080C17] text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Focus Guard Log */}
            <div className="rounded-xl border border-slate-800 bg-[#0D1324] p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span>Anti-Exit Guard Log</span>
                <span className="font-mono text-slate-400 tabular-nums">
                  {settings.tabSwitchPenaltyEnabled ? `+${settings.tabSwitchPenaltySecs}s penalty` : 'Log only'}
                </span>
              </div>
              {tabLogs.length === 0 ? (
                <p className="mt-3 text-xs text-slate-400">
                  Zero distractions recorded. Keep this tab active until your block completes.
                </p>
              ) : (
                <ul className="mt-2.5 max-h-24 space-y-1 overflow-y-auto text-[11px] text-amber-300">
                  {tabLogs.map((log) => (
                    <li key={log.id} className="flex items-center justify-between gap-2 font-mono tabular-nums">
                      <span className="truncate">{log.reason}</span>
                      <span>
                        {log.penaltySecs > 0 ? `+${log.penaltySecs}s` : 'logged'} ·{' '}
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Anti-Exit Gate: Hold 5s + Final Confirmation (+ optional 4-digit PIN) */}
      <div className="mx-auto w-full max-w-md border-t border-slate-800/80 pt-4 text-center">
        {exitStage === 'locked' ? (
          <div className="space-y-2">
            <button
              type="button"
              data-testid="strict-hold-exit-btn"
              onMouseDown={startHold}
              onMouseUp={cancelHold}
              onMouseLeave={cancelHold}
              onTouchStart={startHold}
              onTouchEnd={cancelHold}
              onTouchCancel={cancelHold}
              className="relative w-full overflow-hidden rounded-xl border border-slate-700 bg-[#0D1324] px-5 py-3 text-xs font-semibold text-slate-300 select-none hover:border-rose-500/60"
            >
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-rose-600/35 transition-none"
                style={{ width: `${holdProgressPct}%` }}
              />
              <span className="relative z-10 inline-flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                {isHolding
                  ? `Keep holding to unlock exit (${Math.ceil(((100 - holdProgressPct) / 100) * 5)}s)...`
                  : 'Hold 5 Seconds for Emergency Exit'}
              </span>
            </button>
            <p className="text-[11px] text-slate-500">
              Single clicks are blocked during Meditation Strict Mode.
              {settings.exitPin.length === 4 ? ' 4-digit Exit PIN also required.' : ''}
            </p>
          </div>
        ) : (
          <div
            data-testid="strict-exit-confirm-panel"
            className="rounded-xl border border-rose-500/40 bg-[#0D1324] p-4 text-left"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              <span>Confirm Emergency Exit</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Ending Meditation Strict Mode early breaks this focus block. Are you certain?
            </p>

            {settings.exitPin.length === 4 && (
              <div className="mt-3">
                <label htmlFor="strict-exit-pin" className="block text-[11px] font-semibold text-slate-300">
                  Enter your 4-digit Exit PIN
                </label>
                <input
                  id="strict-exit-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setPinError(null);
                  }}
                  placeholder="••••"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-[#050811] px-3 py-2 font-mono text-sm tracking-widest text-white focus:border-cyan-500 focus:outline-none"
                />
                {pinError && <p className="mt-1 text-[11px] text-rose-400">{pinError}</p>}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExitStage('locked')}
                className="flex-1 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400"
              >
                Stay Locked In
              </button>
              <button
                type="button"
                data-testid="strict-confirm-exit-btn"
                onClick={handleConfirmFinalExit}
                className="rounded-lg border border-rose-500/50 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/15"
              >
                Exit Session
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Blur / Tab-Switch Dim & Return Overlay */}
      {showReturnOverlay && (
        <div
          data-testid="return-overlay"
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/90 p-6 backdrop-blur-md"
        >
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-[#0D1324] p-6 text-center">
            <AlertTriangle className="mx-auto h-9 w-9 text-amber-400" />
            <h2 className="mt-3 font-display text-xl font-bold text-white">
              Return to Your Study Session
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Leaving the active focus window was detected and logged (#{tabSwitchCount}).
              {settings.tabSwitchPenaltyEnabled
                ? ` Timer paused & +${settings.tabSwitchPenaltySecs}s penalty added until you return.`
                : ''}
            </p>
            {penaltyPaused && (
              <p className="mt-2 font-mono text-[11px] font-semibold text-amber-300 tabular-nums">
                Status: Session Paused (Penalty Guard Active)
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                setShowReturnOverlay(false);
                onPenaltyPauseChange(false);
              }}
              className="mt-5 w-full rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-400"
            >
              Return to Focus Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
