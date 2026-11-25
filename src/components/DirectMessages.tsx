import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, CheckCheck, MessageCircle, Palette, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DirectMessage, RoomMember } from '../types';
import { canChatWith, flushOutbox, formatClock, listConversations, listDMs, listDMsSince, loadCachedConvos, loadCachedThread, loadOutbox, loadTheme, queueOfflineMessage, saveCachedConvos, saveCachedThread, saveTheme, sectionByDay, sendDM, themeFor, threadDays, type ChatThemeId, type ConversationPreview, type QueuedMessage, CHAT_THEMES } from '../lib/social';

interface DMProps {
  myId: string;
  myName: string;
  peer: RoomMember | null;
  onPeerChange: (peer: RoomMember | null) => void;
}

export const DirectMessages: React.FC<DMProps> = ({ myId, myName, peer, onPeerChange }) => {
  const [convos, setConvos] = useState<ConversationPreview[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [liveFeed, setLiveFeed] = useState(true);
  const refresh = async () => {
    setLoadingConvos(true);
    try {
      const list = await listConversations(myId, myName);
      setConvos(list);
    } finally { setLoadingConvos(false); }
  };
  useEffect(() => { void refresh(); }, [myId]);
  useEffect(() => {
    if (!supabase || !myId) return;
    let subActive = true;
    const ch = supabase.channel(`dm-${myId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => { if (subActive) void refresh(); }).subscribe((status) => {
      if (subActive) setLiveFeed(status === 'SUBSCRIBED');
    });
    const poll = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 6000);
    return () => { subActive = false; window.clearInterval(poll); void supabase.removeChannel(ch); };
  }, [myId]);
  if (!peer) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Messages</h2>
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${liveFeed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} title={liveFeed ? 'Live updates on - new messages arrive instantly' : 'Live updates off - checking for new messages every few seconds'}>
            <span className={`h-1.5 w-1.5 rounded-full ${liveFeed ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            {liveFeed ? 'Live' : 'Checking...'}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Chats unlock after a follow is accepted.</p>
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {loadingConvos && <p className="py-4 text-center text-xs text-slate-500">Loading chats...</p>}
          {!loadingConvos && convos.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">No chats yet. Open a member profile, follow, and start talking once accepted.</p>
          )}
          {convos.map((c) => (
            <button key={c.peerId} type="button" onClick={() => onPeerChange({ id: c.peerId, name: c.peerName, streakDays: 0, branch: '', institution: '', online: false, lastSeen: null })} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white">{c.peerName.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">{c.peerName}</span>
                  {c.unread > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">{c.unread}</span>}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{c.lastText}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }
  return <DMThread key={peer.id} myId={myId} myName={myName} peer={peer} onBack={() => { onPeerChange(null); void refresh(); }} />;
};

const DMThread: React.FC<{ myId: string; myName: string; peer: RoomMember; onBack: () => void }> = ({ myId, peer, onBack }) => {
  const [msgs, setMsgs] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [reacts, setReacts] = useState<Record<string, Record<string, number>>>({});
  const [myReacts, setMyReacts] = useState<Record<string, string>>({});
  const [theme, setTheme] = useState<ChatThemeId>(() => loadTheme(myId, peer.id));
  const [showThemes, setShowThemes] = useState(false);
  const convoId = `${myId}_${peer.id}`;
  const [liveFeed, setLiveFeed] = useState(true);
  const pullLatest = async () => {
    try {
      const latest = await listDMs(myId, peer.id);
      if (latest.length === 0) return;
      setMsgs((prev) => {
        if (prev.length === 0) return latest;
        const known = new Set(prev.map((x) => x.id));
        const fresh = latest.filter((m) => !known.has(m.id));
        return fresh.length ? [...prev, ...fresh] : prev;
      });
    } catch { /* polling is best-effort */ }
  };
  useEffect(() => {
    let live = true;
    listDMs(myId, peer.id).then((m) => { if (live) setMsgs(m); }).catch(() => {});
    return () => { live = false; };
  }, [myId, peer.id]);
  useEffect(() => {
    if (!supabase || !myId) return;
    let subActive = true;
    const ch = supabase.channel(`dm-thread-${convoId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
      if (!subActive) return;
      const m = payload.new as DirectMessage;
      if ((m.sender_id === myId && m.receiver_id === peer.id) || (m.sender_id === peer.id && m.receiver_id === myId)) {
        setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      }
    }).subscribe((status) => {
      if (subActive) setLiveFeed(status === 'SUBSCRIBED');
    });
    const poll = window.setInterval(() => {
      if (!document.hidden) void pullLatest();
    }, 5000);
    return () => { subActive = false; window.clearInterval(poll); void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, peer.id, convoId]);
  const send = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput('');
    const sent = await sendDM(myId, peer.id, text);
    if (sent) setMsgs((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
  };
  const toggleReact = (msgId: string, emoji: string) => {
    setMyReacts((prev) => {
      const next = { ...prev };
      if (next[msgId] === emoji) delete next[msgId]; else next[msgId] = emoji;
      return next;
    });
    setReacts((prev) => {
      const cur = { ...(prev[msgId] || {}) };
      const had = myReacts[msgId] === emoji;
      cur[emoji] = Math.max(0, (cur[emoji] || (had ? 1 : 0)) + (had ? -1 : 1));
      return { ...prev, [msgId]: cur };
    });
  };
  const t = themeFor(theme);
  const pickTheme = (id: ChatThemeId) => { setTheme(id); saveTheme(myId, peer.id, id); setShowThemes(false); };
  return (
    <div className="flex h-[540px] flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
        <button type="button" onClick={onBack} aria-label="Back to messages" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white">{peer.name.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-slate-900 dark:text-white">{peer.name}</div>
          <div className={`text-[11px] font-medium ${liveFeed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {liveFeed ? 'Connected - chat unlocked' : 'Checking for new messages...'}
          </div>
        </div>
        <button type="button" onClick={() => setShowThemes((s) => !s)} aria-label="Chat theme" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <Palette className="h-4 w-4" />
        </button>
      </div>
      {showThemes && (
        <div className="flex gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
          {CHAT_THEMES.map((th) => (
            <button key={th.id} type="button" onClick={() => pickTheme(th.id)} title={th.name} className={`h-8 flex-1 rounded-lg text-[11px] font-semibold text-white ${theme === th.id ? 'ring-2 ring-cyan-500 ring-offset-1' : 'opacity-70 hover:opacity-100'} ${th.own.split(' ')[0]} ${th.own.split(' ')[1] || ''}`}>
              {theme === th.id ? 'Active' : th.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <p className="py-8 text-center text-xs text-slate-500">Say hello - this is the start of your chat with {peer.name}.</p>}
        {msgs.map((m) => {
          const mine = m.sender_id === myId;
          const mr = reacts[m.id] || {};
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? t.own : 'border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-100'}`}>
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <div className="mt-1 flex items-center gap-1.5">
                  {['\ud83d\ude0d', '\u2764\ufe0f', '\ud83d\ude02'].map((emoji) => {
                    const cnt = mr[emoji] || 0;
                    const active = myReacts[m.id] === emoji;
                    return (
                      <button key={emoji} type="button" onClick={() => toggleReact(m.id, emoji)} className={`rounded-full px-1 text-[11px] leading-none ${active ? 'bg-black/10 scale-110' : 'opacity-50 hover:opacity-100'}`}>{emoji}{cnt > 0 && <span className="ml-0.5 font-mono">{cnt}</span>}</button>
                    );
                  })}
                  <span className="ml-auto font-mono text-[10px] opacity-60 tabular-nums">{formatClock(m.created_at)}</span>
                  {mine && <CheckCheck className="h-3 w-3 opacity-60" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Message ${peer.name}...`} aria-label="Direct message" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white" />
        <button type="submit" aria-label="Send" className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-500">
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};
