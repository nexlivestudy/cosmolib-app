import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LANG, LANG_STORAGE_KEY, WORLD_LANGUAGES, getLanguageMeta } from '../lib/languages';
import { CORE } from './dict';

interface LangCtx {
  lang: string;
  setLang: (c: string) => void;
  translating: boolean;
  t: (key: string) => string;
  /** Translate an array of English strings to the CURRENT language (cached). Resolves instantly for 'en'. */
  translateTexts: (texts: string[]) => Promise<string[]>;
}

const Ctx = createContext<LangCtx>({
  lang: DEFAULT_LANG,
  setLang: () => {},
  translating: false,
  t: (k) => k,
  translateTexts: async (texts) => texts,
});

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

function flatJoin(json: any): string {
  if (Array.isArray(json?.[0])) {
    return json[0].map((x: any) => (Array.isArray(x) ? x[0] : '')).join('');
  }
  return '';
}

// One text, one request (fallback path).
// https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&tl=hi&q=TEXT
async function translateOne(lang: string, text: string): Promise<string> {
  const tl = lang.split('-')[0];
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&tl=' +
    encodeURIComponent(tl) +
    '&q=' +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error('mt ' + res.status);
  const json = await res.json();
  return flatJoin(json) || text;
}

// Batched: many texts in ONE request joined by newline (endpoint preserves \n).
// Falls back to one-by-one when the split count mismatches.
async function translateBatch(lang: string, texts: string[]): Promise<string[]> {
  const tl = lang.split('-')[0];
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&dt=t&tl=' +
    encodeURIComponent(tl) +
    '&q=' +
    encodeURIComponent(texts.join('\n'));
  const res = await fetch(url);
  if (!res.ok) throw new Error('mt ' + res.status);
  const json = await res.json();
  const flat = flatJoin(json);
  const parts = flat.split('\n');
  if (parts.length !== texts.length) {
    // Segment merge/split — translate individually to stay exact.
    return Promise.all(
      texts.map(async (t) => {
        try {
          return await translateOne(lang, t);
        } catch {
          return t;
        }
      })
    );
  }
  return parts.map((p, i) => (p.trim() === '' ? texts[i] : p));
}

async function translateList(lang: string, texts: string[]): Promise<string[]> {
  if (lang === 'en' || texts.length === 0) return texts;
  const disk = readDisk(lang);
  const out: string[] = new Array(texts.length).fill('');
  const missing: { idx: number; text: string }[] = [];
  texts.forEach((t, i) => {
    const k = lang + '::' + t;
    if (memCache.has(k)) out[i] = memCache.get(k)!;
    else if (disk[t]) {
      out[i] = disk[t];
      memCache.set(k, disk[t]);
    } else missing.push({ idx: i, text: t });
  });
  // Group into newline batches (~12 texts / ~1800 chars per request), 4 in flight.
  const batches: { idx: number; text: string }[][] = [];
  let cur: { idx: number; text: string }[] = [];
  let curLen = 0;
  for (const m of missing) {
    if (cur.length >= 12 || curLen + m.text.length > 1800) {
      batches.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(m);
    curLen += m.text.length;
  }
  if (cur.length) batches.push(cur);
  const pool = 4;
  for (let s = 0; s < batches.length; s += pool) {
    const wave = batches.slice(s, s + pool);
    await Promise.all(
      wave.map(async (batch) => {
        try {
          const trs = await translateBatch(
            lang,
            batch.map((b) => b.text)
          );
          batch.forEach((b, j) => {
            const tr = trs[j] || b.text;
            out[b.idx] = tr;
            memCache.set(lang + '::' + b.text, tr);
            disk[b.text] = tr;
          });
        } catch {
          batch.forEach((b) => {
            out[b.idx] = b.text;
          });
        }
      })
    );
  }
  writeDisk(lang, disk);
  return out;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem(LANG_STORAGE_KEY) || DEFAULT_LANG;
    } catch {
      return DEFAULT_LANG;
    }
  });
  const [translating, setTranslating] = useState(false);
  const langRef = useRef(lang);
  langRef.current = lang;
  const prevLangRef = useRef<string>('en');
  const runIdRef = useRef(0);
  const busyRef = useRef(false);
  const queuedRef = useRef(false);

  const setLang = useCallback((c: string) => {
    if (!WORLD_LANGUAGES.find((l) => l.code === c)) c = 'en';
    try {
      localStorage.setItem(LANG_STORAGE_KEY, c);
    } catch {}
    setLangState(c);
  }, []);

  const translateTexts = useCallback(
    async (texts: string[]): Promise<string[]> => {
      const target = langRef.current;
      if (target === 'en' || texts.length === 0) return texts;
      try {
        return await translateList(target, texts);
      } catch {
        return texts;
      }
    },
    []
  );

  useEffect(() => {
    const meta = getLanguageMeta(lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = meta.rtl ? 'rtl' : 'ltr';
  }, [lang]);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let debounce: number | undefined;
    const myRunId = ++runIdRef.current;
    const alive = () => !cancelled && myRunId === runIdRef.current;

    // Restore original English WITHOUT destroying nested markup (icons, spans).
    const restoreEnglish = () => {
      document.querySelectorAll('[data-orig-text]').forEach((el) => {
        const o = (el as HTMLElement).dataset.origText;
        const tr = (el as HTMLElement).dataset.trText;
        if (o != null) {
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          let replaced = false;
          while (walker.nextNode()) {
            const tn = walker.currentNode as Text;
            const cur = tn.nodeValue || '';
            if (tr && cur.includes(tr)) {
              tn.nodeValue = cur.split(tr).join(o);
              replaced = true;
            }
          }
          if (!replaced) {
            (el as HTMLElement).textContent = o;
          }
        }
        delete (el as HTMLElement).dataset.origText;
        delete (el as HTMLElement).dataset.trText;
        delete (el as HTMLElement).dataset.trLang;
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
          // Pre-translated by React (e.g. motivation box in target language) — never touch.
          if (p.closest('[data-translated]')) return NodeFilter.FILTER_REJECT;
          // No Latin letters => not untranslated English (source is always English).
          // Skips already-translated Hindi/Arabic/Chinese etc. so they are never
          // re-sent or mangled, and never flash back.
          if (!/[A-Za-z]/.test(v)) return NodeFilter.FILTER_REJECT;
          // This exact node was already translated to the current language.
          const marked = p.closest('[data-orig-text]') as HTMLElement | null;
          if (marked && (node.nodeValue || '').trim() === marked.dataset.trText) {
            return NodeFilter.FILTER_REJECT;
          }
          if (/^[0-9\s.,:%\/\-+@]+$/.test(v)) return NodeFilter.FILTER_REJECT;
          if (v.length > 500) return NodeFilter.FILTER_REJECT;
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
        if (seen.size >= 150) break;
      }
      // Above-the-fold first => page visibly converts instantly.
      nodes.sort((a, b) => {
        try {
          const ra = a.parentElement?.getBoundingClientRect();
          const rb = b.parentElement?.getBoundingClientRect();
          return (ra?.top ?? 9999) - (rb?.top ?? 9999);
        } catch {
          return 0;
        }
      });
      const phEls: HTMLElement[] = [];
      document.querySelectorAll('input[placeholder],textarea[placeholder]').forEach((el) => {
        if ((el as HTMLElement).hasAttribute('data-orig-ph')) return;
        const ph = (el as HTMLElement).getAttribute('placeholder') || '';
        if (!/[A-Za-z]/.test(ph)) return;
        if (ph && ph.length >= 2 && !seen.has(ph) && seen.size < 170) {
          seen.set(ph, ph);
          phEls.push(el as HTMLElement);
        }
      });
      const ariaEls: HTMLElement[] = [];
      document.querySelectorAll('[aria-label]').forEach((el) => {
        if ((el as HTMLElement).hasAttribute('data-orig-aria')) return;
        const a = (el as HTMLElement).getAttribute('aria-label') || '';
        if (!/[A-Za-z]/.test(a)) return;
        if (a && a.length >= 2 && !seen.has(a) && seen.size < 190) {
          seen.set(a, a);
          ariaEls.push(el as HTMLElement);
        }
      });
      return { nodes, uniq: [...seen.keys()], phEls, ariaEls };
    };

    // Translates whatever is currently untranslated. NEVER restores — so the
    // page can never flash back to English while you stay in a language.
    // Restore happens only on an actual language switch (see below).
    const run = async () => {
      if (langRef.current === 'en') {
        setTranslating(false);
        return;
      }
      if (busyRef.current) {
        queuedRef.current = true;
        return;
      }
      busyRef.current = true;
      setTranslating(true);
      const { nodes, uniq, phEls, ariaEls } = collect();
      if (uniq.length === 0) {
        busyRef.current = false;
        if (alive()) setTranslating(false);
        return;
      }
      const out = await translateList(langRef.current, uniq);
      if (!alive()) {
        busyRef.current = false;
        return;
      }
      const target = langRef.current;
      const map = new Map<string, string>();
      uniq.forEach((k, i) => map.set(k, out[i] || k));
      nodes.forEach((tn) => {
        const v = (tn.nodeValue || '').trim();
        const tr = map.get(v);
        const p = tn.parentElement;
        // Skip if the node changed mid-flight (React re-rendered it).
        if (!tr || tr === v || !p || !p.isConnected) return;
        if ((tn.nodeValue || '').trim() !== v) return;
        if (p.hasAttribute('data-orig-text')) return;
        p.setAttribute('data-orig-text', v);
        p.setAttribute('data-tr-text', tr);
        p.setAttribute('data-tr-lang', target);
        tn.nodeValue = (tn.nodeValue || '').replace(v, tr);
      });
      phEls.forEach((el) => {
        const ph = el.getAttribute('placeholder') || '';
        const tr = map.get(ph);
        if (tr && tr !== ph && el.isConnected && el.getAttribute('placeholder') === ph) {
          el.setAttribute('data-orig-ph', ph);
          el.setAttribute('placeholder', tr);
        }
      });
      ariaEls.forEach((el) => {
        const a = el.getAttribute('aria-label') || '';
        const tr = map.get(a);
        if (tr && tr !== a && el.isConnected && el.getAttribute('aria-label') === a) {
          el.setAttribute('data-orig-aria', a);
          el.setAttribute('aria-label', tr);
        }
      });
      busyRef.current = false;
      if (alive()) setTranslating(false);
      if (queuedRef.current && alive() && langRef.current !== 'en') {
        queuedRef.current = false;
        window.setTimeout(run, 400);
      }
    };

    const prev = prevLangRef.current;
    if (lang === 'en') {
      // Switching back to English: restore once, then stop. No re-translate.
      if (prev !== 'en') restoreEnglish();
      prevLangRef.current = 'en';
      setTranslating(false);
    } else {
      if (prev !== 'en' && prev !== lang) {
        // Language-to-language (e.g. Hindi -> Tamil): start from clean English
        // exactly once, so the old language never pollutes the new one.
        restoreEnglish();
      }
      prevLangRef.current = lang;
      const t = window.setTimeout(run, 250);
      observer = new MutationObserver(() => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(run, 1200);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: false });
      return () => {
        cancelled = true;
        window.clearTimeout(t);
        observer?.disconnect();
        window.clearTimeout(debounce);
      };
    }
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [lang]);

  const t = useCallback((key: string) => CORE[lang]?.[key] ?? key, [lang]);
  const val = useMemo(
    () => ({ lang, setLang, translating, t, translateTexts }),
    [lang, setLang, translating, t, translateTexts]
  );
  return <Ctx.Provider value={val}>{children}</Ctx.Provider>;
};
