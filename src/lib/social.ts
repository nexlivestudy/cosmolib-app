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

export type FollowStatus = 'none' | 'requested' | 'following' | 'followback' | 'mutual';

export async function getFollowStatus(myId: string, otherId: string): Promise<FollowStatus> {
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

export async function sendFollowRequest(myId: string, myName: string, themId: string): Promise<boolean> {
  if (!supabase || !myId || !themId || myId === themId) return false;
  const safeName = myName.slice(0, 60) || 'A scholar';
  try {
    const { error } = await supabase.from('follows').upsert(
      { follower_id: myId, followee_id: themId, status: 'pending' },
      { onConflict: 'follower_id,followee_id' }
    );
    if (error) return false;
    await supabase.from('notifications').insert({
      user_id: themId,
      type: 'follow_request',
      title: 'New follow request',
      body: `${safeName} wants to connect with you.`,
      actor_id: myId,
      actor_name: safeName,
    });
    return true;
  } catch { return false; }
}

export async function respondFollowRequest(edgeId: string, accept: boolean, requesterId: string, requesterName: string, myId: string, myName: string): Promise<boolean> {
  if (!supabase || !edgeId) return false;
  try {
    const { error } = await supabase.from('follows').update({ status: accept ? 'accepted' : 'declined' }).eq('id', edgeId);
    if (error) return false;
    if (accept) {
      await supabase.from('notifications').insert({
        user_id: requesterId,
        type: 'follow_accepted',
        title: 'Follow request accepted',
        body: `${myName || 'A scholar'} accepted your follow request. You can now chat.`,
        actor_id: myId,
        actor_name: myName || 'A scholar',
      });
    }
    void requesterName;
    return true;
  } catch { return false; }
}

export async function removeFollow(myId: string, otherId: string): Promise<boolean> {
  if (!supabase || !myId || !otherId) return false;
  try {
    await supabase.from('follows').delete().eq('follower_id', myId).eq('followee_id', otherId);
    await supabase.from('follows').delete().eq('follower_id', otherId).eq('followee_id', myId);
    return true;
  } catch { return false; }
}

export async function listNotifications(userId: string, limit = 30): Promise<NotificationItem[]> {
  if (!supabase || !userId) return [];
  try {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return (Array.isArray(data) ? data : []) as NotificationItem[];
  } catch { return []; }
}

export async function markNotificationsRead(userId: string): Promise<void> {
  if (!supabase || !userId) return;
  try {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
  } catch { /* ignore */ }
}

export async function canChatWith(myId: string, peerId: string): Promise<boolean> {
  if (!supabase || !myId || !peerId || myId === peerId) return false;
  try {
    const { data } = await supabase.from('follows').select('status').or(`and(follower_id.eq.${myId},followee_id.eq.${peerId},status.eq.accepted),and(follower_id.eq.${peerId},followee_id.eq.${myId},status.eq.accepted)`).limit(1);
    return Array.isArray(data) && data.length > 0;
  } catch { return false; }
}

export interface ConversationPreview {
  peerId: string;
  peerName: string;
  lastText: string;
  lastAt: string;
  unread: number;
  connected: boolean;
}

export async function listConversations(myId: string, myName: string): Promise<ConversationPreview[]> {
  if (!supabase || !myId) return [];
  try {
    const { data: edges } = await supabase.from('follows').select('follower_id,followee_id,status').or(`follower_id.eq.${myId},followee_id.eq.${myId}`).eq('status', 'accepted');
    const peerIds = new Set<string>();
    (Array.isArray(edges) ? edges : []).forEach((e: any) => {
      const other = e.follower_id === myId ? e.followee_id : e.follower_id;
      if (other && other !== myId) peerIds.add(String(other));
    });
    const { data: msgs } = await supabase.from('direct_messages').select('sender_id,receiver_id,content,created_at').or(`sender_id.eq.${myId},receiver_id.eq.${myId}`).order('created_at', { ascending: false }).limit(200);
    const byPeer = new Map<string, { lastText: string; lastAt: string; unread: number }>();
    (Array.isArray(msgs) ? msgs : []).forEach((m: any) => {
      const other = String(m.sender_id === myId ? m.receiver_id : m.sender_id);
      if (!other || other === myId || other === 'undefined') return;
      peerIds.add(other);
      const cur = byPeer.get(other);
      if (!cur) {
        byPeer.set(other, { lastText: String(m.content || '').slice(0, 80), lastAt: String(m.created_at || ''), unread: m.sender_id !== myId ? 1 : 0 });
      } else if (m.sender_id !== myId) {
        cur.unread += 1;
      }
    });
    if (peerIds.size === 0) return [];
    const { data: profiles } = await supabase.from('profiles').select('id,display_name').in('id', [...peerIds]);
    const names = new Map<string, string>();
    (Array.isArray(profiles) ? profiles : []).forEach((p: any) => names.set(String(p.id), String(p.display_name || 'Cosmo Scholar')));
    void myName;
    return [...peerIds].map((pid) => {
      const info = byPeer.get(pid) || { lastText: 'Say hello to start chatting.', lastAt: '', unread: 0 };
      return { peerId: pid, peerName: names.get(pid) || 'Cosmo Scholar', ...info, connected: true };
    }).sort((a, b) => String(b.lastAt || '').localeCompare(String(a.lastAt || '')));
  } catch { return []; }
}

export async function listDMs(myId: string, peerId: string, limit = 60): Promise<DirectMessage[]> {
  if (!supabase || !myId || !peerId) return [];
  try {
    const { data } = await supabase.from('direct_messages').select('*').or(`and(sender_id.eq.${myId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${myId})`).order('created_at', { ascending: true }).limit(limit);
    return (Array.isArray(data) ? data : []) as DirectMessage[];
  } catch { return []; }
}

export async function sendDM(senderId: string, receiverId: string, rawText: string): Promise<DirectMessage | null> {
  const text = (rawText || '').trim().slice(0, 1000);
  if (!supabase || !senderId || !receiverId || !text) return null;
  const ok = await canChatWith(senderId, receiverId);
  if (!ok) return null;
  try {
    const { data, error } = await supabase.from('direct_messages').insert({ sender_id: senderId, receiver_id: receiverId, content: text }).select().single();
    if (error || !data) return null;
    return data as DirectMessage;
  } catch { return null; }
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  if (!supabase || !userId) return { followers: 0, following: 0 };
  try {
    const [a, b] = await Promise.all([
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('followee_id', userId).eq('status', 'accepted'),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
    ]);
    return { followers: a.count || 0, following: b.count || 0 };
  } catch { return { followers: 0, following: 0 }; }
}

export async function answerFollowByUsers(myId: string, requesterId: string, accept: boolean, myName: string): Promise<boolean> {
  if (!supabase || !myId || !requesterId) return false;
  try {
    const { data } = await supabase.from('follows').select('id').eq('follower_id', requesterId).eq('followee_id', myId).eq('status', 'pending').limit(1);
    const edge = (Array.isArray(data) ? data[0] : null) as { id: string } | null;
    if (!edge?.id) return false;
    return respondFollowRequest(edge.id, accept, requesterId, '', myId, myName);
  } catch { return false; }
}

export interface ProfilePost {
  id: string;
  user_id: string;
  caption: string;
  image_url: string | null;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  streakDays: number;
  branch: string;
  institution: string;
  online: boolean;
  lastSeen: string | null;
}

export async function getPublicProfile(userId: string, onlineIds: string[] = []): Promise<PublicProfile | null> {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name, bio, avatar_url, streak_days, branch, institution, last_seen')
      .eq('id', userId)
      .maybeSingle();
    if (error || !data) return null;
    const p = data as Record<string, unknown>;
    return {
      id: String(p.id || userId),
      name: String(p.display_name || 'Cosmo Scholar'),
      bio: String(p.bio || ''),
      avatarUrl: (p.avatar_url as string | null) || null,
      streakDays: Number(p.streak_days || 0),
      branch: String(p.branch || ''),
      institution: String(p.institution || ''),
      online: onlineIds.includes(String(p.id || '')),
      lastSeen: (p.last_seen as string | null) || null,
    };
  } catch {
    return null;
  }
}

export async function updateMyProfile(
  userId: string,
  patch: { display_name?: string; bio?: string; avatar_url?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !userId) return { ok: false, error: 'Not signed in.' };
  const clean: Record<string, unknown> = {};
  if (patch.display_name !== undefined) {
    const n = patch.display_name.trim().slice(0, 60);
    if (!n) return { ok: false, error: 'Display name cannot be empty.' };
    clean.display_name = n;
  }
  if (patch.bio !== undefined) clean.bio = patch.bio.slice(0, 160);
  if (patch.avatar_url !== undefined) clean.avatar_url = patch.avatar_url;
  try {
    const { error } = await supabase.from('profiles').update(clean).eq('id', userId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Save failed.' };
  }
}

export async function listPosts(userId: string, limit = 24): Promise<ProfilePost[]> {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    return data as ProfilePost[];
  } catch {
    return [];
  }
}

export async function createPost(
  userId: string,
  caption: string,
  imageUrl: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !userId) return { ok: false, error: 'Not signed in.' };
  const text = (caption || '').trim().slice(0, 500);
  if (!text && !imageUrl) return { ok: false, error: 'Write a caption or add a photo.' };
  try {
    const { error } = await supabase
      .from('posts')
      .insert({ user_id: userId, caption: text, image_url: imageUrl });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Post failed.' };
  }
}

export async function deletePost(userId: string, postId: string): Promise<boolean> {
  if (!supabase || !userId || !postId) return false;
  try {
    const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
}

export interface FollowOp {
  ok: boolean;
  error?: string;
  state: FollowStatus;
}

export async function sendFollowRequestEx(
  myId: string,
  myName: string,
  themId: string
): Promise<FollowOp> {
  if (!supabase || !myId || !themId || myId === themId)
    return { ok: false, error: 'Invalid follow target.', state: 'none' };
  const safeName = myName.slice(0, 60) || 'A scholar';
  try {
    const { error } = await supabase.from('follows').upsert(
      { follower_id: myId, followee_id: themId, status: 'pending' },
      { onConflict: 'follower_id,followee_id' }
    );
    if (error) return { ok: false, error: error.message, state: 'none' };
    const { error: nerr } = await supabase.from('notifications').insert({
      user_id: themId,
      type: 'follow_request',
      title: 'New follow request',
      body: `${safeName} wants to connect with you.`,
      actor_id: myId,
      actor_name: safeName,
    });
    if (nerr) return { ok: true, error: 'Request sent, but the notification failed: ' + nerr.message, state: 'requested' };
    return { ok: true, state: 'requested' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Request failed.', state: 'none' };
  }
}

export async function withdrawFollowRequest(
  myId: string,
  themId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase || !myId || !themId) return { ok: false, error: 'Not signed in.' };
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', myId)
      .eq('followee_id', themId)
      .eq('status', 'pending');
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cancel failed.' };
  }
}

/* Offline-first DM layer (free: outbox + cache, no new services) */
export interface QueuedMessage {
  clientId: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  attempts: number;
}

function outboxKey(ownerId: string): string {
  return `cosmolib_dm_outbox_${ownerId}`;
}

function cacheKey(ownerId: string, peerId: string): string {
  return `cosmolib_dm_cache_${ownerId}_${peerId}`;
}

function convoCacheKey(ownerId: string): string {
  return `cosmolib_dm_convos_${ownerId}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full/blocked - cache is best-effort */
  }
}

export function loadOutbox(ownerId: string): QueuedMessage[] {
  const list = readJson<QueuedMessage[]>(outboxKey(ownerId), []);
  return Array.isArray(list) ? list : [];
}

function saveOutbox(ownerId: string, list: QueuedMessage[]): void {
  writeJson(outboxKey(ownerId), list.slice(-50));
}

export function queueOfflineMessage(senderId: string, receiverId: string, rawText: string): QueuedMessage | null {
  const text = (rawText || '').trim().slice(0, 1000);
  if (!senderId || !receiverId || !text) return null;
  const entry: QueuedMessage = {
    clientId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId,
    receiverId,
    content: text,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const list = loadOutbox(senderId);
  list.push(entry);
  saveOutbox(senderId, list);
  return entry;
}

function dropQueued(ownerId: string, clientId: string): void {
  saveOutbox(ownerId, loadOutbox(ownerId).filter((q) => q.clientId !== clientId));
}

function bumpAttempts(ownerId: string, clientId: string): void {
  saveOutbox(
    ownerId,
    loadOutbox(ownerId).map((q) => (q.clientId === clientId ? { ...q, attempts: q.attempts + 1 } : q))
  );
}

export async function flushOutbox(ownerId: string): Promise<number> {
  const pending = loadOutbox(ownerId);
  for (const q of pending) {
    if (!navigator.onLine) break;
    try {
      const sent = await sendDM(q.senderId, q.receiverId, q.content);
      if (sent) dropQueued(ownerId, q.clientId);
      else bumpAttempts(ownerId, q.clientId);
    } catch {
      bumpAttempts(ownerId, q.clientId);
    }
  }
  return loadOutbox(ownerId).length;
}

export function loadCachedThread(ownerId: string, peerId: string): DirectMessage[] {
  const list = readJson<DirectMessage[]>(cacheKey(ownerId, peerId), []);
  return Array.isArray(list) ? list : [];
}

export function saveCachedThread(ownerId: string, peerId: string, msgs: DirectMessage[]): void {
  writeJson(cacheKey(ownerId, peerId), msgs.slice(-200));
}

export function loadCachedConvos(ownerId: string): ConversationPreview[] {
  const list = readJson<ConversationPreview[]>(convoCacheKey(ownerId), []);
  return Array.isArray(list) ? list : [];
}

export function saveCachedConvos(ownerId: string, convos: ConversationPreview[]): void {
  writeJson(convoCacheKey(ownerId), convos.slice(0, 60));
}

export type DaySection =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; msg: DirectMessage };

export function dayLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  } catch {
    return '';
  }
}

export function sectionByDay(msgs: DirectMessage[]): DaySection[] {
  const out: DaySection[] = [];
  let lastDay = '';
  for (const m of msgs) {
    const day = (m.created_at || '').slice(0, 10);
    if (day && day !== lastDay) {
      lastDay = day;
      out.push({ kind: 'day', key: `day-${day}`, label: dayLabel(m.created_at) });
    }
    out.push({ kind: 'msg', key: m.id, msg: m });
  }
  return out;
}

export function threadDays(msgs: DirectMessage[]): { day: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const m of msgs) {
    const day = (m.created_at || '').slice(0, 10);
    if (day && !seen.has(day)) seen.set(day, dayLabel(m.created_at));
  }
  return [...seen.entries()].map(([day, label]) => ({ day, label }));
}

export async function listDMsSince(myId: string, peerId: string, sinceIso: string | null): Promise<DirectMessage[]> {
  if (!supabase || !myId || !peerId) return [];
  try {
    let q = supabase
      .from('direct_messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true })
      .limit(60);
    if (sinceIso) q = q.gt('created_at', sinceIso);
    const { data, error } = await q;
    if (error || !Array.isArray(data)) return [];
    return data as DirectMessage[];
  } catch {
    return [];
  }
}

/* Group-chat offline layer (same free pattern as DMs: outbox + cache + delta). */
export interface QueuedGroupMessage {
  clientId: string;
  senderId: string;
  groupId: string;
  authorName: string;
  authorStreak: number;
  content: string;
  replyToId?: string;
  createdAt: string;
  attempts: number;
}

function groupOutboxKey(ownerId: string): string {
  return `cosmolib_group_outbox_${ownerId}`;
}

function groupCacheKey(groupId: string): string {
  return `cosmolib_group_msgs_${groupId}`;
}

function groupFilesCacheKey(groupId: string): string {
  return `cosmolib_group_files_${groupId}`;
}

function dropQueuedGroup(ownerId: string, clientId: string): void {
  saveGroupOutbox(ownerId, loadGroupOutbox(ownerId).filter((q) => q.clientId !== clientId));
}

export function loadGroupOutbox(ownerId: string): QueuedGroupMessage[] {
  const list = readJson<QueuedGroupMessage[]>(groupOutboxKey(ownerId), []);
  return Array.isArray(list) ? list : [];
}

function saveGroupOutbox(ownerId: string, list: QueuedGroupMessage[]): void {
  writeJson(groupOutboxKey(ownerId), list.slice(-50));
}

export function queueGroupMessage(
  senderId: string,
  groupId: string,
  authorName: string,
  authorStreak: number,
  rawText: string,
  replyToId?: string
): QueuedGroupMessage | null {
  const text = (rawText || '').trim().slice(0, 1000);
  if (!senderId || !groupId || !text) return null;
  const entry: QueuedGroupMessage = {
    clientId: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    senderId,
    groupId,
    authorName: authorName.slice(0, 60),
    authorStreak,
    content: text,
    replyToId,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  const list = loadGroupOutbox(senderId);
  list.push(entry);
  saveGroupOutbox(senderId, list);
  return entry;
}

export async function flushGroupOutbox(ownerId: string): Promise<number> {
  const pending = loadGroupOutbox(ownerId);
  for (const q of pending) {
    if (!navigator.onLine) break;
    try {
      const { error } = await supabase.from('group_messages').insert({
        group_id: q.groupId,
        user_id: q.senderId,
        author_name: q.authorName,
        author_streak: q.authorStreak,
        content: q.content,
      });
      if (!error) dropQueuedGroup(ownerId, q.clientId);
    } catch {
    }
  }
  return loadGroupOutbox(ownerId).length;
}

export function loadCachedGroupMessages(groupId: string): import('../types').GroupMessage[] {
  const list = readJson<import('../types').GroupMessage[]>(groupCacheKey(groupId), []);
  return Array.isArray(list) ? list : [];
}

export function saveCachedGroupMessages(groupId: string, msgs: import('../types').GroupMessage[]): void {
  writeJson(groupCacheKey(groupId), msgs.slice(-120));
}

export function loadCachedGroupFiles(groupId: string): import('../types').GroupResourceItem[] {
  const list = readJson<import('../types').GroupResourceItem[]>(groupFilesCacheKey(groupId), []);
  return Array.isArray(list) ? list : [];
}
