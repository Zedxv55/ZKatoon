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
import type { CartoonProject, PauseCandidate, TimelineSegment } from '../types/cartoon';
import { renderOfflineMixBuffer } from './audioEngine';
import { CANVAS_H, CANVAS_W, renderCartoonFrame } from './canvasRenderer';

export interface ExportPreflightStatus {
  hasVoiceover: boolean;
  audioCtxRunning: boolean;
  webCodecsSupported: boolean;
  selectedWidth: number;
  selectedHeight: number;
  selectedScale: number;
  selectedBitrate: number;
  selectedVideoCodec: string | null;
  selectedAudioCodec: 'aac' | 'pcm-s16' | null;
  libraryName: 'mediabunny' | 'mp4-muxer';
  fatalError: string | null;
}

export interface VideoExportResult {
  blob: Blob;
  mimeType: string;
  ext: 'mp4';
  durationSec: number | null;
  hasAudioTrack: boolean | null;
  audioVerifiedStatus: 'detected' | 'silent' | 'unverifiable';
  usedScale: number;
  usedWidth: number;
  usedHeight: number;
  usedCodec: string;
  usedAudioCodec: 'aac' | 'pcm-s16';
  downscaleWarning: string | null;
}

const AVC_LADDER = ['avc1.42001f', 'avc1.42E01E', 'avc1.4d001f', 'avc1.4d0028', 'avc1.640028'];

interface ResStep {
  scale: number;
  width: number;
  height: number;
  bitrate: number;
}

function getResolutionLadder(want1080: boolean): ResStep[] {
  const steps: ResStep[] = [];
  if (want1080) {
    steps.push({ scale: 1.5, width: 1080, height: 1920, bitrate: 6_000_000 });
  }
  steps.push({ scale: 1, width: 720, height: 1280, bitrate: 4_000_000 });
  steps.push({ scale: 0.75, width: 540, height: 960, bitrate: 2_500_000 });
  return steps;
}

export async function runExportPreflight(params: {
  hasVoiceover: boolean;
  audioCtxState?: AudioContextState;
  want1080: boolean;
}): Promise<ExportPreflightStatus> {
  const webCodecsSupported = typeof VideoEncoder !== 'undefined';
  const audioCtxRunning = params.audioCtxState === 'running';

  if (!webCodecsSupported) {
    return {
      hasVoiceover: params.hasVoiceover,
      audioCtxRunning,
      webCodecsSupported: false,
      selectedWidth: 720,
      selectedHeight: 1280,
      selectedScale: 1,
      selectedBitrate: 4_000_000,
      selectedVideoCodec: null,
      selectedAudioCodec: null,
      libraryName: 'mediabunny',
      fatalError:
        'เบราว์เซอร์เครื่องนี้ยังสร้างไฟล์ MP4 ไม่ได้ กรุณาอัปเดตเบราว์เซอร์ (Chrome/Safari รุ่นใหม่ล่าสุด) หรือเปิดด้วยเครื่องที่ใหม่กว่า',
    };
  }

  const ladder = getResolutionLadder(params.want1080);
  let chosenStep: ResStep | null = null;
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
        // try next
      }
    }
    if (chosenStep) break;
  }

  const aacOk = await canEncodeAudio('aac').catch(() => false);
  const selectedAudioCodec: 'aac' | 'pcm-s16' = aacOk ? 'aac' : 'pcm-s16';

  if (!chosenStep || !chosenCodec) {
    return {
      hasVoiceover: params.hasVoiceover,
      audioCtxRunning,
      webCodecsSupported: true,
      selectedWidth: 720,
      selectedHeight: 1280,
      selectedScale: 1,
      selectedBitrate: 4_000_000,
      selectedVideoCodec: null,
      selectedAudioCodec,
      libraryName: 'mediabunny',
      fatalError: 'ไม่พบตัวเข้ารหัส H.264 (AVC) ที่รองรับบนเครื่องนี้ สำหรับสร้าง MP4',
    };
  }

  return {
    hasVoiceover: params.hasVoiceover,
    audioCtxRunning,
    webCodecsSupported: true,
    selectedWidth: chosenStep.width,
    selectedHeight: chosenStep.height,
    selectedScale: chosenStep.scale,
    selectedBitrate: chosenStep.bitrate,
    selectedVideoCodec: chosenCodec,
    selectedAudioCodec,
    libraryName: 'mediabunny',
    fatalError: null,
  };
}

async function encodeWithMediabunny(params: {
  offscreen: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  project: CartoonProject;
  timeline: TimelineSegment[];
  totalDuration: number;
  envelope: number[];
  leadSec: number;
  speechStartSec: number;
  pauseCandidates: PauseCandidate[];
  subtitleScale: 'normal' | 'large';
  cineEnabled: boolean;
  renderedAudio: AudioBuffer | null;
  step: ResStep;
  useAac: boolean;
  signal?: AbortSignal;
  onProgress: (message: string, percent: number) => void;
}): Promise<Blob> {
  const {
    offscreen,
    ctx,
    project,
    timeline,
    totalDuration,
    envelope,
    leadSec,
    speechStartSec,
    pauseCandidates,
    subtitleScale,
    cineEnabled,
    renderedAudio,
    step,
    useAac,
    signal,
    onProgress,
  } = params;

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(offscreen, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource, { frameRate: 30 });

  let audioSource: AudioBufferSource | null = null;
  if (renderedAudio) {
    audioSource = new AudioBufferSource({
      codec: useAac ? 'aac' : 'pcm-s16',
      bitrate: 128_000,
    });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  if (audioSource && renderedAudio) {
    await audioSource.add(renderedAudio);
    audioSource.close();
  }

  const fps = 30;
  const frameCount = Math.max(1, Math.ceil(totalDuration * fps));
  for (let i = 0; i < frameCount; i++) {
    if (signal?.aborted) {
      throw new Error('ยกเลิกการสร้างวิดีโอแล้ว');
    }
    renderCartoonFrame(ctx, project, timeline, i / fps, {
      envelope,
      leadSec,
      speechStartSec,
      scale: step.scale,
      subtitleScale,
      pauseCandidates,
      cineEnabled,
    });
    await videoSource.add(i / fps, 1 / fps);
    if (i % 10 === 0 || i === frameCount - 1) {
      onProgress(
        `กำลังเรนเดอร์ MP4 ${step.width}×${step.height} (${i + 1}/${frameCount} เฟรม)…`,
        Math.round(12 + ((i + 1) / frameCount) * 82)
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  videoSource.close();
  await output.finalize();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error('ไม่สามารถสร้างบัฟเฟอร์ไฟล์ MP4 ได้');
  return new Blob([buffer], { type: 'video/mp4' });
}

async function encodeWithMp4Muxer(params: {
  offscreen: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  project: CartoonProject;
  timeline: TimelineSegment[];
  totalDuration: number;
  envelope: number[];
  leadSec: number;
  speechStartSec: number;
  pauseCandidates: PauseCandidate[];
  subtitleScale: 'normal' | 'large';
  cineEnabled: boolean;
  renderedAudio: AudioBuffer | null;
  step: ResStep;
  videoCodec: string;
  signal?: AbortSignal;
  onProgress: (message: string, percent: number) => void;
}): Promise<Blob> {
  const {
    offscreen,
    ctx,
    project,
    timeline,
    totalDuration,
    envelope,
    leadSec,
    speechStartSec,
    pauseCandidates,
    subtitleScale,
    cineEnabled,
    renderedAudio,
    step,
    videoCodec,
    signal,
    onProgress,
  } = params;

  const target = new ArrayBufferTarget();
  const hasAac = renderedAudio
    ? (await AudioEncoder.isConfigSupported({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate: renderedAudio.sampleRate,
        bitrate: 128_000,
      }).catch(() => ({ supported: false }))).supported
    : false;

  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: step.width, height: step.height },
    audio: hasAac && renderedAudio
      ? { codec: 'aac', numberOfChannels: 2, sampleRate: renderedAudio.sampleRate }
      : undefined,
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
    framerate: 30,
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

  const fps = 30;
  const frameCount = Math.max(1, Math.ceil(totalDuration * fps));
  for (let i = 0; i < frameCount; i++) {
    if (signal?.aborted) {
      videoEncoder.close();
      throw new Error('ยกเลิกการสร้างวิดีโอแล้ว');
    }
    renderCartoonFrame(ctx, project, timeline, i / fps, {
      envelope,
      leadSec,
      speechStartSec,
      scale: step.scale,
      subtitleScale,
      pauseCandidates,
      cineEnabled,
    });
    const frame = new VideoFrame(offscreen, {
      timestamp: Math.round((i / fps) * 1_000_000),
      duration: Math.round((1 / fps) * 1_000_000),
    });
    videoEncoder.encode(frame, { keyFrame: i % 60 === 0 });
    frame.close();
    if (i % 10 === 0 || i === frameCount - 1) {
      onProgress(
        `กำลังเรนเดอร์ MP4 สำรอง (${i + 1}/${frameCount} เฟรม)…`,
        Math.round(12 + ((i + 1) / frameCount) * 82)
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  await videoEncoder.flush();
  videoEncoder.close();
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}

export async function exportCartoonVideo(params: {
  project: CartoonProject;
  timeline: TimelineSegment[];
  totalDuration: number;
  envelope: number[];
  leadSec: number;
  speechStartSec: number;
  pauseCandidates: PauseCandidate[];
  voiceBuffer: AudioBuffer | null;
  enableBgmAndSfx: boolean;
  cineEnabled: boolean;
  want1080: boolean;
  subtitleScale: 'normal' | 'large';
  signal?: AbortSignal;
  onProgress: (message: string, percent: number) => void;
}): Promise<VideoExportResult> {
  const {
    project,
    timeline,
    totalDuration,
    envelope,
    leadSec,
    speechStartSec,
    pauseCandidates,
    voiceBuffer,
    enableBgmAndSfx,
    cineEnabled,
    want1080,
    subtitleScale,
    signal,
    onProgress,
  } = params;

  await document.fonts.ready.catch(() => {});
  await document.fonts.load('800 40px Prompt').catch(() => {});

  const preflight = await runExportPreflight({
    hasVoiceover: Boolean(voiceBuffer),
    audioCtxState: 'running',
    want1080,
  });
  if (preflight.fatalError || !preflight.selectedVideoCodec) {
    throw new Error(preflight.fatalError || 'เบราว์เซอร์ไม่รองรับ WebCodecs H.264 สำหรับ MP4');
  }

  try {
    await (
      navigator as unknown as { wakeLock?: { request: (t: string) => Promise<void> } }
    ).wakeLock?.request('screen');
  } catch {
    // optional
  }

  onProgress('กำลังผสมเสียงพากย์ เพลง และ SFX ด้วย OfflineAudioContext…', 6);
  const renderedAudio =
    voiceBuffer || enableBgmAndSfx
      ? await renderOfflineMixBuffer({
          project,
          timeline,
          totalDuration,
          voiceBuffer,
          speechStartSec,
          leadSec,
          envelope,
          pauseCandidates,
          enableBgmAndSfx,
          sampleRate: 48000,
        })
      : null;

  const fullLadder = getResolutionLadder(want1080);
  const startIdx = Math.max(
    0,
    fullLadder.findIndex((s) => s.width === preflight.selectedWidth)
  );
  const candidates = fullLadder.slice(startIdx);

  let finalBlob: Blob | null = null;
  let usedStep = candidates[0];
  let downscaleWarning: string | null = null;

  for (let attempt = 0; attempt < Math.min(3, candidates.length); attempt++) {
    usedStep = candidates[attempt];
    if (attempt > 0) {
      downscaleWarning = `ลดความละเอียดลงเป็น ${usedStep.width}×${usedStep.height} เนื่องจากหน่วยความจำหรือตัวเข้ารหัสไม่พอ`;
      onProgress(downscaleWarning, 10);
    }

    const offscreen = document.createElement('canvas');
    offscreen.width = usedStep.width;
    offscreen.height = usedStep.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

    try {
      finalBlob = await encodeWithMediabunny({
        offscreen,
        ctx,
        project,
        timeline,
        totalDuration,
        envelope,
        leadSec,
        speechStartSec,
        pauseCandidates,
        subtitleScale,
        cineEnabled,
        renderedAudio,
        step: usedStep,
        useAac: preflight.selectedAudioCodec === 'aac',
        signal,
        onProgress,
      });
      break;
    } catch (err) {
      if (signal?.aborted) throw err;
      // Try mp4-muxer fallback at this resolution before downscaling
      try {
        finalBlob = await encodeWithMp4Muxer({
          offscreen,
          ctx,
          project,
          timeline,
          totalDuration,
          envelope,
          leadSec,
          speechStartSec,
          pauseCandidates,
          subtitleScale,
          cineEnabled,
          renderedAudio,
          step: usedStep,
          videoCodec: preflight.selectedVideoCodec,
          signal,
          onProgress,
        });
        break;
      } catch (muxErr) {
        if (attempt === candidates.length - 1) {
          throw muxErr;
        }
      }
    }
  }

  if (!finalBlob) {
    throw new Error('ไม่สามารถสร้างไฟล์ MP4 ได้');
  }

  // VERIFY Step: inspect duration via hidden <video> and check audio track / RMS
  onProgress('กำลังตรวจสอบไฟล์ MP4 และเสียงในไฟล์ (VERIFY)…', 96);
  const url = URL.createObjectURL(finalBlob);
  const probeVideo = document.createElement('video');
  probeVideo.preload = 'metadata';
  probeVideo.src = url;
  const durationSec = await new Promise<number | null>((resolve) => {
    probeVideo.onloadedmetadata = () => resolve(Number.isFinite(probeVideo.duration) ? probeVideo.duration : null);
    setTimeout(() => resolve(null), 6000);
  });
  URL.revokeObjectURL(url);

  let hasAudioTrack: boolean | null = null;
  let audioVerifiedStatus: VideoExportResult['audioVerifiedStatus'] = 'unverifiable';

  try {
    const inp = new Input({ formats: ALL_FORMATS, source: new BlobSource(finalBlob) });
    const track = await inp.getPrimaryAudioTrack();
    hasAudioTrack = Boolean(track);
  } catch {
    hasAudioTrack = null;
  }

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const probeCtx = new AudioCtx();
    const decoded = await probeCtx.decodeAudioData(await finalBlob.arrayBuffer());
    const ch = decoded.getChannelData(0);
    let sumSq = 0;
    const stride = Math.max(1, Math.floor(ch.length / 8000));
    let count = 0;
    for (let i = 0; i < ch.length; i += stride) {
      sumSq += ch[i] * ch[i];
      count++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, count));
    await probeCtx.close().catch(() => {});
    audioVerifiedStatus = rms > 0.0005 ? 'detected' : 'silent';
  } catch {
    audioVerifiedStatus = hasAudioTrack ? 'detected' : 'unverifiable';
  }

  onProgress('สร้างและตรวจสอบไฟล์ MP4 เสร็จสมบูรณ์', 100);
  return {
    blob: finalBlob,
    mimeType: 'video/mp4',
    ext: 'mp4',
    durationSec,
    hasAudioTrack,
    audioVerifiedStatus,
    usedScale: usedStep.scale,
    usedWidth: usedStep.width,
    usedHeight: usedStep.height,
    usedCodec: preflight.selectedVideoCodec,
    usedAudioCodec: preflight.selectedAudioCodec || 'aac',
    downscaleWarning,
  };
}
