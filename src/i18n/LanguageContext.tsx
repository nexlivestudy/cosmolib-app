import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LANG, LANG_STORAGE_KEY, WORLD_LANGUAGES, getLanguageMeta } from '../lib/languages';

interface LangCtx {
  lang: string;
  setLang: (c: string) => void;
  translating: boolean;
}

const Ctx = createContext<LangCtx>({ lang: DEFAULT_LANG, setLang: () => {}, translating: false });

export const useLanguage = () => useContext(Ctx);

const memCache = new Map<string, string>();
function readDisk(lang: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem('cosmolib_mt_' + lang) || '{}');
  } catch { return {}; }
}
function writeDisk(lang: string, obj: Record<string, string>) {
  try {
    const keys = Object.keys(obj).slice(-800);
    const slim: Record<string, string> = {};
    keys.forEach((k) => { slim[k] = obj[k]; });
    localStorage.setItem('cosmolib_mt_' + lang, JSON.stringify(slim));
  } catch {}
}

// Single-query Google translate — simple response shape, reliable.
// https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&tl=hi&q=TEXT
async function translateOne(lang: string, text: string): Promise<string> {
  const tl = lang.split('-')[0];
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&tl=' + encodeURIComponent(tl) + '&q=' + encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error('mt ' + res.status);
  const json = await res.json();
  if (Array.isArray(json?.[0])) {
    return json[0].map((x: any) => (Array.isArray(x) ? x[0] : '')).join('') || text;
  }
  return text;
}

async function translateList(lang: string, texts: string[]): Promise<string[]> {
  if (lang === 'en' || texts.length === 0) return texts;
  const disk = readDisk(lang);
  const out: string[] = new Array(texts.length).fill('');
  const missing: { idx: number; text: string }[] = [];
  texts.forEach((t, i) => {
    const k = lang + '::' + t;
    if (memCache.has(k)) out[i] = memCache.get(k)!;
    else if (disk[t]) { out[i] = disk[t]; memCache.set(k, disk[t]); }
    else missing.push({ idx: i, text: t });
  });
  // concurrency 6, one-by-one (reliable parsing)
  const pool = 6;
  for (let s = 0; s < missing.length; s += pool) {
    const chunk = missing.slice(s, s + pool);
    await Promise.all(chunk.map(async (m) => {
      try {
        const tr = await translateOne(lang, m.text);
        out[m.idx] = tr;
        memCache.set(lang + '::' + m.text, tr);
        disk[m.text] = tr;
      } catch {
        out[m.idx] = m.text;
      }
    }));
  }
  writeDisk(lang, disk);
  return out;
}

function isSkippable(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest('script,style,code,pre')) return false;
  return false;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG; } catch { return DEFAULT_LANG; }
  });
  const [translating, setTranslating] = useState(false);
  const langRef = useRef(lang);
  langRef.current = lang;
  const runId = useRef(0);
  const busyRef = useRef(false);
  const queuedRef = useRef(false);

  const setLang = useCallback((c: string) => {
    if (!WORLD_LANGUAGES.find((l) => l.code === c)) c = 'en';
    try { localStorage.setItem(LANG_STORAGE_KEY, c); } catch {}
    setLangState(c);
  }, []);

  useEffect(() => {
    const meta = getLanguageMeta(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let debounce: number | undefined;

    const restoreEnglish = () => {
      document.querySelectorAll('[data-orig-text]').forEach((el) => {
        const o = (el as HTMLElement).dataset.origText;
        if (o != null) (el as HTMLElement).textContent = o;
        delete (el as HTMLElement).dataset.origText;
      });
      document.querySelectorAll('[data-orig-ph]').forEach((el) => {
        const o = (el as HTMLElement).dataset.origPh;
        if (o != null) (el as HTMLElement).setAttribute('placeholder', o);
        delete (el as HTMLElement).dataset.origPh;
      });
      document.querySelectorAll('[data-orig-aria]').forEach((el) => {
        const o = (el as HTMLElement).dataset.origAria;
        if (o != null) (el as HTMLElement).setAttribute('aria-label', o);
        delete (el as HTMLElement).dataset.origAria;
      });
    };

    const collect = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const v = node.nodeValue?.trim();
          if (!v || v.length < 2) return NodeFilter.FILTER_REJECT;
          const p = node.parentElement;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (p.closest('script,style,code,pre')) return NodeFilter.FILTER_REJECT;
          if (p.closest('[data-orig-text]')) return NodeFilter.FILTER_REJECT; // already translated
          if (/^[0-9\s.,:%\/\-+@]+$/.test(v)) return NodeFilter.FILTER_REJECT;
          if (v.length > 280) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes: Text[] = [];
      const seen = new Map<string, string>();
      while (walker.nextNode()) {
        const tn = walker.currentNode as Text;
        const v = (tn.nodeValue || '').trim();
        if (!v || seen.has(v)) continue;
        seen.set(v, v);
        nodes.push(tn);
        if (seen.size >= 80) break;
      }
      const phEls: HTMLElement[] = [];
      document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach((el) => {
        if ((el as HTMLElement).hasAttribute('data-orig-ph')) return;
        const ph = (el as HTMLElement).getAttribute('placeholder') || '';
        if (ph && ph.length >= 2 && !seen.has(ph) && seen.size < 90) { seen.set(ph, ph); phEls.push(el as HTMLElement); }
      });
      return { nodes, uniq: [...seen.keys()], phEls };
    };

    const run = async () => {
      if (langRef.current === 'en') { restoreEnglish(); setTranslating(false); return; }
      if (busyRef.current) { queuedRef.current = true; return; } // carousel rotated mid-run: finish current batch first, then pick up new strings
      busyRef.current = true;
      setTranslating(true);
      const { nodes, uniq, phEls } = collect();
      if (uniq.length === 0) { busyRef.current = false; if (!cancelled) setTranslating(false); return; }
      const out = await translateList(langRef.current, uniq);
      const map = new Map<string, string>();
      uniq.forEach((k, i) => map.set(k, out[i] || k));
      nodes.forEach((tn) => {
        const v = (tn.nodeValue || '').trim();
        const tr = map.get(v);
        const p = tn.parentElement;
        if (tr && tr !== v && p && !p.hasAttribute('data-orig-text') && p.isConnected) {
          p.setAttribute('data-orig-text', v);
          tn.nodeValue = (tn.nodeValue || '').replace(v, tr);
        }
      });
      phEls.forEach((el) => {
        const ph = el.getAttribute('placeholder') || '';
        const tr = map.get(ph);
        if (tr && tr !== ph && el.isConnected) {
          el.setAttribute('data-orig-ph', ph);
          el.setAttribute('placeholder', tr);
        }
      });
      busyRef.current = false;
      if (!cancelled) setTranslating(false);
      if (queuedRef.current && !cancelled && langRef.current !== 'en') {
        queuedRef.current = false;
        window.setTimeout(run, 600);
      }
    };

    if (lang === 'en') { restoreEnglish(); }
    else {
      const t = window.setTimeout(run, 350);
      observer = new MutationObserver(() => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(run, 2500);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: false });
      return () => { cancelled = true; window.clearTimeout(t); observer?.disconnect(); window.clearTimeout(debounce); };
    }
    return () => { cancelled = true; observer?.disconnect(); };
  }, [lang]);

  const val = useMemo(() => ({ lang, setLang, translating }), [lang, setLang, translating]);
  return <Ctx.Provider value={val}>{children}</Ctx.Provider>;
};
