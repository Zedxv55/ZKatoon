import type {
  ActorDef,
  CardDef,
  CartoonProject,
  CharacterDef,
  LookGrade,
  PauseCandidate,
  SceneDef,
  SceneFx,
  SceneProp,
  SubtitleStyle,
  TimelineSegment,
} from '../types/cartoon';
import { STYLES, type StylePalette } from './cartoonData';
import {
  getMouthOpenAt,
  getSubtitleState,
  resolveAtTextLocalTime,
} from './projectLogic';

export const CANVAS_W = 720;
export const CANVAS_H = 1280;

const fontSpec = (weight: number, size: number) =>
  `${weight} ${size}px Prompt, "Noto Sans Thai", "Plus Jakarta Sans", sans-serif`;

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const easeOutCubic = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

function makePrng(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TextSegment {
  w: string;
  i: number;
}

interface WrappedLine {
  ws: TextSegment[];
  w: number;
}

function wrapThaiText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): WrappedLine[] {
  const SegmenterCtor = (
    Intl as unknown as {
      Segmenter?: new (
        locale: string,
        opts: { granularity: string }
      ) => { segment: (input: string) => Iterable<{ segment: string; index: number }> };
    }
  ).Segmenter;

  const segments: TextSegment[] = SegmenterCtor
    ? [...new SegmenterCtor('th', { granularity: 'word' }).segment(text)].map((z) => ({
        w: z.segment,
        i: z.index,
      }))
    : [...text].map((c, i) => ({ w: c, i }));

  const lines: WrappedLine[] = [];
  let line: TextSegment[] = [];
  let lineWidth = 0;

  for (const seg of segments) {
    const w = ctx.measureText(seg.w).width;
    if (lineWidth + w > maxWidth && line.length > 0) {
      lines.push({ ws: line, w: lineWidth });
      line = [];
      lineWidth = 0;
    }
    line.push(seg);
    lineWidth += w;
  }

  if (line.length > 0) {
    lines.push({ ws: line, w: lineWidth });
  }
  return lines;
}

// ============================================================
// Cached Offscreen Paper / Grain / Clay Tiles & Scene Backgrounds
// ============================================================
let cachedPaperTile: HTMLCanvasElement | null = null;
let cachedGrainTile: HTMLCanvasElement | null = null;
let cachedBloomCanvas: HTMLCanvasElement | null = null;

function getPaperTextureTile(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedPaperTile) return cachedPaperTile;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const rand = makePrng(90210);
  // Subtle kraft paper speckles + faint horizontal fibers
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(92,74,48,0.045)' : 'rgba(255,250,240,0.06)';
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2, 1 + rand() * 2);
  }
  ctx.strokeStyle = 'rgba(130,108,78,0.05)';
  ctx.lineWidth = 1;
  for (let y = 12; y < 256; y += 22) {
    ctx.beginPath();
    ctx.moveTo(0, y + (rand() - 0.5) * 4);
    ctx.bezierCurveTo(85, y + (rand() - 0.5) * 5, 170, y + (rand() - 0.5) * 5, 256, y + (rand() - 0.5) * 4);
    ctx.stroke();
  }
  cachedPaperTile = c;
  return c;
}

function getGrainTile(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  if (cachedGrainTile) return cachedGrainTile;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(128, 128);
  const rand = makePrng(4242);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 22;
  }
  ctx.putImageData(img, 0, 0);
  cachedGrainTile = c;
  return c;
}

// ============================================================
// Background Layer Renderer (Paper Sketch + REF + RURAL + CLAY)
// ============================================================
function drawBackground(
  ctx: CanvasRenderingContext2D,
  scene: SceneDef,
  palette: StylePalette,
  styleKey: CartoonProject['style'],
  w: number,
  h: number,
  t: number
) {
  const bgPreset = scene.bgPreset;
  const isPaper = styleKey === 'paper' || bgPreset === 'paper' || scene.mood === 'paper';

  if (isPaper) {
    // Warm kraft paper matching the reference video (#ebe0c9 -> #e0d1b3)
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#ebe0c9');
    g.addColorStop(0.6, '#e6d8bc');
    g.addColorStop(1, '#d8c5a2');
    ctx.fillStyle = g;
    ctx.fillRect(-80, -80, w + 160, h + 160);

    const tile = getPaperTextureTile();
    if (tile) {
      const pat = ctx.createPattern(tile, 'repeat');
      if (pat) {
        ctx.fillStyle = pat;
        ctx.fillRect(-80, -80, w + 160, h + 160);
      }
    }

    // Room details if bgPreset === 'room' inside paper sketch
    if (bgPreset === 'room') {
      ctx.fillStyle = '#c8b393';
      ctx.fillRect(-40, h * 0.62, w + 80, h * 0.42);
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-40, h * 0.62);
      ctx.lineTo(w + 40, h * 0.62);
      ctx.stroke();

      // Simple sketch window
      ctx.fillStyle = '#d3e1e8';
      roundRectPath(ctx, w * 0.64, h * 0.22, 160, 140, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w * 0.64 + 80, h * 0.22);
      ctx.lineTo(w * 0.64 + 80, h * 0.22 + 140);
      ctx.moveTo(w * 0.64, h * 0.22 + 70);
      ctx.lineTo(w * 0.64 + 160, h * 0.22 + 70);
      ctx.stroke();
    }
    return;
  }

  const mood = scene.mood;
  const moodMap: Record<string, [string, string]> = {
    day: ['#7fd0ff', '#e8f8ff'],
    dusk: ['#ff9a6b', '#53407f'],
    dark: ['#07070d', '#1b1730'],
  };
  const colors =
    moodMap[mood] && styleKey !== 'shrine' && styleKey !== 'dark' && styleKey !== 'rural'
      ? moodMap[mood]
      : [palette.t, palette.b];

  let grad = ctx.createLinearGradient(0, 0, 0, h * 0.66);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(-80, -80, w + 160, h + 160);

  const isDark =
    mood === 'night' ||
    mood === 'dark' ||
    mood === 'dusk' ||
    styleKey === 'night' ||
    styleKey === 'rural' ||
    styleKey === 'shrine' ||
    styleKey === 'dark' ||
    styleKey === 'cinema';
  const rand = makePrng(7);

  if (isDark) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 42; i++) {
      ctx.globalAlpha = 0.28 + 0.55 * Math.abs(Math.sin(t * 1.8 + i));
      ctx.fillRect(rand() * w, rand() * h * 0.42, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.hi;
    ctx.beginPath();
    ctx.arc(w * 0.8, h * 0.14, 40, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rural night silhouette: palm trees & distant mountain
  if (styleKey === 'rural' || bgPreset === 'rural_night_field' || bgPreset === 'village') {
    ctx.fillStyle = '#07111a';
    for (let i = 0; i < 4; i++) {
      const tx = w * (0.14 + i * 0.26);
      const topY = h * (0.38 + (i % 2) * 0.05);
      ctx.fillRect(tx - 6, topY, 12, h * 0.64 - topY);
      for (let a = 0; a < 6; a++) {
        ctx.beginPath();
        ctx.ellipse(tx + Math.cos(a) * 28, topY + Math.sin(a) * 14, 28, 7, a * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (mood !== 'room' && styleKey !== 'shrine') {
    ctx.fillStyle = palette.sk;
    let px = -30;
    while (px < w + 30) {
      const bw = 60 + rand() * 70;
      const bh = h * (0.14 + rand() * 0.24);
      ctx.fillRect(px, h * 0.64 - bh, bw, bh);
      if (isDark) {
        ctx.fillStyle = palette.hi;
        for (let k = 0; k < 6; k++) {
          if (rand() > 0.52) {
            ctx.fillRect(
              px + 8 + (k % 3) * (bw / 3.4),
              h * 0.64 - bh + 20 + Math.floor(k / 3) * 44,
              10,
              14
            );
          }
        }
        ctx.fillStyle = palette.sk;
      }
      px += bw + 6;
    }
  }

  if (styleKey === 'shrine' || mood === 'room' || bgPreset === 'room' || bgPreset === 'living_room_night') {
    const rg = ctx.createRadialGradient(w / 2, h * 0.38, 10, w / 2, h * 0.38, w * 0.8);
    rg.addColorStop(0, `${palette.hi}88`);
    rg.addColorStop(1, '#00000000');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  grad = ctx.createLinearGradient(0, h * 0.64, 0, h);
  grad.addColorStop(0, palette.g);
  grad.addColorStop(1, '#00000066');
  ctx.fillStyle = grad;
  ctx.fillRect(-80, h * 0.64, w + 160, h * 0.45);
}

// ============================================================
// CINE LAYER Post-Processing (11 Look Grades + Key + Bloom + Grain)
// ============================================================
const GRADE_MAP: Record<LookGrade, { tint: string; op: GlobalCompositeOperation; alpha: number }> = {
  neutral_day: { tint: '#000000', op: 'source-over', alpha: 0 },
  golden_hour: { tint: '#ffb347', op: 'soft-light', alpha: 0.24 },
  blue_hour: { tint: '#2b5876', op: 'multiply', alpha: 0.28 },
  overcast: { tint: '#94a3b8', op: 'soft-light', alpha: 0.22 },
  warm_interior: { tint: '#f59e0b', op: 'soft-light', alpha: 0.22 },
  cold_night: { tint: '#1e3a8a', op: 'multiply', alpha: 0.3 },
  neon_night: { tint: '#c026d3', op: 'soft-light', alpha: 0.24 },
  tense_green: { tint: '#14532d', op: 'multiply', alpha: 0.28 },
  sepia_memory: { tint: '#92400e', op: 'soft-light', alpha: 0.32 },
  harsh_noon: { tint: '#fef08a', op: 'overlay', alpha: 0.16 },
  foggy_dawn: { tint: '#cbd5e1', op: 'screen', alpha: 0.22 },
};

function applyCineLayer(
  ctx: CanvasRenderingContext2D,
  scene: SceneDef,
  project: CartoonProject,
  w: number,
  h: number,
  t: number
) {
  const gradeKey = scene.look?.grade || project.cineLayer?.defaultGrade || 'neutral_day';
  const cfg = GRADE_MAP[gradeKey] || GRADE_MAP.neutral_day;

  if (cfg.alpha > 0) {
    ctx.save();
    ctx.globalCompositeOperation = cfg.op;
    ctx.globalAlpha = cfg.alpha;
    ctx.fillStyle = cfg.tint;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // Key light directional wash
  if (scene.look?.keyLightIntensity && scene.look.keyLightIntensity > 0) {
    ctx.save();
    const dir = scene.look.keyLightDir || 'left';
    const x0 = dir === 'right' ? w : dir === 'left' ? 0 : w / 2;
    const g = ctx.createRadialGradient(x0, h * 0.2, 20, x0, h * 0.2, w * 0.9);
    g.addColorStop(0, scene.look.keyLightColor || '#ffd28a');
    g.addColorStop(1, 'transparent');
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = Math.min(0.45, scene.look.keyLightIntensity);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 1/8th scale cheap bloom pass
  if (scene.look?.bloom && scene.look.bloom > 0 && typeof document !== 'undefined') {
    if (!cachedBloomCanvas) cachedBloomCanvas = document.createElement('canvas');
    const bw = Math.max(48, Math.floor(w / 8));
    const bh = Math.max(48, Math.floor(h / 8));
    cachedBloomCanvas.width = bw;
    cachedBloomCanvas.height = bh;
    const bctx = cachedBloomCanvas.getContext('2d');
    if (bctx) {
      bctx.drawImage(ctx.canvas, 0, 0, bw, bh);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.32, scene.look.bloom);
      ctx.drawImage(cachedBloomCanvas, 0, 0, w, h);
      ctx.restore();
    }
  }

  // Film grain tile (seeded offset per frame, zero per-frame tile regeneration)
  const grain = getGrainTile();
  if (grain) {
    const ox = Math.floor((Math.sin(t * 47.3) * 0.5 + 0.5) * 64);
    const oy = Math.floor((Math.cos(t * 31.1) * 0.5 + 0.5) * 64);
    ctx.save();
    ctx.translate(-ox, -oy);
    const pat = ctx.createPattern(grain, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, w + 128, h + 128);
    }
    ctx.restore();
  }
}

function drawFx(ctx: CanvasRenderingContext2D, fx: SceneFx, w: number, h: number, t: number) {
  const rand = makePrng(3);
  if (fx === 'rain') {
    ctx.strokeStyle = '#cfe8ffaa';
    ctx.lineWidth = 2;
    for (let i = 0; i < 65; i++) {
      const px = rand() * w;
      const py = (rand() * h + t * 900) % h;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 6, py + 24);
      ctx.stroke();
    }
  } else if (fx === 'snow' || fx === 'dust') {
    ctx.fillStyle = fx === 'dust' ? 'rgba(255,235,190,0.6)' : '#ffffff';
    for (let i = 0; i < 55; i++) {
      ctx.beginPath();
      ctx.arc(
        (rand() * w + Math.sin(t + i) * 20) % w,
        (rand() * h + t * (fx === 'dust' ? 24 : 80)) % h,
        2 + rand() * 3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (fx === 'sparkles') {
    ctx.fillStyle = '#f5be41';
    for (let i = 0; i < 18; i++) {
      ctx.globalAlpha = Math.abs(Math.sin(t * 3 + i));
      ctx.fillRect(rand() * w, rand() * h * 0.72, 6, 6);
    }
    ctx.globalAlpha = 1;
  } else if (fx === 'fog') {
    const g = ctx.createLinearGradient(0, h * 0.4, 0, h * 0.75);
    g.addColorStop(0, '#ffffff00');
    g.addColorStop(0.5, '#ffffff38');
    g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g;
    ctx.fillRect(Math.sin(t * 0.5) * 30 - 30, h * 0.4, w + 60, h * 0.35);
  }
}

// ============================================================
// Props & Flowers Helper (used in doors, bouquets, chat cards)
// ============================================================
function drawDaisyFlower(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  petalColor: string,
  inkColor = '#2d2822'
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = inkColor;
  ctx.lineWidth = Math.max(1.5, radius * 0.1);
  // Stem + leaf
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, radius * 2.2);
  ctx.stroke();

  const petals = 8;
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate((i / petals) * Math.PI * 2);
    ctx.fillStyle = petalColor;
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.72, radius * 0.34, radius * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = '#e08b36';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPrayingCatSticker(ctx: CanvasRenderingContext2D, cx: number, cy: number, s = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  ctx.strokeStyle = '#2d2822';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  // Body
  ctx.fillStyle = '#d9a45b';
  ctx.beginPath();
  ctx.ellipse(0, 26, 26, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Ears
  ctx.beginPath();
  ctx.moveTo(-22, -16);
  ctx.lineTo(-26, -42);
  ctx.lineTo(-8, -28);
  ctx.moveTo(22, -16);
  ctx.lineTo(26, -42);
  ctx.lineTo(8, -28);
  ctx.fill();
  ctx.stroke();
  // Head
  ctx.beginPath();
  ctx.arc(0, -10, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Closed happy eyes
  ctx.beginPath();
  ctx.arc(-9, -12, 5, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(9, -12, 5, Math.PI, 0);
  ctx.stroke();
  // Praying paws (wai)
  ctx.fillStyle = '#f8ecd4';
  ctx.beginPath();
  ctx.ellipse(-4, 16, 7, 14, 0.15, 0, Math.PI * 2);
  ctx.ellipse(4, 16, 7, 14, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawProp(ctx: CanvasRenderingContext2D, prop: SceneProp, w: number, h: number, palette: StylePalette) {
  const px = prop.x * w;
  const py = prop.y * h;
  const s = prop.scale ?? 1;
  ctx.save();
  ctx.translate(px, py);
  ctx.scale(s, s);
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';

  if (prop.kind === 'door') {
    ctx.fillStyle = '#6f523b';
    roundRectPath(ctx, -64, -240, 128, 240, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f7c948';
    ctx.beginPath();
    ctx.arc(44, -120, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (prop.kind === 'sign') {
    ctx.fillStyle = palette.cardBg;
    roundRectPath(ctx, -110, -56, 220, 74, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.ink;
    ctx.font = fontSpec(800, 24);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prop.text || 'ป้ายร้าน', 0, -19, 200);
  } else if (prop.kind === 'cat') {
    drawPrayingCatSticker(ctx, 0, -30, 1.1);
  } else if (prop.kind === 'candle' || prop.kind === 'lantern') {
    const rg = ctx.createRadialGradient(0, -40, 4, 0, -40, 80);
    rg.addColorStop(0, 'rgba(255,190,80,0.55)');
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, -40, 80, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    roundRectPath(ctx, -10, -36, 20, 36, 4);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================
// Character Renderer (Supports Paper Sketch Outlines, Hats, Scarves, Bouquets)
// ============================================================
function drawCharacter(
  ctx: CanvasRenderingContext2D,
  charDef: CharacterDef,
  actor: ActorDef,
  px: number,
  py: number,
  scale: number,
  t: number,
  mouthOpen: number,
  palette: StylePalette,
  isPaper: boolean
) {
  const flip = actor.flip ? -1 : 1;
  let bob = Math.sin(t * 3) * 3;
  let jump = 0;
  let shake = 0;

  if (actor.pose === 'cheer') jump = -Math.abs(Math.sin(t * 5)) * 32;
  if (actor.pose === 'scared') shake = Math.sin(t * 40) * 3;
  if (actor.pose === 'walk') bob = -Math.abs(Math.sin(t * 6)) * 9;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scale, scale);

  // Ground shadow
  ctx.fillStyle = isPaper ? 'rgba(65,52,36,0.18)' : '#00000044';
  ctx.beginPath();
  ctx.ellipse(0, 0, 86, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(shake, jump + bob);
  ctx.scale(flip, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const outlineColor = palette.ink || '#2d2822';
  const strokeWeight = isPaper ? 4 : 3;
  const swing = actor.pose === 'walk' ? Math.sin(t * 6) * 16 : 0;

  // Legs
  ctx.fillStyle = charDef.pants || '#4b5563';
  roundRectPath(ctx, -38 + swing, -108, 32, 102, 12);
  ctx.fill();
  if (isPaper) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = strokeWeight;
    ctx.stroke();
  }
  roundRectPath(ctx, 6 - swing, -108, 32, 102, 12);
  ctx.fill();
  if (isPaper) ctx.stroke();

  // Shoes
  ctx.fillStyle = '#e8e2d5';
  roundRectPath(ctx, -42 + swing, -16, 38, 16, 8);
  ctx.fill();
  if (isPaper) ctx.stroke();
  roundRectPath(ctx, 4 - swing, -16, 38, 16, 8);
  ctx.fill();
  if (isPaper) ctx.stroke();

  // Torso / Outfit
  const shirt = charDef.shirt || '#6366f1';
  ctx.fillStyle = shirt;
  roundRectPath(ctx, -60, -258, 120, 158, 32);
  ctx.fill();
  if (isPaper) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = strokeWeight;
    ctx.stroke();
    // Subtle hand-drawn inner sketch accent
    ctx.fillStyle = '#ffffff18';
    roundRectPath(ctx, -56, -254, 34, 150, 20);
    ctx.fill();
  }

  // Coat inner collar or pocket
  if (charDef.outfit === 'coat') {
    ctx.fillStyle = '#f3efe6';
    ctx.beginPath();
    ctx.moveTo(-18, -258);
    ctx.lineTo(0, -180);
    ctx.lineTo(18, -258);
    ctx.closePath();
    ctx.fill();
    if (isPaper) ctx.stroke();
  }

  // Scarf accessory
  if (charDef.accessories?.includes('scarf')) {
    ctx.fillStyle = charDef.outfitAccent || '#4b9ca1';
    roundRectPath(ctx, -44, -268, 88, 24, 10);
    ctx.fill();
    if (isPaper) ctx.stroke();
    roundRectPath(ctx, -40, -248, 24, 74, 8);
    ctx.fill();
    if (isPaper) ctx.stroke();
  }

  // Arms
  const skin = charDef.skin || '#f1c27d';
  const drawArm = (sx: number, ex: number, ey: number) => {
    ctx.strokeStyle = shirt;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(sx, -230);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (isPaper) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(sx - 6, -240);
      ctx.lineTo(ex - 6, ey);
      ctx.moveTo(sx + 6, -220);
      ctx.lineTo(ex + 6, ey);
      ctx.stroke();
    }
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(ex, ey, 14, 0, Math.PI * 2);
    ctx.fill();
    if (isPaper) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };

  const sway = Math.sin(t * 3) * 8;
  if (actor.pose === 'cheer') {
    drawArm(-58, -96, -335 + sway);
    drawArm(58, 96, -335 - sway);
  } else if (actor.pose === 'scared') {
    drawArm(-58, -36, -188);
    drawArm(58, 36, -188);
  } else if (actor.pose === 'think') {
    drawArm(-58, -76, -142);
    drawArm(58, 32, -296);
  } else if (actor.pose === 'hold_flower') {
    drawArm(-58, -78, -140);
    drawArm(58, 72, -195);
    // Paper bouquet
    ctx.save();
    ctx.translate(78, -210);
    ctx.fillStyle = '#efe0ba';
    ctx.beginPath();
    ctx.moveTo(-26, -30);
    ctx.lineTo(26, -30);
    ctx.lineTo(8, 38);
    ctx.lineTo(-8, 38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 2.8;
    ctx.stroke();
    drawDaisyFlower(ctx, -10, -40, 14, '#f7c948', outlineColor);
    drawDaisyFlower(ctx, 12, -36, 13, '#f7c948', outlineColor);
    ctx.restore();
  } else if (actor.pose === 'talk') {
    drawArm(-58, -78, -142);
    drawArm(58, 92, -198 + Math.sin(t * 5) * 24);
  } else {
    drawArm(-58, -76, -142 + sway);
    drawArm(58, 76, -142 - sway);
  }

  // Neck
  ctx.fillStyle = skin;
  roundRectPath(ctx, -14, -288, 28, 32, 10);
  ctx.fill();

  // Back Hair
  const hair = charDef.hair || '#333333';
  ctx.fillStyle = hair;
  if (charDef.hairStyle === 'long') {
    roundRectPath(ctx, -72, -378, 144, 152, 42);
    ctx.fill();
    if (isPaper) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = strokeWeight;
      ctx.stroke();
    }
  } else if (charDef.hairStyle === 'bun') {
    ctx.beginPath();
    ctx.arc(0, -406, 25, 0, Math.PI * 2);
    ctx.fill();
    if (isPaper) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = strokeWeight;
      ctx.stroke();
    }
  }

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -330, 64, 0, Math.PI * 2);
  ctx.fill();
  if (isPaper) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = strokeWeight;
    ctx.stroke();
  }

  // Top Hair (kept cleanly ABOVE eyebrows at -342 and eyes at -324)
  if (charDef.hairStyle !== 'bald') {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, -348, 66, Math.PI * 1.06, Math.PI * 1.94);
    ctx.fill();
    roundRectPath(ctx, -64, -374, 128, 22, 11);
    ctx.fill();
  }

  // Eyes
  const face = actor.face || 'neutral';
  const blinking = (t + 0.7) % 4 < 0.12;
  ctx.fillStyle = outlineColor;
  if (blinking) {
    ctx.fillRect(-31, -326, 17, 4);
    ctx.fillRect(14, -326, 17, 4);
  } else {
    const radius = face === 'surprised' || face === 'scared' ? 8.5 : 6.5;
    ctx.beginPath();
    ctx.arc(-23, -324, radius, 0, Math.PI * 2);
    ctx.arc(23, -324, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyebrows
  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = 4;
  const ey =
    face === 'angry'
      ? [6, -6]
      : face === 'sad' || face === 'worried'
        ? [-5, 5]
        : face === 'scared' || face === 'surprised'
          ? [-6, -6]
          : [0, 0];
  ctx.beginPath();
  ctx.moveTo(-36, -342 + ey[0]);
  ctx.lineTo(-11, -342 + ey[1]);
  ctx.moveTo(36, -342 + ey[0]);
  ctx.lineTo(11, -342 + ey[1]);
  ctx.stroke();

  // Mouth
  const openAmt = actor.pose === 'talk' ? mouthOpen : face === 'surprised' || face === 'scared' ? 0.65 : 0;
  ctx.fillStyle = '#7a1f2b';
  if (openAmt > 0.14) {
    ctx.beginPath();
    ctx.ellipse(0, -296, 13, 4 + openAmt * 14, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    if (face === 'happy' || face === 'smirk') {
      ctx.arc(0, -304, 16, 0.15, Math.PI - 0.15);
    } else if (face === 'sad' || face === 'worried') {
      ctx.arc(0, -290, 14, Math.PI + 0.25, -0.25);
    } else {
      ctx.moveTo(-12, -296);
      ctx.lineTo(12, -296);
    }
    ctx.stroke();
  }

  // Glasses (rounded rectangle / circle frames matching reference character)
  if (charDef.glasses || charDef.accessories?.includes('glasses')) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 4;
    roundRectPath(ctx, -40, -340, 34, 24, 6);
    ctx.stroke();
    roundRectPath(ctx, 6, -340, 34, 24, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -328);
    ctx.lineTo(6, -328);
    ctx.stroke();
  }

  // Bucket hat with daisy flower (matching reference protagonist)
  if (charDef.accessories?.includes('flower_hat') || charDef.accessories?.includes('hat')) {
    ctx.fillStyle = '#d4a359';
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 3.5;
    // Crown
    ctx.beginPath();
    ctx.arc(0, -372, 62, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Wide brim cleanly above eyebrows
    ctx.beginPath();
    ctx.ellipse(0, -368, 86, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (charDef.accessories?.includes('flower_hat')) {
      drawDaisyFlower(ctx, 30, -396, 11, '#ffffff', outlineColor);
    }
  }

  ctx.restore();
}

// ============================================================
// Cards & Mockups Renderer (includes LINE-style Phone Mockup!)
// ============================================================
function drawCard(
  ctx: CanvasRenderingContext2D,
  card: CardDef,
  k: number,
  palette: StylePalette,
  localTime: number,
  w: number,
  h: number,
  isPaper: boolean
) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 1.4);
  ctx.translate(0, (1 - k) * -50);
  const cx = w / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const drawBox = (x: number, y: number, bw: number, bh: number, fill = palette.cardBg) => {
    ctx.shadowColor = isPaper ? 'rgba(45,40,34,0.16)' : '#00000066';
    ctx.shadowBlur = isPaper ? 16 : 28;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = fill;
    roundRectPath(ctx, x, y, bw, bh, 28);
    ctx.fill();
    ctx.shadowColor = '#00000000';
    if (isPaper) {
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 3.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = palette.ac;
      roundRectPath(ctx, x, y, 14, bh, 7);
      ctx.fill();
    }
  };

  if (card.type === 'phone_mockup') {
    const isWide = w > h;
    const pw = isWide ? Math.min(600, w * 0.56) : Math.min(620, w * 0.86);
    const ph = isWide ? Math.min(410, h * 0.56) : Math.min(660, h * 0.52);
    const px = cx - pw / 2;
    const py = isWide ? h * 0.13 : h * 0.1;

    // Frame
    drawBox(px, py, pw, ph, '#fbf7ec');

    // Header (sage teal bar like LINE chat in reference)
    ctx.fillStyle = '#c8d6cd';
    roundRectPath(ctx, px + 3, py + 3, pw - 6, 74, 24);
    ctx.fill();
    if (isPaper) {
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(px + 3, py + 77);
      ctx.lineTo(px + pw - 3, py + 77);
      ctx.stroke();
    }

    // Back chevron & avatar circle & title
    ctx.fillStyle = '#7ea67b';
    ctx.beginPath();
    ctx.arc(px + 68, py + 40, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = palette.ink;
    ctx.font = fontSpec(700, 26);
    ctx.textAlign = 'left';
    ctx.fillText('<', px + 20, py + 40);
    ctx.font = fontSpec(800, 25);
    ctx.fillText(card.chatTitle || card.text || 'แชตกลุ่ม', px + 100, py + 32, pw - 140);
    ctx.fillStyle = '#57534e';
    ctx.font = fontSpec(600, 16);
    ctx.fillText(card.chatSubtitle || 'กลุ่มแชต', px + 100, py + 56);

    // Messages
    let my = py + 102;
    const msgs = card.messages || [];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (my > py + ph - 92) break;
      if (m.system) {
        ctx.fillStyle = '#f3ece0';
        roundRectPath(ctx, cx - 120, my, 240, 34, 17);
        ctx.fill();
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.fillStyle = palette.ink;
        ctx.font = fontSpec(600, 18);
        ctx.textAlign = 'center';
        ctx.fillText(m.text || '', cx, my + 17);
        my += 48;
      } else if (m.stickerCat) {
        drawPrayingCatSticker(ctx, px + pw - 74, my + 34, 0.95);
        my += 88;
      } else if (m.flowerCard) {
        if (m.sender) {
          ctx.fillStyle = '#57534e';
          ctx.font = fontSpec(700, 17);
          ctx.textAlign = 'left';
          ctx.fillText(m.sender, px + 26, my);
          my += 16;
        }
        const cw = 300;
        const ch = 180;
        ctx.fillStyle = m.flowerCard.bgColor || '#efe0a2';
        roundRectPath(ctx, px + 24, my, cw, ch, 12);
        ctx.fill();
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        drawDaisyFlower(ctx, px + 104, my + 56, 20, m.flowerCard.flowerColor || '#f5be41', palette.ink);
        drawDaisyFlower(ctx, px + 210, my + 62, 15, m.flowerCard.flowerColor || '#f5be41', palette.ink);

        ctx.fillStyle = palette.ink;
        ctx.font = fontSpec(800, 26);
        ctx.textAlign = 'center';
        ctx.fillText(m.flowerCard.title, px + 24 + cw / 2, my + 126, cw - 20);
        if (m.flowerCard.subtitle) {
          ctx.font = fontSpec(600, 15);
          ctx.fillText(m.flowerCard.subtitle, px + 24 + cw / 2, my + 154, cw - 20);
        }
        if (m.readCount) {
          ctx.fillStyle = '#57534e';
          ctx.font = fontSpec(600, 14);
          ctx.textAlign = 'left';
          ctx.fillText(m.readCount, px + 34 + cw, my + ch - 12);
        }
        my += ch + 18;
      } else {
        if (m.sender && !m.mine) {
          ctx.fillStyle = '#57534e';
          ctx.font = fontSpec(700, 17);
          ctx.textAlign = 'left';
          ctx.fillText(m.sender, px + 26, my);
          my += 16;
        }
        const bubbleText = m.text || '';
        ctx.font = fontSpec(700, 22);
        const tw = Math.min(pw - 110, ctx.measureText(bubbleText).width + 38);
        const bx = m.mine ? px + pw - 26 - tw : px + 24;
        ctx.fillStyle = m.mine ? '#d9f2b4' : '#ffffff';
        roundRectPath(ctx, bx, my, tw, 48, 16);
        ctx.fill();
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 2.2;
        ctx.stroke();
        ctx.fillStyle = palette.ink;
        ctx.textAlign = 'left';
        ctx.fillText(bubbleText, bx + 18, my + 24, tw - 32);
        my += 62;
      }
    }

    // Bottom typing input bar
    const iy = py + ph - 62;
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, px + 22, iy, pw - 96, 44, 22);
    ctx.fill();
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    if (card.typingText) {
      const charCount = Math.min(card.typingText.length, Math.floor(localTime * 8) + 1);
      ctx.fillStyle = palette.ink;
      ctx.font = fontSpec(600, 20);
      ctx.textAlign = 'left';
      ctx.fillText(card.typingText.slice(0, charCount), px + 40, iy + 22);
    }

    // Send circle button
    ctx.fillStyle = '#4b9ca1';
    ctx.beginPath();
    ctx.arc(px + pw - 42, iy + 22, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (card.type === 'bignumber') {
    const match = String(card.text || '').match(/^([~+]?[\d,.]+)(.*)$/);
    let tx = card.text || '';
    if (match) {
      const prefix = match[1].startsWith('~') || match[1].startsWith('+') ? match[1][0] : '';
      const numStr = prefix ? match[1].slice(1) : match[1];
      const val = parseFloat(numStr.replace(/,/g, ''));
      const dec = (numStr.split('.')[1] || '').length;
      const q = easeOutCubic(localTime / 0.9);
      tx = prefix + (val * q).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + match[2];
    }

    if (card.badge) {
      ctx.fillStyle = '#f9f5eb';
      roundRectPath(ctx, cx - 120, h * 0.11, 240, 52, 26);
      ctx.fill();
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = palette.ink;
      ctx.font = fontSpec(700, 24);
      ctx.fillText(card.badge, cx, h * 0.11 + 26);
    }

    const boxY = card.badge ? h * 0.19 : h * 0.14;
    const bw = Math.min(540, w * 0.78);
    const bh = w > h ? 160 : 190;
    drawBox(cx - bw / 2, boxY, bw, bh);
    ctx.fillStyle = isPaper ? palette.ink : palette.ac;
    ctx.font = fontSpec(800, tx.length > 9 ? 62 : 84);
    ctx.fillText(tx, cx, boxY + bh * 0.41, bw - 36);
    ctx.fillStyle = isPaper ? '#44403c' : '#333333';
    ctx.font = fontSpec(700, 30);
    ctx.fillText(card.label || '', cx, boxY + bh * 0.78, bw - 40);
  } else if (card.type === 'bar_chart' && card.values?.length) {
    const bw = Math.min(600, w * 0.84);
    const bh = 320;
    const bx = cx - bw / 2;
    const by = h * 0.14;
    drawBox(bx, by, bw, bh);
    ctx.fillStyle = palette.ink;
    ctx.font = fontSpec(800, 30);
    ctx.textAlign = 'left';
    ctx.fillText(card.text || 'แผนภูมิข้อมูล', bx + 28, by + 40);

    const maxV = Math.max(1, ...card.values);
    const growth = easeOutCubic(localTime / 0.85);
    card.values.slice(0, 5).forEach((val, idx) => {
      const yRow = by + 84 + idx * 44;
      const lbl = card.labels?.[idx] || `#${idx + 1}`;
      ctx.fillStyle = palette.ink;
      ctx.font = fontSpec(600, 22);
      ctx.fillText(lbl, bx + 28, yRow + 12, 140);
      const barW = ((bw - 250) * (val / maxV)) * growth;
      ctx.fillStyle = palette.ac;
      roundRectPath(ctx, bx + 180, yRow, Math.max(8, barW), 24, 8);
      ctx.fill();
      ctx.fillStyle = palette.ink;
      ctx.fillText(String(val), bx + 190 + barW, yRow + 12);
    });
  } else if (card.type === 'compare') {
    const bw = Math.min(620, w * 0.86);
    const bx = cx - bw / 2;
    const by = h * 0.14;
    drawBox(bx, by, bw, 270);
    ctx.fillStyle = palette.ink;
    ctx.font = fontSpec(800, 28);
    ctx.fillText(card.text || 'เปรียบเทียบ', cx, by + 34);
    ctx.strokeStyle = palette.ink + '33';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, by + 64);
    ctx.lineTo(cx, by + 245);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = fontSpec(800, 24);
    ctx.fillStyle = palette.ac;
    ctx.fillText(card.leftTitle || 'ฝั่ง A', bx + 28, by + 80);
    ctx.fillText(card.rightTitle || 'ฝั่ง B', cx + 24, by + 80);
    ctx.font = fontSpec(600, 20);
    ctx.fillStyle = palette.ink;
    (card.leftItems || []).slice(0, 3).forEach((it, idx) => {
      ctx.fillText(`• ${it}`, bx + 28, by + 122 + idx * 38, bw / 2 - 42);
    });
    (card.rightItems || []).slice(0, 3).forEach((it, idx) => {
      ctx.fillText(`• ${it}`, cx + 24, by + 122 + idx * 38, bw / 2 - 42);
    });
  } else if (card.type === 'list' || card.type === 'checklist') {
    const items = (card.items || []).slice(0, 5);
    const ch = 66 + items.length * 58 + (card.text ? 62 : 0);
    const bw = Math.min(580, w * 0.82);
    const bx = cx - bw / 2;
    const by = h * 0.11;
    drawBox(bx, by, bw, ch);
    let y = by + 40;
    ctx.textAlign = 'left';
    if (card.text) {
      ctx.fillStyle = isPaper ? palette.ink : palette.ac;
      ctx.font = fontSpec(800, 34);
      ctx.fillText(card.text, bx + 34, y);
      y += 58;
    }
    ctx.font = fontSpec(600, 28);
    items.forEach((item, idx) => {
      ctx.fillStyle = palette.ac;
      if (card.type === 'checklist') {
        ctx.fillText('✓', bx + 34, y + idx * 58);
      } else {
        ctx.beginPath();
        ctx.arc(bx + 42, y + idx * 58, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = palette.ink;
      ctx.fillText(item, bx + 68, y + idx * 58, bw - 92);
    });
  } else if (card.type === 'end') {
    if (isPaper) {
      // Clean kraft paper end card matching final frame of reference video!
      ctx.fillStyle = '#57534e';
      ctx.font = fontSpec(600, 30);
      ctx.fillText(card.badge || 'เรื่องสั้น', cx, h * 0.2);

      ctx.fillStyle = palette.ink;
      ctx.font = fontSpec(800, 74);
      ctx.fillText(card.text || 'สวัสดีวันจันทร์', cx, h * 0.29, w - 80);

      drawDaisyFlower(ctx, cx - 90, h * 0.48, 36, '#f7c948', palette.ink);
      drawDaisyFlower(ctx, cx + 100, h * 0.52, 24, '#c084fc', palette.ink);

      if (card.label) {
        ctx.fillStyle = '#57534e';
        ctx.font = fontSpec(600, 24);
        ctx.fillText(card.label, cx, h * 0.72, w - 80);
      }
    } else {
      const g = ctx.createLinearGradient(0, h * 0.24, 0, h * 0.6);
      g.addColorStop(0, palette.ac);
      g.addColorStop(1, '#1b1340');
      ctx.shadowColor = '#000000aa';
      ctx.shadowBlur = 40;
      ctx.fillStyle = g;
      roundRectPath(ctx, cx - 300, h * 0.24, 600, 380, 40);
      ctx.fill();
      ctx.shadowColor = '#00000000';

      if (card.badge) {
        ctx.fillStyle = palette.hi;
        roundRectPath(ctx, cx - 120, h * 0.265, 240, 50, 25);
        ctx.fill();
        ctx.fillStyle = '#222222';
        ctx.font = fontSpec(800, 26);
        ctx.fillText(card.badge, cx, h * 0.265 + 25);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = fontSpec(800, 46);
      ctx.textBaseline = 'top';
      const lines = wrapThaiText(ctx, card.text || '', 520).slice(0, 4);
      lines.forEach((l, i) => {
        let px = cx - l.w / 2;
        ctx.textAlign = 'left';
        l.ws.forEach((seg) => {
          ctx.fillText(seg.w, px, h * 0.33 + i * 60);
          px += ctx.measureText(seg.w).width;
        });
      });

      ctx.textAlign = 'center';
      ctx.fillStyle = palette.hi;
      ctx.font = fontSpec(600, 28);
      ctx.textBaseline = 'middle';
      ctx.fillText(card.label || '', cx, h * 0.51, 540);
    }
  } else {
    ctx.font = fontSpec(800, 42);
    const bw = Math.min(580, w * 0.82);
    const lines = wrapThaiText(ctx, card.text || '', bw - 60).slice(0, 4);
    const bh = 54 + lines.length * 58;
    const by = h * 0.14;
    drawBox(cx - bw / 2, by, bw, bh);
    ctx.fillStyle = palette.ink;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      let px = cx - l.w / 2 + 6;
      l.ws.forEach((seg) => {
        ctx.fillText(seg.w, px, by + 44 + i * 58 + 20);
        px += ctx.measureText(seg.w).width;
      });
    });
  }

  ctx.restore();
}

// ============================================================
// HUD Chip Renderer
// ============================================================
function drawHudChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  w: number,
  isPaper: boolean,
  palette: StylePalette
) {
  if (!text) return;
  ctx.save();
  ctx.font = fontSpec(700, 26);
  const tw = Math.min(w - 80, ctx.measureText(text).width + 64);
  const x = w / 2 - tw / 2;
  const y = 32;

  ctx.fillStyle = isPaper ? '#fbf7ec' : 'rgba(15,17,28,0.78)';
  roundRectPath(ctx, x, y, tw, 48, 24);
  ctx.fill();
  ctx.strokeStyle = isPaper ? palette.ink : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = isPaper ? 2.8 : 1.5;
  ctx.stroke();

  // Green active indicator dot
  ctx.fillStyle = '#4ade80';
  ctx.beginPath();
  ctx.arc(x + 26, y + 24, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = isPaper ? palette.ink : '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 44, y + 25, tw - 60);
  ctx.restore();
}

// ============================================================
// Subtitles Renderer (Includes Reference Dual Sticker Subtitles)
// ============================================================
function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  scene: SceneDef,
  localTime: number,
  duration: number,
  palette: StylePalette,
  subtitleStyle: SubtitleStyle,
  subtitleScale: 'normal' | 'large',
  w: number,
  h: number
) {
  if (subtitleStyle === 'none') return;
  const state = getSubtitleState(scene.narration, scene.hl, localTime, duration, scene.subtitleEn);
  if (!state) return;

  const isWide = w > h;
  const size = isWide ? (subtitleScale === 'large' ? 38 : 34) : (subtitleScale === 'large' ? 48 : 42);
  const lineHeight = isWide ? 48 : (subtitleScale === 'large' ? 68 : 60);
  ctx.font = fontSpec(800, size);
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const lines = wrapThaiText(ctx, state.text, w - 90).slice(0, 2);

  if (subtitleStyle === 'sticker_dual') {
    // Matches reference TikTok video: bold cream/yellow/coral rounded pill + compact English box underneath
    const startY = isWide ? h * 0.74 : h * 0.72;
    lines.forEach((l, i) => {
      const hasHot = l.ws.some((seg) =>
        state.highlightRanges.some((r) => seg.i >= r[0] && seg.i < r[1])
      );
      const pillBg = hasHot ? (i === 1 ? '#de5b49' : '#f7c948') : '#fbf7ec';
      const pillInk = hasHot && i === 1 ? '#ffffff' : '#2d2822';
      const pillW = Math.min(w - 48, l.w + 46);
      const py = startY + i * (lineHeight + 6);

      ctx.shadowColor = 'rgba(0,0,0,0.22)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = pillBg;
      roundRectPath(ctx, w / 2 - pillW / 2, py, pillW, lineHeight - 2, 16);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.fillStyle = pillInk;
      ctx.textAlign = 'center';
      ctx.fillText(l.ws.map((s) => s.w).join(''), w / 2, py + (lineHeight - 2) / 2, w - 70);
    });

    if (state.subtitleEn) {
      ctx.font = fontSpec(600, isWide ? 19 : 21);
      const enLines = wrapThaiText(ctx, state.subtitleEn, w - 110).slice(0, isWide ? 1 : 2);
      const enH = enLines.length * 26 + 14;
      const enW = Math.min(w - 60, Math.max(...enLines.map((e) => e.w)) + 34);
      const enY = startY + lines.length * (lineHeight + 6) + 6;

      ctx.fillStyle = 'rgba(42, 38, 34, 0.84)';
      roundRectPath(ctx, w / 2 - enW / 2, enY, enW, enH, 10);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      enLines.forEach((el, i) => {
        ctx.fillText(el.ws.map((s) => s.w).join(''), w / 2, enY + 19 + i * 26, enW - 20);
      });
    }
    return;
  }

  // Standard box / red_pill / yellow_text / plain
  const boxH = lines.length * lineHeight + 30;
  const y0 = (isWide ? h * 0.82 : h * 0.77) - boxH / 2;

  if (subtitleStyle === 'dark_box' || subtitleStyle === 'yellow_text') {
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    roundRectPath(ctx, w / 2 - (w - 40) / 2, y0, w - 40, boxH, 22);
    ctx.fill();
  }

  lines.forEach((l, i) => {
    let px = w / 2 - l.w / 2;
    ctx.textAlign = 'left';
    const cy = y0 + 15 + lineHeight / 2 + i * lineHeight;
    l.ws.forEach((seg) => {
      const segW = ctx.measureText(seg.w).width;
      const isHot = state.highlightRanges.some((r) => seg.i >= r[0] && seg.i < r[1]);
      if (isHot && subtitleStyle === 'red_pill') {
        ctx.fillStyle = palette.ac;
        roundRectPath(ctx, px - 6, cy - lineHeight * 0.42, segW + 12, lineHeight * 0.84, 12);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.fillStyle = isHot && subtitleStyle !== 'plain' ? palette.hi : '#ffffff';
        if (subtitleStyle === 'plain' || subtitleStyle === 'red_pill') {
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 8;
          ctx.strokeText(seg.w, px, cy);
        }
      }
      ctx.fillText(seg.w, px, cy);
      px += segW;
    });
  });
}

// ============================================================
// Main Unified Frame Renderer (used identically by Preview & MP4 Export!)
// ============================================================
export function renderCartoonFrame(
  ctx: CanvasRenderingContext2D,
  project: CartoonProject,
  timeline: TimelineSegment[],
  t: number,
  options: {
    envelope: number[];
    leadSec?: number;
    speechStartSec?: number;
    scale?: number;
    subtitleScale?: 'normal' | 'large';
    pauseCandidates?: PauseCandidate[];
    cineEnabled?: boolean;
  }
) {
  if (!timeline.length) return;
  const scale = options.scale ?? 1;
  const palette = STYLES[project.style] || STYLES.paper;
  const isPaper = Boolean(palette.isPaper);

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  let idx = timeline.findIndex((seg) => t < seg.b);
  if (idx < 0) idx = timeline.length - 1;

  const seg = timeline[idx];
  const scene = seg.s;
  const localTime = Math.max(0, t - seg.a);
  const duration = Math.max(0.1, seg.b - seg.a);
  const progress = Math.min(1, localTime / duration);

  const isClay = project.style === 'clay';
  const fpsQ = project.clay?.stopmotionFps || 12;
  const animTime = isClay ? Math.floor(t * fpsQ) / fpsQ : t;
  const mouthOpen = getMouthOpenAt(
    t,
    options.envelope,
    options.leadSec ?? 0.4,
    options.speechStartSec ?? 0
  );

  // Determine viewport bounds (full 9:16 vs centered 16:9 letterbox strip)
  const isLetterbox = project.layout === 'letterbox';
  const vpX = 0;
  const vpY = isLetterbox ? Math.round(CANVAS_H * 0.34) : 0;
  const vpW = CANVAS_W;
  const vpH = isLetterbox ? Math.round(CANVAS_H * 0.32) : CANVAS_H;

  if (isLetterbox) {
    ctx.fillStyle = '#09090d';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Top & bottom bold white titles
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (project.letterbox?.topText) {
      ctx.font = fontSpec(800, 44);
      ctx.fillText(project.letterbox.topText, CANVAS_W / 2, CANVAS_H * 0.17, CANVAS_W - 60);
    }
    if (project.letterbox?.bottomText) {
      ctx.font = fontSpec(700, 34);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(project.letterbox.bottomText, CANVAS_W / 2, CANVAS_H * 0.83, CANVAS_W - 60);
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(vpX, vpY, vpW, vpH);
  ctx.clip();
  ctx.translate(vpX, vpY);

  // Use virtual 16:9 HD coordinate space (1280x720) in letterbox mode so cards, HUD, actors & subtitles fit cleanly!
  const vW = isLetterbox ? 1280 : vpW;
  const vH = isLetterbox ? 720 : vpH;
  if (isLetterbox) {
    ctx.scale(vpW / 1280, vpH / 720);
  }

  // Camera transform inside viewport (always inside overscan margins!)
  ctx.save();
  const cam = scene.camera || 'static';
  let zoom = cam === 'push_in' ? 1 + 0.06 * progress : cam === 'pull_out' ? 1.06 - 0.06 * progress : 1;
  let panX = cam === 'pan_left' ? -26 * progress : cam === 'pan_right' ? 26 * progress : 0;
  let panY = cam === 'tilt_up' ? -20 * progress : 0;
  if (cam === 'shake') {
    panX += Math.sin(t * 48) * 5;
    panY += Math.cos(t * 42) * 4;
  }

  ctx.translate(vW / 2 + panX, vH / 2 + panY);
  ctx.scale(zoom, zoom);
  ctx.translate(-vW / 2, -vH / 2);

  drawBackground(ctx, scene, palette, project.style, vW, vH, animTime);

  // Props layer
  (scene.props || []).forEach((p) => drawProp(ctx, p, vW, vH, palette));

  // Actors layer
  const actorCount = scene.actors.length;
  scene.actors.forEach((actor) => {
    const charDef = project.characters.find((c) => c.id === actor.char) || project.characters[0];
    if (!charDef) return;
    let ax = actor.x;
    if (actor.moveTo) {
      const mt = easeOutCubic((localTime - 0.2) / Math.max(0.6, duration - 0.5));
      ax = actor.x + (actor.moveTo.x - actor.x) * mt;
    }
    const baseScale = isLetterbox ? (actorCount > 1 ? 0.68 : 0.8) : (actorCount > 1 ? 0.82 : 1.02);
    const ay = isLetterbox ? Math.min(0.84, (actor.y ?? 0.67) + 0.08) : (actor.y ?? 0.67);
    drawCharacter(
      ctx,
      charDef,
      actor,
      ax * vW,
      ay * vH,
      baseScale * (actor.scale ?? 1),
      animTime,
      mouthOpen,
      palette,
      isPaper
    );
  });

  drawFx(ctx, scene.fx, vW, vH, animTime);
  ctx.restore();

  // Optional CINE LAYER post-process (only before UI/HUD/cards/subtitles!)
  if (options.cineEnabled ?? project.cineLayer?.enabled) {
    applyCineLayer(ctx, scene, project, vW, vH, t);
  }

  // Soft vignette
  const vig = ctx.createRadialGradient(vW / 2, vH / 2, vH * 0.32, vW / 2, vH / 2, vH * 0.78);
  vig.addColorStop(0, '#00000000');
  vig.addColorStop(
    1,
    project.style === 'shrine' || project.style === 'dark'
      ? 'rgba(0,0,0,0.72)'
      : isPaper
        ? 'rgba(92,70,40,0.22)'
        : 'rgba(0,0,0,0.35)'
  );
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, vW, vH);

  // Persistent HUD chip at top (if enabled)
  if (project.hud?.enabled) {
    const hudLabel = scene.hudText || project.hud.startText || project.title;
    drawHudChip(ctx, hudLabel, vW, isPaper, palette);
  } else if (idx === 0 && t < 3.0) {
    ctx.globalAlpha = easeOutCubic(t / 0.4) * easeOutCubic((3.0 - t) / 0.4);
    ctx.fillStyle = palette.ac;
    roundRectPath(ctx, 40, 56, vW - 80, 96, 26);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = fontSpec(800, 36);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(project.title || '', vW / 2, 104, vW - 120);
    ctx.globalAlpha = 1;
  }

  // Animated overlay card (with atText timing sync)
  const speechDur = Math.max(0.4, seg.speechEnd - seg.a);
  const sceneRelSpeech = Math.max(0, seg.a - (options.leadSec ?? 0.4));
  const cardsToDraw = [scene.card, ...(scene.extraCards || [])].filter((c): c is CardDef => Boolean(c));
  cardsToDraw.forEach((card) => {
    const kw = card.atText || card.at;
    const appearAt =
      card.type === 'phone_mockup' || card.type === 'end'
        ? 0.08
        : resolveAtTextLocalTime(scene.narration, kw, speechDur, sceneRelSpeech, options.pauseCandidates);
    if (localTime >= appearAt) {
      drawCard(
        ctx,
        card,
        easeOutCubic((localTime - appearAt) / 0.35),
        palette,
        localTime - appearAt,
        vW,
        vH,
        isPaper
      );
    }
  });

  // Subtitles
  const subStyle: SubtitleStyle =
    project.subtitleStyle || (isPaper ? 'sticker_dual' : 'yellow_text');
  drawSubtitles(
    ctx,
    scene,
    localTime,
    duration,
    palette,
    subStyle,
    options.subtitleScale ?? 'normal',
    vW,
    vH
  );

  // Subtle cross-scene fade in
  const fadeAlpha = (Math.max(0, 0.2 - localTime) / 0.2) * 0.45;
  if (fadeAlpha > 0 && idx > 0) {
    ctx.fillStyle = isPaper ? `rgba(235,224,201,${fadeAlpha})` : `rgba(0,0,0,${fadeAlpha})`;
    ctx.fillRect(0, 0, vW, vH);
  }

  ctx.restore();
}
