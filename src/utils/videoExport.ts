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
import type { CartoonProject, TimelineSegment } from '../types/cartoon';
import { CANVAS_H, CANVAS_W, renderCartoonFrame } from './canvasRenderer';

export interface VideoExportResult {
  blob: Blob;
  mimeType: string;
  ext: 'mp4' | 'webm';
  durationSec: number | null;
  hasAudioTrack: boolean | null;
  usedScale: number;
}

async function pickResolutionScale(want1080: boolean): Promise<number> {
  const candidates = want1080 ? [1.5, 1] : [1];
  const codecs = ['avc1.42001f', 'avc1.4d001f', 'avc1.640028', 'avc1.640032'];
  for (const scale of candidates) {
    for (const codec of codecs) {
      try {
        const res = await VideoEncoder.isConfigSupported({
          codec,
          width: Math.round(CANVAS_W * scale),
          height: Math.round(CANVAS_H * scale),
          bitrate: 4_000_000,
        });
        if (res.supported) return scale;
      } catch {
        // try next codec
      }
    }
  }
  throw new Error('เบราว์เซอร์นี้ไม่รองรับตัวเข้ารหัส H.264 สำหรับสร้าง MP4');
}

export async function exportCartoonVideo(params: {
  project: CartoonProject;
  timeline: TimelineSegment[];
  totalDuration: number;
  envelope: number[];
  leadSec: number;
  speechStartSec: number;
  mixBuffer: AudioBuffer | null;
  want1080: boolean;
  subtitleScale: 'normal' | 'large';
  onProgress: (message: string, percent: number) => void;
}): Promise<VideoExportResult> {
  const {
    project,
    timeline,
    totalDuration,
    envelope,
    leadSec,
    speechStartSec,
    mixBuffer,
    want1080,
    subtitleScale,
    onProgress,
  } = params;

  await document.fonts.load('800 40px Prompt');

  if (typeof VideoEncoder === 'undefined') {
    return exportFallbackWebm(params);
  }

  onProgress('กำลังตรวจสอบโค้ดเดก H.264…', 4);
  const scale = await pickResolutionScale(want1080);

  try {
    await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<void> } }).wakeLock?.request('screen');
  } catch {
    // wakeLock optional
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = Math.round(CANVAS_W * scale);
  offscreen.height = Math.round(CANVAS_H * scale);
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

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
  if (mixBuffer) {
    const aacOk = await canEncodeAudio('aac').catch(() => false);
    audioSource = new AudioBufferSource({
      codec: aacOk ? 'aac' : 'opus',
      bitrate: 128_000,
    });
    output.addAudioTrack(audioSource);
  }

  await output.start();
  if (audioSource && mixBuffer) {
    await audioSource.add(mixBuffer);
    audioSource.close();
  }

  const fps = 30;
  const frameCount = Math.max(1, Math.ceil(totalDuration * fps));
  for (let i = 0; i < frameCount; i++) {
    renderCartoonFrame(ctx, project, timeline, i / fps, {
      envelope,
      leadSec,
      speechStartSec,
      scale,
      subtitleScale,
    });
    await videoSource.add(i / fps, 1 / fps);
    if (i % 8 === 0 || i === frameCount - 1) {
      onProgress(
        `กำลังเรนเดอร์วิดีโอ MP4 (${i + 1}/${frameCount} เฟรม)…`,
        Math.round(5 + ((i + 1) / frameCount) * 92)
      );
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  }

  videoSource.close();
  await output.finalize();

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('ไม่สามารถสร้างไฟล์ MP4 ได้');
  const blob = new Blob([buffer], { type: 'video/mp4' });

  onProgress('กำลังตรวจสอบไฟล์ MP4…', 99);
  const url = URL.createObjectURL(blob);
  const probeVideo = document.createElement('video');
  probeVideo.src = url;
  const durationSec = await new Promise<number | null>((resolve) => {
    probeVideo.onloadedmetadata = () => resolve(probeVideo.duration);
    setTimeout(() => resolve(null), 5000);
  });
  URL.revokeObjectURL(url);

  let hasAudioTrack: boolean | null = null;
  try {
    const inp = new Input({ formats: ALL_FORMATS, source: new BlobSource(blob) });
    hasAudioTrack = Boolean(await inp.getPrimaryAudioTrack());
  } catch {
    hasAudioTrack = null;
  }

  onProgress('สร้างวิดีโอ MP4 เสร็จสมบูรณ์', 100);
  return {
    blob,
    mimeType: 'video/mp4',
    ext: 'mp4',
    durationSec,
    hasAudioTrack,
    usedScale: scale,
  };
}

async function exportFallbackWebm(params: {
  project: CartoonProject;
  timeline: TimelineSegment[];
  totalDuration: number;
  envelope: number[];
  leadSec: number;
  speechStartSec: number;
  subtitleScale: 'normal' | 'large';
  onProgress: (message: string, percent: number) => void;
}): Promise<VideoExportResult> {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('เบราว์เซอร์นี้ไม่รองรับการสร้างไฟล์วิดีโอ (กรุณาอัปเดต Chrome/Safari)');
  }

  const { project, timeline, totalDuration, envelope, leadSec, speechStartSec, subtitleScale, onProgress } =
    params;

  const offscreen = document.createElement('canvas');
  offscreen.width = CANVAS_W;
  offscreen.height = CANVAS_H;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('ไม่สามารถสร้าง Canvas Context ได้');

  const stream = offscreen.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm',
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data.size > 0) chunks.push(ev.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
  });

  recorder.start();
  const start = performance.now();
  while (true) {
    const elapsed = (performance.now() - start) / 1000;
    if (elapsed >= totalDuration) break;
    renderCartoonFrame(ctx, project, timeline, elapsed, {
      envelope,
      leadSec,
      speechStartSec,
      scale: 1,
      subtitleScale,
    });
    onProgress(
      `กำลังบันทึกวิดีโอ WebM (${elapsed.toFixed(1)}/${totalDuration.toFixed(1)} วิ)…`,
      Math.min(98, Math.round((elapsed / totalDuration) * 98))
    );
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  recorder.stop();
  const blob = await done;
  onProgress('สร้างวิดีโอ WebM เสร็จสมบูรณ์', 100);
  return {
    blob,
    mimeType: 'video/webm',
    ext: 'webm',
    durationSec: totalDuration,
    hasAudioTrack: false,
    usedScale: 1,
  };
}
