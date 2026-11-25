import { supabase } from './supabase';
import type { DirectMessage, FollowEdge, NotificationItem, RoomMember } from '../types';

export type { DirectMessage, FollowEdge, NotificationItem, RoomMember };

export const CHAT_THEMES = [
  { id: 'default', name: 'Cosmo Default', own: 'bg-indigo-600 text-white' },
  { id: 'sunset', name: 'Sunset Reel', own: 'bg-gradient-to-br from-amber-500 via-rose-500 to-purple-600 text-white' },
  { id: 'ocean', name: 'Ocean Wave', own: 'bg-gradient-to-br from-cyan-500 to-blue-700 text-white' },
  { id: 'forest', name: 'Midnight Mono', own: 'bg-slate-900 text-white dark:bg-cyan-400 dark:text-slate-900' },
] as const;

export type ChatThemeId = (typeof CHAT_THEMES)[number]['id'];

export function themeFor(id: string | null | undefined) {
  return CHAT_THEMES.find((t) => t.id === id) || CHAT_THEMES[0];
}

export function themeKey(ownerId: string, convoId: string): string {
  return `cosmolib_chat_theme_${ownerId}_${convoId}`;
}

export function loadTheme(ownerId: string, convoId: string): ChatThemeId {
  try {
    const v = localStorage.getItem(themeKey(ownerId, convoId));
    if (v === 'sunset' || v === 'ocean' || v === 'forest') return v;
  } catch { /* ignore */ }
  return 'default';
}

export function saveTheme(ownerId: string, convoId: string, theme: ChatThemeId): void {
  try {
    localStorage.setItem(themeKey(ownerId, convoId), theme);
  } catch { /* ignore */ }
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'new here';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'recently';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `active ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `active ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `active ${days}d ago`;
  return 'active a while ago';
}

export function formatClock(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

// __PART2__
