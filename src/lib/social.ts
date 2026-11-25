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

export async function fetchGroupMembers(groupId: string, onlineIds: string[], myId: string): Promise<RoomMember[]> {
  if (!supabase || !groupId) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, streak_days, branch, institution, last_seen')
    .contains('joined_group_ids', [groupId])
    .limit(100);
  if (error || !Array.isArray(data)) return [];
  const online = new Set(onlineIds);
  const members: RoomMember[] = (data as any[]).map((p) => ({
    id: String(p.id || ''),
    name: String(p.display_name || 'Cosmo Scholar'),
    streakDays: Number(p.streak_days || 0),
    branch: String(p.branch || ''),
    institution: String(p.institution || ''),
    online: online.has(String(p.id || '')),
    lastSeen: (p.last_seen as string | null) || null,
  })).filter((m) => m.id && m.id !== myId);
  members.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return String(b.lastSeen || '').localeCompare(String(a.lastSeen || ''));
  });
  return members;
}

export async function heartbeat(userId: string, isLive: boolean): Promise<void> {
  if (!supabase || !userId) return;
  try {
    await supabase.from('profiles').update({ last_seen: new Date().toISOString(), is_live: isLive }).eq('id', userId);
  } catch { /* best-effort presence */ }
}

export type FollowState = 'none' | 'requested' | 'following' | 'followback' | 'mutual';

export async function getFollowState(myId: string, otherId: string): Promise<FollowState> {
  if (!supabase || !myId || !otherId || myId === otherId) return 'none';
  try {
    const { data } = await supabase.from('follows').select('follower_id,status').or(`and(follower_id.eq.${myId},followee_id.eq.${otherId}),and(follower_id.eq.${otherId},followee_id.eq.${myId})`);
    const rows = (Array.isArray(data) ? data : []) as { follower_id: string; status: string }[];
    const mine = rows.find((r) => r.follower_id === myId);
    const theirs = rows.find((r) => r.follower_id === otherId);
    const mineOk = mine?.status === 'accepted';
    const theirsOk = theirs?.status === 'accepted';
    if (mineOk && theirsOk) return 'mutual';
    if (mine && mine.status === 'pending') return 'requested';
    if (mineOk) return 'following';
    if (theirs && theirs.status === 'pending') return 'followback';
    if (theirsOk) return 'followback';
    return 'none';
  } catch { return 'none'; }
}

// __PART3__
