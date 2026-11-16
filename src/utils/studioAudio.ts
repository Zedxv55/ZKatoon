import * as lamejsPkg from '@breezystack/lamejs';
import type {
  AmbientTypeId,
  EpisodeMusic,
  SfxTypeId,
  StudioEpisode,
  StudioTimelineSegment,
} from '../types/studio';
import { analyzeAudioEnvelope, resolveAtTextLocalSec } from './timelineSync';
import type { PauseCandidate } from './timelineSync';

export interface ScheduledStudioAudioEvent {
  time: number;
  kind: 'sfx' | 'music_note';
  sfxName?: SfxTypeId;
  sfxAssetId?: string;
  gain?: number;
  freq?: number;
  dur?: number;
  voiceType?: 'bass' | 'chord' | 'arp';
  musicGain?: number;
}

const KEY_ROOT_MIDI: Record<EpisodeMusic['key'], number> = {
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

function getScaleIntervals(mode: EpisodeMusic['mode']): number[] {
  return mode === 'minor' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
}

function createNoiseBuffer(ctx: BaseAudioContext, seconds = 2.5): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 1337;
  for (let i = 0; i < len; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    data[i] = (seed / 4294967296) * 2 - 1;
  }
  return buf;
}

export function scheduleProceduralSfx(
  ctx: BaseAudioContext,
  dest: AudioNode,
  noiseBuf: AudioBuffer,
  name: SfxTypeId,
  when: number,
  volume = 0.4
): void {
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
      const freqs =
        name === 'coin' ? [987.77, 1318.51] : name === 'sparkle' ? [1046.5, 1318.5, 1567.98] : [880, 1320];
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
      osc.frequency.setValueAtTime(name === 'pop' ? 320 : name === 'typing' ? 1200 : 800, when);
      osc.frequency.exponentialRampToValueAtTime(name === 'pop' ? 760 : 280, when + 0.06);
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
      [0, 0.22].forEach((off, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 72 : 60, when + off);
        osc.frequency.exponentialRampToValueAtTime(35, when + off + 0.14);
        g.gain.setValueAtTime(0.65, when + off);
        g.gain.exponentialRampToValueAtTime(0.001, when + off + 0.18);
        osc.connect(g).connect(out);
        osc.start(when + off);
        osc.stop(when + off + 0.2);
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

function scheduleMusicNote(ctx: BaseAudioContext, dest: AudioNode, ev: ScheduledStudioAudioEvent, when: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = ev.voiceType === 'bass' ? 'triangle' : 'sine';
  osc.frequency.setValueAtTime(ev.freq ?? 261.63, when);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(ev.musicGain ?? 0.2, when + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, when + (ev.dur ?? 0.4));
  osc.connect(g).connect(dest);
  osc.start(when);
  osc.stop(when + (ev.dur ?? 0.4) + 0.04);
}

export function collectStudioAudioEvents(
  episode: StudioEpisode,
  timeline: StudioTimelineSegment[],
  totalDuration: number,
  pauseCandidates: PauseCandidate[],
  leadSec: number,
  enableBgmAndSfx = true
): ScheduledStudioAudioEvent[] {
  if (!enableBgmAndSfx) return [];
  const events: ScheduledStudioAudioEvent[] = [];

  timeline.forEach((seg, idx) => {
    const speechDur = Math.max(0.4, seg.speechEndSec - seg.startSec);
    const relSpeech = Math.max(0, seg.startSec - leadSec);
    for (const cue of seg.scene.sfx || []) {
      const localOff = cue.atText
        ? resolveAtTextLocalSec(seg.scene.narration, cue.atText, speechDur, relSpeech, pauseCandidates)
        : idx === 0
          ? 0.08
          : 0.14;
      events.push({
        time: Math.max(0, seg.startSec + localOff),
        kind: 'sfx',
        sfxName: cue.name,
        sfxAssetId: cue.assetId,
        gain: cue.vol ?? 0.4,
      });
    }
  });

  const music = episode.music || { mood: 'calm', bpm: 88, key: 'C', mode: 'major', swells: [], quietScenes: [], endStyle: 'resolve' };
  const bpm = Math.max(55, Math.min(150, music.bpm || 88));
  const beatSec = 60 / bpm;
  const rootMidi = KEY_ROOT_MIDI[music.key] ?? 60;
  const scale = getScaleIntervals(music.mode || 'major');
  const prog =
    music.mood === 'tense' || music.mood === 'mystery'
      ? [0, 3, 4, 0]
      : music.mood === 'sad'
        ? [0, 5, 3, 4]
        : [0, 4, 5, 3];

  let step = 0;
  for (let t = 0; t < totalDuration - 0.15; t += beatSec) {
    const activeSeg = timeline.find((s) => t >= s.startSec && t < s.endSec);
    const sceneNum = (activeSeg?.index ?? 0) + 1;
    const isQuiet = music.quietScenes?.includes(sceneNum);
    const isSwell = music.swells?.includes(sceneNum);
    const dynMult = isQuiet ? 0.35 : isSwell ? 1.45 : 1;

    const barIdx = Math.floor(step / 4) % prog.length;
    const deg = prog[barIdx];
    const chordRoot = rootMidi + scale[deg % scale.length];
    const beatInBar = step % 4;

    if (beatInBar === 0) {
      events.push({
        time: t,
        kind: 'music_note',
        voiceType: 'bass',
        freq: midiToFreq(chordRoot - 12),
        dur: beatSec * 1.8,
        musicGain: 0.3 * dynMult,
      });
      [0, 2, 4].forEach((offIdx) => {
        const interval = scale[(deg + offIdx) % scale.length];
        events.push({
          time: t,
          kind: 'music_note',
          voiceType: 'chord',
          freq: midiToFreq(rootMidi + interval),
          dur: beatSec * 3.4,
          musicGain: 0.15 * dynMult,
        });
      });
    }

    if (music.mood !== 'tense' || beatInBar % 2 === 0) {
      const arpDeg = (deg + (beatInBar % 3) * 2) % scale.length;
      events.push({
        time: t,
        kind: 'music_note',
        voiceType: 'arp',
        freq: midiToFreq(rootMidi + 12 + scale[arpDeg]),
        dur: beatSec * 0.85,
        musicGain: 0.12 * dynMult,
      });
    }
    step++;
  }

  return events.sort((a, b) => a.time - b.time);
}

export interface StudioAudioGraphHandle {
  schedulerTick: (currentVideoTime: number) => void;
  stop: () => void;
}

export function buildStudioAudioGraph(
  ctx: BaseAudioContext,
  destinationNode: AudioNode,
  startOffset: number,
  options: {
    episode: StudioEpisode;
    timeline: StudioTimelineSegment[];
    totalDuration: number;
    voiceBuffer: AudioBuffer | null;
    speechStartSec: number;
    leadSec: number;
    envelope: number[];
    pauseCandidates: PauseCandidate[];
    sfxBuffers?: Record<string, AudioBuffer>;
    enableBgmAndSfx?: boolean;
    baseCtxTime?: number;
    clipEndSec?: number;
  }
): StudioAudioGraphHandle {
  const {
    episode,
    timeline,
    totalDuration,
    voiceBuffer,
    speechStartSec,
    leadSec,
    envelope,
    pauseCandidates,
    sfxBuffers = {},
    enableBgmAndSfx = true,
    baseCtxTime = 0,
    clipEndSec = totalDuration,
  } = options;

  const isOffline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const activeNodes: AudioScheduledSourceNode[] = [];

  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -8;
  compressor.knee.value = 12;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.12;
  compressor.connect(destinationNode);

  const voiceGain = ctx.createGain();
  voiceGain.gain.value = 1.0;
  voiceGain.connect(compressor);

  if (voiceBuffer) {
    const src = ctx.createBufferSource();
    src.buffer = voiceBuffer;
    src.connect(voiceGain);
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

  const musicBus = ctx.createGain();
  musicBus.gain.value = voiceBuffer ? 0.1 : 0.14;
  musicBus.connect(compressor);

  if (enableBgmAndSfx && voiceBuffer && envelope.length > 0) {
    try {
      let lastState = false;
      musicBus.gain.setValueAtTime(0.14, baseCtxTime);
      for (let t = Math.max(0, startOffset); t < clipEndSec; t += 0.12) {
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
  sfxBus.gain.value = 0.45;
  sfxBus.connect(compressor);

  const noiseBuf = createNoiseBuffer(ctx, 2.5);

  if (enableBgmAndSfx) {
    const dominantAmb: AmbientTypeId =
      timeline.find((seg) => seg.scene.ambient && seg.scene.ambient !== 'none')?.scene.ambient || 'none';
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
      const remaining = Math.max(0.1, clipEndSec - startOffset);
      src.start(baseCtxTime);
      src.stop(baseCtxTime + remaining);
      activeNodes.push(src);
    }
  }

  const events = collectStudioAudioEvents(episode, timeline, totalDuration, pauseCandidates, leadSec, enableBgmAndSfx);
  let nextEventIdx = events.findIndex((ev) => ev.time >= startOffset - 0.02);
  if (nextEventIdx < 0) nextEventIdx = events.length;

  const scheduleEventAt = (ev: ScheduledStudioAudioEvent, whenAbs: number) => {
    if (ev.kind === 'sfx') {
      if (ev.sfxAssetId && sfxBuffers[ev.sfxAssetId]) {
        const src = ctx.createBufferSource();
        src.buffer = sfxBuffers[ev.sfxAssetId];
        const g = ctx.createGain();
        g.gain.value = ev.gain ?? 0.55;
        src.connect(g).connect(sfxBus);
        src.start(whenAbs);
        activeNodes.push(src);
      } else if (ev.sfxName) {
        scheduleProceduralSfx(ctx, sfxBus, noiseBuf, ev.sfxName, whenAbs, ev.gain ?? 0.4);
      }
    } else if (ev.kind === 'music_note') {
      scheduleMusicNote(ctx, musicBus, ev, whenAbs);
    }
  };

  if (isOffline) {
    for (let i = nextEventIdx; i < events.length; i++) {
      const ev = events[i];
      if (ev.time >= clipEndSec) break;
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

export async function renderStudioOfflineAudio(params: {
  episode: StudioEpisode;
  timeline: StudioTimelineSegment[];
  totalDuration: number;
  startSec?: number;
  endSec?: number;
  voiceBuffer: AudioBuffer | null;
  speechStartSec: number;
  leadSec: number;
  envelope: number[];
  pauseCandidates: PauseCandidate[];
  sfxBuffers?: Record<string, AudioBuffer>;
  enableBgmAndSfx?: boolean;
  sampleRate?: number;
}): Promise<AudioBuffer> {
  const sr = params.sampleRate ?? 48000;
  const startSec = params.startSec ?? 0;
  const endSec = params.endSec ?? params.totalDuration;
  const clipDur = Math.max(0.5, endSec - startSec);
  const totalSamples = Math.max(sr, Math.ceil(clipDur * sr));
  const offline = new OfflineAudioContext(2, totalSamples, sr);

  buildStudioAudioGraph(offline, offline.destination, startSec, {
    episode: params.episode,
    timeline: params.timeline,
    totalDuration: params.totalDuration,
    voiceBuffer: params.voiceBuffer,
    speechStartSec: params.speechStartSec,
    leadSec: params.leadSec,
    envelope: params.envelope,
    pauseCandidates: params.pauseCandidates,
    sfxBuffers: params.sfxBuffers,
    enableBgmAndSfx: params.enableBgmAndSfx,
    baseCtxTime: 0,
    clipEndSec: endSec,
  });

  return offline.startRendering();
}

export async function exportStudioMp3(params: {
  episode: StudioEpisode;
  timeline: StudioTimelineSegment[];
  totalDuration: number;
  voiceBuffer: AudioBuffer | null;
  speechStartSec: number;
  leadSec: number;
  envelope: number[];
  pauseCandidates: PauseCandidate[];
  sfxBuffers?: Record<string, AudioBuffer>;
  enableBgmAndSfx?: boolean;
}): Promise<Blob> {
  const sampleRate = 44100;
  const rendered = await renderStudioOfflineAudio({ ...params, sampleRate });

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
    throw new Error('ไม่สามารถโหลดตัวเข้ารหัส MP3 (@breezystack/lamejs) ได้');
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

export async function mergePerSceneVoiceBlobs(
  ctx: AudioContext,
  scenes: StudioEpisode['scenes'],
  blobsBySceneId: Record<string, Blob>,
  leadSec = 0.35
): Promise<{
  voiceBuffer: AudioBuffer | null;
  envelope: number[];
  pauseCandidates: PauseCandidate[];
  perSceneDurations: Record<string, number>;
  decodedCount: number;
  failedSceneIds: string[];
}> {
  const sampleRate = ctx.sampleRate || 44100;
  const decoded: Array<AudioBuffer | null> = [];
  const perSceneDurations: Record<string, number> = {};
  const failedSceneIds: string[] = [];
  let decodedCount = 0;

  for (const sc of scenes) {
    const blob = blobsBySceneId[sc.id];
    if (!blob || blob.size === 0) {
      decoded.push(null);
      perSceneDurations[sc.id] = sc.audio?.durationSec || Math.max(2.0, sc.narration.length / 11);
      continue;
    }
    try {
      const ab = await blob.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab.slice(0));
      decoded.push(buf);
      perSceneDurations[sc.id] = buf.duration;
      decodedCount++;
    } catch {
      decoded.push(null);
      perSceneDurations[sc.id] = sc.audio?.durationSec || Math.max(2.0, sc.narration.length / 11);
      failedSceneIds.push(sc.id);
    }
  }

  if (decodedCount === 0) {
    return {
      voiceBuffer: null,
      envelope: [],
      pauseCandidates: [],
      perSceneDurations,
      decodedCount: 0,
      failedSceneIds,
    };
  }

  let totalSec = 0;
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const hold = sc.holdAfter ?? (i === scenes.length - 1 ? 2.5 : 0.3);
    totalSec += Math.max(1.0, perSceneDurations[sc.id] + (sc.syncOffset ?? 0)) + hold;
  }

  const totalSamples = Math.max(sampleRate, Math.ceil((totalSec + leadSec) * sampleRate));
  const outBuf = ctx.createBuffer(1, totalSamples, sampleRate);
  const outCh = outBuf.getChannelData(0);

  let cursorSec = 0;
  const fadeSamples = Math.min(Math.floor(0.03 * sampleRate), 1200);
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const buf = decoded[i];
    if (buf) {
      const startSample = Math.floor(cursorSec * sampleRate);
      const srcCh = buf.getChannelData(0);
      for (let s = 0; s < srcCh.length && startSample + s < outCh.length; s++) {
        let gain = 1;
        if (s < fadeSamples) gain = s / fadeSamples;
        else if (srcCh.length - s < fadeSamples) gain = (srcCh.length - s) / fadeSamples;
        outCh[startSample + s] += srcCh[s] * gain;
      }
    }
    const hold = sc.holdAfter ?? (i === scenes.length - 1 ? 2.5 : 0.3);
    cursorSec += Math.max(1.0, perSceneDurations[sc.id] + (sc.syncOffset ?? 0)) + hold;
  }

  const env = analyzeAudioEnvelope(outCh, sampleRate);
  return {
    voiceBuffer: outBuf,
    envelope: env.envelope,
    pauseCandidates: env.pauseCandidates,
    perSceneDurations,
    decodedCount,
    failedSceneIds,
  };
}
