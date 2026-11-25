import { useEffect, useState } from 'react';

export interface FitRect {
  /** CSS length values the panel should use, e.g. { width: 'min(92vw, 380px)', maxHeight: 'min(70vh, 420px)' } */
  top: number;
  left: number;
  width: string;
  maxHeight: string;
  /** true when the panel is wide relative to the screen (phone) */
  isNarrow: boolean;
}

interface FitOptions {
  /** preferred panel width in px (desktop) */
  width?: number;
  /** preferred panel height in px (desktop) */
  height?: number;
  /** horizontal gap from the anchor edge */
  margin?: number;
}

const MOBILE_BREAKPOINT = 640;

/**
 * App-wide rule: floating panels (language list, dropdowns, popovers)
 * must always fit fully inside the visible screen on ANY device.
 *
 * - Desktop (≥640px): panel anchors below the button (clamped so it never
 *   overflows the left/right/top edges).
 * - Phone (<640px): returns a centered bottom-sheet geometry instead —
 *   full-width, max 92vw, slides up from the bottom, thumb reachable.
 */
export function useFitPanel(
  anchorRef: React.RefObject<HTMLElement | null>,
  open: boolean,
  opts: FitOptions = {}
): FitRect | null {
  const { width = 380, height = 420, margin = 8 } = opts;
  const [rect, setRect] = useState<FitRect | null>(null);

  useEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }

    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const r = anchorRef.current?.getBoundingClientRect();

      // Phone: bottom-sheet geometry, always in-bounds by construction.
      if (vw < MOBILE_BREAKPOINT) {
        const sheetH = Math.min(vh * 0.72, height);
        setRect({
          top: Math.max(margin, vh - sheetH - margin),
          left: Math.max(margin, (vw - Math.min(vw - margin * 2, 480)) / 2),
          width: `min(92vw, 480px)`,
          maxHeight: `min(72vh, ${height}px)`,
          isNarrow: true,
        });
        return;
      }

      // Desktop/tablet: anchor below the button, clamped inside viewport.
      const w = Math.min(width, vw - margin * 2);
      const h = Math.min(height, vh * 0.7);
      let left = r ? r.left : (vw - w) / 2;
      left = Math.max(margin, Math.min(left, vw - w - margin));
      let top = r ? r.bottom + margin : margin;
      if (top + h > vh - margin) {
        // flip above the button when there is no room below
        top = Math.max(margin, (r ? r.top : vh) - h - margin);
      }
      setRect({
        top: Math.round(top),
        left: Math.round(left),
        width: `${Math.round(w)}px`,
        maxHeight: `${Math.round(h)}px`,
        isNarrow: false,
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef, width, height, margin]);

  return rect;
}
