import assert from 'node:assert/strict';
import test from 'node:test';
import type { UserAudioAsset } from '../types/studio';
import { DEMO_PROJECT_A } from './studioData';
import { buildProjectZipBytes, parseProjectZipBytes } from './zipProject';

test('buildProjectZipBytes and parseProjectZipBytes round-trip project and audio assets cleanly', async () => {
  const dummyBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
  const asset: UserAudioAsset = {
    id: 'asset_1',
    name: 'เสียงแจ้งเตือน',
    kind: 'user_sfx',
    tags: ['notification'],
    mimeType: 'audio/wav',
    blob: new Blob([dummyBytes], { type: 'audio/wav' }),
    durationSec: 0.8,
    createdAt: 12345,
  };

  const zipBytes = await buildProjectZipBytes(DEMO_PROJECT_A, [asset]);
  assert.ok(zipBytes.length > 50);

  const parsed = parseProjectZipBytes(zipBytes);
  assert.equal(parsed.project.id, DEMO_PROJECT_A.id);
  assert.equal(parsed.project.episodes[0].scenes.length, DEMO_PROJECT_A.episodes[0].scenes.length);
  assert.equal(parsed.assets.length, 1);
  assert.equal(parsed.assets[0].id, 'asset_1');
  const outBuf = new Uint8Array(await parsed.assets[0].blob.arrayBuffer());
  assert.deepEqual(Array.from(outBuf), Array.from(dummyBytes));
});
