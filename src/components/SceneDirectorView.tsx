import { useState } from 'react';
import { Camera, Clapperboard, Film, Plus, Sliders, Sparkles, Trash2 } from 'lucide-react';
import type {
  ActorFace,
  AmbientType,
  AnimationClip3D,
  CameraShotType,
  CartoonProject,
  EnvironmentPreset3D,
  SceneDef,
  StylePreset3D,
} from '../types/cartoon';
import {
  ANIMATION_CLIPS_3D,
  CAMERA_SHOTS_3D,
  ENVIRONMENT_PRESETS_3D,
  STYLE_PRESETS_3D,
} from '../utils/cartoonData';

interface SceneDirectorViewProps {
  project: CartoonProject | null;
  onUpdateProject: (next: CartoonProject) => void;
  onOpenDemo3D: () => void;
  onGoStudio: () => void;
}

const FACES: Array<{ id: ActorFace; label: string }> = [
  { id: 'neutral', label: 'ปกติ' },
  { id: 'happy', label: 'ยิ้ม' },
  { id: 'sad', label: 'เศร้า' },
  { id: 'worried', label: 'กังวล' },
  { id: 'surprised', label: 'ตกใจ' },
  { id: 'scared', label: 'กลัว' },
  { id: 'angry', label: 'โกรธ' },
  { id: 'smirk', label: 'ยิ้มมุมปาก' },
];

export function SceneDirectorView({
  project,
  onUpdateProject,
  onOpenDemo3D,
  onGoStudio,
}: SceneDirectorViewProps) {
  const [selectedSceneIdx, setSelectedSceneIdx] = useState(0);

  if (!project) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <Clapperboard className="mx-auto h-12 w-12 text-violet-400" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-white">ยังไม่มีโปรเจกต์สำหรับกำกับฉาก</h1>
        <p className="text-sm text-[#9894b8]">
          เปิดตัวอย่าง 3D หรือสร้างบทเรื่องใหม่ก่อน เพื่อกำหนดมุมกล้อง 16 แบบ ฉาก 3D และแอนิเมชันตัวละคร
        </p>
        <button
          type="button"
          onClick={onOpenDemo3D}
          className="min-h-[44px] rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 cursor-pointer"
        >
          เปิดโปรเจกต์ตัวอย่าง 3D
        </button>
      </div>
    );
  }

  const activeScene = project.scenes[selectedSceneIdx] || project.scenes[0];

  function patchScene(patch: Partial<SceneDef>) {
    if (!project || !activeScene) return;
    const next = [...project.scenes];
    next[selectedSceneIdx] = { ...activeScene, ...patch };
    onUpdateProject({ ...project, scenes: next });
  }

  function handleAddScene() {
    if (!project) return;
    const nextNum = project.scenes.length + 1;
    const newScene: SceneDef = {
      id: `S${nextNum}`,
      title: `ฉากที่ ${nextNum}`,
      narration: 'พิมพ์บทพากย์ภาษาไทยสำหรับฉากใหม่.',
      mood: 'dusk',
      env3d: {
        preset: 'forest_trail',
        timeOfDay: 'golden',
        fogDensity: 0.2,
        windStrength: 0.3,
        dustAmount: 0.3,
        sunRays: 0.4,
        treesDensity: 0.6,
      },
      shotType3d: 'medium',
      shotReason: 'มุมกล้องระยะกลางสำหรับฉากต่อเนื่อง',
      camera: 'push_in',
      transition: 'fade',
      manualDurationSec: 4.5,
      actors: project.characters[0]
        ? [
            {
              char: project.characters[0].id,
              x: 0.5,
              z: 0,
              pose: 'talk',
              clip3d: 'Talk',
              face: 'neutral',
              flip: false,
            },
          ]
        : [],
      card: null,
      fx: 'none',
      hl: [],
    };
    onUpdateProject({ ...project, scenes: [...project.scenes, newScene] });
    setSelectedSceneIdx(project.scenes.length);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            ผู้กำกับฉาก & กล้อง 3D (Scene & Camera Director) — {project.title}
          </h1>
          <p className="mt-1 text-sm text-[#9894b8]">
            ควบคุมสไตล์ภาพ 3D สภาพแวดล้อม แสงหมอกฝน และ 17 มุมกล้องภาพยนตร์ พร้อมกำหนด Animation Clip รายตัวละคร
          </p>
        </div>

        <button
          type="button"
          onClick={onGoStudio}
          className="inline-flex items-center gap-2 min-h-[42px] rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer self-start"
        >
          <Film className="h-4 w-4" aria-hidden="true" />
          <span>ดูตัวอย่างในสตูดิโอ</span>
        </button>
      </div>

      {/* Global Project Engine & 10 Visual Style Selector */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-white font-bold">
            <Sliders className="h-4 w-4 text-violet-400" aria-hidden="true" />
            <span>เอนจินภาพ & สไตล์ 3 มิติ (10 Visual Style Presets)</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onUpdateProject({ ...project, renderEngine: '3d' })}
              className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold cursor-pointer ${
                project.renderEngine !== '2d_paper'
                  ? 'border-violet-500 bg-violet-500/20 text-white'
                  : 'border-white/10 bg-[#1b1d29] text-[#9894b8]'
              }`}
            >
              3D Cinematic (Three.js WebGL)
            </button>
            <button
              type="button"
              onClick={() => onUpdateProject({ ...project, renderEngine: '2d_paper' })}
              className={`min-h-[36px] rounded-lg border px-3 text-xs font-semibold cursor-pointer ${
                project.renderEngine === '2d_paper'
                  ? 'border-violet-500 bg-violet-500/20 text-white'
                  : 'border-white/10 bg-[#1b1d29] text-[#9894b8]'
              }`}
            >
              2D Paper Sketch (Classic)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STYLE_PRESETS_3D.map((st) => {
            const active = (project.style3d || 'cinematic_3d') === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onUpdateProject({ ...project, style3d: st.id as StylePreset3D })}
                className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-violet-500 bg-violet-500/15 text-white'
                    : 'border-white/10 bg-[#1b1d29] text-[#d6d3eb] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-bold truncate">{st.badge}</span>
                  <div className="flex gap-0.5 shrink-0">
                    {st.swatch.map((hex, i) => (
                      <span
                        key={i}
                        className="h-2.5 w-2.5 rounded-full border border-white/20"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
                <div className="mt-1 text-[10px] text-[#9894b8] line-clamp-2">{st.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Shot List & Active Scene Editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Shot List Sidebar */}
        <div className="lg:col-span-4 rounded-2xl border border-white/[0.08] bg-[#13141d] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Shot List ({project.scenes.length} ฉาก)</h2>
            <button
              type="button"
              onClick={handleAddScene}
              className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>เพิ่มฉาก</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {project.scenes.map((sc, idx) => {
              const active = idx === selectedSceneIdx;
              const shotLabel =
                CAMERA_SHOTS_3D.find((c) => c.id === (sc.shotType3d || 'medium'))?.label || 'Medium';
              return (
                <button
                  key={sc.id || idx}
                  type="button"
                  onClick={() => setSelectedSceneIdx(idx)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-violet-500 bg-violet-500/15'
                      : 'border-white/10 bg-[#1b1d29] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {sc.id || `S${idx + 1}`} · {sc.title || `ฉาก ${idx + 1}`}
                    </span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-violet-300 shrink-0">
                      {shotLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#9894b8] line-clamp-2">{sc.narration}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Scene Inspector */}
        {activeScene && (
          <div className="lg:col-span-8 rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-violet-400" aria-hidden="true" />
                <input
                  type="text"
                  value={activeScene.title || ''}
                  onChange={(e) => patchScene({ title: e.target.value })}
                  className="rounded-lg border border-white/10 bg-[#0b0c12] px-3 py-1.5 text-sm font-bold text-white"
                />
              </div>

              {project.scenes.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const next = project.scenes.filter((_, i) => i !== selectedSceneIdx);
                    onUpdateProject({ ...project, scenes: next });
                    setSelectedSceneIdx(Math.max(0, selectedSceneIdx - 1));
                  }}
                  className="inline-flex items-center gap-1 text-xs text-rose-300 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ลบฉากนี้</span>
                </button>
              )}
            </div>

            {/* Narration & Duration */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-[#9894b8] mb-1">บทพากย์ภาษาไทย (ใช้ , เว้นวรรค)</label>
                <textarea
                  rows={2}
                  value={activeScene.narration}
                  onChange={(e) => patchScene({ narration: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#0b0c12] p-2.5 text-xs text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-[#9894b8]">
                  ความยาวฉาก (วินาที)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    step={0.5}
                    value={activeScene.manualDurationSec ?? 4.5}
                    onChange={(e) =>
                      patchScene({ manualDurationSec: Math.max(1, Number(e.target.value) || 4) })
                    }
                    className="mt-1 w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
                  />
                </label>
                <label className="block text-xs text-[#9894b8]">
                  Ambient Sound
                  <select
                    value={activeScene.ambient || 'none'}
                    onChange={(e) => patchScene({ ambient: e.target.value as AmbientType })}
                    className="mt-1 w-full min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-2 text-xs text-white"
                  >
                    <option value="none">ไม่มีเสียงบรรยากาศ</option>
                    <option value="forest">ป่าและลมพัด</option>
                    <option value="night_insects">จิ้งหรีดยามค่ำ</option>
                    <option value="rain">เสียงฝนตก</option>
                    <option value="city">เสียงเมืองกลางคืน</option>
                    <option value="room">ห้องเงียบอบอุ่น</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Camera Shot Selection & Reason */}
            <div className="rounded-xl border border-white/10 bg-[#1b1d29] p-4 space-y-3">
              <div className="text-xs font-bold text-white">มุมกล้องภาพยนตร์ 3D (17 Camera Shots)</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={activeScene.shotType3d || 'medium'}
                  onChange={(e) => patchScene({ shotType3d: e.target.value as CameraShotType })}
                  className="min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  {CAMERA_SHOTS_3D.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label} — {c.desc}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={activeScene.shotReason || ''}
                  onChange={(e) => patchScene({ shotReason: e.target.value })}
                  placeholder="เหตุผลที่ผู้กำกับเลือกมุมกล้องนี้"
                  className="min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                />
              </div>
            </div>

            {/* Environment 3D Preset & Atmosphere Sliders */}
            <div className="rounded-xl border border-white/10 bg-[#1b1d29] p-4 space-y-3">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                <span>ฉาก 3 มิติ (Environment) & สภาพอากาศ</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={activeScene.env3d?.preset || 'forest_trail'}
                  onChange={(e) =>
                    patchScene({
                      env3d: {
                        ...(activeScene.env3d || {}),
                        preset: e.target.value as EnvironmentPreset3D,
                      },
                    })
                  }
                  className="min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  {ENVIRONMENT_PRESETS_3D.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
                <select
                  value={activeScene.env3d?.timeOfDay || 'golden'}
                  onChange={(e) =>
                    patchScene({
                      env3d: {
                        ...(activeScene.env3d || { preset: 'forest_trail' }),
                        timeOfDay: e.target.value as 'dawn' | 'day' | 'golden' | 'dusk' | 'night',
                      },
                    })
                  }
                  className="min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                >
                  <option value="dawn">รุ่งสาง (Dawn)</option>
                  <option value="day">กลางวัน (Day)</option>
                  <option value="golden">แสงเย็นสีทอง (Golden Hour)</option>
                  <option value="dusk">พลบค่ำ (Dusk)</option>
                  <option value="night">กลางคืน (Night)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-[11px] text-[#d6d3eb]">
                <label className="space-y-1">
                  <span>หมอก ({Math.round((activeScene.env3d?.fogDensity ?? 0.25) * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={activeScene.env3d?.fogDensity ?? 0.25}
                    onChange={(e) =>
                      patchScene({
                        env3d: {
                          ...(activeScene.env3d || { preset: 'forest_trail' }),
                          fogDensity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full studio-range"
                  />
                </label>
                <label className="space-y-1">
                  <span>สายฝน ({Math.round((activeScene.env3d?.rainIntensity ?? 0) * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={activeScene.env3d?.rainIntensity ?? 0}
                    onChange={(e) =>
                      patchScene({
                        env3d: {
                          ...(activeScene.env3d || { preset: 'forest_trail' }),
                          rainIntensity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full studio-range"
                  />
                </label>
                <label className="space-y-1">
                  <span>ละอองแสง ({Math.round((activeScene.env3d?.dustAmount ?? 0.35) * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={activeScene.env3d?.dustAmount ?? 0.35}
                    onChange={(e) =>
                      patchScene({
                        env3d: {
                          ...(activeScene.env3d || { preset: 'forest_trail' }),
                          dustAmount: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full studio-range"
                  />
                </label>
                <label className="space-y-1">
                  <span>ความหนาแน่นต้นไม้ ({Math.round((activeScene.env3d?.treesDensity ?? 0.6) * 100)}%)</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={activeScene.env3d?.treesDensity ?? 0.6}
                    onChange={(e) =>
                      patchScene({
                        env3d: {
                          ...(activeScene.env3d || { preset: 'forest_trail' }),
                          treesDensity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full studio-range"
                  />
                </label>
              </div>
            </div>

            {/* Actors & 3D Clips inside Scene */}
            <div className="rounded-xl border border-white/10 bg-[#1b1d29] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">นักแสดงและท่าแอนิเมชัน 3D ในฉากนี้</span>
                {project.characters.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextChar =
                        project.characters[activeScene.actors.length % project.characters.length];
                      patchScene({
                        actors: [
                          ...activeScene.actors,
                          {
                            char: nextChar.id,
                            x: activeScene.actors.length === 0 ? 0.45 : 0.68,
                            z: 0,
                            pose: 'idle',
                            clip3d: 'Idle',
                            face: 'neutral',
                            flip: activeScene.actors.length > 0,
                          },
                        ],
                      });
                    }}
                    className="text-xs font-semibold text-violet-300 hover:text-white cursor-pointer"
                  >
                    + เพิ่มนักแสดงในฉาก
                  </button>
                )}
              </div>

              {activeScene.actors.length === 0 ? (
                <p className="text-xs text-[#9894b8]">ไม่มีตัวละครในฉากนี้ (ฉากบรรยากาศหรือการ์ดข้อมูล)</p>
              ) : (
                <div className="space-y-2">
                  {activeScene.actors.map((act, aIdx) => (
                    <div
                      key={aIdx}
                      className="grid grid-cols-2 gap-2 sm:grid-cols-5 rounded-lg border border-white/10 bg-[#0b0c12] p-2.5 text-xs"
                    >
                      <select
                        value={act.char}
                        onChange={(e) => {
                          const nextActors = [...activeScene.actors];
                          nextActors[aIdx] = { ...act, char: e.target.value };
                          patchScene({ actors: nextActors });
                        }}
                        className="min-h-[34px] rounded border border-white/10 bg-[#13141d] px-2 text-white"
                      >
                        {project.characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={act.clip3d || 'Idle'}
                        onChange={(e) => {
                          const nextActors = [...activeScene.actors];
                          nextActors[aIdx] = { ...act, clip3d: e.target.value as AnimationClip3D };
                          patchScene({ actors: nextActors });
                        }}
                        className="min-h-[34px] rounded border border-white/10 bg-[#13141d] px-2 text-white"
                      >
                        {ANIMATION_CLIPS_3D.map((cl) => (
                          <option key={cl.id} value={cl.id}>
                            {cl.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={act.face}
                        onChange={(e) => {
                          const nextActors = [...activeScene.actors];
                          nextActors[aIdx] = { ...act, face: e.target.value as ActorFace };
                          patchScene({ actors: nextActors });
                        }}
                        className="min-h-[34px] rounded border border-white/10 bg-[#13141d] px-2 text-white"
                      >
                        {FACES.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="range"
                        min={0.15}
                        max={0.85}
                        step={0.05}
                        value={act.x}
                        onChange={(e) => {
                          const nextActors = [...activeScene.actors];
                          nextActors[aIdx] = { ...act, x: Number(e.target.value) };
                          patchScene({ actors: nextActors });
                        }}
                        title="ตำแหน่งซ้าย-ขวา (X)"
                        className="studio-range self-center"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          patchScene({
                            actors: activeScene.actors.filter((_, i) => i !== aIdx),
                          })
                        }
                        className="rounded border border-white/10 bg-[#13141d] px-2 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                      >
                        ลบออก
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
