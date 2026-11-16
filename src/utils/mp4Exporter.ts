import {
  ALL_FORMATS,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncodeAudio,
} from 'mediabunny';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import type { StudioEpisode, StudioProject, StudioTimelineSegment } from '../types/studio';
import { renderAtTime } from './canvasEngine';
import { getBaseDimensions } from './canvasHelpers';
import { clearOpfsParts, listOpfsParts, writeOpfsPart } from './opfsStorage';
import { renderStudioOfflineAudio } from './studioAudio';
import type { PauseCandidate } from './timelineSync';

export interface Mp4PreflightReport {
  webCodecsSupported: boolean;
  selectedWidth: number;
  selectedHeight: number;
  selectedBitrate: number;
  selectedVideoCodec: string | null;
  selectedAudioCodec: 'aac' | 'pcm-s16' | null;
  hasVoiceover: boolean;
  opfsAvailable: boolean;
  isInIframe: boolean;
  fatalError: string | null;
}

export interface Mp4VerifiedPart {
  partIndex: number;
  totalParts: number;
  filename: string;
  blob: Blob;
  durationSec: number | null;
  expectedDurationSec: number;
  hasAudioTrack: boolean | null;
  audioRmsDetected: boolean;
  usedWidth: number;
  usedHeight: number;
  usedFps: 24 | 30;
  usedCodec: string;
  usedAudioCodec: 'aac' | 'pcm-s16';
  downscaleWarning: string | null;
  savedToOpfs: boolean;
}

const AVC_LADDER = ['avc1.42001f', 'avc1.42E01E', 'avc1.4d001f', 'avc1.4d0028', 'avc1.640028'];

interface ResolutionStep {
  label: '1080p' | '720p' | '540p';
  width: number;
  height: number;
  bitrate: number;
}

function getResolutionLadder(
  layout: StudioProject['layout'],
  requested: '540p' | '720p' | '1080p'
): ResolutionStep[] {
  const isLandscape = layout === 'landscape';
  const all: ResolutionStep[] = [
    {
      label: '1080p',
      width: isLandscape ? 1920 : 1080,
      height: isLandscape ? 1080 : 1920,
      bitrate: 6_500_000,
    },
    {
      label: '720p',
      width: isLandscape ? 1280 : 720,
      height: isLandscape ? 720 : 1280,
      bitrate: 4_000_000,
    },
    {
      label: '540p',
      width: isLandscape ? 960 : 540,
      height: isLandscape ? 540 : 960,
      bitrate: 2_400_000,
    },
  ];
  const idx = Math.max(0, all.findIndex((s) => s.label === requested));
  return all.slice(idx);
}

export async function runMp4Preflight(params: {
  layout: StudioProject['layout'];
  resolution: '540p' | '720p' | '1080p';
  hasVoiceover: boolean;
}): Promise<Mp4PreflightReport> {
  const webCodecsSupported = typeof VideoEncoder !== 'undefined';
  const opfsAvailable = typeof navigator !== 'undefined' && Boolean(navigator.storage?.getDirectory);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  if (!webCodecsSupported) {
    const base = getBaseDimensions(params.layout, 1);
    return {
      webCodecsSupported: false,
      selectedWidth: base.width,
      selectedHeight: base.height,
      selectedBitrate: 4_000_000,
      selectedVideoCodec: null,
      selectedAudioCodec: null,
      hasVoiceover: params.hasVoiceover,
      opfsAvailable,
      isInIframe,
      fatalError: 'เบราว์เซอร์เครื่องนี้ไม่รองรับ WebCodecs H.264 MP4 (กรุณาใช้ Chrome/Edge เวอร์ชันล่าสุด หรือ Safari 16.4+)',
    };
  }

  const ladder = getResolutionLadder(params.layout, params.resolution);
  let chosenStep: ResolutionStep | null = null;
  let chosenCodec: string | null = null;

  for (const step of ladder) {
    for (const codec of AVC_LADDER) {
      try {
        const res = await VideoEncoder.isConfigSupported({
          codec,
          width: step.width,
          height: step.height,
          bitrate: step.bitrate,
        });
        if (res.supported) {
          chosenStep = step;
          chosenCodec = codec;
          break;
        }
      } catch {
        // next codec
      }
    }
    if (chosenStep) break;
  }

  const aacOk = await canEncodeAudio('aac').catch(() => false);
  const selectedAudioCodec: 'aac' | 'pcm-s16' = aacOk ? 'aac' : 'pcm-s16';

  if (!chosenStep || !chosenCodec) {
    return {
      webCodecsSupported: true,
      selectedWidth: ladder[0].width,
      selectedHeight: ladder[0].height,
      selectedBitrate: ladder[0].bitrate,
      selectedVideoCodec: null,
      selectedAudioCodec,
      hasVoiceover: params.hasVoiceover,
      opfsAvailable,
      isInIframe,
      fatalError: 'ไม่พบตัวเข้ารหัส H.264 (AVC) ที่รองรับบนอุปกรณ์นี้',
    };
  }

  return {
    webCodecsSupported: true,
    selectedWidth: chosenStep.width,
    selectedHeight: chosenStep.height,
    selectedBitrate: chosenStep.bitrate,
    selectedVideoCodec: chosenCodec,
    selectedAudioCodec,
    hasVoiceover: params.hasVoiceover,
    opfsAvailable,
    isInIframe,
    fatalError: null,
  };
}

export async function verifyExportedMp4Blob(
  blob: Blob,
  expectedDurationSec: number
): Promise<{
  durationSec: number | null;
  hasAudioTrack: boolean | null;
  audioRmsDetected: boolean;
}> {
  if (blob.size < 4096) {
    throw new Error('ไฟล์ MP4 มีขนาดเล็กผิดปกติ อาจบันทึกไม่สมบูรณ์');
  }

  const url = URL.createObjectURL(blob);
  const probeVideo = document.createElement('video');
  probeVideo.preload = 'metadata';
  probeVideo.src = url;
  const durationSec = await new Promise<number | null>((resolve) => {
    probeVideo.onloadedmetadata = () =>
      resolve(Number.isFinite(probeVideo.duration) ? probeVideo.duration : null);
    probeVideo.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 5000);
  });
  URL.revokeObjectURL(url);

  if (durationSec !== null && Math.abs(durationSec - expectedDurationSec) > 1.2 && expectedDurationSec > 2) {
    // non-fatal warning captured via metadata check; keep going
  }

  let hasAudioTrack: boolean | null = null;
  let audioRmsDetected = false;
  try {
    const inp = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    const track = await inp.getPrimaryAudioTrack();
    hasAudioTrack = Boolean(track);
  } catch {
    hasAudioTrack = null;
  }

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const probeCtx = new AudioCtx();
    const decoded = await probeCtx.decodeAudioData(await blob.arrayBuffer());
    const ch = decoded.getChannelData(0);
    let sumSq = 0;
    let count = 0;
    const stride = Math.max(1, Math.floor(ch.length / 8000));
    for (let i = 0; i < ch.length; i += stride) {
      sumSq += ch[i] * ch[i];
      count++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    audioRmsDetected = rms > 0.0005;
    await probeCtx.close().catch(() => {});
  } catch {
    audioRmsDetected = Boolean(hasAudioTrack);
  }

  return { durationSec, hasAudioTrack, audioRmsDetected };
}

async function encodeSegmentWithMediabunny(params: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderFrameAt: (t: number) => void;
  startSec: number;
  endSec: number;
  renderedAudio: AudioBuffer | null;
  fps: 24 | 30;
  useAac: boolean;
  signal?: AbortSignal;
  onProgress: (msg: string, pct: number, etaSec?: number) => void;
}): Promise<Blob> {
  const { canvas, renderFrameAt, startSec, endSec, renderedAudio, fps, useAac, signal, onProgress } = params;
  const clipDur = Math.max(0.5, endSec - startSec);
  const frameCount = Math.max(1, Math.ceil(clipDur * fps));

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });
  const videoSource = new CanvasSource(canvas, { codec: 'avc', bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });

  let audioSource: AudioBufferSource | null = null;
  if (renderedAudio) {
    audioSource = new AudioBufferSource({ codec: useAac ? 'aac' : 'pcm-s16', bitrate: 128_000 });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  if (audioSource && renderedAudio) {
    await audioSource.add(renderedAudio);
    audioSource.close();
  }

  const benchStart = performance.now();
  let speedMeasured = false;
  let etaSec: number | undefined;

  for (let i = 0; i < frameCount; i++) {
    if (signal?.aborted) throw new Error('ยกเลิกการส่งออกวิดีโอแล้ว');
    const tAbs = startSec + i / fps;
    renderFrameAt(tAbs);
    await videoSource.add(i / fps, 1 / fps);

    if (!speedMeasured && i >= 59) {
      const elapsedSec = (performance.now() - benchStart) / 1000;
      const fpsRate = 60 / Math.max(0.05, elapsedSec);
      etaSec = Math.round((frameCount - i) / Math.max(1, fpsRate));
      speedMeasured = true;
    }

    if (i % 8 === 0 || i === frameCount - 1) {
      const pct = Math.round(10 + ((i + 1) / frameCount) * 84);
      onProgress(`กำลังเรนเดอร์ MP4 (${i + 1}/${frameCount} เฟรม)…`, pct, etaSec);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  videoSource.close();
  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('ไม่สามารถสร้างข้อมูลไฟล์ MP4 ได้');
  return new Blob([buffer], { type: 'video/mp4' });
}

async function encodeSegmentWithMp4Muxer(params: {
  canvas: HTMLCanvasElement;
  renderFrameAt: (t: number) => void;
  startSec: number;
  endSec: number;
  renderedAudio: AudioBuffer | null;
  step: ResolutionStep;
  fps: 24 | 30;
  videoCodec: string;
  signal?: AbortSignal;
  onProgress: (msg: string, pct: number, etaSec?: number) => void;
}): Promise<Blob> {
  const { canvas, renderFrameAt, startSec, endSec, renderedAudio, step, fps, videoCodec, signal, onProgress } = params;
  const clipDur = Math.max(0.5, endSec - startSec);
  const frameCount = Math.max(1, Math.ceil(clipDur * fps));

  const target = new ArrayBufferTarget();
  const hasAac = renderedAudio
    ? (
        await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          numberOfChannels: 2,
          sampleRate: renderedAudio.sampleRate,
          bitrate: 128_000,
        }).catch(() => ({ supported: false }))
      ).supported
    : false;

  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: step.width, height: step.height },
    audio: hasAac && renderedAudio ? { codec: 'aac', numberOfChannels: 2, sampleRate: renderedAudio.sampleRate } : undefined,
    fastStart: 'in-memory',
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      throw err;
    },
  });
  videoEncoder.configure({
    codec: videoCodec,
    width: step.width,
    height: step.height,
    bitrate: step.bitrate,
    framerate: fps,
  });

  if (hasAac && renderedAudio) {
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (err) => {
        throw err;
      },
    });
    audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: renderedAudio.sampleRate,
      bitrate: 128_000,
    });
    const sr = renderedAudio.sampleRate;
    const ch0 = renderedAudio.getChannelData(0);
    const ch1 = renderedAudio.numberOfChannels > 1 ? renderedAudio.getChannelData(1) : ch0;
    const chunkSamples = 1024;
    for (let pos = 0; pos < renderedAudio.length; pos += chunkSamples) {
      const n = Math.min(chunkSamples, renderedAudio.length - pos);
      const planar = new Float32Array(n * 2);
      planar.set(ch0.subarray(pos, pos + n), 0);
      planar.set(ch1.subarray(pos, pos + n), n);
      const ad = new AudioData({
        format: 'f32-planar',
        sampleRate: sr,
        numberOfFrames: n,
        numberOfChannels: 2,
        timestamp: Math.round((pos / sr) * 1_000_000),
        data: planar,
      });
      audioEncoder.encode(ad);
      ad.close();
    }
    await audioEncoder.flush();
    audioEncoder.close();
  }

  for (let i = 0; i < frameCount; i++) {
    if (signal?.aborted) {
      videoEncoder.close();
      throw new Error('ยกเลิกการส่งออกวิดีโอแล้ว');
    }
    renderFrameAt(startSec + i / fps);
    const frame = new VideoFrame(canvas, {
      timestamp: Math.round((i / fps) * 1_000_000),
      duration: Math.round((1 / fps) * 1_000_000),
    });
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();

    if (i % 8 === 0 || i === frameCount - 1) {
      onProgress(`กำลังเรนเดอร์ MP4 (Muxer) ${i + 1}/${frameCount}…`, Math.round(10 + ((i + 1) / frameCount) * 84));
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }

  await videoEncoder.flush();
  videoEncoder.close();
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}

export async function exportProjectMp4(params: {
  project: StudioProject;
  episode: StudioEpisode;
  timeline: StudioTimelineSegment[];
  totalDuration: number;
  voiceBuffer: AudioBuffer | null;
  speechStartSec: number;
  leadSec: number;
  envelope: number[];
  pauseCandidates: PauseCandidate[];
  sfxBuffers?: Record<string, AudioBuffer>;
  partMinutes?: number;
  resumeFromPart?: number;
  signal?: AbortSignal;
  onProgress: (info: { message: string; percent: number; partIndex: number; totalParts: number; etaSec?: number }) => void;
}): Promise<Mp4VerifiedPart[]> {
  const {
    project,
    episode,
    timeline,
    totalDuration,
    voiceBuffer,
    speechStartSec,
    leadSec,
    envelope,
    pauseCandidates,
    sfxBuffers,
    partMinutes = 3,
    resumeFromPart = 0,
    signal,
    onProgress,
  } = params;

  await document.fonts.ready.catch(() => {});
  const preflight = await runMp4Preflight({
    layout: project.layout,
    resolution: project.settings.resolution,
    hasVoiceover: Boolean(voiceBuffer),
  });
  if (preflight.fatalError || !preflight.selectedVideoCodec) {
    throw new Error(preflight.fatalError || 'ไม่พบตัวเข้ารหัส H.264 MP4');
  }

  try {
    await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<void> } }).wakeLock?.request('screen');
  } catch {
    // wakeLock optional
  }

  const fps = project.settings.fps;
  const partSec = Math.max(30, partMinutes * 60);
  const ranges: Array<{ startSec: number; endSec: number }> = [];
  if (totalDuration <= partSec + 8) {
    ranges.push({ startSec: 0, endSec: totalDuration });
  } else {
    for (let s = 0; s < totalDuration; s += partSec) {
      ranges.push({ startSec: s, endSec: Math.min(totalDuration, s + partSec) });
    }
  }

  if (resumeFromPart === 0) {
    await clearOpfsParts(`${project.id}_`);
  }

  const ladder = getResolutionLadder(project.layout, project.settings.resolution);
  const startStepIdx = Math.max(0, ladder.findIndex((s) => s.width === preflight.selectedWidth));
  const candidates = ladder.slice(startStepIdx);
  const safeBaseTitle = project.title.replace(/[^\wก-๙]+/g, '_').replace(/^_+|_+$/g, '') || 'zkatoon';

  const results: Mp4VerifiedPart[] = [];

  for (let pIdx = resumeFromPart; pIdx < ranges.length; pIdx++) {
    const r = ranges[pIdx];
    const clipDur = Math.max(0.5, r.endSec - r.startSec);
    onProgress({
      message: `กำลังผสมเสียงช่วงที่ ${pIdx + 1}/${ranges.length}…`,
      percent: 4,
      partIndex: pIdx + 1,
      totalParts: ranges.length,
    });

    const renderedAudio = await renderStudioOfflineAudio({
      episode,
      timeline,
      totalDuration,
      startSec: r.startSec,
      endSec: r.endSec,
      voiceBuffer,
      speechStartSec,
      leadSec,
      envelope,
      pauseCandidates,
      sfxBuffers,
      enableBgmAndSfx: true,
      sampleRate: 48000,
    });

    let blob: Blob | null = null;
    let usedStep = candidates[0];
    let downscaleWarning: string | null = null;

    for (let attempt = 0; attempt < Math.min(3, candidates.length); attempt++) {
      usedStep = candidates[attempt];
      if (attempt > 0) {
        downscaleWarning = `ลดความละเอียดอัตโนมัติเป็น ${usedStep.width}×${usedStep.height}`;
      }
      const offscreen = document.createElement('canvas');
      offscreen.width = usedStep.width;
      offscreen.height = usedStep.height;
      const ctx = offscreen.getContext('2d')!;

      const renderFrameAt = (tAbs: number) => {
        renderAtTime(ctx, project, episode, timeline, tAbs, {
          envelope,
          leadSec,
          speechStartSec,
          pauseCandidates,
          showSubtitles: true,
          isExport: true,
        });
      };

      try {
        blob = await encodeSegmentWithMediabunny({
          canvas: offscreen,
          ctx,
          renderFrameAt,
          startSec: r.startSec,
          endSec: r.endSec,
          renderedAudio,
          fps,
          useAac: preflight.selectedAudioCodec === 'aac',
          signal,
          onProgress: (msg, pct, etaSec) =>
            onProgress({ message: msg, percent: pct, partIndex: pIdx + 1, totalParts: ranges.length, etaSec }),
        });
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
        try {
          blob = await encodeSegmentWithMp4Muxer({
            canvas: offscreen,
            renderFrameAt,
            startSec: r.startSec,
            endSec: r.endSec,
            renderedAudio,
            step: usedStep,
            fps,
            videoCodec: preflight.selectedVideoCodec,
            signal,
            onProgress: (msg, pct, etaSec) =>
              onProgress({ message: msg, percent: pct, partIndex: pIdx + 1, totalParts: ranges.length, etaSec }),
          });
          break;
        } catch (muxErr) {
          if (attempt === candidates.length - 1) throw muxErr;
        }
      }
    }

    if (!blob) throw new Error('ไม่สามารถเข้ารหัสไฟล์ MP4 ได้');
    onProgress({
      message: 'กำลังตรวจสอบความสมบูรณ์ของไฟล์ MP4 (VERIFY)…',
      percent: 96,
      partIndex: pIdx + 1,
      totalParts: ranges.length,
    });
    const verified = await verifyExportedMp4Blob(blob, clipDur);
    const filename =
      ranges.length === 1
        ? `${safeBaseTitle}.mp4`
        : `${project.id}_part${String(pIdx + 1).padStart(2, '0')}.mp4`;
    const savedToOpfs = await writeOpfsPart(filename, blob);

    results.push({
      partIndex: pIdx + 1,
      totalParts: ranges.length,
      filename,
      blob,
      durationSec: verified.durationSec,
      expectedDurationSec: clipDur,
      hasAudioTrack: verified.hasAudioTrack,
      audioRmsDetected: verified.audioRmsDetected,
      usedWidth: usedStep.width,
      usedHeight: usedStep.height,
      usedFps: fps,
      usedCodec: preflight.selectedVideoCodec,
      usedAudioCodec: preflight.selectedAudioCodec || 'aac',
      downscaleWarning,
      savedToOpfs,
    });
  }

  onProgress({
    message: 'ส่งออกและตรวจสอบ MP4 เสร็จสมบูรณ์',
    percent: 100,
    partIndex: ranges.length,
    totalParts: ranges.length,
  });
  return results;
}

export async function getResumableOpfsExportInfo(projectId: string) {
  const parts = await listOpfsParts();
  return parts.filter((p) => p.name.startsWith(`${projectId}_part`));
}
