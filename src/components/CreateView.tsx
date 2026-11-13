import { useState } from 'react';
import {
  FileJson,
  FolderOpen,
  Layout,
  Play,
  Sliders,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import type {
  AiScriptProvider,
  CartoonAudience,
  CartoonProject,
  SavedProjectRecord,
  StudioSelection,
  SubtitleStyle,
  TtsProvider,
  VideoLayoutMode,
  VoiceName,
} from '../types/cartoon';
import {
  AUDIENCE_OPTIONS,
  ENDING_OPTIONS,
  GENRE_OPTIONS,
  LAYOUT_OPTIONS,
  LENGTH_OPTIONS,
  MODE_OPTIONS,
  STARTER_TEMPLATES,
  STYLES,
  SUBTITLE_STYLE_OPTIONS,
  VOICE_PRESETS,
} from '../utils/cartoonData';
import { normalizeProject, parseJsonSafely } from '../utils/projectLogic';

interface CreateViewProps {
  selection: StudioSelection;
  onChangeSelection: (next: StudioSelection) => void;
  topic: string;
  onChangeTopic: (val: string) => void;
  facts: string;
  onChangeFacts: (val: string) => void;
  voiceName: VoiceName;
  onChangeVoice: (val: VoiceName) => void;
  aiProvider: AiScriptProvider;
  openRouterModel: string;
  ttsProvider: TtsProvider;
  isGenerating: boolean;
  progressText: string;
  progressPct: number;
  errorText: string | null;
  onGenerate: () => void;
  onImportOutputG: (proj: CartoonProject) => void;
  onLoadDemo: () => void;
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
  voiceName,
  onChangeVoice,
  aiProvider,
  openRouterModel,
  ttsProvider,
  isGenerating,
  progressText,
  progressPct,
  errorText,
  onGenerate,
  onImportOutputG,
  onLoadDemo,
  onGoSettings,
  savedProjects,
  onOpenProject,
}: CreateViewProps) {
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonErr, setJsonErr] = useState<string | null>(null);

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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl text-balance">
            สร้างวิดีโอแอนิเมชันภาษาไทยด้วย AI
          </h1>
          <p className="mt-1.5 text-sm text-[#9894b8] max-w-2xl">
            รองรับสไตล์สมุดสเก็ตช์ (แบบคลิปตัวอย่าง), แนวตั้ง 9:16 และแถบกลาง 16:9 พร้อมกำหนดเวลา ซิงก์เสียง และสลับใช้ OpenRouter / PyThaiTTS ได้
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 self-start">
          <button
            type="button"
            onClick={() => setShowJsonModal(true)}
            className="inline-flex items-center gap-2 whitespace-nowrap min-h-[44px] rounded-xl border border-white/10 bg-[#13141d] px-4 py-2 text-sm font-medium text-[#d6d3eb] hover:bg-[#1b1d29] hover:text-white transition-colors cursor-pointer"
          >
            <FileJson className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <span>นำเข้า OUTPUT G (JSON)</span>
          </button>
          <button
            type="button"
            onClick={onLoadDemo}
            className="inline-flex items-center gap-2 whitespace-nowrap min-h-[44px] rounded-xl border border-violet-400/40 bg-violet-500/15 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500/25 transition-colors cursor-pointer"
          >
            <Play className="h-4 w-4 text-violet-300" aria-hidden="true" />
            <span>เปิดตัวอย่าง (บ้านเรา 7 คน)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: 12-Step Director Configuration */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Mode */}
          <section aria-labelledby="sec-mode">
            <h2 id="sec-mode" className="text-base font-semibold text-white mb-2.5">
              1. โหมดการเล่าเรื่อง
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {MODE_OPTIONS.map((m) => {
                const active = selection.mode === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => onChangeSelection({ ...selection, mode: m.value })}
                    className={`min-h-[68px] rounded-2xl border p-3.5 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-violet-400 bg-violet-500/15 text-white'
                        : 'border-white/[0.08] bg-[#13141d] text-[#d6d3eb] hover:border-white/20'
                    }`}
                  >
                    <div className="text-sm font-bold">{m.label}</div>
                    <div className="mt-1 text-xs text-[#9894b8]">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Genre & 3. Length & 4. Audience */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section aria-labelledby="sec-genre">
              <h2 id="sec-genre" className="text-base font-semibold text-white mb-2.5">
                2. แนว / อารมณ์
              </h2>
              <div className="flex flex-wrap gap-2">
                {GENRE_OPTIONS.map((g) => {
                  const active = selection.genre === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => onChangeSelection({ ...selection, genre: g.value })}
                      className={`min-h-[42px] whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-violet-400 bg-violet-500/15 text-white font-semibold'
                          : 'border-white/[0.08] bg-[#13141d] text-[#d6d3eb] hover:border-white/20'
                      }`}
                    >
                      {g.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="sec-len">
              <h2 id="sec-len" className="text-base font-semibold text-white mb-2.5">
                3. ความยาวเป้าหมาย
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LENGTH_OPTIONS.map((l) => {
                  const active = selection.len === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => onChangeSelection({ ...selection, len: l.value })}
                      className={`min-h-[54px] rounded-xl border px-2 py-2 text-center transition-colors cursor-pointer ${
                        active
                          ? 'border-violet-400 bg-violet-500/15 text-white'
                          : 'border-white/[0.08] bg-[#13141d] text-[#d6d3eb] hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs sm:text-sm font-bold tabular-nums">{l.label}</div>
                      <div className="text-[11px] text-[#9894b8] tabular-nums">{l.scenes} ฉาก</div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* 4. Visual Style Presets (including PAPER-SKETCH) */}
          <section aria-labelledby="sec-style">
            <h2 id="sec-style" className="text-base font-semibold text-white mb-2.5">
              4. สไตล์ภาพและบรรยากาศ
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {Object.values(STYLES).map((st) => {
                const active = selection.style === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() =>
                      onChangeSelection({
                        ...selection,
                        style: st.key,
                        subtitleStyle: st.key === 'paper' ? 'sticker_dual' : selection.subtitleStyle,
                        hudEnabled: st.key === 'paper' || st.key === 'cinema' ? true : selection.hudEnabled,
                      })
                    }
                    className={`group relative overflow-hidden rounded-2xl border p-3 text-left min-h-[88px] transition-transform active:scale-[0.98] cursor-pointer ${
                      active
                        ? 'border-white ring-2 ring-violet-400'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    style={{
                      background: `linear-gradient(155deg, ${st.t}, ${st.b} 68%, ${st.g})`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/15" />
                    <div className="relative z-10 flex h-full flex-col justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                        {st.code}
                      </span>
                      <div className="mt-2 text-xs font-bold text-white leading-snug">{st.n}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 5. Layout (Full 9:16 vs Letterbox 16:9) & Subtitles & Audience */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layout className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <span>5. เค้าโครงวิดีโอ ซับไตเติล และ HUD</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {LAYOUT_OPTIONS.map((opt) => {
                const active = selection.layout === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      onChangeSelection({ ...selection, layout: opt.value as VideoLayoutMode })
                    }
                    className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-violet-400 bg-violet-500/15 text-white'
                        : 'border-white/[0.08] bg-[#0a0b10] text-[#d6d3eb]'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="mt-0.5 text-[11px] text-[#9894b8]">{opt.desc}</div>
                  </button>
                );
              })}
            </div>

            {selection.layout === 'letterbox' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <input
                  type="text"
                  aria-label="ข้อความด้านบนเฟรม 16:9"
                  value={selection.topText}
                  onChange={(e) => onChangeSelection({ ...selection, topText: e.target.value })}
                  placeholder="หัวข้อพาดด้านบน (เช่น ทำไมกลุ่มนี้แปลก?)"
                  className="min-h-[42px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                />
                <input
                  type="text"
                  aria-label="ข้อความด้านล่างเฟรม 16:9"
                  value={selection.bottomText}
                  onChange={(e) => onChangeSelection({ ...selection, bottomText: e.target.value })}
                  placeholder="ข้อความพาดด้านล่าง (เช่น ดูให้จบ)"
                  className="min-h-[42px] rounded-xl border border-white/15 bg-[#0a0b10] px-3 text-xs text-white"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="sub-style-select" className="block text-[11px] text-[#9894b8] mb-1">
                  สไตล์คำบรรยาย
                </label>
                <select
                  id="sub-style-select"
                  value={selection.subtitleStyle}
                  onChange={(e) =>
                    onChangeSelection({ ...selection, subtitleStyle: e.target.value as SubtitleStyle })
                  }
                  className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-2.5 text-xs text-white"
                >
                  {SUBTITLE_STYLE_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="audience-select" className="block text-[11px] text-[#9894b8] mb-1">
                  ผู้ชมเป้าหมาย
                </label>
                <select
                  id="audience-select"
                  value={selection.audience}
                  onChange={(e) =>
                    onChangeSelection({ ...selection, audience: e.target.value as CartoonAudience })
                  }
                  className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-2.5 text-xs text-white"
                >
                  {AUDIENCE_OPTIONS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="end-select" className="block text-[11px] text-[#9894b8] mb-1">
                  รูปแบบการจบเรื่อง
                </label>
                <select
                  id="end-select"
                  value={selection.end}
                  onChange={(e) =>
                    onChangeSelection({ ...selection, end: e.target.value as StudioSelection['end'] })
                  }
                  className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#0a0b10] px-2.5 text-xs text-white"
                >
                  {ENDING_OPTIONS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-5 pt-1 text-xs text-[#d6d3eb]">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.hudEnabled}
                  onChange={(e) => onChangeSelection({ ...selection, hudEnabled: e.target.checked })}
                />
                <span>แสดงแถบ HUD มุมบน (เช่น บ้านเรา 7 คน · 06:00)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selection.cineEnabled}
                  onChange={(e) => onChangeSelection({ ...selection, cineEnabled: e.target.checked })}
                />
                <span>เปิด Cinematic Grade (แสง/เกรนโทนภาพยนตร์ 2.5D)</span>
              </label>
            </div>
          </section>
        </div>

        {/* Right Column: Topic, Templates, Engine Status & Generate CTA */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
            {/* Active AI & TTS Provider Quick Bar */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0a0b10] px-3.5 py-2.5 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-white truncate">
                  บท: {aiProvider === 'openrouter' ? `OpenRouter (${openRouterModel})` : 'Gemini (ในตัว)'}
                </div>
                <div className="text-[11px] text-[#9894b8] truncate">
                  เสียง: {ttsProvider === 'pythai' ? 'PyThaiTTS' : ttsProvider === 'openai_compatible' ? 'Custom TTS' : `Gemini TTS (${voiceName})`}
                </div>
              </div>
              <button
                type="button"
                onClick={onGoSettings}
                className="inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-white/15 bg-[#1b1d29] px-2.5 py-1.5 text-xs font-medium text-violet-300 hover:text-white cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                <span>สลับ Key / TTS</span>
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-base font-semibold text-white">6. หัวข้อเรื่องและข้อมูลจริง</h2>
                <span className="text-xs text-[#9894b8]">แม่แบบพร้อมใช้</span>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
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
                        end: tpl.end,
                        layout: tpl.layout ?? 'full',
                        subtitleStyle: tpl.subtitleStyle ?? (tpl.style === 'paper' ? 'sticker_dual' : 'yellow_text'),
                        hudEnabled: tpl.style === 'paper' || tpl.style === 'cinema',
                      });
                    }}
                    className="min-h-[36px] rounded-lg border border-white/10 bg-[#1b1d29] px-3 py-1.5 text-xs text-[#d6d3eb] hover:border-violet-400/60 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              <label htmlFor="topic-input" className="block text-sm font-medium text-[#d6d3eb] mb-1.5">
                หัวข้อที่ต้องการสร้างวิดีโอ <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="topic-input"
                value={topic}
                onChange={(e) => onChangeTopic(e.target.value)}
                rows={3}
                placeholder="เช่น เรื่องสั้นเปิดเบอร์ใหม่แล้วติดอยู่ในกลุ่มแชตครอบครัวคนแปลกหน้า 8 เดือน"
                className="w-full rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2.5 text-sm text-white placeholder:text-[#6f6b8c] focus:border-violet-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="facts-input" className="block text-sm font-medium text-[#d6d3eb] mb-1.5">
                ข้อเท็จจริง ตัวเลข หรือรายละเอียดเฉพาะ (AI จะไม่แต่งตัวเลขเพิ่มเอง)
              </label>
              <textarea
                id="facts-input"
                value={facts}
                onChange={(e) => onChangeFacts(e.target.value)}
                rows={2}
                placeholder="ใส่ข้อมูลจริง หรือระบุว่าเป็นเรื่องสมมติ"
                className="w-full rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2.5 text-sm text-white placeholder:text-[#6f6b8c] focus:border-violet-400 focus:outline-none"
              />
            </div>

            {ttsProvider === 'gemini' && (
              <div>
                <label htmlFor="create-voice-select" className="flex items-center gap-2 text-sm font-medium text-[#d6d3eb] mb-1.5">
                  <Volume2 className="h-4 w-4 text-violet-400" aria-hidden="true" />
                  <span>เสียงพากย์ (Gemini TTS)</span>
                </label>
                <select
                  id="create-voice-select"
                  value={voiceName}
                  onChange={(e) => onChangeVoice(e.target.value as VoiceName)}
                  className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
                >
                  {VOICE_PRESETS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {errorText && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
              >
                {errorText}
              </div>
            )}

            <button
              type="button"
              disabled={isGenerating}
              onClick={onGenerate}
              className="flex w-full min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="h-5 w-5" aria-hidden="true" />
              <span>{isGenerating ? 'กำลังสร้างบท ฉาก และเสียงพากย์…' : 'สร้างการ์ตูนและเสียงพากย์ด้วย AI'}</span>
            </button>

            {(isGenerating || progressPct > 0) && (
              <div className="rounded-xl border border-white/10 bg-[#0a0b10] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-[#d6d3eb]">
                  <span>{progressText}</span>
                  <span className="font-mono-tabular">{progressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-violet-500 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Saved Projects Quick List */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">โปรเจกต์ล่าสุดที่บันทึกไว้</h3>
              <span className="text-xs text-[#9894b8] tabular-nums">{savedProjects.length} รายการ</span>
            </div>

            {savedProjects.length === 0 ? (
              <p className="text-sm text-[#9894b8]">
                ยังไม่มีโปรเจกต์ที่บันทึก กดสร้างการ์ตูนหรือเปิดโปรเจกต์ตัวอย่างแล้วบันทึกได้เลย
              </p>
            ) : (
              <div className="space-y-2">
                {savedProjects.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenProject(item.id)}
                    className="flex w-full min-h-[52px] items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0a0b10] px-3.5 py-2 text-left hover:border-violet-400/50 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{item.title}</div>
                      <div className="text-xs text-[#9894b8]">
                        {STYLES[item.data.style]?.n || item.data.style} · {item.data.scenes.length} ฉาก
                        {item.audio ? ' · มีเสียงพากย์' : ''}
                      </div>
                    </div>
                    <FolderOpen className="h-4 w-4 shrink-0 text-[#9894b8]" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Import OUTPUT G JSON Modal */}
      {showJsonModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outputg-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#13141d] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="outputg-modal-title" className="text-lg font-bold text-white">
                นำเข้าแพ็กเกจ OUTPUT G (JSON)
              </h2>
              <button
                type="button"
                aria-label="ปิดหน้าต่าง"
                onClick={() => setShowJsonModal(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[#9894b8] hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-[#9894b8]">
              วาง JSON จากผู้กำกับ (รองรับทั้งรูปแบบ G1/G2/G4 ของ OUTPUT G และรูปแบบโปรเจกต์มาตรฐาน)
            </p>
            <textarea
              rows={10}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{"G1": {"title": "...", "style_preset": "PAPER-SKETCH"}, "G2": [...], "G4": [...]}'
              className="w-full rounded-xl border border-white/15 bg-[#0a0b10] p-3 font-mono text-xs text-white focus:border-violet-400 focus:outline-none"
            />
            {jsonErr && (
              <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                {jsonErr}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="min-h-[42px] rounded-xl border border-white/10 px-4 text-sm text-[#d6d3eb] cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleImportJsonSubmit}
                className="min-h-[42px] rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 cursor-pointer"
              >
                นำเข้าและเปิดในสตูดิโอ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
