import assert from 'node:assert/strict';
import test from 'node:test';
import type { StudioScene } from '../types/studio';
import {
  analyzeAudioEnvelope,
  buildStudioTimeline,
  computeThaiSpeechWeight,
  getActiveSubtitleClause,
  resolveAtTextLocalSec,
} from './timelineSync';

function makeScene(id: string, narration: string): StudioScene {
  return {
    id,
    narration,
    highlightWords: [],
    holdAfter: 0.3,
    bg: { preset: 'city_night' },
    blurBg: false,
    hud: {},
    actors: [],
    props: [],
    pov: null,
    cards: [],
    camera: { type: 'static', shot: 'medium' },
    fx: [],
    sfx: [],
    ambient: 'none',
    transition: 'fade',
    visualIntent: 'test',
  };
}

test('analyzeAudioEnvelope detects >=220ms silent gaps and ignores brief micro-pauses', () => {
  const sr = 1000; // 20 samples per 20ms frame
  const totalSamples = 6 * sr;
  const buf = new Float32Array(totalSamples);
  // Speech burst 1: 0.2s - 2.0s
  for (let i = 200; i < 2000; i++) buf[i] = 0.5 * Math.sin(i * 0.1);
  // Gap of 400ms (2.0s - 2.4s) -> should detect pause around midSec = 2.0 relative to speech start (0.2s) -> ~2.0s
  // Speech burst 2: 2.4s - 3.6s
  for (let i = 2400; i < 3600; i++) buf[i] = 0.5 * Math.sin(i * 0.1);
  // Brief 80ms gap (3.6s - 3.68s) -> should ignore
  // Speech burst 3: 3.68s - 5.2s
  for (let i = 3680; i < 5200; i++) buf[i] = 0.5 * Math.sin(i * 0.1);

  const res = analyzeAudioEnvelope(buf, sr);
  assert.equal(res.pauseCandidates.length, 1);
  assert.ok(res.pauseCandidates[0].durSec >= 0.36 && res.pauseCandidates[0].durSec <= 0.44);
  assert.ok(res.speechStartSec >= 0.18 && res.speechStartSec <= 0.24);
});

test('buildStudioTimeline snaps monotonically to detected pause boundaries and enforces minimum durations', () => {
  const s1 = makeScene('S1', 'ประโยคแรกของเรื่องนี้ยาวพอสมควร.');
  const s2 = makeScene('S2', 'ประโยคที่สองเล่าเรื่องราวต่อไปอีกหน่อย.');

  const out = buildStudioTimeline([s1, s2], {
    masterAudioDurationSec: 6.0,
    speechStartSec: 0,
    speechEndSec: 6.0,
    pauseCandidates: [{ midSec: 2.9, durSec: 0.4 }],
  });

  assert.equal(out.diagnostics.mode, 'pause-matched');
  assert.equal(out.diagnostics.matchedBoundaries, 1);
  assert.ok(out.segments[0].speechEndSec - out.segments[0].startSec >= 2.5);
  assert.ok(out.segments[1].startSec >= out.segments[0].endSec);
});

test('resolveAtTextLocalSec snaps to nearby pause within +-0.4s and computeThaiSpeechWeight weighs punctuation', () => {
  assert.ok(computeThaiSpeechWeight('ก,ข.') > computeThaiSpeechWeight('กข'));
  const snapped = resolveAtTextLocalSec('ข้อความแรก ก่อนจะเกิดเหตุการณ์สำคัญ', 'เหตุการณ์', 4.0, 0, [
    { midSec: 2.75, durSec: 0.3 },
  ]);
  assert.ok(Math.abs(snapped - 2.75) < 0.01);

  const sub = getActiveSubtitleClause('ท่อนแรก, ท่อนสอง', ['ท่อนสอง'], 3.5, 4.0);
  assert.equal(sub?.text, 'ท่อนสอง');
});
