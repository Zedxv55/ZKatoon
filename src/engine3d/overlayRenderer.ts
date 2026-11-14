import type { CartoonProject, SceneAudioRecord, TimelineSegment } from '../types/cartoon';
import { getSubtitleState } from '../utils/projectLogic';

const fontSpec = (weight: number, size: number) =>
  `${weight} ${size}px Prompt, "Noto Sans Thai", "Plus Jakarta Sans", sans-serif`;

function wrapThaiLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const Seg = (
    Intl as unknown as {
      Segmenter?: new (
        loc: string,
        opts: { granularity: string }
      ) => { segment: (s: string) => Iterable<{ segment: string }> };
    }
  ).Segmenter;
  const parts = Seg
    ? [...new Seg('th', { granularity: 'word' }).segment(text)].map((x) => x.segment)
    : [...text];
  const lines: string[] = [];
  let cur = '';
  for (const p of parts) {
    if (ctx.measureText(cur + p).width > maxWidth && cur.length > 0) {
      lines.push(cur);
      cur = p;
    } else {
      cur += p;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Composites 2D HUD, Letterbox top/bottom bars, Shot info, End card, and Thai Subtitles
 * over either a live transparent overlay canvas OR a 3D WebGL export canvas.
 */
export function render3DOverlay2D(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  project: CartoonProject,
  timeline: TimelineSegment[],
  timeSec: number,
  options: {
    subtitleScale?: 'normal' | 'large';
    sceneAudioMap?: Record<string, SceneAudioRecord>;
  } = {}
): void {
  const scale = w / 720;
  const seg =
    timeline.find((s) => timeSec < s.b) ||
    timeline[timeline.length - 1];
  if (!seg) return;

  const scene = seg.s;
  const localT = Math.max(0, timeSec - seg.a);
  const speechDur = Math.max(0.5, seg.speechEnd - seg.a);

  // 1. Optional Letterbox Top & Bottom Bars (16:9 middle frame in 9:16 video)
  if (project.layout === 'letterbox') {
    const barH = Math.round(h * 0.2);
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, w, barH);
    ctx.fillRect(0, h - barH, w, barH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (project.letterbox?.topText) {
      ctx.font = fontSpec(800, Math.round(34 * scale));
      ctx.fillStyle = '#ffffff';
      ctx.fillText(project.letterbox.topText, w / 2, barH * 0.56, w * 0.88);
    }
    if (project.letterbox?.bottomText) {
      ctx.font = fontSpec(700, Math.round(28 * scale));
      ctx.fillStyle = '#fde047';
      ctx.fillText(project.letterbox.bottomText, w / 2, h - barH * 0.42, w * 0.88);
    }
  }

  // 2. Clean Corner HUD Tag (never blinking/pulsating)
  const hudText = scene.hudText || (project.hud?.enabled ? project.hud.startText : '');
  if (project.hud?.enabled !== false && hudText) {
    ctx.save();
    ctx.font = fontSpec(600, Math.round(20 * scale));
    const tw = ctx.measureText(hudText).width;
    const padX = 16 * scale;
    const boxW = tw + padX * 2;
    const boxH = 38 * scale;
    const bx = 28 * scale;
    const by = project.layout === 'letterbox' ? h * 0.2 + 20 * scale : 36 * scale;

    ctx.fillStyle = 'rgba(10, 12, 20, 0.72)';
    ctx.beginPath();
    ctx.roundRect(bx, by, boxW, boxH, 10 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = Math.max(1, scale);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hudText, bx + padX, by + boxH / 2);
    ctx.restore();
  }

  // 3. Optional End Card Banner on final scene
  if (scene.card?.type === 'end') {
    ctx.save();
    const cardW = w * 0.82;
    const cardH = 148 * scale;
    const cx = (w - cardW) / 2;
    const cy = project.layout === 'letterbox' ? h * 0.24 : h * 0.14;
    ctx.fillStyle = 'rgba(13, 15, 26, 0.82)';
    ctx.beginPath();
    ctx.roundRect(cx, cy, cardW, cardH, 20 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (scene.card.badge) {
      ctx.font = fontSpec(700, Math.round(18 * scale));
      ctx.fillStyle = '#c4b5fd';
      ctx.fillText(scene.card.badge, w / 2, cy + 36 * scale, cardW * 0.88);
    }
    ctx.font = fontSpec(800, Math.round(34 * scale));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(scene.card.text || project.title, w / 2, cy + 84 * scale, cardW * 0.88);
    if (scene.card.label) {
      ctx.font = fontSpec(500, Math.round(18 * scale));
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(scene.card.label, w / 2, cy + 126 * scale, cardW * 0.88);
    }
    ctx.restore();
  }

  // 4. Thai Subtitles
  const subStyle = project.subtitleStyle || 'yellow_text';
  if (subStyle !== 'none' && scene.narration) {
    const subState = getSubtitleState(
      scene.narration,
      scene.hl || [],
      localT,
      speechDur,
      scene.subtitleEn
    );
    if (subState && subState.text) {
      ctx.save();
      const baseFontSize = options.subtitleScale === 'large' ? 36 : 30;
      ctx.font = fontSpec(800, Math.round(baseFontSize * scale));
      const maxTextW = w * 0.82;
      const lines = wrapThaiLines(ctx, subState.text, maxTextW);
      const lineH = Math.round(42 * scale);
      const totalBlockH = lines.length * lineH + (subState.subtitleEn ? 28 * scale : 0);
      const bottomMargin = project.layout === 'letterbox' ? h * 0.24 : 96 * scale;
      const startY = h - bottomMargin - totalBlockH;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (subStyle === 'dark_box' || subStyle === 'sticker_dual') {
        const boxPadY = 14 * scale;
        const bw = w * 0.88;
        ctx.fillStyle = subStyle === 'sticker_dual' ? 'rgba(249, 245, 235, 0.94)' : 'rgba(8, 10, 18, 0.78)';
        ctx.beginPath();
        ctx.roundRect((w - bw) / 2, startY - boxPadY, bw, totalBlockH + boxPadY * 2, 16 * scale);
        ctx.fill();
      } else if (subStyle === 'red_pill') {
        const bw = w * 0.88;
        ctx.fillStyle = 'rgba(185, 28, 28, 0.9)';
        ctx.beginPath();
        ctx.roundRect((w - bw) / 2, startY - 12 * scale, bw, totalBlockH + 24 * scale, 16 * scale);
        ctx.fill();
      }

      lines.forEach((line, idx) => {
        const ly = startY + idx * lineH + lineH * 0.5;
        if (subStyle === 'sticker_dual') {
          ctx.fillStyle = '#1f2937';
          ctx.fillText(line, w / 2, ly);
        } else {
          ctx.lineWidth = 6 * scale;
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
          ctx.strokeText(line, w / 2, ly);
          const hasHl = subState.highlightRanges.length > 0 && subStyle === 'yellow_text';
          ctx.fillStyle = hasHl ? '#fde047' : '#ffffff';
          ctx.fillText(line, w / 2, ly);
        }
      });

      if (subState.subtitleEn) {
        ctx.font = fontSpec(600, Math.round(18 * scale));
        const ey = startY + lines.length * lineH + 14 * scale;
        if (subStyle !== 'sticker_dual') {
          ctx.lineWidth = 4 * scale;
          ctx.strokeStyle = 'rgba(0,0,0,0.85)';
          ctx.strokeText(subState.subtitleEn, w / 2, ey, maxTextW);
          ctx.fillStyle = '#e2e8f0';
        } else {
          ctx.fillStyle = '#4b5563';
        }
        ctx.fillText(subState.subtitleEn, w / 2, ey, maxTextW);
      }

      ctx.restore();
    }
  }
}
