import React, { useEffect, useState } from 'react';
import { Check, Clock, UserCheck, UserPlus, X } from 'lucide-react';
import type { FollowStatus, RoomMember } from '../types';
import { getFollowState, removeFollow, sendFollowRequest, timeAgo } from '../lib/social';

interface FollowButtonProps {
  myId: string;
  myName: string;
  peerId: string;
  peerName: string;
  compact?: boolean;
  onAccepted?: () => void;
}

export const FollowButton: React.FC<FollowButtonProps> = ({ myId, myName, peerId, peerName, compact, onAccepted }) => {
  const [state, setState] = useState<FollowStatus>('none');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    getFollowStatus(myId, peerId).then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, [myId, peerId]);
  const act = async () => {
    if (busy || myId === peerId) return;
    setBusy(true);
    try {
      if (state === 'none' || state === 'followback') {
        const ok = await sendFollowRequest(myId, myName, peerId);
        if (ok) setState(state === 'none' ? 'requested' : 'mutual');
      } else if (state === 'requested' || state === 'following' || state === 'mutual') {
        const ok = await removeFollow(myId, peerId);
        if (ok) { setState('none'); onAccepted?.(); }
      }
    } finally { setBusy(false); }
  };
  const label = state === 'requested' ? 'Requested' : state === 'following' ? 'Following' : state === 'mutual' ? 'Friends' : state === 'followback' ? 'Follow Back' : `Follow ${peerName.split(' ')[0]}`;
  return (
    <button type="button" disabled={busy} onClick={act} className={compact ? 'rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-500 disabled:opacity-50' : 'inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50'}>
      {state === 'following' || state === 'mutual' ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      {busy ? '...' : label}
    </button>
  );
};

interface ProfileModalProps {
  me: { id: string; name: string };
  member: RoomMember;
  onClose: () => void;
  onMessage: (member: RoomMember) => void;
  canMessage: boolean;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ me, member, onClose, onMessage, canMessage }) => {
  const [rels, setRels] = useState<{ followers: number; following: number } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const { getFollowCounts } = await import('../lib/social');
        const c = await getFollowCounts(member.id);
        if (live) setRels(c);
      } catch { /* ignore */ }
    })();
    return () => { live = false; };
  }, [member.id]);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-[#111827]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xl font-bold text-white">
          {member.name.slice(0, 2).toUpperCase()}
        </div>
        <h3 className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">{member.name}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{member.branch || 'Cosmo Scholar'}{member.institution ? ` · ${member.institution}` : ''}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {member.online ? (<><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live now</>) : (<><Clock className="h-3 w-3" /> {timeAgo(member.lastSeen)}</>)}
        </p>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span><strong className="text-slate-900 dark:text-white">{rels?.followers ?? '-'}</strong> followers</span>
          <span><strong className="text-slate-900 dark:text-white">{rels?.following ?? '-'}</strong> following</span>
          <span><strong className="text-amber-600">{member.streakDays}d</strong> streak</span>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <FollowButton myId={me.id} myName={me.name} peerId={member.id} peerName={member.name} />
          <button type="button" disabled={!canMessage} title={canMessage ? 'Open chat' : 'Follow and get accepted to chat'} onClick={() => canMessage && onMessage(member)} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            Message
          </button>
        </div>
        {!canMessage && <p className="mt-2 text-[11px] text-slate-500">Follow and get accepted to unlock chatting.</p>}
        <button type="button" onClick={onClose} className="mt-3 text-xs text-slate-400 hover:text-slate-600">Close</button>
      </div>
    </div>
  );
};

interface MembersDrawerProps {
  open: boolean;
  groupName: string;
  members: RoomMember[];
  loading: boolean;
  me: { id: string; name: string };
  canMessageWith: (peerId: string) => boolean;
  onMessage: (member: RoomMember) => void;
  onClose: () => void;
}

export const MembersDrawer: React.FC<MembersDrawerProps> = ({ open, groupName, members, loading, me, canMessageWith, onMessage, onClose }) => {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<RoomMember | null>(null);
  if (!open) return null;
  const q = query.trim().toLowerCase();
  const filtered = q ? members.filter((m) => m.name.toLowerCase().includes(q)) : members;
  const online = filtered.filter((m) => m.online);
  const offline = filtered.filter((m) => !m.online);
  const row = (m: RoomMember) => (
    <button key={m.id} type="button" onClick={() => setSelected(m)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/60">
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-xs font-bold text-white">
        {m.name.slice(0, 2).toUpperCase()}
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-[#111827] ${m.online ? 'bg-emerald-500' : 'bg-slate-400'}`} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{m.name}</span>
        <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">
          {m.online ? 'Live now·studying' : `${timeAgo(m.lastSeen)}·${m.streakDays}d streak`}
        </span>
      </span>
      {m.online && <span className="shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">LIVE</span>}
    </button>
  );
  return (
    <>
    <div className="fixed inset-0 z-[90] bg-black/40" onClick={onClose} />
    <aside className="fixed right-0 top-0 z-[95] flex h-full w-full max-w-sm flex-col bg-white shadow-2xl dark:bg-[#0F1624]">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="truncate font-display text-base font-bold text-slate-900 dark:text-white">{groupName}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{online.length} live now·{members.length} members</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close members" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search members..." aria-label="Search members" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white" />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {loading && <p className="p-4 text-center text-xs text-slate-500">Loading members...</p>}
        {!loading && filtered.length === 0 && <p className="p-4 text-center text-xs text-slate-500">No members yet. Share this group to invite peers.</p>}
        {online.length > 0 && (<>
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Live now ({online.length})</p>
          {online.map(row)}
        </>)}
        {offline.length > 0 && (<>
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Offline ({offline.length})</p>
          {offline.map(row)}
        </>)}
      </div>
    </aside>
    {selected && (
      <ProfileModal me={me} member={selected} onClose={() => setSelected(null)} onMessage={(m) => { setSelected(null); onMessage(m); }} canMessage={canMessageWith(selected.id)} />
    )}
    </>
  );
};
