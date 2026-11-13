import * as lamejsPkg from '@breezystack/lamejs';
import type {
  AmbientType,
  CartoonProject,
  MusicConfig,
  PauseCandidate,
  SfxName,
  TimelineSegment,
} from '../types/cartoon';
import { resolveAtTextLocalTime } from './projectLogic';

export interface ScheduledAudioEvent {
  time: number; // absolute video timeline time (sec)
  kind: 'sfx' | 'music_note';
  sfxName?: SfxName;
  gain?: number;
  freq?: number;
  dur?: number;
  voiceType?: 'bass' | 'chord' | 'arp';
  musicGain?: number;
}

const KEY_ROOT_MIDI: Record<MusicConfig['key'], number> = {
  C: 60,
  D: 62,
  E: 64,
  F: 65,
  G: 67,
  A: 69,
};

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getScaleIntervals(mode: MusicConfig['mode']): number[] {
  return mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
}

function createNoiseBuffer(ctx: BaseAudioContext, seconds = 2): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // Deterministic linear congruential noise so Preview and Offline render sound consistent
  let seed = 1337;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buf;
}

function scheduleSfx(
  ctx: BaseAudioContext,
  dest: AudioNode,
  noiseBuf: AudioBuffer,
  name: SfxName,
  when: number,
  volume = 0.4
) {
  const out = ctx.createGain();
  out.gain.value = volume;
  out.connect(dest);

  const stopAfter = (node: AudioScheduledSourceNode, dur: number) => {
    node.start(when);
    node.stop(when + dur + 0.05);
  };

  switch (name) {
    case 'ding':
    case 'sparkle':
    case 'coin': {
      const freqs = name === 'coin' ? [987.77, 1318.51] : name === 'sparkle' ? [1046.5, 1318.5, 1567.98] : [880, 1320];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, when + i * 0.05);
        g.gain.setValueAtTime(0.001, when + i * 0.05);
        g.gain.exponentialRampToValueAtTime(0.35, when + i * 0.05 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, when + i * 0.05 + 0.42);
        osc.connect(g).connect(out);
        osc.start(when + i * 0.05);
        osc.stop(when + i * 0.05 + 0.45);
      });
      break;
    }
    case 'pop':
    case 'click':
    case 'tick':
    case 'typing': {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = name === 'tick' || name === 'typing' ? 'triangle' : 'sine';
      const startF = name === 'pop' ? 320 : name === 'typing' ? 1200 : 800;
      const endF = name === 'pop' ? 760 : 280;
      osc.frequency.setValueAtTime(startF, when);
      osc.frequency.exponentialRampToValueAtTime(endF, when + 0.06);
      g.gain.setValueAtTime(0.4, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.08);
      osc.connect(g).connect(out);
      stopAfter(osc, 0.09);
      break;
    }
    case 'whoosh':
    case 'paper':
    case 'wind': {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = name === 'paper' ? 2.4 : 1.5;
      bp.frequency.setValueAtTime(name === 'paper' ? 1800 : 300, when);
      bp.frequency.exponentialRampToValueAtTime(name === 'paper' ? 4200 : 1400, when + 0.18);
      const g = ctx.createGain();
      const dur = name === 'wind' ? 0.8 : 0.25;
      g.gain.setValueAtTime(0.001, when);
      g.gain.exponentialRampToValueAtTime(0.45, when + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      src.connect(bp).connect(g).connect(out);
      stopAfter(src, dur);
      break;
    }
    case 'boom':
    case 'hit':
    case 'stamp':
    case 'door':
    case 'footstep': {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = name === 'door' || name === 'stamp' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(name === 'boom' ? 130 : name === 'footstep' ? 160 : 210, when);
      osc.frequency.exponentialRampToValueAtTime(38, when + (name === 'boom' ? 0.55 : 0.16));
      g.gain.setValueAtTime(0.7, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + (name === 'boom' ? 0.6 : 0.18));
      osc.connect(g).connect(out);
      stopAfter(osc, name === 'boom' ? 0.65 : 0.2);
      break;
    }
    case 'heartbeat': {
      [0, 0.22].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 72 : 60, when + offset);
        osc.frequency.exponentialRampToValueAtTime(35, when + offset + 0.14);
        g.gain.setValueAtTime(0.65, when + offset);
        g.gain.exponentialRampToValueAtTime(0.001, when + offset + 0.18);
        osc.connect(g).connect(out);
        osc.start(when + offset);
        osc.stop(when + offset + 0.2);
      });
      break;
    }
    case 'siren':
    case 'alarm': {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = name === 'alarm' ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(640, when);
      osc.frequency.linearRampToValueAtTime(980, when + 0.28);
      osc.frequency.linearRampToValueAtTime(640, when + 0.56);
      g.gain.setValueAtTime(0.18, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
      osc.connect(g).connect(out);
      stopAfter(osc, 0.62);
      break;
    }
    case 'error':
    case 'glitch': {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(name === 'glitch' ? 420 : 210, when);
      osc.frequency.setValueAtTime(name === 'glitch' ? 190 : 145, when + 0.08);
      g.gain.setValueAtTime(0.28, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
      osc.connect(g).connect(out);
      stopAfter(osc, 0.25);
      break;
    }
    case 'laugh': {
      [0, 0.12, 0.24].forEach((off, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(420 + i * 50, when + off);
        osc.frequency.exponentialRampToValueAtTime(320, when + off + 0.09);
        g.gain.setValueAtTime(0.25, when + off);
        g.gain.exponentialRampToValueAtTime(0.001, when + off + 0.1);
        osc.connect(g).connect(out);
        osc.start(when + off);
        osc.stop(when + off + 0.11);
      });
      break;
    }
    case 'rain':
    default: {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.001, when);
      g.gain.exponentialRampToValueAtTime(0.25, when + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
      src.connect(lp).connect(g).connect(out);
      stopAfter(src, 0.62);
      break;
    }
  }
}

function scheduleMusicNote(
  ctx: BaseAudioContext,
  dest: AudioNode,
  ev: ScheduledAudioEvent,
  when: number
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ev.freq ?? 261.63;
  const dur = ev.dur ?? 0.4;
  const peak = ev.musicGain ?? 0.22;

  if (ev.voiceType === 'bass') {
    osc.type = 'triangle';
  } else if (ev.voiceType === 'arp') {
    osc.type = 'sine';
  } else {
    osc.type = 'sine';
  }

  osc.frequency.setValueAtTime(f, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

  osc.connect(g).connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.04);
}

export function collectScheduledEvents(
  project: CartoonProject,
  timeline: TimelineSegment[],
  totalDuration: number,
  pauseCandidates: PauseCandidate[],
  leadSec: number,
  enableBgmAndSfx = true
): ScheduledAudioEvent[] {
  if (!enableBgmAndSfx) return [];
  const events: ScheduledAudioEvent[] = [];

  // 1. Collect SFX cues per scene
  timeline.forEach((seg, idx) => {
    const cues = seg.s.sfx || [];
    const speechDur = Math.max(0.4, seg.speechEnd - seg.a);
    const sceneRelSpeech = Math.max(0, seg.a - leadSec);
    cues.forEach((cue) => {
      const localOff = cue.atText
        ? resolveAtTextLocalTime(seg.s.narration, cue.atText, speechDur, sceneRelSpeech, pauseCandidates)
        : idx === 0
          ? 0.05
          : 0.12;
      events.push({
        time: Math.max(0, seg.a + localOff),
        kind: 'sfx',
        sfxName: cue.name,
        gain: cue.gain ?? 0.4,
      });
    });
  });

  // 2. Collect Procedural Music Sequencer events (chords + bass + arpeggio)
  const music: MusicConfig = project.music || { mood: 'warm', bpm: 84, key: 'C', mode: 'major' };
  const bpm = Math.max(55, Math.min(150, music.bpm || 84));
  const beatSec = 60 / bpm;
  const rootMidi = KEY_ROOT_MIDI[music.key] ?? 60;
  const scale = getScaleIntervals(music.mode || 'major');
  const prog =
    music.mood === 'tense' || music.mood === 'mystery'
      ? [0, 3, 4, 0]
      : music.mood === 'sad'
        ? [0, 5, 3, 4]
        : [0, 4, 5, 3]; // I - V - vi - IV warm/happy/calm progression

  let step = 0;
  for (let t = 0; t < totalDuration - 0.15; t += beatSec) {
    const barIdx = Math.floor(step / 4) % prog.length;
    const deg = prog[barIdx];
    const chordRoot = rootMidi + scale[deg % scale.length];
    const beatInBar = step % 4;

    if (beatInBar === 0) {
      // Bass + warm triad chord
      events.push({
        time: t,
        kind: 'music_note',
        voiceType: 'bass',
        freq: midiToFreq(chordRoot - 12),
        dur: beatSec * 1.8,
        musicGain: 0.34,
      });
      [0, 2, 4].forEach((offsetIdx) => {
        const interval = scale[(deg + offsetIdx) % scale.length];
        events.push({
          time: t,
          kind: 'music_note',
          voiceType: 'chord',
          freq: midiToFreq(rootMidi + interval),
          dur: beatSec * 3.4,
          musicGain: 0.16,
        });
      });
    }

    // Gentle arpeggio on beats
    if (music.mood !== 'tense' || beatInBar % 2 === 0) {
      const arpDeg = (deg + (beatInBar % 3) * 2) % scale.length;
      events.push({
        time: t,
        kind: 'music_note',
        voiceType: 'arp',
        freq: midiToFreq(rootMidi + 12 + scale[arpDeg]),
        dur: beatSec * 0.85,
        musicGain: 0.14,
      });
    }
    step++;
  }

  return events.sort((a, b) => a.time - b.time);
}

export interface AudioGraphHandle {
  schedulerTick: (currentVideoTime: number) => void;
  stop: () => void;
}

/**
 * Unified Audio Graph Builder used by BOTH live Preview (AudioContext) and Export (OfflineAudioContext).
 * Ensures preview audio, ducking, SFX, ambient beds, and MP4/MP3 export match identically.
 */
export function buildAudioGraph(
  ctx: BaseAudioContext,
  destinationNode: AudioNode,
  startOffset: number,
  options: {
    project: CartoonProject;
    timeline: TimelineSegment[];
    totalDuration: number;
    voiceBuffer: AudioBuffer | null;
    speechStartSec: number;
    leadSec: number;
    envelope: number[];
    pauseCandidates: PauseCandidate[];
    enableBgmAndSfx?: boolean;
    baseCtxTime?: number;
  }
): AudioGraphHandle {
  const {
    project,
    timeline,
    totalDuration,
    voiceBuffer,
    speechStartSec,
    leadSec,
    envelope,
    pauseCandidates,
    enableBgmAndSfx = true,
    baseCtxTime = 0,
  } = options;

  const isOffline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const activeNodes: AudioScheduledSourceNode[] = [];

  // Master compressor/limiter to guarantee zero clipping
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.12;
  compressor.connect(destinationNode);

  // Voiceover bus (gain = 1.0)
  const voiceGain = ctx.createGain();
  voiceGain.gain.value = 1.0;
  voiceGain.connect(compressor);

  if (voiceBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = voiceBuffer;
    src.connect(voiceGain);

    // Where in audio timeline does voice start? At leadSec.
    if (startOffset < leadSec) {
      const wait = leadSec - startOffset;
      src.start(baseCtxTime + wait, Math.max(0, speechStartSec));
    } else {
      const elapsedVoice = startOffset - leadSec;
      const offsetInBuf = speechStartSec + elapsedVoice;
      if (offsetInBuf < voiceBuffer.duration - 0.02) {
        src.start(baseCtxTime, Math.max(0, offsetInBuf));
      }
    }
    activeNodes.push(src);
  }

  // Music bus with automatic ducking based on analyzed envelope (0.14 -> 0.07 during speech)
  const musicBus = ctx.createGain();
  musicBus.gain.value = voiceBuffer ? 0.1 : 0.14;
  musicBus.connect(compressor);

  // Apply automated ducking curve if we have envelope
  if (enableBgmAndSfx && voiceBuffer && envelope.length > 0) {
    try {
      let lastState = false;
      musicBus.gain.setValueAtTime(0.14, baseCtxTime);
      for (let t = Math.max(0, startOffset); t < totalDuration; t += 0.12) {
        const speechTime = t - leadSec + speechStartSec;
        const idx = Math.floor(speechTime / 0.02);
        const speaking = speechTime >= 0 && (envelope[idx] ?? 0) > 0.14;
        if (speaking !== lastState) {
          const whenAbs = baseCtxTime + (t - startOffset);
          musicBus.gain.linearRampToValueAtTime(speaking ? 0.07 : 0.14, whenAbs + 0.08);
          lastState = speaking;
        }
      }
    } catch {
      // safe fallback
    }
  }

  const sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.4;
  sfxBus.connect(compressor);

  const noiseBuf = createNoiseBuffer(ctx, 2.5);

  // Ambient bed (filtered noise / cricket pulses per scene)
  if (enableBgmAndSfx) {
    const dominantAmb: AmbientType =
      timeline.find((seg) => seg.s.ambient && seg.s.ambient !== 'none')?.s.ambient || 'none';
    if (dominantAmb !== 'none') {
      const ambGain = ctx.createGain();
      ambGain.gain.value = 0.08;
      ambGain.connect(compressor);

      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      if (dominantAmb === 'rain' || dominantAmb === 'forest') {
        filter.type = 'bandpass';
        filter.frequency.value = dominantAmb === 'rain' ? 2400 : 1200;
      } else if (dominantAmb === 'night_insects') {
        filter.type = 'bandpass';
        filter.frequency.value = 4600;
        filter.Q.value = 4;
      } else {
        filter.type = 'lowpass';
        filter.frequency.value = dominantAmb === 'city' ? 500 : 350;
      }

      src.connect(filter).connect(ambGain);
      const remaining = Math.max(0.1, totalDuration - startOffset);
      src.start(baseCtxTime);
      src.stop(baseCtxTime + remaining);
      activeNodes.push(src);
    }
  }

  const events = collectScheduledEvents(
    project,
    timeline,
    totalDuration,
    pauseCandidates,
    leadSec,
    enableBgmAndSfx
  );

  let nextEventIdx = events.findIndex((ev) => ev.time >= startOffset - 0.02);
  if (nextEventIdx < 0) nextEventIdx = events.length;

  const scheduleEventAt = (ev: ScheduledAudioEvent, whenAbs: number) => {
    if (ev.kind === 'sfx' && ev.sfxName) {
      scheduleSfx(ctx, sfxBus, noiseBuf, ev.sfxName, whenAbs, ev.gain ?? 0.4);
    } else if (ev.kind === 'music_note') {
      scheduleMusicNote(ctx, musicBus, ev, whenAbs);
    }
  };

  if (isOffline) {
    // Schedule everything immediately for OfflineAudioContext export
    for (let i = nextEventIdx; i < events.length; i++) {
      const ev = events[i];
      if (ev.time >= totalDuration) break;
      scheduleEventAt(ev, Math.max(0, ev.time - startOffset));
    }
  }

  return {
    schedulerTick: (currentVideoTime: number) => {
      if (isOffline) return;
      const horizon = currentVideoTime + 0.3;
      while (nextEventIdx < events.length && events[nextEventIdx].time <= horizon) {
        const ev = events[nextEventIdx];
        const whenAbs = baseCtxTime + (ev.time - startOffset);
        if (whenAbs >= ctx.currentTime - 0.02) {
          scheduleEventAt(ev, Math.max(ctx.currentTime, whenAbs));
        }
        nextEventIdx++;
      }
    },
    stop: () => {
      for (const n of activeNodes) {
        try {
          n.stop();
        } catch {
          // already stopped
        }
      }
    },
  };
}

/**
 * Renders complete audio mix (voiceover + music + SFX + ambient + compressor) into an AudioBuffer
 * via OfflineAudioContext at targetSampleRate (48000 for MP4, 44100 for MP3).
 */
export async function renderOfflineMixBuffer(params: {
  project: CartoonProject;
  timeline: TimelineSegment[];
  totalDuration: number;
  voiceBuffer: AudioBuffer | null;
  speechStartSec: number;
  leadSec: number;
  envelope: number[];
  pauseCandidates: PauseCandidate[];
  enableBgmAndSfx?: boolean;
  sampleRate?: number;
}): Promise<AudioBuffer> {
  const sampleRate = params.sampleRate ?? 48000;
  const totalSamples = Math.max(sampleRate, Math.ceil(params.totalDuration * sampleRate));
  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

  buildAudioGraph(offline, offline.destination, 0, {
    ...params,
    baseCtxTime: 0,
  });

  return offline.startRendering();
}

/**
 * Exports full mixed audio as 128kbps stereo MP3 using @breezystack/lamejs.
 */
export async function exportMixedMp3(params: {
  project: CartoonProject;
  timeline: TimelineSegment[];
  totalDuration: number;
  voiceBuffer: AudioBuffer | null;
  speechStartSec: number;
  leadSec: number;
  envelope: number[];
  pauseCandidates: PauseCandidate[];
  enableBgmAndSfx?: boolean;
}): Promise<Blob> {
  const sampleRate = 44100;
  const rendered = await renderOfflineMixBuffer({ ...params, sampleRate });

  const leftF32 = rendered.getChannelData(0);
  const rightF32 = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : leftF32;

  const toInt16 = (f32: Float32Array) => {
    const out = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      const s = Math.max(-1, Math.min(1, f32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const left = toInt16(leftF32);
  const right = toInt16(rightF32);

  const pkgAny = lamejsPkg as unknown as {
    Mp3Encoder?: new (ch: number, sr: number, kbps: number) => {
      encodeBuffer: (l: Int16Array, r: Int16Array) => Uint8Array;
      flush: () => Uint8Array;
    };
    default?: {
      Mp3Encoder?: new (ch: number, sr: number, kbps: number) => {
        encodeBuffer: (l: Int16Array, r: Int16Array) => Uint8Array;
        flush: () => Uint8Array;
      };
    };
  };
  const Mp3EncoderCtor = pkgAny.Mp3Encoder || pkgAny.default?.Mp3Encoder;
  if (!Mp3EncoderCtor) {
    throw new Error('ไม่สามารถโหลดตัวเข้ารหัส MP3 (lamejs) ได้');
  }

  const encoder = new Mp3EncoderCtor(2, sampleRate, 128);
  const mp3Parts: Uint8Array[] = [];
  const blockSize = 1152;
  for (let i = 0; i < left.length; i += blockSize) {
    const lChunk = left.subarray(i, i + blockSize);
    const rChunk = right.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(lChunk, rChunk);
    if (mp3buf.length > 0) mp3Parts.push(new Uint8Array(mp3buf));
  }
  const endBuf = encoder.flush();
  if (endBuf.length > 0) mp3Parts.push(new Uint8Array(endBuf));

  return new Blob(mp3Parts as unknown as BlobPart[], { type: 'audio/mpeg' });
}
