import React, { useEffect, useRef, useState } from 'react';
import { Bell, Check, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import type { NotificationItem } from '../types';
import { answerFollowByUsers, listNotifications, markNotificationsRead } from '../lib/social';
import { useFitPanel } from '../hooks/useFitPanel';

interface Props {
  userId: string;
  userName: string;
  onChanged?: () => void;
}

export const NotificationsBell: React.FC<Props> = ({ userId, userName, onChanged }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const btnWrapRef = useRef<HTMLDivElement | null>(null);
  // App-wide rule: panel always fits the visible screen (bottom-sheet on phones).
  const fit = useFitPanel(btnWrapRef, open, { width: 340, height: 420 });
  useEffect(() => {
    if (!supabase || !userId) return;
    listNotifications(userId, 30).then(setItems).catch(() => {});
    const ch = supabase.channel(`notif-${userId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
      const row = payload.new as NotificationItem;
      setItems((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
    }).subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId]);
  const unread = items.filter((i) => !i.read).length;
  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      await markNotificationsRead(userId);
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    }
  };
  const answer = async (n: NotificationItem, accept: boolean) => {
    if (busyId || !n.actor_id) return;
    setBusyId(n.id);
    try {
      const ok = await answerFollowByUsers(userId, n.actor_id, accept, userName);
      if (ok) {
        setItems((prev) => prev.filter((x) => x.id !== n.id));
        onChanged?.();
      }
    } finally { setBusyId(null); }
  };
  return (
    <div className="relative" ref={btnWrapRef}>
      <button type="button" onClick={openPanel} aria-label="Notifications" className="relative inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-200 dark:hover:bg-slate-800">
        <Bell className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Alerts</span>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && fit && createPortal(
        <div className="fixed inset-0 z-[99990]" role="presentation">
          <div className="absolute inset-0 bg-transparent" onClick={() => setOpen(false)} />
        <div
          className="absolute overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-[#111827]"
          style={{ top: fit.top, left: fit.left, width: fit.width, maxHeight: fit.maxHeight, display: 'flex', flexDirection: 'column' }}
        >
          <div className="border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h3>
          </div>
          <div className="max-h-80 overflow-y-auto p-2">
            {items.length === 0 && <p className="p-4 text-center text-xs text-slate-500">No alerts yet. Follow requests and updates land here.</p>}
            {items.map((n) => (
              <div key={n.id} className="rounded-lg p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">{n.title}</p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{n.body}</p>
                {n.type === 'follow_request' && (
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busyId === n.id} onClick={() => answer(n, true)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
                      <Check className="h-3 w-3" /> Accept
                    </button>
                    <button type="button" disabled={busyId === n.id} onClick={() => answer(n, false)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300">
                      <X className="h-3 w-3" /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        </div>,
        document.body
      )}
    </div>
  );
};
