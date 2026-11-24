import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const SLIDES: Slide[] = [
  {
    id: 'lock-in',
    kicker: 'Global AI Study Computer · Zero-Distraction Architecture',
    title: (
      <>
        Lock in every exam, folder, and{' '}
        <span style={{ backgroundImage: 'linear-gradient(90deg, var(--cosmo-accent), var(--cosmo-accent2))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
          study room
        </span>{' '}
        in one place.
      </>
    ),
    sub: 'Your entire semester — organized, scheduled and accountable.',
    badge: 'All-in-one desk',
    icon: Sparkles,
    footer: (
      <div className="mt-5 grid max-w-md grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-300">
        <span>01. AI Smart Study Folders</span>
        <span>02. Exam Panic Mode</span>
        <span>03. Smart Study Schedule</span>
        <span>04. Silent Live-Cam Rooms</span>
      </div>
    ),
  },
  {
    id: 'mind-power',
    kicker: 'Mind Power · You Are Stronger Than Distraction',
    title: <>Your mind obeys training. Train it daily.</>,
    sub: 'Focus is a muscle. Every 25-minute block makes your brain sharper, calmer and harder to distract.',
    badge: 'Mind over mood',
    icon: Brain,
  },
  {
    id: 'consistency',
    kicker: 'Consistency > Motivation',
    title: <>Small daily wins beat last-night panic.</>,
    sub: '4 hours daily, streaks and gentle nudges keep you moving even on low-energy days. Show up — the app handles the rest.',
    badge: '1% better daily = 37x in a year',
    icon: Flame,
  },
  {
    id: 'confidence',
    kicker: 'Confidence Is Built, Not Born',
    title: <>Toppers are not born. They are built.</>,
    sub: 'Every concept you master adds proof: I can do hard things. Confidence follows evidence.',
    badge: 'Proof over promises',
    icon: Trophy,
  },
  {
    id: 'tasks',
    kicker: 'Tasks → Done · No Overwhelm',
    title: <>Turn a scary syllabus into tiny doable tasks.</>,
    sub: 'Folders break PDFs and lectures into concepts. Mastery trees show exactly what is left. Just pick the next small task.',
    badge: 'Syllabus to checklist',
    icon: FolderKanban,
  },
  {
    id: 'focus-hour',
    kicker: 'Deep Focus Mode',
    title: <>One focused hour beats five distracted hours.</>,
    sub: 'Calls-only filter, meditation Strict Mode and silent live cams keep you honest for 25 / 50-minute blocks.',
    badge: '25-min blocks · calls-only',
    icon: Clock,
  },
  {
    id: 'unstoppable',
    kicker: 'Power Mode · Become Unstoppable',
    title: <>Discipline makes you dangerous to average.</>,
    sub: 'No zero days. Even 20 minutes counts. Momentum loves a starter — start small, finish strong.',
    badge: 'No zero days',
    icon: Zap,
  },
  {
    id: 'memory',
    kicker: 'Smart Memory · Remember Longer',
    title: <>Revision beats re-reading. Every time.</>,
    sub: 'Spaced recall + rescue packs lock formulas and concepts into long-term memory before the exam.',
    badge: 'Recall > re-read',
    icon: Target,
  },
  {
    id: 'exam-courage',
    kicker: 'Exam Courage · Fear Is a Liar',
    title: <>The paper fears a prepared mind.</>,
    sub: 'Upload syllabus + PYQs, generate rescue PDFs and graded mocks. Walk in knowing you have seen this before.',
    badge: 'Prepared > scared',
    icon: ShieldCheck,
  },
  {
    id: 'together',
    kicker: 'Never Study Alone',
    title: <>When they lock in, you lock in.</>,
    sub: 'Silent live-cam rooms, shared vault and 1-to-1 accountability. Your cohort pulls you forward.',
    badge: 'Live cohort power',
    icon: Users,
  },
  {
    id: 'yesterday',
    kicker: 'You vs Yesterday',
    title: <>Beat only one person: yesterday\u2019s you.</>,
    sub: 'Track minutes, streaks and mastery. Small progress daily becomes impossible to ignore.',
    badge: 'Progress you can see',
    icon: Crown,
  },
  {
    id: 'launch',
    kicker: 'Future You Is Watching',
    title: <>Study now, thank yourself later.</>,
    sub: 'Press Start on a focus block or open Exam Panic. Your future rank is built in this exact hour.',
    badge: 'Start now · 5-sec rule',
    icon: Rocket,
  },
];

export const MotivationalShowcase: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback((d: 1 | -1) => {
    setDir(d);
    setIndex((p) => (p + d + SLIDES.length) % SLIDES.length);
  }, []);

  const goTo = useCallback((i: number) => {
    setIndex((p) => {
      setDir(i > p ? 1 : -1);
      return i;
    });
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

  const slide = SLIDES[index];
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
            {slide.kicker}
          </span>
        </div>
        <h1 className="mt-3 max-w-xl font-display text-2xl font-bold leading-tight text-white sm:text-4xl">
          {slide.title}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-300">{slide.sub}</p>
        {slide.footer ? (
          slide.footer
        ) : (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {slide.badge}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="flex max-w-[220px] flex-wrap items-center gap-1.5" role="tablist" aria-label="Motivational slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={'Show: ' + s.kicker}
              onClick={() => goTo(i)}
              className={'h-1.5 rounded-full transition-all ' + (i === index ? 'w-8 bg-white' : 'w-2.5 bg-white/30 hover:bg-white/60')}
            />
          ))}
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
        <span className="ml-1 font-mono text-[11px] tabular-nums text-white/50">
          {index + 1} / {SLIDES.length}
        </span>
      </div>

      <div className="mt-3 h-0.5 w-40 overflow-hidden rounded-full bg-white/15">
        {!paused && <div key={index} className="cosmo-progress-bar h-full rounded-full bg-white/80" />}
      </div>
    </div>
  );
};
