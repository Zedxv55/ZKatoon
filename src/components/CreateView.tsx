import { useState } from 'react';
import {
  CheckCircle2,
  Clapperboard,
  FileJson,
  Play,
  Sliders,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AiScriptProvider,
  CameraShotType,
  CartoonAudience,
  CartoonEnding,
  CartoonProject,
  SavedProjectRecord,
  StudioSelection,
  StylePreset3D,
  SubtitleStyle,
  VideoLayoutMode,
} from '../types/cartoon';
import {
  AUDIENCE_OPTIONS,
  CAMERA_SHOTS_3D,
  ENDING_OPTIONS,
  GENRE_OPTIONS,
  LAYOUT_OPTIONS,
  MODE_OPTIONS,
  STARTER_TEMPLATES,
  STYLES,
  STYLE_PRESETS_3D,
  SUBTITLE_STYLE_OPTIONS,
} from '../utils/cartoonData';
import { normalizeProject, parseJsonSafely } from '../utils/projectLogic';

interface CreateViewProps {
  selection: StudioSelection;
  onChangeSelection: (next: StudioSelection) => void;
  topic: string;
  onChangeTopic: (val: string) => void;
  facts: string;
  onChangeFacts: (val: string) => void;
  aiProvider: AiScriptProvider;
  hasActiveKey: boolean;
  isGenerating: boolean;
  progressText: string;
  progressPct: number;
  errorText: string | null;
  draftPlanProject: CartoonProject | null;
  onGeneratePlan: () => void;
  onApprovePlan: (edited: CartoonProject) => void;
  onDiscardPlan: () => void;
  onImportOutputG: (proj: CartoonProject) => void;
  onLoadDemo3D: () => void;
  onLoadDemo2D: () => void;
  onGoSettings: () => void;
  savedProjects: SavedProjectRecord[];
  onOpenProject: (id: string) => void;
}

export function CreateView({
  selection,
  onChangeSelection,
  topic,
  onChangeTopic,
  facts,
  onChangeFacts,
  aiProvider,
  hasActiveKey,
  isGenerating,
  progressText,
  progressPct,
  errorText,
  draftPlanProject,
  onGeneratePlan,
  onApprovePlan,
  onDiscardPlan,
  onImportOutputG,
  onLoadDemo3D,
  onLoadDemo2D,
  onGoSettings,
  savedProjects,
  onOpenProject,
}: CreateViewProps) {
  const [advancedMode, setAdvancedMode] = useState(false);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonErr, setJsonErr] = useState<string | null>(null);
  const [editedPlan, setEditedPlan] = useState<CartoonProject | null>(null);

  const activeDraft = editedPlan && editedPlan.title === draftPlanProject?.title ? editedPlan : draftPlanProject;

  function handleImportJsonSubmit() {
    setJsonErr(null);
    try {
      const parsed = parseJsonSafely(jsonInput);
      const proj = normalizeProject(parsed);
      setShowJsonModal(false);
      setJsonInput('');
      onImportOutputG(proj);
    } catch (err) {
      setJsonErr(err instanceof Error ? err.message : 'รูปแบบ JSON ไม่ถูกต้อง');
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            สร้างการ์ตูน 3D & AI Story Director
          </h1>
          <p className="mt-1.5 text-sm text-[#9894b8] max-w-2xl">
            สร้างแอนิเมชัน 3D (Three.js WebGL) หรือ 2D สมุดสเก็ตช์ด้วย API Key ของคุณเอง พร้อมวาง Production Plan และ Shot List ให้ตรวจสอบก่อนผลิตจริง
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <div className="inline-flex rounded-xl border border-white/10 bg-[#13141d] p-1">
            <button
              type="button"
              onClick={() => setAdvancedMode(false)}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold cursor-pointer ${
                !advancedMode ? 'bg-violet-600 text-white' : 'text-[#9894b8] hover:text-white'
              }`}
            >
              โหมดง่าย (Simple)
            </button>
            <button
              type="button"
              onClick={() => setAdvancedMode(true)}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold cursor-pointer ${
                advancedMode ? 'bg-violet-600 text-white' : 'text-[#9894b8] hover:text-white'
              }`}
            >
              โหมดขั้นสูง (Advanced)
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowJsonModal(true)}
            className="inline-flex items-center gap-1.5 min-h-[42px] rounded-xl border border-white/10 bg-[#13141d] px-3.5 text-xs font-medium text-[#d6d3eb] hover:bg-[#1b1d29] cursor-pointer"
          >
            <FileJson className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span>นำเข้า JSON / OUTPUT G</span>
          </button>
        </div>
      </div>

      {/* Editable Production Plan Review Gate */}
      {activeDraft && (
        <section className="rounded-2xl border border-emerald-500/40 bg-[#13141d] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clapperboard className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                <span>ตรวจสอบและแก้ไข Production Plan ก่อนเริ่มสร้าง ({activeDraft.scenes.length} ฉาก)</span>
              </h2>
              <p className="text-xs text-[#9894b8]">
                AI Director ออกแบบโครงเรื่อง มุมกล้อง และบทพากย์แล้ว คุณสามารถแก้ไขข้อความหรือมุมกล้องก่อนเข้าสู่สตูดิโอได้ทันที
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditedPlan(null);
                  onDiscardPlan();
                }}
                className="min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 text-xs text-[#d6d3eb] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  const finalPlan = {
                    ...activeDraft,
                    productionPlan: {
                      ...activeDraft.productionPlan,
                      approvedAt: Date.now(),
                    },
                  };
                  setEditedPlan(null);
                  onApprovePlan(finalPlan);
                }}
                className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>อนุมัติแผนและเปิดสตูดิโอ</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block space-y-1 text-xs text-[#9894b8]">
              <span>ชื่อเรื่อง</span>
              <input
                type="text"
                value={activeDraft.title}
                onChange={(e) => setEditedPlan({ ...activeDraft, title: e.target.value })}
                className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-sm font-semibold text-white"
              />
            </label>
            <label className="block space-y-1 text-xs text-[#9894b8]">
              <span>แก่นเรื่อง / Logline</span>
              <input
                type="text"
                value={activeDraft.productionPlan?.logline || ''}
                onChange={(e) =>
                  setEditedPlan({
                    ...activeDraft,
                    productionPlan: { ...activeDraft.productionPlan, logline: e.target.value },
                  })
                }
                className="w-full min-h-[38px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              />
            </label>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {activeDraft.scenes.map((sc, idx) => (
              <div
                key={sc.id || idx}
                className="rounded-xl border border-white/10 bg-[#1b1d29] p-3 grid grid-cols-1 gap-2 sm:grid-cols-12 items-center"
              >
                <div className="sm:col-span-2 text-xs font-bold text-violet-300">
                  {sc.id || `S${idx + 1}`} · {sc.title || `ฉาก ${idx + 1}`}
                </div>
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    value={sc.narration}
                    onChange={(e) => {
                      const nextScenes = [...activeDraft.scenes];
                      nextScenes[idx] = { ...sc, narration: e.target.value };
                      setEditedPlan({ ...activeDraft, scenes: nextScenes });
                    }}
                    className="w-full min-h-[34px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
                  />
                </div>
                <div className="sm:col-span-4 flex gap-2">
                  <select
                    value={sc.shotType3d || 'medium'}
                    onChange={(e) => {
                      const nextScenes = [...activeDraft.scenes];
                      nextScenes[idx] = {
                        ...sc,
                        shotType3d: e.target.value as CameraShotType,
                      };
                      setEditedPlan({ ...activeDraft, scenes: nextScenes });
                    }}
                    className="flex-1 min-h-[34px] rounded-lg border border-white/10 bg-[#0b0c12] px-2 text-xs text-white"
                  >
                    {CAMERA_SHOTS_3D.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Creation Form */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
          {/* Starter Templates */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#9894b8]">เทมเพลตเริ่มต้นด่วน (คลิกเพื่อกรอกค่า)</div>
            <div className="flex flex-wrap gap-2">
              {STARTER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    onChangeTopic(tpl.topic);
                    onChangeFacts(tpl.facts);
                    onChangeSelection({
                      ...selection,
                      mode: tpl.mode,
                      genre: tpl.genre,
                      len: tpl.len,
                      style: tpl.style,
                      style3d: tpl.style3d,
                      renderEngine: tpl.renderEngine,
                      end: tpl.end,
                      layout: tpl.layout || 'full',
                      subtitleStyle: tpl.subtitleStyle || 'yellow_text',
                      director: {
                        ...selection.director,
                        targetDurationSec: tpl.len,
                        style3d: tpl.style3d,
                      },
                    });
                  }}
                  className="rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-1.5 text-xs font-medium text-[#d6d3eb] hover:border-violet-400/50 hover:text-white cursor-pointer"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic & Facts */}
          <div className="space-y-3">
            <div>
              <label htmlFor="topic-input" className="block text-sm font-semibold text-white mb-1.5">
                หัวข้อเรื่อง / ไอเดียการ์ตูน *
              </label>
              <textarea
                id="topic-input"
                rows={3}
                value={topic}
                onChange={(e) => onChangeTopic(e.target.value)}
                placeholder="เช่น เด็กหนุ่มกลับบ้านต่างจังหวัดตอนค่ำแล้วพบคุณปู่นั่งจุดโคมไฟรอริมแม่น้ำ..."
                className="w-full rounded-xl border border-white/10 bg-[#0b0c12] p-3 text-sm text-white placeholder:text-[#6f6b8f] focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="facts-input" className="block text-xs font-medium text-[#9894b8] mb-1">
                ข้อมูลจริง / โทนสี / เงื่อนไขเพิ่มเติม (ไม่บังคับ)
              </label>
              <input
                id="facts-input"
                type="text"
                value={facts}
                onChange={(e) => onChangeFacts(e.target.value)}
                placeholder="เช่น ห้ามแต่งสถิติ, เน้นบรรยากาศอบอุ่นยามเย็น, มี 2 ตัวละคร"
                className="w-full min-h-[42px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white placeholder:text-[#6f6b8f]"
              />
            </div>
          </div>

          {/* Render Engine & Core Options */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-[#9894b8] mb-1">เอนจินภาพ</label>
              <select
                value={selection.renderEngine}
                onChange={(e) =>
                  onChangeSelection({
                    ...selection,
                    renderEngine: e.target.value as StudioSelection['renderEngine'],
                  })
                }
                className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              >
                <option value="3d">3D Cinematic (Three.js WebGL)</option>
                <option value="2d_paper">2D Paper Sketch (Classic)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#9894b8] mb-1">โหมดรายการ</label>
              <select
                value={selection.mode}
                onChange={(e) =>
                  onChangeSelection({ ...selection, mode: e.target.value as StudioSelection['mode'] })
                }
                className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#9894b8] mb-1">แนวเรื่อง (Genre)</label>
              <select
                value={selection.genre}
                onChange={(e) =>
                  onChangeSelection({ ...selection, genre: e.target.value as StudioSelection['genre'] })
                }
                className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3D Style Picker or 2D Paper Picker */}
          {selection.renderEngine === '3d' ? (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-white">สไตล์ภาพ 3 มิติ (10 Visual Styles)</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {STYLE_PRESETS_3D.map((st) => {
                  const active = selection.style3d === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() =>
                        onChangeSelection({
                          ...selection,
                          style3d: st.id as StylePreset3D,
                          director: { ...selection.director, style3d: st.id as StylePreset3D },
                        })
                      }
                      className={`rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-violet-500 bg-violet-500/15 text-white'
                          : 'border-white/10 bg-[#1b1d29] text-[#d6d3eb] hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{st.badge}</div>
                      <div className="mt-1 text-[10px] text-[#9894b8] line-clamp-2">{st.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-[#9894b8] mb-1">สไตล์ 2D</label>
              <select
                value={selection.style}
                onChange={(e) =>
                  onChangeSelection({
                    ...selection,
                    style: e.target.value as StudioSelection['style'],
                  })
                }
                className="w-full min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              >
                {Object.values(STYLES).map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.n}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Advanced Unlocked AI Director Controls */}
          {advancedMode && (
            <div className="rounded-xl border border-white/10 bg-[#1b1d29] p-4 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sliders className="h-4 w-4 text-violet-400" aria-hidden="true" />
                <span>Advanced AI Director Controls (ปลดล็อกทุกพารามิเตอร์)</span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <label className="space-y-1 text-[#9894b8]">
                  <span>ความยาว (วินาที: {selection.director.targetDurationSec}s)</span>
                  <input
                    type="number"
                    min={15}
                    max={600}
                    value={selection.director.targetDurationSec}
                    onChange={(e) => {
                      const v = Math.max(15, Number(e.target.value) || 45);
                      onChangeSelection({
                        ...selection,
                        len: v,
                        director: { ...selection.director, targetDurationSec: v },
                      });
                    }}
                    className="w-full min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                  />
                </label>

                <label className="space-y-1 text-[#9894b8]">
                  <span>จำนวนฉาก ({selection.director.sceneCount} ฉาก)</span>
                  <input
                    type="number"
                    min={2}
                    max={40}
                    value={selection.director.sceneCount}
                    onChange={(e) =>
                      onChangeSelection({
                        ...selection,
                        director: {
                          ...selection.director,
                          sceneCount: Math.max(2, Number(e.target.value) || 6),
                        },
                      })
                    }
                    className="w-full min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                  />
                </label>

                <label className="space-y-1 text-[#9894b8]">
                  <span>จำนวนตัวละคร ({selection.director.characterCount})</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={selection.director.characterCount}
                    onChange={(e) =>
                      onChangeSelection({
                        ...selection,
                        director: {
                          ...selection.director,
                          characterCount: Math.max(1, Math.min(6, Number(e.target.value) || 2)),
                        },
                      })
                    }
                    className="w-full min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                  />
                </label>

                <label className="space-y-1 text-[#9894b8]">
                  <span>ผู้ชมเป้าหมาย</span>
                  <select
                    value={selection.audience}
                    onChange={(e) =>
                      onChangeSelection({
                        ...selection,
                        audience: e.target.value as CartoonAudience,
                      })
                    }
                    className="w-full min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-2 text-white"
                  >
                    {AUDIENCE_OPTIONS.map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-[11px] text-[#d6d3eb]">
                <label className="space-y-1">
                  <span>รายละเอียดฉาก ({selection.director.detailLevel}/5)</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={selection.director.detailLevel}
                    onChange={(e) =>
                      onChangeSelection({
                        ...selection,
                        director: { ...selection.director, detailLevel: Number(e.target.value) },
                      })
                    }
                    className="w-full studio-range"
                  />
                </label>
                <label className="space-y-1">
                  <span>ความสมจริง ({selection.director.realismLevel}/5)</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={selection.director.realismLevel}
                    onChange={(e) =>
                      onChangeSelection({
                        ...selection,
                        director: { ...selection.director, realismLevel: Number(e.target.value) },
                      })
                    }
                    className="w-full studio-range"
                  />
                </label>
                <label className="space-y-1">
                  <span>ความซับซ้อนกล้อง ({selection.director.cameraComplexity}/5)</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={selection.director.cameraComplexity}
                    onChange={(e) =>
                      onChangeSelection({
                        ...selection,
                        director: {
                          ...selection.director,
                          cameraComplexity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full studio-range"
                  />
                </label>
                <label className="space-y-1">
                  <span>ระดับเอฟเฟกต์ FX ({selection.director.fxLevel}/5)</span>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    value={selection.director.fxLevel}
                    onChange={(e) =>
                      onChangeSelection({
                        ...selection,
                        director: { ...selection.director, fxLevel: Number(e.target.value) },
                      })
                    }
                    className="w-full studio-range"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
                <select
                  value={selection.layout}
                  onChange={(e) =>
                    onChangeSelection({
                      ...selection,
                      layout: e.target.value as VideoLayoutMode,
                    })
                  }
                  className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                >
                  {LAYOUT_OPTIONS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selection.subtitleStyle}
                  onChange={(e) =>
                    onChangeSelection({
                      ...selection,
                      subtitleStyle: e.target.value as SubtitleStyle,
                    })
                  }
                  className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                >
                  {SUBTITLE_STYLE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  value={selection.end}
                  onChange={(e) =>
                    onChangeSelection({ ...selection, end: e.target.value as CartoonEnding })
                  }
                  className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-white"
                >
                  {ENDING_OPTIONS.map((en) => (
                    <option key={en.value} value={en.value}>
                      ตอนจบ: {en.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
            <div className="text-xs text-[#9894b8]">
              AI Script Provider: <strong className="text-white">{aiProvider}</strong> ·{' '}
              {hasActiveKey ? (
                <span className="text-emerald-300">พร้อมใช้งาน BYOK Key</span>
              ) : (
                <button
                  type="button"
                  onClick={onGoSettings}
                  className="text-amber-300 underline cursor-pointer"
                >
                  ยังไม่ได้ตั้งค่า API Key (คลิกเพื่อเพิ่ม)
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={onGeneratePlan}
              className="inline-flex items-center justify-center gap-2 min-h-[46px] rounded-xl bg-violet-600 px-6 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{isGenerating ? 'AI Director กำลังวางแผน…' : 'สร้าง Production Plan & Shot List'}</span>
            </button>
          </div>

          {isGenerating && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-violet-300">
                <span>{progressText}</span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {errorText && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
              {errorText}
            </div>
          )}
        </div>

        {/* Right Sidebar: Instant Starters & Recent Workspace Projects */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-3">
            <h2 className="text-sm font-bold text-white">ทดลองเล่นทันที (ไม่ต้องใช้ API Key)</h2>
            <p className="text-xs text-[#9894b8]">
              ทดสอบเอนจิน 3D WebGL และ 2D Paper Sketch พร้อมตัวละคร Bone Rig และกล้องหลายมุมได้ทันที
            </p>
            <button
              type="button"
              onClick={onLoadDemo3D}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-violet-600 px-4 text-xs font-bold text-white hover:bg-violet-500 cursor-pointer"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>เปิดตัวอย่าง 3D: คืนโคมไฟริมน้ำ</span>
            </button>
            <button
              type="button"
              onClick={onLoadDemo2D}
              className="w-full inline-flex items-center justify-center gap-2 min-h-[42px] rounded-xl border border-white/10 bg-[#1b1d29] px-4 text-xs font-semibold text-white hover:border-violet-400/50 cursor-pointer"
            >
              <Play className="h-4 w-4 text-amber-400" aria-hidden="true" />
              <span>เปิดตัวอย่าง 2D: สวัสดีวันจันทร์</span>
            </button>
          </div>

          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-3">
            <h2 className="text-sm font-bold text-white">
              โปรเจกต์ล่าสุดใน Workspace ({savedProjects.length})
            </h2>
            {savedProjects.length === 0 ? (
              <p className="text-xs text-[#9894b8]">ยังไม่มีโปรเจกต์ที่บันทึกไว้</p>
            ) : (
              <div className="space-y-2">
                {savedProjects.slice(0, 4).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenProject(p.id)}
                    className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-2 text-left text-xs hover:border-violet-400/40 cursor-pointer"
                  >
                    <span className="truncate font-semibold text-white">{p.title}</span>
                    <span className="text-[11px] text-[#9894b8] shrink-0">
                      {p.data.renderEngine === '2d_paper' ? '2D' : '3D'} · {p.data.scenes.length} ฉาก
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OUTPUT G / JSON Import Modal */}
      {showJsonModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#13141d] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">นำเข้า JSON / OUTPUT G</h3>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="rounded-lg p-1 text-[#9894b8] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <textarea
              rows={10}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='วาง JSON โครงสร้าง ZKatoon หรือ OUTPUT G (G1/G2/G4) ที่นี่...'
              className="w-full rounded-xl border border-white/10 bg-[#0b0c12] p-3 font-mono-tabular text-xs text-white"
            />
            {jsonErr && <p className="text-xs text-rose-300">{jsonErr}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-4 text-xs text-white cursor-pointer"
              >
                ปิด
              </button>
              <button
                type="button"
                onClick={handleImportJsonSubmit}
                className="min-h-[40px] rounded-xl bg-violet-600 px-5 text-xs font-bold text-white hover:bg-violet-500 cursor-pointer"
              >
                นำเข้าสตูดิโอ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
