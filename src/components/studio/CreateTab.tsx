import { Check, Loader2, Sparkles, StopCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import type {
  AppConfig,
  EpisodeChapter,
  OpenRouterModel,
  StudioProject,
  StudioScene,
  WizardAnswers,
} from '../../types/studio';
import {
  buildAndValidateGeneratedProject,
  estimateCostUsd,
  estimateThaiPipelineTokens,
  generateChapterScriptStep,
  generateConceptStep,
  generateOutlineStep,
  generateScenesForChapterLines,
  resolveWizardDefaults,
} from '../../utils/openRouterBrain';
import type { PipelineConceptOutput, PipelineOutlineChapter } from '../../utils/openRouterBrain';
import { STYLE_PACKS } from '../../utils/studioData';

interface CreateTabProps {
  config: AppConfig;
  models: OpenRouterModel[];
  savedProjects: StudioProject[];
  onProjectCreated: (project: StudioProject) => void;
  onGoToSettings: () => void;
}

const DEFAULT_WIZARD: WizardAnswers = {
  topic: '',
  mode: 'auto',
  genre: 'auto',
  durationLabel: '1 นาที',
  durationSec: 60,
  audience: 'auto',
  stylePack: 'auto',
  customStyleDesc: '',
  layout: 'auto',
  characterPreset: 'auto',
  ending: 'auto',
  elements: [],
  subtitleMode: 'auto',
  seriesMode: 'single',
  sequelSourceProjectId: '',
  extraFacts: '',
  extraBrands: '',
  extraForbidden: '',
  extraSources: '',
  approvalMode: 'auto_all',
};

function ChipRow<T extends string>(props: {
  label: string;
  value: T;
  options: Array<{ id: T; text: string }>;
  onChange: (val: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold text-[#c7c3e0]">{props.label}</div>
      <div className="flex flex-wrap gap-1.5">
        {props.options.map((opt) => {
          const active = props.value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => props.onChange(opt.id)}
              className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-amber-400 text-slate-950 font-bold'
                  : 'border border-white/10 bg-[#13141d] text-white/80 hover:bg-white/10'
              }`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CreateTab(props: CreateTabProps) {
  const { config, models, savedProjects, onProjectCreated, onGoToSettings } = props;
  const [ans, setAns] = useState<WizardAnswers>(DEFAULT_WIZARD);
  const [showExtras, setShowExtras] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [streamPreview, setStreamPreview] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step-by-step approval buffers
  const [pendingStep, setPendingStep] = useState<'concept' | 'outline' | 'script' | null>(null);
  const [conceptDraft, setConceptDraft] = useState<PipelineConceptOutput | null>(null);
  const [outlineDraft, setOutlineDraft] = useState<PipelineOutlineChapter[]>([]);
  const [scriptDraftByChapter, setScriptDraftByChapter] = useState<Record<string, string>>({});
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const selectedModel = models.find((m) => m.id === config.modelScript);
  const est = estimateThaiPipelineTokens(ans.durationSec);
  const estCost = estimateCostUsd(selectedModel, est.estimatedInputTokens, est.estimatedOutputTokens);
  const hasLlmKey = Boolean((config.useCustomLlm ? config.customLlmKey : config.openRouterKey).trim());

  const toggleElement = (el: string) => {
    setAns((prev) => ({
      ...prev,
      elements: prev.elements.includes(el) ? prev.elements.filter((x) => x !== el) : [...prev.elements, el],
    }));
  };

  const buildBaseDraftProject = (concept: PipelineConceptOutput): StudioProject => {
    const resolved = resolveWizardDefaults(ans);
    const pack = STYLE_PACKS[resolved.stylePack];
    const sources = ans.extraSources
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      id: `proj_${Date.now()}`,
      title: concept.title,
      mode: resolved.mode,
      layout: resolved.layout,
      stylePack: resolved.stylePack,
      customStyleDesc: ans.customStyleDesc || undefined,
      palette: concept.palette,
      characters: concept.characters,
      episodes: [
        {
          id: `ep_${Date.now()}`,
          ep: 1,
          total: 1,
          title: concept.title,
          chapters: [],
          scenes: [],
          music: {
            mood: resolved.mode === 'explainer' ? 'calm' : 'mystery',
            bpm: 90,
            key: 'C',
            mode: resolved.mode === 'story' ? 'minor' : 'major',
            swells: [],
            quietScenes: [],
            endStyle: 'resolve',
          },
          endingType: resolved.endingType,
        },
      ],
      seriesBible: {
        recap: concept.recap,
        lockedCharacterIds: concept.characters.map((c) => c.id),
      },
      settings: {
        subtitleMode: resolved.subtitleMode,
        letterboxTopText: resolved.layout === 'portrait_letterbox' ? concept.title : '',
        letterboxBottomText: resolved.layout === 'portrait_letterbox' ? `${Math.round(ans.durationSec / 60) || 1} นาทีจบ` : '',
        sourceNotes: sources,
        cinematicEnabled: true,
        hudEnabled: resolved.stylePack === 'A',
        fps: 30,
        resolution: '720p',
      },
      updatedAt: Date.now(),
    };
  };

  const finalizeFromChaptersAndScripts = async (
    concept: PipelineConceptOutput,
    chapters: PipelineOutlineChapter[],
    scriptsMap: Record<string, string>,
    signal: AbortSignal
  ) => {
    const baseProject = buildBaseDraftProject(concept);
    const allScenes: StudioScene[] = [];
    const builtChapters: EpisodeChapter[] = [];
    const fullLines: string[] = [];

    for (let i = 0; i < chapters.length; i++) {
      const ch = chapters[i];
      const lines = (scriptsMap[ch.id] || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      fullLines.push(...lines);
      setPhaseLabel(`กำลังกำกับภาพและเสียงบทที่ ${i + 1}/${chapters.length} (${lines.length} ฉาก)...`);
      const chScenes = await generateScenesForChapterLines({
        project: baseProject,
        episode: baseProject.episodes[0],
        chapter: { id: ch.id, title: ch.title, sceneIds: [] },
        lines,
        isFinalChapter: i === chapters.length - 1,
        config,
        signal,
        onStream: setStreamPreview,
      });
      builtChapters.push({
        id: ch.id,
        title: ch.title,
        sceneIds: chScenes.map((s) => s.id),
      });
      allScenes.push(...chScenes);
    }

    setPhaseLabel('กำลังตรวจสอบโครงสร้าง Scene Validator...');
    const validated = buildAndValidateGeneratedProject({
      baseProject,
      chapters: builtChapters,
      scenes: allScenes,
      fullScript: fullLines.join('\n'),
    });
    setValidationWarnings(validated.report.warnings);
    setPendingStep(null);
    setPhaseLabel(null);
    onProjectCreated(validated.project);
  };

  const startPipeline = async () => {
    if (!ans.topic.trim()) {
      setErrorMsg('กรุณาพิมพ์หัวข้อหรือไอเดียเรื่องที่ต้องการสร้างก่อน');
      return;
    }
    if (!hasLlmKey) {
      setErrorMsg('กรุณาใส่ OpenRouter API Key (หรือ Custom Endpoint Key) ในแท็บ “ตั้งค่า” ก่อน');
      return;
    }

    setErrorMsg(null);
    setValidationWarnings([]);
    setRunning(true);
    setStreamPreview('');
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const sequelSrc =
        ans.seriesMode === 'sequel'
          ? savedProjects.find((p) => p.id === ans.sequelSourceProjectId)
          : undefined;
      const lockedChars = sequelSrc
        ? sequelSrc.characters.filter((c) => sequelSrc.seriesBible.lockedCharacterIds.includes(c.id))
        : undefined;

      setPhaseLabel('ขั้นที่ 1/4: กำลังออกแบบ Concept, จานสี และตัวละคร...');
      const concept = await generateConceptStep({
        answers: ans,
        config,
        sequelBibleRecap: sequelSrc?.seriesBible.recap,
        sequelCharacters: lockedChars,
        signal: ac.signal,
        onStream: setStreamPreview,
      });
      setConceptDraft(concept);

      if (ans.approvalMode === 'step_by_step') {
        setPendingStep('concept');
        setRunning(false);
        setPhaseLabel(null);
        return;
      }

      setPhaseLabel('ขั้นที่ 2/4: กำลังวางโครงเรื่อง (Outline)...');
      const outline = await generateOutlineStep({
        answers: ans,
        concept,
        config,
        signal: ac.signal,
        onStream: setStreamPreview,
      });
      setOutlineDraft(outline);

      const scriptsMap: Record<string, string> = {};
      for (let i = 0; i < outline.length; i++) {
        const ch = outline[i];
        setPhaseLabel(`ขั้นที่ 3/4: กำลังเขียนบทพากย์บทที่ ${i + 1}/${outline.length}...`);
        const lines = await generateChapterScriptStep({
          chapter: ch,
          concept,
          answers: ans,
          config,
          signal: ac.signal,
          onStream: setStreamPreview,
        });
        scriptsMap[ch.id] = lines.join('\n');
      }
      setScriptDraftByChapter(scriptsMap);

      await finalizeFromChaptersAndScripts(concept, outline, scriptsMap, ac.signal);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้างโปรเจกต์');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleApproveStep = async () => {
    if (!conceptDraft) return;
    setRunning(true);
    setErrorMsg(null);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      if (pendingStep === 'concept') {
        setPhaseLabel('ขั้นที่ 2/4: กำลังวางโครงเรื่อง...');
        const outline = await generateOutlineStep({
          answers: ans,
          concept: conceptDraft,
          config,
          signal: ac.signal,
          onStream: setStreamPreview,
        });
        setOutlineDraft(outline);
        setPendingStep('outline');
      } else if (pendingStep === 'outline') {
        const scriptsMap: Record<string, string> = {};
        for (let i = 0; i < outlineDraft.length; i++) {
          const ch = outlineDraft[i];
          setPhaseLabel(`ขั้นที่ 3/4: กำลังเขียนบทบทที่ ${i + 1}/${outlineDraft.length}...`);
          const lines = await generateChapterScriptStep({
            chapter: ch,
            concept: conceptDraft,
            answers: ans,
            config,
            signal: ac.signal,
            onStream: setStreamPreview,
          });
          scriptsMap[ch.id] = lines.join('\n');
        }
        setScriptDraftByChapter(scriptsMap);
        setPendingStep('script');
      } else if (pendingStep === 'script') {
        await finalizeFromChaptersAndScripts(conceptDraft, outlineDraft, scriptDraftByChapter, ac.signal);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดระหว่างสร้าง');
    } finally {
      setRunning(false);
      setPhaseLabel(null);
      abortRef.current = null;
    }
  };

  return (
    <div className="space-y-4 p-4 pb-28">
      <div>
        <h2 className="text-lg font-bold text-white">สร้างการ์ตูนเรื่องใหม่ (12 ตัวเลือก)</h2>
        <p className="text-xs text-[#9894b8]">แตะชิปที่ต้องการ ข้อไหนไม่แน่ใจเลือก “ให้ AI เลือกให้” ได้ทุกข้อ</p>
      </div>

      {!hasLlmKey && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100">
          <span>ยังไม่ได้ใส่ OpenRouter Key (จำเป็นเฉพาะตอนกดสร้างด้วย AI)</span>
          <button
            type="button"
            onClick={onGoToSettings}
            className="min-h-[38px] rounded-xl bg-amber-400 px-3 font-bold text-slate-950 cursor-pointer"
          >
            ไปใส่ Key
          </button>
        </div>
      )}

      {/* 1. Topic */}
      <div className="space-y-1.5">
        <label htmlFor="wizard-topic" className="block text-xs font-bold text-white">
          1. หัวข้อ / ไอเดียเรื่อง (บังคับกรอก)
        </label>
        <textarea
          id="wizard-topic"
          rows={3}
          value={ans.topic}
          onChange={(e) => setAns((p) => ({ ...p, topic: e.target.value }))}
          placeholder="เช่น คืนที่ระบบสื่อสารดับทั้งเมือง พนักงานใต้ดินต้องเดินข้ามแม่น้ำเจ้าพระยากลับไปหาแม่..."
          className="w-full rounded-2xl border border-white/15 bg-[#13141d] p-3 text-sm text-white placeholder:text-white/35 focus:border-amber-400 focus:outline-none"
        />
      </div>

      {/* 2-11 Chips */}
      <div className="space-y-3.5">
        <ChipRow
          label="2. โหมดการเล่าเรื่อง"
          value={ans.mode}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้' },
            { id: 'story', text: 'เล่าเรื่อง / การ์ตูน' },
            { id: 'explainer', text: 'ให้ความรู้ / กราฟ' },
            { id: 'mix', text: 'ผสมเล่าเรื่อง+สรุป' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, mode: v }))}
        />

        <ChipRow
          label="3. แนวเรื่อง"
          value={ans.genre}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้' },
            { id: 'ลึกลับ/ระทึกขวัญ', text: 'ลึกลับ / ระทึก' },
            { id: 'ตลก/เบาสมอง', text: 'ตลก' },
            { id: 'ผี/ลี้ลับ', text: 'ผี / สยองขวัญ' },
            { id: 'ดราม่า/ซึ้ง', text: 'ดราม่า / ซึ้ง' },
            { id: 'จิตวิทยา/พัฒนาตัวเอง', text: 'สรุปหนังสือ / จิตวิทยา' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, genre: v }))}
        />

        <ChipRow
          label="4. ความยาวเป้าหมาย (~11 ตัวอักษร/วินาที)"
          value={ans.durationLabel}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้ (1 นาที)' },
            { id: '30 วิ', text: '30 วินาที' },
            { id: '1 นาที', text: '1 นาที' },
            { id: '3 นาที', text: '3 นาที' },
            { id: '10 นาที', text: '10 นาที' },
            { id: '30 นาที', text: '30 นาที' },
          ]}
          onChange={(v) => {
            const secMap: Record<string, number> = {
              auto: 60,
              '30 วิ': 30,
              '1 นาที': 60,
              '3 นาที': 180,
              '10 นาที': 600,
              '30 นาที': 1800,
            };
            setAns((p) => ({ ...p, durationLabel: v, durationSec: secMap[v] || 60 }));
          }}
        />

        <ChipRow
          label="5. กลุ่มผู้ชม"
          value={ans.audience}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้' },
            { id: 'general', text: 'คนทั่วไป' },
            { id: 'worker', text: 'วัยทำงาน' },
            { id: 'kids', text: 'เด็กและครอบครัว' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, audience: v }))}
        />

        <ChipRow
          label="6. สไตล์ภาพและจานสี"
          value={ans.stylePack}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้' },
            { id: 'A', text: 'Pack A เมืองกลางคืน' },
            { id: 'B', text: 'Pack B แถบกลาง/ศาลเจ้า' },
            { id: 'C', text: 'Pack C สดใสสรุปหนังสือ' },
            { id: 'custom', text: 'กำหนดเอง' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, stylePack: v }))}
        />

        {ans.stylePack === 'custom' && (
          <input
            type="text"
            value={ans.customStyleDesc}
            onChange={(e) => setAns((p) => ({ ...p, customStyleDesc: e.target.value }))}
            placeholder="อธิบายสไตล์และโทนสีที่อยากได้ เช่น โทนพาสเทลอบอุ่นย้อนยุค..."
            className="w-full rounded-xl border border-white/15 bg-[#13141d] px-3 py-2.5 text-sm text-white"
          />
        )}

        <ChipRow
          label="7. รูปแบบกรอบวิดีโอ"
          value={ans.layout}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้' },
            { id: 'portrait_full', text: 'แนวตั้งเต็มจอ 9:16' },
            { id: 'portrait_letterbox', text: '9:16 แถบกลาง 16:9 + หัวข้อบนล่าง' },
            { id: 'landscape', text: 'แนวนอน 16:9' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, layout: v }))}
        />

        <ChipRow
          label="8. ตัวละครในเรื่อง"
          value={ans.characterPreset}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้' },
            { id: '1', text: 'ตัวเอกเดี่ยว 1 คน' },
            { id: '2', text: 'คู่สนทนา 2 คน' },
            { id: '3-4', text: 'กลุ่มตัวละคร 3–4 คน' },
            { id: 'none', text: 'เน้นการ์ดข้อมูล/มือ POV' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, characterPreset: v }))}
        />

        <ChipRow
          label="9. ตอนจบที่ต้องการ"
          value={ans.ending}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้' },
            { id: 'twist', text: 'หักมุมชวนคิด' },
            { id: 'summary', text: 'สรุปข้อคิด' },
            { id: 'next', text: 'ปูทางตอนต่อไป' },
            { id: 'cta', text: 'ชวนคอมเมนต์ / แชร์' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, ending: v }))}
        />

        <div className="space-y-1.5">
          <div className="text-xs font-bold text-[#c7c3e0]">10. องค์ประกอบเสริม (เลือกได้หลายข้อ)</div>
          <div className="flex flex-wrap gap-1.5">
            {['หน้าจอแชตมือถือ', 'กราฟ/ตัวเลขใหญ่', 'เช็กลิสต์ปลดล็อก', 'ป้ายสถานี/แผนที่', 'มือ POV'].map((el) => {
              const active = ans.elements.includes(el);
              return (
                <button
                  key={el}
                  type="button"
                  onClick={() => toggleElement(el)}
                  className={`min-h-[40px] rounded-xl px-3 text-xs font-semibold cursor-pointer ${
                    active ? 'bg-violet-500 text-white font-bold' : 'border border-white/10 bg-[#13141d] text-white/80'
                  }`}
                >
                  {active ? `✓ ${el}` : el}
                </button>
              );
            })}
          </div>
        </div>

        <ChipRow
          label="11. สไตล์ซับไตเติล & ซีรีส์"
          value={ans.subtitleMode}
          options={[
            { id: 'auto', text: 'ให้ AI เลือกให้' },
            { id: 'yellow_highlight', text: 'ขาวไฮไลต์เหลือง' },
            { id: 'capsule_highlight', text: 'แคปซูลสลับแถบเหลือง' },
            { id: 'white_plain', text: 'ขาวขอบดำเรียบ' },
            { id: 'red_pill', text: 'ป้ายแดงเด่น' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, subtitleMode: v }))}
        />

        <ChipRow
          label="ความต่อเนื่องซีรีส์"
          value={ans.seriesMode}
          options={[
            { id: 'single', text: 'จบในตอนเดียว' },
            { id: 'ep1', text: 'ตอนที่ 1 (สร้าง Series Bible)' },
            { id: 'sequel', text: 'ภาคต่อ (ดึงตัวละครที่ล็อกไว้)' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, seriesMode: v }))}
        />

        {ans.seriesMode === 'sequel' && savedProjects.length > 0 && (
          <select
            value={ans.sequelSourceProjectId}
            onChange={(e) => setAns((p) => ({ ...p, sequelSourceProjectId: e.target.value }))}
            className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-sm text-white"
          >
            <option value="">-- เลือกโปรเจกต์ภาคก่อนเพื่อดึง Series Bible --</option>
            {savedProjects.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.title} (ล็อก {sp.seriesBible.lockedCharacterIds.length} ตัวละคร)
              </option>
            ))}
          </select>
        )}

        {/* 12. Extra constraints */}
        <div className="rounded-2xl border border-white/10 bg-[#13141d] p-3">
          <button
            type="button"
            onClick={() => setShowExtras((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-bold text-amber-300 cursor-pointer"
          >
            <span>12. ข้อมูลจริง / ข้อห้าม / แหล่งอ้างอิงเฉพาะของคุณ (ไม่บังคับ)</span>
            <span>{showExtras ? 'ซ่อน' : 'เปิดกรอก'}</span>
          </button>
          {showExtras && (
            <div className="mt-3 space-y-2.5">
              <textarea
                rows={2}
                value={ans.extraFacts}
                onChange={(e) => setAns((p) => ({ ...p, extraFacts: e.target.value }))}
                placeholder="ข้อเท็จจริงหรือตัวเลขที่คุณต้องการให้พูดถึง (AI จะไม่แต่งตัวเลขเพิ่มนอกเหนือจากนี้)"
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2.5 text-xs text-white"
              />
              <textarea
                rows={2}
                value={ans.extraSources}
                onChange={(e) => setAns((p) => ({ ...p, extraSources: e.target.value }))}
                placeholder="แหล่งอ้างอิงหรือชื่อหนังสือ (แยกบรรทัด — ถ้าเว้นว่าง การ์ดอ้างอิงจะไม่แสดง)"
                className="w-full rounded-xl border border-white/10 bg-black/30 p-2.5 text-xs text-white"
              />
              <input
                type="text"
                value={ans.extraForbidden}
                onChange={(e) => setAns((p) => ({ ...p, extraForbidden: e.target.value }))}
                placeholder="สิ่งที่ห้ามพูดถึงในคลิปนี้..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white"
              />
            </div>
          )}
        </div>

        <ChipRow
          label="โหมดการทำงาน"
          value={ans.approvalMode}
          options={[
            { id: 'auto_all', text: 'สร้างอัตโนมัติรวดเดียว (เร็ว)' },
            { id: 'step_by_step', text: 'ตรวจแก้ทีละขั้น (Concept → โครง → บท)' },
          ]}
          onChange={(v) => setAns((p) => ({ ...p, approvalMode: v }))}
        />
      </div>

      {/* Cost Estimate Banner */}
      <div className="rounded-2xl border border-white/10 bg-[#13141d] p-3 text-xs text-[#b8b4d6] flex flex-wrap items-center justify-between gap-2">
        <span>
          ประมาณการโทเคน: ~{(est.estimatedInputTokens + est.estimatedOutputTokens).toLocaleString()} tokens
        </span>
        <span className="font-semibold text-amber-300">
          {selectedModel
            ? `ค่า API โดยประมาณ: ~$${estCost.toFixed(4)} (${config.modelScript})`
            : `โมเดล: ${config.useCustomLlm ? config.customLlmModel : config.modelScript}`}
        </span>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-100 space-y-1">
          <div className="font-bold">คำเตือนหลังตรวจสอบบทและฉาก (Validator):</div>
          {validationWarnings.map((w, i) => (
            <div key={i}>• {w}</div>
          ))}
        </div>
      )}

      {/* Step-by-step approval panel */}
      {pendingStep && conceptDraft && (
        <div className="rounded-2xl border border-violet-400/40 bg-violet-500/10 p-4 space-y-3">
          <h3 className="text-sm font-bold text-white">
            {pendingStep === 'concept'
              ? 'ตรวจ Concept และตัวละครก่อนวางโครงเรื่อง'
              : pendingStep === 'outline'
                ? 'ตรวจโครงเรื่องแต่ละบทก่อนเขียนบทพากย์'
                : 'ตรวจแก้ไขบทพากย์ก่อนให้ AI แปลงเป็นฉาก'}
          </h3>

          {pendingStep === 'concept' && (
            <div className="space-y-2 text-xs">
              <input
                type="text"
                value={conceptDraft.title}
                onChange={(e) => setConceptDraft({ ...conceptDraft, title: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-white"
              />
              <textarea
                rows={2}
                value={conceptDraft.recap}
                onChange={(e) => setConceptDraft({ ...conceptDraft, recap: e.target.value })}
                className="w-full rounded-xl border border-white/15 bg-black/30 p-2.5 text-xs text-white"
              />
            </div>
          )}

          {pendingStep === 'outline' && (
            <div className="space-y-2">
              {outlineDraft.map((ch, i) => (
                <div key={ch.id} className="rounded-xl bg-black/30 p-2.5 text-xs text-white space-y-1">
                  <div className="font-bold text-amber-300">บทที่ {i + 1}: {ch.title}</div>
                  <div className="text-white/75">{ch.beats.join(' • ')}</div>
                </div>
              ))}
            </div>
          )}

          {pendingStep === 'script' && (
            <div className="space-y-2">
              {outlineDraft.map((ch) => (
                <div key={ch.id} className="space-y-1">
                  <div className="text-xs font-bold text-amber-300">{ch.title}</div>
                  <textarea
                    rows={5}
                    value={scriptDraftByChapter[ch.id] || ''}
                    onChange={(e) =>
                      setScriptDraftByChapter((prev) => ({ ...prev, [ch.id]: e.target.value }))
                    }
                    className="w-full rounded-xl border border-white/15 bg-black/30 p-2.5 text-xs text-white leading-relaxed"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={running}
            onClick={() => void handleApproveStep()}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold text-slate-950 cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>อนุมัติและไปขั้นตอนถัดไป</span>
          </button>
        </div>
      )}

      {/* Action / Streaming progress */}
      {running ? (
        <div className="rounded-2xl border border-amber-400/30 bg-[#13141d] p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{phaseLabel || 'กำลังทำงาน...'}</span>
            </div>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-rose-500/20 px-3 text-xs font-bold text-rose-200 cursor-pointer"
            >
              <StopCircle className="h-4 w-4" />
              <span>ยกเลิก</span>
            </button>
          </div>
          {streamPreview && (
            <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl bg-black/40 p-2.5 text-[11px] font-mono text-white/70">
              {streamPreview.slice(-700)}
            </pre>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void startPipeline()}
          className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-base font-extrabold text-slate-950 shadow-lg cursor-pointer active:scale-[0.99]"
        >
          <Sparkles className="h-5 w-5" />
          <span>เริ่มสร้างบทและฉากด้วย AI</span>
        </button>
      )}
    </div>
  );
}
