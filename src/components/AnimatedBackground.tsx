import React, { useEffect, useRef } from 'react';
import { getCosmoTheme, type CosmoThemeId } from '../themes';

interface Props { themeId: CosmoThemeId; }

/**
 * Living animated background: canvas stars/particles + aurora ribbons + orbs + pointer parallax.
 * Free (no deps), mobile-aware, respects prefers-reduced-motion.
 */
export const AnimatedBackground: React.FC<Props> = ({ themeId }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const def = getCosmoTheme(themeId);
    const isMobile = window.innerWidth < 640;
    const COUNT = reduced ? 0 : isMobile ? def.particles.mobileCount : def.particles.count;
    const SPEED = def.particles.speed;

    let w = 0; let h = 0; let raf = 0;
    let px = 0.5; let py = 0.5; let tx = 0.5; let ty = 0.5;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      w = Math.max(1, Math.floor(r.width));
      h = Math.max(1, Math.floor(r.height));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    interface P { x: number; y: number; r: number; vx: number; vy: number; a: number; tw: number; }
    const parts: P[] = Array.from({ length: COUNT }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.6 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * SPEED,
      vy: (Math.random() - 0.5) * SPEED,
      a: 0.25 + Math.random() * 0.55,
      tw: Math.random() * Math.PI * 2,
    }));

    const onMove = (e: PointerEvent) => {
      const r = wrap.getBoundingClientRect();
      tx = (e.clientX - r.left) / Math.max(1, r.width);
      ty = (e.clientY - r.top) / Math.max(1, r.height);
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    let t = 0;
    const accent = def.vars['--cosmo-accent'] || '#8b5cf6';
    const accent2 = def.vars['--cosmo-accent2'] || '#22d3ee';
    const draw = () => {
      t += 0.008;
      px += (tx - px) * 0.04;
      py += (ty - py) * 0.04;
      ctx.clearRect(0, 0, w, h);
      const ox = (px - 0.5) * 24;
      const oy = (py - 0.5) * 24;
      for (const p of parts) {
        p.x += (p.vx * 0.016); p.y += (p.vy * 0.016); p.tw += 0.03;
        if (p.x < -0.02) p.x = 1.02; if (p.x > 1.02) p.x = -0.02;
        if (p.y < -0.02) p.y = 1.02; if (p.y > 1.02) p.y = -0.02;
        const alpha = p.a * (0.65 + 0.35 * Math.sin(p.tw));
        ctx.beginPath();
        ctx.fillStyle = Math.random() > 0.5 ? accent : accent2;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.8;
        ctx.arc(p.x * w + ox * p.r, p.y * h + oy * p.r, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    if (!reduced && COUNT > 0) raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', onMove); };
  }, [themeId]);

  const def = getCosmoTheme(themeId);
  return (
    <div ref={wrapRef} aria-hidden="true" className="cosmo-animated-bg" data-theme-bg={def.id}>
      <div className="cosmo-aurora cosmo-aurora-a" />
      <div className="cosmo-aurora cosmo-aurora-b" />
      <div className="cosmo-orb cosmo-orb-1" />
      <div className="cosmo-orb cosmo-orb-2" />
      <canvas ref={canvasRef} className="cosmo-stars" />
      <div className="cosmo-vignette" />
    </div>
  );
};
