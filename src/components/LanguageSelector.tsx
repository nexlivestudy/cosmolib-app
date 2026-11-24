import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Globe, Loader2, Search } from 'lucide-react';
import { WORLD_LANGUAGES } from '../lib/languages';
import { useLanguage } from '../i18n/LanguageContext';

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const { lang, setLang, translating } = useLanguage();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', esc); };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return WORLD_LANGUAGES;
    return WORLD_LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(s) || l.native.toLowerCase().includes(s) || l.code.toLowerCase().includes(s)
    ).slice(0, 100);
  }, [q]);

  const active = WORLD_LANGUAGES.find((l) => l.code === lang) || WORLD_LANGUAGES[0];

  return (
    <div ref={ref} className="relative z-[9999] isolate">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose language - current: English"
        title="Choose language"
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap sm:px-3 dark:border-white/[0.08] dark:bg-[#111827] dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {translating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5 text-indigo-500" />}
        <span className={compact ? 'hidden sm:inline' : ''}>{active.native}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-[9999] mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/[0.1] dark:bg-[#111827]">
          <div className="relative border-b border-slate-100 dark:border-slate-800">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search language… e.g. Hindi, Español, 中文"
              aria-label="Search languages"
              className="w-full bg-transparent py-2.5 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox" aria-label="World languages">
            {filtered.map((l) => {
              const on = l.code === lang;
              return (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => { setLang(l.code); setOpen(false); setQ(''); }}
                  className={'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/[0.06] ' + (on ? 'bg-indigo-50 dark:bg-indigo-500/10' : '')}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-900 dark:text-white">{l.native}</span>
                    <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{l.name} · {l.code}</span>
                  </span>
                  {on && <Check className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-xs text-slate-500 dark:text-slate-400">No language found for “{q}”.</p>
            )}
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Auto-translates whole app including motivations
          </p>
        </div>
      )}
    </div>
  );
};
