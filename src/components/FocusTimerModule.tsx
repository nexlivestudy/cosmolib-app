import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  CalendarClock,
  Coffee,
  Edit3,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { cosmolibAudio } from '../utils/alarmAudio';
import {
  ALARM_TONES,
  DEFAULT_FILTER_APPS,
  DEFAULT_STRICT_SETTINGS,
  addSecondsToClock,
  buildDefaultAllowMap,
  computeDriftCorrectedRemaining,
  computeNextTriggerTimestamp,
  computeScheduleDurationSeconds,
  formatDurationHms,
  isAppAllowed,
  shouldTriggerAlarm,
  syncCapacitorNativeFilter,
  syncCapacitorStrictLock,
  toggleAppAllowed,
  type AlarmToneId,
  type AllowMap,
  type BlockedAttemptLog,
  type ScheduleAlarm,
  type SoundscapeId,
  type StrictModeSettings,
} from '../utils/scheduleEngine';
import { LiveClockPreview } from './schedule/LiveClockPreview';
import { MeditationStrictOverlay } from './schedule/MeditationStrictOverlay';
import { NotificationFilterPanel } from './schedule/NotificationFilterPanel';
import { RegainAlarmOverlay } from './schedule/RegainAlarmOverlay';
import { EmptyStateCard } from './ui/CosmolibPrimitives';

interface FocusTimerModuleProps {
  userId?: string;
  streakDays?: number;
  minutesStudiedToday?: number;
  isUltraBlockActive: boolean;
  onUltraBlockChange: (active: boolean) => void;
  onLogStudyMinute: () => void;
}

interface PersistedScheduleState {
  alarms: ScheduleAlarm[];
  allowMap: AllowMap;
  filterEnabled: boolean;
  strictSettings: StrictModeSettings;
  sessionsCompleted: number;
}

function getStorageKey(userId?: string): string {
  return `cosmolib_schedule_v2_${userId || 'local'}`;
}

function loadPersistedState(userId?: string): PersistedScheduleState {
  const fallback: PersistedScheduleState = {
    alarms: [],
    allowMap: buildDefaultAllowMap(),
    filterEnabled: true,
    strictSettings: { ...DEFAULT_STRICT_SETTINGS },
    sessionsCompleted: 0,
  };
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedScheduleState>;
    const nowMs = Date.now();
    const alarms: ScheduleAlarm[] = Array.isArray(parsed.alarms)
      ? parsed.alarms.map((a) => ({
          ...a,
          // Reload-safe: if alarm expired > 60s ago while app was closed, roll forward to next day
          nextTriggerAt:
            a.enabled && nowMs - a.nextTriggerAt > 60_000
              ? computeNextTriggerTimestamp(a.startTime, nowMs)
              : a.nextTriggerAt,
        }))
      : [];

    return {
      alarms,
      allowMap: parsed.allowMap ? { ...buildDefaultAllowMap(), ...parsed.allowMap } : buildDefaultAllowMap(),
      filterEnabled: typeof parsed.filterEnabled === 'boolean' ? parsed.filterEnabled : true,
      strictSettings: { ...DEFAULT_STRICT_SETTINGS, ...(parsed.strictSettings || {}) },
      sessionsCompleted: Number(parsed.sessionsCompleted) || 0,
    };
  } catch {
    return fallback;
  }
}

export const FocusTimerModule: React.FC<FocusTimerModuleProps> = ({
  userId,
  streakDays = 1,
  minutesStudiedToday = 0,
  isUltraBlockActive,
  onUltraBlockChange,
  onLogStudyMinute,
}) => {
  const initialPersisted = useMemo(() => loadPersistedState(userId), [userId]);

  // Real-time local clock updating every second (drives analog + digital preview & alarm trigger check)
  const [now, setNow] = useState<Date>(() => new Date());

  // Saved alarms & configuration
  const [alarms, setAlarms] = useState<ScheduleAlarm[]>(initialPersisted.alarms);
  const [allowMap, setAllowMap] = useState<AllowMap>(initialPersisted.allowMap);
  const [filterEnabled, setFilterEnabled] = useState<boolean>(initialPersisted.filterEnabled);
  const [strictSettings, setStrictSettings] = useState<StrictModeSettings>(
    initialPersisted.strictSettings
  );
  const [sessionsCompleted, setSessionsCompleted] = useState<number>(
    initialPersisted.sessionsCompleted
  );
  const [attemptLogs, setAttemptLogs] = useState<BlockedAttemptLog[]>([]);

  // Schedule Form State (From HH:MM:SS -> To HH:MM:SS)
  const [editingAlarmId, setEditingAlarmId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState('Deep Study Sprint');
  const [formStartTime, setFormStartTime] = useState(() => addSecondsToClock(new Date(), 300));
  const [formEndTime, setFormEndTime] = useState(() => addSecondsToClock(new Date(), 3900));
  const [formTone, setFormTone] = useState<AlarmToneId>('sunrise_bell');
  const [formVolume, setFormVolume] = useState<number>(0.8);
  const [formStrictOnStart, setFormStrictOnStart] = useState<boolean>(true);
  const [formFilterOnStart, setFormFilterOnStart] = useState<boolean>(true);
  const [formNotice, setFormNotice] = useState<string | null>(null);

  // Active Ringing Regain-Style Alarm
  const [ringingAlarm, setRingingAlarm] = useState<ScheduleAlarm | null>(null);
  const [ringVolume, setRingVolume] = useState<number>(0.8);
  const [ringMuted, setRingMuted] = useState<boolean>(false);

  // Accurate Drift-Corrected Focus Timer State (rAF + wall-clock anchor)
  const [activeSessionLabel, setActiveSessionLabel] = useState('Focused Study Block');
  const [targetDurationSecs, setTargetDurationSecs] = useState<number>(45 * 60);
  const [remainingSecs, setRemainingSecs] = useState<number>(45 * 60);
  const [running, setRunning] = useState<boolean>(false);
  const [strictOverlayActive, setStrictOverlayActive] = useState<boolean>(false);
  const [onBreak, setOnBreak] = useState<boolean>(false);
  const [breakRemainingSecs, setBreakRemainingSecs] = useState<number>(300);
  const [soundscape, setSoundscape] = useState<SoundscapeId>('off');
  const [elapsedThisSessionSecs, setElapsedThisSessionSecs] = useState<number>(0);
  const [penaltyPaused, setPenaltyPaused] = useState<boolean>(false);
  const [suppressedToast, setSuppressedToast] = useState<{ appName: string; outcome: 'blocked' | 'allowed' } | null>(null);

  // Notification permission state
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'
  );

  // Drift-free timer anchors (refs keep 60fps rAF loop stable without per-second teardown)
  const endTimestampRef = useRef<number | null>(null);
  const breakEndTimestampRef = useRef<number | null>(null);
  const remainingSecsRef = useRef<number>(45 * 60);
  const breakRemainingSecsRef = useRef<number>(300);
  const penaltyPausedRef = useRef<boolean>(false);
  const lastLoggedMinuteBucketRef = useRef<number>(0);
  const lastBreakTriggerBucketRef = useRef<number>(0);
  const sessionStartWallRef = useRef<number | null>(null);
  const accumulatedElapsedRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    remainingSecsRef.current = remainingSecs;
  }, [remainingSecs]);

  useEffect(() => {
    breakRemainingSecsRef.current = breakRemainingSecs;
  }, [breakRemainingSecs]);

  useEffect(() => {
    penaltyPausedRef.current = penaltyPaused;
  }, [penaltyPaused]);

  // Persist to localStorage (and best-effort Supabase user_metadata sync when live session exists)
  useEffect(() => {
    const payload: PersistedScheduleState = {
      alarms,
      allowMap,
      filterEnabled,
      strictSettings,
      sessionsCompleted,
    };
    try {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(payload));
    } catch {
      // ignore storage quota
    }
    void syncCapacitorNativeFilter(allowMap).catch(() => {});
  }, [alarms, allowMap, filterEnabled, strictSettings, sessionsCompleted, userId]);

  // Hydrate schedules from Supabase user_metadata on fresh device if localStorage is empty
  useEffect(() => {
    const sb = supabase;
    if (!isSupabaseConfigured() || !sb || !userId) return;
    let cancelled = false;
    const hydrateFromSupabase = async () => {
      try {
        const { data } = await sb.auth.getSession();
        if (!data.session?.access_token || data.session.access_token === 'mock-access-token') return;
        const remote = data.session.user?.user_metadata?.cosmolib_schedules;
        if (!cancelled && Array.isArray(remote) && remote.length > 0) {
          setAlarms((prev) => {
            if (prev.length > 0) return prev;
            const nowMs = Date.now();
            return (remote as ScheduleAlarm[]).map((a) => ({
              ...a,
              nextTriggerAt:
                a.enabled && nowMs - a.nextTriggerAt > 60_000
                  ? computeNextTriggerTimestamp(a.startTime, nowMs)
                  : a.nextTriggerAt,
            }));
          });
        }
      } catch {
        // silent offline fallback
      }
    };
    void hydrateFromSupabase();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const syncToSupabaseMetadata = useCallback(
    async (nextAlarms: ScheduleAlarm[]) => {
      if (!isSupabaseConfigured() || !supabase || !userId) return;
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token || data.session.access_token === 'mock-access-token') return;
        await supabase.auth.updateUser({
          data: {
            cosmolib_schedules: nextAlarms.slice(0, 12),
          },
        });
      } catch {
        // silent offline fallback; localStorage remains source of truth
      }
    },
    [userId]
  );

  // Ambient Soundscape Audio Lifecycle
  useEffect(() => {
    cosmolibAudio.startAmbient(soundscape);
    return () => {
      cosmolibAudio.stopAmbient();
    };
  }, [soundscape]);

  // Cleanup alarm audio on unmount
  useEffect(() => {
    return () => {
      cosmolibAudio.stopAlarmLoop();
      cosmolibAudio.stopAmbient();
    };
  }, []);

  // Safe Web Notification helper (respects Allowed vs Blocked filter)
  const dispatchWebNotification = useCallback(
    (title: string, body: string, bypassFilter = false, appId?: string) => {
      if (!bypassFilter && filterEnabled && appId && !isAppAllowed(appId, allowMap)) {
        return;
      }
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body, tag: appId || 'cosmolib-schedule' });
        } catch {
          // ignore headless/sandbox notification errors
        }
      }
    },
    [filterEnabled, allowMap]
  );

  // Trigger a Regain-style alarm
  const triggerAlarmOverlay = useCallback(
    (alarm: ScheduleAlarm) => {
      setRingingAlarm(alarm);
      setRingVolume(alarm.volume);
      setRingMuted(false);
      cosmolibAudio.startAlarmLoop(alarm.tone, alarm.volume);
      dispatchWebNotification(
        `COSMOLIB Schedule: ${alarm.label}`,
        `Study window ${alarm.startTime} – ${alarm.endTime} starts now. Lock in!`,
        true
      );
    },
    [dispatchWebNotification]
  );

  // 1-second local clock heartbeat + background-safe schedule alarm trigger monitor
  useEffect(() => {
    const checkTick = () => {
      const current = new Date();
      setNow(current);
      const nowMs = current.getTime();

      setAlarms((prev) => {
        let triggeredAlarm: ScheduleAlarm | null = null;
        let changed = false;

        const nextList = prev.map((alarm) => {
          if (!triggeredAlarm && shouldTriggerAlarm(alarm, nowMs)) {
            triggeredAlarm = alarm;
            changed = true;
            return {
              ...alarm,
              lastTriggeredAt: nowMs,
              nextTriggerAt: computeNextTriggerTimestamp(alarm.startTime, nowMs + 61_000),
            };
          }
          return alarm;
        });

        if (triggeredAlarm) {
          const toFire = triggeredAlarm;
          window.setTimeout(() => triggerAlarmOverlay(toFire), 0);
        }
        return changed ? nextList : prev;
      });
    };

    const id = window.setInterval(checkTick, 1000);
    return () => window.clearInterval(id);
  }, [triggerAlarmOverlay]);

  // High-precision rAF + wall-clock drift-corrected countdown engine (60fps, zero teardown churn, background-safe!)
  useEffect(() => {
    if (!running) return;
    let rafId = 0;

    const step = () => {
      if (penaltyPausedRef.current) {
        rafId = requestAnimationFrame(step);
        return;
      }

      const nowMs = Date.now();

      if (onBreak) {
        if (!breakEndTimestampRef.current) {
          breakEndTimestampRef.current = nowMs + breakRemainingSecsRef.current * 1000;
        }
        const bRem = computeDriftCorrectedRemaining(breakEndTimestampRef.current, nowMs);
        breakRemainingSecsRef.current = bRem;
        setBreakRemainingSecs((prev) => (prev !== bRem ? bRem : prev));
        if (bRem <= 0) {
          breakEndTimestampRef.current = null;
          setOnBreak(false);
          // Re-anchor study timer end timestamp cleanly after break
          endTimestampRef.current = Date.now() + remainingSecsRef.current * 1000;
          sessionStartWallRef.current = Date.now();
          cosmolibAudio.previewTone('sunrise_bell', 0.65);
        }
      } else {
        if (!endTimestampRef.current) {
          endTimestampRef.current = nowMs + remainingSecsRef.current * 1000;
        }
        if (!sessionStartWallRef.current) {
          sessionStartWallRef.current = nowMs;
        }

        const rem = computeDriftCorrectedRemaining(endTimestampRef.current, nowMs);
        remainingSecsRef.current = rem;
        setRemainingSecs((prev) => (prev !== rem ? rem : prev));

        const totalElapsedSecs =
          accumulatedElapsedRef.current +
          Math.floor((nowMs - sessionStartWallRef.current) / 1000);
        setElapsedThisSessionSecs((prev) => (prev !== totalElapsedSecs ? totalElapsedSecs : prev));

        const minuteBucket = Math.floor(totalElapsedSecs / 60);
        if (minuteBucket > lastLoggedMinuteBucketRef.current) {
          lastLoggedMinuteBucketRef.current = minuteBucket;
          onLogStudyMinute();
        }

        const breakCadenceSecs = Math.max(5, strictSettings.pomodoroBreakEveryMins) * 60;
        const breakBucket = Math.floor(totalElapsedSecs / breakCadenceSecs);
        if (breakBucket > lastBreakTriggerBucketRef.current && rem > 60) {
          lastBreakTriggerBucketRef.current = breakBucket;
          accumulatedElapsedRef.current = totalElapsedSecs;
          sessionStartWallRef.current = null;
          const breakDurSecs = Math.max(1, strictSettings.pomodoroBreakDurationMins) * 60;
          breakEndTimestampRef.current = nowMs + breakDurSecs * 1000;
          breakRemainingSecsRef.current = breakDurSecs;
          setBreakRemainingSecs(breakDurSecs);
          setOnBreak(true);
          cosmolibAudio.previewTone('temple_chime', 0.65);
        }

        if (rem <= 0) {
          endTimestampRef.current = null;
          sessionStartWallRef.current = null;
          accumulatedElapsedRef.current = 0;
          setPenaltyPaused(false);
          setRunning(false);
          setStrictOverlayActive(false);
          onUltraBlockChange(false);
          void syncCapacitorStrictLock(false, false);
          setSessionsCompleted((c) => c + 1);
          cosmolibAudio.previewTone('morning_arpeggio', 0.75);
          if (document.fullscreenElement) {
            void document.exitFullscreen().catch(() => {});
          }
          dispatchWebNotification(
            'COSMOLIB Focus Block Complete',
            `You completed ${activeSessionLabel}. Streak locked in!`,
            true
          );
          return;
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    // Secondary background-tab interval safeguard (browsers throttle rAF when hidden)
    const bgId = window.setInterval(step, 1000);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(bgId);
    };
  }, [
    running,
    onBreak,
    strictSettings.pomodoroBreakEveryMins,
    strictSettings.pomodoroBreakDurationMins,
    activeSessionLabel,
    onLogStudyMinute,
    onUltraBlockChange,
    dispatchWebNotification,
  ]);

  const startFocusSession = useCallback(
    async (opts: { durationSecs: number; label: string; engageStrict: boolean; engageFilter?: boolean }) => {
      const safeSecs = Math.max(60, Math.floor(opts.durationSecs));
      setActiveSessionLabel(opts.label || 'Deep Study Sprint');
      setTargetDurationSecs(safeSecs);
      setRemainingSecs(safeSecs);
      setOnBreak(false);
      setElapsedThisSessionSecs(0);
      accumulatedElapsedRef.current = 0;
      lastLoggedMinuteBucketRef.current = 0;
      lastBreakTriggerBucketRef.current = 0;
      endTimestampRef.current = Date.now() + safeSecs * 1000;
      sessionStartWallRef.current = Date.now();
      breakEndTimestampRef.current = null;
      if (opts.engageFilter) {
        setFilterEnabled(true);
      }
      setRunning(true);

      if (opts.engageStrict) {
        setStrictOverlayActive(true);
        onUltraBlockChange(true);
        void syncCapacitorStrictLock(true, !strictSettings.homeScreenVisible);
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // Fullscreen API may require direct gesture or be sandboxed; CSS fullscreen overlay still locks screen
        }
      }
    },
    [onUltraBlockChange, strictSettings.homeScreenVisible]
  );

  const handlePauseResume = async () => {
    if (running) {
      if (strictOverlayActive) return;
      if (sessionStartWallRef.current) {
        accumulatedElapsedRef.current += Math.floor((Date.now() - sessionStartWallRef.current) / 1000);
      }
      endTimestampRef.current = null;
      sessionStartWallRef.current = null;
      setRunning(false);
    } else {
      const secsToRun = remainingSecs > 0 ? remainingSecs : targetDurationSecs;
      endTimestampRef.current = Date.now() + secsToRun * 1000;
      sessionStartWallRef.current = Date.now();
      setRemainingSecs(secsToRun);
      setRunning(true);
      if (strictSettings.enabled) {
        setStrictOverlayActive(true);
        onUltraBlockChange(true);
        void syncCapacitorStrictLock(true, !strictSettings.homeScreenVisible);
        try {
          await document.documentElement.requestFullscreen();
        } catch {
          // fallback CSS lock active
        }
      }
    }
  };

  const handleResetTimer = () => {
    endTimestampRef.current = null;
    breakEndTimestampRef.current = null;
    sessionStartWallRef.current = null;
    accumulatedElapsedRef.current = 0;
    lastLoggedMinuteBucketRef.current = 0;
    lastBreakTriggerBucketRef.current = 0;
    remainingSecsRef.current = targetDurationSecs;
    setPenaltyPaused(false);
    setRunning(false);
    setOnBreak(false);
    setRemainingSecs(targetDurationSecs);
    setElapsedThisSessionSecs(0);
    setStrictOverlayActive(false);
    onUltraBlockChange(false);
  };

  const handleAuthorizedStrictExit = () => {
    endTimestampRef.current = null;
    breakEndTimestampRef.current = null;
    sessionStartWallRef.current = null;
    setPenaltyPaused(false);
    setRunning(false);
    setOnBreak(false);
    setStrictOverlayActive(false);
    onUltraBlockChange(false);
    void syncCapacitorStrictLock(false, false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  };

  const handlePenaltyPauseChange = useCallback((paused: boolean) => {
    penaltyPausedRef.current = paused;
    setPenaltyPaused(paused);
    if (paused) {
      if (sessionStartWallRef.current) {
        accumulatedElapsedRef.current += Math.floor((Date.now() - sessionStartWallRef.current) / 1000);
        sessionStartWallRef.current = null;
      }
      endTimestampRef.current = null;
    } else {
      endTimestampRef.current = Date.now() + remainingSecsRef.current * 1000;
      sessionStartWallRef.current = Date.now();
    }
  }, []);

  const handleAddPenaltySeconds = useCallback((penaltySecs: number) => {
    const nextRem = remainingSecsRef.current + penaltySecs;
    remainingSecsRef.current = nextRem;
    if (endTimestampRef.current) {
      endTimestampRef.current += penaltySecs * 1000;
    }
    setTargetDurationSecs((prev) => prev + penaltySecs);
    setRemainingSecs(nextRem);
  }, []);

  // Save or update a scheduled alarm
  const handleSaveAlarm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = formLabel.trim() || 'Scheduled Study Block';
    const nextTriggerAt = computeNextTriggerTimestamp(formStartTime, Date.now());

    let nextAlarms: ScheduleAlarm[];
    if (editingAlarmId) {
      nextAlarms = alarms.map((a) =>
        a.id === editingAlarmId
          ? {
              ...a,
              label: cleanLabel,
              startTime: formStartTime,
              endTime: formEndTime,
              tone: formTone,
              volume: formVolume,
              strictModeOnStart: formStrictOnStart,
              notificationFilterOnStart: formFilterOnStart,
              nextTriggerAt,
              enabled: true,
              lastTriggeredAt: undefined,
            }
          : a
      );
      setEditingAlarmId(null);
      setFormNotice(`Updated schedule "${cleanLabel}" (${formStartTime} – ${formEndTime}).`);
    } else {
      const created: ScheduleAlarm = {
        id: `sched-${Date.now()}`,
        label: cleanLabel,
        startTime: formStartTime,
        endTime: formEndTime,
        enabled: true,
        tone: formTone,
        volume: formVolume,
        strictModeOnStart: formStrictOnStart,
        notificationFilterOnStart: formFilterOnStart,
        nextTriggerAt,
        createdAt: new Date().toISOString(),
      };
      nextAlarms = [created, ...alarms];
      setFormNotice(`Scheduled "${cleanLabel}" for ${formStartTime} – ${formEndTime}.`);
    }

    setAlarms(nextAlarms);
    void syncToSupabaseMetadata(nextAlarms);
  };

  const handleEditAlarm = (alarm: ScheduleAlarm) => {
    setEditingAlarmId(alarm.id);
    setFormLabel(alarm.label);
    setFormStartTime(alarm.startTime);
    setFormEndTime(alarm.endTime);
    setFormTone(alarm.tone);
    setFormVolume(alarm.volume);
    setFormStrictOnStart(alarm.strictModeOnStart);
    setFormFilterOnStart(alarm.notificationFilterOnStart);
    setFormNotice(`Editing "${alarm.label}" — adjust times and click Update Schedule.`);
  };

  const handleDeleteAlarm = (id: string) => {
    const next = alarms.filter((a) => a.id !== id);
    setAlarms(next);
    if (editingAlarmId === id) setEditingAlarmId(null);
    void syncToSupabaseMetadata(next);
  };

  const handleToggleAlarmEnabled = (id: string) => {
    const nowMs = Date.now();
    const next = alarms.map((a) =>
      a.id === id
        ? {
            ...a,
            enabled: !a.enabled,
            nextTriggerAt: !a.enabled ? computeNextTriggerTimestamp(a.startTime, nowMs) : a.nextTriggerAt,
            lastTriggeredAt: undefined,
          }
        : a
    );
    setAlarms(next);
    void syncToSupabaseMetadata(next);
  };

  // Alarm overlay actions
  const handleAlarmAwakeStartStudy = () => {
    if (!ringingAlarm) return;
    const active = ringingAlarm;
    cosmolibAudio.stopAlarmLoop();
    setRingingAlarm(null);
    const durSecs = computeScheduleDurationSeconds(active.startTime, active.endTime);
    void startFocusSession({
      durationSecs: durSecs,
      label: active.label,
      engageStrict: active.strictModeOnStart || strictSettings.enabled,
      engageFilter: active.notificationFilterOnStart,
    });
  };

  const handleAlarmSnooze5Min = () => {
    if (!ringingAlarm) return;
    const snoozedId = ringingAlarm.id;
    const snoozeMs = Date.now() + 5 * 60 * 1000;
    cosmolibAudio.stopAlarmLoop();
    setRingingAlarm(null);
    setAlarms((prev) =>
      prev.map((a) =>
        a.id === snoozedId
          ? {
              ...a,
              nextTriggerAt: snoozeMs,
              lastTriggeredAt: undefined,
            }
          : a
      )
    );
    setFormNotice(`Snoozed "${ringingAlarm.label}" for 5 minutes.`);
  };

  const handleAlarmDismiss = () => {
    cosmolibAudio.stopAlarmLoop();
    setRingingAlarm(null);
  };

  // Notification Filter Handlers
  const handleRequestNotifPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
    } catch {
      // ignore
    }
  };

  const handleSimulateIncoming = (appId: string) => {
    const app = DEFAULT_FILTER_APPS.find((a) => a.id === appId);
    if (!app) return;
    const allowed = !filterEnabled || isAppAllowed(appId, allowMap);
    const entry: BlockedAttemptLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      appId: app.id,
      appName: app.name,
      message: allowed
        ? 'Allowed through active schedule allow-list'
        : 'Suppressed — Blocked by Schedule',
      timestamp: Date.now(),
      outcome: allowed ? 'allowed' : 'blocked',
    };
    setAttemptLogs((prev) => [entry, ...prev.slice(0, 19)]);
    setSuppressedToast({ appName: app.name, outcome: entry.outcome });
    window.setTimeout(() => {
      setSuppressedToast((curr) => (curr?.appName === app.name ? null : curr));
    }, 3500);

    if (allowed) {
      cosmolibAudio.previewTone('sunrise_bell', 0.45);
      dispatchWebNotification(
        `${app.name} (Allowed by COSMOLIB)`,
        'Incoming priority call allowed during your study schedule.',
        false,
        app.id
      );
    }
  };

  const progressRatio =
    targetDurationSecs > 0
      ? Math.max(0, Math.min(1, (targetDurationSecs - remainingSecs) / targetDurationSecs))
      : 0;
  const ringRadius = 86;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progressRatio);

  return (
    <div ref={containerRef} className="space-y-6">
      {/* 1. Accurate rAF Drift-Corrected Focus Timer & Stats Console */}
      <section className="cosmo-card p-6">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Left: Precision SVG Ring + HH:MM:SS Readout */}
          <div className="flex flex-col items-center justify-center lg:col-span-5">
            <div className="relative flex items-center justify-center">
              <svg className="h-52 w-52 -rotate-90" viewBox="0 0 200 200">
                <circle
                  cx="100"
                  cy="100"
                  r={ringRadius}
                  fill="none"
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth="8"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={ringRadius}
                  fill="none"
                  className={onBreak ? 'stroke-emerald-500' : 'stroke-cyan-500'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {onBreak ? 'Recovery Break' : running ? 'Active Session' : 'Ready to Lock In'}
                </span>
                <div
                  data-testid="main-timer-display"
                  className="mt-0.5 font-mono text-3xl font-bold tracking-tight tabular-nums text-slate-900 dark:text-white"
                >
                  {formatDurationHms(onBreak ? breakRemainingSecs : remainingSecs)}
                </div>
                <span className="mt-1 max-w-[144px] truncate font-mono text-[11px] tabular-nums text-cyan-700 dark:text-cyan-400">
                  {Math.round(progressRatio * 100)}% · {activeSessionLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Controls, Presets, Ambient Noise & Session Stats */}
          <div className="space-y-5 lg:col-span-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Schedule &amp; Deep Focus Engine
                </h1>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Drift-corrected precision timer with Regain-style motivational alarms, calls-only filter, and Meditation Strict Mode.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1 font-mono text-amber-600 tabular-nums dark:text-amber-400">
                  <Flame className="h-3.5 w-3.5" />
                  {streakDays}d streak
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {minutesStudiedToday + Math.floor(elapsedThisSessionSecs / 60)}m today
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{sessionsCompleted} done</span>
              </div>
            </div>

            {/* Duration Presets */}
            <div className="flex flex-wrap items-center gap-2">
              {[25, 45, 60, 90].map((mins) => {
                const isSelected = targetDurationSecs === mins * 60 && !running;
                return (
                  <button
                    key={mins}
                    type="button"
                    disabled={running}
                    onClick={() => {
                      setTargetDurationSecs(mins * 60);
                      setRemainingSecs(mins * 60);
                      setActiveSessionLabel(`${mins}-Min Focus Block`);
                    }}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-semibold tabular-nums transition-colors disabled:opacity-50 ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-300'
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}

              <div className="flex items-center gap-1.5 pl-1">
                <label htmlFor="schedule-custom-mins" className="text-xs text-slate-500 dark:text-slate-400">
                  Custom:
                </label>
                <input
                  id="schedule-custom-mins"
                  type="number"
                  min={1}
                  max={360}
                  disabled={running}
                  value={Math.max(1, Math.round(targetDurationSecs / 60))}
                  onChange={(e) => {
                    const mins = Math.max(1, Math.min(360, Number(e.target.value) || 25));
                    setTargetDurationSecs(mins * 60);
                    setRemainingSecs(mins * 60);
                  }}
                  className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-xs tabular-nums text-slate-900 dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                />
                <span className="text-xs text-slate-500">min</span>
              </div>
            </div>

            {/* Primary Timer Action Bar */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                data-testid="timer-start-pause-btn"
                onClick={() => void handlePauseResume()}
                className="cosmo-btn-primary inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
              >
                {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {running
                  ? 'Pause Session'
                  : strictSettings.enabled
                    ? 'Start Strict Session'
                    : 'Start Study Session'}
              </button>

              <button
                type="button"
                data-testid="launch-strict-now-btn"
                onClick={() =>
                  void startFocusSession({
                    durationSecs: remainingSecs > 0 ? remainingSecs : targetDurationSecs,
                    label: activeSessionLabel,
                    engageStrict: true,
                    engageFilter: filterEnabled,
                  })
                }
                className="cosmo-btn-secondary inline-flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-500/20 whitespace-nowrap dark:text-cyan-300"
              >
                <Lock className="h-3.5 w-3.5" />
                Enter Meditation Strict Mode
              </button>

              <button
                type="button"
                onClick={handleResetTimer}
                aria-label="Reset schedule timer"
                className="cosmo-btn-secondary inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>

            {/* Ambient Focus Soundscape Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                {soundscape === 'off' ? (
                  <VolumeX className="h-4 w-4 text-slate-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-cyan-500" />
                )}
                <span>Focus Soundscape</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'off', label: 'Silent' },
                    { id: 'lofi', label: 'Lo-Fi' },
                    { id: 'rain', label: 'Rain' },
                    { id: 'brown_noise', label: 'Brown Noise' },
                    { id: 'binaural40', label: '40Hz Gamma' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSoundscape(s.id)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      soundscape === s.id
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. SCHEDULE CORE (Regain-Style Alarm): From-To HH:MM:SS Picker + Live Analog & Digital Clock Beside It */}
      <section className="cosmo-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
              <CalendarClock className="h-4 w-4" />
              <span>Regain-Style Study Alarm Scheduler</span>
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-slate-900 dark:text-white">
              Schedule Your Study Window (From – To)
            </h2>
          </div>

          <button
            type="button"
            data-testid="preview-alarm-overlay-btn"
            onClick={() =>
              triggerAlarmOverlay({
                id: 'preview-alarm',
                label: formLabel.trim() || 'Scheduled Study Block',
                startTime: formStartTime,
                endTime: formEndTime,
                enabled: true,
                tone: formTone,
                volume: formVolume,
                strictModeOnStart: formStrictOnStart,
                notificationFilterOnStart: formFilterOnStart,
                nextTriggerAt: Date.now(),
                createdAt: new Date().toISOString(),
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-500/20 whitespace-nowrap dark:text-amber-300"
          >
            <BellRing className="h-3.5 w-3.5" />
            Preview Alarm Screen
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
          {/* Left 7 cols: From-To HH:MM:SS Controls + 6 WebAudio Tones */}
          <form onSubmit={handleSaveAlarm} className="space-y-4 lg:col-span-7">
            <div>
              <label htmlFor="schedule-label" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Session Name
              </label>
              <input
                id="schedule-label"
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g., Organic Chemistry Sprint, Morning DSA Lock-In"
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
              />
            </div>

            {/* From -> To HH:MM:SS Inputs */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="schedule-from-time" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  From Time (HH:MM:SS)
                </label>
                <input
                  id="schedule-from-time"
                  data-testid="schedule-from-input"
                  type="time"
                  step="1"
                  required
                  value={formStartTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormStartTime(v.length === 5 ? `${v}:00` : v);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm tabular-nums text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                />
              </div>
              <div>
                <label htmlFor="schedule-to-time" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  To Time (HH:MM:SS)
                </label>
                <input
                  id="schedule-to-time"
                  data-testid="schedule-to-input"
                  type="time"
                  step="1"
                  required
                  value={formEndTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormEndTime(v.length === 5 ? `${v}:00` : v);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm tabular-nums text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
                />
              </div>
            </div>

            {/* Quick Time Offset Helpers */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400">Quick Start:</span>
              {[
                { label: 'In 1 Min (45m block)', offsetSecs: 60, durSecs: 45 * 60 },
                { label: 'In 5 Min (60m block)', offsetSecs: 300, durSecs: 60 * 60 },
                { label: 'In 15 Min (90m block)', offsetSecs: 900, durSecs: 90 * 60 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const base = new Date();
                    setFormStartTime(addSecondsToClock(base, preset.offsetSecs));
                    setFormEndTime(addSecondsToClock(base, preset.offsetSecs + preset.durSecs));
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700 hover:border-cyan-500 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-300"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* 6 Built-in WebAudio Alarm Tones + Volume */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Built-In Alarm Music (6 WebAudio Tones · 100% Free)
                </span>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <label htmlFor="schedule-tone-volume">Vol {Math.round(formVolume * 100)}%</label>
                  <input
                    id="schedule-tone-volume"
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={formVolume}
                    onChange={(e) => setFormVolume(Number(e.target.value))}
                    className="h-1.5 w-24 accent-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ALARM_TONES.map((tone) => {
                  const active = formTone === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => {
                        setFormTone(tone.id);
                        cosmolibAudio.previewTone(tone.id, formVolume);
                      }}
                      className={`rounded-lg border p-2.5 text-left transition-colors ${
                        active
                          ? 'border-cyan-500 bg-cyan-500/10 text-slate-900 dark:text-white'
                          : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-xs font-semibold">
                        <span className="truncate">{tone.name}</span>
                        <Volume2 className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-cyan-500' : 'text-slate-400'}`} />
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                        {tone.vibe}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto-Engage Options */}
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-[#0B0F19]">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Auto-Lock Meditation Strict Mode
                </span>
                <input
                  type="checkbox"
                  checked={formStrictOnStart}
                  onChange={(e) => setFormStrictOnStart(e.target.checked)}
                  className="h-4 w-4 accent-cyan-500"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs dark:border-slate-800 dark:bg-[#0B0F19]">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Enforce Calls-Only Filter on Start
                </span>
                <input
                  type="checkbox"
                  checked={formFilterOnStart}
                  onChange={(e) => setFormFilterOnStart(e.target.checked)}
                  className="h-4 w-4 accent-cyan-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="submit"
                data-testid="save-schedule-btn"
                className="cosmo-btn-primary inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                {editingAlarmId ? 'Update Schedule Alarm' : 'Add Schedule Alarm'}
              </button>
              {editingAlarmId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingAlarmId(null);
                    setFormNotice(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel Edit
                </button>
              )}
              {formNotice && (
                <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">
                  {formNotice}
                </span>
              )}
            </div>
          </form>

          {/* Right 5 cols: Live Analog + Digital HH:MM:SS Clock Preview beside inputs */}
          <div className="lg:col-span-5">
            <LiveClockPreview now={now} startTime={formStartTime} endTime={formEndTime} />
          </div>
        </div>

        {/* Upcoming Scheduled Alarms List */}
        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Upcoming Study Schedules ({alarms.length})
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Synced locally &amp; timezone-safe across reloads
            </span>
          </div>

          {alarms.length === 0 ? (
            <div className="mt-4">
              <EmptyStateCard
                illustration="schedule"
                title="No study alarms scheduled yet"
                description="Choose your From–To window above, pick one of 6 built-in WebAudio tones, and add a Regain-style motivational study alarm."
                actionLabel="Quick-Fill 1-Min Alarm"
                onAction={() => {
                  const base = new Date();
                  setFormStartTime(addSecondsToClock(base, 60));
                  setFormEndTime(addSecondsToClock(base, 60 + 45 * 60));
                  setFormNotice('Pre-filled a 45m study window starting in 1 minute — click Add Schedule Alarm.');
                }}
              />
            </div>
          ) : (
            <div data-testid="upcoming-alarms-list" className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              {alarms.map((alarm) => {
                const secsLeft = Math.max(0, Math.floor((alarm.nextTriggerAt - now.getTime()) / 1000));
                const toneName = ALARM_TONES.find((t) => t.id === alarm.tone)?.name || alarm.tone;
                return (
                  <div
                    key={alarm.id}
                    data-alarm-id={alarm.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {alarm.label}
                        </span>
                        <span className="font-mono text-xs font-semibold tabular-nums text-cyan-700 dark:text-cyan-400">
                          {alarm.startTime} – {alarm.endTime}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{toneName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{alarm.strictModeOnStart ? 'Meditation Strict ON' : 'Flexible Focus'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {alarm.enabled ? `Rings in ${formatDurationHms(secsLeft)}` : 'Paused'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => triggerAlarmOverlay(alarm)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Bell className="h-3.5 w-3.5 text-amber-500" />
                        Ring Now
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEditAlarm(alarm)}
                        aria-label={`Edit ${alarm.label}`}
                        className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAlarm(alarm.id)}
                        aria-label={`Delete ${alarm.label}`}
                        className="rounded-md border border-slate-200 p-1.5 text-rose-600 hover:bg-rose-500/10 dark:border-slate-700 dark:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        role="switch"
                        aria-checked={alarm.enabled}
                        aria-label={`Toggle ${alarm.label}`}
                        onClick={() => handleToggleAlarmEnabled(alarm.id)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                          alarm.enabled ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white shadow-xs transition-transform ${
                            alarm.enabled ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3. TWO-OPTION CONTROL DECK BELOW SCHEDULE: Notification/Call Filter + Meditation Strict Mode */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Option 1 (8 cols): 2-Column Allowed vs Blocked Notification & Call Filter */}
        <div className="xl:col-span-8">
          <NotificationFilterPanel
            enabled={filterEnabled}
            onToggleEnabled={setFilterEnabled}
            allowMap={allowMap}
            onToggleApp={(appId) => setAllowMap((prev) => toggleAppAllowed(prev, appId))}
            onResetDefault={() => setAllowMap(buildDefaultAllowMap())}
            notificationPermission={notifPermission}
            onRequestNotificationPermission={() => void handleRequestNotifPermission()}
            attemptLogs={attemptLogs}
            onSimulateIncoming={handleSimulateIncoming}
            onClearLogs={() => setAttemptLogs([])}
          />
        </div>

        {/* Option 2 (4 cols): Meditation Strict Mode & Home Screen ON/OFF Control */}
        <section
          data-testid="meditation-strict-card"
          className="cosmo-card flex flex-col justify-between p-5 sm:p-6 xl:col-span-4"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Meditation Strict Mode
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Locks the viewport in fullscreen with anti-exit hold guard, tab-switch penalty log, and optional 4-digit exit PIN.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={strictSettings.enabled}
                aria-label="Enable Meditation Strict Mode"
                onClick={() =>
                  setStrictSettings((prev) => ({ ...prev, enabled: !prev.enabled }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  strictSettings.enabled ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    strictSettings.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Special Toggle: Home Screen ON/OFF directly under Meditation Mode */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/35 bg-cyan-500/[0.05] p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                  {strictSettings.homeScreenVisible ? (
                    <Eye className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  )}
                  <span>Home Screen Visibility</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                  {strictSettings.homeScreenVisible
                    ? 'ON: Shows ambient noise, break controls, and guard logs inside strict mode.'
                    : 'OFF: Minimalist black screen with only the countdown clock and calm motivational quote.'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={strictSettings.homeScreenVisible}
                aria-label="Toggle Home Screen visibility under Meditation Strict Mode"
                data-testid="card-homescreen-toggle"
                onClick={() =>
                  setStrictSettings((prev) => ({
                    ...prev,
                    homeScreenVisible: !prev.homeScreenVisible,
                  }))
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  strictSettings.homeScreenVisible ? 'bg-cyan-500' : 'bg-slate-400 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    strictSettings.homeScreenVisible ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Tab-Switch Penalty Toggle */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-[#0B0F19]">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                  <span>Tab-Switch Penalty (+30s &amp; Blur Return Lock)</span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Logs every tab leave, dims the screen, and adds +30s to your study block.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={strictSettings.tabSwitchPenaltyEnabled}
                aria-label="Toggle tab switch penalty"
                onClick={() =>
                  setStrictSettings((prev) => ({
                    ...prev,
                    tabSwitchPenaltyEnabled: !prev.tabSwitchPenaltyEnabled,
                  }))
                }
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                  strictSettings.tabSwitchPenaltyEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 translate-y-0.5 rounded-full bg-white transition-transform ${
                    strictSettings.tabSwitchPenaltyEnabled ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* 4-Digit Exit PIN + Pomodoro Cadence */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-[#0B0F19]">
                <label
                  htmlFor="strict-pin-setting"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <KeyRound className="h-3.5 w-3.5 text-indigo-500" />
                  4-Digit Exit PIN (Optional)
                </label>
                <input
                  id="strict-pin-setting"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={strictSettings.exitPin}
                  onChange={(e) =>
                    setStrictSettings((prev) => ({
                      ...prev,
                      exitPin: e.target.value.replace(/\D/g, '').slice(0, 4),
                    }))
                  }
                  placeholder="No PIN set"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs tracking-widest text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                />
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-[#0B0F19]">
                <label
                  htmlFor="strict-pomodoro-cadence"
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  <Coffee className="h-3.5 w-3.5 text-emerald-500" />
                  Pomodoro 5m Break
                </label>
                <select
                  id="strict-pomodoro-cadence"
                  value={strictSettings.pomodoroBreakEveryMins}
                  onChange={(e) =>
                    setStrictSettings((prev) => ({
                      ...prev,
                      pomodoroBreakEveryMins: Number(e.target.value),
                    }))
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#111827] dark:text-white"
                >
                  <option value={25}>Every 25 min</option>
                  <option value={30}>Every 30 min</option>
                  <option value={50}>Every 50 min</option>
                  <option value={90}>Every 90 min</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={() =>
                void startFocusSession({
                  durationSecs: remainingSecs > 0 ? remainingSecs : targetDurationSecs,
                  label: activeSessionLabel,
                  engageStrict: true,
                  engageFilter: filterEnabled,
                })
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              <Lock className="h-4 w-4" />
              Launch Meditation Strict Session Now
            </button>
          </div>
        </section>
      </div>

      {/* Fullscreen Regain-Style Alarm Overlay */}
      {ringingAlarm && (
        <RegainAlarmOverlay
          alarm={ringingAlarm}
          now={now}
          streakDays={streakDays}
          volume={ringVolume}
          muted={ringMuted}
          onVolumeChange={(v) => {
            setRingVolume(v);
            setRingMuted(v <= 0);
            if (v <= 0) {
              cosmolibAudio.stopAlarmLoop();
            } else {
              if (!cosmolibAudio.isAlarmPlaying()) {
                cosmolibAudio.startAlarmLoop(ringingAlarm.tone, v);
              } else {
                cosmolibAudio.updateAlarmVolume(v);
              }
            }
          }}
          onToggleMute={() => {
            if (ringMuted) {
              setRingMuted(false);
              cosmolibAudio.startAlarmLoop(ringingAlarm.tone, Math.max(0.2, ringVolume));
            } else {
              setRingMuted(true);
              cosmolibAudio.stopAlarmLoop();
            }
          }}
          onAwakeStartStudy={handleAlarmAwakeStartStudy}
          onSnooze5Min={handleAlarmSnooze5Min}
          onDismiss={handleAlarmDismiss}
        />
      )}

      {/* Fullscreen Meditation Strict Mode Lock Overlay */}
      {(strictOverlayActive || isUltraBlockActive) && running && (
        <MeditationStrictOverlay
          sessionLabel={activeSessionLabel}
          remainingSecs={remainingSecs}
          totalSecs={targetDurationSecs}
          onBreak={onBreak}
          breakRemainingSecs={breakRemainingSecs}
          settings={strictSettings}
          onToggleHomeScreen={(visible) => {
            setStrictSettings((prev) => ({ ...prev, homeScreenVisible: visible }));
            void syncCapacitorStrictLock(true, !visible);
          }}
          soundscape={soundscape}
          onChangeSoundscape={setSoundscape}
          onSkipBreak={() => {
            breakEndTimestampRef.current = null;
            setOnBreak(false);
            endTimestampRef.current = Date.now() + remainingSecs * 1000;
            sessionStartWallRef.current = Date.now();
          }}
          onAddPenaltySeconds={handleAddPenaltySeconds}
          onPenaltyPauseChange={handlePenaltyPauseChange}
          penaltyPaused={penaltyPaused}
          onAuthorizedExit={handleAuthorizedStrictExit}
        />
      )}

      {/* Non-intrusive Bottom-Right In-App Guard Feedback Toast */}
      {suppressedToast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="schedule-guard-toast"
          className={`fixed bottom-5 right-5 z-50 flex max-w-xs items-center gap-3 rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur-md ${
            suppressedToast.outcome === 'blocked'
              ? 'border-rose-500/40 bg-[#0D1324]/95 text-rose-200'
              : 'border-emerald-500/40 bg-[#0D1324]/95 text-emerald-200'
          }`}
        >
          <span className="min-w-0 flex-1 leading-snug">
            {suppressedToast.outcome === 'blocked'
              ? `Blocked by Schedule · ${suppressedToast.appName} suppressed`
              : `Allowed Call/Alert · ${suppressedToast.appName} passed through`}
          </span>
          <button
            type="button"
            onClick={() => setSuppressedToast(null)}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
