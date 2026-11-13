import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWavHeader, concatWavClips, extractPcmFromWav } from './wavUtils';

function makeFakeWav(pcmBytesCount: number, fillByte = 1): Uint8Array {
  const header = buildWavHeader(pcmBytesCount, 24000);
  const out = new Uint8Array(44 + pcmBytesCount);
  out.set(header, 0);
  out.fill(fillByte, 44);
  return out;
}

test('buildWavHeader creates valid RIFF WAVE header', () => {
  const header = buildWavHeader(48000, 24000);
  assert.equal(header.byteLength, 44);
  const tag = String.fromCharCode(header[0], header[1], header[2], header[3]);
  const wave = String.fromCharCode(header[8], header[9], header[10], header[11]);
  assert.equal(tag, 'RIFF');
  assert.equal(wave, 'WAVE');
});

test('concatWavClips combines clips with silence gap and calculates durations', () => {
  // 24000Hz * 2 bytes = 48000 bytes/sec
  const clip1 = makeFakeWav(48000, 0x11); // 1.0s
  const clip2 = makeFakeWav(24000, 0x22); // 0.5s
  const { wavBuffer, sceneDurations } = concatWavClips([clip1, clip2], 0.2, 24000);

  assert.equal(sceneDurations.length, 2);
  assert.ok(Math.abs(sceneDurations[0] - 1.2) < 0.001);
  assert.ok(Math.abs(sceneDurations[1] - 0.5) < 0.001);

  const pcm = extractPcmFromWav(wavBuffer);
  // 48000 + (0.2 * 48000 = 9600) + 24000 = 81600 bytes
  assert.equal(pcm.byteLength, 81600);
  assert.equal(pcm[0], 0x11);
  assert.equal(pcm[48000], 0); // silence gap
  assert.equal(pcm[48000 + 9600], 0x22);
});
