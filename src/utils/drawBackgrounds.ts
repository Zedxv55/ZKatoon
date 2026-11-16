import type { BgPresetId, PaletteColor, StylePackId } from '../types/studio';
import { adjustColor, drawRoundedRect, hashString, mulberry32, withAlpha } from './canvasHelpers';

export interface BgCacheEntry {
  key: string;
  sharp: HTMLCanvasElement;
  blurred: HTMLCanvasElement;
  width: number;
  height: number;
  lastUsedFrame: number;
}

const bgCache = new Map<string, BgCacheEntry>();

export function clearBackgroundCache(): void {
  bgCache.clear();
}

function makeOffscreenCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

export function evictFarBackgroundCaches(keepSceneKeys: Set<string>, maxEntries = 10): void {
  if (bgCache.size <= maxEntries) return;
  const entries = Array.from(bgCache.entries()).sort((a, b) => a[1].lastUsedFrame - b[1].lastUsedFrame);
  for (const [k] of entries) {
    if (!keepSceneKeys.has(k) && bgCache.size > maxEntries) {
      bgCache.delete(k);
    }
  }
}

export function paintBackgroundPreset(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  preset: BgPresetId,
  stylePack: StylePackId,
  palette: PaletteColor[],
  tint?: string,
  customColors?: string[]
): void {
  const rand = mulberry32(hashString(`${preset}_${stylePack}`));
  const p0 = customColors?.[0] || palette[0]?.hex || '#1B2433';
  const p1 = customColors?.[1] || palette[1]?.hex || '#3A4F6B';
  const p2 = customColors?.[2] || palette[2]?.hex || '#F29A4A';
  const accent = palette[3]?.hex || '#F5C542';

  const drawSkyGradient = (top: string, mid: string, bot: string) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top);
    g.addColorStop(0.58, mid);
    g.addColorStop(1, bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };

  const drawMoonOrSun = (x: number, y: number, r: number, color: string, glow = true) => {
    if (glow) {
      const gg = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 3.5);
      gg.addColorStop(0, withAlpha(color, 0.35));
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(x, y, r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawStars = (count: number, alpha = 0.6) => {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = `rgba(255,255,240,${(alpha * (0.3 + rand() * 0.7)).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h * 0.58, 1 + rand() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawCitySilhouette = (baseY: number, color: string, litWindows: boolean) => {
    let x = -10;
    while (x < w + 20) {
      const bw = 28 + rand() * 54;
      const bh = 60 + rand() * (h * 0.34);
      ctx.fillStyle = color;
      ctx.fillRect(x, baseY - bh, bw, bh + 12);
      if (litWindows) {
        const rows = Math.floor(bh / 18);
        const cols = Math.max(1, Math.floor(bw / 14));
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (rand() > 0.62) {
              ctx.fillStyle = rand() > 0.2 ? withAlpha(accent, 0.55) : withAlpha('#93C5FD', 0.4);
              ctx.fillRect(x + 5 + c * 13, baseY - bh + 8 + r * 16, 6, 8);
            }
          }
        }
      }
      x += bw + 2 + rand() * 8;
    }
  };

  switch (preset) {
    case 'sky_day': {
      drawSkyGradient('#5BB6E5', '#9BD8F4', '#E5F5FC');
      drawMoonOrSun(w * 0.82, h * 0.18, Math.min(w, h) * 0.06, '#FFF7CC');
      for (let i = 0; i < 5; i++) {
        const cx = (0.12 + i * 0.2) * w;
        const cy = (0.18 + (i % 2) * 0.08) * h;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, w * 0.09, h * 0.025, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + w * 0.05, cy - h * 0.01, w * 0.07, h * 0.022, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#73B865';
      ctx.fillRect(0, h * 0.74, w, h * 0.26);
      break;
    }
    case 'sunset': {
      drawSkyGradient('#4C345E', '#D97B48', '#F2C97D');
      drawMoonOrSun(w * 0.5, h * 0.42, Math.min(w, h) * 0.09, '#FDE68A');
      // Winding pothole road matching Style C reference
      ctx.fillStyle = '#7D6A58';
      ctx.fillRect(0, h * 0.45, w, h * 0.55);
      ctx.fillStyle = '#5B4B3E';
      ctx.beginPath();
      ctx.moveTo(w * 0.44, h * 0.46);
      ctx.quadraticCurveTo(w * 0.62, h * 0.6, w * 0.34, h * 0.74);
      ctx.quadraticCurveTo(w * 0.25, h * 0.88, w * 0.42, h);
      ctx.lineTo(w * 0.74, h);
      ctx.quadraticCurveTo(w * 0.52, h * 0.85, w * 0.65, h * 0.7);
      ctx.quadraticCurveTo(w * 0.72, h * 0.56, w * 0.54, h * 0.46);
      ctx.closePath();
      ctx.fill();
      // Potholes & band-aids
      for (let i = 0; i < 6; i++) {
        const py = h * (0.54 + i * 0.075);
        const px = w * (0.48 + Math.sin(i * 1.4) * 0.09);
        ctx.fillStyle = '#2B221D';
        ctx.beginPath();
        ctx.ellipse(px, py, 16 + i * 2, 7 + i, 0, 0, Math.PI * 2);
        ctx.fill();
        if (i % 2 === 1) {
          ctx.save();
          ctx.translate(px + 20, py + 12);
          ctx.rotate(-0.2);
          ctx.fillStyle = '#E8C79A';
          drawRoundedRect(ctx, -18, -6, 36, 12, 5);
          ctx.fill();
          ctx.fillStyle = '#D6AD77';
          ctx.fillRect(-6, -5, 12, 10);
          ctx.restore();
        }
      }
      break;
    }
    case 'city_day': {
      drawSkyGradient('#68B5E8', '#A7D7F5', '#E8F3F8');
      drawCitySilhouette(h * 0.74, '#94A3B8', false);
      drawCitySilhouette(h * 0.78, '#64748B', false);
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, h * 0.76, w, h * 0.24);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(0, h * 0.76, w, 8);
      break;
    }
    case 'city_night':
    case 'street_night': {
      drawSkyGradient('#111827', '#1B2433', '#2B3A52');
      drawStars(34, 0.55);
      drawMoonOrSun(w * 0.85, h * 0.16, Math.min(w, h) * 0.045, '#F8FAFC');
      drawCitySilhouette(h * 0.68, '#162030', true);
      ctx.fillStyle = '#202938';
      ctx.fillRect(0, h * 0.68, w, h * 0.32);
      // Barrier railings + warm street lamp glows
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.73);
      ctx.lineTo(w, h * 0.73);
      ctx.moveTo(0, h * 0.78);
      ctx.lineTo(w, h * 0.78);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const lx = w * (0.14 + i * 0.24);
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx - 3, h * 0.42, 6, h * 0.34);
        drawMoonOrSun(lx, h * 0.42, 8, '#F5C542');
      }
      break;
    }
    case 'street_day': {
      drawSkyGradient('#89C2E8', '#CBE5F5', '#F1F5F9');
      drawCitySilhouette(h * 0.62, '#94A3B8', false);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(0, h * 0.6, w, h * 0.14);
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, h * 0.74, w, h * 0.26);
      ctx.fillStyle = '#FACC15';
      for (let x = 20; x < w; x += 68) ctx.fillRect(x, h * 0.86, 36, 6);
      break;
    }
    case 'metro_station': {
      // Style A reference: Sanam Pao dark underground platform
      drawSkyGradient('#171E2B', '#232D3F', '#1A202C');
      // Ceiling beams & yellow safety strip
      ctx.fillStyle = '#2B364A';
      ctx.fillRect(0, 0, w, h * 0.2);
      ctx.fillStyle = '#334155';
      for (let x = 0; x < w; x += w * 0.22) {
        ctx.fillRect(x, h * 0.18, w * 0.04, h * 0.56);
      }
      // Track wall windows
      ctx.fillStyle = '#11161F';
      ctx.fillRect(0, h * 0.34, w, h * 0.28);
      ctx.fillStyle = '#3B4961';
      for (let x = 24; x < w; x += 72) {
        ctx.fillRect(x, h * 0.38, 46, h * 0.18);
      }
      // Platform floor & bright yellow edge line
      ctx.fillStyle = '#27303F';
      ctx.fillRect(0, h * 0.72, w, h * 0.28);
      ctx.fillStyle = '#F5C542';
      ctx.fillRect(0, h * 0.74, w, 6);
      break;
    }
    case 'harbor_dusk': {
      // Style A reference: Illuminated Thai temple & Chao Phraya river at night
      drawSkyGradient('#151D2B', '#223149', '#2E435E');
      drawStars(26, 0.5);
      drawMoonOrSun(w * 0.9, h * 0.14, Math.min(w, h) * 0.036, '#F8FAFC');
      drawCitySilhouette(h * 0.56, '#1A2333', false);
      // Multi-tiered Thai Temple silhouette illuminated in red/green/gold
      const tx = w * 0.5;
      const ty = h * 0.55;
      ctx.fillStyle = '#F2E6D0';
      ctx.fillRect(tx - w * 0.16, ty - h * 0.08, w * 0.32, h * 0.09);
      const tiers = [0.22, 0.17, 0.12];
      tiers.forEach((tw, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? '#A3281E' : '#2D6B4F';
        ctx.beginPath();
        ctx.moveTo(tx - w * tw, ty - h * (0.07 + idx * 0.05));
        ctx.lineTo(tx, ty - h * (0.14 + idx * 0.055));
        ctx.lineTo(tx + w * tw, ty - h * (0.07 + idx * 0.05));
        ctx.closePath();
        ctx.fill();
      });
      // Golden Chedi Spire
      ctx.fillStyle = '#F5C542';
      ctx.beginPath();
      ctx.moveTo(tx - 16, ty - h * 0.22);
      ctx.lineTo(tx, ty - h * 0.35);
      ctx.lineTo(tx + 16, ty - h * 0.22);
      ctx.closePath();
      ctx.fill();
      // River with subtle shimmer lines
      ctx.fillStyle = '#1E2A3B';
      ctx.fillRect(0, h * 0.56, w, h * 0.44);
      ctx.fillStyle = 'rgba(242,230,208,0.18)';
      for (let i = 0; i < 24; i++) {
        ctx.fillRect(rand() * w * 0.85, h * (0.6 + rand() * 0.36), 24 + rand() * 50, 2);
      }
      break;
    }
    case 'ocean': {
      drawSkyGradient('#D4B6A4', '#E8CEBA', '#CBD5E1');
      ctx.fillStyle = '#747E8C';
      ctx.fillRect(0, h * 0.5, w, h * 0.5);
      for (let i = 0; i < 36; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,248,235,0.45)' : 'rgba(51,65,85,0.32)';
        ctx.fillRect(rand() * w * 0.9, h * (0.53 + rand() * 0.42), 30 + rand() * 90, 3);
      }
      break;
    }
    case 'shrine_hall': {
      // Style B reference: dark ritual hall + red curtain + 3-color bunting + altar + ring light
      drawSkyGradient('#2B1612', '#3A1E18', '#1F110E');
      // Red ritual curtain on right
      ctx.fillStyle = '#A3281E';
      ctx.fillRect(w * 0.72, 0, w * 0.22, h * 0.85);
      ctx.fillStyle = '#7E1D15';
      for (let x = w * 0.74; x < w * 0.92; x += 22) ctx.fillRect(x, 0, 8, h * 0.85);
      // Warm altar glow center-back
      drawMoonOrSun(w * 0.5, h * 0.52, w * 0.14, '#E8A842');
      // Hanging ring-light on left
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w * 0.22, h * 0.45, Math.min(w, h) * 0.07, 0, Math.PI * 2);
      ctx.stroke();
      // 3-color cloth bunting swag across ceiling
      const colors = ['#2D6B4F', '#F5C542', '#A3281E'];
      colors.forEach((col, i) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(8, h * 0.025);
        ctx.beginPath();
        ctx.moveTo(w * 0.05, h * (0.08 + i * 0.03));
        ctx.quadraticCurveTo(w * 0.5, h * (0.28 + i * 0.03), w * 0.95, h * (0.06 + i * 0.03));
        ctx.stroke();
      });
      ctx.fillStyle = '#2A1814';
      ctx.fillRect(0, h * 0.82, w, h * 0.18);
      break;
    }
    case 'noodle_shop': {
      // Style C cafe / warm shop counter interior
      drawSkyGradient('#EFE2CB', '#E8C79A', '#D9B080');
      // Wall menu board & hanging pendant lamps
      ctx.fillStyle = '#242938';
      drawRoundedRect(ctx, w * 0.32, h * 0.08, w * 0.36, h * 0.34, 8);
      ctx.fill();
      ctx.fillStyle = '#94A3B8';
      for (let y = h * 0.14; y < h * 0.38; y += h * 0.055) {
        ctx.fillRect(w * 0.36, y, w * 0.24, 5);
      }
      [w * 0.22, w * 0.78].forEach((lx) => {
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, h * 0.16);
        ctx.stroke();
        ctx.fillStyle = '#F5B82E';
        ctx.beginPath();
        ctx.moveTo(lx - 24, h * 0.2);
        ctx.lineTo(lx + 24, h * 0.2);
        ctx.lineTo(lx + 10, h * 0.15);
        ctx.lineTo(lx - 10, h * 0.15);
        ctx.closePath();
        ctx.fill();
      });
      // Counter wood
      ctx.fillStyle = '#B77A45';
      ctx.fillRect(0, h * 0.72, w, h * 0.28);
      ctx.fillStyle = '#8C582B';
      ctx.fillRect(0, h * 0.72, w, 12);
      break;
    }
    case 'hallway': {
      // Style A reference: dark perspective corridor with subtle pillars and floor lines
      drawSkyGradient('#151B28', '#1F273B', '#111622');
      ctx.fillStyle = '#252E42';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * 0.36, h * 0.28);
      ctx.lineTo(w * 0.36, h * 0.68);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w, 0);
      ctx.lineTo(w * 0.64, h * 0.28);
      ctx.lineTo(w * 0.64, h * 0.68);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      // Gold floor guide lines
      ctx.strokeStyle = withAlpha('#F5C542', 0.45);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.36, h * 0.68);
      ctx.lineTo(w * 0.08, h);
      ctx.moveTo(w * 0.64, h * 0.68);
      ctx.lineTo(w * 0.92, h);
      ctx.stroke();
      break;
    }
    case 'forest':
    case 'village':
    case 'rural_night_field': {
      const isNight = preset === 'rural_night_field';
      drawSkyGradient(
        isNight ? '#0F172A' : '#63B3D6',
        isNight ? '#1E293B' : '#A4D8B8',
        isNight ? '#0F241D' : '#CBE8B8'
      );
      if (isNight) {
        drawStars(32, 0.7);
        drawMoonOrSun(w * 0.2, h * 0.16, Math.min(w, h) * 0.045, '#FEF3C7');
      }
      ctx.fillStyle = isNight ? '#14291F' : '#4E8F55';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.68);
      ctx.quadraticCurveTo(w * 0.5, h * 0.56, w, h * 0.68);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      // Trees
      for (let i = 0; i < 6; i++) {
        const tx = w * (0.08 + i * 0.18);
        const ty = h * 0.64;
        ctx.fillStyle = '#5C3D2E';
        ctx.fillRect(tx - 6, ty - 16, 12, 50);
        ctx.fillStyle = isNight ? '#1D3E2B' : '#2F7D47';
        ctx.beginPath();
        ctx.arc(tx, ty - 28, 32 + (i % 2) * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'mountain': {
      drawSkyGradient('#2B2350', '#70587C', '#E8C79A');
      ctx.fillStyle = '#3E3361';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.7);
      ctx.lineTo(w * 0.25, h * 0.42);
      ctx.lineTo(w * 0.55, h * 0.66);
      ctx.lineTo(w * 0.82, h * 0.38);
      ctx.lineTo(w, h * 0.68);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#4A3C6E';
      ctx.fillRect(0, h * 0.66, w, h * 0.34);
      break;
    }
    case 'room':
    case 'living_room_night':
    case 'classroom':
    case 'office':
    case 'lab':
    case 'hospital':
    case 'supermarket':
    case 'bus_night': {
      const nightRoom = preset === 'living_room_night' || preset === 'bus_night';
      drawSkyGradient(
        nightRoom ? '#1A2233' : '#EAE4D7',
        nightRoom ? '#232D42' : '#DFD7C8',
        nightRoom ? '#131926' : '#C9BFA9'
      );
      // Window with blinds/frames
      ctx.fillStyle = nightRoom ? '#0F172A' : '#BFD3E6';
      drawRoundedRect(ctx, w * 0.58, h * 0.14, w * 0.28, h * 0.26, 8);
      ctx.fill();
      ctx.strokeStyle = nightRoom ? '#475569' : '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.strokeRect(w * 0.58, h * 0.14, w * 0.28, h * 0.26);
      // Floor
      ctx.fillStyle = nightRoom ? '#1B2230' : '#A6835F';
      ctx.fillRect(0, h * 0.72, w, h * 0.28);
      break;
    }
    case 'space': {
      drawSkyGradient('#050814', '#0F172A', '#1E1B4B');
      drawStars(60, 0.85);
      drawMoonOrSun(w * 0.75, h * 0.28, Math.min(w, h) * 0.1, '#818CF8');
      break;
    }
    case 'grid_tech': {
      drawSkyGradient('#0D1321', '#182238', '#111827');
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      break;
    }
    case 'paper': {
      drawSkyGradient('#FAF5EA', '#F4EBDC', '#ECE0CA');
      ctx.strokeStyle = 'rgba(180, 150, 110, 0.15)';
      ctx.lineWidth = 1;
      for (let y = 36; y < h; y += 36) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      break;
    }
    case 'dark_fog':
    case 'plain_gradient':
    default: {
      drawSkyGradient(p0, p1, adjustColor(p0, -0.05));
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = withAlpha(p2, 0.08);
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, 40 + rand() * 80, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }

  if (tint) {
    ctx.fillStyle = withAlpha(tint, 0.22);
    ctx.fillRect(0, 0, w, h);
  }
}

export function getOrBuildBackgroundCache(params: {
  cacheKey: string;
  w: number;
  h: number;
  preset: BgPresetId;
  stylePack: StylePackId;
  palette: PaletteColor[];
  tint?: string;
  colors?: string[];
  frameCounter: number;
}): BgCacheEntry {
  // Pad 16% around canvas so pan/zoom never shows edge seams
  const padW = Math.round(params.w * 1.16);
  const padH = Math.round(params.h * 1.16);
  const fullKey = `${params.cacheKey}|${padW}x${padH}|${params.preset}|${params.stylePack}|${params.tint || ''}`;

  const existing = bgCache.get(fullKey);
  if (existing) {
    existing.lastUsedFrame = params.frameCounter;
    return existing;
  }

  const sharp = makeOffscreenCanvas(padW, padH);
  const sCtx = sharp.getContext('2d')!;
  paintBackgroundPreset(sCtx, padW, padH, params.preset, params.stylePack, params.palette, params.tint, params.colors);

  // Pre-render blurred background ONCE into offscreen canvas so blurBg=true costs 0 per-frame filter work
  const blurred = makeOffscreenCanvas(padW, padH);
  const bCtx = blurred.getContext('2d')!;
  try {
    bCtx.filter = 'blur(8px)';
    bCtx.drawImage(sharp, 0, 0);
    bCtx.filter = 'none';
  } catch {
    bCtx.drawImage(sharp, 0, 0);
  }
  bCtx.fillStyle = 'rgba(8, 10, 16, 0.28)';
  bCtx.fillRect(0, 0, padW, padH);

  const entry: BgCacheEntry = {
    key: fullKey,
    sharp,
    blurred,
    width: padW,
    height: padH,
    lastUsedFrame: params.frameCounter,
  };
  bgCache.set(fullKey, entry);
  return entry;
}
