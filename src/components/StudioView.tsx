import { useRef, useState, type RefObject } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Film,
  FolderDown,
  Maximize2,
  Mic,
  Music,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import type {
  AccessoryType,
  ActorFace,
  ActorPose,
  CameraMove,
  CardType,
  CartoonProject,
  CartoonStyleKey,
  CharacterDef,
  HairStyle,
  SceneDef,
  SceneFx,
  SceneMood,
  SubtitleStyle,
  SyncDiagnostics,
  TimelineSegment,
  VideoLayoutMode,
} from '../types/cartoon';
import { STYLES, SUBTITLE_STYLE_OPTIONS } from '../utils/cartoonData';
import { CANVAS_H, CANVAS_W } from '../utils/canvasRenderer';
import { formatTimecode, sanitizeFilename } from '../utils/projectLogic';
import type { ExportPreflightStatus, VideoExportResult } from '../utils/videoExport';

interface StudioViewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  project: CartoonProject | null;
  timeline: TimelineSegment[];
  syncDiagnostics: SyncDiagnostics;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isMuted: boolean;
  hasAudio: boolean;
  audioExt: string;
  audioNote: string;
  isGeneratingAudio: boolean;
  isExportingMp3: boolean;
  exportResolution: '720' | '1080';
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
  onRegenerateAudio: () => void;
  onDownloadMp3: () => void;
  onSaveProject: () => void;
  onSaveLocal: () => void;
  onUpdateProject: (next: CartoonProject) => void;
  onChangeExportRes: (res: '720' | '1080') => void;
  onChangeSubtitleScale: (scale: 'normal' | 'large') => void;
  onRunPreflight: () => void;
  onExportVideo: () => void;
  onCancelExport: () => void;
  onShareVideo: () => void;
  onGoCreate: () => void;
}

type EditorTab = 'scenes' | 'timing' | 'characters' | 'export';

const MOODS: Array<{ value: SceneMood; label: string }> = [
  { value: 'paper', label: 'กระดาษสเก็ตช์ (Paper)' },
  { value: 'day', label: 'กลางวันสว่าง' },
  { value: 'dusk', label: 'ยามเย็น' },
  { value: 'night', label: 'กลางคืน' },
  { value: 'dark', label: 'มืดลึกลับ' },
  { value: 'room', label: 'ในห้อง' },
];

const CAMERAS: Array<{ value: CameraMove; label: string }> = [
  { value: 'static', label: 'นิ่ง (Static)' },
  { value: 'push_in', label: 'ซูมเข้าช้าๆ (Push In)' },
  { value: 'pull_out', label: 'ซูมออก (Pull Out)' },
  { value: 'pan_left', label: 'แพนซ้าย' },
  { value: 'pan_right', label: 'แพนขวา' },
  { value: 'tilt_up', label: 'เลื่อนขึ้น' },
  { value: 'shake', label: 'สั่นไหว (Shake)' },
];

const FX_OPTIONS: Array<{ value: SceneFx; label: string }> = [
  { value: 'none', label: 'ไม่มีเอฟเฟกต์' },
  { value: 'sparkles', label: 'ประกายแสง' },
  { value: 'fog', label: 'หมอกจาง' },
  { value: 'rain', label: 'ฝนตก' },
  { value: 'snow', label: 'หิมะโปรย' },
  { value: 'dust', label: 'ฝุ่นละออง' },
];

const POSES: Array<{ value: ActorPose; label: string }> = [
  { value: 'idle', label: 'ยืนปกติ' },
  { value: 'talk', label: 'พูดคุย' },
  { value: 'think', label: 'ครุ่นคิด' },
  { value: 'hold_flower', label: 'ถือช่อดอกไม้' },
  { value: 'cheer', label: 'ดีใจ/ชูมือ' },
  { value: 'scared', label: 'ตกใจ/สั่น' },
  { value: 'walk', label: 'เดิน' },
];

const FACES: Array<{ value: ActorFace; label: string }> = [
  { value: 'neutral', label: 'ปกติ' },
  { value: 'happy', label: 'ยิ้ม' },
  { value: 'smirk', label: 'ยิ้มมุมปาก' },
  { value: 'worried', label: 'กังวล' },
  { value: 'surprised', label: 'ประหลาดใจ' },
  { value: 'scared', label: 'หวาดกลัว' },
  { value: 'sad', label: 'เศร้า' },
  { value: 'angry', label: 'จริงจัง/โกรธ' },
];

export function StudioView({
  canvasRef,
  project,
  timeline,
  syncDiagnostics,
  currentTime,
  totalDuration,
  isPlaying,
  isMuted,
  hasAudio,
  audioNote,
  isGeneratingAudio,
  isExportingMp3,
  exportResolution,
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
  onRegenerateAudio,
  onDownloadMp3,
  onSaveProject,
  onSaveLocal,
  onUpdateProject,
  onChangeExportRes,
  onChangeSubtitleScale,
  onRunPreflight,
  onExportVideo,
  onCancelExport,
  onShareVideo,
  onGoCreate,
}: StudioViewProps) {
  const [editorTab, setEditorTab] = useState<EditorTab>('scenes');
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement | null>(null);

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center space-y-4">
        <Film className="mx-auto h-12 w-12 text-violet-400" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-white">ยังไม่ได้เปิดโปรเจกต์ในสตูดิโอ</h1>
        <p className="text-sm text-[#9894b8]">
          เริ่มต้นสร้างการ์ตูนเรื่องใหม่หรือเปิดโปรเจกต์ตัวอย่างจากหน้าหลักเพื่อดูตัวอย่างและแก้ไขฉาก
        </p>
        <button
          type="button"
          onClick={onGoCreate}
          className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors cursor-pointer"
        >
          ไปที่หน้าสร้างการ์ตูน
        </button>
      </div>
    );
  }

  const safeSceneIdx = Math.min(selectedSceneIdx, Math.max(0, project.scenes.length - 1));
  const activeScene = project.scenes[safeSceneIdx];
  const playingSceneIdx = timeline.findIndex((seg) => currentTime < seg.b);
  const highlightedTimelineIdx = playingSceneIdx < 0 ? timeline.length - 1 : playingSceneIdx;

  function patchScene(idx: number, patch: Partial<SceneDef>, clearAutoDurations = true) {
    const nextScenes = project!.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onUpdateProject({
      ...project!,
      scenes: nextScenes,
      sceneDurations: clearAutoDurations ? undefined : project!.sceneDurations,
    });
  }

  function addScene() {
    const nextScene: SceneDef = {
      narration: 'พิมพ์บทพากย์สำหรับฉากใหม่ตรงนี้.',
      mood: project!.style === 'paper' ? 'paper' : 'night',
      bgPreset: project!.style === 'paper' ? 'paper' : undefined,
      actors: [
        {
          char: project!.characters[0]?.id || 'C1',
          x: 0.5,
          pose: 'talk',
          face: 'happy',
          flip: false,
        },
      ],
      card: null,
      fx: 'none',
      hl: [],
    };
    const nextScenes = [...project!.scenes, nextScene];
    onUpdateProject({ ...project!, scenes: nextScenes, sceneDurations: undefined });
    setSelectedSceneIdx(nextScenes.length - 1);
  }

  function removeScene(idx: number) {
    if (project!.scenes.length <= 1) return;
    const nextScenes = project!.scenes.filter((_, i) => i !== idx);
    onUpdateProject({ ...project!, scenes: nextScenes, sceneDurations: undefined });
    setSelectedSceneIdx(Math.max(0, idx - 1));
  }

  function patchCharacter(idx: number, patch: Partial<CharacterDef>) {
    const nextChars = project!.characters.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onUpdateProject({ ...project!, characters: nextChars });
  }

  function toggleAccessory(charIdx: number, acc: AccessoryType) {
    const ch = project!.characters[charIdx];
    const list = ch.accessories || [];
    const next = list.includes(acc) ? list.filter((a) => a !== acc) : [...list, acc];
    patchCharacter(charIdx, { accessories: next });
  }

  function addCharacter() {
    const nextId = `C${project!.characters.length + 1}`;
    const nextChar: CharacterDef = {
      id: nextId,
      name: `ตัวละคร ${project!.characters.length + 1}`,
      skin: '#f1c27d',
      hair: '#2b211b',
      hairStyle: 'short',
      shirt: '#f59e0b',
      glasses: false,
      accessories: [],
    };
    onUpdateProject({ ...project!, characters: [...project!.characters, nextChar] });
  }

  const canShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    exportResult !== null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: 9:16 Live Canvas & Playback Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div
            ref={stageWrapperRef}
            className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-4 sm:p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-white">{project.title}</h1>
                <div className="text-xs text-[#9894b8] tabular-nums">
                  {STYLES[project.style]?.code || project.style} · {project.layout === 'letterbox' ? '16:9 แถบกลาง' : '9:16 เต็มจอ'} · {project.scenes.length} ฉาก · {formatTimecode(totalDuration)}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="เต็มหน้าจอ"
                  onClick={() => stageWrapperRef.current?.requestFullscreen?.().catch(() => {})}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#1b1d29] text-[#d6d3eb] hover:text-white cursor-pointer"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
                  onClick={onToggleMute}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[#1b1d29] text-white hover:border-violet-400/50 transition-colors cursor-pointer"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4 text-rose-300" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-violet-300" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {!hasAudio && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                เวลาโดยประมาณ ยังไม่ซิงก์กับเสียงจริง (กด &ldquo;พากย์เสียง AI&rdquo; หรือ &ldquo;นำเข้าเสียง&rdquo; เพื่อซิงก์อัตโนมัติ)
              </div>
            )}

            <div className="mx-auto w-full max-w-[320px] sm:max-w-[340px]">
              <canvas
                ref={canvasRef}
                data-testid="studio-canvas"
                width={CANVAS_W}
                height={CANVAS_H}
                className="w-full rounded-2xl bg-black shadow-2xl border border-white/10 aspect-[9/16]"
              />
            </div>

            {/* Scrubber & Play/Pause */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={isPlaying ? 'หยุดชั่วคราว' : 'เล่นวิดีโอ'}
                onClick={onTogglePlay}
                className="flex h-11 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-colors cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Play className="h-5 w-5" aria-hidden="true" />
                )}
              </button>

              <input
                type="range"
                aria-label="เลื่อนเวลาวิดีโอ"
                min={0}
                max={totalDuration}
                step={0.02}
                value={Math.min(currentTime, totalDuration)}
                onChange={(e) => onSeek(Number(e.target.value))}
                className="studio-range flex-1"
              />

              <span className="font-mono-tabular text-xs text-[#d6d3eb] shrink-0">
                {formatTimecode(currentTime)} / {formatTimecode(totalDuration)}
              </span>
            </div>

            {/* Scene Quick Jump Strip */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {timeline.map((seg, i) => {
                const isActive = i === highlightedTimelineIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setSelectedSceneIdx(i);
                      onSeek(seg.a + Math.min(0.35, (seg.b - seg.a) * 0.2));
                    }}
                    className={`min-h-[34px] rounded-lg border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors cursor-pointer ${
                      isActive
                        ? 'border-violet-400 bg-violet-500/20 text-white'
                        : 'border-white/10 bg-[#0a0b10] text-[#9894b8] hover:text-white'
                    }`}
                  >
                    ฉาก {i + 1}
                  </button>
                );
              })}
            </div>

            {/* Studio Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={isGeneratingAudio}
                onClick={onRegenerateAudio}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-2 text-xs font-medium text-white hover:border-violet-400/50 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <Mic className="h-4 w-4 text-violet-400 shrink-0" aria-hidden="true" />
                <span>{isGeneratingAudio ? 'กำลังพากย์…' : 'พากย์เสียง AI'}</span>
              </button>

              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-2 text-xs font-medium text-white hover:border-violet-400/50 transition-colors cursor-pointer"
              >
                <Upload className="h-4 w-4 text-violet-400 shrink-0" aria-hidden="true" />
                <span>นำเข้าเสียงพากย์</span>
              </button>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportAudio(file);
                  e.target.value = '';
                }}
              />

              <button
                type="button"
                onClick={onSaveProject}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-2 text-xs font-medium text-white hover:border-violet-400/50 transition-colors cursor-pointer"
              >
                <Save className="h-4 w-4 text-violet-400 shrink-0" aria-hidden="true" />
                <span>บันทึกโปรเจกต์</span>
              </button>

              <button
                type="button"
                onClick={onSaveLocal}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-2 text-xs font-medium text-white hover:border-violet-400/50 transition-colors cursor-pointer"
              >
                <FolderDown className="h-4 w-4 text-violet-400 shrink-0" aria-hidden="true" />
                <span>บันทึกลงเครื่อง</span>
              </button>
            </div>

            {project.cineLayer?.enabled !== undefined && (
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0a0b10] px-3.5 py-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-[#d6d3eb]">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  <span>Cinematic Grade (โทน 2.5D)</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateProject({
                      ...project,
                      cineLayer: {
                        ...project.cineLayer,
                        enabled: !project.cineLayer?.enabled,
                      },
                    })
                  }
                  className={`rounded-lg px-3 py-1 font-semibold cursor-pointer ${
                    project.cineLayer?.enabled
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                      : 'bg-[#1b1d29] text-[#9894b8] border border-white/10'
                  }`}
                >
                  {project.cineLayer?.enabled ? 'เปิดอยู่' : 'ปิดอยู่'}
                </button>
              </div>
            )}

            {audioNote && (
              <div className="rounded-xl border border-white/10 bg-[#0a0b10] px-3.5 py-2.5 text-xs text-[#d6d3eb]">
                {audioNote}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scene Editor, Timing & Sync, Characters & Style, Export MP4 */}
        <div className="lg:col-span-7 space-y-5">
          <div
            role="tablist"
            aria-label="เครื่องมือสตูดิโอ"
            className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl border border-white/[0.08] bg-[#13141d] p-1.5"
          >
            {(
              [
                ['scenes', 'ฉากและบท'],
                ['timing', 'เวลา & ซิงก์'],
                ['characters', 'ตัวละคร & สไตล์'],
                ['export', 'ส่งออก MP4'],
              ] as Array<[EditorTab, string]>
            ).map(([id, label]) => {
              const active = editorTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setEditorTab(id);
                    if (id === 'export') onRunPreflight();
                  }}
                  className={`min-h-[44px] rounded-xl px-2.5 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active ? 'bg-violet-600 text-white' : 'text-[#9894b8] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Scene & Script Editor */}
          {editorTab === 'scenes' && activeScene && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-5">
              <div>
                <label htmlFor="project-title-input" className="block text-xs font-medium text-[#9894b8] mb-1.5">
                  ชื่อเรื่อง
                </label>
                <input
                  id="project-title-input"
                  type="text"
                  value={project.title}
                  onChange={(e) => onUpdateProject({ ...project, title: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 text-sm font-semibold text-white"
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {project.scenes.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSelectedSceneIdx(i);
                        const seg = timeline[i];
                        if (seg) onSeek(seg.a + Math.min(0.35, (seg.b - seg.a) * 0.2));
                      }}
                      className={`min-h-[38px] rounded-lg border px-3 py-1 text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                        safeSceneIdx === i
                          ? 'border-violet-400 bg-violet-500/20 text-white'
                          : 'border-white/10 bg-[#0a0b10] text-[#9894b8] hover:text-white'
                      }`}
                    >
                      ฉาก {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={addScene}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-dashed border-white/20 px-3 py-1 text-xs font-medium text-violet-300 hover:border-violet-400 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>เพิ่มฉาก</span>
                  </button>
                </div>

                {project.scenes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeScene(safeSceneIdx)}
                    aria-label={`ลบฉาก ${safeSceneIdx + 1}`}
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/20 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>ลบฉากนี้</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="scene-narration" className="block text-sm font-medium text-white mb-1.5">
                    บทพากย์ฉากที่ {safeSceneIdx + 1}
                  </label>
                  <textarea
                    id="scene-narration"
                    rows={3}
                    value={activeScene.narration}
                    onChange={(e) => patchScene(safeSceneIdx, { narration: e.target.value })}
                    className="w-full rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2.5 text-sm text-white"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="scene-sub-en" className="block text-xs font-medium text-[#9894b8] mb-1">
                      ซับอังกฤษรอง (สำหรับสไตล์ sticker_dual)
                    </label>
                    <input
                      id="scene-sub-en"
                      type="text"
                      value={activeScene.subtitleEn || ''}
                      onChange={(e) =>
                        patchScene(safeSceneIdx, { subtitleEn: e.target.value }, false)
                      }
                      placeholder="English translation subtitle..."
                      className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label htmlFor="scene-hud-text" className="block text-xs font-medium text-[#9894b8] mb-1">
                      ข้อความ HUD มุมบนของฉากนี้
                    </label>
                    <input
                      id="scene-hud-text"
                      type="text"
                      value={activeScene.hudText || ''}
                      onChange={(e) => patchScene(safeSceneIdx, { hudText: e.target.value }, false)}
                      placeholder="เช่น จันทร์ · 05:58"
                      className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="scene-mood" className="block text-xs font-medium text-[#9894b8] mb-1">
                      พื้นหลัง / บรรยากาศ
                    </label>
                    <select
                      id="scene-mood"
                      value={activeScene.mood}
                      onChange={(e) =>
                        patchScene(safeSceneIdx, { mood: e.target.value as SceneMood }, false)
                      }
                      className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-2.5 text-xs text-white"
                    >
                      {MOODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="scene-camera" className="block text-xs font-medium text-[#9894b8] mb-1">
                      มุมกล้อง
                    </label>
                    <select
                      id="scene-camera"
                      value={activeScene.camera || 'static'}
                      onChange={(e) =>
                        patchScene(safeSceneIdx, { camera: e.target.value as CameraMove }, false)
                      }
                      className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-2.5 text-xs text-white"
                    >
                      {CAMERAS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="scene-fx" className="block text-xs font-medium text-[#9894b8] mb-1">
                      เอฟเฟกต์
                    </label>
                    <select
                      id="scene-fx"
                      value={activeScene.fx}
                      onChange={(e) =>
                        patchScene(safeSceneIdx, { fx: e.target.value as SceneFx }, false)
                      }
                      className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-2.5 text-xs text-white"
                    >
                      {FX_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="scene-hl" className="block text-xs font-medium text-[#9894b8] mb-1">
                    คำเน้นสี / ไฮไลต์ซับไตเติล (คั่นด้วยจุลภาค)
                  </label>
                  <input
                    id="scene-hl"
                    type="text"
                    value={activeScene.hl.join(', ')}
                    onChange={(e) =>
                      patchScene(
                        safeSceneIdx,
                        {
                          hl: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        },
                        false
                      )
                    }
                    className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                  />
                </div>
              </div>

              {/* Actors */}
              <div className="border-t border-white/[0.08] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">ตัวละครในฉาก</h3>
                  {activeScene.actors.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        patchScene(
                          safeSceneIdx,
                          {
                            actors: [
                              ...activeScene.actors,
                              {
                                char: project.characters[0]?.id || 'C1',
                                x: activeScene.actors.length === 0 ? 0.5 : 0.72,
                                pose: 'idle',
                                face: 'happy',
                                flip: activeScene.actors.length > 0,
                              },
                            ],
                          },
                          false
                        )
                      }
                      className="text-xs font-medium text-violet-300 hover:text-violet-200 cursor-pointer"
                    >
                      + เพิ่มตัวละครในฉาก
                    </button>
                  )}
                </div>

                {activeScene.actors.map((actor, aIdx) => (
                  <div
                    key={aIdx}
                    className="rounded-xl border border-white/[0.08] bg-[#0a0b10] p-3 space-y-2.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#d6d3eb]">ตัวแสดงที่ {aIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() =>
                          patchScene(
                            safeSceneIdx,
                            { actors: activeScene.actors.filter((_, idx) => idx !== aIdx) },
                            false
                          )
                        }
                        className="text-rose-300 cursor-pointer"
                      >
                        นำออก
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <select
                        aria-label={`เลือกตัวละครที่ ${aIdx + 1}`}
                        value={actor.char}
                        onChange={(e) => {
                          const next = activeScene.actors.map((a, i) =>
                            i === aIdx ? { ...a, char: e.target.value } : a
                          );
                          patchScene(safeSceneIdx, { actors: next }, false);
                        }}
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2 text-xs text-white"
                      >
                        {project.characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`ท่าทางที่ ${aIdx + 1}`}
                        value={actor.pose}
                        onChange={(e) => {
                          const next = activeScene.actors.map((a, i) =>
                            i === aIdx ? { ...a, pose: e.target.value as ActorPose } : a
                          );
                          patchScene(safeSceneIdx, { actors: next }, false);
                        }}
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2 text-xs text-white"
                      >
                        {POSES.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label={`สีหน้าที่ ${aIdx + 1}`}
                        value={actor.face}
                        onChange={(e) => {
                          const next = activeScene.actors.map((a, i) =>
                            i === aIdx ? { ...a, face: e.target.value as ActorFace } : a
                          );
                          patchScene(safeSceneIdx, { actors: next }, false);
                        }}
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2 text-xs text-white"
                      >
                        {FACES.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Editor */}
              <div className="border-t border-white/[0.08] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">การ์ดประกอบฉาก</h3>
                  <select
                    aria-label="ประเภทการ์ดประกอบฉาก"
                    value={activeScene.card?.type || 'none'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'none') {
                        patchScene(safeSceneIdx, { card: null }, false);
                      } else {
                        patchScene(
                          safeSceneIdx,
                          {
                            card: {
                              type: val as CardType,
                              text: activeScene.card?.text || 'ข้อความสำคัญ',
                              label: activeScene.card?.label || '',
                              items: activeScene.card?.items || ['ข้อที่ 1', 'ข้อที่ 2'],
                              chatTitle: activeScene.card?.chatTitle || 'กลุ่มแชต',
                              messages: activeScene.card?.messages || [
                                { sender: 'เพื่อน', text: 'สวัสดีวันจันทร์!' },
                              ],
                              values: activeScene.card?.values || [40, 75, 95],
                              labels: activeScene.card?.labels || ['ก.ย.', 'ต.ค.', 'พ.ย.'],
                            },
                          },
                          false
                        );
                      }
                    }}
                    className="min-h-[38px] rounded-lg border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                  >
                    <option value="none">ไม่มีการ์ด</option>
                    <option value="text">การ์ดข้อความ (Text)</option>
                    <option value="bignumber">ตัวเลขเด่น (Big Number)</option>
                    <option value="phone_mockup">หน้าจอแชต (Phone Mockup)</option>
                    <option value="list">รายการ (List)</option>
                    <option value="checklist">เช็กลิสต์ (Checklist)</option>
                    <option value="bar_chart">กราฟแท่ง (Bar Chart)</option>
                    <option value="compare">เปรียบเทียบ 2 ฝั่ง (Compare)</option>
                    <option value="end">การ์ดปิดท้าย (End Card)</option>
                  </select>
                </div>

                {activeScene.card && (
                  <div className="rounded-xl border border-white/[0.08] bg-[#0a0b10] p-3.5 space-y-2.5">
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <input
                        type="text"
                        aria-label="ข้อความหลักบนการ์ด"
                        value={activeScene.card.text}
                        onChange={(e) =>
                          patchScene(
                            safeSceneIdx,
                            { card: { ...activeScene.card!, text: e.target.value } },
                            false
                          )
                        }
                        placeholder="ข้อความหลัก / ตัวเลข"
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                      />
                      <input
                        type="text"
                        aria-label="คำอธิบายรองบนการ์ด"
                        value={activeScene.card.label || ''}
                        onChange={(e) =>
                          patchScene(
                            safeSceneIdx,
                            { card: { ...activeScene.card!, label: e.target.value } },
                            false
                          )
                        }
                        placeholder="คำอธิบายรอง"
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                      />
                    </div>
                    {(activeScene.card.type === 'list' || activeScene.card.type === 'checklist') && (
                      <input
                        type="text"
                        aria-label="รายการย่อยบนการ์ด"
                        value={(activeScene.card.items || []).join(', ')}
                        onChange={(e) =>
                          patchScene(
                            safeSceneIdx,
                            {
                              card: {
                                ...activeScene.card!,
                                items: e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              },
                            },
                            false
                          )
                        }
                        placeholder="คั่นรายการด้วยจุลภาค (,)"
                        className="w-full min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Timing & Sync Panel (Manual Duration + ±0.1s Fine Tune + Pause Report) */}
          {editorTab === 'timing' && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Clock className="h-4 w-4 text-violet-400" aria-hidden="true" />
                    <span>กำหนดเวลาแต่ละฉาก &amp; ปรับจุดซิงก์</span>
                  </h2>
                  <p className="mt-1 text-xs text-[#9894b8]">
                    สถานะซิงก์: โหมด <span className="text-white font-medium">{syncDiagnostics.mode}</span> · พบช่วงเงียบ{' '}
                    <span className="tabular-nums text-white">{syncDiagnostics.foundPauses}</span> จุด · จับคู่รอยต่อได้{' '}
                    <span className="tabular-nums text-white">
                      {syncDiagnostics.matchedBoundaries}/{syncDiagnostics.totalBoundaries}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProject({
                        ...project,
                        globalOffset: Number(((project.globalOffset ?? 0) - 0.1).toFixed(2)),
                      })
                    }
                    className="min-h-[36px] rounded-lg border border-white/15 bg-[#0a0b10] px-2.5 text-xs font-medium text-white hover:border-violet-400 cursor-pointer"
                  >
                    ทั้งคลิป −0.1 วิ
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateProject({
                        ...project,
                        globalOffset: Number(((project.globalOffset ?? 0) + 0.1).toFixed(2)),
                      })
                    }
                    className="min-h-[36px] rounded-lg border border-white/15 bg-[#0a0b10] px-2.5 text-xs font-medium text-white hover:border-violet-400 cursor-pointer"
                  >
                    ทั้งคลิป +0.1 วิ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const resetScenes = project.scenes.map((s) => ({
                        ...s,
                        manualDurationSec: undefined,
                        syncOffset: 0,
                      }));
                      onUpdateProject({ ...project, globalOffset: 0, scenes: resetScenes });
                    }}
                    title="รีเซ็ตเวลาเป็นอัตโนมัติ"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/10 bg-[#1b1d29] px-2.5 text-xs text-[#9894b8] hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>รีเซ็ต</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {project.scenes.map((sc, i) => {
                  const seg = timeline[i];
                  const segDur = seg ? seg.b - seg.a : 0;
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-white/[0.08] bg-[#0a0b10] p-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-white">
                          <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-violet-300 tabular-nums">
                            ฉาก {i + 1}
                          </span>
                          <span className="font-mono-tabular text-[#9894b8]">
                            {seg ? `${seg.a.toFixed(2)}s → ${seg.b.toFixed(2)}s (${segDur.toFixed(2)}s)` : ''}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-[#9894b8]">{sc.narration}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <label className="inline-flex items-center gap-1 text-[11px] text-[#9894b8]">
                          <span>เวลา (วิ)</span>
                          <input
                            type="number"
                            aria-label={`กำหนดเวลาฉากที่ ${i + 1} (วินาที)`}
                            step={0.1}
                            min={1}
                            max={60}
                            value={sc.manualDurationSec ?? ''}
                            placeholder={segDur.toFixed(1)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              patchScene(
                                i,
                                { manualDurationSec: raw === '' ? undefined : Number(raw) },
                                false
                              );
                            }}
                            className="w-16 min-h-[34px] rounded-lg border border-white/15 bg-[#13141d] px-2 text-xs text-white tabular-nums"
                          />
                        </label>

                        <button
                          type="button"
                          aria-label={`ลดเวลาซิงก์ฉาก ${i + 1} ลง 0.1 วินาที`}
                          onClick={() =>
                            patchScene(
                              i,
                              { syncOffset: Number(((sc.syncOffset ?? 0) - 0.1).toFixed(2)) },
                              false
                            )
                          }
                          className="min-h-[34px] rounded-lg border border-white/15 bg-[#13141d] px-2 text-xs text-white hover:border-violet-400 cursor-pointer"
                        >
                          −0.1
                        </button>
                        <button
                          type="button"
                          aria-label={`เพิ่มเวลาซิงก์ฉาก ${i + 1} ขึ้น 0.1 วินาที`}
                          onClick={() =>
                            patchScene(
                              i,
                              { syncOffset: Number(((sc.syncOffset ?? 0) + 0.1).toFixed(2)) },
                              false
                            )
                          }
                          className="min-h-[34px] rounded-lg border border-white/15 bg-[#13141d] px-2 text-xs text-white hover:border-violet-400 cursor-pointer"
                        >
                          +0.1
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: Characters, Layout & Visual Style */}
          {editorTab === 'characters' && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-white mb-2.5">สไตล์ภาพ เค้าโครง และซับไตเติล</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {Object.values(STYLES).map((st) => {
                    const active = project.style === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() =>
                          onUpdateProject({ ...project, style: st.key as CartoonStyleKey })
                        }
                        className={`relative overflow-hidden rounded-xl border p-2.5 text-left min-h-[64px] cursor-pointer ${
                          active ? 'border-white ring-2 ring-violet-400' : 'border-white/10'
                        }`}
                        style={{
                          background: `linear-gradient(155deg, ${st.t}, ${st.b} 70%, ${st.g})`,
                        }}
                      >
                        <div className="absolute inset-0 bg-black/50" />
                        <div className="relative z-10 text-[11px] font-bold text-white leading-tight">
                          {st.code}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="studio-layout-select" className="block text-[11px] text-[#9894b8] mb-1">
                      รูปแบบหน้าจอ (Layout)
                    </label>
                    <select
                      id="studio-layout-select"
                      value={project.layout || 'full'}
                      onChange={(e) =>
                        onUpdateProject({
                          ...project,
                          layout: e.target.value as VideoLayoutMode,
                          letterbox: project.letterbox || {
                            topText: project.title,
                            bottomText: 'ดูให้จบ',
                          },
                        })
                      }
                      className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                    >
                      <option value="full">9:16 เต็มจอ</option>
                      <option value="letterbox">แถบกลาง 16:9 (หัวข้อบน/ล่าง)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="studio-sub-style" className="block text-[11px] text-[#9894b8] mb-1">
                      สไตล์ซับไตเติล
                    </label>
                    <select
                      id="studio-sub-style"
                      value={project.subtitleStyle || 'sticker_dual'}
                      onChange={(e) =>
                        onUpdateProject({
                          ...project,
                          subtitleStyle: e.target.value as SubtitleStyle,
                        })
                      }
                      className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                    >
                      {SUBTITLE_STYLE_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {project.layout === 'letterbox' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <input
                      type="text"
                      aria-label="ข้อความด้านบนเฟรม 16:9"
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
                      placeholder="ข้อความบนเฟรม 16:9"
                      className="min-h-[38px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                    />
                    <input
                      type="text"
                      aria-label="ข้อความด้านล่างเฟรม 16:9"
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
                      placeholder="ข้อความล่างเฟรม 16:9"
                      className="min-h-[38px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                    />
                  </div>
                )}
              </div>

              <div className="border-t border-white/[0.08] pt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">ปรับแต่งตัวละคร</h2>
                  {project.characters.length < 6 && (
                    <button
                      type="button"
                      onClick={addCharacter}
                      className="text-xs font-medium text-violet-300 cursor-pointer"
                    >
                      + เพิ่มตัวละคร
                    </button>
                  )}
                </div>

                {project.characters.map((ch, idx) => (
                  <div
                    key={ch.id}
                    className="rounded-xl border border-white/[0.08] bg-[#0a0b10] p-4 space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        aria-label={`ชื่อตัวละคร ${idx + 1}`}
                        value={ch.name}
                        onChange={(e) => patchCharacter(idx, { name: e.target.value })}
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2.5 text-xs text-white"
                      />
                      <select
                        aria-label={`ทรงผมตัวละคร ${idx + 1}`}
                        value={ch.hairStyle}
                        onChange={(e) =>
                          patchCharacter(idx, { hairStyle: e.target.value as HairStyle })
                        }
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2.5 text-xs text-white"
                      >
                        <option value="short">ผมสั้น</option>
                        <option value="long">ผมยาว</option>
                        <option value="bun">มวยผม</option>
                        <option value="ponytail">หางม้า</option>
                        <option value="curly">ผมหยิก</option>
                        <option value="bald">ไม่มีผม</option>
                      </select>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#d6d3eb]">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(ch.glasses)}
                            onChange={(e) => patchCharacter(idx, { glasses: e.target.checked })}
                          />
                          <span>แว่น</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(ch.accessories?.includes('flower_hat'))}
                            onChange={() => toggleAccessory(idx, 'flower_hat')}
                          />
                          <span>หมวกดอกไม้</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(ch.accessories?.includes('scarf'))}
                            onChange={() => toggleAccessory(idx, 'scarf')}
                          />
                          <span>ผ้าพันคอ</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-[#9894b8]">
                      <label className="inline-flex items-center gap-2">
                        <span>สีผิว</span>
                        <input
                          type="color"
                          value={ch.skin}
                          onChange={(e) => patchCharacter(idx, { skin: e.target.value })}
                          className="h-7 w-10 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <span>สีผม</span>
                        <input
                          type="color"
                          value={ch.hair}
                          onChange={(e) => patchCharacter(idx, { hair: e.target.value })}
                          className="h-7 w-10 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <span>สีเสื้อ</span>
                        <input
                          type="color"
                          value={ch.shirt}
                          onChange={(e) => patchCharacter(idx, { shirt: e.target.value })}
                          className="h-7 w-10 rounded border border-white/20 bg-transparent cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 4: Export MP4 & MP3 */}
          {editorTab === 'export' && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">ส่งออกวิดีโอ MP4 และเสียง MP3</h2>
                <p className="mt-1 text-xs text-[#9894b8]">
                  ระบบเลือกความละเอียดและโค้ดเดก H.264 ที่เครื่องรองรับอัตโนมัติ (เฉพาะไฟล์ .mp4 และ .mp3)
                </p>
              </div>

              {/* Preflight Checklist */}
              {preflight && (
                <div className="rounded-xl border border-white/10 bg-[#0a0b10] p-4 space-y-2 text-xs">
                  <div className="font-semibold text-white mb-1">ตรวจสอบความพร้อม (Preflight)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[#d6d3eb]">
                    <div className="flex items-center gap-2">
                      {preflight.hasVoiceover ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                      )}
                      <span>{preflight.hasVoiceover ? 'มีเสียงพากย์นำเข้าแล้ว' : 'ยังไม่มีเสียงพากย์ (ใช้เพลง/SFX)'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {preflight.webCodecsSupported ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
                      )}
                      <span>WebCodecs VideoEncoder: {preflight.webCodecsSupported ? 'พร้อม' : 'ไม่รองรับ'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span>
                        ความละเอียด: {preflight.selectedWidth}×{preflight.selectedHeight} ({preflight.selectedVideoCodec || '—'})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      <span>โค้ดเดกเสียง: {preflight.selectedAudioCodec || 'aac'}</span>
                    </div>
                  </div>
                  {preflight.fatalError && (
                    <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/15 p-3 text-amber-200">
                      {preflight.fatalError}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ex-res" className="block text-xs font-medium text-[#9894b8] mb-1.5">
                    ความละเอียดเป้าหมาย
                  </label>
                  <select
                    id="ex-res"
                    value={exportResolution}
                    onChange={(e) => {
                      onChangeExportRes(e.target.value as '720' | '1080');
                      setTimeout(onRunPreflight, 20);
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-sm text-white"
                  >
                    <option value="720">720p (720×1280 · แนะนำ รวดเร็ว)</option>
                    <option value="1080">คุณภาพสูง 1080p (1080×1920)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ex-sub" className="block text-xs font-medium text-[#9894b8] mb-1.5">
                    ขนาดซับไตเติล
                  </label>
                  <select
                    id="ex-sub"
                    value={subtitleScale}
                    onChange={(e) => onChangeSubtitleScale(e.target.value as 'normal' | 'large')}
                    className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-sm text-white"
                  >
                    <option value="normal">ขนาดมาตรฐาน</option>
                    <option value="large">ขนาดใหญ่พิเศษ</option>
                  </select>
                </div>
              </div>

              {exportError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
                >
                  {exportError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={isExporting || Boolean(preflight?.fatalError)}
                  onClick={onExportVideo}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-60 cursor-pointer"
                >
                  <Film className="h-4 w-4" aria-hidden="true" />
                  <span>{isExporting ? 'กำลังสร้างไฟล์ MP4…' : 'สร้างวิดีโอ MP4'}</span>
                </button>

                <button
                  type="button"
                  disabled={isExportingMp3}
                  onClick={onDownloadMp3}
                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-[#1b1d29] px-5 py-3 text-sm font-semibold text-white hover:border-violet-400/50 disabled:opacity-60 cursor-pointer"
                >
                  <Music className="h-4 w-4 text-violet-400" aria-hidden="true" />
                  <span>{isExportingMp3 ? 'กำลังแปลง MP3…' : 'ดาวน์โหลดเสียงรวม (MP3)'}</span>
                </button>
              </div>

              {(isExporting || exportProgressPct > 0) && (
                <div className="rounded-xl border border-white/10 bg-[#0a0b10] p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-[#d6d3eb]">
                    <span>{exportProgressText}</span>
                    <span className="font-mono-tabular">{exportProgressPct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-200"
                      style={{ width: `${exportProgressPct}%` }}
                    />
                  </div>
                  {isExporting && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-amber-300">
                        อย่าสลับแอปหรือล็อกหน้าจอระหว่างกำลังสร้างวิดีโอ
                      </span>
                      <button
                        type="button"
                        onClick={onCancelExport}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-3 py-1 text-xs text-rose-200 cursor-pointer"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Exported Result & VERIFY */}
              {exportVideoUrl && exportResult && (
                <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-emerald-300">
                      ตรวจแล้ว: {exportResult.usedWidth}×{exportResult.usedHeight} · ไฟล์ .{exportResult.ext} ·{' '}
                      {(exportResult.blob.size / 1048576).toFixed(2)} MB
                    </span>
                    <span className="text-xs text-[#d6d3eb] tabular-nums">
                      {exportResult.durationSec ? `ความยาว ${exportResult.durationSec.toFixed(1)} วิ · ` : ''}
                      เสียง:{' '}
                      {exportResult.audioVerifiedStatus === 'detected'
                        ? 'พบแทร็กเสียงจริง'
                        : exportResult.audioVerifiedStatus === 'silent'
                          ? 'เงียบ'
                          : 'กรุณากดเล่นเพื่อฟังจริง'}
                    </span>
                  </div>

                  {exportResult.audioVerifiedStatus === 'silent' && (
                    <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200">
                      คำเตือน: ตรวจพบว่าไฟล์วิดีโอไม่มีเสียง แนะนำกดดาวน์โหลดเสียงรวม (MP3) คู่กัน
                    </div>
                  )}

                  <video
                    controls
                    playsInline
                    src={exportVideoUrl}
                    className="mx-auto w-full max-w-[260px] rounded-xl bg-black aspect-[9/16]"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {canShare && (
                      <button
                        type="button"
                        onClick={onShareVideo}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1b1d29] px-4 text-sm font-semibold text-white cursor-pointer"
                      >
                        <Share2 className="h-4 w-4 text-violet-400" aria-hidden="true" />
                        <span>บันทึก / แชร์</span>
                      </button>
                    )}

                    <a
                      href={exportVideoUrl}
                      download={`${sanitizeFilename(project.title)}.mp4`}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      <span>ดาวน์โหลดไฟล์ MP4</span>
                    </a>

                    <button
                      type="button"
                      onClick={onDownloadMp3}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1b1d29] px-4 text-sm font-semibold text-white cursor-pointer"
                    >
                      <Music className="h-4 w-4 text-violet-400" aria-hidden="true" />
                      <span>ดาวน์โหลดเสียง MP3</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.open(exportVideoUrl, '_blank')}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1b1d29] px-4 text-sm font-semibold text-white cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4 text-violet-400" aria-hidden="true" />
                      <span>เปิดวิดีโอเต็มหน้า</span>
                    </button>
                  </div>

                  <p className="text-[11px] leading-relaxed text-[#9894b8]">
                    วิธีบันทึกบนมือถือ: แตะค้างที่วิดีโอแล้วเลือก &ldquo;บันทึกวิดีโอ&rdquo; / Chrome: กดเมนู ⋮ บนตัวเล่นแล้วเลือก Download / iPhone: ใช้ปุ่ม &ldquo;บันทึก / แชร์&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
