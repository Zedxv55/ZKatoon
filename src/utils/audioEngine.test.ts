import test from 'node:test';
import assert from 'node:assert/strict';
import type { SceneAudioRecord } from '../types/cartoon';
import { mergeSceneAudioRecordsToBuffer } from './audioEngine';

function createFakeAudioContext(shouldFailDecodeForSize?: number): AudioContext {
  const sampleRate = 24000;
  return {
    sampleRate,
    async decodeAudioData(ab: ArrayBuffer) {
      if (shouldFailDecodeForSize !== undefined && ab.byteLength === shouldFailDecodeForSize) {
        throw new Error('EncodingError: corrupt audio chunk');
      }
      const length = 12000; // 0.5 sec
      const data = new Float32Array(length).fill(0.1);
      return {
        sampleRate,
        length,
        duration: length / sampleRate,
        numberOfChannels: 1,
        getChannelData: () => data,
      } as unknown as AudioBuffer;
    },
    createBuffer(channels: number, length: number, sr: number) {
      const ch = new Float32Array(length);
      return {
        numberOfChannels: channels,
        length,
        sampleRate: sr,
        duration: length / sr,
        getChannelData: () => ch,
      } as unknown as AudioBuffer;
    },
  } as unknown as AudioContext;
}

function makeRec(sceneId: string, byteLength: number): SceneAudioRecord {
  const bytes = new Uint8Array(byteLength).fill(1);
  return {
    key: `ws::proj::${sceneId}`,
    workspaceId: 'ws',
    projectId: 'proj',
    sceneId,
    providerId: 'openai',
    voiceId: 'nova',
    voiceName: 'Nova',
    emotion: 'neutral',
    textRaw: 'สวัสดี',
    textPrepared: 'สวัสดี',
    audioBlob: new Blob([bytes], { type: 'audio/wav' }),
    mimeType: 'audio/wav',
    durationSec: 1.0,
    envelope: [0.2],
    generatedAt: 1000,
  };
}

test('mergeSceneAudioRecordsToBuffer reports per-scene decode failures instead of silent success', async () => {
  const ctx = createFakeAudioContext(17);
  const scenes = [
    { id: 'S1', title: 'ฉาก 1', narration: 'หนึ่ง' },
    { id: 'S2', title: 'ฉาก 2', narration: 'สอง' },
  ] as unknown as Parameters<typeof mergeSceneAudioRecordsToBuffer>[1];

  const map: Record<string, SceneAudioRecord> = {
    S1: makeRec('S1', 32),
    S2: makeRec('S2', 17), // triggers simulated decode error
  };

  const res = await mergeSceneAudioRecordsToBuffer(ctx, scenes, map);
  assert.equal(res.decodedSceneCount, 1);
  assert.equal(res.failedScenes.length, 1);
  assert.equal(res.failedScenes[0].sceneId, 'S2');
  assert.match(res.failedScenes[0].reason, /corrupt audio chunk/);
  assert.ok(res.voiceBuffer !== null);
});

test('mergeSceneAudioRecordsToBuffer returns null voiceBuffer and failedScenes when all clips fail or are empty', async () => {
  const ctx = createFakeAudioContext(17);
  const scenes = [
    { id: 'S1', title: 'ฉาก 1', narration: 'หนึ่ง' },
    { id: 'S2', title: 'ฉาก 2', narration: 'สอง' },
  ] as unknown as Parameters<typeof mergeSceneAudioRecordsToBuffer>[1];

  const map: Record<string, SceneAudioRecord> = {
    S1: makeRec('S1', 0),
    S2: makeRec('S2', 17),
  };

  const res = await mergeSceneAudioRecordsToBuffer(ctx, scenes, map);
  assert.equal(res.decodedSceneCount, 0);
  assert.equal(res.voiceBuffer, null);
  assert.equal(res.rawWav, null);
  assert.equal(res.failedScenes.length, 2);
  assert.equal(res.failedScenes[0].sceneId, 'S1');
  assert.equal(res.failedScenes[1].sceneId, 'S2');
});
