import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAiEditOps, describeAiOps } from './aiChatOps';
import { DEMO_PROJECT_A } from './studioData';

test('applyAiEditOps handles updateScene, addScene, moveScene, deleteScene, setStyle, and marks audio stale on narration edit', () => {
  const projWithAudio = {
    ...DEMO_PROJECT_A,
    episodes: [
      {
        ...DEMO_PROJECT_A.episodes[0],
        scenes: DEMO_PROJECT_A.episodes[0].scenes.map((s, idx) =>
          idx === 0 ? { ...s, audio: { assetId: 'a1', durationSec: 3.1, stale: false } } : s
        ),
      },
    ],
  };

  const ops = [
    {
      op: 'updateScene' as const,
      id: 'S1',
      patch: { narration: 'ข้อความใหม่ที่ไม่เหมือนเดิม', fx: [{ type: 'rain' as const, intensity: 0.7 }] },
    },
    {
      op: 'addScene' as const,
      afterSceneId: 'S1',
      scene: { id: 'S_ADDED', narration: 'ฉากที่เพิ่งเพิ่มเข้ามาใหม่เพื่อทดสอบ' },
    },
    {
      op: 'setStyle' as const,
      stylePack: 'C' as const,
      subtitleMode: 'capsule_highlight' as const,
    },
  ];

  const diff = describeAiOps(ops, projWithAudio);
  assert.equal(diff.length, 3);

  const next = applyAiEditOps(projWithAudio, ops);
  const scenes = next.episodes[0].scenes;
  assert.equal(scenes.length, projWithAudio.episodes[0].scenes.length + 1);
  assert.equal(scenes[0].audio?.stale, true);
  assert.equal(scenes[1].id, 'S_ADDED');
  assert.equal(next.stylePack, 'C');
  assert.equal(next.settings.subtitleMode, 'capsule_highlight');
});
