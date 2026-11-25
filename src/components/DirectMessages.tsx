import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCheck, MessageCircle, Palette, Reply, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { DirectMessage, RoomMember } from '../types';
import { canChatWith, formatClock, listConversations, listDMs, loadTheme, saveTheme, sendDM, themeFor, type ChatThemeId, type ConversationPreview, CHAT_THEMES } from '../lib/social';

interface DMProps {
  myId: string;
  myName: string;
  peer: RoomMember | null;
  onPeerChange: (peer: RoomMember | null) => void;
}

export const DirectMessages: React.FC<DMProps> = ({ myId, myName, peer, onPeerChange }) => {
  const [convos, setConvos] = useState<ConversationPreview[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
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
    const ch = supabase.channel(`dm-${myId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, () => { void refresh(); }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [myId]);
  if (!peer) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">Messages</h2>
          <MessageCircle className="h-4 w-4 text-slate-400" />
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

// __THREAD__
