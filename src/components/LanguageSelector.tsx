import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Globe, Loader2, Search, X } from 'lucide-react';
import { WORLD_LANGUAGES } from '../lib/languages';
import { useLanguage } from '../i18n/LanguageContext';

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { lang, setLang, translating } = useLanguage();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 60, right: 16 });

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) setPos({ top: Math.min(window.innerHeight - 420, r.bottom + 8), right: Math.max(8, window.innerWidth - r.right) });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); document.removeEventListener('keydown', esc); };
  }, [open ]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return WORLD_LANGUAGES;
    return WORLD_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(s) || l.native.toLowerCase().includes(s) || l.code.toLowerCase().includes(s)
    ).slice(0, 100);
  }, [q]);

  const active = WORLD_LANGUAGES.find((l) => l.code === lang) || WORLD_LANGUAGES[0];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen((o) => !o); setQ(''); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={'Choose language - current: ' + active.name}
        title="Choose language"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap sm:px-3 dark:border-white/[0.08] dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 text-indigo-500" />}
        <span className={compact ? 'hidden sm:inline' : ''}>{active.native}</span>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[99999]" role="presentation">
          {/* backdrop - click anywhere to close, sits below panel but above everything else */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          {/* big panel - always in front of tabs, cards, everything */}
          <div
            className="absolute w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111827]"
            style={{ top: pos.top, right: pos.right, maxHeight: 'min(70vh, 420px)', display: 'flex', flexDirection: 'column' }}
            role="listbox"
            aria-label="World languages"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Choose language</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close languages" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="relative border-b border-slate-100 dark:border-slate-800">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search language… e.g. Hindi, Español, 中文"
                aria-label="Search languages"
                className="w-full bg-transparent py-3 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {filtered.map((l) => {
                const on = l.code === lang;
                return (
                  <button
                    key={l.code}
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => { setLang(l.code); setOpen(false); setQ(''); }}
                    className={'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/[0.06] ' + (on ? 'bg-indigo-50 dark:bg-indigo-500/10' : '')}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-slate-900 dark:text-white">{l.native}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{l.name} · {l.code}</span>
                    </span>
                    {on && <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">No language found for “{q}”.</p>
              )}
            </div>
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
              Auto-translates whole app including motivations
            </p>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
