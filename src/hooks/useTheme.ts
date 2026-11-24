import { useEffect, useState } from 'react';
import type { ThemeMode } from '../types';
import { DEFAULT_COSMO_THEME, getCosmoTheme, type CosmoThemeId } from '../themes';

const THEME_KEY = 'nexlive_theme';
const COSMO_THEME_KEY = 'cosmolib_theme_id';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0B0F19' : '#F8FAFC');
    }

    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const [cosmoThemeId, setCosmoThemeId] = useState<CosmoThemeId>(() => {
    try {
      const saved = localStorage.getItem(COSMO_THEME_KEY) as CosmoThemeId | null;
      if (saved) return getCosmoTheme(saved).id;
    } catch {
      // ignore
    }
    return DEFAULT_COSMO_THEME;
  });

  const setCosmoTheme = (id: CosmoThemeId) => {
    const next = getCosmoTheme(id);
    setCosmoThemeId(next.id);
    setTheme(next.base);
  };

  useEffect(() => {
    const root = document.documentElement;
    const def = getCosmoTheme(cosmoThemeId);
    root.dataset.theme = def.id;
    const vars = def.vars;
    for (const k of Object.keys(vars)) {
      root.style.setProperty(k, vars[k]);
    }
    try {
      localStorage.setItem(COSMO_THEME_KEY, def.id);
    } catch {
      // ignore
    }
  }, [cosmoThemeId]);

  const toggleTheme = () => {
    setCosmoThemeId((prev) => (getCosmoTheme(prev).base === 'dark' ? 'minimal-glass' : 'galaxy-pro'));
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, setTheme, toggleTheme, cosmoThemeId, setCosmoTheme };
}
