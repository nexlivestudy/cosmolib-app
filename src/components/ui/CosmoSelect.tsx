import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export type CosmoOption = { value: string; label: string };

interface CosmoSelectProps {
  id?: string;
  value: string;
  options: CosmoOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}

export const CosmoSelect: React.FC<CosmoSelectProps> = ({ id, value, options, onChange, ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div ref={rootRef} className="relative">
      <button type="button" id={id} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#0B0F19] dark:text-white">
        <span className="truncate">{selected ? selected.label : 'Select an option'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="cosmo-popover-layer absolute left-0 right-0 top-full z-[99990] mt-1.5">
          <ul role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-[#111827]">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <li key={opt.value} role="presentation">
                  <button type="button" role="option" aria-selected={isSelected} onClick={() => { onChange(opt.value); setOpen(false); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${isSelected ? 'cosmo-select-active bg-cyan-500/10 font-semibold text-slate-900 dark:text-white' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/60'}`}>
                    {isSelected ? <Check className="h-4 w-4 shrink-0" /> : <span className="inline-block h-4 w-4 shrink-0" />}
                    <span className="truncate">{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
