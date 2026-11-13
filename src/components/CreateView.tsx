import { FolderOpen, Play, Sparkles, Volume2 } from 'lucide-react';
import type {
  SavedProjectRecord,
  StudioSelection,
  VoiceName,
} from '../types/cartoon';
import {
  ENDING_OPTIONS,
  GENRE_OPTIONS,
  LENGTH_OPTIONS,
  MODE_OPTIONS,
  STARTER_TEMPLATES,
  STYLES,
  VOICE_PRESETS,
} from '../utils/cartoonData';

interface CreateViewProps {
  selection: StudioSelection;
  onChangeSelection: (next: StudioSelection) => void;
  topic: string;
  onChangeTopic: (val: string) => void;
  facts: string;
  onChangeFacts: (val: string) => void;
  voiceName: VoiceName;
  onChangeVoice: (val: VoiceName) => void;
  isGenerating: boolean;
  progressText: string;
  progressPct: number;
  errorText: string | null;
  onGenerate: () => void;
  onLoadDemo: () => void;
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
  isGenerating,
  progressText,
  progressPct,
  errorText,
  onGenerate,
  onLoadDemo,
  savedProjects,
  onOpenProject,
}: CreateViewProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl text-balance">
            สร้างวิดีโอการ์ตูนแนวตั้งด้วย AI
          </h1>
          <p className="mt-1.5 text-sm text-[#9894b8] max-w-2xl">
            กำหนดโหมด แนวเรื่อง สไตล์ภาพ และหัวข้อที่ต้องการ ระบบจะเขียนบท ออกแบบตัวละคร พากย์เสียงภาษาไทย และจัดฉากแอนิเมชันให้อัตโนมัติ
          </p>
        </div>
        <button
          type="button"
          onClick={onLoadDemo}
          className="inline-flex items-center gap-2 self-start whitespace-nowrap shrink-0 min-h-[44px] rounded-xl border border-white/10 bg-[#13141d] px-4 py-2 text-sm font-medium text-white hover:bg-[#1b1d29] transition-colors cursor-pointer"
        >
          <Play className="h-4 w-4 text-violet-400" aria-hidden="true" />
          <span>เปิดโปรเจกต์ตัวอย่าง</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left Column: Visual & Narrative Configuration */}
        <div className="lg:col-span-7 space-y-7">
          {/* 1. Mode */}
          <section aria-labelledby="sec-mode">
            <h2 id="sec-mode" className="text-base font-semibold text-white mb-3">
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
                    className={`min-h-[68px] rounded-2xl border p-4 text-left transition-colors cursor-pointer ${
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

          {/* 2. Genre & 3. Length */}
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2">
            <section aria-labelledby="sec-genre">
              <h2 id="sec-genre" className="text-base font-semibold text-white mb-3">
                2. แนวเรื่อง
              </h2>
              <div className="flex flex-wrap gap-2">
                {GENRE_OPTIONS.map((g) => {
                  const active = selection.genre === g.value;
                  return (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => onChangeSelection({ ...selection, genre: g.value })}
                      className={`min-h-[44px] whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
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
              <h2 id="sec-len" className="text-base font-semibold text-white mb-3">
                3. ความยาววิดีโอ
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
                {LENGTH_OPTIONS.map((l) => {
                  const active = selection.len === l.value;
                  return (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => onChangeSelection({ ...selection, len: l.value })}
                      className={`min-h-[56px] rounded-xl border px-3 py-2 text-center transition-colors cursor-pointer ${
                        active
                          ? 'border-violet-400 bg-violet-500/15 text-white'
                          : 'border-white/[0.08] bg-[#13141d] text-[#d6d3eb] hover:border-white/20'
                      }`}
                    >
                      <div className="text-sm font-bold tabular-nums">{l.label}</div>
                      <div className="text-[11px] text-[#9894b8] tabular-nums">{l.scenes} ฉาก</div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          {/* 4. Visual Styles */}
          <section aria-labelledby="sec-style">
            <h2 id="sec-style" className="text-base font-semibold text-white mb-3">
              4. สไตล์ภาพและบรรยากาศ
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.values(STYLES).map((st) => {
                const active = selection.style === st.key;
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => onChangeSelection({ ...selection, style: st.key })}
                    className={`group relative overflow-hidden rounded-2xl border p-3.5 text-left min-h-[100px] transition-transform active:scale-[0.98] cursor-pointer ${
                      active
                        ? 'border-white ring-2 ring-violet-400'
                        : 'border-white/10 hover:border-white/30'
                    }`}
                    style={{
                      background: `linear-gradient(155deg, ${st.t}, ${st.b} 68%, ${st.g})`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                    <div className="relative z-10 flex h-full flex-col justify-between">
                      <span className="text-[11px] font-medium text-white/85">{st.tag}</span>
                      <div className="mt-4">
                        <div className="text-sm font-bold text-white leading-snug">{st.n}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 5. Ending */}
          <section aria-labelledby="sec-end">
            <h2 id="sec-end" className="text-base font-semibold text-white mb-3">
              5. รูปแบบการจบเรื่อง
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {ENDING_OPTIONS.map((e) => {
                const active = selection.end === e.value;
                return (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => onChangeSelection({ ...selection, end: e.value })}
                    className={`min-h-[46px] rounded-xl border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-violet-400 bg-violet-500/15 text-white font-semibold'
                        : 'border-white/[0.08] bg-[#13141d] text-[#d6d3eb] hover:border-white/20'
                    }`}
                  >
                    {e.label}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column: Topic, Templates, Voice & Generate CTA */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-base font-semibold text-white">6. หัวข้อเรื่องและข้อมูลสำคัญ</h2>
                <span className="text-xs text-[#9894b8]">แม่แบบแนะนำ</span>
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
                        mode: tpl.mode,
                        genre: tpl.genre,
                        len: tpl.len,
                        style: tpl.style,
                        end: tpl.end,
                      });
                    }}
                    className="min-h-[36px] rounded-lg border border-white/10 bg-[#1b1d29] px-3 py-1.5 text-xs text-[#d6d3eb] hover:border-violet-400/60 hover:text-white transition-colors cursor-pointer text-left"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              <label htmlFor="topic-input" className="block text-sm font-medium text-[#d6d3eb] mb-1.5">
                หัวข้อที่ต้องการสร้างการ์ตูน <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="topic-input"
                value={topic}
                onChange={(e) => onChangeTopic(e.target.value)}
                rows={3}
                placeholder="เช่น ทำไมคนถึงชอบสะดุ้งตื่นตอนตีสามแล้วนอนต่อไม่ได้"
                className="w-full rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2.5 text-sm text-white placeholder:text-[#6f6b8c] focus:border-violet-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="facts-input" className="block text-sm font-medium text-[#d6d3eb] mb-1.5">
                ข้อเท็จจริง ตัวเลข หรือข้อห้ามที่ต้องใช้ (ไม่บังคับ)
              </label>
              <textarea
                id="facts-input"
                value={facts}
                onChange={(e) => onChangeFacts(e.target.value)}
                rows={2}
                placeholder="AI จะยึดตามข้อมูลนี้โดยไม่แต่งตัวเลขเพิ่มเอง"
                className="w-full rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2.5 text-sm text-white placeholder:text-[#6f6b8c] focus:border-violet-400 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="create-voice-select" className="flex items-center gap-2 text-sm font-medium text-[#d6d3eb] mb-1.5">
                <Volume2 className="h-4 w-4 text-violet-400" aria-hidden="true" />
                <span>เสียงพากย์ภาษาไทย</span>
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
              <span>{isGenerating ? 'กำลังสร้างการ์ตูนและเสียงพากย์…' : 'สร้างการ์ตูนด้วย AI'}</span>
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
    </div>
  );
}
