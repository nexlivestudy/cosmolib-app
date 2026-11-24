import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LANG, LANG_STORAGE_KEY, WORLD_LANGUAGES, getLanguageMeta } from '../lib/languages';

interface LangCtx {
  lang: string;
  setLang: (c: string) => void;
  translating: boolean;
}

const Ctx = createContext<LangCtx>({ lang: DEFAULT_LANG, setLang: () => {}, translating: false });

export const useLanguage = () => useContext(Ctx);

// --- tiny Google translate cache ---
const memCache = new Map<string, string>();
function cacheKey(lang: string, text: string) {
  return lang + '::' + text;
}
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

async function translateBatch(lang: string, texts: string[]): Promise<string[]> {
  if (lang === 'en' || texts.length === 0) return texts;
  const disk = readDisk(lang);
  const out: string[] = new Array(texts.length).fill('');
  const missing: { idx: number; text: string }[] = [];
  texts.forEach((t, i) => {
    const k = cacheKey(lang, t);
    if (memCache.has(k)) out[i] = memCache.get(k)!;
    else if (disk[t]) { out[i] = disk[t]; memCache.set(k, disk[t]); }
    else missing.push({ idx: i, text: t });
  });
  if (missing.length === 0) return out;
  // batch in chunks of 15 to keep URL short
  for (let s = 0; s < missing.length; s += 15) {
    const chunk = missing.slice(s, s + 15);
    try {
      const base = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t';
      const params = '&tl=' + encodeURIComponent(lang.split('-')[0]) + chunk.map((m) => '&q=' + encodeURIComponent(m.text)).join('');
      const res = await fetch(base + params);
      if (!res.ok) throw new Error('mt fail');
      const json = await res.json();
      // json is array of translations per q when multiple q params: shape varies.
      // For single-q it is [[ [translated,...] ]]. For multi-q Google returns array per q.
      let arr: string[] = [];
      if (Array.isArray(json) && Array.isArray(json[0]) && typeof json[0][0] === 'string') {
        // single block -> only handles 1; fallback per-item fetch
        arr = [json[0].map((x: any) => x[0]).join('')];
      } else if (Array.isArray(json)) {
        arr = json.map((block: any) => Array.isArray(block) ? block.map((x: any) => x?.[0] || '').join('') : '');
      }
      if (arr.length === chunk.length) {
        chunk.forEach((m, ci) => {
          const tr = arr[ci] || m.text;
          out[m.idx] = tr;
          memCache.set(cacheKey(lang, m.text), tr);
          disk[m.text] = tr;
        });
      } else {
        // fallback: one-by-one
        for (const m of chunk) {
          try {
            const r1 = await fetch(base + '&tl=' + encodeURIComponent(lang.split('-')[0]) + '&q=' + encodeURIComponent(m.text));
            const j1 = await r1.json();
            const tr = Array.isArray(j1?.[0]) ? j1[0].map((x: any) => x[0]).join('') : m.text;
            out[m.idx] = tr;
            memCache.set(cacheKey(lang, m.text), tr);
            disk[m.text] = tr;
          } catch { out[m.idx] = m.text; }
        }
      }
    } catch {
      chunk.forEach((m) => { out[m.idx] = m.text; });
    }
  }
  writeDisk(lang, disk);
  return out;
}

function isSkippable(el: Element | null): boolean {
  if (!el) return false;
  if (el.closest('[data-keep-english="true"]')) return true;
  if (el.closest('script,style,code,pre')) return true;
  return false;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG; } catch { return DEFAULT_LANG; }
  });
  const [translating, setTranslating] = useState(false);
  const langRef = useRef(lang);
  langRef.current = lang;

  const setLang = useCallback((c: string) => {
    if (!WORLD_LANGUAGES.find((l) => l.code === c)) c = 'en';
    try { localStorage.setItem(LANG_STORAGE_KEY, c); } catch {}
    setLangState(c);
  }, []);

  // html lang + dir
  useEffect(() => {
    const meta = getLanguageMeta(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
  }, [lang]);

  // Global auto-translate: translates visible text + placeholders, keeps English in [data-keep-english]
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

    const run = async () => {
      if (langRef.current === 'en') { restoreEnglish(); setTranslating(false); return; }
      setTranslating(true);
      // collect text nodes
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const v = node.nodeValue?.trim();
          if (!v || v.length < 2) return NodeFilter.FILTER_REJECT;
          if (!node.parentElement) return NodeFilter.FILTER_REJECT;
          if (isSkippable(node.parentElement)) return NodeFilter.FILTER_REJECT;
          if (/^[0-9\s.,:%\/\-+@]+$/.test(v)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes: Text[] = [];
      const seen = new Set<string>();
      const uniq: string[] = [];
      while (walker.nextNode()) {
        const tn = walker.currentNode as Text;
        const v = (tn.nodeValue || '').trim();
        if (!v) continue;
        nodes.push(tn);
        if (!seen.has(v) && v.length < 300) { seen.add(v); uniq.push(v); }
      }
      // placeholders + aria-labels
      const phEls: HTMLElement[] = [];
      document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach((el) => {
        if (isSkippable(el)) return;
        const ph = (el as HTMLElement).getAttribute('placeholder') || '';
        if (ph && ph.length >= 2 && !seen.has(ph)) { seen.add(ph); uniq.push(ph); }
        phEls.push(el as HTMLElement);
      });
      if (uniq.length === 0) { setTranslating(false); return; }
      const out = await translateBatch(langRef.current, uniq.slice(0, 120));
      if (cancelled) return;
      const map = new Map<string, string>();
      uniq.slice(0, 120).forEach((k, i) => map.set(k, out[i] || k));
      nodes.forEach((tn) => {
        const v = (tn.nodeValue || '').trim();
        const tr = map.get(v);
        if (tr && tr !== v && tn.parentElement && !tn.parentElement.hasAttribute('data-orig-text')) {
          tn.parentElement.setAttribute('data-orig-text', v);
          tn.nodeValue = tn.nodeValue?.replace(v, tr);
        }
      });
      phEls.forEach((el) => {
        const ph = el.getAttribute('placeholder') || '';
        const tr = map.get(ph);
        if (tr && tr !== ph && !el.hasAttribute('data-orig-ph')) {
          el.setAttribute('data-orig-ph', ph);
          el.setAttribute('placeholder', tr);
        }
      });
      setTranslating(false);
    };

    if (lang === 'en') { restoreEnglish(); }
    else {
      const t = window.setTimeout(run, 400);
      observer = new MutationObserver(() => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(run, 1200);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: false });
      return () => { cancelled = true; window.clearTimeout(t); observer?.disconnect(); window.clearTimeout(debounce); };
    }
    return () => { cancelled = true; observer?.disconnect(); };
  }, [lang]);

  const val = useMemo(() => ({ lang, setLang, translating }), [lang, setLang, translating]);
  return <Ctx.Provider value={val}>{children}</Ctx.Provider>;
};
