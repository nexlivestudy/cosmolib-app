import React, { useEffect, useRef, useState } from 'react';
import { CheckCheck, Eraser, Mic, MicOff, Palette, Plus, Reply, Square, Trash2, Video, VideoOff } from 'lucide-react';
import { askRoomAssistant } from '../lib/aiClient';
import { supabase } from '../lib/supabase';
import type { BYOKConfig, LiveChatMsg, LiveRoom, UserProfile } from '../types';
import { sanitizeUserText } from '../utils/security';
import { CosmoSelect } from './ui/CosmoSelect';

interface Props {
  profile: UserProfile;
  byok: BYOKConfig;
}

const ROOMS_KEY = 'cosmolib_live_rooms_v1';

function loadRooms(): LiveRoom[] {
  try {
    const raw = localStorage.getItem(ROOMS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as LiveRoom[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

type Stroke = { x0: number; y0: number; x1: number; y1: number; color: string; size: number };

export const LiveStudyRoomModule: React.FC<Props> = ({ profile, byok }) => {
  const [rooms, setRooms] = useState<LiveRoom[]>(() => loadRooms());
  const [activeRoomId, setActiveRoomId] = useState<string>('');
  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [roomWhen, setRoomWhen] = useState('now');

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;

  // Live AV
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [avError, setAvError] = useState<string | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<{ peerId: string; stream: MediaStream }[]>([]);
  const peerRef = useRef<any>(null);
  const [peerId, setPeerId] = useState('');

  // Chat + AI bot
  const [chat, setChat] = useState<LiveChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [botBusy, setBotBusy] = useState(false);
  // WhatsApp-style extras for private rooms (mic + voice notes allowed ONLY here)
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Record<string, number>>>({});
  const [myReactions, setMyReactions] = useState<Record<string, string>>({});
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineMembers, setOnlineMembers] = useState<string[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recorderRef = useRef<any>(null);
  const recordTimer = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Whiteboard + notepad
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [penColor, setPenColor] = useState('#6366f1');
  const [penSize, setPenSize] = useState(3);
  const [notes, setNotes] = useState('');
  const channelRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  }, [rooms]);

  const createRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const name = sanitizeUserText(roomName, 80) || 'My Study Room';
    const topic = sanitizeUserText(roomTopic, 120) || 'General study';
    const room: LiveRoom = {
      id: `live-${Date.now()}`,
      name,
      topic,
      scheduledAt: roomWhen === 'now' ? 'Live now' : sanitizeUserText(roomWhen, 60),
      createdBy: profile.displayName,
      isLive: roomWhen === 'now',
    };
    setRooms((prev) => [room, ...prev]);
    setActiveRoomId(room.id);
    setChat([
      {
        id: `sys-${Date.now()}`,
        author: 'COSMO',
        text: `Welcome to ${name}! Teach each other on the whiteboard + notepad. Type @cosmo <question> to ask the AI bot. Turn on camera/mic to go live.`,
        isBot: true,
        createdAt: new Date().toISOString(),
      },
    ]);
    setRoomName('');
    setRoomTopic('');
  };

  // Supabase broadcast channel for chat/whiteboard/notepad (works even without DB tables)
  useEffect(() => {
    if (!activeRoom || !supabase) return;
    const ch = supabase.channel(`live-room-${activeRoom.id}`, {
      config: { broadcast: { self: false } },
    });
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const m = payload as LiveChatMsg;
      setChat((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
    ch.on('broadcast', { event: 'stroke' }, ({ payload }) => {
      drawStroke(payload as Stroke, false);
    });
    ch.on('broadcast', { event: 'clear-board' }, () => {
      const c = canvasRef.current;
      if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    });
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      const name = String((payload as { name?: string }).name || '');
      if (name && name !== profile.displayName) {
        setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
        window.setTimeout(() => {
          setTypingUsers((prev) => prev.filter((n) => n !== name));
        }, 2500);
      }
    });
    ch.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      const p = payload as { msgId?: string; emoji?: string };
      if (!p.msgId || !p.emoji) return;
      setReactions((prev) => ({
        ...prev,
        [p.msgId as string]: {
          ...(prev[p.msgId as string] || {}),
          [p.emoji as string]: ((prev[p.msgId as string] || {})[p.emoji as string] || 0) + 1,
        },
      }));
    });
    ch.on('broadcast', { event: 'reaction-remove' }, ({ payload }) => {
      const p = payload as { msgId?: string; emoji?: string };
      if (!p.msgId || !p.emoji) return;
      setReactions((prev) => ({
        ...prev,
        [p.msgId as string]: {
          ...(prev[p.msgId as string] || {}),
          [p.emoji as string]: Math.max(0, ((prev[p.msgId as string] || {})[p.emoji as string] || 1) - 1),
        },
      }));
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ name: string }>();
      const names: string[] = [];
      Object.values(state).forEach((entries) => {
        const first = (entries as { name: string }[])[0];
        if (first?.name) names.push(first.name);
      });
      setOnlineMembers(Array.from(new Set(names)));
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await ch.track({ userId: profile.id, name: profile.displayName });
        } catch {
          /* presence best-effort */
        }
      }
    });
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [activeRoomId]);

  const drawStroke = (s: Stroke, emit = true) => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    const sx = c.width / rect.width;
    const sy = c.height / rect.height;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x0 * sx, s.y0 * sy);
    ctx.lineTo(s.x1 * sx, s.y1 * sy);
    ctx.stroke();
    if (emit) channelRef.current?.send({ type: 'broadcast', event: 'stroke', payload: s });
  };

  const handleCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const r = e.currentTarget.getBoundingClientRect();
    lastRef.current = { x: e.clientX - r.left, y: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !lastRef.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const cur = { x: e.clientX - r.left, y: e.clientY - r.top };
    drawStroke({ x0: lastRef.current.x, y0: lastRef.current.y, x1: cur.x, y1: cur.y, color: penColor, size: penSize });
    lastRef.current = cur;
  };
  const handleCanvasUp = () => {
    drawingRef.current = false;
    lastRef.current = null;
  };

  const clearBoard = () => {
    const c = canvasRef.current;
    if (c) c.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    channelRef.current?.send({ type: 'broadcast', event: 'clear-board', payload: {} });
  };

  const handleNotesChange = (v: string) => {
    setNotes(v.slice(0, 20000));
    channelRef.current?.send({ type: 'broadcast', event: 'notes', payload: { text: v.slice(0, 20000) } });
  };

  const toggleAV = async (wantCam: boolean) => {
    setAvError(null);
    try {
      if (!wantCam && localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
        const audio = localStreamRef.current.getAudioTracks();
        const next = new MediaStream(audio);
        localStreamRef.current = audio.length ? next : null;
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        setCamOn(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: wantCam ? { width: 640, height: 360, facingMode: 'user' } : false,
        audio: micOn,
      });
      localStreamRef.current = stream;
      if (wantCam && localVideoRef.current) localVideoRef.current.srcObject = stream;
      setCamOn(wantCam);
      // Init PeerJS mesh once
      if (!peerRef.current && activeRoom) {
        const { Peer } = await import('peerjs');
        const id = `cosmo-${activeRoom.id}-${profile.id}`.slice(0, 50);
        const peer = new Peer(id);
        peer.on('open', () => setPeerId(id));
        peer.on('call', (call: any) => {
          call.answer(localStreamRef.current || undefined);
          call.on('stream', (rs: MediaStream) => {
            setRemoteStreams((prev) =>
              prev.some((p) => p.peerId === call.peer) ? prev : [...prev, { peerId: call.peer, stream: rs }]
            );
          });
        });
        peer.on('error', () => {});
        peerRef.current = peer;
      }
    } catch {
      setAvError('Camera/mic blocked. Allow permissions in the browser, then retry.');
    }
  };

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = next));
      } else if (next) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = s;
      }
    } catch {
      setAvError('Microphone blocked by browser.');
    }
  };

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      try { peerRef.current?.destroy(); } catch { /* noop */ }
    };
  }, []);

  const sendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom) return;
    const text = sanitizeUserText(chatInput, 1000);
    if (!text) return;
    const msg: LiveChatMsg = {
      id: `m-${Date.now()}`,
      author: profile.displayName,
      text,
      isBot: false,
      createdAt: new Date().toISOString(),
      replyToId: replyToId || undefined,
    };
    setChat((prev) => [...prev, msg]);
    channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: msg });
    setChatInput('');
    setReplyToId(null);
    if (text.toLowerCase().startsWith('@cosmo')) {
      const q = text.replace(/^@cosmo\s*/i, '') || text;
      setBotBusy(true);
      try {
        const { answer } = await askRoomAssistant(
          { question: q, roomTopic: activeRoom.topic, history: chat.slice(-6).map((m) => `${m.author}: ${m.text}`) },
          byok
        );
        const bot: LiveChatMsg = {
          id: `b-${Date.now()}`,
          author: 'COSMO AI',
          text: answer,
          isBot: true,
          createdAt: new Date().toISOString(),
        };
        setChat((prev) => [...prev, bot]);
        channelRef.current?.send({ type: 'broadcast', event: 'chat', payload: bot });
      } catch (err) {
        const bot: LiveChatMsg = {
          id: `b-${Date.now()}`,
          author: 'COSMO AI',
          text: `AI bot unreachable: ${err instanceof Error ? err.message : 'check GEMINI_API_KEY'}. Chat still works.`,
          isBot: true,
          createdAt: new Date().toISOString(),
        };
        setChat((prev) => [...prev, bot]);
      } finally {
        setBotBusy(false);
      }
    }
  };

  const toggleReaction = (msgId: string, emoji: string) => {
    const prevEmoji = myReactions[msgId];
    const nextEmoji = prevEmoji === emoji ? null : emoji;
    setMyReactions((prev) => {
      const next = { ...prev };
      if (nextEmoji) next[msgId] = nextEmoji;
      else delete next[msgId];
      return next;
    });
    setReactions((prev) => {
      const cur = { ...(prev[msgId] || {}) };
      if (prevEmoji) cur[prevEmoji] = Math.max(0, (cur[prevEmoji] || 1) - 1);
      if (nextEmoji) cur[nextEmoji] = (cur[nextEmoji] || 0) + 1;
      return { ...prev, [msgId]: cur };
    });
    try {
      channelRef.current?.send({
        type: 'broadcast',
        event: nextEmoji ? 'reaction' : 'reaction-remove',
        payload: { msgId, emoji: (nextEmoji || prevEmoji) as string },
      });
    } catch {
      /* reaction best-effort */
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const emitTyping = () => {
    try {
      channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { name: profile.displayName } });
    } catch {
      /* best-effort */
    }
  };

  // Voice notes: mic capture allowed ONLY in private live rooms (never university/global)
  const startVoiceNote = async () => {
    setAvError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordTimer.current) window.clearInterval(recordTimer.current);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const secs = recordSecs;
        setRecording(false);
        setRecordSecs(0);
        if (blob.size < 500) return;
        const localUrl = URL.createObjectURL(blob);
        const msg: LiveChatMsg = {
          id: `v-${Date.now()}`,
          author: profile.displayName,
          text: `Voice note (${secs}s) - private room`,
          isBot: false,
          createdAt: new Date().toISOString(),
          audioUrl: localUrl,
          audioSecs: secs,
        };
        setChat((prev) => [...prev, msg]);
        const reader = new FileReader();
        reader.onload = () => {
          try {
            channelRef.current?.send({
              type: 'broadcast',
              event: 'chat',
              payload: { ...msg, audioUrl: String(reader.result || '') },
            });
          } catch {
            /* large voice notes stay local-only */
          }
        };
        try {
          reader.readAsDataURL(blob);
        } catch {
          /* local-only playback */
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimer.current = window.setInterval(() => {
        setRecordSecs((s) => {
          if (s + 1 >= 60) {
            try { rec.stop(); } catch { /* noop */ }
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setAvError('Microphone blocked. Voice notes need mic permission (private rooms only).');
    }
  };

  const stopVoiceNote = () => {
    try {
      (recorderRef.current as MediaRecorder | null)?.stop();
    } catch {
      setRecording(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <aside className="space-y-4 lg:col-span-4">
        <div className="cosmo-card p-4">
          <h2 className="font-display text-base font-bold">Personal Live Rooms</h2>
          <p className="mt-1 text-xs text-slate-500">Your own Meet-type space — pick a live session, teach on board + notes, ask @cosmo.</p>
          <form onSubmit={createRoom} className="mt-3 space-y-2">
            <input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Room name (e.g. Thermo Night)" className="w-full rounded-lg border px-3 py-2 text-xs dark:bg-[#0B0F19]" />
            <input value={roomTopic} onChange={(e) => setRoomTopic(e.target.value)} placeholder="Topic (e.g. Heat Transfer)" className="w-full rounded-lg border px-3 py-2 text-xs dark:bg-[#0B0F19]" />
            <div className="flex gap-2">
              <CosmoSelect
                value={roomWhen}
                onChange={setRoomWhen}
                ariaLabel="Live session timing"
                options={[
                  { value: 'now', label: 'Start live now' },
                  { value: 'Evening 7 PM', label: 'Evening 7 PM' },
                  { value: 'Tomorrow morning', label: 'Tomorrow morning' },
                ]}
              />
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shrink-0"><Plus className="h-3.5 w-3.5" /> Create</button>
            </div>
          </form>
          <div className="mt-4 space-y-1.5">
            {rooms.map((r) => (
              <button key={r.id} type="button" onClick={() => setActiveRoomId(r.id)} className={`w-full rounded-lg border p-3 text-left ${r.id === activeRoomId ? 'border-cyan-500 bg-cyan-500/10' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}>
                <div className="text-sm font-semibold">{r.name}</div>
                <div className="text-xs text-slate-500">{r.topic} · {r.scheduledAt} · by {r.createdBy}</div>
              </button>
            ))}
            {rooms.length === 0 && <p className="text-xs text-slate-500">No rooms yet — create your first live session.</p>}
          </div>
        </div>
        <div className="cosmo-card p-4">
          <h3 className="text-sm font-semibold">Live controls - private room, mic allowed</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Mic + voice notes work ONLY here. University/global rooms stay silent.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => toggleAV(!camOn)} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold">{camOn ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}{camOn ? 'Cam off' : 'Cam on'}</button>
            <button type="button" onClick={toggleMic} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold">{micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}{micOn ? 'Mic on' : 'Muted'}</button>
          </div>
          {peerId && <p className="mt-2 text-[11px] text-slate-500 break-all">Peer ID: {peerId} — share room link, peers join with same room.</p>}
          {avError && <p className="mt-2 text-xs text-red-500">{avError}</p>}
        </div>
      </aside>

      <section className="space-y-5 lg:col-span-8">
        {!activeRoom && <div className="cosmo-card p-8 text-center text-sm text-slate-500">Pick or create a room to start your live teaching session.</div>}
        {activeRoom && (
          <>
            <div className="cosmo-card p-4">
              <h1 className="font-display text-xl font-bold">{activeRoom.name}</h1>
              <p className="text-xs text-slate-500">{activeRoom.topic} · {activeRoom.scheduledAt}</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="overflow-hidden rounded-lg bg-black aspect-video">
                  <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {remoteStreams.map((r) => (
                    <video key={r.peerId} autoPlay playsInline ref={(el) => { if (el && el.srcObject !== r.stream) el.srcObject = r.stream; }} className="aspect-video w-full rounded-lg bg-slate-900 object-cover" />
                  ))}
                  {remoteStreams.length === 0 && <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500 dark:bg-slate-800">Peers appear here when they join</div>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              <div className="cosmo-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Teach board (paint)</h3>
                  <div className="flex items-center gap-2">
                    <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} aria-label="Pen color" className="h-6 w-8" />
                    <input type="range" min={1} max={12} value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} aria-label="Pen size" className="w-20" />
                    <button type="button" onClick={() => setPenColor('#ffffff')} title="Eraser (white)" className="rounded border p-1"><Eraser className="h-3.5 w-3.5" /></button>
                    <button type="button" onClick={clearBoard} title="Clear board" className="rounded border p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <canvas ref={canvasRef} width={640} height={360} onPointerDown={handleCanvasDown} onPointerMove={handleCanvasMove} onPointerUp={handleCanvasUp} onPointerLeave={handleCanvasUp} className="mt-2 w-full cursor-crosshair touch-none rounded-lg border bg-white dark:bg-[#0B0F19]" />
                <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500"><Palette className="h-3 w-3" /> Draw to teach — strokes sync live to room peers.</p>
              </div>
              <div className="cosmo-card flex flex-col p-4">
                <h3 className="text-sm font-semibold">Shared notepad</h3>
                <textarea value={notes} onChange={(e) => handleNotesChange(e.target.value)} placeholder="Type shared derivations, formulas, doubts… syncs live." rows={12} className="mt-2 w-full flex-1 rounded-lg border p-2 font-mono text-xs dark:bg-[#0B0F19]" />
              </div>
            </div>

            <div className="cosmo-card p-4">
              <h3 className="text-sm font-semibold">Room chat + @cosmo AI bot</h3>
              <p className="mt-0.5 text-[11px] text-slate-500">Private room - mic + voice notes allowed here. {onlineMembers.length > 0 ? `${onlineMembers.length} online: ${onlineMembers.slice(0, 4).join(', ')}` : 'Only you here - share the room to invite peers.'}</p>
              <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                {chat.map((m) => {
                  const quoted = m.replyToId ? chat.find((x) => x.id === m.replyToId) : undefined;
                  const msgReacts = reactions[m.id] || {};
                  return (
                    <div key={m.id} className={`rounded-lg p-2 text-xs ${m.isBot ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-slate-50 dark:bg-slate-800/60'}`}>
                      <span className="font-semibold">{m.author}: </span>
                      <span className="ml-1 font-mono text-[10px] opacity-60">{formatTime(m.createdAt)}</span>
                      {quoted && (
                        <div className="mt-1 truncate rounded-md border-l-2 border-indigo-400 bg-white/60 px-2 py-1 text-[11px] italic dark:bg-black/20">
                          Replying to {quoted.author}: {(quoted.text || '').slice(0, 80)}
                        </div>
                      )}
                      <span>{m.text}</span>
                      {m.audioUrl && (
                        <audio controls src={m.audioUrl} className="mt-1 w-full" />
                      )}
                      {!m.isBot && (
                        <div className="mt-1 flex items-center gap-1">
                          {['\xf0\x9f\x91\x8d', '\xe2\x9d\xa4', '\xf0\x9f\x98\x82'].map((emoji) => {
                            const count = msgReacts[emoji] || 0;
                            const active = myReactions[m.id] === emoji;
                            return (
                              <button key={emoji} type="button" onClick={() => toggleReaction(m.id, emoji)} title={active ? 'Remove reaction' : 'React'} className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${active ? 'bg-indigo-200 dark:bg-indigo-500/30 scale-110' : 'opacity-60 hover:opacity-100'}`}>
                                {emoji}{count > 0 && <span className="ml-0.5 font-mono">{count}</span>}
                              </button>
                            );
                          })}
                          <button type="button" onClick={() => setReplyToId(m.id)} title="Reply" aria-label={`Reply to ${m.author}`} className="rounded-full p-1 opacity-60 hover:opacity-100">
                            <Reply className="h-3 w-3" />
                          </button>
                          <span className="ml-auto inline-flex items-center gap-0.5 opacity-70" title="Delivered to room">
                            <CheckCheck className="h-3 w-3" />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {botBusy && <p className="text-xs text-slate-500">COSMO thinking\xe2\x80\xa6</p>}
              </div>
              {replyToId && (() => {
                const target = chat.find((x) => x.id === replyToId);
                return (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] dark:bg-slate-800">
                    <span className="truncate">Replying to {target ? `${target.author}: ${(target.text || '').slice(0, 70)}` : 'message'}...</span>
                    <button type="button" onClick={() => setReplyToId(null)} aria-label="Cancel reply" className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700">x</button>
                  </div>
                );
              })()}
              {typingUsers.length > 0 && (
                <p className="mt-1 text-[11px] italic text-slate-500">{typingUsers.slice(0, 2).join(', ')} typing...</p>
              )}
              <form onSubmit={sendChat} className="mt-2 flex gap-2">
                <input value={chatInput} onChange={(e) => { setChatInput(e.target.value); emitTyping(); }} placeholder="Chat\xe2\x80\xa6 or @cosmo explain entropy in 2 lines" className="w-full rounded-lg border px-3 py-2 text-xs dark:bg-[#0B0F19]" />
                <button type="button" onClick={() => (recording ? stopVoiceNote() : void startVoiceNote())} title={recording ? `Stop (${recordSecs}s / 60s max)` : 'Record voice note (private room only)'} aria-label="Record voice note" className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${recording ? 'bg-red-600 animate-pulse' : 'bg-slate-700 hover:bg-slate-600'}`}>
                  {recording ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white">Send</button>
              </form>
              {recording && <p className="mt-1 text-[11px] font-semibold text-red-600">Recording voice note... {recordSecs}s (auto-stops at 60s)</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
};
