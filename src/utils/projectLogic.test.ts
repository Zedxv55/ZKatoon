import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTimeline,
  computeAudioEnvelope,
  formatTimecode,
  getMouthOpenAt,
  getSubtitleState,
  normalizeProject,
  parseJsonSafely,
  sanitizeFilename,
} from './projectLogic';

test('parseJsonSafely extracts fenced JSON cleanly', () => {
  const raw = '```json\n{"title":"ทดสอบ","scenes":[{"narration":"สวัสดี"}]}\n```';
  const parsed = parseJsonSafely(raw) as { title: string };
  assert.equal(parsed.title, 'ทดสอบ');
});

test('normalizeProject clamps actor positions and provides safe defaults', () => {
  const proj = normalizeProject({
    title: 'เรื่องทดสอบ',
    scenes: [
      {
        narration: 'ฉากแรก',
        mood: 'invalid_mood',
        actors: [
          { char: 'C1', x: -0.5, pose: 'cheer', face: 'happy', flip: false },
          { char: 'C2', x: 1.5, pose: 'talk', face: 'neutral', flip: true },
          { char: 'C3', x: 0.5, pose: 'idle', face: 'neutral', flip: false },
        ],
      },
    ],
  });

  assert.equal(proj.characters.length, 1);
  assert.equal(proj.scenes[0].mood, 'night');
  assert.equal(proj.scenes[0].actors.length, 2);
  assert.equal(proj.scenes[0].actors[0].x, 0.12);
  assert.equal(proj.scenes[0].actors[1].x, 0.88);
});

test('buildTimeline uses exact sceneDurations when provided', () => {
  const scenes = [
    { narration: 'สั้น', mood: 'day' as const, actors: [], card: null, fx: 'none' as const, hl: [] },
    { narration: 'ยาวมากกกก', mood: 'night' as const, actors: [], card: null, fx: 'none' as const, hl: [] },
  ];
  const res = buildTimeline(scenes, { sceneDurations: [2.0, 3.0] });
  assert.equal(res.timeline.length, 2);
  assert.ok(Math.abs(res.timeline[0].a - 0.4) < 0.001);
  assert.ok(Math.abs(res.timeline[0].b - 2.4) < 0.001);
  assert.ok(Math.abs(res.timeline[1].a - 2.4) < 0.001);
  // Last scene includes 2.4s end-hold
  assert.ok(Math.abs(res.totalDuration - 7.8) < 0.001);
});

test('computeAudioEnvelope detects speech boundaries and mouth opening', () => {
  const sr = 1000; // 20ms step = 20 samples
  const samples = new Float32Array(1000); // 1 second
  // Silence 0..200ms, speech 200..700ms, silence 700..1000ms
  for (let i = 200; i < 700; i++) {
    samples[i] = 0.8 * Math.sin(i * 0.5);
  }
  const env = computeAudioEnvelope(samples, sr);
  assert.ok(env.speechStartSec >= 0.18 && env.speechStartSec <= 0.22);
  assert.ok(env.speechEndSec >= 0.68 && env.speechEndSec <= 0.72);
  assert.ok(getMouthOpenAt(0.45, env.envelope, 0.4, env.speechStartSec) > 0.5);
  assert.equal(getMouthOpenAt(0.1, env.envelope, 0.4, env.speechStartSec), 0);
});

test('getSubtitleState splits clauses and maps highlight ranges', () => {
  const sub = getSubtitleState(
    'เคยไหม, ตื่นตอนตีสาม แล้วตาค้าง.',
    ['ตีสาม'],
    2.5,
    4.0
  );
  assert.ok(sub);
  assert.equal(sub.text, 'ตื่นตอนตีสาม แล้วตาค้าง');
  assert.equal(sub.highlightRanges.length, 1);
  assert.equal(sub.text.slice(sub.highlightRanges[0][0], sub.highlightRanges[0][1]), 'ตีสาม');
});

test('sanitizeFilename and formatTimecode preserve Thai and format mm:ss', () => {
  assert.equal(sanitizeFilename('ทำไมตื่นตี 3?!'), 'ทำไมตื่นตี_3');
  assert.equal(formatTimecode(65), '1:05');
  assert.equal(formatTimecode(-4), '0:00');
});
