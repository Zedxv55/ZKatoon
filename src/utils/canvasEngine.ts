import type {
  FxTypeId,
  LookGradeId,
  StudioCharacter,
  StudioEpisode,
  StudioProject,
  StudioScene,
  StudioTimelineSegment,
  SubtitleMode,
} from '../types/studio';
import {
  clamp,
  drawRoundedRect,
  easeInOutCubic,
  easeOutCubic,
  getViewportGeometry,
  hashString,
  lerp,
  mulberry32,
  segmentThaiWords,
  withAlpha,
  wrapThaiLines,
} from './canvasHelpers';
import { evictFarBackgroundCaches, getOrBuildBackgroundCache } from './drawBackgrounds';
import { drawCharacter } from './drawCharacter';
import { drawPovForeground, drawStudioCard, drawVectorProp } from './drawPropsAndCards';
import { applyAnimateStylePlugin } from './animateStyles';
import { getActiveSubtitleClause, resolveAtTextLocalSec } from './timelineSync';
import type { PauseCandidate } from './timelineSync';

export interface RenderFrameOptions {
  envelope?: number[];
  leadSec?: number;
  speechStartSec?: number;
  pauseCandidates?: PauseCandidate[];
  showSubtitles?: boolean;
  isExport?: boolean;
}

let frameCounter = 0;
let autoDegradeQuality = false;

export function getAutoQualityDegraded(): boolean {
  return autoDegradeQuality;
}

function getCameraTransform(
  scene: StudioScene,
  progress: number,
  stageW: number,
  stageH: number,
  tAbs: number
): { zoom: number; panX: number; panY: number } {
  const shotZoom = scene.camera.shot === 'close' ? 1.16 : scene.camera.shot === 'wide' ? 0.94 : 1.02;
  let zoom = shotZoom;
  let panX = 0;
  let panY = 0;
  const p = easeInOutCubic(progress);

  switch (scene.camera.type) {
    case 'push_in':
      zoom = shotZoom * lerp(1.0, 1.12, p);
      break;
    case 'pull_out':
      zoom = shotZoom * lerp(1.12, 1.0, p);
      break;
    case 'pan_left':
      panX = lerp(stageW * 0.04, -stageW * 0.04, p);
      break;
    case 'pan_right':
      panX = lerp(-stageW * 0.04, stageW * 0.04, p);
      break;
    case 'tilt_up':
      panY = lerp(stageH * 0.035, -stageH * 0.035, p);
      break;
    case 'shake':
      panX = Math.sin(tAbs * 42) * 5;
      panY = Math.cos(tAbs * 37) * 4;
      break;
    default:
      break;
  }
  return { zoom, panX, panY };
}

function drawDeterministicFx(
  ctx: CanvasRenderingContext2D,
  scene: StudioScene,
  stageW: number,
  stageH: number,
  localTime: number,
  degrade: boolean
): void {
  if (!scene.fx || scene.fx.length === 0) return;
  const baseSeed = hashString(scene.id);

  for (const fx of scene.fx) {
    const intensity = clamp(fx.intensity ?? 0.5, 0, 1);
    if (intensity <= 0.01) continue;
    const rand = mulberry32(baseSeed + hashString(fx.type));

    if (fx.type === 'rain') {
      const count = Math.round((degrade ? 24 : 55) * intensity);
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < count; i++) {
        const sx = ((rand() * stageW + localTime * 110) % (stageW + 40)) - 20;
        const sy = ((rand() * stageH + localTime * 720) % (stageH + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx - 6, sy + 18);
        ctx.stroke();
      }
    } else if (fx.type === 'snow' || fx.type === 'dust' || fx.type === 'fireflies' || fx.type === 'sparkles' || fx.type === 'embers') {
      const count = Math.round((degrade ? 14 : 28) * intensity);
      for (let i = 0; i < count; i++) {
        const x0 = rand() * stageW;
        const y0 = rand() * stageH;
        const speed = fx.type === 'embers' ? -45 : fx.type === 'snow' ? 50 : -14;
        const px = (x0 + Math.sin(localTime * 1.4 + i) * 18 + stageW) % stageW;
        const py = (y0 + localTime * speed + stageH * 10) % stageH;
        const r = fx.type === 'fireflies' ? 2.5 + Math.sin(localTime * 6 + i) * 1.2 : 1.8 + rand() * 2;
        ctx.fillStyle =
          fx.type === 'embers'
            ? 'rgba(251, 146, 60, 0.7)'
            : fx.type === 'fireflies' || fx.type === 'sparkles'
              ? 'rgba(250, 204, 21, 0.65)'
              : 'rgba(255, 255, 255, 0.42)';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(0.8, r), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fx.type === 'confetti') {
      const count = Math.round(28 * intensity);
      const colors = ['#F5C542', '#38BDF8', '#F43F5E', '#34D399', '#A855F7'];
      for (let i = 0; i < count; i++) {
        const px = (rand() * stageW + Math.sin(localTime * 3 + i) * 24 + stageW) % stageW;
        const py = (rand() * stageH + localTime * 160) % stageH;
        ctx.fillStyle = colors[i % colors.length];
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(localTime * 4 + i);
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
      }
    } else if (fx.type === 'fog') {
      const fg = ctx.createLinearGradient(0, stageH * 0.55, 0, stageH);
      fg.addColorStop(0, 'rgba(200,215,230,0)');
      fg.addColorStop(1, `rgba(200,215,230,${(0.28 * intensity).toFixed(2)})`);
      ctx.fillStyle = fg;
      ctx.fillRect(0, stageH * 0.55, stageW, stageH * 0.45);
    } else if (fx.type === 'flicker') {
      const f = Math.sin(localTime * 27) > 0.75 ? 0.18 * intensity : 0;
      if (f > 0) {
        ctx.fillStyle = `rgba(0,0,0,${f.toFixed(2)})`;
        ctx.fillRect(0, 0, stageW, stageH);
      }
    } else if (fx.type === 'flash' && localTime < 0.25) {
      ctx.fillStyle = `rgba(255,255,255,${((1 - localTime / 0.25) * 0.65 * intensity).toFixed(2)})`;
      ctx.fillRect(0, 0, stageW, stageH);
    } else if (fx.type === 'speedlines') {
      ctx.strokeStyle = `rgba(255,255,255,${(0.22 * intensity).toFixed(2)})`;
      ctx.lineWidth = 2;
      const cx = stageW / 2;
      const cy = stageH / 2;
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * Math.PI * 2 + Math.floor(localTime * 12) * 0.1;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * stageW * 0.35, cy + Math.sin(ang) * stageW * 0.35);
        ctx.lineTo(cx + Math.cos(ang) * stageW * 0.9, cy + Math.sin(ang) * stageW * 0.9);
        ctx.stroke();
      }
    } else if (fx.type === 'vignette') {
      const vg = ctx.createRadialGradient(
        stageW / 2,
        stageH / 2,
        stageW * 0.28,
        stageW / 2,
        stageH / 2,
        Math.max(stageW, stageH) * 0.72
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${(0.62 * intensity).toFixed(2)})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, stageW, stageH);
    }
  }
}

function getGradeOverlay(grade: LookGradeId): string {
  switch (grade) {
    case 'golden_hour':
      return 'rgba(245, 168, 66, 0.12)';
    case 'blue_hour':
      return 'rgba(59, 130, 246, 0.14)';
    case 'cold_night':
      return 'rgba(30, 58, 138, 0.18)';
    case 'neon_night':
      return 'rgba(139, 92, 246, 0.14)';
    case 'tense_green':
      return 'rgba(16, 185, 129, 0.12)';
    case 'sepia_memory':
      return 'rgba(180, 130, 70, 0.22)';
    case 'warm_interior':
      return 'rgba(234, 88, 12, 0.11)';
    case 'foggy_dawn':
      return 'rgba(248, 226, 204, 0.14)';
    default:
      return 'rgba(0,0,0,0)';
  }
}

function drawCinematicLookLayer(
  ctx: CanvasRenderingContext2D,
  scene: StudioScene,
  stageW: number,
  stageH: number,
  degrade: boolean
): void {
  const look = scene.look;
  if (!look) return;

  const tint = getGradeOverlay(look.grade);
  if (tint !== 'rgba(0,0,0,0)') {
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, stageW, stageH);
  }

  // Practical lights (max 3)
  if (!degrade) {
    for (const pr of (look.practicals || []).slice(0, 3)) {
      const px = pr.x * stageW;
      const py = pr.y * stageH;
      const r = Math.max(40, pr.radius || 120);
      const rg = ctx.createRadialGradient(px, py, 2, px, py, r);
      rg.addColorStop(0, withAlpha(pr.color || '#F5C542', 0.34));
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (look.godrays > 0.05) {
      const gx = look.key_light?.dir === 'right' ? stageW * 0.85 : look.key_light?.dir === 'left' ? stageW * 0.15 : stageW * 0.5;
      const gr = ctx.createLinearGradient(gx, 0, stageW * 0.5, stageH * 0.85);
      gr.addColorStop(0, `rgba(255, 240, 200, ${(0.22 * look.godrays).toFixed(2)})`);
      gr.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(gx - 30, 0);
      ctx.lineTo(gx + 30, 0);
      ctx.lineTo(stageW * 0.85, stageH);
      ctx.lineTo(stageW * 0.15, stageH);
      ctx.closePath();
      ctx.fill();
    }
  }

  if (look.vignette > 0.05) {
    const vg = ctx.createRadialGradient(
      stageW / 2,
      stageH / 2,
      stageW * 0.3,
      stageW / 2,
      stageH / 2,
      Math.max(stageW, stageH) * 0.72
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, `rgba(0,0,0,${(0.55 * look.vignette).toFixed(2)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, stageW, stageH);
  }
}

function drawHudCapsule(
  ctx: CanvasRenderingContext2D,
  scene: StudioScene,
  stageW: number
): void {
  const entries = Object.entries(scene.hud || {}).filter(([, v]) => v !== '' && v !== undefined);
  if (entries.length === 0) return;

  ctx.save();
  ctx.font = '700 13px "JetBrains Mono", "Prompt", sans-serif';
  const parts = entries.slice(0, 4).map(([k, v]) => (k === 'time' ? String(v) : String(v)));
  const pillText = parts.join('  •  ');
  const tw = Math.min(stageW - 32, ctx.measureText(pillText).width + 32);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  drawRoundedRect(ctx, 16, 16, tw, 30, 15);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#F5C542';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(pillText, 30, 31);
  ctx.restore();
}

function drawThaiSubtitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  highlights: string[],
  mode: SubtitleMode,
  stageW: number,
  stageH: number,
  isLetterbox: boolean
): void {
  if (!text) return;
  ctx.save();

  const fontSize = isLetterbox ? Math.round(stageH * 0.056) : Math.round(stageW * 0.046);
  ctx.font = `700 ${fontSize}px "Prompt", "Kanit", "Noto Sans Thai", sans-serif`;
  ctx.textBaseline = 'middle';

  const maxLineW = stageW * 0.86;
  const lines = wrapThaiLines(ctx, text, maxLineW, 2);
  if (lines.length === 0) {
    ctx.restore();
    return;
  }

  // Bottom dark gradient scrim for non-capsule readability
  if (!isLetterbox && mode !== 'capsule_highlight') {
    const grad = ctx.createLinearGradient(0, stageH * 0.72, 0, stageH);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, stageH * 0.72, stageW, stageH * 0.28);
  }

  const baseY = isLetterbox
    ? stageH * 0.86
    : mode === 'capsule_highlight'
      ? stageH * 0.72
      : stageH * 0.85;
  const lineStep = fontSize * 1.48;

  // Determine highlight character ranges per line
  lines.forEach((line, lIdx) => {
    const ly = baseY + (lIdx - (lines.length - 1) / 2) * lineStep;
    const lineW = ctx.measureText(line).width;

    if (mode === 'capsule_highlight' || mode === 'red_pill' || mode === 'dark_box') {
      const padX = 16;
      const boxW = lineW + padX * 2;
      const boxH = fontSize * 1.38;
      ctx.fillStyle =
        mode === 'red_pill'
          ? 'rgba(185, 28, 28, 0.94)'
          : mode === 'capsule_highlight'
            ? 'rgba(43, 35, 80, 0.94)'
            : 'rgba(15, 23, 42, 0.86)';
      drawRoundedRect(ctx, stageW / 2 - boxW / 2, ly - boxH / 2, boxW, boxH, 12);
      ctx.fill();
    }

    // Segment words to color/highlight matching substrings accurately without breaking Thai words
    const segments = segmentThaiWords(line);
    let cursorX = stageW / 2 - lineW / 2;

    // Check which chars are highlighted
    const hlMask = new Array<boolean>(line.length).fill(false);
    for (const kw of highlights) {
      if (!kw) continue;
      let pos = 0;
      while (pos < line.length) {
        const found = line.indexOf(kw, pos);
        if (found < 0) break;
        for (let k = found; k < found + kw.length; k++) hlMask[k] = true;
        pos = found + kw.length;
      }
    }

    let charOffset = 0;
    for (const seg of segments) {
      const sw = ctx.measureText(seg).width;
      const isHighlighted = hlMask.slice(charOffset, charOffset + seg.length).some(Boolean);
      charOffset += seg.length;

      if (mode === 'capsule_highlight' && isHighlighted && seg.trim()) {
        ctx.fillStyle = '#F5B82E';
        drawRoundedRect(ctx, cursorX - 4, ly - fontSize * 0.62, sw + 8, fontSize * 1.24, 8);
        ctx.fill();
        ctx.fillStyle = '#1E1B4B';
        ctx.textAlign = 'left';
        ctx.fillText(seg, cursorX, ly);
      } else {
        ctx.textAlign = 'left';
        if (mode === 'white_plain' || mode === 'yellow_highlight') {
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;
          ctx.lineWidth = Math.max(2.5, fontSize * 0.14);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
          ctx.strokeText(seg, cursorX, ly);
        }
        ctx.fillStyle =
          mode === 'yellow_highlight' && isHighlighted ? '#F5C542' : '#FFFFFF';
        ctx.fillText(seg, cursorX, ly);
      }
      cursorX += sw;
    }
  });

  ctx.restore();
}

export function renderAtTime(
  ctx: CanvasRenderingContext2D,
  project: StudioProject,
  episode: StudioEpisode,
  timeline: StudioTimelineSegment[],
  t: number,
  opts: RenderFrameOptions = {}
): { activeSceneId: string | null; activeSceneIndex: number } {
  frameCounter++;
  const tStart = typeof performance !== 'undefined' ? performance.now() : 0;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const geom = getViewportGeometry(project.layout, w, h);

  ctx.clearRect(0, 0, w, h);

  // Fill pure black base (especially for portrait_letterbox)
  ctx.fillStyle = '#0B0B0D';
  ctx.fillRect(0, 0, w, h);

  if (timeline.length === 0) {
    return { activeSceneId: null, activeSceneIndex: -1 };
  }

  let segIdx = timeline.findIndex((s) => t >= s.startSec && t < s.endSec);
  if (segIdx < 0) {
    segIdx = t < timeline[0].startSec ? 0 : timeline.length - 1;
  }
  const seg = timeline[segIdx];
  const scene = seg.scene;
  const localTime = Math.max(0, t - seg.startSec);
  const segDuration = Math.max(0.5, seg.endSec - seg.startSec);
  const speechDuration = Math.max(0.5, seg.speechEndSec - seg.startSec);
  const progress = clamp(localTime / segDuration, 0, 1);

  // Manage background offscreen cache within +-2 scene window
  const keepKeys = new Set<string>();
  for (let k = Math.max(0, segIdx - 2); k <= Math.min(timeline.length - 1, segIdx + 2); k++) {
    const s = timeline[k].scene;
    keepKeys.add(
      `${project.id}_${s.id}|${Math.round(geom.stageW * 1.16)}x${Math.round(geom.stageH * 1.16)}|${s.bg.preset}|${project.stylePack}|${s.bg.tint || ''}`
    );
  }
  evictFarBackgroundCaches(keepKeys, 8);

  const bgCache = getOrBuildBackgroundCache({
    cacheKey: `${project.id}_${scene.id}`,
    w: geom.stageW,
    h: geom.stageH,
    preset: scene.bg.preset,
    stylePack: project.stylePack,
    palette: project.palette,
    tint: scene.bg.tint,
    colors: scene.bg.colors,
    frameCounter,
  });

  // Clip stage viewport so portrait_letterbox never leaks into top/bottom text bands
  ctx.save();
  ctx.beginPath();
  ctx.rect(geom.stageX, geom.stageY, geom.stageW, geom.stageH);
  ctx.clip();
  ctx.translate(geom.stageX, geom.stageY);

  // Transition progress for entering scene
  const transDur = 0.28;
  const transT = clamp(localTime / transDur, 0, 1);
  let transOffsetX = 0;
  let transOffsetY = 0;
  let transAlpha = 1;
  if (segIdx > 0 && localTime < transDur) {
    const e = easeOutCubic(transT);
    if (scene.transition === 'fade') transAlpha = e;
    else if (scene.transition === 'slide_left') transOffsetX = (1 - e) * geom.stageW * 0.35;
    else if (scene.transition === 'slide_up') transOffsetY = (1 - e) * geom.stageH * 0.25;
  }

  ctx.globalAlpha = transAlpha;
  ctx.save();
  ctx.translate(transOffsetX, transOffsetY);

  // 1. Camera Transform & Layer 0/1 Cached Background
  const cam = getCameraTransform(scene, progress, geom.stageW, geom.stageH, t);
  const bgImg = scene.blurBg ? bgCache.blurred : bgCache.sharp;
  ctx.save();
  ctx.translate(geom.stageW / 2 + cam.panX, geom.stageH / 2 + cam.panY);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.drawImage(bgImg, -bgCache.width / 2, -bgCache.height / 2, bgCache.width, bgCache.height);
  ctx.restore();

  // Compute voice mouth openness (envelope or clean cadence fallback)
  let mouthOpen = 0;
  if (localTime <= speechDuration) {
    const env = opts.envelope;
    if (env && env.length > 0) {
      const lead = opts.leadSec ?? 0.35;
      const ss = opts.speechStartSec ?? 0;
      const speechT = t - lead + ss;
      const idx = Math.floor(speechT / 0.02);
      mouthOpen = env[idx] ?? 0;
    } else {
      mouthOpen = 0.4 + 0.4 * Math.abs(Math.sin(t * 11));
    }
  }

  const sceneRelSpeech = Math.max(0, seg.startSec - (opts.leadSec ?? 0.35));
  const charMap = new Map<string, StudioCharacter>(project.characters.map((c) => [c.id, c]));

  // 2. Props (layer with camera pan parallax)
  for (const prop of scene.props || []) {
    const appearLocal = prop.appearAtText
      ? resolveAtTextLocalSec(scene.narration, prop.appearAtText, speechDuration, sceneRelSpeech, opts.pauseCandidates)
      : 0;
    if (localTime < appearLocal) continue;
    const pAlpha = segIdx === 0 && !prop.appearAtText ? 1 : clamp((localTime - appearLocal) / 0.25, 0, 1);
    const px = prop.x * geom.stageW + cam.panX * 0.75;
    const py = prop.y * geom.stageH + cam.panY * 0.75;
    drawVectorProp(ctx, prop, px, py, Math.min(geom.stageW, geom.stageH) * 0.14, pAlpha);
  }

  // 3. Actors (Layer 2 midground, sorted by y so foreground overlapping works naturally)
  const sortedActors = [...(scene.actors || [])].sort((a, b) => a.y - b.y);
  const baseCharH = geom.stageH * (scene.camera.shot === 'close' ? 0.56 : scene.camera.shot === 'wide' ? 0.36 : 0.45);
  for (const act of sortedActors) {
    const cDef = charMap.get(act.char) || project.characters[0];
    if (!cDef) continue;
    let ax = act.x;
    let ay = act.y;
    if (act.moveTo) {
      const moveStart = resolveAtTextLocalSec(
        scene.narration,
        act.moveTo.atText,
        speechDuration,
        sceneRelSpeech,
        opts.pauseCandidates
      );
      const mt = easeInOutCubic(clamp((localTime - moveStart) / 0.9, 0, 1));
      ax = lerp(act.x, act.moveTo.x, mt);
      ay = lerp(act.y, act.moveTo.y, mt);
    }
    const enterAlpha = segIdx === 0 ? 1 : clamp(localTime / 0.22, 0, 1);
    drawCharacter(ctx, cDef, {
      x: ax * geom.stageW + cam.panX * 0.95,
      y: ay * geom.stageH + cam.panY * 0.95,
      baseHeight: baseCharH,
      scale: act.scale || 1,
      pose: act.pose,
      face: act.face,
      flip: act.flip,
      timeSec: t,
      mouthOpen,
      alpha: enterAlpha,
      isCloseUp: scene.camera.shot === 'close',
    });
  }

  // 4. POV Foreground hand (Layer 3)
  if (scene.pov) {
    drawPovForeground(ctx, scene.pov, geom.stageW, geom.stageH, localTime);
  }

  // 5. Cards (up to 2)
  const visibleCards: Array<{ card: StudioScene['cards'][number]; cardTime: number }> = [];
  for (const card of (scene.cards || []).slice(0, 2)) {
    const cStart = card.atText
      ? resolveAtTextLocalSec(scene.narration, card.atText, speechDuration, sceneRelSpeech, opts.pauseCandidates)
      : 0;
    if (localTime < cStart) continue;
    if (card.dur && localTime > cStart + card.dur) continue;
    const rawCardTime = localTime - cStart;
    visibleCards.push({
      card,
      cardTime: segIdx === 0 && !card.atText ? Math.max(0.45, rawCardTime) : rawCardTime,
    });
  }
  visibleCards.forEach((entry, idx) => {
    drawStudioCard(
      ctx,
      entry.card,
      idx,
      visibleCards.length,
      geom.stageW,
      geom.stageH,
      project.stylePack,
      entry.cardTime
    );
  });

  // 6. Deterministic FX particles
  drawDeterministicFx(ctx, scene, geom.stageW, geom.stageH, localTime, autoDegradeQuality && !opts.isExport);

  // 7. Toggleable Cinematic Look Layer & Animate Style Plugin (MUST execute BEFORE HUD & Subtitles)
  if (project.settings.cinematicEnabled) {
    drawCinematicLookLayer(ctx, scene, geom.stageW, geom.stageH, autoDegradeQuality && !opts.isExport);
  }
  if (project.animateStyle && project.animateStyle !== 'none') {
    applyAnimateStylePlugin(ctx, project.animateStyle, geom.stageW, geom.stageH, t);
  }

  ctx.restore(); // end transition offset

  // 8. HUD Capsule & Thai Subtitles inside stage viewport (always razor sharp AFTER Look layer)
  if (project.settings.hudEnabled) {
    drawHudCapsule(ctx, scene, geom.stageW);
  }

  if (opts.showSubtitles !== false && scene.subtitle !== null) {
    const activeClause = getActiveSubtitleClause(
      scene.subtitle || scene.narration,
      scene.highlightWords || [],
      localTime,
      speechDuration
    );
    if (activeClause) {
      drawThaiSubtitle(
        ctx,
        activeClause.text,
        activeClause.highlights,
        project.settings.subtitleMode,
        geom.stageW,
        geom.stageH,
        geom.isLetterbox
      );
    }
  }

  ctx.restore(); // end stage viewport clip

  // 9. Letterbox Top & Bottom Bold White Headlines (outside 16:9 clip for portrait_letterbox)
  if (geom.isLetterbox) {
    const drawBandText = (txt: string, bandY: number, bandH: number) => {
      if (!txt.trim()) return;
      ctx.save();
      const fSize = Math.round(w * 0.064);
      ctx.font = `800 ${fSize}px "Prompt", "Kanit", "Noto Sans Thai", sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrapThaiLines(ctx, txt, w * 0.88, 2);
      const step = fSize * 1.32;
      lines.forEach((ln, i) => {
        const ly = bandY + bandH / 2 + (i - (lines.length - 1) / 2) * step;
        ctx.fillText(ln, w / 2, ly);
      });
      ctx.restore();
    };
    drawBandText(project.settings.letterboxTopText, 0, geom.stageY);
    drawBandText(
      project.settings.letterboxBottomText,
      geom.stageY + geom.stageH,
      h - (geom.stageY + geom.stageH)
    );
  }

  // Quality budget monitor for live preview
  if (!opts.isExport && typeof performance !== 'undefined') {
    const dt = performance.now() - tStart;
    if (dt > 1000 / Math.max(24, project.settings.fps) * 1.5) {
      autoDegradeQuality = true;
    } else if (dt < 12) {
      autoDegradeQuality = false;
    }
  }

  return { activeSceneId: scene.id, activeSceneIndex: segIdx };
}
