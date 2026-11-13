import type {
  ActorDef,
  CardDef,
  CartoonProject,
  CharacterDef,
  SceneDef,
  SceneFx,
  TimelineSegment,
} from '../types/cartoon';
import { STYLES, type StylePalette } from './cartoonData';
import { getMouthOpenAt, getSubtitleState } from './projectLogic';

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

function drawBackground(
  ctx: CanvasRenderingContext2D,
  scene: SceneDef,
  palette: StylePalette,
  styleKey: CartoonProject['style'],
  t: number
) {
  const mood = scene.mood;
  const moodMap: Record<string, [string, string]> = {
    day: ['#7fd0ff', '#e8f8ff'],
    dusk: ['#ff9a6b', '#53407f'],
    dark: ['#07070d', '#1b1730'],
  };
  const colors =
    moodMap[mood] && styleKey !== 'shrine' && styleKey !== 'dark'
      ? moodMap[mood]
      : [palette.t, palette.b];

  let grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.64);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(-60, -60, CANVAS_W + 120, CANVAS_H);

  const isDark =
    mood === 'night' ||
    mood === 'dark' ||
    mood === 'dusk' ||
    styleKey === 'night' ||
    styleKey === 'shrine' ||
    styleKey === 'dark' ||
    styleKey === 'cinema';
  const rand = makePrng(7);

  if (isDark) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 2 + i));
      ctx.fillRect(rand() * CANVAS_W, rand() * CANVAS_H * 0.4, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.hi;
    ctx.beginPath();
    ctx.arc(CANVAS_W * 0.8, CANVAS_H * 0.12, 44, 0, Math.PI * 2);
    ctx.fill();
  }

  if (mood !== 'room' && styleKey !== 'shrine') {
    ctx.fillStyle = palette.sk;
    let px = -20;
    while (px < CANVAS_W + 20) {
      const bw = 60 + rand() * 70;
      const bh = 120 + rand() * 280;
      ctx.fillRect(px, CANVAS_H * 0.64 - bh, bw, bh);
      if (isDark) {
        ctx.fillStyle = palette.hi;
        for (let k = 0; k < 6; k++) {
          if (rand() > 0.5) {
            ctx.fillRect(
              px + 8 + (k % 3) * (bw / 3.4),
              CANVAS_H * 0.64 - bh + 20 + Math.floor(k / 3) * 50,
              10,
              16
            );
          }
        }
        ctx.fillStyle = palette.sk;
      }
      px += bw + 6;
    }
  }

  if (styleKey === 'shrine' || mood === 'room') {
    const rg = ctx.createRadialGradient(
      CANVAS_W / 2,
      CANVAS_H * 0.4,
      10,
      CANVAS_W / 2,
      CANVAS_H * 0.4,
      CANVAS_W * 0.8
    );
    rg.addColorStop(0, `${palette.hi}aa`);
    rg.addColorStop(1, '#00000000');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  grad = ctx.createLinearGradient(0, CANVAS_H * 0.64, 0, CANVAS_H);
  grad.addColorStop(0, palette.g);
  grad.addColorStop(1, '#00000066');
  ctx.fillStyle = grad;
  ctx.fillRect(-60, CANVAS_H * 0.64, CANVAS_W + 120, CANVAS_H);
}

function drawFx(ctx: CanvasRenderingContext2D, fx: SceneFx, t: number) {
  const rand = makePrng(3);
  if (fx === 'rain') {
    ctx.strokeStyle = '#cfe8ffaa';
    ctx.lineWidth = 2;
    for (let i = 0; i < 70; i++) {
      const px = rand() * CANVAS_W;
      const py = (rand() * CANVAS_H + t * 900) % CANVAS_H;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - 6, py + 24);
      ctx.stroke();
    }
  } else if (fx === 'snow') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.arc(
        (rand() * CANVAS_W + Math.sin(t + i) * 20) % CANVAS_W,
        (rand() * CANVAS_H + t * 80) % CANVAS_H,
        3 + rand() * 3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  } else if (fx === 'sparkles') {
    ctx.fillStyle = '#ffe14d';
    for (let i = 0; i < 24; i++) {
      ctx.globalAlpha = Math.abs(Math.sin(t * 3 + i));
      ctx.fillRect(rand() * CANVAS_W, rand() * CANVAS_H * 0.7, 6, 6);
    }
    ctx.globalAlpha = 1;
  } else if (fx === 'fog') {
    const g = ctx.createLinearGradient(0, CANVAS_H * 0.4, 0, CANVAS_H * 0.7);
    g.addColorStop(0, '#ffffff00');
    g.addColorStop(0.5, '#ffffff44');
    g.addColorStop(1, '#ffffff00');
    ctx.fillStyle = g;
    ctx.fillRect(Math.sin(t * 0.5) * 30 - 30, CANVAS_H * 0.4, CANVAS_W + 60, CANVAS_H * 0.3);
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  charDef: CharacterDef,
  actor: ActorDef,
  px: number,
  py: number,
  scale: number,
  t: number,
  mouthOpen: number
) {
  const flip = actor.flip ? -1 : 1;
  let bob = Math.sin(t * 3) * 4;
  let jump = 0;
  let shake = 0;

  if (actor.pose === 'cheer') jump = -Math.abs(Math.sin(t * 5)) * 40;
  if (actor.pose === 'scared') shake = Math.sin(t * 40) * 3;
  if (actor.pose === 'walk') bob = -Math.abs(Math.sin(t * 6)) * 10;

  ctx.save();
  ctx.translate(px, py);
  ctx.scale(scale, scale);

  // Ground shadow
  ctx.fillStyle = '#00000044';
  ctx.beginPath();
  ctx.ellipse(0, 0, 90, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(shake, jump + bob);
  ctx.scale(flip, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const swing = actor.pose === 'walk' ? Math.sin(t * 6) * 18 : 0;

  // Legs
  ctx.fillStyle = '#2b2d42';
  roundRectPath(ctx, -42 + swing, -110, 36, 110, 16);
  ctx.fill();
  roundRectPath(ctx, 6 - swing, -110, 36, 110, 16);
  ctx.fill();

  // Torso
  const shirt = charDef.shirt || '#6366f1';
  ctx.fillStyle = shirt;
  roundRectPath(ctx, -62, -262, 124, 166, 40);
  ctx.fill();
  ctx.fillStyle = '#ffffff22';
  roundRectPath(ctx, -62, -262, 40, 166, 30);
  ctx.fill();

  // Arms
  const skin = charDef.skin || '#f1c27d';
  const drawArm = (sx: number, ex: number, ey: number) => {
    ctx.strokeStyle = shirt;
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(sx, -235);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(ex, ey, 15, 0, Math.PI * 2);
    ctx.fill();
  };

  const sway = Math.sin(t * 3) * 10;
  if (actor.pose === 'cheer') {
    drawArm(-62, -100, -340 + sway);
    drawArm(62, 100, -340 - sway);
  } else if (actor.pose === 'scared') {
    drawArm(-62, -40, -190);
    drawArm(62, 40, -190);
  } else if (actor.pose === 'think') {
    drawArm(-62, -82, -150);
    drawArm(62, 25, -250);
  } else if (actor.pose === 'talk') {
    drawArm(-62, -84, -140);
    drawArm(62, 96, -200 + Math.sin(t * 5) * 30);
  } else {
    drawArm(-62, -82, -140 + sway);
    drawArm(62, 82, -140 - sway);
  }

  // Neck
  ctx.fillStyle = skin;
  roundRectPath(ctx, -14, -290, 28, 34, 10);
  ctx.fill();

  // Back Hair
  const hair = charDef.hair || '#333333';
  ctx.fillStyle = hair;
  if (charDef.hairStyle === 'long') {
    roundRectPath(ctx, -72, -380, 144, 170, 50);
    ctx.fill();
  }
  if (charDef.hairStyle === 'bun') {
    ctx.beginPath();
    ctx.arc(0, -402, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, -330, 66, 0, Math.PI * 2);
  ctx.fill();

  // Top Hair (crown + bangs above eyebrows/eyes)
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(0, -346, 68, Math.PI * 1.05, Math.PI * 1.95);
  ctx.fill();
  roundRectPath(ctx, -66, -372, 132, 24, 12);
  ctx.fill();

  // Eyes
  const face = actor.face || 'neutral';
  const blinking = t % 4 < 0.12;
  ctx.fillStyle = '#1b1b2f';
  if (blinking) {
    ctx.fillRect(-32, -326, 18, 4);
    ctx.fillRect(14, -326, 18, 4);
  } else {
    const radius = face === 'surprised' || face === 'scared' ? 9 : 7;
    ctx.beginPath();
    ctx.arc(-24, -324, radius, 0, Math.PI * 2);
    ctx.arc(24, -324, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyebrows
  ctx.strokeStyle = '#1b1b2f';
  ctx.lineWidth = 4;
  const ey =
    face === 'angry'
      ? [6, -6]
      : face === 'sad'
        ? [-6, 6]
        : face === 'scared' || face === 'surprised'
          ? [-6, -6]
          : [0, 0];
  ctx.beginPath();
  ctx.moveTo(-38, -342 + ey[0]);
  ctx.lineTo(-12, -342 + ey[1]);
  ctx.moveTo(38, -342 + ey[0]);
  ctx.lineTo(12, -342 + ey[1]);
  ctx.stroke();

  // Mouth
  const openAmt = actor.pose === 'talk' ? mouthOpen : face === 'surprised' || face === 'scared' ? 0.7 : 0;
  ctx.fillStyle = '#7a1f2b';
  if (openAmt > 0.12) {
    ctx.beginPath();
    ctx.ellipse(0, -296, 14, 5 + openAmt * 16, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    if (face === 'happy' || face === 'smirk') {
      ctx.arc(0, -304, 18, 0.1, Math.PI - 0.1);
    } else if (face === 'sad') {
      ctx.arc(0, -290, 16, Math.PI + 0.2, -0.2);
    } else {
      ctx.moveTo(-14, -296);
      ctx.lineTo(14, -296);
    }
    ctx.stroke();
  }

  // Glasses
  if (charDef.glasses) {
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-24, -328, 16, 0, Math.PI * 2);
    ctx.moveTo(40, -328);
    ctx.arc(24, -328, 16, 0, Math.PI * 2);
    ctx.moveTo(-8, -328);
    ctx.lineTo(8, -328);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: CardDef,
  k: number,
  palette: StylePalette,
  localTime: number
) {
  ctx.save();
  ctx.globalAlpha = Math.min(1, k * 1.4);
  ctx.translate(0, (1 - k) * -70);
  const cx = CANVAS_W / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const drawBox = (y: number, h: number, fill = '#fff8ec') => {
    ctx.shadowColor = '#00000077';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = fill;
    roundRectPath(ctx, cx - 310, y, 620, h, 36);
    ctx.fill();
    ctx.shadowColor = '#00000000';
    ctx.fillStyle = palette.ac;
    roundRectPath(ctx, cx - 310, y, 16, h, 8);
    ctx.fill();
  };

  if (card.type === 'bignumber') {
    const match = String(card.text || '').match(/^([\d,.]+)(.*)$/);
    let tx = card.text || '';
    if (match) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      const dec = (match[1].split('.')[1] || '').length;
      const q = easeOutCubic(localTime / 1.2);
      tx = (val * q).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + match[2];
    }
    drawBox(150, 290);
    ctx.fillStyle = palette.ac;
    ctx.font = fontSpec(800, tx.length > 10 ? 72 : 104);
    ctx.fillText(tx, cx, 270);
    ctx.fillStyle = '#333333';
    ctx.font = fontSpec(600, 38);
    ctx.fillText(card.label || '', cx, 380);
  } else if (card.type === 'list') {
    const items = (card.items || []).slice(0, 5);
    const h = 60 + items.length * 66 + (card.text ? 70 : 0);
    drawBox(130, h);
    let y = 170;
    ctx.textAlign = 'left';
    if (card.text) {
      ctx.fillStyle = palette.ac;
      ctx.font = fontSpec(800, 40);
      ctx.fillText(card.text, cx - 270, y + 10);
      y += 70;
    }
    ctx.font = fontSpec(600, 36);
    items.forEach((item, idx) => {
      ctx.fillStyle = palette.ac;
      ctx.beginPath();
      ctx.arc(cx - 268, y + 34 + idx * 66, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222222';
      ctx.fillText(item, cx - 240, y + 34 + idx * 66);
    });
  } else if (card.type === 'end') {
    const g = ctx.createLinearGradient(0, 300, 0, 700);
    g.addColorStop(0, palette.ac);
    g.addColorStop(1, '#1b1340');
    ctx.shadowColor = '#000000aa';
    ctx.shadowBlur = 40;
    ctx.fillStyle = g;
    roundRectPath(ctx, cx - 320, 300, 640, 420, 44);
    ctx.fill();
    ctx.shadowColor = '#00000000';

    if (card.badge) {
      ctx.fillStyle = palette.hi;
      roundRectPath(ctx, cx - 120, 336, 240, 54, 27);
      ctx.fill();
      ctx.fillStyle = '#222222';
      ctx.font = fontSpec(800, 30);
      ctx.fillText(card.badge, cx, 364);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = fontSpec(800, 54);
    ctx.textBaseline = 'top';
    const lines = wrapThaiText(ctx, card.text || '', 560).slice(0, 4);
    lines.forEach((l, i) => {
      let px = cx - l.w / 2;
      ctx.textAlign = 'left';
      l.ws.forEach((seg) => {
        ctx.fillText(seg.w, px, 420 + i * 68);
        px += ctx.measureText(seg.w).width;
      });
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = palette.hi;
    ctx.font = fontSpec(600, 32);
    ctx.textBaseline = 'middle';
    ctx.fillText(card.label || '', cx, 676);
  } else {
    ctx.font = fontSpec(800, 48);
    const lines = wrapThaiText(ctx, card.text || '', 540).slice(0, 4);
    const h = 50 + lines.length * 64;
    drawBox(150, h);
    ctx.fillStyle = '#222222';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      let px = cx - l.w / 2 + 8;
      l.ws.forEach((seg) => {
        ctx.fillText(seg.w, px, 150 + 45 + i * 64 + 28);
        px += ctx.measureText(seg.w).width;
      });
    });
  }

  ctx.restore();
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  scene: SceneDef,
  localTime: number,
  duration: number,
  palette: StylePalette,
  subtitleScale: 'normal' | 'large'
) {
  const state = getSubtitleState(scene.narration, scene.hl, localTime, duration);
  if (!state) return;

  const size = subtitleScale === 'large' ? 58 : 50;
  const lineHeight = subtitleScale === 'large' ? 78 : 70;
  ctx.font = fontSpec(800, size);
  ctx.textBaseline = 'top';
  ctx.lineJoin = 'round';

  const lines = wrapThaiText(ctx, state.text, 620).slice(0, 2);
  const h = lines.length * lineHeight + 36;
  const y0 = CANVAS_H * 0.76 - h / 2;

  ctx.fillStyle = '#000000aa';
  roundRectPath(ctx, CANVAS_W / 2 - 340, y0, 680, h, 28);
  ctx.fill();

  lines.forEach((l, i) => {
    let px = CANVAS_W / 2 - l.w / 2;
    ctx.textAlign = 'left';
    l.ws.forEach((seg) => {
      const isHot = state.highlightRanges.some((r) => seg.i >= r[0] && seg.i < r[1]);
      ctx.fillStyle = isHot ? palette.hi : '#ffffff';
      ctx.fillText(seg.w, px, y0 + 18 + i * lineHeight);
      px += ctx.measureText(seg.w).width;
    });
  });
}

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
  }
) {
  if (!timeline.length) return;
  const scale = options.scale ?? 1;
  const palette = STYLES[project.style] || STYLES.night;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  let idx = timeline.findIndex((seg) => t < seg.b);
  if (idx < 0) idx = timeline.length - 1;

  const seg = timeline[idx];
  const scene = seg.s;
  const localTime = Math.max(0, t - seg.a);
  const duration = Math.max(0.1, seg.b - seg.a);
  const progress = Math.min(1, localTime / duration);

  const animTime = project.style === 'clay' ? Math.floor(t * 12) / 12 : t;
  const mouthOpen = getMouthOpenAt(
    t,
    options.envelope,
    options.leadSec ?? 0.4,
    options.speechStartSec ?? 0
  );

  ctx.save();
  const zoom = 1 + 0.05 * progress;
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);

  drawBackground(ctx, scene, palette, project.style, animTime);

  const actorCount = scene.actors.length;
  scene.actors.forEach((actor) => {
    const charDef =
      project.characters.find((c) => c.id === actor.char) || project.characters[0];
    if (!charDef) return;
    drawCharacter(
      ctx,
      charDef,
      actor,
      actor.x * CANVAS_W,
      CANVAS_H * 0.66,
      actorCount > 1 ? 0.8 : 1,
      animTime,
      mouthOpen
    );
  });

  drawFx(ctx, scene.fx, animTime);
  ctx.restore();

  // Vignette
  const vig = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H * 0.3,
    CANVAS_W / 2,
    CANVAS_H / 2,
    CANVAS_H * 0.75
  );
  vig.addColorStop(0, '#00000000');
  vig.addColorStop(1, project.style === 'shrine' || project.style === 'dark' ? '#000000cc' : '#00000066');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Intro title banner
  if (idx === 0 && t < 3.2) {
    ctx.globalAlpha = easeOutCubic(t / 0.4) * easeOutCubic((3.2 - t) / 0.4);
    ctx.fillStyle = palette.ac;
    roundRectPath(ctx, 40, 70, CANVAS_W - 80, 110, 30);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = fontSpec(800, 40);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(project.title || '', CANVAS_W / 2, 125, CANVAS_W - 120);
    ctx.globalAlpha = 1;
  }

  // Animated overlay card
  const card = scene.card;
  if (card) {
    let appearAt = 0.3;
    if (card.at && scene.narration.length > 0) {
      const charIdx = scene.narration.indexOf(card.at);
      if (charIdx >= 0) {
        appearAt = (charIdx / scene.narration.length) * duration;
      }
    }
    if (localTime >= appearAt) {
      drawCard(ctx, card, easeOutCubic((localTime - appearAt) / 0.4), palette, localTime - appearAt);
    }
  }

  // Thai subtitles
  drawSubtitles(
    ctx,
    scene,
    localTime,
    duration,
    palette,
    options.subtitleScale ?? 'normal'
  );

  // Cross-scene fade in
  const fadeAlpha = (Math.max(0, 0.25 - localTime) / 0.25) * 0.8;
  if (fadeAlpha > 0 && idx > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}
