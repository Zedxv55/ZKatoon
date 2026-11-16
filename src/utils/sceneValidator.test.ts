import assert from 'node:assert/strict';
import test from 'node:test';
import type { StudioProject, StudioScene } from '../types/studio';
import { validateAndFixEpisode } from './sceneValidator';

function makeBaseScene(id: string, narration: string, overrides?: Partial<StudioScene>): StudioScene {
  return {
    id,
    narration,
    highlightWords: [],
    holdAfter: 0.3,
    bg: { preset: 'city_night' },
    blurBg: false,
    hud: { time: '22:39' },
    actors: [],
    props: [],
    pov: null,
    cards: [],
    camera: { type: 'static', shot: 'medium' },
    fx: [],
    sfx: [],
    ambient: 'none',
    transition: 'fade',
    visualIntent: 'test scene',
    ...overrides,
  };
}

function makeProject(scenes: StudioScene[]): StudioProject {
  return {
    id: 'p1',
    title: 'ทดสอบ',
    mode: 'story',
    layout: 'portrait_full',
    stylePack: 'A',
    palette: [{ hex: '#1B2433', role: 'bg' }],
    characters: [
      {
        id: 'C1',
        name: 'ต้น',
        role: 'main',
        personality: 'กล้าหาญ',
        species: 'human',
        age: 'adult',
        body: 'normal',
        skin: '#f2c8a2',
        hair: { style: 'short', color: '#1f2937' },
        outfit: { type: 'tshirt', color: '#3b82f6', accent: '#ffffff' },
        accessories: [],
        signature: 'scar',
        locked: true,
      },
      {
        id: 'E1',
        name: 'คนเดินผ่าน',
        role: 'extra',
        personality: 'ประกอบ',
        species: 'human',
        age: 'adult',
        body: 'normal',
        skin: '#f2c8a2',
        hair: { style: 'short', color: '#111827' },
        outfit: { type: 'tshirt', color: '#e11d48', accent: '#ffffff' },
        accessories: [],
        signature: 'extra',
        locked: false,
      },
    ],
    episodes: [
      {
        id: 'ep1',
        ep: 1,
        total: 1,
        title: 'ตอน 1',
        chapters: [{ id: 'ch1', title: 'บท 1', sceneIds: scenes.map((s) => s.id) }],
        scenes,
        music: { mood: 'mystery', bpm: 92, key: 'C', mode: 'minor', swells: [], quietScenes: [], endStyle: 'resolve' },
        endingType: 'twist',
      },
    ],
    seriesBible: { recap: '', lockedCharacterIds: ['C1'] },
    settings: {
      subtitleMode: 'yellow_highlight',
      letterboxTopText: '',
      letterboxBottomText: '',
      sourceNotes: ['ข้อมูลที่ผู้ใช้ให้ไว้'],
      cinematicEnabled: true,
      hudEnabled: true,
      fps: 30,
      resolution: '720p',
    },
    updatedAt: 1000,
  };
}

test('validateAndFixEpisode clamps actor/prop x, deduplicates extras, filters unauthorized source_note, diversifies 3 consecutive identical scenes, and appends end_card', () => {
  const s1 = makeBaseScene('S1', 'คืนนั้นไฟดับทั้งซอย และเสียงฝีเท้าใกล้เข้ามาเรื่อยๆ.', {
    actors: [
      { char: 'C1', x: 0.02, y: 0.8, scale: 0.7, pose: 'idle', face: 'neutral', flip: false },
      { char: 'E1', x: 0.95, y: 0.8, scale: 1.4, pose: 'wave', face: 'happy', flip: true },
      { char: 'E1', x: 0.8, y: 0.8, scale: 0.75, pose: 'wave', face: 'happy', flip: true },
    ],
    props: [{ name: 'phone', x: 0.01, y: 0.6, size: 1 }],
    cards: [{ type: 'source_note', text: 'แหล่งอ้างอิงที่แต่งขึ้นเอง' }],
    camera: { type: 'static', shot: 'wide' },
  });
  const s2 = makeBaseScene('S1', 'เขาหยิบมือถือขึ้นส่องดูแผนที่สถานีรถไฟฟ้าอย่างระมัดระวัง.', {
    camera: { type: 'static', shot: 'wide' },
  });
  const s3 = makeBaseScene('S3', 'ก่อนจะพบว่าทุกอย่างถูกวางแผนไว้ตั้งแต่แรก.', {
    camera: { type: 'static', shot: 'wide' },
  });

  const proj = makeProject([s1, s2, s3]);
  const res = validateAndFixEpisode(proj, proj.episodes[0], {
    fullScript: [s1.narration, s2.narration, s3.narration].join('\n'),
  });

  const fixed = res.episode.scenes;
  assert.equal(fixed[0].actors[0].x, 0.12);
  assert.equal(fixed[0].actors[1].x, 0.88);
  assert.equal(fixed[0].actors[1].scale, 0.8);
  assert.notEqual(fixed[0].actors[1].char, fixed[0].actors[2].char);
  assert.equal(fixed[0].props[0].x, 0.12);
  assert.equal(fixed[0].cards.length, 0);
  assert.notEqual(fixed[1].id, fixed[0].id);
  assert.notEqual(fixed[2].camera.shot, 'wide');
  assert.ok(fixed[2].cards.some((c) => c.type === 'end_card'));
  assert.ok(fixed[2].holdAfter >= 2.5);
  assert.equal(res.report.scriptExactMatch, true);
});
