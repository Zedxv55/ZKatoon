import type { FaceId, PoseId, StudioCharacter } from '../types/studio';
import { adjustColor, clamp, drawRoundedRect, hashString, withAlpha } from './canvasHelpers';

export interface DrawCharacterOptions {
  x: number;
  y: number;
  baseHeight: number;
  scale: number;
  pose: PoseId;
  face: FaceId;
  flip?: boolean;
  timeSec: number;
  mouthOpen?: number; // 0..1
  alpha?: number;
  isCloseUp?: boolean;
}

function drawCapsuleLimb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Subtle ~15% shadow edge along one side
  ctx.strokeStyle = adjustColor(color, -0.14);
  ctx.lineWidth = Math.max(1.5, width * 0.25);
  ctx.beginPath();
  ctx.moveTo(x1 + width * 0.22, y1);
  ctx.lineTo(x2 + width * 0.22, y2);
  ctx.stroke();
  ctx.restore();
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: StudioCharacter,
  opts: DrawCharacterOptions
): void {
  const {
    x,
    y,
    baseHeight,
    scale,
    pose,
    face,
    flip = false,
    timeSec,
    mouthOpen = 0,
    alpha = 1,
    isCloseUp = false,
  } = opts;

  if (alpha <= 0.01) return;

  const h = baseHeight * scale;
  const ageScale = char.age === 'kid' ? 0.78 : char.age === 'teen' ? 0.92 : 1;
  const headRatio = char.age === 'kid' ? 0.34 : isCloseUp ? 0.31 : 0.27;
  const effH = h * ageScale;
  const headR = effH * headRatio * 0.52;
  const bodyW =
    effH * (char.body === 'round' ? 0.27 : char.body === 'slim' ? 0.16 : 0.21);
  const torsoH = effH * 0.31;
  const legLen = effH * 0.32;
  const limbW = Math.max(6, bodyW * 0.3);

  // Deterministic blink cycle every 3-5 seconds
  const charSeed = hashString(char.id);
  const blinkPeriod = 3.2 + (charSeed % 18) * 0.1;
  const blinkPhase = (timeSec + (charSeed % 7) * 0.3) % blinkPeriod;
  const isBlinking = blinkPhase > blinkPeriod - 0.14 && face !== 'sleepy';

  // Pose-driven motion kinematics
  let bobY = Math.sin(timeSec * 2.4 + charSeed) * effH * 0.006; // subtle idle breathing
  let squashX = 1;
  let squashY = 1;
  let bodyTilt = 0;
  let lLegAng = 0;
  let rLegAng = 0;
  let lArmAng = 0.24;
  let rArmAng = -0.24;

  if (pose === 'walk') {
    const cycle = timeSec * 5.2;
    bobY = -Math.abs(Math.sin(cycle)) * effH * 0.025;
    lLegAng = Math.sin(cycle) * 0.45;
    rLegAng = -Math.sin(cycle) * 0.45;
    lArmAng = -Math.sin(cycle) * 0.35 + 0.12;
    rArmAng = Math.sin(cycle) * 0.35 - 0.12;
  } else if (pose === 'run') {
    const cycle = timeSec * 9.5;
    bobY = -Math.abs(Math.sin(cycle)) * effH * 0.045;
    bodyTilt = 0.14;
    lLegAng = Math.sin(cycle) * 0.7;
    rLegAng = -Math.sin(cycle) * 0.7;
    lArmAng = -Math.sin(cycle) * 0.65;
    rArmAng = Math.sin(cycle) * 0.65;
  } else if (pose === 'jump') {
    const jc = (timeSec * 1.4) % 1;
    if (jc < 0.2) {
      // Anticipation crouch
      const u = jc / 0.2;
      squashX = 1 + 0.14 * u;
      squashY = 1 - 0.14 * u;
      bobY = effH * 0.04 * u;
    } else if (jc < 0.7) {
      const u = (jc - 0.2) / 0.5;
      const arc = Math.sin(u * Math.PI);
      bobY = -effH * 0.2 * arc;
      squashX = 1 - 0.08 * arc;
      squashY = 1 + 0.1 * arc;
      lArmAng = -2.2;
      rArmAng = 2.2;
    } else {
      const u = (jc - 0.7) / 0.3;
      const rec = Math.sin(u * Math.PI);
      squashX = 1 + 0.12 * rec;
      squashY = 1 - 0.1 * rec;
    }
  } else if (pose === 'talk') {
    lArmAng = 0.35 + Math.sin(timeSec * 5) * 0.15;
    rArmAng = -0.65 - Math.cos(timeSec * 4.5) * 0.22;
  } else if (pose === 'point') {
    rArmAng = -1.45;
    lArmAng = 0.22;
  } else if (pose === 'wave') {
    rArmAng = -2.45 + Math.sin(timeSec * 8) * 0.32;
    lArmAng = 0.22;
  } else if (pose === 'cheer') {
    bobY = -Math.abs(Math.sin(timeSec * 4.5)) * effH * 0.03;
    lArmAng = -2.65 + Math.sin(timeSec * 6) * 0.1;
    rArmAng = 2.65 - Math.sin(timeSec * 6) * 0.1;
  } else if (pose === 'scared') {
    bobY = Math.sin(timeSec * 28) * effH * 0.008;
    lArmAng = -1.5;
    rArmAng = 1.5;
  } else if (pose === 'think') {
    rArmAng = -1.9;
    bodyTilt = -0.05;
  } else if (pose === 'sit') {
    bobY = effH * 0.14;
    lLegAng = -0.8;
    rLegAng = -0.65;
  } else if (pose === 'cry') {
    bobY = Math.sin(timeSec * 9) * effH * 0.01;
    lArmAng = -2.0;
    rArmAng = 2.0;
  } else if (pose === 'fall') {
    bodyTilt = 1.15;
    bobY = effH * 0.25;
  } else if (pose === 'hide') {
    squashX = 0.88;
    squashY = 0.92;
    bobY = effH * 0.05;
    lArmAng = -1.35;
    rArmAng = 1.35;
  }

  const skinColor = char.species === 'zombie' ? '#8FA876' : char.skin || '#EEC5A3';
  const outfitColor = char.outfit?.color || '#3A4F6B';
  const accentColor = char.outfit?.accent || '#F5C542';
  const pantsColor = '#1E293B';

  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);

  // Soft ellipse ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, bodyW * 0.85, Math.max(5, effH * 0.03), 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(x, y + bobY);
  if (flip) ctx.scale(-1, 1);
  ctx.rotate(bodyTilt);
  ctx.scale(squashX, squashY);

  const hipY = -legLen;
  const shoulderY = hipY - torsoH;
  const headCenterY = shoulderY - headR * 0.95;

  // 1. Legs + Rounded Shoes
  const drawLeg = (hipX: number, ang: number) => {
    const kneeX = hipX + Math.sin(ang) * legLen * 0.95;
    const kneeY = hipY + Math.cos(ang) * legLen * 0.95;
    drawCapsuleLimb(ctx, hipX, hipY, kneeX, kneeY, limbW * 1.05, pantsColor);
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.ellipse(kneeX + limbW * 0.25, kneeY + 3, limbW * 0.72, limbW * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawLeg(-bodyW * 0.24, lLegAng);
  drawLeg(bodyW * 0.24, rLegAng);

  // 2. Back arm
  const armLen = torsoH * 0.92;
  const lHandX = -bodyW * 0.56 + Math.sin(lArmAng) * armLen;
  const lHandY = shoulderY + 6 + Math.cos(lArmAng) * armLen;
  drawCapsuleLimb(ctx, -bodyW * 0.52, shoulderY + 6, lHandX, lHandY, limbW * 0.86, outfitColor);
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(lHandX, lHandY, limbW * 0.46, 0, Math.PI * 2);
  ctx.fill();

  // 3. Torso (3-layer gradient shading, rounded silhouette)
  const tGrad = ctx.createLinearGradient(-bodyW / 2, shoulderY, bodyW / 2, hipY);
  tGrad.addColorStop(0, adjustColor(outfitColor, 0.08));
  tGrad.addColorStop(0.65, outfitColor);
  tGrad.addColorStop(1, adjustColor(outfitColor, -0.15));
  ctx.fillStyle = tGrad;

  if (char.outfit?.type === 'dress') {
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.45, shoulderY);
    ctx.lineTo(bodyW * 0.45, shoulderY);
    ctx.lineTo(bodyW * 0.76, hipY + legLen * 0.35);
    ctx.quadraticCurveTo(0, hipY + legLen * 0.45, -bodyW * 0.76, hipY + legLen * 0.35);
    ctx.closePath();
    ctx.fill();
  } else {
    drawRoundedRect(ctx, -bodyW * 0.54, shoulderY, bodyW * 1.08, torsoH + 10, bodyW * 0.32);
    ctx.fill();
  }

  // Outfit details (apron, suit tie, plaid, badge)
  if (char.outfit?.type === 'apron') {
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, -bodyW * 0.38, shoulderY + torsoH * 0.16, bodyW * 0.76, torsoH * 0.9, 6);
    ctx.fill();
    ctx.strokeStyle = adjustColor(accentColor, -0.12);
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.25, shoulderY + 2);
    ctx.lineTo(-bodyW * 0.25, shoulderY + torsoH * 0.2);
    ctx.moveTo(bodyW * 0.25, shoulderY + 2);
    ctx.lineTo(bodyW * 0.25, shoulderY + torsoH * 0.2);
    ctx.stroke();
  } else if (char.outfit?.type === 'suit') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.16, shoulderY);
    ctx.lineTo(bodyW * 0.16, shoulderY);
    ctx.lineTo(0, shoulderY + torsoH * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accentColor;
    ctx.fillRect(-3, shoulderY + 8, 6, torsoH * 0.45);
  } else if (char.outfit?.type === 'hoodie') {
    ctx.fillStyle = adjustColor(outfitColor, -0.1);
    drawRoundedRect(ctx, -bodyW * 0.34, shoulderY + torsoH * 0.55, bodyW * 0.68, torsoH * 0.34, 6);
    ctx.fill();
  }
  if (char.accessories?.includes('badge')) {
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.18, shoulderY + 2);
    ctx.lineTo(0, shoulderY + torsoH * 0.32);
    ctx.lineTo(bodyW * 0.18, shoulderY + 2);
    ctx.stroke();
    ctx.fillStyle = '#F5C542';
    ctx.fillRect(-5, shoulderY + torsoH * 0.32, 10, 12);
  }
  if (char.accessories?.includes('scarf')) {
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, -bodyW * 0.42, shoulderY - 4, bodyW * 0.84, 12, 6);
    ctx.fill();
  }

  // 4. Front arm + Mitten hand
  const rHandX = bodyW * 0.56 - Math.sin(rArmAng) * armLen;
  const rHandY = shoulderY + 6 + Math.cos(rArmAng) * armLen;
  drawCapsuleLimb(ctx, bodyW * 0.52, shoulderY + 6, rHandX, rHandY, limbW * 0.86, outfitColor);
  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(rHandX, rHandY, limbW * 0.46, 0, Math.PI * 2);
  ctx.fill();

  // 5. Neck & Head (borderless stylized round silhouette + soft gradient shadow)
  ctx.fillStyle = adjustColor(skinColor, -0.1);
  ctx.fillRect(-headR * 0.24, shoulderY - headR * 0.35, headR * 0.48, headR * 0.45);

  if (char.species === 'cat' || char.species === 'dog') {
    ctx.fillStyle = adjustColor(skinColor, -0.12);
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      if (char.species === 'cat') {
        ctx.moveTo(side * headR * 0.25, headCenterY - headR * 0.65);
        ctx.lineTo(side * headR * 0.78, headCenterY - headR * 1.28);
        ctx.lineTo(side * headR * 0.85, headCenterY - headR * 0.35);
      } else {
        ctx.ellipse(side * headR * 0.92, headCenterY - headR * 0.1, headR * 0.26, headR * 0.55, side * 0.2, 0, Math.PI * 2);
      }
      ctx.closePath();
      ctx.fill();
    });
  }

  const headGrad = ctx.createRadialGradient(-headR * 0.3, headCenterY - headR * 0.3, headR * 0.15, 0, headCenterY, headR * 1.05);
  headGrad.addColorStop(0, adjustColor(skinColor, 0.06));
  headGrad.addColorStop(0.7, skinColor);
  headGrad.addColorStop(1, adjustColor(skinColor, -0.14));
  ctx.fillStyle = char.species === 'robot' ? '#94A3B8' : headGrad;
  ctx.beginPath();
  if (char.species === 'robot') {
    drawRoundedRect(ctx, -headR * 0.92, headCenterY - headR * 0.9, headR * 1.84, headR * 1.75, headR * 0.3);
  } else {
    ctx.arc(0, headCenterY, headR, 0, Math.PI * 2);
  }
  ctx.fill();

  // Hair back/top layer
  const hairCol = char.hair?.color || '#1F2937';
  const hStyle = char.hair?.style || 'short';
  ctx.fillStyle = hairCol;
  if (hStyle === 'long') {
    drawRoundedRect(ctx, -headR * 1.08, headCenterY - headR * 0.95, headR * 2.16, headR * 2.05, headR * 0.75);
    ctx.fill();
    // Redraw face foreground over back hair
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.arc(0, headCenterY + headR * 0.04, headR * 0.92, 0, Math.PI * 2);
    ctx.fill();
  } else if (hStyle === 'bun') {
    ctx.beginPath();
    ctx.arc(0, headCenterY - headR * 1.1, headR * 0.44, 0, Math.PI * 2);
    ctx.fill();
  } else if (hStyle === 'ponytail') {
    ctx.beginPath();
    ctx.ellipse(-headR * 0.92, headCenterY + headR * 0.15, headR * 0.32, headR * 0.65, 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hStyle !== 'bald' && char.species !== 'robot') {
    ctx.fillStyle = hairCol;
    ctx.beginPath();
    ctx.arc(0, headCenterY - headR * 0.1, headR * 1.02, Math.PI, Math.PI * 2);
    if (hStyle === 'curly') {
      for (let i = -2; i <= 2; i++) {
        ctx.arc(i * headR * 0.35, headCenterY - headR * 0.78, headR * 0.32, 0, Math.PI * 2);
      }
    } else {
      ctx.quadraticCurveTo(0, headCenterY - headR * 0.25, -headR * 1.02, headCenterY - headR * 0.1);
    }
    ctx.fill();
    if (hStyle === 'cap') {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.arc(0, headCenterY - headR * 0.15, headR * 1.04, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(0, headCenterY - headR * 0.25, headR * 1.35, headR * 0.22);
    }
  }

  // 6. Eyes + Eyebrows + Expressions (all 9 FaceIds)
  const eyeY = headCenterY - headR * 0.05;
  const eyeOffX = headR * 0.35;
  const eyeR = Math.max(2.5, headR * 0.13);

  // Blush for happy / love
  if (face === 'happy' || face === 'love' || face === 'scared') {
    ctx.fillStyle = withAlpha('#F43F5E', 0.24);
    ctx.beginPath();
    ctx.ellipse(-headR * 0.48, headCenterY + headR * 0.2, headR * 0.16, headR * 0.09, 0, 0, Math.PI * 2);
    ctx.ellipse(headR * 0.48, headCenterY + headR * 0.2, headR * 0.16, headR * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  [-1, 1].forEach((side) => {
    const ex = side * eyeOffX;
    if (isBlinking || face === 'sleepy') {
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = Math.max(2, headR * 0.07);
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeR, 0.1, Math.PI - 0.1);
      ctx.stroke();
    } else if (face === 'love') {
      ctx.fillStyle = '#E11D48';
      ctx.beginPath();
      ctx.arc(ex - eyeR * 0.35, eyeY - eyeR * 0.2, eyeR * 0.48, 0, Math.PI * 2);
      ctx.arc(ex + eyeR * 0.35, eyeY - eyeR * 0.2, eyeR * 0.48, 0, Math.PI * 2);
      ctx.lineTo(ex, eyeY + eyeR * 0.75);
      ctx.fill();
    } else {
      ctx.fillStyle = '#0F172A';
      const rScale = face === 'surprised' || face === 'scared' ? 1.25 : 1;
      ctx.beginPath();
      ctx.arc(ex, eyeY, eyeR * rScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(ex - eyeR * 0.3, eyeY - eyeR * 0.3, eyeR * 0.32, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyebrows
    ctx.strokeStyle = adjustColor(hairCol, -0.05);
    ctx.lineWidth = Math.max(2, headR * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const browY = eyeY - eyeR * 1.75;
    if (face === 'angry') {
      ctx.moveTo(ex - eyeR * 1.1, browY - side * 4);
      ctx.lineTo(ex + eyeR * 1.1, browY + side * 4);
    } else if (face === 'sad' || face === 'scared') {
      ctx.moveTo(ex - eyeR, browY + side * 3);
      ctx.lineTo(ex + eyeR, browY - side * 3);
    } else {
      ctx.moveTo(ex - eyeR, browY);
      ctx.lineTo(ex + eyeR, browY);
    }
    ctx.stroke();
  });

  // Glasses accessory (like Style C barista)
  if (char.accessories?.includes('glasses')) {
    ctx.strokeStyle = '#1F2937';
    ctx.lineWidth = Math.max(1.8, headR * 0.06);
    ctx.beginPath();
    ctx.arc(-eyeOffX, eyeY, eyeR * 2.1, 0, Math.PI * 2);
    ctx.moveTo(-eyeOffX + eyeR * 2.1, eyeY);
    ctx.lineTo(eyeOffX - eyeR * 2.1, eyeY);
    ctx.arc(eyeOffX, eyeY, eyeR * 2.1, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Mask accessory
  if (char.accessories?.includes('mask')) {
    ctx.fillStyle = '#E2E8F0';
    drawRoundedRect(ctx, -headR * 0.58, headCenterY + headR * 0.08, headR * 1.16, headR * 0.64, 8);
    ctx.fill();
  } else {
    // 7. Mouth (with RMS lip-sync during talk or open expressions)
    const mouthY = headCenterY + headR * 0.42;
    const activeOpen = pose === 'talk' ? clamp(mouthOpen, 0.12, 1) : 0;
    ctx.strokeStyle = '#451A03';
    ctx.fillStyle = '#7F1D1D';
    ctx.lineWidth = Math.max(2, headR * 0.06);
    if (activeOpen > 0.08 || face === 'surprised' || face === 'scared') {
      const mH = Math.max(headR * 0.08, headR * 0.24 * (face === 'surprised' ? 0.9 : activeOpen));
      ctx.beginPath();
      ctx.ellipse(0, mouthY, headR * 0.22, mH, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (face === 'happy' || face === 'love' || face === 'smirk') {
      ctx.beginPath();
      ctx.arc(face === 'smirk' ? headR * 0.08 : 0, mouthY - 2, headR * 0.22, 0.15, Math.PI - 0.15);
      ctx.stroke();
    } else if (face === 'sad' || face === 'angry') {
      ctx.beginPath();
      ctx.arc(0, mouthY + headR * 0.16, headR * 0.2, Math.PI + 0.3, -0.3);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-headR * 0.18, mouthY);
      ctx.lineTo(headR * 0.18, mouthY);
      ctx.stroke();
    }
  }

  // Headphones
  if (char.accessories?.includes('headphones')) {
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = Math.max(3, headR * 0.12);
    ctx.beginPath();
    ctx.arc(0, headCenterY - headR * 0.05, headR * 1.08, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(-headR * 1.04, headCenterY, headR * 0.26, 0, Math.PI * 2);
    ctx.arc(headR * 1.04, headCenterY, headR * 0.26, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
