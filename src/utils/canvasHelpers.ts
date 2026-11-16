import type { VideoLayout } from '../types/studio';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutBack(t: number): number {
  const x = clamp(t, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return { r: 120, g: 130, b: 150 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function adjustColor(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const f = (c: number) => clamp(Math.round(c + amount * 255), 0, 255);
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

const thaiSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('th', { granularity: 'word' })
    : null;

export function segmentThaiWords(text: string): string[] {
  if (!text) return [];
  if (!thaiSegmenter) {
    return text.split(/(\s+)/).filter(Boolean);
  }
  const out: string[] = [];
  for (const seg of thaiSegmenter.segment(text)) {
    out.push(seg.segment);
  }
  return out;
}

export function wrapThaiLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 4
): string[] {
  const paragraphs = String(text || '').split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = segmentThaiWords(para.trim());
    if (words.length === 0) continue;
    let current = '';
    for (const w of words) {
      const candidate = current + w;
      if (ctx.measureText(candidate).width <= maxWidth || current.length === 0) {
        current = candidate;
      } else {
        lines.push(current.trimEnd());
        current = w.trimStart();
        if (lines.length >= maxLines) break;
      }
    }
    if (current.trim() && lines.length < maxLines) {
      lines.push(current.trim());
    }
    if (lines.length >= maxLines) break;
  }

  return lines.slice(0, maxLines);
}

export interface CanvasViewportGeometry {
  canvasW: number;
  canvasH: number;
  stageX: number;
  stageY: number;
  stageW: number;
  stageH: number;
  isLetterbox: boolean;
  isLandscape: boolean;
}

export function getBaseDimensions(layout: VideoLayout, scale = 1): { width: number; height: number } {
  if (layout === 'landscape') {
    return {
      width: Math.round(1280 * scale),
      height: Math.round(720 * scale),
    };
  }
  return {
    width: Math.round(720 * scale),
    height: Math.round(1280 * scale),
  };
}

export function getViewportGeometry(layout: VideoLayout, canvasW: number, canvasH: number): CanvasViewportGeometry {
  if (layout === 'portrait_letterbox') {
    const bandH = Math.round(canvasW * (9 / 16));
    const bandY = Math.round((canvasH - bandH) / 2);
    return {
      canvasW,
      canvasH,
      stageX: 0,
      stageY: bandY,
      stageW: canvasW,
      stageH: bandH,
      isLetterbox: true,
      isLandscape: false,
    };
  }
  return {
    canvasW,
    canvasH,
    stageX: 0,
    stageY: 0,
    stageW: canvasW,
    stageH: canvasH,
    isLetterbox: false,
    isLandscape: layout === 'landscape',
  };
}
