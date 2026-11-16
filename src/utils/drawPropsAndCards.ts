import type { PovId, ScenePropItem, StudioCard, StylePackId } from '../types/studio';
import { clamp, drawRoundedRect, easeOutBack, easeOutCubic, withAlpha, wrapThaiLines } from './canvasHelpers';

export function drawVectorProp(
  ctx: CanvasRenderingContext2D,
  prop: ScenePropItem,
  x: number,
  y: number,
  unitSize: number,
  alpha = 1
): void {
  if (alpha <= 0.01) return;
  const s = unitSize * (prop.size || 1);
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.translate(x, y);

  switch (prop.name) {
    case 'phone': {
      ctx.fillStyle = '#0F172A';
      drawRoundedRect(ctx, -s * 0.26, -s * 0.46, s * 0.52, s * 0.92, s * 0.08);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      drawRoundedRect(ctx, -s * 0.21, -s * 0.36, s * 0.42, s * 0.72, s * 0.04);
      ctx.fill();
      break;
    }
    case 'sign': {
      // Bangkok BTS station sign style ("สนามเป้า | Sanam Pao") or road sign
      const parts = (prop.text || 'ป้าย').split('|');
      const w = Math.max(s * 2.6, 170);
      const h = parts.length > 1 ? s * 0.95 : s * 0.65;
      ctx.fillStyle = '#1E293B';
      drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 8);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(h * 0.42)}px "Prompt", sans-serif`;
      ctx.fillText(parts[0], 0, parts.length > 1 ? -h * 0.14 : 0);
      if (parts[1]) {
        ctx.font = `500 ${Math.round(h * 0.24)}px "Prompt", sans-serif`;
        ctx.fillStyle = '#CBD5E1';
        ctx.fillText(parts[1], 0, h * 0.24);
      }
      break;
    }
    case 'ship': {
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(-s * 0.95, 0);
      ctx.lineTo(s * 0.95, 0);
      ctx.lineTo(s * 0.65, s * 0.34);
      ctx.lineTo(-s * 0.85, s * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#E2E8F0';
      drawRoundedRect(ctx, -s * 0.6, -s * 0.32, s * 1.1, s * 0.32, 6);
      ctx.fill();
      ctx.fillStyle = '#F5C542';
      for (let wx = -s * 0.48; wx <= s * 0.36; wx += s * 0.22) {
        ctx.fillRect(wx, -s * 0.22, s * 0.14, s * 0.12);
      }
      break;
    }
    case 'car': {
      // White fender + dent detail matching Style B reference
      ctx.fillStyle = '#E2E8F0';
      drawRoundedRect(ctx, -s * 0.95, -s * 0.35, s * 1.9, s * 0.72, 16);
      ctx.fill();
      // Wheel arch
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(-s * 0.4, s * 0.32, s * 0.36, Math.PI, Math.PI * 2);
      ctx.fill();
      // Dent oval
      ctx.fillStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.beginPath();
      ctx.ellipse(s * 0.18, 0, s * 0.34, s * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bell': {
      // Ritual drum / shrine bell
      ctx.fillStyle = '#991B1B';
      ctx.beginPath();
      ctx.ellipse(0, s * 0.14, s * 0.82, s * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F5DEB3';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.08, s * 0.82, s * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#F5C542';
      ctx.lineWidth = 3;
      ctx.stroke();
      break;
    }
    case 'candle': {
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(-s * 0.12, -s * 0.22, s * 0.24, s * 0.62);
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.36, s * 0.1, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'walkie_talkie': {
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-s * 0.18, -s * 0.65, s * 0.06, s * 0.35);
      drawRoundedRect(ctx, -s * 0.24, -s * 0.34, s * 0.48, s * 0.72, 8);
      ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.fillRect(-s * 0.14, -s * 0.22, s * 0.28, s * 0.18);
      break;
    }
    case 'book': {
      ctx.fillStyle = '#2B2350';
      drawRoundedRect(ctx, -s * 0.38, -s * 0.48, s * 0.76, s * 0.96, 6);
      ctx.fill();
      ctx.fillStyle = '#F5B82E';
      ctx.fillRect(-s * 0.26, -s * 0.3, s * 0.52, s * 0.12);
      break;
    }
    case 'laptop': {
      ctx.fillStyle = '#1E293B';
      drawRoundedRect(ctx, -s * 0.52, -s * 0.36, s * 1.04, s * 0.68, 6);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(-s * 0.45, -s * 0.3, s * 0.9, s * 0.55);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-s * 0.62, s * 0.32, s * 1.24, s * 0.1);
      break;
    }
    case 'door': {
      ctx.fillStyle = '#78350F';
      drawRoundedRect(ctx, -s * 0.36, -s * 0.72, s * 0.72, s * 1.44, 6);
      ctx.fill();
      ctx.fillStyle = '#F5C542';
      ctx.beginPath();
      ctx.arc(s * 0.22, 0, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'house': {
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-s * 0.5, -s * 0.15, s, s * 0.7);
      ctx.fillStyle = '#B91C1C';
      ctx.beginPath();
      ctx.moveTo(-s * 0.62, -s * 0.15);
      ctx.lineTo(0, -s * 0.65);
      ctx.lineTo(s * 0.62, -s * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'tree': {
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-s * 0.12, -s * 0.05, s * 0.24, s * 0.62);
      ctx.fillStyle = '#16A34A';
      ctx.beginPath();
      ctx.arc(0, -s * 0.26, s * 0.48, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'bulb':
    case 'lantern':
    case 'lamp': {
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.arc(0, -s * 0.1, s * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-s * 0.14, s * 0.22, s * 0.28, s * 0.18);
      break;
    }
    case 'bottle': {
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, -s * 0.2, -s * 0.22, s * 0.4, s * 0.52, 6);
      ctx.fill();
      ctx.fillStyle = '#6B4226';
      ctx.fillRect(-s * 0.14, -s * 0.02, s * 0.28, s * 0.18);
      break;
    }
    case 'clock':
    case 'coin': {
      ctx.fillStyle = '#F5C542';
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -s * 0.22);
      ctx.moveTo(0, 0);
      ctx.lineTo(s * 0.18, s * 0.08);
      ctx.stroke();
      break;
    }
    default: {
      const emojiMap: Record<string, string> = {
        key: '🔑',
        box: '📦',
        flag: '🚩',
        heart: '❤️',
        star: '⭐',
        rocket: '🚀',
        shield: '🛡️',
        magnifier: '🔍',
        camera: '📷',
        map: '🗺️',
        flashlight: '🔦',
        remote: '📱',
        cat: '🐱',
        dog: '🐶',
        bus: '🚌',
        pillow: '🛏️',
        sofa: '🛋️',
        photo_wall: '🖼️',
        train: '🚆',
        noodle_pot: '🍜',
      };
      const em = prop.emoji || emojiMap[prop.name] || '✨';
      ctx.font = `${Math.round(s * 0.85)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(em, 0, 0);
      break;
    }
  }
  ctx.restore();
}

export function drawPovForeground(
  ctx: CanvasRenderingContext2D,
  pov: PovId,
  stageW: number,
  stageH: number,
  localTime: number
): void {
  if (!pov) return;
  ctx.save();
  const enter = easeOutCubic(localTime / 0.45);
  const bob = Math.sin(localTime * 3) * 4;

  if (pov === 'hand_point') {
    // Pointing hand from top-left like Style B reference
    ctx.translate(stageW * 0.18 * enter - stageW * 0.12, stageH * 0.22 + bob);
    ctx.rotate(0.28);
    ctx.fillStyle = '#8C6239';
    ctx.fillRect(-110, -28, 120, 56);
    ctx.fillStyle = '#D99E73';
    drawRoundedRect(ctx, 0, -24, 96, 48, 22);
    ctx.fill();
    // Pointing index finger
    drawRoundedRect(ctx, 72, -16, 110, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (pov === 'hand_phone') {
    ctx.translate(stageW * 0.5, stageH * (1.12 - 0.34 * enter) + bob);
    ctx.fillStyle = '#0F172A';
    drawRoundedRect(ctx, -64, -110, 128, 220, 18);
    ctx.fill();
    ctx.fillStyle = '#38BDF8';
    drawRoundedRect(ctx, -54, -92, 108, 180, 10);
    ctx.fill();
  } else if (pov === 'hand_pencil') {
    ctx.translate(stageW * 0.72, stageH * (1.05 - 0.28 * enter) + bob);
    ctx.rotate(-0.45);
    ctx.fillStyle = '#FACC15';
    drawRoundedRect(ctx, -10, -90, 20, 140, 4);
    ctx.fill();
  } else if (pov === 'hand_hold') {
    ctx.translate(stageW * 0.3, stageH * (1.05 - 0.26 * enter) + bob);
    ctx.fillStyle = '#E5B28A';
    drawRoundedRect(ctx, -35, -35, 70, 80, 24);
    ctx.fill();
  }
  ctx.restore();
}

export function drawStudioCard(
  ctx: CanvasRenderingContext2D,
  card: StudioCard,
  index: number,
  totalCards: number,
  stageW: number,
  stageH: number,
  stylePack: StylePackId,
  cardTime: number
): void {
  const anim = easeOutBack(clamp(cardTime / 0.4, 0, 1));
  const darkSurface = stylePack === 'C' ? '#2B2350' : '#151B29';
  const accentGold = stylePack === 'C' ? '#F5B82E' : '#F5C542';

  ctx.save();

  // Floating corner chips (source_chip, year_chip, time_tag)
  if (card.type === 'source_chip') {
    const cx = 18;
    const cy = 20;
    const cw = Math.min(stageW * 0.56, 300);
    const ch = 70;
    ctx.globalAlpha = clamp(cardTime / 0.25, 0, 1);
    ctx.fillStyle = withAlpha('#2B2350', 0.94);
    drawRoundedRect(ctx, cx, cy, cw, ch, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mini book cover
    ctx.fillStyle = card.cover || '#0F172A';
    drawRoundedRect(ctx, cx + 10, cy + 10, 36, 50, 5);
    ctx.fill();
    ctx.fillStyle = '#D9392E';
    ctx.fillRect(cx + 15, cy + 18, 26, 12);

    // Yellow tag pill
    ctx.fillStyle = '#F5B82E';
    drawRoundedRect(ctx, cx + 56, cy + 10, 96, 18, 9);
    ctx.fill();
    ctx.fillStyle = '#1E1B4B';
    ctx.font = '700 10px "Prompt", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.tag || 'สรุปจากแหล่งข้อมูล', cx + 63, cy + 19);

    // Title & author
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 13px "Prompt", sans-serif';
    ctx.fillText(String(card.title || '').slice(0, 26), cx + 56, cy + 39);
    ctx.fillStyle = '#CBD5E1';
    ctx.font = '500 11px "Prompt", sans-serif';
    ctx.fillText(String(card.author || '').slice(0, 28), cx + 56, cy + 56);
    ctx.restore();
    return;
  }

  if (card.type === 'year_chip' || card.type === 'time_tag') {
    const label = card.text || '2026';
    ctx.font = '700 18px "Prompt", sans-serif';
    const tw = Math.min(stageW * 0.65, ctx.measureText(label).width + 36);
    const x = stageW - tw - 20;
    const y = 24 + index * 46;
    ctx.fillStyle = card.type === 'year_chip' ? '#D9453D' : withAlpha('#0F172A', 0.88);
    drawRoundedRect(ctx, x, y, tw, 36, 18);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + tw / 2, y + 18);
    ctx.restore();
    return;
  }

  if (card.type === 'stamp') {
    ctx.translate(stageW * 0.68, stageH * 0.28);
    ctx.rotate(((card.angle ?? -12) * Math.PI) / 180);
    ctx.scale(1.3 - 0.3 * anim, 1.3 - 0.3 * anim);
    const stCol = card.accent || '#D9453D';
    ctx.strokeStyle = stCol;
    ctx.lineWidth = 5;
    drawRoundedRect(ctx, -110, -34, 220, 68, 10);
    ctx.stroke();
    ctx.fillStyle = stCol;
    ctx.font = '800 26px "Prompt", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.text || 'ยืนยันแล้ว', 0, 0);
    ctx.restore();
    return;
  }

  if (card.type === 'phone_mockup') {
    // Full crisp dark-theme chat screen mockup matching Style A
    const pw = Math.min(stageW * 0.72, 390);
    const ph = Math.min(stageH * 0.72, 620);
    const px = (stageW - pw) / 2;
    const py = stageH * 0.1 + (1 - anim) * 40;
    ctx.fillStyle = '#0F172A';
    drawRoundedRect(ctx, px - 8, py - 8, pw + 16, ph + 16, 28);
    ctx.fill();
    ctx.fillStyle = '#E2E8F0';
    drawRoundedRect(ctx, px, py, pw, ph, 22);
    ctx.fill();

    // Header
    ctx.fillStyle = '#CBD5E1';
    drawRoundedRect(ctx, px, py, pw, 52, 22);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 18px "Prompt", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.title || 'แชต', px + 46, py + 28);
    ctx.fillStyle = '#6366F1';
    ctx.beginPath();
    ctx.arc(px + 26, py + 28, 12, 0, Math.PI * 2);
    ctx.fill();

    // Messages
    const msgs = card.messages || [{ sender: 'ผม', text: card.text || 'สวัสดี', mine: true }];
    let my = py + 76;
    msgs.forEach((m, idx) => {
      if (cardTime < idx * 0.45) return;
      const isMine = Boolean(m.mine);
      ctx.font = '600 15px "Prompt", sans-serif';
      const maxBw = pw * 0.7;
      const lines = wrapThaiLines(ctx, m.text, maxBw - 24, 3);
      const bh = lines.length * 22 + 18;
      const bw = Math.min(maxBw, Math.max(96, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 28));
      const bx = isMine ? px + pw - bw - 14 : px + 14;
      ctx.fillStyle = isMine ? '#0D9488' : '#FFFFFF';
      drawRoundedRect(ctx, bx, my, bw, bh, 14);
      ctx.fill();
      ctx.fillStyle = isMine ? '#FFFFFF' : '#0F172A';
      lines.forEach((ln, li) => {
        ctx.fillText(ln, bx + 14, my + 18 + li * 22);
      });
      my += bh + 12;
    });
    ctx.restore();
    return;
  }

  // Standard centered / stacked card box
  const cardW = Math.min(stageW * 0.86, 560);
  const cardH = Math.min(stageH * (totalCards > 1 ? 0.3 : 0.42), card.type === 'end_card' ? 320 : 280);
  const cx = (stageW - cardW) / 2;
  const cy =
    totalCards > 1
      ? stageH * (index === 0 ? 0.14 : 0.48)
      : stageH * (card.type === 'speech_bubble' || card.type === 'thought_bubble' ? 0.18 : 0.2);

  ctx.translate(cx + cardW / 2, cy + cardH / 2);
  ctx.scale(anim, anim);
  ctx.translate(-cardW / 2, -cardH / 2);

  ctx.fillStyle = card.type === 'notebook' ? '#FAF5E8' : withAlpha(darkSurface, 0.94);
  drawRoundedRect(ctx, 0, 0, cardW, cardH, 20);
  ctx.fill();
  ctx.strokeStyle = card.type === 'end_card' ? accentGold : 'rgba(255,255,255,0.14)';
  ctx.lineWidth = card.type === 'end_card' ? 2.5 : 1.5;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  if (card.type === 'end_card') {
    // Badge
    ctx.fillStyle = accentGold;
    drawRoundedRect(ctx, 22, 22, 118, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 13px "Prompt", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(card.badge || 'สรุป', 81, 29);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 22px "Prompt", sans-serif';
    const hLines = wrapThaiLines(ctx, card.headline || card.text || 'ขอบคุณที่รับชม', cardW - 44, 3);
    hLines.forEach((ln, i) => ctx.fillText(ln, 22, 66 + i * 30));

    if (card.subline) {
      ctx.fillStyle = '#CBD5E1';
      ctx.font = '500 15px "Prompt", sans-serif';
      const sLines = wrapThaiLines(ctx, card.subline, cardW - 44, 2);
      sLines.forEach((ln, i) => ctx.fillText(ln, 22, 166 + i * 22));
    }

    // CTA pill
    ctx.fillStyle = '#2D6B4F';
    drawRoundedRect(ctx, 22, cardH - 60, cardW - 44, 40, 12);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = '700 15px "Prompt", sans-serif';
    ctx.fillText(card.cta || 'กดบันทึกคลิปนี้', cardW / 2, cardH - 48);
  } else if (card.type === 'bignumber') {
    const rawNum = parseFloat(String(card.text || '0').replace(/[^\d.]/g, ''));
    const suffix = String(card.text || '').replace(/[\d.,]+/g, '');
    const progress = easeOutCubic(clamp(cardTime / 0.9, 0, 1));
    const displayNum = Number.isFinite(rawNum)
      ? `${Math.round(rawNum * progress).toLocaleString()}${suffix}`
      : card.text || '100%';
    ctx.fillStyle = accentGold;
    ctx.textAlign = 'center';
    ctx.font = '800 54px "Prompt", sans-serif';
    ctx.fillText(displayNum, cardW / 2, 42);
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '600 18px "Prompt", sans-serif';
    ctx.fillText(card.label || card.title || '', cardW / 2, 126);
  } else if (card.type === 'bar_chart') {
    ctx.fillStyle = accentGold;
    ctx.font = '700 18px "Prompt", sans-serif';
    ctx.fillText(card.title || 'สถิติเปรียบเทียบ', 22, 18);
    const bars = (card.bars || []).slice(0, 4);
    const maxV = Math.max(1, ...bars.map((b) => b.value || 0));
    const grow = easeOutCubic(clamp(cardTime / 0.75, 0, 1));
    bars.forEach((b, i) => {
      const by = 58 + i * 44;
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '600 13px "Prompt", sans-serif';
      ctx.fillText(b.label, 22, by);
      const barMaxW = cardW - 140;
      const bw = (b.value / maxV) * barMaxW * grow;
      ctx.fillStyle = i === 0 ? accentGold : '#38BDF8';
      drawRoundedRect(ctx, 22, by + 20, Math.max(8, bw), 14, 7);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(String(b.value), 32 + bw, by + 18);
    });
  } else if (card.type === 'checklist' || card.type === 'list') {
    ctx.fillStyle = accentGold;
    ctx.font = '700 19px "Prompt", sans-serif';
    ctx.fillText(card.title || 'รายการสำคัญ', 22, 20);
    // Lock badge at top-right if locked items exist (matching Style C ref)
    const items = (card.items || []).slice(0, 4);
    if (items.some((it) => typeof it !== 'string' && it.state === 'locked')) {
      ctx.fillStyle = accentGold;
      ctx.font = '700 22px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('🔒', cardW - 22, 20);
      ctx.textAlign = 'left';
    }
    items.forEach((it, i) => {
      const obj = typeof it === 'string' ? { text: it, state: 'done' as const } : it;
      const iy = 62 + i * 44;
      const isLocked = obj.state === 'locked';
      ctx.fillStyle = isLocked ? '#64748B' : '#10B981';
      ctx.beginPath();
      ctx.arc(34, iy + 12, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 13px "Prompt", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isLocked ? '🔒' : String(i + 1), 34, iy + 5);
      ctx.textAlign = 'left';
      ctx.fillStyle = isLocked ? '#94A3B8' : '#F8FAFC';
      ctx.font = '600 15px "Prompt", sans-serif';
      ctx.fillText(obj.text.slice(0, 32), 56, iy + 4);
    });
  } else if (card.type === 'compare') {
    ctx.fillStyle = accentGold;
    ctx.font = '700 18px "Prompt", sans-serif';
    ctx.fillText(card.title || 'เปรียบเทียบ', 22, 18);
    const mid = cardW / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(mid, 52);
    ctx.lineTo(mid, cardH - 18);
    ctx.stroke();

    ctx.fillStyle = '#F87171';
    ctx.font = '700 15px "Prompt", sans-serif';
    ctx.fillText(card.left?.title || 'แบบเดิม', 22, 56);
    (card.left?.items || []).slice(0, 3).forEach((t, i) => {
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '500 13px "Prompt", sans-serif';
      ctx.fillText(`• ${t}`, 22, 86 + i * 28);
    });

    ctx.fillStyle = '#34D399';
    ctx.font = '700 15px "Prompt", sans-serif';
    ctx.fillText(card.right?.title || 'แบบใหม่', mid + 18, 56);
    (card.right?.items || []).slice(0, 3).forEach((t, i) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '500 13px "Prompt", sans-serif';
      ctx.fillText(`• ${t}`, mid + 18, 86 + i * 28);
    });
  } else if (card.type === 'line_chart') {
    ctx.fillStyle = accentGold;
    ctx.font = '700 18px "Prompt", sans-serif';
    ctx.fillText(card.title || 'แนวโน้ม', 22, 18);
    const pts = card.points || [
      { x: '1', y: 20 },
      { x: '2', y: 45 },
      { x: '3', y: 38 },
      { x: '4', y: 80 },
    ];
    const maxY = Math.max(1, ...pts.map((p) => p.y));
    const prog = easeOutCubic(clamp(cardTime / 0.8, 0, 1));
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const px = 36 + (i / Math.max(1, pts.length - 1)) * (cardW - 72);
      const py = cardH - 40 - (p.y / maxY) * (cardH - 105) * prog;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  } else if (card.type === 'metro_map' || card.type === 'map_route') {
    ctx.fillStyle = accentGold;
    ctx.font = '700 18px "Prompt", sans-serif';
    ctx.fillText(card.title || (card.type === 'metro_map' ? 'เส้นทางรถไฟฟ้า' : 'แผนที่เส้นทาง'), 22, 18);
    const routeNames = card.route || [card.from || 'จุดเริ่มต้น', card.highlight || 'จุดแวะ', card.to || 'ปลายทาง'];
    const sy = cardH * 0.56;
    ctx.strokeStyle = '#22C55E';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(44, sy);
    ctx.lineTo(cardW - 44, sy);
    ctx.stroke();
    routeNames.slice(0, 4).forEach((st, i) => {
      const sx = 44 + (i / Math.max(1, Math.min(4, routeNames.length) - 1)) * (cardW - 88);
      ctx.fillStyle = st === card.highlight ? '#F5C542' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sx, sy, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#E2E8F0';
      ctx.textAlign = 'center';
      ctx.font = '600 12px "Prompt", sans-serif';
      ctx.fillText(st.slice(0, 14), sx, sy + 20);
    });
  } else if (card.type === 'notebook') {
    ctx.fillStyle = '#1E293B';
    ctx.font = '700 19px "Prompt", sans-serif';
    ctx.fillText(card.title || 'บันทึกสำคัญ', 28, 22);
    const items = (card.items || [card.text || 'บันทึกรายละเอียด']).slice(0, 4);
    items.forEach((it, i) => {
      const txt = typeof it === 'string' ? it : it.text;
      const reveal = clamp((cardTime - i * 0.25) / 0.35, 0, 1);
      if (reveal <= 0) return;
      ctx.fillStyle = '#334155';
      ctx.font = '600 15px "Prompt", sans-serif';
      ctx.fillText(`— ${txt.slice(0, Math.ceil(txt.length * reveal))}`, 28, 66 + i * 38);
    });
  } else {
    // text, title_card, source_note, speech_bubble, thought_bubble
    ctx.fillStyle = accentGold;
    ctx.font = '700 17px "Prompt", sans-serif';
    if (card.title || card.label) {
      ctx.fillText(card.title || card.label || '', 22, 22);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = card.type === 'title_card' ? '800 26px "Prompt", sans-serif' : '600 18px "Prompt", sans-serif';
    const bodyText = card.text || '';
    const lines = wrapThaiLines(ctx, bodyText, cardW - 44, 4);
    lines.forEach((ln, i) => ctx.fillText(ln, 22, (card.title || card.label ? 58 : 28) + i * 28));
  }

  ctx.restore();
}
