/**
 * ZKatoon Animate Engine Style Plugins
 *
 * Inspired by and adapted from cth9191/animate (MIT License):
 * https://github.com/cth9191/animate
 *
 * Copyright (c) cth9191/animate contributors (MIT License)
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, subject to preserving this copyright & license notice.
 */

import type { AnimateStylePluginId } from '../types/platform';

export interface AnimateStylePluginMeta {
  id: AnimateStylePluginId;
  name: string;
  nameTh: string;
  description: string;
  category: 'paper' | 'print' | 'sketch' | 'technical' | '3d' | 'cinema';
  previewBg: string;
  previewAccent: string;
  mitAttributed: boolean;
}

export const ANIMATE_STYLE_PLUGINS: AnimateStylePluginMeta[] = [
  {
    id: 'none',
    name: 'Standard Clean',
    nameTh: 'มาตรฐานคมชัด (Default)',
    description: 'เวกเตอร์คมชัดตามจานสีของ Style Pack',
    category: 'cinema',
    previewBg: '#161b2e',
    previewAccent: '#f5c542',
    mitAttributed: false,
  },
  {
    id: 'cut_paper',
    name: 'Cut Paper',
    nameTh: 'กระดาษตัดซ้อน (Cut Paper)',
    description: 'ขอบกระดาษซ้อนชั้น มีเงากระดาษและใยกระดาษบางเบา',
    category: 'paper',
    previewBg: '#27233a',
    previewAccent: '#f29a4a',
    mitAttributed: true,
  },
  {
    id: 'crosshatch',
    name: 'Crosshatch',
    nameTh: 'ลายเส้นแรเงา (Crosshatch)',
    description: 'ลายเส้นปากกาไขว้แรเงาแบบภาพประกอบหนังสือ',
    category: 'sketch',
    previewBg: '#1d1c24',
    previewAccent: '#e2d9c8',
    mitAttributed: true,
  },
  {
    id: 'riso_print',
    name: 'Riso Print',
    nameTh: 'ริโซกราฟ (Riso Print)',
    description: 'เม็ดสกรีนซ้อนสีแบบแท่นพิมพ์ Riso อินดี้',
    category: 'print',
    previewBg: '#1b264f',
    previewAccent: '#ff5c8a',
    mitAttributed: true,
  },
  {
    id: 'sketchbook',
    name: 'Sketchbook',
    nameTh: 'สมุดสเก็ตช์ (Sketchbook)',
    description: 'พื้นกระดาษถนอมสายตาพร้อมเส้นดินสอขอบเฟรม',
    category: 'sketch',
    previewBg: '#2e2924',
    previewAccent: '#f5b82e',
    mitAttributed: true,
  },
  {
    id: 'math_animation',
    name: 'Math Animation',
    nameTh: 'กราฟิกคณิตศาสตร์ (Math)',
    description: 'ตารางพิกัด เส้นแกน และกรอบเรขาคณิตแบบ 3Blue1Brown',
    category: 'technical',
    previewBg: '#0c1324',
    previewAccent: '#38bdf8',
    mitAttributed: true,
  },
  {
    id: 'pixel_art',
    name: 'Pixel Art',
    nameTh: 'พิกเซลเรโทร (Pixel Art)',
    description: 'ตารางพิกเซลเรโทรความละเอียดจำลอง 8/16-bit',
    category: 'print',
    previewBg: '#19142b',
    previewAccent: '#34d399',
    mitAttributed: true,
  },
  {
    id: 'isometric',
    name: 'Isometric',
    nameTh: 'ไอโซเมตริก (Isometric)',
    description: 'ตารางมุมมอง 30 องศา สำหรับฉากเมืองและแผนผัง',
    category: 'technical',
    previewBg: '#132238',
    previewAccent: '#a78bfa',
    mitAttributed: true,
  },
  {
    id: '2d_cartoon',
    name: '2D Cartoon',
    nameTh: 'การ์ตูน 2D เส้นคม',
    description: 'กรอบเส้นขอบการ์ตูนสีสดชัดเจน',
    category: 'paper',
    previewBg: '#1e293b',
    previewAccent: '#facc15',
    mitAttributed: false,
  },
  {
    id: '3d_cartoon',
    name: '3D Cartoon',
    nameTh: 'การ์ตูน 3D นุ่มนวล',
    description: 'แสงขอบและมิติไล่โทนแบบสตูดิโอ 3D',
    category: '3d',
    previewBg: '#171d36',
    previewAccent: '#818cf8',
    mitAttributed: false,
  },
  {
    id: 'clay_3d',
    name: 'Clay 3D',
    nameTh: 'ดินน้ำมันปั้น (Claymation)',
    description: 'โทนอบอุ่นผิวนุ่มแบบสต็อปโมชันดินปั้น',
    category: '3d',
    previewBg: '#2c1f1b',
    previewAccent: '#fb923c',
    mitAttributed: false,
  },
  {
    id: 'cinema_realistic',
    name: 'Cinema Realistic',
    nameTh: 'ภาพยนตร์ (Cinematic)',
    description: 'แถบฟิล์ม เกรนละเอียด และคอนทราสต์แบบโรงภาพยนตร์',
    category: 'cinema',
    previewBg: '#0d1117',
    previewAccent: '#eab308',
    mitAttributed: false,
  },
  {
    id: 'custom_reference',
    name: 'Custom Reference',
    nameTh: 'ตามภาพอ้างอิงผู้ใช้',
    description: 'ใช้โทนสีและคำสั่งเฉพาะจากโปรเจกต์',
    category: 'cinema',
    previewBg: '#1c192b',
    previewAccent: '#c084fc',
    mitAttributed: false,
  },
];

/**
 * Deterministic style overlay / post-pass rendered inside stage viewport before HUD & Subtitles.
 */
export function applyAnimateStylePlugin(
  ctx: CanvasRenderingContext2D,
  styleId: string | undefined,
  stageW: number,
  stageH: number,
  timeSec: number
): void {
  if (!styleId || styleId === 'none' || styleId === 'custom_reference') return;
  ctx.save();

  if (styleId === 'cut_paper') {
    // Layered torn paper frame edges + subtle paper fiber specks
    ctx.strokeStyle = 'rgba(255, 245, 224, 0.14)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, stageW - 16, stageH - 16);
    ctx.fillStyle = 'rgba(255, 250, 240, 0.04)';
    for (let i = 0; i < 18; i++) {
      const px = ((i * 97) % stageW);
      const py = ((i * 151) % stageH);
      ctx.fillRect(px, py, 2, 2);
    }
  } else if (styleId === 'crosshatch') {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    const step = 18;
    ctx.beginPath();
    for (let x = -stageH; x < stageW; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stageH, stageH);
    }
    ctx.stroke();
  } else if (styleId === 'riso_print') {
    // Halftone dot matrix & slight color-plate registration border
    ctx.fillStyle = 'rgba(255, 92, 138, 0.06)';
    for (let y = 12; y < stageH; y += 22) {
      for (let x = 12; x < stageW; x += 22) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(5, 5, stageW - 10, stageH - 10);
  } else if (styleId === 'sketchbook') {
    ctx.strokeStyle = 'rgba(245, 184, 46, 0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(10, 10, stageW - 20, stageH - 20);
    ctx.setLineDash([]);
  } else if (styleId === 'math_animation') {
    // Subtle coordinate grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
    ctx.lineWidth = 1;
    const g = 36;
    ctx.beginPath();
    for (let x = 0; x <= stageW; x += g) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, stageH);
    }
    for (let y = 0; y <= stageH; y += g) {
      ctx.moveTo(0, y);
      ctx.lineTo(stageW, y);
    }
    ctx.stroke();
  } else if (styleId === 'isometric') {
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.08)';
    ctx.lineWidth = 1;
    const step = 44;
    ctx.beginPath();
    for (let x = -stageH; x < stageW + stageH; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stageH * 1.15, stageH);
      ctx.moveTo(x, 0);
      ctx.lineTo(x - stageH * 1.15, stageH);
    }
    ctx.stroke();
  } else if (styleId === 'pixel_art') {
    // Subtle scanline & crisp grid hint
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    for (let y = 0; y < stageH; y += 4) {
      ctx.fillRect(0, y, stageW, 1);
    }
  } else if (styleId === 'cinema_realistic') {
    // Subtle anamorphic grain bar
    const flicker = 0.04 + 0.015 * Math.sin(timeSec * 14);
    ctx.fillStyle = `rgba(255, 255, 255, ${flicker.toFixed(3)})`;
    ctx.fillRect(0, 0, stageW, 1);
  }

  ctx.restore();
}
