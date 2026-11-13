import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTimeline,
  computeAudioEnvelope,
  getSubtitleState,
  mapStyleKey,
  normalizeProject,
  parseJsonSafely,
  resolveAtTextLocalTime,
} from './projectLogic';

test('mapStyleKey recognizes OUTPUT G preset codes including PAPER-SKETCH', () => {
  assert.equal(mapStyleKey('PAPER-SKETCH'), 'paper');
  assert.equal(mapStyleKey('REF-CINEMA'), 'cinema');
  assert.equal(mapStyleKey('CLAY-3D'), 'clay');
  assert.equal(mapStyleKey('CINEMA-REAL'), 'cinema_real');
  assert.equal(mapStyleKey('night'), 'night');
});

test('normalizeProject parses both OUTPUT G (G1/G2/G4) and standard project JSON', () => {
  const gPayload = {
    G1: {
      title: 'บ้านเรา 7 คน',
      style_preset: 'PAPER-SKETCH',
      layout: 'letterbox',
      letterbox: { top_text: 'เรื่องจริงจากแชต', bottom_text: 'ดูให้จบ' },
      subtitle_style: 'sticker_dual',
      hud: { enabled: true, start: 'จันทร์ 06:00' },
      ending_type: 'twist',
    },
    G2: [
      {
        id: 'C1',
        name: 'ออม',
        skin: '#f2c8a2',
        hair: '#3a312c',
        hairStyle: 'long',
        outfit: { type: 'coat', color: '#69825c' },
        accessories: ['glasses', 'flower_hat'],
      },
    ],
    G4: [
      {
        id: 'S1',
        narration: 'ข้อความแรก, ส่งมาตอนเช้า.',
        subtitleEn: 'First message arrived in the morning.',
        bg: { preset: 'paper' },
        manualDurationSec: 4.5,
        holdAfter: 0.5,
        actors: [{ char: 'C1', x: 0.5, pose: 'talk', face: 'happy', flip: false }],
        cards: [{ type: 'bignumber', text: '8 เดือน', label: 'ในกลุ่มแชต', atText: 'ตอนเช้า' }],
        sfx: [{ name: 'ding', atText: 'ตอนเช้า' }],
        highlightWords: ['ตอนเช้า'],
      },
    ],
  };

  const proj = normalizeProject(gPayload);
  assert.equal(proj.title, 'บ้านเรา 7 คน');
  assert.equal(proj.style, 'paper');
  assert.equal(proj.layout, 'letterbox');
  assert.equal(proj.letterbox?.topText, 'เรื่องจริงจากแชต');
  assert.equal(proj.subtitleStyle, 'sticker_dual');
  assert.equal(proj.characters[0].outfit, 'coat');
  assert.equal(proj.characters[0].glasses, true);
  assert.equal(proj.scenes[0].manualDurationSec, 4.5);
  assert.equal(proj.scenes[0].holdAfter, 0.5);
  assert.equal(proj.scenes[0].card?.type, 'bignumber');
  assert.deepEqual(proj.scenes[0].hl, ['ตอนเช้า']);
});

test('computeAudioEnvelope detects speech boundaries and >=220ms pause candidates', () => {
  const sr = 1000;
  // 0.2s lead silence, 1.0s tone, 0.4s silence (pause candidate), 1.0s tone, 0.2s tail silence
  const samples = new Float32Array(2800);
  for (let i = 200; i < 1200; i++) samples[i] = 0.6 * Math.sin(i * 0.2);
  for (let i = 1600; i < 2600; i++) samples[i] = 0.6 * Math.sin(i * 0.2);

  const env = computeAudioEnvelope(samples, sr);
  assert.ok(env.speechStartSec >= 0.18 && env.speechStartSec <= 0.22);
  assert.ok(env.speechEndSec >= 2.55 && env.speechEndSec <= 2.65);
  assert.equal(env.pauseCandidates.length, 1);
  assert.ok(env.pauseCandidates[0].durSec >= 0.36);
  assert.ok(env.pauseCandidates[0].midSec >= 1.15 && env.pauseCandidates[0].midSec <= 1.25);
});

test('buildTimeline snaps scene boundary to pauseCandidate monotonically and supports manual offsets', () => {
  const scenes = [
    { narration: 'ประโยคที่หนึ่ง, สั้นๆ.', mood: 'paper' as const, actors: [], card: null, fx: 'none' as const, hl: [] },
    { narration: 'ประโยคที่สอง, จบแล้ว.', mood: 'paper' as const, actors: [], card: null, fx: 'none' as const, hl: [] },
  ];

  // Expected midpoint is ~1.5s; provide pause candidate at 1.75s (within ±1.2s and leaving >= 1.2s for scene 2)
  const tl = buildTimeline(scenes, {
    audioDurationSec: 3.0,
    speechStartSec: 0,
    speechEndSec: 3.0,
    pauseCandidates: [{ midSec: 1.75, durSec: 0.36 }],
  });

  assert.equal(tl.syncDiagnostics.mode, 'pause-matched');
  assert.equal(tl.syncDiagnostics.matchedBoundaries, 1);
  assert.ok(Math.abs((tl.timeline[0].b - tl.timeline[0].a) - 1.75) < 0.05);

  // Now verify manual duration + syncOffset + globalOffset
  const manualTl = buildTimeline(
    [
      { ...scenes[0], manualDurationSec: 5.0, syncOffset: 0.2 },
      { ...scenes[1], manualDurationSec: 3.0, holdAfter: 2.0 },
    ],
    { globalOffset: 0.1 }
  );
  assert.equal(manualTl.syncDiagnostics.mode, 'manual');
  assert.ok(Math.abs(manualTl.leadSec - 0.5) < 0.01);
  assert.ok(Math.abs((manualTl.timeline[0].b - manualTl.timeline[0].a) - 5.2) < 0.01);
  assert.ok(Math.abs((manualTl.timeline[1].b - manualTl.timeline[1].a) - 5.0) < 0.01);
});

test('resolveAtTextLocalTime finds keyword and snaps within ±0.4s to pause', () => {
  const t = resolveAtTextLocalTime(
    'เริ่มต้นด้วยข้อความแรก, แล้วคำว่าดอกไม้โผล่ขึ้นมา.',
    'ดอกไม้',
    6.0,
    0,
    [{ midSec: 4.1, durSec: 0.3 }]
  );
  assert.ok(t > 3.5 && t < 4.5);

  // Missing atText falls back safely without throwing
  const fallback = resolveAtTextLocalTime('ไม่มีคำนี้ในบท', 'ไม่พบ', 6.0);
  assert.equal(fallback, 0.25);
});

test('parseJsonSafely strips markdown fences cleanly', () => {
  const res = parseJsonSafely('```json\n{"title":"สวัสดี"}\n```') as { title: string };
  assert.equal(res.title, 'สวัสดี');
});

test('getSubtitleState splits clauses and marks highlight ranges', () => {
  const st = getSubtitleState('ผมอยู่ในกลุ่มแชต, มาแปดเดือนแล้ว.', ['แปดเดือน'], 2.4, 3.0, 'Eight months.');
  assert.ok(st);
  assert.equal(st.text, 'มาแปดเดือนแล้ว');
  assert.equal(st.subtitleEn, 'Eight months.');
  assert.deepEqual(st.highlightRanges, [[2, 10]]);
});
