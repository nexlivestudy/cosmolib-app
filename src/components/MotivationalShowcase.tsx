import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MOTIV_HI } from '../i18n/dict';
import { useLanguage } from '../i18n/LanguageContext';
import { Brain, ChevronLeft, ChevronRight, Clock, Crown, Flame, FolderKanban, Pause, Play, Rocket, ShieldCheck, Sparkles, Target, Trophy, Users, Zap } from 'lucide-react';

interface Slide {
  id: string;
  kicker: string;
  title: React.ReactNode;
  sub: string;
  badge: string;
  icon: React.ElementType;
  footer?: React.ReactNode;
}

const READ_MS = 5000;

const BASE_SLIDES: Slide[] = [
  { id: 'lock-in', kicker: 'Global AI Study Computer · Zero-Distraction Architecture', title: (<>Lock in every exam, folder, and{' '}<span style={{ backgroundImage: 'linear-gradient(90deg, var(--cosmo-accent), var(--cosmo-accent2))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>study room</span>{' '}in one place.</>), sub: 'Your entire semester — organized, scheduled and accountable.', badge: 'All-in-one desk', icon: Sparkles, footer: (<div className="mt-5 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-300"><span>01. AI Smart Study Folders</span><span>02. Exam Panic Mode</span><span>03. Smart Study Schedule</span><span>04. Silent Live-Cam Rooms</span></div>) },
  { id: 'mind-1', kicker: 'Mind Power · Train Daily', title: <>Your mind obeys training. Train it daily.</>, sub: 'Focus is a muscle. Every 25-minute block makes your brain sharper and harder to distract.', badge: 'Mind over mood', icon: Brain },
  { id: 'mind-2', kicker: 'Mind Power · Visualize Victory', title: <>See the rank before you earn it.</>, sub: 'Close your eyes for 10 seconds. See your name on the list. Now open books and chase it.', badge: 'Visualize then execute', icon: Brain },
  { id: 'mind-3', kicker: 'Mind Power · Calm Under Pressure', title: <>A calm mind recalls faster.</>, sub: 'Slow breath in, slow breath out. Panic blocks memory. Calm unlocks it.', badge: 'Breathe · recall · write', icon: Brain },
  { id: 'mind-4', kicker: 'Mind Power · You Are Capable', title: <>Your brain can learn anything.</>, sub: 'Every topper once found this chapter hard. Repetition turns hard into easy.', badge: 'Capable by repetition', icon: Brain },
  { id: 'con-1', kicker: 'Consistency > Motivation', title: <>Small daily wins beat last-night panic.</>, sub: 'Show up daily. Streaks and nudges carry you even on low-energy days.', badge: '1% better daily = 37x a year', icon: Flame },
  { id: 'con-2', kicker: 'No Zero Days', title: <>Even 20 minutes keeps the fire alive.</>, sub: 'Momentum loves a starter. Open one folder, solve one problem, keep the chain.', badge: 'No zero days', icon: Flame },
  { id: 'con-3', kicker: 'Discipline Makes You Dangerous', title: <>Discipline makes you dangerous to average.</>, sub: 'Mood changes. System stays. Follow the schedule, not the feeling.', badge: 'System over mood', icon: Zap },
  { id: 'conf-1', kicker: 'Confidence Is Built', title: <>Toppers are not born. They are built.</>, sub: 'Every concept mastered is proof: I can do hard things.', badge: 'Proof over promises', icon: Trophy },
  { id: 'conf-2', kicker: 'Power Pose · Sit Like a Winner', title: <>Sit straight. Study like you mean it.</>, sub: 'Body tells brain: this matters. Shoulders back, phone away, first task now.', badge: 'Posture is power', icon: Crown },
  { id: 'conf-3', kicker: 'Fear Is a Liar', title: <>The paper fears a prepared mind.</>, sub: 'Syllabus + PYQs + mocks. Walk in knowing you have seen this before.', badge: 'Prepared beats scared', icon: ShieldCheck },
  { id: 'task-1', kicker: 'Tasks to Done', title: <>Turn scary syllabus into tiny tasks.</>, sub: 'Folders break PDFs and lectures into concepts. Pick just the next small task.', badge: 'Syllabus to checklist', icon: FolderKanban },
  { id: 'task-2', kicker: 'Two-Minute Start', title: <>If it takes 2 minutes, start it now.</>, sub: 'Open the page. Read the first line. Starting is the hardest part — then flow takes over.', badge: 'Start now · 5-sec rule', icon: Rocket },
  { id: 'focus-1', kicker: 'Deep Focus Mode', title: <>One focused hour beats five distracted hours.</>, sub: 'Calls-only filter and silent cams keep you honest for 25 / 50-minute blocks.', badge: '25-min blocks', icon: Clock },
  { id: 'focus-2', kicker: 'Phone Down, Rank Up', title: <>Every unlock costs you 10 minutes.</>, sub: 'Keep phone face-down. Your future self will thank this hour.', badge: 'Phone down · mind up', icon: Target },
  { id: 'mem-1', kicker: 'Smart Memory', title: <>Revision beats re-reading. Every time.</>, sub: 'Spaced recall locks formulas into long-term memory before the exam.', badge: 'Recall over re-read', icon: Target },
  { id: 'mem-2', kicker: 'Teach to Learn', title: <>Explain it simply, remember it forever.</>, sub: 'After each topic, say it aloud in your own words like teaching a friend.', badge: 'Say it · keep it', icon: Brain },
  { id: 'together-1', kicker: 'Never Study Alone', title: <>When they lock in, you lock in.</>, sub: 'Silent live-cam rooms and cohort energy pull you forward.', badge: 'Live cohort power', icon: Users },
  { id: 'together-2', kicker: 'Accountability Wins', title: <>Promise one person your target today.</>, sub: 'Tell your group: 3 chapters by 9pm. Social promise doubles follow-through.', badge: 'Promise · deliver', icon: Users },
  { id: 'you-1', kicker: 'You vs Yesterday', title: <>Beat only one person: yesterday's you.</>, sub: 'Track minutes and mastery. Small progress daily becomes impossible to ignore.', badge: 'Progress you can see', icon: Crown },
  { id: 'future-1', kicker: 'Future You Is Watching', title: <>Study now, thank yourself later.</>, sub: 'Press Start on a focus block. Your future rank is built in this exact hour.', badge: 'This hour counts', icon: Rocket },
  { id: 'power-1', kicker: 'Power Thought', title: <>I am a student who never quits.</>, sub: 'Say it once before opening books. Identity drives action.', badge: 'Identity first', icon: Sparkles },
  { id: 'power-2', kicker: 'Power Thought', title: <>Hard chapters make strong minds.</>, sub: 'If it feels tough, it is working. Stay 10 minutes more.', badge: 'Stay 10 more', icon: Zap },
  { id: 'power-3', kicker: 'Power Thought', title: <>Slow progress is still progress.</>, sub: 'Do not compare day 5 to someone’s year 2. Compare to your day 1.', badge: 'Keep climbing', icon: Flame },
  { id: 'power-4', kicker: 'Power Thought', title: <>Distraction can wait. Dreams cannot.</>, sub: 'Reels, chats, games — all there after the block. Dream first.', badge: 'Dream first', icon: ShieldCheck },
  { id: 'power-5', kicker: 'Power Thought', title: <>Mistakes are marks in making.</>, sub: 'Every wrong answer in practice is one less wrong in the exam.', badge: 'Wrong now · right later', icon: Trophy },
  { id: 'power-6', kicker: 'Power Thought', title: <>Your parents believe. Prove them right.</>, sub: 'They work hard so you can study in peace. Honour it with one sincere hour.', badge: 'Make them proud', icon: Crown },
  { id: 'power-7', kicker: 'Power Thought', title: <>One chapter a day keeps failure away.</>, sub: 'Thirty chapters in thirty days. That is a syllabus done.', badge: 'One a day', icon: FolderKanban },
  { id: 'power-8', kicker: 'Power Thought', title: <>Winners revise when others sleep.</>, sub: 'Night 30 minutes of recall + morning 10 minutes review = magic.', badge: 'Night recall ritual', icon: Clock },
  { id: 'power-9', kicker: 'Power Thought', title: <>You have survived 100% of tough days.</>, sub: 'This tough topic is no different. You finish what you start.', badge: 'Finisher mindset', icon: Trophy },
];

// Continuous endless queue: shuffled order, reshuffles forever till login completes.
// No visible end, no 1/12 — feels infinite.
function shuffled(arr: Slide[]): Slide[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // keep intro first for branding
  const intro = a.findIndex((s) => s.id === 'lock-in');
  if (intro > 0) { const [s] = a.splice(intro, 1); a.unshift(s); }
  return a;
}
const SLIDES: Slide[] = shuffled(BASE_SLIDES);

export const MotivationalShowcase: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback((d: 1 | -1) => {
    setDir(d);
    setIndex((p) => (p + d + SLIDES.length) % SLIDES.length);
  }, []);

  // Auto-swipe like big apps: readable 5s pause -> swipe next -> infinite loop
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const t = window.setTimeout(() => setIndex((p) => (p + 1) % SLIDES.length), READ_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      setDir(1);
      setIndex((p) => (p + 1) % SLIDES.length);
    }, READ_MS);
    return () => window.clearTimeout(t);
  }, [index, paused]);

  const { lang } = useLanguage();
  const slide = SLIDES[index];
  const loc = lang === 'hi' ? MOTIV_HI[slide.id] : undefined;
  const kicker: string = loc?.kicker ?? slide.kicker;
  const title: React.ReactNode = loc ? loc.title : slide.title;
  const sub: string = loc?.sub ?? slide.sub;
  const badge: string = loc?.badge ?? slide.badge;
  const Icon = slide.icon;

  return (
    <div
      className="relative z-10 overflow-hidden p-6 pt-20 sm:p-10 sm:pt-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <style>{`@keyframes cosmo-swipe-r { from { opacity: 0; transform: translateX(56px); } to { opacity: 1; transform: none; } }
@keyframes cosmo-swipe-l { from { opacity: 0; transform: translateX(-56px); } to { opacity: 1; transform: none; } }
.cosmo-swipe-r { animation: cosmo-swipe-r .5s cubic-bezier(.22,1,.36,1) both; }
.cosmo-swipe-l { animation: cosmo-swipe-l .5s cubic-bezier(.22,1,.36,1) both; }
@keyframes cosmo-progress { from { width: 0%; } to { width: 100%; } }
.cosmo-progress-bar { animation: cosmo-progress 5s linear forwards; }
@media (prefers-reduced-motion: reduce) { .cosmo-swipe-r,.cosmo-swipe-l,.cosmo-progress-bar { animation: none !important; } }`}</style>

      <div key={slide.id} className={dir === 1 ? 'cosmo-swipe-r' : 'cosmo-swipe-l'} aria-live="polite">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 backdrop-blur">
            <Icon className="h-3.5 w-3.5" />
            {kicker}
          </span>
        </div>
        <h1 className="mt-3 max-w-xl font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">{sub}</p>
        {!loc && slide.footer ? (
          slide.footer
        ) : (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {badge}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-8 rounded-full bg-white" />
          <span className="h-1.5 w-2.5 rounded-full bg-white/40" />
          <span className="h-1.5 w-2.5 rounded-full bg-white/25" />
          <span className="flex items-center gap-1 font-mono text-[11px] text-white/60">∞</span>
        </div>
        <div className="ml-1 flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} aria-label="Previous motivation" className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => go(1)} aria-label="Next motivation" className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setPaused((p) => !p)} aria-label={paused ? 'Play auto-rotation' : 'Pause auto-rotation'} className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        </div>
        <span className="ml-1 font-mono text-[11px] tabular-nums text-white/50">continuous</span>
      </div>

      <div className="mt-3 h-0.5 w-40 overflow-hidden rounded-full bg-white/15">
        {!paused && <div key={index} className="cosmo-progress-bar h-full rounded-full bg-white/80" />}
      </div>
    </div>
  );
};
