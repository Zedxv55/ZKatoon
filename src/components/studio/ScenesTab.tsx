import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type {
  AppConfig,
  BgPresetId,
  CameraTypeId,
  FaceId,
  FxTypeId,
  PoseId,
  ShotTypeId,
  StudioCharacter,
  StudioEpisode,
  StudioProject,
  StudioScene,
} from '../../types/studio';
import { askProjectAdvisor, requestAiChatEditProposal } from '../../utils/aiChatOps';
import type { ProposedAiEdit } from '../../utils/aiChatOps';
import { drawCharacter } from '../../utils/drawCharacter';
import {
  ACCESSORIES,
  BG_PRESETS,
  CAMERA_SHOTS,
  CAMERA_TYPES,
  FACES,
  FX_TYPES,
  HAIR_STYLES,
  OUTFIT_STYLES,
  POSES,
  SFX_NAMES,
} from '../../utils/registry';

interface ScenesTabProps {
  project: StudioProject;
  episode: StudioEpisode;
  activeSceneId: string | null;
  config: AppConfig;
  onJumpToScene: (sceneId: string) => void;
  onUpdateProject: (next: StudioProject) => void;
}

function CharacterPosePreviewCanvas({ char, pose, face }: { char: StudioCharacter; pose: PoseId; face: FaceId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#181c28';
    ctx.fillRect(0, 0, c.width, c.height);
    drawCharacter(ctx, char, {
      x: c.width / 2,
      y: c.height * 0.88,
      baseHeight: c.height * 0.68,
      scale: 1,
      pose,
      face,
      timeSec: 1.2,
      mouthOpen: pose === 'talk' ? 0.6 : 0,
    });
  }, [char, pose, face]);

  return <canvas ref={ref} width={140} height={160} className="rounded-xl border border-white/10" />;
}

export function ScenesTab(props: ScenesTabProps) {
  const { project, episode, activeSceneId, config, onJumpToScene, onUpdateProject } = props;
  const scenes = episode.scenes;
  const currentSceneIdx = Math.max(
    0,
    scenes.findIndex((s) => s.id === activeSceneId)
  );
  const activeScene = scenes[currentSceneIdx] || scenes[0];

  const [sheetSceneId, setSheetSceneId] = useState<string | null>(null);
  const [showCharSheet, setShowCharSheet] = useState(false);
  const [previewPose, setPreviewPose] = useState<PoseId>('idle');
  const [previewFace, setPreviewFace] = useState<FaceId>('happy');
  const [menuSceneId, setMenuSceneId] = useState<string | null>(null);

  // AI Chat Edit & Critique
  const [chatInput, setChatInput] = useState('');
  const [chatMode, setChatMode] = useState<'edit' | 'advise'>('edit');
  const [chatLoading, setChatLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposedAiEdit | null>(null);
  const [advisorAnswer, setAdvisorAnswer] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);

  const editedScene = scenes.find((s) => s.id === sheetSceneId) || null;

  const updateEpisodeScenes = (nextScenes: StudioScene[]) => {
    const nextEp: StudioEpisode = { ...episode, scenes: nextScenes };
    onUpdateProject({
      ...project,
      episodes: project.episodes.map((ep) => (ep.id === episode.id ? nextEp : ep)),
    });
  };

  const patchScene = (sceneId: string, patch: Partial<StudioScene>) => {
    updateEpisodeScenes(
      scenes.map((s) => {
        if (s.id !== sceneId) return s;
        const narrationChanged = typeof patch.narration === 'string' && patch.narration !== s.narration;
        return {
          ...s,
          ...patch,
          audio: narrationChanged && s.audio ? { ...s.audio, stale: true } : patch.audio ?? s.audio,
        };
      })
    );
  };

  const moveScene = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= scenes.length) return;
    const copy = [...scenes];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    updateEpisodeScenes(copy);
  };

  const duplicateScene = (idx: number) => {
    const src = scenes[idx];
    if (!src) return;
    const clone: StudioScene = {
      ...src,
      id: `${src.id}_copy_${Date.now().toString(36).slice(-3)}`,
      audio: undefined,
    };
    const copy = [...scenes];
    copy.splice(idx + 1, 0, clone);
    updateEpisodeScenes(copy);
    setMenuSceneId(null);
  };

  const deleteScene = (idx: number) => {
    if (scenes.length <= 1) return;
    const copy = scenes.filter((_, i) => i !== idx);
    updateEpisodeScenes(copy);
    setMenuSceneId(null);
  };

  const addBlankScene = () => {
    const newId = `S${scenes.length + 1}_${Date.now().toString(36).slice(-3)}`;
    const blank: StudioScene = {
      id: newId,
      narration: 'พิมพ์บทพากย์ของฉากใหม่ที่นี่...',
      highlightWords: [],
      holdAfter: 0.35,
      bg: { preset: activeScene?.bg.preset || 'city_night' },
      blurBg: false,
      hud: {},
      actors: project.characters[0]
        ? [{ char: project.characters[0].id, x: 0.5, y: 0.84, scale: 1, pose: 'talk', face: 'neutral', flip: false }]
        : [],
      props: [],
      pov: null,
      cards: [],
      camera: { type: 'static', shot: 'medium' },
      fx: [],
      sfx: [],
      ambient: 'none',
      transition: 'fade',
      visualIntent: 'ฉากใหม่',
    };
    updateEpisodeScenes([...scenes, blank]);
    setSheetSceneId(newId);
    onJumpToScene(newId);
  };

  const handleChatSubmit = async (customText?: string) => {
    const prompt = (customText ?? chatInput).trim();
    if (!prompt) return;
    setChatError(null);
    setChatLoading(true);
    setProposal(null);
    setAdvisorAnswer(null);

    try {
      if (chatMode === 'edit') {
        const res = await requestAiChatEditProposal({
          instruction: prompt,
          project,
          activeSceneId: activeScene?.id,
          config,
        });
        setProposal(res);
      } else {
        await askProjectAdvisor({
          question: prompt,
          project,
          config,
          onStream: setAdvisorAnswer,
        });
      }
      if (!customText) setChatInput('');
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'เรียก AI ไม่สำเร็จ (ตรวจสอบ Key ในตั้งค่า)');
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 pb-28">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">จัดการฉาก & ตัวละคร ({scenes.length} ฉาก)</h2>
          <p className="text-xs text-[#9894b8]">แตะฉากเพื่อข้ามไปดูทันที หรือแตะ “แก้ฉาก” เพื่อปรับด้วยชิปและสไลเดอร์</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCharSheet(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white cursor-pointer"
          >
            <Users className="h-4 w-4 text-amber-300" />
            <span>ตัวละคร ({project.characters.length})</span>
          </button>
          <button
            type="button"
            onClick={addBlankScene}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-amber-400 px-3 text-xs font-bold text-slate-950 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>เพิ่มฉาก</span>
          </button>
        </div>
      </div>

      {/* Horizontal Scene Strip (lazy lightweight buttons) */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 no-scrollbar">
        {scenes.map((sc, idx) => {
          const isCurrent = sc.id === activeScene?.id;
          return (
            <div
              key={sc.id}
              className={`relative shrink-0 w-44 rounded-2xl border p-3 transition-colors ${
                isCurrent ? 'border-amber-400 bg-amber-400/12' : 'border-white/10 bg-[#13141d]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onJumpToScene(sc.id)}
                  className="text-left text-xs font-extrabold text-amber-300 cursor-pointer"
                >
                  #{idx + 1} • {sc.id}
                </button>
                <div className="flex items-center gap-1">
                  {sc.audio?.stale && (
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                      บทเปลี่ยน
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setMenuSceneId(menuSceneId === sc.id ? null : sc.id)}
                    aria-label={`ตัวเลือกฉาก ${sc.id}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/75 cursor-pointer"
                  >
                    ⋯
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onJumpToScene(sc.id)}
                className="mt-1.5 block w-full text-left cursor-pointer"
              >
                <div className="line-clamp-2 text-xs text-white/90 min-h-[32px]">{sc.narration}</div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#9894b8]">
                  <span>{sc.bg.preset}</span>
                  <span>{sc.camera.shot}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onJumpToScene(sc.id);
                  setSheetSceneId(sc.id);
                }}
                className="mt-2 flex min-h-[36px] w-full items-center justify-center gap-1 rounded-xl bg-white/10 text-xs font-semibold text-white hover:bg-white/20 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>แก้ฉาก</span>
              </button>

              {menuSceneId === sc.id && (
                <div className="absolute right-2 top-9 z-20 w-36 rounded-xl border border-white/15 bg-[#1b1d29] p-1.5 shadow-2xl space-y-1 text-xs">
                  <button
                    type="button"
                    onClick={() => moveScene(idx, -1)}
                    disabled={idx === 0}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-white hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> เลื่อนซ้าย
                  </button>
                  <button
                    type="button"
                    onClick={() => moveScene(idx, 1)}
                    disabled={idx === scenes.length - 1}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-white hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" /> เลื่อนขวา
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateScene(idx)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" /> ทำซ้ำ
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteScene(idx)}
                    disabled={scenes.length <= 1}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-300 hover:bg-rose-500/20 disabled:opacity-35 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> ลบฉาก
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating AI Chat Bar + Mode Switch + Diff Confirmation */}
      <div className="rounded-2xl border border-white/10 bg-[#13141d] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <MessageSquare className="h-4 w-4 text-violet-400" />
            <span>ผู้ช่วย AI ประจำโปรเจกต์</span>
          </div>
          <div className="flex rounded-xl bg-black/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setChatMode('edit')}
              className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                chatMode === 'edit' ? 'bg-violet-500 text-white' : 'text-white/70'
              }`}
            >
              สั่งแก้ฉาก
            </button>
            <button
              type="button"
              onClick={() => setChatMode('advise')}
              className={`rounded-lg px-3 py-1.5 font-semibold cursor-pointer ${
                chatMode === 'advise' ? 'bg-amber-400 text-slate-950' : 'text-white/70'
              }`}
            >
              ถามปรึกษา
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {[
            'เพิ่มฝนตกในฉากปัจจุบัน',
            'เปลี่ยนกล้องฉากนี้เป็น close up ดันเข้า',
            'ปรับฉากนี้ให้ตัวละครตกใจ',
            'เปลี่ยนเป็น Style Pack C',
          ].map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => {
                setChatMode('edit');
                setChatInput(quick);
              }}
              className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 cursor-pointer"
            >
              {quick}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleChatSubmit();
            }}
            placeholder={
              chatMode === 'edit'
                ? 'พิมพ์สั่งแก้ฉาก เช่น เพิ่มฉากสรุปหลัง S2 หรือเปลี่ยนฉากนี้เป็นฝนตก...'
                : 'ถามคำแนะนำ เช่น จังหวะเรื่องนี้ตรงไหนช้าไป หรือควรเพิ่มการ์ดอะไร...'
            }
            className="min-h-[48px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white placeholder:text-white/35"
          />
          <button
            type="button"
            disabled={chatLoading || !chatInput.trim()}
            onClick={() => void handleChatSubmit()}
            className="flex min-h-[48px] min-w-[54px] items-center justify-center rounded-xl bg-violet-500 text-white disabled:opacity-40 cursor-pointer"
            aria-label="ส่งคำสั่ง AI"
          >
            {chatLoading ? <Sparkles className="h-4 w-4 animate-pulse" /> : <Send className="h-4 w-4" />}
          </button>
        </div>

        {chatError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-2.5 text-xs text-rose-200">
            {chatError}
          </div>
        )}

        {proposal && (
          <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 space-y-2">
            <div className="text-xs font-bold text-emerald-300">ตัวอย่างการแก้ไข (Diff) — ตรวจก่อนกดยืนยัน:</div>
            <div className="text-xs text-white">{proposal.summary}</div>
            <ul className="space-y-1 text-xs text-emerald-100">
              {proposal.diffLines.map((ln, i) => (
                <li key={i}>{ln}</li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  onUpdateProject(proposal.previewProject);
                  setProposal(null);
                }}
                className="flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 font-bold text-slate-950 text-xs cursor-pointer"
              >
                <Check className="h-4 w-4" /> นำไปใช้ทันที (Undo ได้)
              </button>
              <button
                type="button"
                onClick={() => setProposal(null)}
                className="flex min-h-[42px] items-center justify-center rounded-xl border border-white/15 px-4 text-xs text-white cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}

        {advisorAnswer && (
          <div className="rounded-xl border border-amber-400/25 bg-black/30 p-3 text-xs text-white/90 whitespace-pre-wrap">
            {advisorAnswer}
          </div>
        )}
      </div>

      {/* Bottom Sheet Scene Editor (Zero JSON, pure chip/slider controls) */}
      {editedScene && (
        <div
          role="dialog"
          aria-label={`แก้ไขฉาก ${editedScene.id}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75"
        >
          <div className="w-full max-w-2xl max-h-[82dvh] overflow-y-auto rounded-t-3xl border-t border-white/15 bg-[#13141d] p-4 space-y-4">
            <div className="flex items-center justify-between sticky top-0 bg-[#13141d] py-1 z-10">
              <h3 className="text-base font-bold text-white">แก้ไขฉาก {editedScene.id}</h3>
              <button
                type="button"
                onClick={() => setSheetSceneId(null)}
                aria-label="ปิดหน้าต่างแก้ฉาก"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-300">บทพากย์ & ซับไตเติล</label>
              <textarea
                rows={3}
                value={editedScene.narration}
                onChange={(e) => patchScene(editedScene.id, { narration: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/30 p-3 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#c7c3e0]">พื้นหลัง (bg.preset)</label>
                <select
                  value={editedScene.bg.preset}
                  onChange={(e) =>
                    patchScene(editedScene.id, { bg: { ...editedScene.bg, preset: e.target.value as BgPresetId } })
                  }
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-white/15 bg-black/30 px-2.5 text-xs text-white"
                >
                  {BG_PRESETS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#c7c3e0]">ระยะกล้อง & การเคลื่อนกล้อง</label>
                <div className="mt-1 flex gap-1.5">
                  <select
                    value={editedScene.camera.shot}
                    onChange={(e) =>
                      patchScene(editedScene.id, {
                        camera: { ...editedScene.camera, shot: e.target.value as ShotTypeId },
                      })
                    }
                    className="min-h-[44px] flex-1 rounded-xl border border-white/15 bg-black/30 px-2 text-xs text-white"
                  >
                    {CAMERA_SHOTS.map((sh) => (
                      <option key={sh} value={sh}>
                        {sh}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editedScene.camera.type}
                    onChange={(e) =>
                      patchScene(editedScene.id, {
                        camera: { ...editedScene.camera, type: e.target.value as CameraTypeId },
                      })
                    }
                    className="min-h-[44px] flex-1 rounded-xl border border-white/15 bg-black/30 px-2 text-xs text-white"
                  >
                    {CAMERA_TYPES.map((ct) => (
                      <option key={ct} value={ct}>
                        {ct}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#c7c3e0]">
                  ค้างท้ายฉาก (holdAfter): {editedScene.holdAfter.toFixed(2)} วิ
                </label>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.1}
                  value={editedScene.holdAfter}
                  onChange={(e) => patchScene(editedScene.id, { holdAfter: parseFloat(e.target.value) })}
                  className="studio-range mt-1.5 w-full"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => patchScene(editedScene.id, { blurBg: !editedScene.blurBg })}
                  className={`min-h-[44px] w-full rounded-xl border px-3 text-xs font-bold cursor-pointer ${
                    editedScene.blurBg ? 'border-amber-400 bg-amber-400/15 text-amber-200' : 'border-white/15 text-white/75'
                  }`}
                >
                  {editedScene.blurBg ? '✓ เบลอพื้นหลังเปิดอยู่' : 'เบลอพื้นหลัง: ปิด'}
                </button>
              </div>
            </div>

            {/* Actors Quick Controls */}
            {editedScene.actors.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#c7c3e0]">ตัวละครในฉาก</div>
                {editedScene.actors.map((act, aIdx) => (
                  <div key={aIdx} className="rounded-xl border border-white/10 bg-black/25 p-2.5 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-amber-300">{act.char}</span>
                      <select
                        value={act.pose}
                        onChange={(e) => {
                          const next = [...editedScene.actors];
                          next[aIdx] = { ...act, pose: e.target.value as PoseId };
                          patchScene(editedScene.id, { actors: next });
                        }}
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2 text-xs text-white"
                      >
                        {POSES.map((p) => (
                          <option key={p} value={p}>
                            ท่า: {p}
                          </option>
                        ))}
                      </select>
                      <select
                        value={act.face}
                        onChange={(e) => {
                          const next = [...editedScene.actors];
                          next[aIdx] = { ...act, face: e.target.value as FaceId };
                          patchScene(editedScene.id, { actors: next });
                        }}
                        className="min-h-[38px] rounded-lg border border-white/15 bg-[#13141d] px-2 text-xs text-white"
                      >
                        {FACES.map((f) => (
                          <option key={f} value={f}>
                            หน้า: {f}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...editedScene.actors];
                          next[aIdx] = { ...act, flip: !act.flip };
                          patchScene(editedScene.id, { actors: next });
                        }}
                        className="min-h-[38px] rounded-lg border border-white/15 px-2.5 text-xs text-white cursor-pointer"
                      >
                        หัน: {act.flip ? 'ซ้าย' : 'ขวา'}
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#9894b8]">
                      <span>ตำแหน่ง X: {Math.round(act.x * 100)}%</span>
                      <input
                        type="range"
                        min={0.12}
                        max={0.88}
                        step={0.02}
                        value={act.x}
                        onChange={(e) => {
                          const next = [...editedScene.actors];
                          next[aIdx] = { ...act, x: parseFloat(e.target.value) };
                          patchScene(editedScene.id, { actors: next });
                        }}
                        className="studio-range flex-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* FX & SFX toggles */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-[#c7c3e0]">เอฟเฟกต์ภาพ (FX) & เสียง (SFX)</div>
              <div className="flex flex-wrap gap-1.5">
                {FX_TYPES.map((fxName) => {
                  const has = editedScene.fx.some((f) => f.type === fxName);
                  return (
                    <button
                      key={fxName}
                      type="button"
                      onClick={() => {
                        const nextFx = has
                          ? editedScene.fx.filter((f) => f.type !== fxName)
                          : [...editedScene.fx, { type: fxName as FxTypeId, intensity: 0.5 }];
                        patchScene(editedScene.id, { fx: nextFx });
                      }}
                      className={`min-h-[36px] rounded-lg px-2.5 text-xs font-semibold cursor-pointer ${
                        has ? 'bg-violet-500 text-white' : 'border border-white/10 bg-black/25 text-white/70'
                      }`}
                    >
                      {fxName}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    patchScene(editedScene.id, {
                      sfx: [...editedScene.sfx, { name: e.target.value as typeof SFX_NAMES[number], vol: 0.45 }],
                    });
                    e.target.value = '';
                  }}
                  className="min-h-[40px] flex-1 rounded-xl border border-white/15 bg-black/30 px-2.5 text-xs text-white"
                >
                  <option value="">+ เพิ่มเอฟเฟกต์เสียง SFX...</option>
                  {SFX_NAMES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {editedScene.sfx.length > 0 && (
                  <button
                    type="button"
                    onClick={() => patchScene(editedScene.id, { sfx: editedScene.sfx.slice(0, -1) })}
                    className="min-h-[40px] rounded-xl border border-rose-400/30 px-3 text-xs text-rose-200 cursor-pointer"
                  >
                    ลบ SFX ล่าสุด ({editedScene.sfx.length})
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSheetSceneId(null)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-amber-400 font-bold text-slate-950 cursor-pointer"
            >
              เสร็จสิ้น
            </button>
          </div>
        </div>
      )}

      {/* Character Sheet Editor + Pose/Face Preview */}
      {showCharSheet && (
        <div
          role="dialog"
          aria-label="แก้ไขตัวละครในโปรเจกต์"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4"
        >
          <div className="w-full max-w-2xl max-h-[86dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/15 bg-[#13141d] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Character Sheet & Series Bible</h3>
              <button
                type="button"
                onClick={() => setShowCharSheet(false)}
                aria-label="ปิดหน้าตัวละคร"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-black/30 p-2.5 text-xs">
              <span className="text-[#9894b8]">ทดลองดูท่าและสีหน้า:</span>
              <select
                value={previewPose}
                onChange={(e) => setPreviewPose(e.target.value as PoseId)}
                className="rounded-lg border border-white/15 bg-[#13141d] px-2 py-1 text-white"
              >
                {POSES.map((p) => (
                  <option key={p} value={p}>
                    ท่า: {p}
                  </option>
                ))}
              </select>
              <select
                value={previewFace}
                onChange={(e) => setPreviewFace(e.target.value as FaceId)}
                className="rounded-lg border border-white/15 bg-[#13141d] px-2 py-1 text-white"
              >
                {FACES.map((f) => (
                  <option key={f} value={f}>
                    สีหน้า: {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {project.characters.map((char, idx) => (
                <div key={char.id} className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="shrink-0 flex justify-center">
                    <CharacterPosePreviewCanvas char={char} pose={previewPose} face={previewFace} />
                  </div>
                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => {
                          const next = [...project.characters];
                          next[idx] = { ...char, name: e.target.value };
                          onUpdateProject({ ...project, characters: next });
                        }}
                        className="rounded-lg border border-white/15 bg-[#13141d] px-2.5 py-1.5 text-sm font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextLocked = !char.locked;
                          const nextChars = project.characters.map((c, i) => (i === idx ? { ...c, locked: nextLocked } : c));
                          const lockedIds = nextChars.filter((c) => c.locked).map((c) => c.id);
                          onUpdateProject({
                            ...project,
                            characters: nextChars,
                            seriesBible: { ...project.seriesBible, lockedCharacterIds: lockedIds },
                          });
                        }}
                        className={`inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 font-bold cursor-pointer ${
                          char.locked ? 'bg-amber-400/20 text-amber-200' : 'bg-white/10 text-white/70'
                        }`}
                      >
                        {char.locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                        <span>{char.locked ? 'ล็อกข้ามตอน' : 'ยังไม่ล็อก'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={char.hair.style}
                        onChange={(e) => {
                          const next = [...project.characters];
                          next[idx] = { ...char, hair: { ...char.hair, style: e.target.value as typeof HAIR_STYLES[number] } };
                          onUpdateProject({ ...project, characters: next });
                        }}
                        className="rounded-lg border border-white/15 bg-[#13141d] px-2 py-1.5 text-white"
                      >
                        {HAIR_STYLES.map((hs) => (
                          <option key={hs} value={hs}>
                            ผม: {hs}
                          </option>
                        ))}
                      </select>
                      <select
                        value={char.outfit.type}
                        onChange={(e) => {
                          const next = [...project.characters];
                          next[idx] = {
                            ...char,
                            outfit: { ...char.outfit, type: e.target.value as typeof OUTFIT_STYLES[number] },
                          };
                          onUpdateProject({ ...project, characters: next });
                        }}
                        className="rounded-lg border border-white/15 bg-[#13141d] px-2 py-1.5 text-white"
                      >
                        {OUTFIT_STYLES.map((ot) => (
                          <option key={ot} value={ot}>
                            ชุด: {ot}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {ACCESSORIES.map((acc) => {
                        const has = char.accessories.includes(acc);
                        return (
                          <button
                            key={acc}
                            type="button"
                            onClick={() => {
                              const nextAcc = has ? char.accessories.filter((a) => a !== acc) : [...char.accessories, acc];
                              const next = [...project.characters];
                              next[idx] = { ...char, accessories: nextAcc };
                              onUpdateProject({ ...project, characters: next });
                            }}
                            className={`rounded-lg px-2 py-1 text-[11px] cursor-pointer ${
                              has ? 'bg-violet-500 text-white' : 'bg-white/5 text-white/70'
                            }`}
                          >
                            {acc}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
