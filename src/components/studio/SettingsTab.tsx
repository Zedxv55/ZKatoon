import { Eye, KeyRound, Palette, RefreshCw, Search, ShieldAlert, Sparkles, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ByokCredentialSummary, ModelCategory, ModelRegistryItem } from '../../types/platform';
import type {
  AppConfig,
  OpenRouterModel,
  StudioProject,
  StylePackId,
} from '../../types/studio';
import { ANIMATE_STYLE_PLUGINS } from '../../utils/animateStyles';
import { paintBackgroundPreset } from '../../utils/drawBackgrounds';
import { drawCharacter } from '../../utils/drawCharacter';
import { drawStudioCard } from '../../utils/drawPropsAndCards';
import { fetchOpenRouterModels } from '../../utils/openRouterBrain';
import { platformApi } from '../../utils/platformApi';
import { BG_PRESETS, CARD_TYPES, FACES, POSES } from '../../utils/registry';
import { DEFAULT_PROMPT_TEMPLATES, STYLE_PACKS } from '../../utils/studioData';

interface SettingsTabProps {
  config: AppConfig;
  project: StudioProject;
  models: OpenRouterModel[];
  byokList?: ByokCredentialSummary[];
  registryModels?: ModelRegistryItem[];
  isSignedIn?: boolean;
  onUpdateConfig: (next: AppConfig) => void;
  onUpdateProject: (next: StudioProject) => void;
  onModelsLoaded: (models: OpenRouterModel[]) => void;
  onRefreshPlatform?: () => Promise<void>;
  onOpenOnboarding?: () => void;
  onOpenAuth?: () => void;
}

function QaBgTile({ preset, stylePack }: { preset: typeof BG_PRESETS[number]; stylePack: StylePackId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    paintBackgroundPreset(ctx, c.width, c.height, preset, stylePack, STYLE_PACKS[stylePack].palette);
  }, [preset, stylePack]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-1.5">
      <canvas ref={ref} width={140} height={100} className="w-full rounded-lg" />
      <div className="mt-1 truncate text-center text-[10px] text-white/85">{preset}</div>
    </div>
  );
}

function QaPoseTile({
  pose,
  face,
  project,
}: {
  pose: typeof POSES[number];
  face: typeof FACES[number];
  project: StudioProject;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const char = project.characters[0];
  useEffect(() => {
    const c = ref.current;
    if (!c || !char) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#181c28';
    ctx.fillRect(0, 0, c.width, c.height);
    drawCharacter(ctx, char, {
      x: c.width / 2,
      y: c.height * 0.9,
      baseHeight: c.height * 0.72,
      scale: 1,
      pose,
      face,
      timeSec: 1.0,
      mouthOpen: pose === 'talk' ? 0.65 : 0,
    });
  }, [char, pose, face]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-1.5">
      <canvas ref={ref} width={110} height={120} className="w-full rounded-lg" />
      <div className="mt-1 truncate text-center text-[10px] text-white/85">
        {pose}/{face}
      </div>
    </div>
  );
}

function QaCardTile({ cardType, stylePack }: { cardType: typeof CARD_TYPES[number]; stylePack: StylePackId }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#141824';
    ctx.fillRect(0, 0, c.width, c.height);
    drawStudioCard(
      ctx,
      {
        type: cardType,
        title: `ตัวอย่าง ${cardType}`,
        text: cardType === 'bignumber' ? '85%' : 'ข้อความทดสอบ',
        tag: 'ตัวอย่าง',
        author: 'QA Gallery',
        headline: 'สรุปท้ายตอน',
        subline: 'รายละเอียดตัวอย่าง',
        cta: 'ดำเนินการต่อ',
        bars: [
          { label: 'ก', value: 60 },
          { label: 'ข', value: 90 },
        ],
        items: [
          { text: 'หัวข้อที่ 1', state: 'done' },
          { text: 'หัวข้อที่ 2', state: 'locked' },
        ],
        left: { title: 'เดิม', items: ['ช้า'] },
        right: { title: 'ใหม่', items: ['เร็ว'] },
        messages: [{ sender: 'A', text: 'สวัสดี', mine: true }],
      },
      0,
      1,
      c.width,
      c.height,
      stylePack,
      1.2
    );
  }, [cardType, stylePack]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-1.5">
      <canvas ref={ref} width={220} height={280} className="w-full rounded-lg" />
      <div className="mt-1 truncate text-center text-[10px] text-white/85">{cardType}</div>
    </div>
  );
}

export function SettingsTab(props: SettingsTabProps) {
  const {
    config,
    project,
    models,
    byokList = [],
    registryModels = [],
    isSignedIn = false,
    onUpdateConfig,
    onUpdateProject,
    onModelsLoaded,
    onRefreshPlatform,
    onOpenOnboarding,
    onOpenAuth,
  } = props;
  const [modelSearch, setModelSearch] = useState('');
  const [structuredOnly, setStructuredOnly] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [vaultProvider, setVaultProvider] = useState('openrouter');
  const [vaultKey, setVaultKey] = useState('');
  const [vaultMsg, setVaultMsg] = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState<ModelCategory | 'ALL'>('ALL');

  // Visual QA Gallery
  const [qaOpen, setQaOpen] = useState(false);
  const [qaMode, setQaMode] = useState<'bg' | 'pose' | 'cards'>('bg');

  const handleFetchModels = async () => {
    setLoadingModels(true);
    setModelError(null);
    try {
      const list = await fetchOpenRouterModels(config.openRouterKey);
      onModelsLoaded(list);
    } catch (err) {
      setModelError(err instanceof Error ? err.message : 'โหลดรายการโมเดลไม่สำเร็จ');
    } finally {
      setLoadingModels(false);
    }
  };

  const filteredModels = models
    .filter((m) => (!structuredOnly || m.supportsStructuredOutput))
    .filter(
      (m) =>
        !modelSearch.trim() ||
        m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.name.toLowerCase().includes(modelSearch.toLowerCase())
    )
    .sort((a, b) => {
      const af = config.favoriteModelIds.includes(a.id) ? 0 : 1;
      const bf = config.favoriteModelIds.includes(b.id) ? 0 : 1;
      return af - bf;
    })
    .slice(0, 40);

  return (
    <div className="space-y-5 p-4 pb-28">
      <div>
        <h2 className="text-lg font-bold text-white">ตั้งค่า API Keys, โมเดล AI & Visual QA</h2>
        <p className="text-xs text-[#9894b8]">คีย์เก็บในเครื่องของคุณเท่านั้น ไม่มีการส่งผ่านเซิร์ฟเวอร์อื่น</p>
      </div>

      {/* Security / Privacy Banner & Don't Remember Keys Toggle */}
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3.5 space-y-2.5">
        <div className="flex items-start gap-2 text-xs text-amber-100">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
          <span>
            แนะนำให้ตั้งวงเงินจำกัด (Spending Limit) บน OpenRouter/ElevenLabs เสมอ หากใช้เครื่องสาธารณะให้เปิดโหมด “ไม่จำคีย์” ด้านล่าง
          </span>
        </div>
        <label className="flex items-center gap-2.5 text-xs font-bold text-white cursor-pointer">
          <input
            type="checkbox"
            checked={config.dontRememberKeys}
            onChange={(e) => onUpdateConfig({ ...config, dontRememberKeys: e.target.checked })}
            className="h-5 w-5 rounded accent-amber-400"
          />
          <span>ไม่จำคีย์หลังปิดแท็บ (เก็บ Key ไว้ใน RAM ชั่วคราวเท่านั้น)</span>
        </label>
      </div>

      {/* OpenRouter & Custom LLM Keys */}
      <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-bold text-white">
            <KeyRound className="h-4 w-4 text-amber-300" />
            AI Brain (OpenRouter / Custom OpenAI Endpoint)
          </span>
          <label className="flex items-center gap-1.5 text-xs text-white/85 cursor-pointer">
            <input
              type="checkbox"
              checked={config.useCustomLlm}
              onChange={(e) => onUpdateConfig({ ...config, useCustomLlm: e.target.checked })}
              className="accent-violet-500"
            />
            ใช้ Custom URL
          </label>
        </div>

        {!config.useCustomLlm ? (
          <div className="space-y-2">
            <input
              type="password"
              value={config.openRouterKey}
              onChange={(e) => onUpdateConfig({ ...config, openRouterKey: e.target.value })}
              placeholder="OpenRouter API Key (sk-or-v1-...)"
              className="min-h-[44px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-white"
            />

            {/* Model Browser */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                <input
                  type="text"
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="ค้นหาโมเดล เช่น gemini, claude, deepseek..."
                  className="min-h-[40px] w-full rounded-xl border border-white/15 bg-black/30 pl-9 pr-3 text-xs text-white"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleFetchModels()}
                disabled={loadingModels}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-violet-500 px-3 text-xs font-bold text-white cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingModels ? 'animate-spin' : ''}`} />
                <span>ดึงโมเดล ({models.length})</span>
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#c7c3e0] cursor-pointer">
              <input
                type="checkbox"
                checked={structuredOnly}
                onChange={(e) => setStructuredOnly(e.target.checked)}
                className="accent-amber-400"
              />
              <span>แสดงเฉพาะโมเดลที่รองรับ Structured Output (JSON แม่น)</span>
            </label>

            {modelError && <div className="text-xs text-rose-300">{modelError}</div>}

            {filteredModels.length > 0 && (
              <div className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-white/10 bg-black/25 p-2">
                {filteredModels.map((m) => {
                  const fav = config.favoriteModelIds.includes(m.id);
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            ...config,
                            favoriteModelIds: fav
                              ? config.favoriteModelIds.filter((x) => x !== m.id)
                              : [...config.favoriteModelIds, m.id],
                          })
                        }
                        className="cursor-pointer"
                        aria-label={`ติดดาว ${m.name}`}
                      >
                        <Star className={`h-3.5 w-3.5 ${fav ? 'fill-amber-400 text-amber-400' : 'text-white/30'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateConfig({
                            ...config,
                            modelScript: m.id,
                            ...(config.useSameModel ? { modelSceneJson: m.id, modelChatEdit: m.id } : {}),
                          })
                        }
                        className="flex-1 text-left truncate text-white cursor-pointer"
                      >
                        {m.name} {m.supportsStructuredOutput ? '✓JSON' : ''}
                      </button>
                      <span className="shrink-0 font-mono text-[10px] text-amber-300">
                        ${m.promptPricePerM.toFixed(2)}/M
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3 Role Picker */}
            <div className="space-y-2 pt-1 text-xs">
              <label className="flex items-center gap-2 text-white font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useSameModel}
                  onChange={(e) => onUpdateConfig({ ...config, useSameModel: e.target.checked })}
                  className="accent-amber-400"
                />
                <span>ใช้โมเดลเดียวกันทั้ง 3 หน้าที่</span>
              </label>
              <div>
                <span className="text-[#9894b8]">โมเดลหลัก (เขียนบท / วางโครง):</span>
                <input
                  type="text"
                  value={config.modelScript}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      modelScript: e.target.value,
                      ...(config.useSameModel
                        ? { modelSceneJson: e.target.value, modelChatEdit: e.target.value }
                        : {}),
                    })
                  }
                  className="mt-1 min-h-[40px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white font-mono"
                />
              </div>
              {!config.useSameModel && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[#9894b8]">กำกับฉาก JSON:</span>
                    <input
                      type="text"
                      value={config.modelSceneJson}
                      onChange={(e) => onUpdateConfig({ ...config, modelSceneJson: e.target.value })}
                      className="mt-1 min-h-[38px] w-full rounded-xl border border-white/15 bg-black/30 px-2.5 text-white font-mono"
                    />
                  </div>
                  <div>
                    <span className="text-[#9894b8]">แชตแก้ไขฉาก:</span>
                    <input
                      type="text"
                      value={config.modelChatEdit}
                      onChange={(e) => onUpdateConfig({ ...config, modelChatEdit: e.target.value })}
                      className="mt-1 min-h-[38px] w-full rounded-xl border border-white/15 bg-black/30 px-2.5 text-white font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-xs">
            <input
              type="text"
              value={config.customLlmBaseUrl}
              onChange={(e) => onUpdateConfig({ ...config, customLlmBaseUrl: e.target.value })}
              placeholder="Base URL เช่น https://api.openai.com/v1"
              className="min-h-[42px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white"
            />
            <input
              type="password"
              value={config.customLlmKey}
              onChange={(e) => onUpdateConfig({ ...config, customLlmKey: e.target.value })}
              placeholder="API Key"
              className="min-h-[42px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white"
            />
            <input
              type="text"
              value={config.customLlmModel}
              onChange={(e) => onUpdateConfig({ ...config, customLlmModel: e.target.value })}
              placeholder="Model ID เช่น gpt-4o-mini หรือ llama3.1"
              className="min-h-[42px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white"
            />
          </div>
        )}
      </div>

      {/* TTS Keys & Freesound */}
      <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-3 text-xs">
        <div className="text-sm font-bold text-white">คีย์พากย์เสียง TTS & Freesound</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="text-[#9894b8]">ElevenLabs Key:</span>
            <input
              type="password"
              value={config.elevenLabsKey}
              onChange={(e) => onUpdateConfig({ ...config, elevenLabsKey: e.target.value })}
              placeholder="xi-api-key..."
              className="mt-1 min-h-[40px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white"
            />
          </div>
          <div>
            <span className="text-[#9894b8]">ElevenLabs Voice ID:</span>
            <input
              type="text"
              value={config.elevenLabsVoiceId}
              onChange={(e) => onUpdateConfig({ ...config, elevenLabsVoiceId: e.target.value })}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white font-mono"
            />
          </div>
          <div>
            <span className="text-[#9894b8]">OpenAI TTS Base URL:</span>
            <input
              type="text"
              value={config.openAiTtsBaseUrl}
              onChange={(e) => onUpdateConfig({ ...config, openAiTtsBaseUrl: e.target.value })}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white"
            />
          </div>
          <div>
            <span className="text-[#9894b8]">OpenAI TTS Key:</span>
            <input
              type="password"
              value={config.openAiTtsKey}
              onChange={(e) => onUpdateConfig({ ...config, openAiTtsKey: e.target.value })}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white"
            />
          </div>
          <div>
            <span className="text-[#9894b8]">Google Cloud TTS Key:</span>
            <input
              type="password"
              value={config.googleTtsKey}
              onChange={(e) => onUpdateConfig({ ...config, googleTtsKey: e.target.value })}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white"
            />
          </div>
          <div>
            <span className="text-[#9894b8]">Freesound API Key (ค้นหา SFX):</span>
            <input
              type="password"
              value={config.freesoundKey}
              onChange={(e) => onUpdateConfig({ ...config, freesoundKey: e.target.value })}
              className="mt-1 min-h-[40px] w-full rounded-xl border border-white/15 bg-black/30 px-3 text-white"
            />
          </div>
        </div>
      </div>

      {/* Global Cinematic & HUD Toggles */}
      <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-2.5 text-xs">
        <div className="text-sm font-bold text-white">เลเยอร์ภาพยนต์ (Cinematic & HUD)</div>
        <label className="flex items-center justify-between cursor-pointer py-1">
          <span>เปิดใช้ Cinematic Look Layer (เกรดสี แสงไฟ ขอบมืด)</span>
          <input
            type="checkbox"
            checked={project.settings.cinematicEnabled}
            onChange={(e) =>
              onUpdateProject({
                ...project,
                settings: { ...project.settings, cinematicEnabled: e.target.checked },
              })
            }
            className="h-5 w-5 accent-amber-400"
          />
        </label>
        <label className="flex items-center justify-between cursor-pointer py-1">
          <span>เปิดแสดงแถบ HUD แคปซูลมุมซ้ายบน</span>
          <input
            type="checkbox"
            checked={project.settings.hudEnabled}
            onChange={(e) =>
              onUpdateProject({
                ...project,
                settings: { ...project.settings, hudEnabled: e.target.checked },
              })
            }
            className="h-5 w-5 accent-amber-400"
          />
        </label>
      </div>

      {/* Editable Prompt Templates */}
      <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-3">
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-bold text-white cursor-pointer"
        >
          <span>แม่แบบ Prompt AI (แก้ไขและคืนค่าเริ่มต้นได้)</span>
          <span className="text-xs text-amber-300">{showTemplates ? 'ซ่อน' : 'เปิดดู'}</span>
        </button>
        {showTemplates && (
          <div className="space-y-3 text-xs">
            {(Object.keys(config.promptTemplates) as Array<keyof typeof config.promptTemplates>).map((k) => (
              <div key={k} className="space-y-1">
                <div className="font-bold text-amber-300">{k}</div>
                <textarea
                  rows={4}
                  value={config.promptTemplates[k]}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      promptTemplates: { ...config.promptTemplates, [k]: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-white/15 bg-black/30 p-2.5 text-[11px] text-white"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => onUpdateConfig({ ...config, promptTemplates: DEFAULT_PROMPT_TEMPLATES })}
              className="min-h-[40px] rounded-xl border border-white/15 px-3 text-xs font-bold text-white cursor-pointer"
            >
              คืนค่า Prompt เริ่มต้นทั้งหมด
            </button>
          </div>
        )}
      </div>

      {/* Visual QA Gallery (All 29 BG, 14 Pose x Face, 20 Cards) */}
      <div className="rounded-2xl border border-violet-400/30 bg-[#13141d] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Eye className="h-4 w-4 text-violet-400" />
            <span>Visual QA Gallery (ตรวจชิ้นส่วนภาพทั้งหมด)</span>
          </div>
          <button
            type="button"
            onClick={() => setQaOpen((v) => !v)}
            className="min-h-[40px] rounded-xl bg-violet-500 px-3 text-xs font-bold text-white cursor-pointer"
          >
            {qaOpen ? 'ซ่อน Gallery' : 'เปิด Gallery'}
          </button>
        </div>

        {qaOpen && (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setQaMode('bg')}
                className={`min-h-[38px] rounded-xl px-3 text-xs font-bold cursor-pointer ${
                  qaMode === 'bg' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white'
                }`}
              >
                พื้นหลัง 29 แบบ
              </button>
              <button
                type="button"
                onClick={() => setQaMode('pose')}
                className={`min-h-[38px] rounded-xl px-3 text-xs font-bold cursor-pointer ${
                  qaMode === 'pose' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white'
                }`}
              >
                ท่าทาง 14 × สีหน้า 9
              </button>
              <button
                type="button"
                onClick={() => setQaMode('cards')}
                className={`min-h-[38px] rounded-xl px-3 text-xs font-bold cursor-pointer ${
                  qaMode === 'cards' ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white'
                }`}
              >
                การ์ดข้อมูล 20 แบบ
              </button>
            </div>

            {qaMode === 'bg' && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {BG_PRESETS.map((bg) => (
                  <QaBgTile key={bg} preset={bg} stylePack={project.stylePack} />
                ))}
              </div>
            )}

            {qaMode === 'pose' && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {POSES.map((p, i) => (
                  <QaPoseTile key={p} pose={p} face={FACES[i % FACES.length]} project={project} />
                ))}
              </div>
            )}

            {qaMode === 'cards' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CARD_TYPES.map((ct) => (
                  <QaCardTile key={ct} cardType={ct} stylePack={project.stylePack} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animate Engine Style Plugins (cth9191/animate MIT) */}
      <div className="rounded-2xl border border-amber-400/30 bg-[#13141d] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Palette className="h-4 w-4 text-amber-300" />
            <span>Animate Engine Style Plugins (MIT Attribution: cth9191/animate)</span>
          </div>
          {onOpenOnboarding && (
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white hover:bg-white/10 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              <span>เปิด Onboarding ตั้งค่าเริ่มต้นใหม่</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ANIMATE_STYLE_PLUGINS.map((st) => {
            const active = (project.animateStyle || 'none') === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onUpdateProject({ ...project, animateStyle: st.id })}
                className={`rounded-xl border p-2.5 text-left cursor-pointer ${
                  active
                    ? 'border-amber-400 bg-amber-400/15'
                    : 'border-white/10 bg-[#1b1d29] hover:border-white/25'
                }`}
              >
                <div className="text-xs font-bold text-white">{st.nameTh}</div>
                <div className="mt-0.5 text-[10px] text-[#9894b8]">{st.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Server-Side Encrypted BYOK Vault */}
      <div className="rounded-2xl border border-emerald-400/25 bg-[#13141d] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <KeyRound className="h-4 w-4 text-emerald-300" />
            <span>Encrypted Server BYOK Vault (AES-256-GCM)</span>
          </div>
          {!isSignedIn && onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
            >
              เข้าสู่ระบบเพื่อบันทึกบน Vault
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <select
            value={vaultProvider}
            onChange={(e) => setVaultProvider(e.target.value)}
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
          >
            <option value="openrouter">OpenRouter Hub</option>
            <option value="google_gemini">Google Gemini API</option>
            <option value="openai">OpenAI Platform</option>
            <option value="anthropic">Anthropic Claude</option>
            <option value="openai_compatible">OpenAI-Compatible (Whitelisted)</option>
          </select>
          <input
            type="password"
            value={vaultKey}
            onChange={(e) => setVaultKey(e.target.value)}
            placeholder="วาง API Key เพื่อเข้ารหัสบนเซิร์ฟเวอร์"
            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
          />
          <button
            type="button"
            disabled={!isSignedIn || !vaultKey.trim()}
            onClick={async () => {
              try {
                await platformApi.saveByok({ providerId: vaultProvider, apiKey: vaultKey });
                setVaultKey('');
                setVaultMsg('เข้ารหัสและบันทึก API Key บนเซิร์ฟเวอร์แล้ว');
                await onRefreshPlatform?.();
              } catch (e) {
                setVaultMsg(e instanceof Error ? e.message : String(e));
              }
            }}
            className="min-h-[40px] rounded-xl bg-emerald-400 px-3 text-xs font-extrabold text-slate-950 disabled:opacity-40 cursor-pointer"
          >
            บันทึกเข้า Vault
          </button>
        </div>
        {vaultMsg && <div className="text-xs text-amber-200">{vaultMsg}</div>}
        {byokList.length > 0 && (
          <div className="space-y-1.5">
            {byokList.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs"
              >
                <span>
                  <strong className="text-white">{b.providerName}</strong> •{' '}
                  <span className="font-mono-tabular text-emerald-300">{b.maskedKey}</span>
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const r = await platformApi.testByok({ providerId: b.providerId });
                        setVaultMsg(r.message || 'เชื่อมต่อสำเร็จ');
                      } catch (e) {
                        setVaultMsg(e instanceof Error ? e.message : String(e));
                      }
                    }}
                    className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                  >
                    ทดสอบ Key
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await platformApi.deleteByok(b.providerId);
                      await onRefreshPlatform?.();
                    }}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-2.5 py-1 text-[11px] font-bold text-rose-200 cursor-pointer"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 12-Category Platform Model Registry */}
      {registryModels.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-3">
          <div className="text-sm font-bold text-white">Model Registry (12 Categories)</div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                'ALL',
                'LLM',
                'Vision',
                'Image Generation',
                'Image Editing',
                'Text-to-Speech',
                'Speech-to-Text',
                'Audio Generation',
                'Video Generation',
                'Video Editing',
                'Embedding',
                'Animation',
                'Map Rendering',
              ] as const
            ).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCatFilter(c)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  catFilter === c ? 'bg-amber-400 text-slate-950' : 'bg-white/5 text-white/75'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {registryModels
              .filter((m) => catFilter === 'ALL' || m.category === catFilter)
              .map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white">{m.displayName}</span>
                    <span className="text-[10px] font-bold text-amber-300">{m.category}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#9894b8]">
                    {m.id} • {m.isFreeTierModel ? 'Free / BYOK' : 'Studio Pass'}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
