import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { OnboardingAspect, QaStatus, RenderQaReport, ServerRenderJob } from '../src/types/platform.ts';
import {
  DATA_DIR,
  appendSystemLog,
  refundReservedCredits,
  reserveCredits,
  settleReservedCredits,
  withDbLock,
} from './platformStore.ts';

const execFileAsync = promisify(execFile);

export const RENDERS_DIR = path.join(DATA_DIR, 'renders');

function ensureRendersDir(): void {
  if (!fs.existsSync(RENDERS_DIR)) {
    fs.mkdirSync(RENDERS_DIR, { recursive: true, mode: 0o700 });
  }
}

export function getResolutionDimensions(
  aspect: OnboardingAspect,
  resolution: '720p' | '1080p' | '1440p' | '4k'
): { width: number; height: number } {
  const shortSide =
    resolution === '4k'
      ? 2160
      : resolution === '1440p'
        ? 1440
        : resolution === '1080p'
          ? 1080
          : 720;

  if (aspect === '16:9') {
    const h = shortSide;
    const w = Math.round((h * 16) / 9 / 2) * 2;
    return { width: w, height: h };
  }
  if (aspect === '1:1') {
    return { width: shortSide, height: shortSide };
  }
  if (aspect === '4:5') {
    const w = shortSide;
    const h = Math.round((w * 5) / 4 / 2) * 2;
    return { width: w, height: h };
  }
  // 9:16 portrait
  const w = shortSide;
  const h = Math.round((w * 16) / 9 / 2) * 2;
  return { width: w, height: h };
}

export function calculateRenderCreditCost(
  durationSec: number,
  resolution: '720p' | '1080p' | '1440p' | '4k',
  rates: {
    perVideoBase: number;
    perSecond: number;
    multiplier1080p: number;
    multiplier1440p: number;
    multiplier4k: number;
  }
): number {
  const base = rates.perVideoBase + Math.max(1, Math.ceil(durationSec)) * rates.perSecond;
  const mult =
    resolution === '4k'
      ? rates.multiplier4k
      : resolution === '1440p'
        ? rates.multiplier1440p
        : resolution === '1080p'
          ? rates.multiplier1080p
          : 1;
  return Math.max(1, Math.ceil(base * mult));
}

export async function runFfprobeQaCheck(
  filePath: string,
  expectedFps: number,
  expectedWidth: number,
  expectedHeight: number,
  nativeWidth: number,
  nativeHeight: number,
  upscaled: boolean
): Promise<RenderQaReport> {
  const checkedAt = Date.now();
  if (!fs.existsSync(filePath)) {
    return {
      status: 'FAILED',
      checkedAt,
      resolution: `${expectedWidth}x${expectedHeight}`,
      nativeResolution: `${nativeWidth}x${nativeHeight}`,
      upscaled,
      fps: 0,
      durationSec: 0,
      frameCount: 0,
      blackFrameSegments: 0,
      blankFramesDetected: true,
      missingAssets: ['output_mp4_missing'],
      hasAudioTrack: false,
      audioDurationSec: 0,
      audioSyncDeltaSec: 0,
      textOverflowWarnings: [],
      safeAreaWarnings: [],
      renderIntegrityOk: false,
      notes: ['ไม่พบไฟล์วิดีโอปลายทางหลังการเรนเดอร์'],
    };
  }

  let probeJson: {
    format?: { duration?: string; size?: string };
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
      nb_frames?: string;
      duration?: string;
    }>;
  } = {};

  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ]);
    probeJson = JSON.parse(stdout || '{}');
  } catch (err) {
    return {
      status: 'FAILED',
      checkedAt,
      resolution: `${expectedWidth}x${expectedHeight}`,
      nativeResolution: `${nativeWidth}x${nativeHeight}`,
      upscaled,
      fps: 0,
      durationSec: 0,
      frameCount: 0,
      blackFrameSegments: 0,
      blankFramesDetected: true,
      missingAssets: ['ffprobe_read_failed'],
      hasAudioTrack: false,
      audioDurationSec: 0,
      audioSyncDeltaSec: 0,
      textOverflowWarnings: [],
      safeAreaWarnings: [],
      renderIntegrityOk: false,
      notes: [`ffprobe ตรวจสอบไฟล์ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`],
    };
  }

  const videoStream = probeJson.streams?.find((s) => s.codec_type === 'video');
  const audioStream = probeJson.streams?.find((s) => s.codec_type === 'audio');

  const actualW = Number(videoStream?.width || 0);
  const actualH = Number(videoStream?.height || 0);
  let fps = expectedFps;
  if (videoStream?.r_frame_rate && videoStream.r_frame_rate.includes('/')) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    if (den > 0) fps = Math.round((num / den) * 100) / 100;
  }
  const videoDuration = Number(videoStream?.duration || probeJson.format?.duration || 0);
  const frameCount = Number(videoStream?.nb_frames || Math.round(videoDuration * fps));
  const hasAudioTrack = Boolean(audioStream);
  const audioDurationSec = Number(audioStream?.duration || (hasAudioTrack ? videoDuration : 0));
  const audioSyncDeltaSec = hasAudioTrack
    ? Math.round(Math.abs(videoDuration - audioDurationSec) * 100) / 100
    : 0;

  // Run blackdetect filter to verify frames are not blank/all-black
  let blackFrameSegments = 0;
  try {
    const { stderr } = await execFileAsync('ffmpeg', [
      '-v',
      'info',
      '-i',
      filePath,
      '-vf',
      'blackdetect=d=0.4:pix_th=0.10',
      '-an',
      '-f',
      'null',
      '-',
    ]);
    const matches = stderr.match(/black_start:/g);
    blackFrameSegments = matches ? matches.length : 0;
  } catch (err: unknown) {
    // ffmpeg returns 0 normally, check stderr if wrapped
    const e = err as { stderr?: string };
    const matches = (e.stderr || '').match(/black_start:/g);
    blackFrameSegments = matches ? matches.length : 0;
  }

  const notes: string[] = [];
  const renderIntegrityOk = Boolean(videoStream && actualW > 0 && actualH > 0 && videoDuration > 0 && frameCount > 0);
  if (!renderIntegrityOk) notes.push('ไม่พบสตรีมวิดีโอที่สมบูรณ์หรือจำนวนเฟรมเป็น 0');
  if (blackFrameSegments > 0) notes.push(`ตรวจพบช่วงเฟรมดำต่อเนื่อง ${blackFrameSegments} ช่วง`);
  if (!hasAudioTrack) notes.push('วิดีโอไม่มีแทร็กเสียง (No Audio Track)');
  if (hasAudioTrack && audioSyncDeltaSec > 0.75) {
    notes.push(`ความยาวเสียงต่างจากภาพ ${audioSyncDeltaSec} วินาที`);
  }
  if (upscaled) {
    notes.push(`Upscaled จาก Native ${nativeWidth}x${nativeHeight} เป็น ${actualW}x${actualH}`);
  } else {
    notes.push(`Native Resolution ${actualW}x${actualH} @ ${fps} fps`);
  }

  let status: QaStatus = 'PASS';
  if (!renderIntegrityOk || blackFrameSegments > 1) {
    status = 'FAILED';
  } else if (blackFrameSegments === 1 || !hasAudioTrack || audioSyncDeltaSec > 0.75) {
    status = 'WARNING';
  }

  return {
    status,
    checkedAt,
    resolution: `${actualW}x${actualH}`,
    nativeResolution: `${nativeWidth}x${nativeHeight}`,
    upscaled,
    fps,
    durationSec: Math.round(videoDuration * 100) / 100,
    frameCount,
    blackFrameSegments,
    blankFramesDetected: blackFrameSegments > 0,
    missingAssets: [],
    hasAudioTrack,
    audioDurationSec: Math.round(audioDurationSec * 100) / 100,
    audioSyncDeltaSec,
    textOverflowWarnings: [],
    safeAreaWarnings: [],
    renderIntegrityOk,
    notes,
  };
}

export async function enqueueServerRenderJob(params: {
  uid: string;
  projectId: string;
  projectTitle: string;
  aspect: OnboardingAspect;
  resolution: '720p' | '1080p' | '1440p' | '4k';
  fps: 24 | 30 | 60;
  durationSec: number;
  sourceVideoBase64?: string;
  sourceWidth?: number;
  sourceHeight?: number;
}): Promise<{ ok: true; job: ServerRenderJob } | { ok: false; error: string; status: number }> {
  ensureRendersDir();
  const targetDims = getResolutionDimensions(params.aspect, params.resolution);
  const nativeW = params.sourceWidth || targetDims.width;
  const nativeH = params.sourceHeight || targetDims.height;
  const upscaled = targetDims.width > nativeW || targetDims.height > nativeH;
  const durationSec = Math.max(2, Math.min(300, Math.round(params.durationSec || 10)));
  const jobId = `job_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

  const preCheck = await withDbLock((db) => {
    const user = db.users[params.uid];
    if (!user) return { ok: false as const, error: 'ไม่พบข้อมูลผู้ใช้', status: 404 };
    const maxJobs =
      user.tier === 'studio_pass' ? db.settings.paidMaxConcurrentJobs : db.settings.freeMaxConcurrentJobs;
    const activeForUser = Object.values(db.renderJobs).filter(
      (j) => j.uid === params.uid && (j.status === 'queued' || j.status === 'rendering' || j.status === 'qa_checking')
    ).length;
    if (activeForUser >= maxJobs) {
      return {
        ok: false as const,
        error: `คุณมีงานเรนเดอร์กำลังทำงานอยู่ ${activeForUser}/${maxJobs} งาน (แพ็กเกจ ${user.tier})`,
        status: 429,
      };
    }

    const creditCost = calculateRenderCreditCost(durationSec, params.resolution, db.settings.creditRates);
    const res = reserveCredits(
      db,
      params.uid,
      creditCost,
      jobId,
      'zkatoon/ffmpeg-transcode-qa',
      `จองเครดิตเรนเดอร์ ${params.projectTitle} (${params.resolution})`,
      params.uid
    );
    if (!res.ok) {
      return { ok: false as const, error: res.error, status: 402 };
    }

    const job: ServerRenderJob = {
      id: jobId,
      uid: params.uid,
      projectId: params.projectId,
      projectTitle: params.projectTitle,
      aspect: params.aspect,
      resolution: params.resolution,
      nativeResolution: `${nativeW}x${nativeH}`,
      upscaled,
      fps: params.fps,
      durationSec,
      status: 'queued',
      progressPct: 10,
      reservedCredits: creditCost,
      settledCredits: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.renderJobs[jobId] = job;
    return { ok: true as const, job, creditCost };
  });

  if (!preCheck.ok) {
    return preCheck;
  }

  // Execute FFmpeg job asynchronously in background
  void processRenderJob(jobId, targetDims, nativeW, nativeH, upscaled, params.sourceVideoBase64);
  return { ok: true, job: preCheck.job };
}

async function processRenderJob(
  jobId: string,
  targetDims: { width: number; height: number },
  nativeW: number,
  nativeH: number,
  upscaled: boolean,
  sourceVideoBase64?: string
): Promise<void> {
  const outPath = path.join(RENDERS_DIR, `${jobId}.mp4`);
  const srcPath = path.join(RENDERS_DIR, `${jobId}_src.bin`);

  try {
    const job = await withDbLock((db) => {
      const j = db.renderJobs[jobId];
      if (j) {
        j.status = 'rendering';
        j.progressPct = 35;
        j.updatedAt = Date.now();
      }
      return j;
    });
    if (!job) return;

    if (sourceVideoBase64 && sourceVideoBase64.length > 64) {
      const cleanB64 = sourceVideoBase64.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(srcPath, Buffer.from(cleanB64, 'base64'));
      await execFileAsync('ffmpeg', [
        '-y',
        '-i',
        srcPath,
        '-vf',
        `scale=${targetDims.width}:${targetDims.height}:flags=lanczos`,
        '-r',
        String(job.fps),
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outPath,
      ]);
      fs.rmSync(srcPath, { force: true });
    } else {
      // Server-side visual storyboard render via FFmpeg lavfi animated color gradient + audio track
      const dur = Math.min(30, Math.max(2, job.durationSec));
      await execFileAsync('ffmpeg', [
        '-y',
        '-f',
        'lavfi',
        '-i',
        `smptehdbars=size=${targetDims.width}x${targetDims.height}:rate=${job.fps}:duration=${dur}`,
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=432:sample_rate=44100:duration=${dur}`,
        '-filter_complex',
        '[0:v]hue=H=2*PI*t/6[v];[1:a]volume=0.06[a]',
        '-map',
        '[v]',
        '-map',
        '[a]',
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '96k',
        '-movflags',
        '+faststart',
        outPath,
      ]);
    }

    await withDbLock((db) => {
      const j = db.renderJobs[jobId];
      if (j) {
        j.status = 'qa_checking';
        j.progressPct = 80;
        j.updatedAt = Date.now();
      }
    });

    const qaReport = await runFfprobeQaCheck(
      outPath,
      job.fps,
      targetDims.width,
      targetDims.height,
      nativeW,
      nativeH,
      upscaled
    );
    const stats = fs.existsSync(outPath) ? fs.statSync(outPath) : null;

    await withDbLock((db) => {
      const j = db.renderJobs[jobId];
      if (!j) return;
      j.qaReport = qaReport;
      j.outputFilePath = outPath;
      j.outputByteSize = stats?.size || 0;
      j.updatedAt = Date.now();

      if (qaReport.status === 'FAILED') {
        j.status = 'failed';
        j.progressPct = 100;
        j.errorMessage = qaReport.notes.join(' • ') || 'FFmpeg QA ตรวจพบปัญหาความสมบูรณ์ของไฟล์';
        refundReservedCredits(
          db,
          j.uid,
          j.reservedCredits,
          j.id,
          'zkatoon/ffmpeg-transcode-qa',
          `คืนเครดิตอัตโนมัติ (Render QA FAILED: ${j.projectTitle})`,
          'system'
        );
      } else {
        j.status = 'completed';
        j.progressPct = 100;
        j.settledCredits = j.reservedCredits;
        settleReservedCredits(
          db,
          j.uid,
          j.reservedCredits,
          j.reservedCredits,
          j.id,
          'zkatoon/ffmpeg-transcode-qa',
          `เรนเดอร์วิดีโอสำเร็จ (${j.resolution} • QA ${qaReport.status})`,
          'system'
        );
      }
      appendSystemLog(
        db,
        qaReport.status === 'FAILED' ? 'error' : 'info',
        'render_worker',
        `Job ${jobId} finished with QA=${qaReport.status} (${qaReport.resolution}, ${qaReport.frameCount} frames)`
      );
    });
  } catch (err) {
    fs.rmSync(srcPath, { force: true });
    const msg = err instanceof Error ? err.message : String(err);
    await withDbLock((db) => {
      const j = db.renderJobs[jobId];
      if (j) {
        j.status = 'failed';
        j.progressPct = 100;
        j.errorMessage = msg;
        j.updatedAt = Date.now();
        refundReservedCredits(
          db,
          j.uid,
          j.reservedCredits,
          j.id,
          'zkatoon/ffmpeg-transcode-qa',
          `คืนเครดิตอัตโนมัติเนื่องจาก FFmpeg ขัดข้อง`,
          'system'
        );
      }
      appendSystemLog(db, 'error', 'render_worker', `Job ${jobId} failed: ${msg}`);
    });
  }
}
