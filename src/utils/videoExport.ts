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
import { ThreeSceneStage } from '../engine3d/ThreeSceneStage';
import type {
  CartoonProject,
  ExportFps,
  PauseCandidate,
  PerformancePreset,
  SceneAudioRecord,
  TimelineSegment,
} from '../types/cartoon';
import { renderOfflineMixBuffer } from './audioEngine';
import { renderCartoonFrame } from './canvasRenderer';

export interface ExportPreflightStatus {
  hasVoiceover: boolean;
  audioCtxRunning: boolean;
  webCodecsSupported: boolean;
  webmSupported: boolean;
  selectedWidth: number;
  selectedHeight: number;
  selectedScale: number;
  selectedBitrate: number;
  selectedVideoCodec: string | null;
  selectedAudioCodec: 'aac' | 'pcm-s16' | null;
  libraryName: 'mediabunny' | 'mp4-muxer' | 'webm-mediarecorder';
  fatalError: string | null;
}

export interface VideoExportResult {
  blob: Blob;
  mimeType: string;
  ext: 'mp4' | 'webm';
  durationSec: number | null;
  hasAudioTrack: boolean | null;
  audioVerifiedStatus: 'detected' | 'silent' | 'unverifiable';
  usedScale: number;
  usedWidth: number;
  usedHeight: number;
  usedFps: ExportFps;
  usedCodec: string;
  usedAudioCodec: 'aac' | 'pcm-s16' | 'opus';
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
    steps.push({ scale: 1.5, width: 1080, height: 1920, bitrate: 6_500_000 });
  }
  steps.push({ scale: 1, width: 720, height: 1280, bitrate: 4_000_000 });
  steps.push({ scale: 0.75, width: 540, height: 960, bitrate: 2_400_000 });
  return steps;
}

export async function runExportPreflight(params: {
  hasVoiceover: boolean;
  audioCtxState?: AudioContextState;
  want1080: boolean;
}): Promise<ExportPreflightStatus> {
  const webCodecsSupported = typeof VideoEncoder !== 'undefined';
  const audioCtxRunning = params.audioCtxState === 'running';
  const webmSupported =
    typeof MediaRecorder !== 'undefined' &&
    (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ||
      MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ||
      MediaRecorder.isTypeSupported('video/webm'));

  if (!webCodecsSupported) {
    return {
      hasVoiceover: params.hasVoiceover,
      audioCtxRunning,
      webCodecsSupported: false,
      webmSupported,
      selectedWidth: 720,
      selectedHeight: 1280,
      selectedScale: 1,
      selectedBitrate: 4_000_000,
      selectedVideoCodec: null,
      selectedAudioCodec: null,
      libraryName: webmSupported ? 'webm-mediarecorder' : 'mediabunny',
      fatalError: webmSupported
        ? null
        : 'เบราว์เซอร์เครื่องนี้ไม่รองรับทั้ง WebCodecs MP4 และ MediaRecorder WebM',
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
        // next
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
      webmSupported,
      selectedWidth: 720,
      selectedHeight: 1280,
      selectedScale: 1,
      selectedBitrate: 4_000_000,
      selectedVideoCodec: null,
      selectedAudioCodec,
      libraryName: webmSupported ? 'webm-mediarecorder' : 'mediabunny',
      fatalError: webmSupported ? null : 'ไม่พบตัวเข้ารหัส H.264 (AVC) หรือ WebM บนเครื่องนี้',
    };
  }

  return {
    hasVoiceover: params.hasVoiceover,
    audioCtxRunning,
    webCodecsSupported: true,
    webmSupported,
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

interface FrameRendererFn {
  (timeSec: number, offscreen: HTMLCanvasElement, ctx: CanvasRenderingContext2D, scale: number): void;
}

async function encodeWithMediabunny(params: {
  offscreen: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderAt: FrameRendererFn;
  totalDuration: number;
  renderedAudio: AudioBuffer | null;
  step: ResStep;
  fps: ExportFps;
  useAac: boolean;
  signal?: AbortSignal;
  onProgress: (message: string, percent: number) => void;
}): Promise<Blob> {
  const { offscreen, ctx, renderAt, totalDuration, renderedAudio, step, fps, useAac, signal, onProgress } =
    params;

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });

  const videoSource = new CanvasSource(offscreen, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
  });
  output.addVideoTrack(videoSource, { frameRate: fps });

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

  const frameCount = Math.max(1, Math.ceil(totalDuration * fps));
  for (let i = 0; i < frameCount; i++) {
    if (signal?.aborted) throw new Error('ยกเลิกการสร้างวิดีโอแล้ว');
    renderAt(i / fps, offscreen, ctx, step.scale);
    await videoSource.add(i / fps, 1 / fps);
    if (i % 8 === 0 || i === frameCount - 1) {
      onProgress(
        `กำลังเรนเดอร์ MP4 ${step.width}×${step.height} @ ${fps} FPS (${i + 1}/${frameCount})…`,
        Math.round(12 + ((i + 1) / frameCount) * 82)
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
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
  renderAt: FrameRendererFn;
  totalDuration: number;
  renderedAudio: AudioBuffer | null;
  step: ResStep;
  fps: ExportFps;
  videoCodec: string;
  signal?: AbortSignal;
  onProgress: (message: string, percent: number) => void;
}): Promise<Blob> {
  const { offscreen, ctx, renderAt, totalDuration, renderedAudio, step, fps, videoCodec, signal, onProgress } =
    params;

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
    audio:
      hasAac && renderedAudio
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

  const frameCount = Math.max(1, Math.ceil(totalDuration * fps));
  for (let i = 0; i < frameCount; i++) {
    if (signal?.aborted) {
      videoEncoder.close();
      throw new Error('ยกเลิกการสร้างวิดีโอแล้ว');
    }
    renderAt(i / fps, offscreen, ctx, step.scale);
    const frame = new VideoFrame(offscreen, {
      timestamp: Math.round((i / fps) * 1_000_000),
      duration: Math.round((1 / fps) * 1_000_000),
    });
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
    if (i % 8 === 0 || i === frameCount - 1) {
      onProgress(
        `กำลังเรนเดอร์ MP4 (Muxer) ${i + 1}/${frameCount} เฟรม…`,
        Math.round(12 + ((i + 1) / frameCount) * 82)
      );
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  await videoEncoder.flush();
  videoEncoder.close();
  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}

async function encodeWithWebmFallback(params: {
  offscreen: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  renderAt: FrameRendererFn;
  totalDuration: number;
  renderedAudio: AudioBuffer | null;
  step: ResStep;
  fps: ExportFps;
  signal?: AbortSignal;
  onProgress: (message: string, percent: number) => void;
}): Promise<Blob> {
  const { offscreen, ctx, renderAt, totalDuration, renderedAudio, step, fps, signal, onProgress } = params;
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
    ? 'video/webm;codecs=vp9,opus'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
      ? 'video/webm;codecs=vp8,opus'
      : 'video/webm';

  const stream = offscreen.captureStream(fps);
  let audioCtx: AudioContext | null = null;
  if (renderedAudio) {
    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    const src = audioCtx.createBufferSource();
    src.buffer = renderedAudio;
    src.connect(dest);
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    src.start(0);
  }

  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: step.bitrate });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const donePromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error('MediaRecorder WebM ล้มเหลว'));
  });

  recorder.start(250);
  const startMs = performance.now();
  const frameIntervalMs = 1000 / fps;
  let elapsed = 0;

  while (elapsed < totalDuration) {
    if (signal?.aborted) {
      recorder.stop();
      await audioCtx?.close().catch(() => {});
      throw new Error('ยกเลิกการสร้างวิดีโอแล้ว');
    }
    elapsed = (performance.now() - startMs) / 1000;
    renderAt(Math.min(totalDuration, elapsed), offscreen, ctx, step.scale);
    onProgress(
      `กำลังบันทึก WebM สำรอง (${elapsed.toFixed(1)} / ${totalDuration.toFixed(1)} วิ)…`,
      Math.round(12 + Math.min(1, elapsed / totalDuration) * 82)
    );
    await new Promise((r) => setTimeout(r, frameIntervalMs));
  }

  recorder.stop();
  await audioCtx?.close().catch(() => {});
  return donePromise;
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
  sceneAudioMap?: Record<string, SceneAudioRecord>;
  enableBgmAndSfx: boolean;
  cineEnabled: boolean;
  want1080: boolean;
  fps?: ExportFps;
  performancePreset?: PerformancePreset;
  forceFormat?: 'auto' | 'webm';
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
    sceneAudioMap,
    enableBgmAndSfx,
    cineEnabled,
    want1080,
    fps = 30,
    performancePreset = 'high',
    forceFormat = 'auto',
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

  if (preflight.fatalError) {
    throw new Error(preflight.fatalError);
  }

  try {
    await (
      navigator as unknown as { wakeLock?: { request: (t: string) => Promise<void> } }
    ).wakeLock?.request('screen');
  } catch {
    // optional
  }

  onProgress('กำลังผสมเสียงพากย์ เพลง และ SFX ด้วย OfflineAudioContext…', 5);
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

  const is3d = project.renderEngine !== '2d_paper';
  const fullLadder = getResolutionLadder(want1080);
  const startIdx = Math.max(
    0,
    fullLadder.findIndex((s) => s.width === preflight.selectedWidth)
  );
  const candidates = fullLadder.slice(startIdx);

  let finalBlob: Blob | null = null;
  let usedStep = candidates[0];
  let downscaleWarning: string | null = null;
  let usedExt: 'mp4' | 'webm' = 'mp4';
  let usedCodec = preflight.selectedVideoCodec || 'vp9';
  let usedAudioCodec: VideoExportResult['usedAudioCodec'] =
    preflight.selectedAudioCodec || 'aac';

  const useWebmOnly = forceFormat === 'webm' || !preflight.selectedVideoCodec;

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

    let stage3d: ThreeSceneStage | null = null;
    if (is3d) {
      stage3d = new ThreeSceneStage({
        width: usedStep.width,
        height: usedStep.height,
        preset: performancePreset,
        style3d: project.style3d,
      });
      await stage3d.syncProjectAssets(project);
    }

    const renderAt: FrameRendererFn = (tSec, targetCanvas, targetCtx, scale) => {
      if (is3d && stage3d) {
        stage3d.renderFrameAt(project, timeline, tSec, {
          envelope,
          leadSec,
          speechStartSec,
          subtitleScale,
          sceneAudioMap,
          target2dCanvas: targetCanvas,
        });
      } else {
        renderCartoonFrame(targetCtx, project, timeline, tSec, {
          envelope,
          leadSec,
          speechStartSec,
          scale,
          subtitleScale,
          pauseCandidates,
          cineEnabled,
        });
      }
    };

    try {
      if (useWebmOnly) {
        if (!preflight.webmSupported) {
          throw new Error('เบราว์เซอร์ไม่รองรับทั้ง H.264 MP4 และ WebM');
        }
        usedExt = 'webm';
        usedCodec = 'vp8/vp9';
        usedAudioCodec = 'opus';
        finalBlob = await encodeWithWebmFallback({
          offscreen,
          ctx,
          renderAt,
          totalDuration,
          renderedAudio,
          step: usedStep,
          fps,
          signal,
          onProgress,
        });
        break;
      }

      try {
        finalBlob = await encodeWithMediabunny({
          offscreen,
          ctx,
          renderAt,
          totalDuration,
          renderedAudio,
          step: usedStep,
          fps,
          useAac: preflight.selectedAudioCodec === 'aac',
          signal,
          onProgress,
        });
        usedExt = 'mp4';
        usedCodec = preflight.selectedVideoCodec!;
        break;
      } catch (err) {
        if (signal?.aborted) throw err;
        try {
          finalBlob = await encodeWithMp4Muxer({
            offscreen,
            ctx,
            renderAt,
            totalDuration,
            renderedAudio,
            step: usedStep,
            fps,
            videoCodec: preflight.selectedVideoCodec!,
            signal,
            onProgress,
          });
          usedExt = 'mp4';
          usedCodec = preflight.selectedVideoCodec!;
          break;
        } catch (muxErr) {
          if (attempt === candidates.length - 1) {
            if (preflight.webmSupported) {
              downscaleWarning = 'ตัวเข้ารหัส MP4 ขัดข้อง สลับไปใช้ WebM Fallback อัตโนมัติ';
              usedExt = 'webm';
              usedCodec = 'vp8/vp9';
              usedAudioCodec = 'opus';
              finalBlob = await encodeWithWebmFallback({
                offscreen,
                ctx,
                renderAt,
                totalDuration,
                renderedAudio,
                step: usedStep,
                fps,
                signal,
                onProgress,
              });
              break;
            }
            throw muxErr;
          }
        }
      }
    } finally {
      stage3d?.dispose();
    }
  }

  if (!finalBlob || finalBlob.size === 0) {
    throw new Error('ไม่สามารถสร้างไฟล์วิดีโอที่มีข้อมูลสมบูรณ์ได้');
  }

  // VERIFY Step: inspect Blob metadata & audio RMS before returning 100%
  onProgress('กำลังตรวจสอบไฟล์วิดีโอและเสียงในไฟล์ (VERIFY)…', 96);
  const url = URL.createObjectURL(finalBlob);
  const probeVideo = document.createElement('video');
  probeVideo.preload = 'metadata';
  probeVideo.src = url;
  const durationSec = await new Promise<number | null>((resolve) => {
    probeVideo.onloadedmetadata = () =>
      resolve(Number.isFinite(probeVideo.duration) ? probeVideo.duration : null);
    setTimeout(() => resolve(null), 5000);
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
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  onProgress(`สร้างและตรวจสอบไฟล์ ${usedExt.toUpperCase()} เสร็จสมบูรณ์`, 100);
  return {
    blob: finalBlob,
    mimeType: usedExt === 'mp4' ? 'video/mp4' : 'video/webm',
    ext: usedExt,
    durationSec,
    hasAudioTrack,
    audioVerifiedStatus,
    usedScale: usedStep.scale,
    usedWidth: usedStep.width,
    usedHeight: usedStep.height,
    usedFps: fps,
    usedCodec,
    usedAudioCodec,
    downscaleWarning,
  };
}
