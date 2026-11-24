import React from 'react';
import { Check } from 'lucide-react';
import { COSMO_THEMES, type CosmoThemeId } from '../themes';

interface Props {
  activeId: CosmoThemeId;
  onSelect: (id: CosmoThemeId) => void;
}

export const ThemeGallery: React.FC<Props> = ({ activeId, onSelect }) => {
  return (
    <div className="w-full">
      <div className="mb-5 text-center sm:text-left">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">CosmoLib premium themes</p>
        <h2 className="font-display mt-1 text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">Choose your vibe</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Six living worlds. Same CosmoLib — pick the one that makes you say WOW.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {COSMO_THEMES.map((t) => {
          const active = t.id === activeId;
          return (
            <div key={t.id} className={"cosmo-theme-card cosmo-card p-4 transition-all " + (active ? "cosmo-select-active ring-2 ring-indigo-500 shadow-lg" : "")}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-extrabold text-slate-900 dark:text-white">{t.name}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t.tagline}</p>
                </div>
                {active && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
                    <Check className="h-3.5 w-3.5" /> Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.blurb}</p>
              <div className="mt-3 flex gap-3">
                <div className="relative hidden h-36 flex-1 overflow-hidden rounded-xl border border-black/10 sm:block" style={{ background: t.preview }} aria-label={t.name + ' desktop preview'}>
                  <div className="absolute left-3 top-3 h-2 w-16 rounded-full bg-white/40" />
                  <div className="absolute left-3 top-7 h-3 w-2/3 rounded bg-white/70" />
                  <div className="absolute left-3 top-12 h-3 w-1/2 rounded bg-white/50" />
                  <div className="absolute bottom-3 left-3 h-7 w-24 rounded-lg bg-white/85" />
                  <div className="absolute bottom-3 right-3 h-7 w-7 rounded-full bg-white/50" />
                </div>
                <div className="relative mx-auto h-36 w-20 shrink-0 overflow-hidden rounded-[1.4rem] border-2 border-black/20" style={{ background: t.previewPhone }} aria-label={t.name + ' mobile preview'}>
                  <div className="absolute left-1/2 top-1.5 h-1 w-8 -translate-x-1/2 rounded-full bg-black/40" />
                  <div className="absolute left-2 right-2 top-5 h-2 rounded bg-white/70" />
                  <div className="absolute left-2 right-2 top-9 h-2 rounded bg-white/45" />
                  <div className="absolute bottom-2 left-2 right-2 h-6 rounded-lg bg-white/85" />
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                aria-pressed={active}
                className={"cosmo-btn-3d mt-4 w-full px-4 py-2.5 text-sm " + (active ? "opacity-90" : "")}
              >
                {active ? 'Selected — looking stunning' : 'Select ' + t.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
