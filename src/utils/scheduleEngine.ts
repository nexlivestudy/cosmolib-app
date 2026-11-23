export type AlarmToneId =
  | 'sunrise_bell'
  | 'temple_chime'
  | 'cyber_pulse'
  | 'deep_focus_chord'
  | 'zen_gong'
  | 'morning_arpeggio';

export type SoundscapeId = 'off' | 'lofi' | 'rain' | 'brown_noise' | 'binaural40';

export interface AlarmToneOption {
  id: AlarmToneId;
  name: string;
  vibe: string;
}

export const ALARM_TONES: AlarmToneOption[] = [
  { id: 'sunrise_bell', name: 'Sunrise Bell', vibe: 'Warm harmonic chime' },
  { id: 'temple_chime', name: 'Kyoto Chime', vibe: 'Pentatonic crystal' },
  { id: 'cyber_pulse', name: 'Precision Pulse', vibe: 'Crisp wake triad' },
  { id: 'deep_focus_chord', name: 'Focus Swell', vibe: 'Lush major-9th pad' },
  { id: 'zen_gong', name: 'Zen Gong', vibe: 'Resonant meditation bell' },
  { id: 'morning_arpeggio', name: 'Momentum Arp', vibe: 'Bright rising motif' },
];

export interface MotivationalQuote {
  text: string;
  author: string;
}

export const MOTIVATIONAL_QUOTES: MotivationalQuote[] = [
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'One focused hour beats five distracted hours every single day.', author: 'COSMOLIB Focus Doctrine' },
  { text: 'Start before you feel ready. Momentum is built after minute one.', author: 'Deep Work Principle' },
  { text: 'Silence the noise for the next block and let your results speak.', author: 'COSMOLIB Focus Doctrine' },
  { text: 'Small daily improvements over time lead to unstoppable mastery.', author: 'Robin Sharma' },
  { text: 'Protect your attention like your future depends on it—because it does.', author: 'Cal Newport' },
  { text: 'The pain of discipline weighs ounces; the pain of regret weighs tons.', author: 'Jim Rohn' },
  { text: 'Every page you master today is stress you eliminate before exam day.', author: 'COSMOLIB Exam Code' },
  { text: 'Do not negotiate with the snooze button. Honor the promise you made yourself.', author: 'COSMOLIB Focus Doctrine' },
  { text: 'Focus is a muscle: every resisted notification makes it stronger.', author: 'Neuroscience of Attention' },
  { text: 'Lock in now so your future self can walk into the exam room calm.', author: 'COSMOLIB Exam Code' },
  { text: 'Greatness is quiet. It happens at a desk when nobody is watching.', author: 'Deep Work Principle' },
  { text: 'Your streak is proof that you keep promises to yourself.', author: 'Habit Architecture' },
  { text: 'Clarity comes from action, not from staring at a feed.', author: 'Marie Forleo' },
  { text: 'Close every tab that does not move your score forward.', author: 'COSMOLIB Exam Code' },
  { text: 'Mastery is simply ordinary consistency stretched across weeks.', author: 'COSMOLIB Focus Doctrine' },
  { text: 'When the bell rings, begin immediately—five seconds of hesitation breaks flow.', author: 'Mel Robbins Principle' },
  { text: 'Depth is the superpower of the distracted century.', author: 'Cal Newport' },
  { text: 'Finish this block cleanly. You can check the world after the timer hits zero.', author: 'COSMOLIB Focus Doctrine' },
  { text: 'Excellence is not an act, but a scheduled habit.', author: 'Aristotle' },
  { text: 'Your dream score is hiding inside the study block you almost skipped.', author: 'COSMOLIB Exam Code' },
  { text: 'Stay in the chair until the concept clicks—breakthroughs happen past minute 20.', author: 'Deep Work Principle' },
  { text: 'Own the clock, or the scroll will own your day.', author: 'COSMOLIB Focus Doctrine' },
];

export interface AppFilterItem {
  id: string;
  name: string;
  category: 'Calls' | 'Messaging' | 'Social' | 'Media' | 'Productivity';
  defaultAllowed: boolean;
  description: string;
}

export const DEFAULT_FILTER_APPS: AppFilterItem[] = [
  {
    id: 'whatsapp_calls',
    name: 'WhatsApp Calls',
    category: 'Calls',
    defaultAllowed: true,
    description: 'Voice & video calls on WhatsApp (messages remain blocked)',
  },
  {
    id: 'normal_calls',
    name: 'Normal Phone Calls',
    category: 'Calls',
    defaultAllowed: true,
    description: 'Standard cellular voice calls & emergency contacts',
  },
  {
    id: 'whatsapp_messages',
    name: 'WhatsApp Messages',
    category: 'Messaging',
    defaultAllowed: false,
    description: 'Group chats, broadcasts, and text pings',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'Social',
    defaultAllowed: false,
    description: 'Reels, DMs, likes, and story alerts',
  },
  {
    id: 'youtube',
    name: 'YouTube Alerts',
    category: 'Media',
    defaultAllowed: false,
    description: 'Channel upload & recommendation notifications',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    category: 'Social',
    defaultAllowed: false,
    description: 'Snaps, streaks, and typing alerts',
  },
  {
    id: 'x_twitter',
    name: 'X (Twitter)',
    category: 'Social',
    defaultAllowed: false,
    description: 'Mentions, trending topics, and DMs',
  },
  {
    id: 'tiktok',
    name: 'TikTok / Shorts',
    category: 'Media',
    defaultAllowed: false,
    description: 'Short-form feed notifications',
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'Messaging',
    defaultAllowed: false,
    description: 'Server pings, @everyone, and DMs',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    category: 'Messaging',
    defaultAllowed: false,
    description: 'Channel posts and group notifications',
  },
  {
    id: 'reddit',
    name: 'Reddit',
    category: 'Social',
    defaultAllowed: false,
    description: 'Thread replies and trending posts',
  },
  {
    id: 'gmail',
    name: 'Gmail / Email',
    category: 'Productivity',
    defaultAllowed: false,
    description: 'Inbox promotions and non-urgent threads',
  },
  {
    id: 'slack',
    name: 'Slack / Teams',
    category: 'Productivity',
    defaultAllowed: false,
    description: 'Workspace channel notifications',
  },
  {
    id: 'facebook',
    name: 'Facebook / Messenger',
    category: 'Social',
    defaultAllowed: false,
    description: 'Social feed & chat heads',
  },
  {
    id: 'gaming_apps',
    name: 'Games & Live Streams',
    category: 'Media',
    defaultAllowed: false,
    description: 'Twitch, BGMI, Valorant, and game invites',
  },
  {
    id: 'cosmolib_pokes',
    name: 'COSMOLIB Buddy Pokes',
    category: 'Productivity',
    defaultAllowed: false,
    description: 'In-app study room pings and chat toasts',
  },
];

export type AllowMap = Record<string, boolean>;

export function buildDefaultAllowMap(): AllowMap {
  const map: AllowMap = {};
  for (const app of DEFAULT_FILTER_APPS) {
    map[app.id] = app.defaultAllowed;
  }
  return map;
}

export function isAppAllowed(appId: string, allowMap: AllowMap): boolean {
  return Boolean(allowMap[appId]);
}

export function toggleAppAllowed(allowMap: AllowMap, appId: string): AllowMap {
  return {
    ...allowMap,
    [appId]: !allowMap[appId],
  };
}

export function filterAppsByQuery(apps: AppFilterItem[], query: string): AppFilterItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return apps;
  return apps.filter(
    (app) =>
      app.name.toLowerCase().includes(q) ||
      app.category.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q)
  );
}

export interface BlockedAttemptLog {
  id: string;
  appId: string;
  appName: string;
  message: string;
  timestamp: number;
  outcome: 'blocked' | 'allowed';
}

export interface StrictModeSettings {
  enabled: boolean;
  homeScreenVisible: boolean;
  tabSwitchPenaltyEnabled: boolean;
  tabSwitchPenaltySecs: number;
  exitPin: string; // '' means no PIN required; 4 digits means PIN required
  pomodoroBreakEveryMins: number;
  pomodoroBreakDurationMins: number;
}

export const DEFAULT_STRICT_SETTINGS: StrictModeSettings = {
  enabled: true,
  homeScreenVisible: false,
  tabSwitchPenaltyEnabled: true,
  tabSwitchPenaltySecs: 30,
  exitPin: '',
  pomodoroBreakEveryMins: 30,
  pomodoroBreakDurationMins: 5,
};

export interface ScheduleAlarm {
  id: string;
  label: string;
  startTime: string; // HH:MM:SS (24-hour local)
  endTime: string; // HH:MM:SS (24-hour local)
  enabled: boolean;
  tone: AlarmToneId;
  volume: number; // 0.1 to 1.0
  strictModeOnStart: boolean;
  notificationFilterOnStart: boolean;
  nextTriggerAt: number; // epoch ms
  lastTriggeredAt?: number;
  createdAt: string;
}

export interface ParsedHms {
  hours: number;
  minutes: number;
  seconds: number;
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

export function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

export function parseHms(hms: string): ParsedHms {
  const parts = String(hms || '')
    .trim()
    .split(':')
    .map((p) => Number.parseInt(p, 10));
  return {
    hours: clampInt(parts[0] ?? 0, 0, 23),
    minutes: clampInt(parts[1] ?? 0, 0, 59),
    seconds: clampInt(parts[2] ?? 0, 0, 59),
  };
}

export function formatHms(hours: number, minutes: number, seconds: number): string {
  return `${pad2(clampInt(hours, 0, 23))}:${pad2(clampInt(minutes, 0, 59))}:${pad2(clampInt(seconds, 0, 59))}`;
}

export function formatClockFromDate(date: Date): string {
  return formatHms(date.getHours(), date.getMinutes(), date.getSeconds());
}

export function formatDurationHms(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/**
 * Compute session duration in seconds from startTime -> endTime (HH:MM:SS).
 * Supports overnight schedules (e.g., 23:30:00 -> 01:00:00 = 5400s).
 * Minimum duration is 60 seconds if start === end.
 */
export function computeScheduleDurationSeconds(startHms: string, endHms: string): number {
  const start = parseHms(startHms);
  const end = parseHms(endHms);
  const startTotal = start.hours * 3600 + start.minutes * 60 + start.seconds;
  const endTotal = end.hours * 3600 + end.minutes * 60 + end.seconds;
  let diff = endTotal - startTotal;
  if (diff <= 0) {
    diff += 24 * 3600;
  }
  return Math.max(60, diff);
}

/**
 * Compute the next local-timezone epoch timestamp (ms) when startHms should trigger.
 * Reload- and timezone-safe because it derives from local Date components.
 */
export function computeNextTriggerTimestamp(startHms: string, nowMs: number = Date.now()): number {
  const { hours, minutes, seconds } = parseHms(startHms);
  const target = new Date(nowMs);
  target.setHours(hours, minutes, seconds, 0);
  if (target.getTime() <= nowMs) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime();
}

/**
 * Determine if a saved schedule alarm is due to fire right now.
 * Allows a 60-second catch-up window after reload/tab-sleep while preventing double triggers.
 */
export function shouldTriggerAlarm(alarm: ScheduleAlarm, nowMs: number = Date.now()): boolean {
  if (!alarm.enabled) return false;
  if (!Number.isFinite(alarm.nextTriggerAt)) return false;
  const deltaMs = nowMs - alarm.nextTriggerAt;
  if (deltaMs < 0 || deltaMs > 60_000) return false;
  if (alarm.lastTriggeredAt && Math.abs(alarm.lastTriggeredAt - alarm.nextTriggerAt) < 60_000) {
    return false;
  }
  return true;
}

/**
 * Drift-corrected remaining seconds using monotonic wall-clock end timestamp.
 */
export function computeDriftCorrectedRemaining(endTimestampMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.ceil((endTimestampMs - nowMs) / 1000));
}

/**
 * Add offsetSeconds to a Date and return HH:MM:SS string.
 */
export function addSecondsToClock(date: Date, offsetSeconds: number): string {
  const next = new Date(date.getTime() + offsetSeconds * 1000);
  return formatClockFromDate(next);
}

/**
 * Free Capacitor Native Bridge Hook Layer.
 * Detects native Capacitor runtime when wrapped as an Android/iOS app for OS-level DND / App Blocking,
 * while gracefully falling back to browser Web Notification + in-app suppression on web.
 */
interface CapacitorWindow extends Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      CosmolibFocusGuard?: {
        applyNotificationFilter?: (opts: { allowedAppIds: string[]; blockedAppIds: string[] }) => Promise<void>;
        setStrictModeLock?: (opts: { active: boolean; homeScreenHidden: boolean }) => Promise<void>;
      };
    };
  };
}

export function isCapacitorNativeRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as CapacitorWindow).Capacitor?.isNativePlatform?.());
}

export async function syncCapacitorNativeFilter(allowMap: AllowMap): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const plugin = (window as CapacitorWindow).Capacitor?.Plugins?.CosmolibFocusGuard;
  if (!plugin?.applyNotificationFilter) return false;
  const allowedAppIds = Object.keys(allowMap).filter((id) => allowMap[id]);
  const blockedAppIds = Object.keys(allowMap).filter((id) => !allowMap[id]);
  await plugin.applyNotificationFilter({ allowedAppIds, blockedAppIds });
  return true;
}

export async function syncCapacitorStrictLock(active: boolean, homeScreenHidden: boolean): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const plugin = (window as CapacitorWindow).Capacitor?.Plugins?.CosmolibFocusGuard;
  if (!plugin?.setStrictModeLock) return false;
  await plugin.setStrictModeLock({ active, homeScreenHidden });
  return true;
}
