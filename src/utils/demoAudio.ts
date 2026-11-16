import type { StudioScene } from '../types/studio';

function encodeWavFromFloat32(samples: Float32Array, sampleRate: number): Blob {
  const dataSize = samples.length * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([ab], { type: 'audio/wav' });
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Generates deterministic non-silent speech-cadence WAV audio per scene so
 * built-in demos play with real voice envelope, lip sync, and audible sound
 * even when offline with zero API keys.
 */
export function synthesizeSceneCadenceWav(
  scene: StudioScene,
  sampleRate = 22050
): { blob: Blob; durationSec: number } {
  const text = scene.narration || 'ฉากนี้';
  const charCount = Math.max(18, text.length);
  const durationSec = Math.max(2.6, Math.min(9.5, charCount / 11));
  const totalSamples = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(totalSamples);

  const seed = hashSeed(scene.id + text);
  const basePitch = 138 + (seed % 34); // natural warm Thai narrator fundamental Hz
  const tokens = text.split(/([,.\s\n]+)/).filter((t) => t.length > 0);

  let cursor = Math.floor(0.08 * sampleRate);
  const endLimit = totalSamples - Math.floor(0.08 * sampleRate);

  for (let tIdx = 0; tIdx < tokens.length && cursor < endLimit; tIdx++) {
    const tok = tokens[tIdx];
    if (/^[,.\s\n]+$/.test(tok)) {
      const pauseSec = tok.includes('.') || tok.includes('\n') ? 0.24 : tok.includes(',') ? 0.14 : 0.04;
      cursor += Math.floor(pauseSec * sampleRate);
      continue;
    }

    // Divide Thai token into 140-180ms speech syllables
    const syllableCount = Math.max(1, Math.ceil(tok.length / 3.2));
    for (let s = 0; s < syllableCount && cursor < endLimit; s++) {
      const sylSeed = (seed + tIdx * 31 + s * 17) >>> 0;
      const sylSec = 0.11 + ((sylSeed % 5) * 0.015);
      const sylLen = Math.min(endLimit - cursor, Math.floor(sylSec * sampleRate));
      const toneMod = 0.92 + ((sylSeed % 7) * 0.03); // Thai lexical tone contour simulation
      const toneSlope = ((sylSeed % 3) - 1) * 0.12;
      const f0Start = basePitch * toneMod;
      const f1 = 480 + (sylSeed % 4) * 140; // formant 1
      const f2 = 1350 + ((sylSeed >> 3) % 5) * 210; // formant 2

      let phase0 = 0;
      let phase1 = 0;
      let phase2 = 0;
      for (let i = 0; i < sylLen; i++) {
        const u = i / Math.max(1, sylLen);
        const env = Math.sin(Math.PI * u) * (u < 0.15 ? u / 0.15 : 1);
        const f0 = f0Start * (1 + toneSlope * u);
        phase0 += (2 * Math.PI * f0) / sampleRate;
        phase1 += (2 * Math.PI * f1) / sampleRate;
        phase2 += (2 * Math.PI * f2) / sampleRate;

        const glottal =
          Math.sin(phase0) * 0.55 +
          Math.sin(phase0 * 2) * 0.28 +
          Math.sin(phase0 * 3) * 0.14;
        const formant = Math.sin(phase1) * 0.22 + Math.sin(phase2) * 0.1;
        out[cursor + i] = (glottal + formant) * env * 0.28;
      }
      cursor += sylLen + Math.floor(0.025 * sampleRate);
    }
  }

  return {
    blob: encodeWavFromFloat32(out, sampleRate),
    durationSec,
  };
}
