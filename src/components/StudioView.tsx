import { type RefObject } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  Film,
  FolderDown,
  Mic2,
  Music,
  Pause,
  Play,
  Save,
  Share2,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import type {
  CartoonProject,
  ExportFps,
  HardwareCapabilities,
  PerformancePreset,
  StylePreset3D,
  SubtitleStyle,
  SyncDiagnostics,
  TimelineSegment,
  VideoLayoutMode,
} from '../types/cartoon';
import { CANVAS_H, CANVAS_W } from '../utils/canvasRenderer';
import { STYLE_PRESETS_3D, SUBTITLE_STYLE_OPTIONS } from '../utils/cartoonData';
import { formatTimecode, sanitizeFilename } from '../utils/projectLogic';
import type { ExportPreflightStatus, VideoExportResult } from '../utils/videoExport';

interface StudioViewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  stage3dContainerRef: RefObject<HTMLDivElement | null>;
  project: CartoonProject | null;
  timeline: TimelineSegment[];
  syncDiagnostics: SyncDiagnostics;
  capabilities: HardwareCapabilities | null;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isMuted: boolean;
  hasAudio: boolean;
  audioExt: string;
  audioNote: string;
  isExportingMp3: boolean;
  previewQuality: PerformancePreset;
  exportQuality: PerformancePreset;
  exportResolution: '720' | '1080';
  exportFps: ExportFps;
  subtitleScale: 'normal' | 'large';
  preflight: ExportPreflightStatus | null;
  isExporting: boolean;
  exportProgressText: string;
  exportProgressPct: number;
  exportResult: VideoExportResult | null;
  exportVideoUrl: string | null;
  exportError: string | null;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onImportAudio: (file: File) => void;
  onGoVoiceStudio: () => void;
  onGoDirector: () => void;
  onDownloadMp3: () => void;
  onSaveProject: () => void;
  onSaveLocal: () => void;
  onUpdateProject: (next: CartoonProject) => void;
  onChangePreviewQuality: (q: PerformancePreset) => void;
  onChangeExportQuality: (q: PerformancePreset) => void;
  onChangeExportRes: (res: '720' | '1080') => void;
  onChangeExportFps: (fps: ExportFps) => void;
  onChangeSubtitleScale: (scale: 'normal' | 'large') => void;
  onRunPreflight: () => void;
  onExportVideo: (forceFormat?: 'auto' | 'webm') => void;
  onCancelExport: () => void;
  onShareVideo: () => void;
  onGoCreate: () => void;
}

export function StudioView({
  canvasRef,
  stage3dContainerRef,
  project,
  timeline,
  syncDiagnostics,
  capabilities,
  currentTime,
  totalDuration,
  isPlaying,
  isMuted,
  hasAudio,
  audioNote,
  isExportingMp3,
  previewQuality,
  exportQuality,
  exportResolution,
  exportFps,
  subtitleScale,
  preflight,
  isExporting,
  exportProgressText,
  exportProgressPct,
  exportResult,
  exportVideoUrl,
  exportError,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onImportAudio,
  onGoVoiceStudio,
  onGoDirector,
  onDownloadMp3,
  onSaveProject,
  onSaveLocal,
  onUpdateProject,
  onChangePreviewQuality,
  onChangeExportQuality,
  onChangeExportRes,
  onChangeExportFps,
  onChangeSubtitleScale,
  onRunPreflight,
  onExportVideo,
  onCancelExport,
  onShareVideo,
  onGoCreate,
}: StudioViewProps) {
  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <Film className="mx-auto h-12 w-12 text-violet-400" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-white">ยังไม่ได้เปิดโปรเจกต์ในสตูดิโอ</h1>
        <p className="text-sm text-[#9894b8]">
          ไปที่เมนู "สร้างเรื่อง" เพื่อสร้างเรื่องใหม่หรือเปิดโปรเจกต์ตัวอย่าง 3D/2D
        </p>
        <button
          type="button"
          onClick={onGoCreate}
          className="min-h-[44px] rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white hover:bg-violet-500 cursor-pointer"
        >
          ไปหน้าสร้างเรื่อง
        </button>
      </div>
    );
  }

  const is3d = project.renderEngine !== '2d_paper';
  const activeSeg =
    timeline.find((s) => currentTime < s.b) || timeline[timeline.length - 1];

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 space-y-5">
      {/* Top Studio Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-extrabold text-white">{project.title}</h1>
            <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-[11px] font-bold text-violet-300">
              {is3d ? '3D WebGL Engine' : '2D Paper Sketch'}
            </span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] text-[#d6d3eb] tabular-nums">
              {timeline.length} ฉาก · {formatTimecode(totalDuration)}
            </span>
          </div>
          {audioNote && <p className="mt-1 text-xs text-[#9894b8]">{audioNote}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGoDirector}
            className="min-h-[38px] rounded-xl border border-white/10 bg-[#13141d] px-3 text-xs font-medium text-white hover:border-violet-400/50 cursor-pointer"
          >
            กำกับฉาก & กล้อง
          </button>
          <button
            type="button"
            onClick={onGoVoiceStudio}
            className="inline-flex items-center gap-1.5 min-h-[38px] rounded-xl border border-white/10 bg-[#13141d] px-3 text-xs font-medium text-white hover:border-violet-400/50 cursor-pointer"
          >
            <Mic2 className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
            <span>ห้องพากย์</span>
          </button>
          <button
            type="button"
            onClick={onSaveProject}
            className="inline-flex items-center gap-1.5 min-h-[38px] rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>บันทึก</span>
          </button>
        </div>
      </div>

      {/* Main Studio Split: Stage Left + Production Controls Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Left: 9:16 Viewport + Transport + Scene Strip */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-4 flex flex-col items-center space-y-3">
            {/* Viewport Frame (Never apply backdrop-blur over WebGL) */}
            <div className="relative w-full max-w-[310px] aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 bg-[#090b12] shadow-2xl">
              {is3d ? (
                <div
                  ref={stage3dContainerRef}
                  data-testid="studio-3d-viewport"
                  className="absolute inset-0 h-full w-full"
                />
              ) : (
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  data-testid="studio-2d-viewport"
                  className="h-full w-full object-contain"
                />
              )}
            </div>

            {/* Active Shot Info (kept completely outside WebGL canvas) */}
            {activeSeg && (
              <div className="w-full max-w-[310px] flex items-center justify-between text-[11px] text-[#9894b8] px-1">
                <span className="truncate font-medium text-white">
                  {activeSeg.s.id || `S${activeSeg.index + 1}`}: {activeSeg.s.title || ''}
                </span>
                <span className="shrink-0">
                  {is3d ? activeSeg.s.shotType3d || 'medium' : activeSeg.s.camera || 'static'}
                </span>
              </div>
            )}

            {/* Playback Transport */}
            <div className="w-full max-w-[310px] space-y-2.5">
              <input
                type="range"
                min={0}
                max={Math.max(0.1, totalDuration)}
                step={0.02}
                value={Math.min(currentTime, totalDuration)}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="เลื่อนเวลาวิดีโอ"
                className="w-full studio-range"
              />

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onTogglePlay}
                    className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-500 cursor-pointer"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-4 w-4" aria-hidden="true" />
                        <span>หยุด</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" aria-hidden="true" />
                        <span>เล่น</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    aria-label={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
                    className="min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3 text-white cursor-pointer"
                  >
                    {isMuted ? (
                      <VolumeX className="h-4 w-4 text-rose-300" aria-hidden="true" />
                    ) : (
                      <Volume2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <div className="font-mono-tabular text-xs text-[#d6d3eb] tabular-nums">
                  {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
                </div>
              </div>
            </div>

            {/* Scene Quick Jump Strip */}
            <div className="w-full flex flex-wrap gap-1.5 pt-1">
              {timeline.map((seg) => {
                const isCur = activeSeg?.index === seg.index;
                return (
                  <button
                    key={seg.index}
                    type="button"
                    onClick={() => onSeek(seg.a + 0.02)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                      isCur
                        ? 'bg-violet-600 text-white'
                        : 'bg-[#1b1d29] text-[#9894b8] hover:text-white'
                    }`}
                  >
                    {seg.s.id || `S${seg.index + 1}`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Style, Performance, Audio, Export & Verify */}
        <div className="lg:col-span-7 space-y-4">
          {/* Style & Layout Controls */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <span>เอนจิน สไตล์ภาพ & ซับไตเติล</span>
            </h2>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] text-[#9894b8] mb-1">เอนจินแสดงผล</label>
                <select
                  value={project.renderEngine || '3d'}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      renderEngine: e.target.value as '3d' | '2d_paper',
                    })
                  }
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  <option value="3d">3D Cinematic (Three.js WebGL)</option>
                  <option value="2d_paper">2D Paper Sketch (Classic)</option>
                </select>
              </div>

              {is3d && (
                <div>
                  <label className="block text-[11px] text-[#9894b8] mb-1">สไตล์ 3D</label>
                  <select
                    value={project.style3d || 'cinematic_3d'}
                    onChange={(e) =>
                      onUpdateProject({ ...project, style3d: e.target.value as StylePreset3D })
                    }
                    className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                  >
                    {STYLE_PRESETS_3D.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] text-[#9894b8] mb-1">รูปแบบซับไตเติล</label>
                <select
                  value={project.subtitleStyle || 'yellow_text'}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      subtitleStyle: e.target.value as SubtitleStyle,
                    })
                  }
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  {SUBTITLE_STYLE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#9894b8] mb-1">สัดส่วนเฟรม (Layout)</label>
                <select
                  value={project.layout || 'full'}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      layout: e.target.value as VideoLayoutMode,
                    })
                  }
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  <option value="full">แนวตั้งเต็มจอ (9:16)</option>
                  <option value="letterbox">แถบกลาง 16:9 + ข้อความบนล่าง</option>
                </select>
              </div>
            </div>

            {project.layout === 'letterbox' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={project.letterbox?.topText || ''}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      letterbox: {
                        topText: e.target.value,
                        bottomText: project.letterbox?.bottomText || '',
                      },
                    })
                  }
                  placeholder="ข้อความแถบบน"
                  className="min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                />
                <input
                  type="text"
                  value={project.letterbox?.bottomText || ''}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      letterbox: {
                        topText: project.letterbox?.topText || '',
                        bottomText: e.target.value,
                      },
                    })
                  }
                  placeholder="ข้อความแถบล่าง"
                  className="min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                />
              </div>
            )}
          </div>

          {/* Part E: Hardware Probe & Preview vs Export Quality */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                <span>ประสิทธิภาพ & คุณภาพวิดีโอ (Preview vs Export)</span>
              </h2>
              {capabilities && (
                <span className="text-[11px] text-[#9894b8]">
                  GPU: {capabilities.isSoftwareGl ? 'Software WebGL (โหมดประหยัดทรัพยากร)' : 'Hardware WebGL'} · แนะนำ {capabilities.recommendedPreset.toUpperCase()} / {capabilities.maxRecommendedFps} FPS
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              <div>
                <label className="block text-[11px] text-[#9894b8] mb-1">คุณภาพ Preview</label>
                <select
                  value={previewQuality}
                  onChange={(e) => onChangePreviewQuality(e.target.value as PerformancePreset)}
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                >
                  <option value="low">Low (ลื่นสุด)</option>
                  <option value="balanced">Balanced</option>
                  <option value="high">High</option>
                  <option value="ultra">Ultra</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#9894b8] mb-1">คุณภาพ Export</label>
                <select
                  value={exportQuality}
                  onChange={(e) => onChangeExportQuality(e.target.value as PerformancePreset)}
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                >
                  <option value="low">Low</option>
                  <option value="balanced">Balanced</option>
                  <option value="high">High (แนะนำ)</option>
                  <option value="ultra">Ultra (สูงสุด)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#9894b8] mb-1">ความละเอียด</label>
                <select
                  value={exportResolution}
                  onChange={(e) => onChangeExportRes(e.target.value as '720' | '1080')}
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                >
                  <option value="720">720×1280 (HD)</option>
                  <option value="1080">1080×1920 (Full HD)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-[#9894b8] mb-1">เฟรมเรต (FPS)</label>
                <select
                  value={exportFps}
                  onChange={(e) => onChangeExportFps(Number(e.target.value) as ExportFps)}
                  className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                >
                  <option value={24}>24 FPS (Cinema)</option>
                  <option value={30}>30 FPS (Standard)</option>
                  <option value={60}>
                    60 FPS {capabilities && capabilities.maxRecommendedFps < 60 ? '(เครื่องอาจช้า)' : '(Smooth)'}
                  </option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#9894b8]">
              <span>
                สถานะซิงก์เสียง: <strong className="text-white">{syncDiagnostics.mode}</strong> ·{' '}
                {hasAudio ? 'มีเสียงพากย์พร้อมมิกซ์' : 'ยังไม่มีเสียงพากย์ (ใช้เสียงดนตรี/SFX ได้)'}
              </span>
              <div className="flex items-center gap-2">
                <span>ขนาดซับ:</span>
                <button
                  type="button"
                  onClick={() =>
                    onChangeSubtitleScale(subtitleScale === 'normal' ? 'large' : 'normal')
                  }
                  className="rounded-lg border border-white/10 bg-[#1b1d29] px-2.5 py-1 text-white cursor-pointer"
                >
                  {subtitleScale === 'large' ? 'ใหญ่' : 'ปกติ'}
                </button>
              </div>
            </div>
          </div>

          {/* Audio Import & MP3 */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onGoVoiceStudio}
                className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#1b1d29] border border-white/10 px-3.5 text-xs font-semibold text-white hover:border-violet-400 cursor-pointer"
              >
                <Mic2 className="h-4 w-4 text-violet-400" aria-hidden="true" />
                <span>พากย์เสียงในห้องพากย์</span>
              </button>
              <label className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-[#1b1d29] border border-white/10 px-3.5 text-xs font-semibold text-white hover:border-violet-400 cursor-pointer">
                <Upload className="h-4 w-4 text-amber-400" aria-hidden="true" />
                <span>นำเข้าไฟล์เสียงเอง</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onImportAudio(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <button
              type="button"
              disabled={isExportingMp3}
              onClick={onDownloadMp3}
              className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 text-xs font-semibold text-white hover:border-emerald-400 cursor-pointer"
            >
              <Music className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <span>{isExportingMp3 ? 'กำลังสร้าง MP3…' : 'ส่งออกเสียงรวม (.mp3)'}</span>
            </button>
          </div>

          {/* Video Export & Verification */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-bold text-white">ส่งออกวิดีโอ (MP4 WebCodecs / WebM Fallback)</h2>
              <button
                type="button"
                onClick={onRunPreflight}
                className="text-xs text-violet-300 hover:text-white underline cursor-pointer"
              >
                ตรวจสอบความพร้อมเครื่อง (Preflight)
              </button>
            </div>

            {preflight && (
              <div className="rounded-xl border border-white/10 bg-[#0b0c12] p-3 text-xs text-[#d6d3eb] space-y-1">
                <div>
                  MP4 WebCodecs:{' '}
                  <strong className={preflight.selectedVideoCodec ? 'text-emerald-300' : 'text-amber-300'}>
                    {preflight.selectedVideoCodec
                      ? `พร้อม (${preflight.selectedWidth}×${preflight.selectedHeight}, ${preflight.selectedVideoCodec})`
                      : 'ไม่รองรับ — ใช้ WebM Fallback แทนได้'}
                  </strong>
                </div>
                <div>
                  Audio Codec: {preflight.selectedAudioCodec || 'opus (WebM)'} · WebM Fallback:{' '}
                  {preflight.webmSupported ? 'รองรับ' : 'ไม่รองรับ'}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              {!isExporting ? (
                <>
                  <button
                    type="button"
                    onClick={() => onExportVideo('auto')}
                    className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-violet-600 px-5 text-sm font-bold text-white hover:bg-violet-500 cursor-pointer"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>สร้างวิดีโอ MP4 ({exportResolution}p · {exportFps} FPS)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onExportVideo('webm')}
                    className="inline-flex items-center gap-2 min-h-[44px] rounded-xl border border-white/10 bg-[#1b1d29] px-4 text-xs font-semibold text-white hover:border-violet-400 cursor-pointer"
                  >
                    <span>ส่งออก WebM (สำรอง)</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onCancelExport}
                  className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-500 cursor-pointer"
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  <span>ยกเลิกการเรนเดอร์</span>
                </button>
              )}
            </div>

            {isExporting && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-violet-300">
                  <span>{exportProgressText}</span>
                  <span className="tabular-nums">{exportProgressPct}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-violet-500 transition-all"
                    style={{ width: `${exportProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            {exportError && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{exportError}</span>
              </div>
            )}

            {exportResult && exportVideoUrl && (
              <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    <span>
                      ตรวจสอบไฟล์ {exportResult.ext.toUpperCase()} เสร็จสมบูรณ์ ({exportResult.usedWidth}×{exportResult.usedHeight} @ {exportResult.usedFps} FPS · {(exportResult.blob.size / 1048576).toFixed(2)} MB)
                    </span>
                  </div>
                  <span>
                    เสียงในไฟล์:{' '}
                    {exportResult.audioVerifiedStatus === 'detected'
                      ? 'พบแทร็กเสียงปกติ'
                      : exportResult.audioVerifiedStatus === 'silent'
                        ? 'เงียบ'
                        : 'ตรวจสอบไม่ได้'}
                  </span>
                </div>

                {exportResult.downscaleWarning && (
                  <p className="text-[11px] text-amber-300">{exportResult.downscaleWarning}</p>
                )}

                <video
                  src={exportVideoUrl}
                  controls
                  playsInline
                  className="max-h-[340px] w-full rounded-xl border border-white/15 bg-black"
                />

                <div className="flex flex-wrap gap-2">
                  <a
                    href={exportVideoUrl}
                    download={`${sanitizeFilename(project.title)}.${exportResult.ext}`}
                    className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>ดาวน์โหลด .{exportResult.ext}</span>
                  </a>
                  <button
                    type="button"
                    onClick={onShareVideo}
                    className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    <Share2 className="h-4 w-4" aria-hidden="true" />
                    <span>แชร์วิดีโอ</span>
                  </button>
                  <button
                    type="button"
                    onClick={onSaveLocal}
                    className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 text-xs font-semibold text-white cursor-pointer"
                  >
                    <FolderDown className="h-4 w-4" aria-hidden="true" />
                    <span>บันทึกชุดไฟล์ลงเครื่อง</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
