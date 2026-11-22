import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Camera,
  CameraOff,
  Download,
  EyeOff,
  FileText,
  Flame,
  MicOff,
  PictureInPicture2,
  Send,
  Upload,
  UserCheck,
  UserPlus,
  Video,
} from 'lucide-react';
import { INITIAL_STUDY_BUDDIES } from '../data/catalog';
import { NEXLIVE_STORAGE_BUCKET, supabase } from '../lib/supabase';
import type {
  BuddyProfile,
  GroupMessage,
  GroupResourceItem,
  StudyGroup,
  UserProfile,
} from '../types';
import { sanitizeHttpsUrl, sanitizeUserText, validateVaultFile } from '../utils/security';
import { canSendBuddyAlert } from '../utils/studyLogic';

interface GroupHubModuleProps {
  profile: UserProfile;
  allGroups: StudyGroup[];
  activeGroupId: string;
  isUltraBlockActive: boolean;
  onSelectGroup: (groupId: string) => void;
}

interface PresencePeer {
  userId: string;
  name: string;
  peerId?: string;
  camOn: boolean;
}

export const GroupHubModule: React.FC<GroupHubModuleProps> = ({
  profile,
  allGroups,
  activeGroupId,
  isUltraBlockActive,
  onSelectGroup,
}) => {
  const joinedGroups = useMemo(
    () => allGroups.filter((g) => profile.joinedGroupIds.includes(g.id)),
    [allGroups, profile.joinedGroupIds]
  );
  const currentGroup =
    allGroups.find((g) => g.id === activeGroupId) || joinedGroups[0] || allGroups[0];

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [resources, setResources] = useState<GroupResourceItem[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [resourceCategory, setResourceCategory] =
    useState<GroupResourceItem['category']>('PDF Notes');
  const [uploadingVault, setUploadingVault] = useState(false);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [vaultNotice, setVaultNotice] = useState<string | null>(null);

  // Silent Live-Cam Engine (PeerJS WebRTC + Supabase Realtime Presence)
  const [camDrawerOpen, setCamDrawerOpen] = useState(false);
  const [camDocked, setCamDocked] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const [camBlur, setCamBlur] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [presencePeers, setPresencePeers] = useState<PresencePeer[]>([]);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<{ destroy: () => void; id?: string } | null>(null);

  // 1-to-1 Study Buddy Follow + 3-hour Cooldown
  const [buddies, setBuddies] = useState<BuddyProfile[]>(INITIAL_STUDY_BUDDIES);
  const [buddyNotice, setBuddyNotice] = useState<string | null>(null);

  // Subscribe to Supabase Realtime for group_messages, group_resources, and presence
  useEffect(() => {
    if (!currentGroup) return;

    let cancelled = false;
    setMessages([]);
    setResources([]);

    const sb = supabase;
    if (!sb) return;

    const loadInitial = async () => {
      const [msgRes, fileRes] = await Promise.all([
        sb
          .from('group_messages')
          .select('*')
          .eq('group_id', currentGroup.id)
          .order('created_at', { ascending: true })
          .limit(80),
        sb
          .from('group_resources')
          .select('*')
          .eq('group_id', currentGroup.id)
          .order('created_at', { ascending: false })
          .limit(40),
      ]);

      if (!cancelled) {
        if (!msgRes.error && Array.isArray(msgRes.data)) {
          setMessages(msgRes.data as GroupMessage[]);
        }
        if (!fileRes.error && Array.isArray(fileRes.data)) {
          setResources(fileRes.data as GroupResourceItem[]);
        }
      }
    };

    void loadInitial();

    const channel = sb
      .channel(`nexlive-room-${currentGroup.id}`, {
        config: { presence: { key: profile.id } },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_messages',
          filter: `group_id=eq.${currentGroup.id}`,
        },
        (payload) => {
          const incoming = payload.new as GroupMessage;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'group_resources',
          filter: `group_id=eq.${currentGroup.id}`,
        },
        (payload) => {
          const incoming = payload.new as GroupResourceItem;
          setResources((prev) =>
            prev.some((r) => r.id === incoming.id) ? prev : [incoming, ...prev]
          );
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePeer>();
        const list: PresencePeer[] = [];
        Object.values(state).forEach((entries) => {
          if (entries[0]) list.push(entries[0]);
        });
        setPresencePeers(list);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: profile.id,
            name: profile.displayName,
            peerId: peerRef.current?.id,
            camOn: camActive,
          });
        }
      });

    return () => {
      cancelled = true;
      void sb.removeChannel(channel);
    };
  }, [currentGroup?.id, profile.id, profile.displayName, camActive]);

  // Clean up local camera stream & PeerJS instance on unmount
  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peerRef.current?.destroy();
    };
  }, []);

  const handleToggleCamera = async () => {
    setCamError(null);
    if (camActive) {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      peerRef.current?.destroy();
      peerRef.current = null;
      setCamActive(false);
      return;
    }

    try {
      // Strictly audio: false (mic disabled by design for silent study rooms)
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 360, facingMode: 'user' },
        audio: false,
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize free PeerJS WebRTC signaling peer
      const { Peer } = await import('peerjs');
      const peer = new Peer();
      peerRef.current = peer;
      setCamActive(true);
      setCamDrawerOpen(true);
    } catch {
      setCamError('Camera permission denied or no webcam detected on this device.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    const cleanContent = sanitizeUserText(messageInput, 1000);
    if (!cleanContent) return;

    setMessageInput('');

    // Respect RLS: insert with own auth.uid() (profile.id) only
    const row: GroupMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      group_id: currentGroup.id,
      user_id: profile.id,
      author_name: sanitizeUserText(profile.displayName, 60),
      author_streak: profile.streakDays,
      content: cleanContent,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, row]);

    if (supabase) {
      const { error } = await supabase.from('group_messages').insert({
        group_id: row.group_id,
        user_id: profile.id,
        author_name: row.author_name,
        author_streak: row.author_streak,
        content: row.content,
      });
      if (error) {
        setVaultError(`Realtime sync note: ${error.message}`);
      }
    }
  };

  const handleVaultUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !currentGroup) return;

    setVaultError(null);
    setVaultNotice(null);

    // Client-side validation: PDF, JPG, PNG, MP3, MP4 only + 50MB max
    const check = validateVaultFile({ name: file.name, size: file.size, type: file.type });
    if (!check.valid) {
      setVaultError(check.error);
      return;
    }

    if (!supabase) {
      setVaultError('Supabase Storage (nexlive-vault) is not configured in environment variables.');
      return;
    }

    setUploadingVault(true);
    try {
      // Scope storage key under own user ID to satisfy RLS policies
      const storagePath = `${profile.id}/${currentGroup.id}/${Date.now()}-${check.safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from(NEXLIVE_STORAGE_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from(NEXLIVE_STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      const safeUrl = sanitizeHttpsUrl(pubData.publicUrl);
      if (!safeUrl) {
        throw new Error('Blocked non-HTTPS storage URL.');
      }

      const fileSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;

      // Respect RLS: insert group_resources with own user_id only
      const { data: inserted, error: insertErr } = await supabase
        .from('group_resources')
        .insert({
          group_id: currentGroup.id,
          user_id: profile.id,
          uploader_name: sanitizeUserText(profile.displayName, 60),
          title: check.safeName,
          category: resourceCategory,
          file_url: safeUrl,
          file_size: fileSize,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      if (inserted) {
        setResources((prev) =>
          prev.some((r) => r.id === (inserted as GroupResourceItem).id)
            ? prev
            : [inserted as GroupResourceItem, ...prev]
        );
      }
      setVaultNotice(`Uploaded ${check.safeName} securely to nexlive-vault.`);
    } catch (err) {
      setVaultError(err instanceof Error ? err.message : 'Vault upload failed.');
    } finally {
      setUploadingVault(false);
    }
  };

  const handleToggleFollowBuddy = async (buddyId: string) => {
    const target = buddies.find((b) => b.id === buddyId);
    if (!target) return;
    const nextFollowing = !target.isFollowing;
    setBuddies((prev) =>
      prev.map((b) => (b.id === buddyId ? { ...b, isFollowing: nextFollowing } : b))
    );

    if (supabase) {
      if (nextFollowing) {
        await supabase.from('buddy_follows').insert({
          follower_id: profile.id,
          followed_id: buddyId,
        });
      } else {
        await supabase
          .from('buddy_follows')
          .delete()
          .eq('follower_id', profile.id)
          .eq('followed_id', buddyId);
      }
    }
  };

  const handleSendStudyAlert = (buddyId: string) => {
    const target = buddies.find((b) => b.id === buddyId);
    if (!target) return;

    const decision = canSendBuddyAlert({
      lastAlertSentAt: target.lastAlertSentAt,
      nowMs: Date.now(),
      isUltraBlockActive,
    });

    if (!decision.allowed) {
      if (decision.reason === 'ultra_block_suppressed') {
        setBuddyNotice('Alerts are suppressed while Ultra Block Lockdown is active.');
      } else {
        const minsLeft = Math.ceil(decision.remainingMs / 60000);
        setBuddyNotice(`3-hour cooldown active for ${target.name} (${minsLeft}m remaining).`);
      }
      return;
    }

    setBuddies((prev) =>
      prev.map((b) => (b.id === buddyId ? { ...b, lastAlertSentAt: Date.now() } : b))
    );
    setBuddyNotice(`Sent silent study start nudge to ${target.name}. Next alert available in 3 hours.`);
  };

  return (
    <div className="space-y-5">
      {/* Top Group Selector + Study Live Camera Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-[#111827]">
        <div className="flex flex-wrap items-center gap-2">
          {joinedGroups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                currentGroup?.id === g.id
                  ? 'bg-indigo-600 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-300'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCamDrawerOpen((o) => !o)}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 whitespace-nowrap"
          >
            <Video className="h-3.5 w-3.5" />
            {camDrawerOpen ? 'Hide Study Live Cam' : 'Study Live Camera'}
          </button>
        </div>
      </div>

      {/* Silent Live Camera Grid (Mic-Disabled PeerJS + Presence, Blur & Dockable) */}
      {camDrawerOpen && (
        <section
          className={`rounded-xl border border-cyan-500/40 bg-[#0F1624] p-4 text-white ${
            camDocked ? 'fixed bottom-4 right-4 z-40 w-80 shadow-2xl' : ''
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <MicOff className="h-3.5 w-3.5 text-amber-400" />
              <span>Silent Study Cam Grid · Mic Hardware-Disabled · {presencePeers.length || 1} in room</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleCamera}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  camActive ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                }`}
              >
                {camActive ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                {camActive ? 'Stop Cam' : 'Turn On Cam'}
              </button>
              <button
                type="button"
                onClick={() => setCamBlur((b) => !b)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <EyeOff className="h-3.5 w-3.5" />
                {camBlur ? 'Unblur' : 'Blur'}
              </button>
              <button
                type="button"
                onClick={() => setCamDocked((d) => !d)}
                aria-label="Toggle dockable mini camera window"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                <PictureInPicture2 className="h-3.5 w-3.5" />
                {camDocked ? 'Expand' : 'Dock'}
              </button>
            </div>
          </div>

          {camError && <p className="mt-2 text-xs text-amber-300">{camError}</p>}

          <div className={`mt-3 grid gap-3 ${camDocked ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
            <div className="relative aspect-video overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`h-full w-full object-cover ${camBlur ? 'blur-md' : ''} ${camActive ? '' : 'hidden'}`}
              />
              {!camActive && (
                <div className="flex h-full flex-col items-center justify-center text-xs text-slate-400">
                  <CameraOff className="h-5 w-5" />
                  <span className="mt-1.5">Your camera is off</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[11px] font-medium">
                {profile.displayName} (You · Muted)
              </div>
            </div>

            {!camDocked &&
              presencePeers
                .filter((p) => p.userId !== profile.id)
                .slice(0, 2)
                .map((peer) => (
                  <div
                    key={peer.userId}
                    className="relative flex aspect-video items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-400"
                  >
                    <span>{peer.name} · Silent Focus</span>
                  </div>
                ))}
          </div>
        </section>
      )}

      {/* Hybrid 3-Column Hub: Center WhatsApp Chat + Right Telegram Vault & Study Buddies */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Center WhatsApp-Style Chat (group_messages) */}
        <section className="flex h-[540px] flex-col rounded-xl border border-slate-200 bg-white xl:col-span-7 dark:border-slate-800 dark:bg-[#111827]">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-800">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                {currentGroup?.name}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live Cohort Chat · Supabase Realtime (group_messages)
              </p>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-amber-600 tabular-nums dark:text-amber-400">
              <Flame className="h-3.5 w-3.5" />
              {profile.streakDays}d streak
            </span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {messages.map((msg) => {
              const mine = msg.user_id === profile.id;
              return (
                <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm ${
                      mine
                        ? 'bg-indigo-600 text-white'
                        : 'border border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-[#0B0F19] dark:text-slate-100'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-2 text-[11px] font-semibold ${
                        mine ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <span>{msg.author_name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{msg.author_streak}d streak</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <p className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                No messages in {currentGroup?.name} yet. Post your current study block target to kick off the thread.
              </p>
            )}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="flex items-center gap-2 border-t border-slate-200 p-3.5 dark:border-slate-800"
          >
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder="Share a doubt, formula, or focus check-in..."
              aria-label="Message group chat"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </form>
        </section>

        {/* Right Panel: Telegram-Style Vault (group_resources + nexlive-vault) + 1-to-1 Study Buddies */}
        <aside className="space-y-5 xl:col-span-5">
          {/* Telegram-Style Resource Vault */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Telegram-Style Resource Vault
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  nexlive-vault · PDF/JPG/PNG/MP3/MP4 · 50 MB max
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <select
                value={resourceCategory}
                onChange={(e) => setResourceCategory(e.target.value as GroupResourceItem['category'])}
                aria-label="Resource category"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white"
              >
                <option value="PDF Notes">PDF Notes</option>
                <option value="PYQ Paper">PYQ Paper</option>
                <option value="Formula Sheet">Formula Sheet</option>
                <option value="Lecture Deck">Lecture Deck</option>
              </select>

              <label className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-600 dark:hover:bg-cyan-500">
                <Upload className="h-3.5 w-3.5" />
                <span>{uploadingVault ? 'Uploading...' : 'Upload to Vault'}</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.mp3,.mp4"
                  disabled={uploadingVault}
                  onChange={handleVaultUpload}
                  className="sr-only"
                />
              </label>
            </div>

            {vaultError && (
              <p role="alert" className="mt-2.5 text-xs font-medium text-red-600 dark:text-red-400">
                {vaultError}
              </p>
            )}
            {vaultNotice && (
              <p role="status" className="mt-2.5 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                {vaultNotice}
              </p>
            )}

            <div className="mt-4 max-h-48 divide-y divide-slate-200 overflow-y-auto dark:divide-slate-800">
              {resources.map((item) => {
                const safeHref = sanitizeHttpsUrl(item.file_url);
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-indigo-500" />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.category} · {item.file_size} · {item.uploader_name}
                        </div>
                      </div>
                    </div>
                    {safeHref && (
                      <a
                        href={safeHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Download ${item.title}`}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                );
              })}
              {resources.length === 0 && (
                <p className="py-5 text-center text-xs text-slate-500 dark:text-slate-400">
                  No vault files uploaded to this group yet.
                </p>
              )}
            </div>
          </div>

          {/* 1-to-1 Study Buddy Follow (buddy_follows) with 3-hour Cooldown */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#111827]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  1-to-1 Study Buddies
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  3-hour cooldown per alert · Suppressed in Ultra Block
                </p>
              </div>
            </div>

            {buddyNotice && (
              <p role="status" className="mt-2.5 text-xs font-medium text-cyan-700 dark:text-cyan-400">
                {buddyNotice}
              </p>
            )}

            <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
              {buddies.map((buddy) => (
                <div key={buddy.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                      {buddy.name}
                    </div>
                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {buddy.institution} · {buddy.streakDays}d streak ·{' '}
                      {buddy.isStudyingNow ? 'Studying now' : 'Offline'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFollowBuddy(buddy.id)}
                      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${
                        buddy.isFollowing
                          ? 'border border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-200'
                          : 'bg-indigo-600 text-white hover:bg-indigo-500'
                      }`}
                    >
                      {buddy.isFollowing ? (
                        <>
                          <UserCheck className="h-3 w-3" /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-3 w-3" /> Follow
                        </>
                      )}
                    </button>
                    {buddy.isFollowing && (
                      <button
                        type="button"
                        onClick={() => handleSendStudyAlert(buddy.id)}
                        aria-label={`Send study alert to ${buddy.name}`}
                        className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
