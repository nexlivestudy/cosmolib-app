import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flame, FolderKanban, Pause, Play, Sparkles, Users } from 'lucide-react';

interface Slide {
  id: string;
  kicker: string;
  title: React.ReactNode;
  sub: string;
  footer?: React.ReactNode;
  icon: React.ElementType;
  badge: string;
}

const READ_MS = 5500;

const SLIDES: Slide[] = [
  {
    id: 'lock-in',
    kicker: 'Global AI Study Computer · Zero-Distraction Architecture',
    title: (
      <>
        Lock in every exam, folder, and{' '}
        <span
          style={{
            backgroundImage: 'linear-gradient(90deg, var(--cosmo-accent), var(--cosmo-accent2))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          study room
        </span>{' '}
        in one place.
      </>
    ),
    sub: 'Your entire semester — organized, scheduled and accountable.',
    icon: Sparkles,
    badge: 'All-in-one desk',
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
    id: 'consistency',
    kicker: 'Consistency > Motivation',
    title: <>Small daily wins beat last-night panic.</>,
    sub: '4h daily target, streaks and gentle nudges keep you moving even on low-energy days. Show up, the app handles the rest.',
    icon: Flame,
    badge: 'Streak power · 1% better daily = 37x in a year',
  },
  {
    id: 'tasks',
    kicker: 'Tasks → Done',
    title: <>Turn a scary syllabus into tiny doable tasks.</>,
    sub: 'Folders break PDFs + YouTube into concepts. Mastery trees show exactly what is left. Just pick the next small task.',
    icon: FolderKanban,
    badge: 'Syllabus to checklist',
  },
  {
    id: 'focus',
    kicker: 'Deep Focus Mode',
    title: <>One timer. Zero distractions. Full presence.</>,
    sub: 'Calls-only filter, meditation Strict Mode and silent live cams keep you honest for 25 / 50-min blocks.',
    icon: Clock,
    badge: '25-min blocks · calls-only',
  },
  {
    id: 'together',
    kicker: 'Never Study Alone',
    title: <>When they lock in, you lock in.</>,
    sub: 'Join your university + branch cohort. Silent live-cam rooms, shared vault and 1-to-1 accountability.',
    icon: Users,
    badge: 'Live cohort accountability',
  },
];

export const MotivationalShowcase: React.FC = () => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  const go = useCallback((dir: 1 | -1) => {
    setIndex((p) => (p + dir + SLIDES.length) % SLIDES.length);
  }, []);

  const goTo = useCallback((i: number) => setIndex(i), []);

  // Auto-rotate like Duolingo / Headspace / Blinkist hero reels:
  // readable pause (5.5s) -> next motivation -> infinite loop.
  // Pauses on hover / focus / manual pause for readability + a11y.
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => {
      setIndex((p) => (p + 1) % SLIDES.length);
    }, READ_MS);
    return () => window.clearTimeout(t);
  }, [index, paused]);

  const slide = SLIDES[index];
  const Icon = slide.icon;

  return (
    <div
      className="relative z-10 p-6 pt-20 sm:p-10 sm:pt-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <style>{`@keyframes cosmo-slide-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.cosmo-slide-enter { animation: cosmo-slide-up .55s cubic-bezier(.22,1,.36,1) both; }
@keyframes cosmo-progress { from { width: 0%; } to { width: 100%; } }
.cosmo-progress-bar { animation: cosmo-progress 5.5s linear forwards; }
@media (prefers-reduced-motion: reduce) { .cosmo-slide-enter, .cosmo-progress-bar { animation: none !important; } }`}</style>

      <div key={slide.id} className="cosmo-slide-enter" aria-live="polite">
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

      {/* Controls: dots + arrows + pause — same pattern as big consumer apps */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Motivational slides">
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={'Show: ' + s.kicker}
              onClick={() => goTo(i)}
              className={
                'h-1.5 rounded-full transition-all ' +
                (i === index ? 'w-8 bg-white' : 'w-3 bg-white/30 hover:bg-white/60')
              }
            />
          ))}
        </div>
        <div className="ml-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous motivation"
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next motivation"
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Play auto-rotation' : 'Pause auto-rotation'}
            className="rounded-full p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
        </div>
        <span className="ml-1 font-mono text-[11px] tabular-nums text-white/50">
          {index + 1} / {SLIDES.length}
        </span>
      </div>

      {/* Readable-time progress */}
      <div className="mt-3 h-0.5 w-40 overflow-hidden rounded-full bg-white/15">
        {!paused && <div key={index} className="cosmo-progress-bar h-full rounded-full bg-white/80" />}
      </div>
    </div>
  );
};
