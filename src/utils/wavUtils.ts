export function buildWavHeader(pcmByteLength: number, sampleRate = 24000): Uint8Array {
  const header = new DataView(new ArrayBuffer(44));
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      header.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  writeStr(0, 'RIFF');
  header.setUint32(4, 36 + pcmByteLength, true);
  writeStr(8, 'WAVEfmt ');
  header.setUint32(16, 16, true); // PCM chunk size
  header.setUint16(20, 1, true); // PCM format
  header.setUint16(22, 1, true); // Mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true); // Byte rate (16-bit mono)
  header.setUint16(32, 2, true); // Block align
  header.setUint16(34, 16, true); // Bits per sample
  writeStr(36, 'data');
  header.setUint32(40, pcmByteLength, true);
  return new Uint8Array(header.buffer);
}

export function extractPcmFromWav(wavBytes: Uint8Array): Uint8Array {
  if (wavBytes.byteLength <= 44) return new Uint8Array(0);
  // Scan for 'data' subchunk to be resilient to any extra RIFF chunks
  for (let i = 12; i < Math.min(wavBytes.byteLength - 8, 256); i++) {
    if (
      wavBytes[i] === 0x64 &&
      wavBytes[i + 1] === 0x61 &&
      wavBytes[i + 2] === 0x74 &&
      wavBytes[i + 3] === 0x61
    ) {
      const dataSize =
        wavBytes[i + 4] |
        (wavBytes[i + 5] << 8) |
        (wavBytes[i + 6] << 16) |
        (wavBytes[i + 7] << 24);
      const start = i + 8;
      const end = Math.min(wavBytes.byteLength, start + Math.max(0, dataSize));
      return wavBytes.subarray(start, end);
    }
  }
  return wavBytes.subarray(44);
}

export function concatWavClips(
  wavClips: Uint8Array[],
  gapSec = 0.22,
  sampleRate = 24000
): { wavBuffer: Uint8Array; sceneDurations: number[] } {
  const bytesPerSec = sampleRate * 2;
  const gapBytes = Math.max(0, Math.round(gapSec * bytesPerSec) & ~1);
  const pcmParts: Uint8Array[] = [];
  const sceneDurations: number[] = [];

  wavClips.forEach((clip, idx) => {
    const pcm = extractPcmFromWav(clip);
    const clipSec = pcm.byteLength / bytesPerSec;
    const hasGap = idx < wavClips.length - 1 && gapBytes > 0;
    sceneDurations.push(clipSec + (hasGap ? gapBytes / bytesPerSec : 0));
    pcmParts.push(pcm);
    if (hasGap) {
      pcmParts.push(new Uint8Array(gapBytes));
    }
  });

  const totalPcmBytes = pcmParts.reduce((acc, part) => acc + part.byteLength, 0);
  const header = buildWavHeader(totalPcmBytes, sampleRate);
  const wavBuffer = new Uint8Array(44 + totalPcmBytes);
  wavBuffer.set(header, 0);

  let offset = 44;
  for (const part of pcmParts) {
    wavBuffer.set(part, offset);
    offset += part.byteLength;
  }

  return { wavBuffer, sceneDurations };
}
