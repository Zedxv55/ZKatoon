import { useRef, useState, type RefObject } from 'react';
import {
  Download,
  Film,
  FolderDown,
  Mic,
  Pause,
  Play,
  Plus,
  Save,
  Share2,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  ActorFace,
  ActorPose,
  CardType,
  CartoonProject,
  CartoonStyleKey,
  CharacterDef,
  HairStyle,
  SceneDef,
  SceneFx,
  SceneMood,
  TimelineSegment,
} from '../types/cartoon';
import { STYLES } from '../utils/cartoonData';
import { CANVAS_H, CANVAS_W } from '../utils/canvasRenderer';
import { formatTimecode, sanitizeFilename } from '../utils/projectLogic';
import type { VideoExportResult } from '../utils/videoExport';

interface StudioViewProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  project: CartoonProject | null;
  timeline: TimelineSegment[];
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  isMuted: boolean;
  hasAudio: boolean;
  audioExt: string;
  audioNote: string;
  isGeneratingAudio: boolean;
  exportResolution: '720' | '1080';
  subtitleScale: 'normal' | 'large';
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
  onDownloadAudio: () => void;
  onSaveProject: () => void;
  onSaveLocal: () => void;
  onUpdateProject: (next: CartoonProject) => void;
  onChangeExportRes: (res: '720' | '1080') => void;
  onChangeSubtitleScale: (scale: 'normal' | 'large') => void;
  onExportVideo: () => void;
  onShareVideo: () => void;
  onGoCreate: () => void;
}

type EditorTab = 'scenes' | 'characters' | 'export';

const MOODS: Array<{ value: SceneMood; label: string }> = [
  { value: 'day', label: 'กลางวันสว่าง' },
  { value: 'dusk', label: 'ยามเย็น' },
  { value: 'night', label: 'กลางคืน' },
  { value: 'dark', label: 'มืดลึกลับ' },
  { value: 'room', label: 'ในห้อง' },
];

const FX_OPTIONS: Array<{ value: SceneFx; label: string }> = [
  { value: 'none', label: 'ไม่มีเอฟเฟกต์' },
  { value: 'sparkles', label: 'ประกายแสง' },
  { value: 'fog', label: 'หมอกจาง' },
  { value: 'rain', label: 'ฝนตก' },
  { value: 'snow', label: 'หิมะโปรย' },
];

const POSES: Array<{ value: ActorPose; label: string }> = [
  { value: 'idle', label: 'ยืนปกติ' },
  { value: 'talk', label: 'พูดคุย' },
  { value: 'cheer', label: 'ดีใจ/ชูมือ' },
  { value: 'think', label: 'ครุ่นคิด' },
  { value: 'scared', label: 'ตกใจ/สั่น' },
  { value: 'walk', label: 'เดิน' },
];

const FACES: Array<{ value: ActorFace; label: string }> = [
  { value: 'neutral', label: 'ปกติ' },
  { value: 'happy', label: 'ยิ้ม' },
  { value: 'smirk', label: 'ยิ้มมุมปาก' },
  { value: 'surprised', label: 'ประหลาดใจ' },
  { value: 'scared', label: 'หวาดกลัว' },
  { value: 'sad', label: 'เศร้า' },
  { value: 'angry', label: 'จริงจัง/โกรธ' },
];

export function StudioView({
  canvasRef,
  project,
  timeline,
  currentTime,
  totalDuration,
  isPlaying,
  isMuted,
  hasAudio,
  audioExt,
  audioNote,
  isGeneratingAudio,
  exportResolution,
  subtitleScale,
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
  onDownloadAudio,
  onSaveProject,
  onSaveLocal,
  onUpdateProject,
  onChangeExportRes,
  onChangeSubtitleScale,
  onExportVideo,
  onShareVideo,
  onGoCreate,
}: StudioViewProps) {
  const [editorTab, setEditorTab] = useState<EditorTab>('scenes');
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

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

  function patchScene(idx: number, patch: Partial<SceneDef>) {
    const nextScenes = project!.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onUpdateProject({ ...project!, scenes: nextScenes, sceneDurations: undefined });
  }

  function addScene() {
    const nextScene: SceneDef = {
      narration: 'พิมพ์บทพากย์สำหรับฉากใหม่ตรงนี้.',
      mood: 'night',
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
    };
    onUpdateProject({ ...project!, characters: [...project!.characters, nextChar] });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: 9:16 Live Canvas & Playback Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold text-white">{project.title}</h1>
                <div className="text-xs text-[#9894b8] tabular-nums">
                  {STYLES[project.style]?.n} · {project.scenes.length} ฉาก · {formatTimecode(totalDuration)}
                </div>
              </div>
              <button
                type="button"
                aria-label={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
                onClick={onToggleMute}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#1b1d29] text-white hover:border-violet-400/50 transition-colors cursor-pointer"
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4 text-rose-300" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4 text-violet-300" aria-hidden="true" />
                )}
              </button>
            </div>

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
                <span>นำเข้าเสียง</span>
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

            {audioNote && (
              <div className="rounded-xl border border-white/10 bg-[#0a0b10] px-3.5 py-2.5 text-xs text-[#d6d3eb]">
                {audioNote}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Scene Editor, Characters & Style, Export MP4 */}
        <div className="lg:col-span-7 space-y-5">
          {/* Segmented Editor Tabs */}
          <div
            role="tablist"
            aria-label="เครื่องมือสตูดิโอ"
            className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/[0.08] bg-[#13141d] p-1.5"
          >
            {(
              [
                ['scenes', 'แก้ไขฉากและบท'],
                ['characters', 'ตัวละครและสไตล์'],
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
                  onClick={() => setEditorTab(id)}
                  className={`min-h-[44px] rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-violet-600 text-white'
                      : 'text-[#9894b8] hover:text-white'
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
                  ชื่อเรื่อง (แสดงบนแบนเนอร์เปิดเรื่อง)
                </label>
                <input
                  id="project-title-input"
                  type="text"
                  value={project.title}
                  onChange={(e) => onUpdateProject({ ...project, title: e.target.value })}
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2 text-sm font-semibold text-white focus:border-violet-400 focus:outline-none"
                />
              </div>

              {/* Scene Selector Pills */}
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
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-dashed border-white/20 px-3 py-1 text-xs font-medium text-violet-300 hover:border-violet-400 transition-colors cursor-pointer"
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
                    className="inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>ลบฉากนี้</span>
                  </button>
                )}
              </div>

              {/* Narration & Keywords */}
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
                    className="w-full rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2.5 text-sm text-white focus:border-violet-400 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-[#9894b8]">
                    เคล็ดลับ: ใช้เครื่องหมายจุลภาค (,) เพื่อแบ่งช่วงซับไตเติลให้ขึ้นทีละท่อน
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="scene-mood" className="block text-xs font-medium text-[#9894b8] mb-1">
                      บรรยากาศฉาก
                    </label>
                    <select
                      id="scene-mood"
                      value={activeScene.mood}
                      onChange={(e) =>
                        patchScene(safeSceneIdx, { mood: e.target.value as SceneMood })
                      }
                      className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 py-1.5 text-sm text-white focus:border-violet-400 focus:outline-none"
                    >
                      {MOODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="scene-fx" className="block text-xs font-medium text-[#9894b8] mb-1">
                      เอฟเฟกต์พิเศษ
                    </label>
                    <select
                      id="scene-fx"
                      value={activeScene.fx}
                      onChange={(e) =>
                        patchScene(safeSceneIdx, { fx: e.target.value as SceneFx })
                      }
                      className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 py-1.5 text-sm text-white focus:border-violet-400 focus:outline-none"
                    >
                      {FX_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="scene-hl" className="block text-xs font-medium text-[#9894b8] mb-1">
                      คำเน้นสี (คั่นด้วยจุลภาค)
                    </label>
                    <input
                      id="scene-hl"
                      type="text"
                      value={activeScene.hl.join(', ')}
                      onChange={(e) =>
                        patchScene(safeSceneIdx, {
                          hl: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="เช่น ตีสาม, สมอง"
                      className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 py-1.5 text-sm text-white focus:border-violet-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Actors in Scene */}
              <div className="border-t border-white/[0.08] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">ตัวละครในฉาก</h3>
                  {activeScene.actors.length < 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        patchScene(safeSceneIdx, {
                          actors: [
                            ...activeScene.actors,
                            {
                              char: project.characters[1]?.id || project.characters[0]?.id || 'C1',
                              x: activeScene.actors.length === 0 ? 0.5 : 0.72,
                              pose: 'idle',
                              face: 'happy',
                              flip: activeScene.actors.length > 0,
                            },
                          ],
                        })
                      }
                      className="text-xs font-medium text-violet-300 hover:text-violet-200 cursor-pointer"
                    >
                      + เพิ่มตัวละครในฉาก
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {activeScene.actors.map((actor, aIdx) => (
                    <div
                      key={aIdx}
                      className="rounded-xl border border-white/[0.08] bg-[#0a0b10] p-3.5 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#d6d3eb]">ตัวแสดงที่ {aIdx + 1}</span>
                        <button
                          type="button"
                          onClick={() =>
                            patchScene(safeSceneIdx, {
                              actors: activeScene.actors.filter((_, idx) => idx !== aIdx),
                            })
                          }
                          className="text-xs text-rose-300 hover:text-rose-200 cursor-pointer"
                        >
                          นำออก
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <select
                          aria-label={`เลือกตัวละครที่ ${aIdx + 1}`}
                          value={actor.char}
                          onChange={(e) => {
                            const nextActors = activeScene.actors.map((a, i) =>
                              i === aIdx ? { ...a, char: e.target.value } : a
                            );
                            patchScene(safeSceneIdx, { actors: nextActors });
                          }}
                          className="min-h-[40px] rounded-lg border border-white/15 bg-[#13141d] px-2.5 text-xs text-white"
                        >
                          {project.characters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`ท่าทางตัวละครที่ ${aIdx + 1}`}
                          value={actor.pose}
                          onChange={(e) => {
                            const nextActors = activeScene.actors.map((a, i) =>
                              i === aIdx ? { ...a, pose: e.target.value as ActorPose } : a
                            );
                            patchScene(safeSceneIdx, { actors: nextActors });
                          }}
                          className="min-h-[40px] rounded-lg border border-white/15 bg-[#13141d] px-2.5 text-xs text-white"
                        >
                          {POSES.map((p) => (
                            <option key={p.value} value={p.value}>
                              {p.label}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`สีหน้าตัวละครที่ ${aIdx + 1}`}
                          value={actor.face}
                          onChange={(e) => {
                            const nextActors = activeScene.actors.map((a, i) =>
                              i === aIdx ? { ...a, face: e.target.value as ActorFace } : a
                            );
                            patchScene(safeSceneIdx, { actors: nextActors });
                          }}
                          className="min-h-[40px] rounded-lg border border-white/15 bg-[#13141d] px-2.5 text-xs text-white"
                        >
                          {FACES.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex flex-1 items-center gap-2 text-xs text-[#9894b8]">
                          <span>ตำแหน่ง X</span>
                          <input
                            type="range"
                            min={0.15}
                            max={0.85}
                            step={0.02}
                            value={actor.x}
                            onChange={(e) => {
                              const nextActors = activeScene.actors.map((a, i) =>
                                i === aIdx ? { ...a, x: Number(e.target.value) } : a
                              );
                              patchScene(safeSceneIdx, { actors: nextActors });
                            }}
                            className="studio-range flex-1"
                          />
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs text-[#d6d3eb] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={actor.flip}
                            onChange={(e) => {
                              const nextActors = activeScene.actors.map((a, i) =>
                                i === aIdx ? { ...a, flip: e.target.checked } : a
                              );
                              patchScene(safeSceneIdx, { actors: nextActors });
                            }}
                          />
                          <span>หันซ้าย</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Overlay Card Editor */}
              <div className="border-t border-white/[0.08] pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">การ์ดข้อความประกอบฉาก</h3>
                  <select
                    aria-label="ประเภทการ์ดประกอบฉาก"
                    value={activeScene.card?.type || 'none'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'none') {
                        patchScene(safeSceneIdx, { card: null });
                      } else {
                        patchScene(safeSceneIdx, {
                          card: {
                            type: val as CardType,
                            text: activeScene.card?.text || 'ข้อความสำคัญ',
                            label: activeScene.card?.label || '',
                            items: activeScene.card?.items || ['ข้อที่ 1', 'ข้อที่ 2'],
                            badge: activeScene.card?.badge || 'สรุป',
                            at: activeScene.card?.at || '',
                          },
                        });
                      }
                    }}
                    className="min-h-[38px] rounded-lg border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                  >
                    <option value="none">ไม่มีการ์ด</option>
                    <option value="text">การ์ดข้อความ (Text)</option>
                    <option value="bignumber">การ์ดตัวเลขเด่น (Big Number)</option>
                    <option value="list">การ์ดรายการ (List)</option>
                    <option value="end">การ์ดปิดท้าย (End Card)</option>
                  </select>
                </div>

                {activeScene.card && (
                  <div className="rounded-xl border border-white/[0.08] bg-[#0a0b10] p-3.5 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        aria-label="ข้อความหลักบนการ์ด"
                        value={activeScene.card.text}
                        onChange={(e) =>
                          patchScene(safeSceneIdx, {
                            card: { ...activeScene.card!, text: e.target.value },
                          })
                        }
                        placeholder="ข้อความหลัก (หรือตัวเลข เช่น 90 นาที)"
                        className="min-h-[40px] rounded-lg border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                      />
                      <input
                        type="text"
                        aria-label="คำอธิบายรองบนการ์ด"
                        value={activeScene.card.label || ''}
                        onChange={(e) =>
                          patchScene(safeSceneIdx, {
                            card: { ...activeScene.card!, label: e.target.value },
                          })
                        }
                        placeholder="คำอธิบายรอง / ปุ่มท้าย"
                        className="min-h-[40px] rounded-lg border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                      />
                    </div>

                    {activeScene.card.type === 'list' && (
                      <input
                        type="text"
                        aria-label="รายการย่อยบนการ์ด"
                        value={(activeScene.card.items || []).join(', ')}
                        onChange={(e) =>
                          patchScene(safeSceneIdx, {
                            card: {
                              ...activeScene.card!,
                              items: e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        placeholder="รายการย่อย คั่นด้วยจุลภาค (,)"
                        className="w-full min-h-[40px] rounded-lg border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Characters & Visual Style */}
          {editorTab === 'characters' && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-white mb-3">เปลี่ยนสไตล์ภาพทั้งเรื่อง</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {Object.values(STYLES).map((st) => {
                    const active = project.style === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() =>
                          onUpdateProject({ ...project, style: st.key as CartoonStyleKey })
                        }
                        className={`relative overflow-hidden rounded-xl border p-3 text-left min-h-[72px] cursor-pointer ${
                          active ? 'border-white ring-2 ring-violet-400' : 'border-white/10'
                        }`}
                        style={{
                          background: `linear-gradient(155deg, ${st.t}, ${st.b} 70%, ${st.g})`,
                        }}
                      >
                        <div className="absolute inset-0 bg-black/45" />
                        <div className="relative z-10 text-xs font-bold text-white">{st.n}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/[0.08] pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white">ปรับแต่งตัวละคร</h2>
                  {project.characters.length < 4 && (
                    <button
                      type="button"
                      onClick={addCharacter}
                      className="text-xs font-medium text-violet-300 hover:text-violet-200 cursor-pointer"
                    >
                      + เพิ่มตัวละคร
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {project.characters.map((ch, idx) => (
                    <div
                      key={ch.id}
                      className="rounded-xl border border-white/[0.08] bg-[#0a0b10] p-4 space-y-3"
                    >
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
                          <label className="block text-[11px] text-[#9894b8] mb-1">ชื่อตัวละคร</label>
                          <input
                            type="text"
                            value={ch.name}
                            onChange={(e) => patchCharacter(idx, { name: e.target.value })}
                            className="w-full min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2.5 text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] text-[#9894b8] mb-1">ทรงผม</label>
                          <select
                            value={ch.hairStyle}
                            onChange={(e) =>
                              patchCharacter(idx, { hairStyle: e.target.value as HairStyle })
                            }
                            className="w-full min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2.5 text-xs text-white"
                          >
                            <option value="short">ผมสั้น</option>
                            <option value="long">ผมยาว</option>
                            <option value="bun">มวยผม</option>
                          </select>
                        </div>

                        <div className="flex items-end pb-1.5">
                          <label className="inline-flex items-center gap-2 text-xs text-[#d6d3eb] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={Boolean(ch.glasses)}
                              onChange={(e) => patchCharacter(idx, { glasses: e.target.checked })}
                            />
                            <span>สวมแว่นตา</span>
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
            </div>
          )}

          {/* Tab 3: Export MP4 */}
          {editorTab === 'export' && (
            <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">ส่งออกไฟล์วิดีโอพร้อมเสียงพากย์</h2>
                <p className="mt-1 text-xs text-[#9894b8]">
                  เรนเดอร์ภาพ 30 fps ลงไฟล์ MP4 (H.264 + AAC/Opus) บนเครื่องของคุณโดยตรง
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ex-res" className="block text-xs font-medium text-[#9894b8] mb-1.5">
                    ความละเอียดวิดีโอ
                  </label>
                  <select
                    id="ex-res"
                    value={exportResolution}
                    onChange={(e) => onChangeExportRes(e.target.value as '720' | '1080')}
                    className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-sm text-white"
                  >
                    <option value="720">720p (720×1280 · เร็ว ประหยัดแรม)</option>
                    <option value="1080">1080p (1080×1920 · คมชัดสูง)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="ex-sub" className="block text-xs font-medium text-[#9894b8] mb-1.5">
                    ขนาดซับไตเติลในวิดีโอ
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

              {!hasAudio && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                  ขณะนี้ยังไม่มีเสียงพากย์ วิดีโอที่ส่งออกจะยังไม่มีเสียง แนะนำให้กดปุ่ม &ldquo;พากย์เสียง AI&rdquo; หรือนำเข้าไฟล์เสียงก่อน
                </div>
              )}

              <button
                type="button"
                disabled={isExporting}
                onClick={onExportVideo}
                className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-base font-bold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <Film className="h-5 w-5" aria-hidden="true" />
                <span>{isExporting ? 'กำลังสร้างไฟล์วิดีโอ…' : 'สร้างวิดีโอ MP4'}</span>
              </button>

              {(isExporting || exportProgressPct > 0) && (
                <div className="rounded-xl border border-white/10 bg-[#0a0b10] p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#d6d3eb]">
                    <span>{exportProgressText}</span>
                    <span className="font-mono-tabular">{exportProgressPct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-violet-500 transition-all duration-200"
                      style={{ width: `${exportProgressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {exportError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
                >
                  {exportError}
                </div>
              )}

              {exportVideoUrl && exportResult && (
                <div className="rounded-2xl border border-white/10 bg-[#0a0b10] p-4 space-y-4">
                  <video
                    controls
                    playsInline
                    src={exportVideoUrl}
                    className="mx-auto w-full max-w-[300px] rounded-xl bg-black aspect-[9/16]"
                  />

                  <div className="text-xs text-[#9894b8] text-center tabular-nums">
                    {exportResult.durationSec
                      ? `ความยาว ${exportResult.durationSec.toFixed(1)} วินาที`
                      : 'เรนเดอร์เสร็จแล้ว'}{' '}
                    · {(exportResult.blob.size / 1048576).toFixed(2)} MB · เสียง:{' '}
                    {exportResult.hasAudioTrack === true
                      ? 'พบ Audio Track'
                      : exportResult.hasAudioTrack === false
                        ? 'ไม่มีเสียง'
                        : 'พร้อมเล่น'}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={onShareVideo}
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#1b1d29] px-4 py-2 text-sm font-semibold text-white hover:border-violet-400/50 transition-colors cursor-pointer"
                    >
                      <Share2 className="h-4 w-4 text-violet-400" aria-hidden="true" />
                      <span>แชร์ไฟล์วิดีโอ</span>
                    </button>

                    <a
                      href={exportVideoUrl}
                      download={`${sanitizeFilename(project.title)}.${exportResult.ext}`}
                      className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      <span>ดาวน์โหลด {exportResult.ext.toUpperCase()}</span>
                    </a>
                  </div>
                </div>
              )}

              {hasAudio && (
                <button
                  type="button"
                  onClick={onDownloadAudio}
                  className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0a0b10] px-4 py-2 text-xs font-medium text-[#d6d3eb] hover:border-violet-400/50 hover:text-white transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4 text-violet-400" aria-hidden="true" />
                  <span>ดาวน์โหลดไฟล์เสียงพากย์แยก (.{audioExt || 'wav'})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
