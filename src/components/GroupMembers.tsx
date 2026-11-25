import React, { useEffect, useState } from 'react';
import { Check, Clock, UserCheck, UserPlus, X } from 'lucide-react';
import type { FollowState, RoomMember } from '../types';
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
  const [state, setState] = useState<FollowState>('none');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    getFollowState(myId, peerId).then((s) => { if (live) setState(s); });
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
        <p className="text-xs text-slate-500 dark:text-slate-400">{member.branch || 'Cosmo Scholar'}{member.institution ? ` \u00b7 ${member.institution}` : ''}</p>
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

// __PART2__
