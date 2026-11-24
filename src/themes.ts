export type CosmoThemeId =
  | 'galaxy-pro'
  | 'neon-dream'
  | 'ocean-breeze'
  | 'dark-aurora'
  | 'minimal-glass'
  | 'royal-library';

export interface CosmoTheme {
  id: CosmoThemeId;
  name: string;
  tagline: string;
  base: 'dark' | 'light';
  blurb: string;
  /** main preview gradient for cards */
  preview: string;
  /** phone preview gradient */
  previewPhone: string;
  vars: Record<string, string>;
  particles: { count: number; mobileCount: number; speed: number };
}

export const DEFAULT_COSMO_THEME: CosmoThemeId = 'galaxy-pro';

export const COSMO_THEMES: CosmoTheme[] = [
  {
    id: 'galaxy-pro',
    name: 'Galaxy Pro',
    tagline: 'Deep-space focus command',
    base: 'dark',
    blurb: 'Cosmic stars, violet nebula drift, orbital glow.',
    preview: 'linear-gradient(135deg,#1b1040 0%,#5b21b6 45%,#0ea5e9 100%)',
    previewPhone: 'linear-gradient(180deg,#12082e 0%,#4c1d95 60%,#0c4a6e 100%)',
    vars: {
      '--cosmo-bg0': '#070312',
      '--cosmo-bg1': '#150a3a',
      '--cosmo-accent': '#8b5cf6',
      '--cosmo-accent2': '#22d3ee',
      '--cosmo-glow': 'rgba(139,92,246,.55)',
      '--cosmo-btn1': '#7c3aed',
      '--cosmo-btn2': '#4f46e5',
      '--cosmo-btn-edge': '#a78bfa',
      '--cosmo-orb1': 'rgba(139,92,246,.35)',
      '--cosmo-orb2': 'rgba(34,211,238,.28)',
    },
    particles: { count: 110, mobileCount: 45, speed: 0.35 },
  },
  {
    id: 'neon-dream',
    name: 'Neon Dream',
    tagline: 'Gaming-energy study arena',
    base: 'dark',
    blurb: 'Magenta-cyan reflections, glowing grid energy.',
    preview: 'linear-gradient(135deg,#2b0a3d 0%,#d946ef 50%,#22d3ee 100%)',
    previewPhone: 'linear-gradient(180deg,#20062e 0%,#a21caf 60%,#0e7490 100%)',
    vars: {
      '--cosmo-bg0': '#12041f',
      '--cosmo-bg1': '#3b0764',
      '--cosmo-accent': '#e879f9',
      '--cosmo-accent2': '#22d3ee',
      '--cosmo-glow': 'rgba(232,121,249,.55)',
      '--cosmo-btn1': '#c026d3',
      '--cosmo-btn2': '#7c3aed',
      '--cosmo-btn-edge': '#f0abfc',
      '--cosmo-orb1': 'rgba(232,121,249,.4)',
      '--cosmo-orb2': 'rgba(34,211,238,.3)',
    },
    particles: { count: 90, mobileCount: 40, speed: 0.5 },
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    tagline: 'Calm waves, clear mind',
    base: 'dark',
    blurb: 'Blue tide gradients, drifting light bubbles.',
    preview: 'linear-gradient(135deg,#082f46 0%,#0ea5e9 55%,#bae6fd 100%)',
    previewPhone: 'linear-gradient(180deg,#082f49 0%,#0284c7 60%,#7dd3fc 100%)',
    vars: {
      '--cosmo-bg0': '#04121f',
      '--cosmo-bg1': '#0c4a6e',
      '--cosmo-accent': '#38bdf8',
      '--cosmo-accent2': '#2dd4bf',
      '--cosmo-glow': 'rgba(56,189,248,.5)',
      '--cosmo-btn1': '#0284c7',
      '--cosmo-btn2': '#0e7490',
      '--cosmo-btn-edge': '#7dd3fc',
      '--cosmo-orb1': 'rgba(56,189,248,.35)',
      '--cosmo-orb2': 'rgba(45,212,191,.3)',
    },
    particles: { count: 80, mobileCount: 35, speed: 0.4 },
  },
  {
    id: 'dark-aurora',
    name: 'Dark Aurora',
    tagline: 'Northern-light flow state',
    base: 'dark',
    blurb: 'Emerald ribbons over deep black.',
    preview: 'linear-gradient(135deg,#02120e 0%,#059669 50%,#22d3ee 100%)',
    previewPhone: 'linear-gradient(180deg,#01110d 0%,#047857 60%,#0e7490 100%)',
    vars: {
      '--cosmo-bg0': '#020d0a',
      '--cosmo-bg1': '#064e3b',
      '--cosmo-accent': '#34d399',
      '--cosmo-accent2': '#22d3ee',
      '--cosmo-glow': 'rgba(52,211,153,.5)',
      '--cosmo-btn1': '#059669',
      '--cosmo-btn2': '#0d9488',
      '--cosmo-btn-edge': '#6ee7b7',
      '--cosmo-orb1': 'rgba(52,211,153,.35)',
      '--cosmo-orb2': 'rgba(34,211,238,.3)',
    },
    particles: { count: 85, mobileCount: 38, speed: 0.45 },
  },
  {
    id: 'minimal-glass',
    name: 'Minimal Glass',
    tagline: 'Light, clean, calm clarity',
    base: 'light',
    blurb: 'Lavender glass, soft shadows, airy light.',
    preview: 'linear-gradient(135deg,#f5f3ff 0%,#ddd6fe 50%,#bae6fd 100%)',
    previewPhone: 'linear-gradient(180deg,#ffffff 0%,#ede9fe 60%,#e0f2fe 100%)',
    vars: {
      '--cosmo-bg0': '#f8fafc',
      '--cosmo-bg1': '#ede9fe',
      '--cosmo-accent': '#7c3aed',
      '--cosmo-accent2': '#0284c7',
      '--cosmo-glow': 'rgba(124,58,237,.25)',
      '--cosmo-btn1': '#7c3aed',
      '--cosmo-btn2': '#4f46e5',
      '--cosmo-btn-edge': '#c4b5fd',
      '--cosmo-orb1': 'rgba(167,139,250,.4)',
      '--cosmo-orb2': 'rgba(125,211,252,.45)',
    },
    particles: { count: 60, mobileCount: 28, speed: 0.3 },
  },
  {
    id: 'royal-library',
    name: 'Royal Library',
    tagline: 'Gold-standard scholarship',
    base: 'dark',
    blurb: 'Warm amber lamplight, premium gold depth.',
    preview: 'linear-gradient(135deg,#1c1005 0%,#b45309 55%,#fbbf24 100%)',
    previewPhone: 'linear-gradient(180deg,#170d04 0%,#92400e 60%,#d97706 100%)',
    vars: {
      '--cosmo-bg0': '#120a04',
      '--cosmo-bg1': '#451a03',
      '--cosmo-accent': '#fbbf24',
      '--cosmo-accent2': '#fb923c',
      '--cosmo-glow': 'rgba(251,191,36,.45)',
      '--cosmo-btn1': '#b45309',
      '--cosmo-btn2': '#92400e',
      '--cosmo-btn-edge': '#fcd34d',
      '--cosmo-orb1': 'rgba(251,191,36,.32)',
      '--cosmo-orb2': 'rgba(251,146,60,.28)',
    },
    particles: { count: 70, mobileCount: 30, speed: 0.25 },
  },
];

export function getCosmoTheme(id: string | null | undefined) {
  return COSMO_THEMES.find((t) => t.id === id) ?? COSMO_THEMES[0];
}
