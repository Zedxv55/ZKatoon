import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type {
  AiScriptProvider,
  OpenRouterModelInfo,
  StudioSettings,
  TtsProviderId,
  WorkspaceSecrets,
} from '../types/cartoon';
import {
  fetchOpenRouterModels,
  verifyGeminiKey,
  verifyOpenAiKey,
  verifyOpenRouterKey,
} from '../utils/aiProviders';
import { getTtsAdapter, TTS_PROVIDERS_META } from '../utils/ttsAdapters';

interface SettingsViewProps {
  workspaceName: string;
  hasPinLock: boolean;
  isLocked: boolean;
  settings: StudioSettings;
  secrets: WorkspaceSecrets;
  onUpdateSettings: (next: StudioSettings) => void;
  onSaveSecrets: (next: WorkspaceSecrets) => Promise<void>;
  onGoStorage: () => void;
  onNotify: (msg: string) => void;
}

const SCRIPT_PROVIDERS: Array<{ id: AiScriptProvider; label: string; desc: string }> = [
  { id: 'openrouter', label: 'OpenRouter (BYOK)', desc: 'รองรับโมเดลฟรี (:free) และโมเดลชั้นนำผ่านคีย์ของคุณ' },
  { id: 'openai', label: 'OpenAI API (BYOK)', desc: 'เรียก api.openai.com โดยตรงด้วยคีย์ของคุณ' },
  { id: 'gemini_byok', label: 'Google Gemini API (BYOK)', desc: 'เรียก generativelanguage.googleapis.com ด้วยคีย์ของคุณ' },
  { id: 'server_gemini', label: 'Dev Server Gemini (Local Only)', desc: 'ใช้เฉพาะเมื่อรัน npm run dev ที่มี GEMINI_API_KEY ในเครื่อง' },
];

export function SettingsView({
  workspaceName,
  hasPinLock,
  isLocked,
  settings,
  secrets,
  onUpdateSettings,
  onSaveSecrets,
  onGoStorage,
  onNotify,
}: SettingsViewProps) {
  const [draftSecrets, setDraftSecrets] = useState<WorkspaceSecrets>(() => ({ ...secrets }));
  const [orStatus, setOrStatus] = useState<string | null>(null);
  const [orModels, setOrModels] = useState<OpenRouterModelInfo[]>([]);
  const [loadingOrModels, setLoadingOrModels] = useState(false);
  const [onlyFreeModels, setOnlyFreeModels] = useState(true);
  const [scriptTestMsg, setScriptTestMsg] = useState<string | null>(null);
  const [ttsTestMsg, setTtsTestMsg] = useState<string | null>(null);
  const [testingTts, setTestingTts] = useState(false);
  const [ttsTestAudioUrl, setTtsTestAudioUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (ttsTestAudioUrl) URL.revokeObjectURL(ttsTestAudioUrl);
  }, [ttsTestAudioUrl]);

  async function handleSaveAllKeys() {
    if (isLocked) {
      onNotify('กรุณาปลดล็อก Workspace ในหน้า "คลังเครื่อง" ก่อนบันทึก API Key');
      return;
    }
    await onSaveSecrets(draftSecrets);
    onNotify(`บันทึก API Key ลง Workspace "${workspaceName}" แล้ว`);
  }

  async function handleTestOpenRouter() {
    setOrStatus('กำลังตรวจสอบ OpenRouter Key…');
    const res = await verifyOpenRouterKey(draftSecrets.openRouterKey || '');
    if (res.ok) {
      const rem = res.limitRemaining != null ? ` (คงเหลือ $${res.limitRemaining})` : '';
      setOrStatus(`ใช้งานได้: ${res.label}${rem}`);
      onNotify('OpenRouter Key ใช้งานได้');
    } else {
      setOrStatus(`ผิดพลาด: ${res.error}`);
    }
  }

  async function handleLoadOpenRouterModels() {
    setLoadingOrModels(true);
    try {
      const list = await fetchOpenRouterModels();
      setOrModels(list);
      onNotify(`โหลดรายชื่อโมเดลแล้ว ${list.length} รายการ`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'โหลดรายชื่อโมเดลไม่สำเร็จ');
    } finally {
      setLoadingOrModels(false);
    }
  }

  async function handleTestTtsProvider() {
    setTestingTts(true);
    setTtsTestMsg('กำลังโหลด Voice และสร้างเสียงทดสอบภาษาไทยจริง…');
    try {
      const adapter = getTtsAdapter(settings.ttsProvider);
      const voices = await adapter.fetchVoices(settings, draftSecrets);
      if (!voices.length) throw new Error('ผู้ให้บริการไม่ส่งรายการ Voice กลับมา');
      const selectedVoice = voices.find((voice) => voice.id === settings.ttsVoiceId) || voices[0];
      const sample = await adapter.synthesize({
        text: 'สวัสดีครับ นี่คือเสียงทดสอบภาษาไทยของ ZKatoon ขอให้คุณสนุกกับการสร้างการ์ตูน',
        voiceId: selectedVoice.id,
        voiceName: selectedVoice.name,
        emotion: 'neutral',
        speed: 1,
        styleInstruction: 'พูดภาษาไทยให้เป็นธรรมชาติ ชัดเจน และเว้นจังหวะอย่างเหมาะสม',
        dictionary: [],
        settings,
        secrets: draftSecrets,
      });
      if (!sample.audioBlob.size || !Number.isFinite(sample.durationSec) || sample.durationSec <= 0) {
        throw new Error('ผู้ให้บริการส่งไฟล์เสียงว่างหรือความยาวไม่ถูกต้อง');
      }
      const nextUrl = URL.createObjectURL(sample.audioBlob);
      setTtsTestAudioUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return nextUrl;
      });
      setTtsTestMsg('สร้างเสียงทดสอบจริงสำเร็จ — ' + selectedVoice.name + ' · ' + sample.durationSec.toFixed(2) + ' วินาที · ' + Math.round(sample.audioBlob.size / 1024) + ' KB');
      onNotify('สร้างเสียงทดสอบจาก ' + TTS_PROVIDERS_META[settings.ttsProvider].name + ' สำเร็จ');
    } catch (err) {
      setTtsTestAudioUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return null;
      });
      setTtsTestMsg('ทดสอบเสียงไม่สำเร็จ: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setTestingTts(false);
    }
  }

  const activeTtsMeta = TTS_PROVIDERS_META[settings.ttsProvider];
  const filteredModels = orModels.filter((m) =>
    settings.allowPaidOpenRouter || !onlyFreeModels ? true : m.isFree
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            ตั้งค่า API Key ประจำ Workspace ({workspaceName})
          </h1>
          <p className="mt-1 text-sm text-[#9894b8]">
            คีย์ของคุณถูกเก็บไว้เฉพาะในเบราว์เซอร์เครื่องนี้เท่านั้น {hasPinLock ? '(เข้ารหัส AES-GCM แล้ว)' : '(แนะนำให้ตั้งรหัส PIN ล็อกในหน้าคลังเครื่อง)'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleSaveAllKeys}
          className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500 cursor-pointer"
        >
          <KeyRound className="h-4 w-4" aria-hidden="true" />
          <span>บันทึกคีย์ทั้งหมดลง Workspace</span>
        </button>
      </div>

      {isLocked && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-200">
            <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Workspace นี้ถูกล็อกด้วย PIN อยู่ กรุณาปลดล็อกก่อนแก้ไขหรือใช้งาน API Key</span>
          </div>
          <button
            type="button"
            onClick={onGoStorage}
            className="min-h-[38px] rounded-lg bg-amber-500 px-3.5 text-xs font-bold text-slate-950 cursor-pointer"
          >
            ไปปลดล็อก
          </button>
        </div>
      )}

      {/* Section 1: Script AI Director BYOK */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
        <div className="flex items-center gap-2 text-white font-bold text-lg">
          <Sparkles className="h-5 w-5 text-violet-400" aria-hidden="true" />
          <h2>1. ผู้ให้บริการเขียนบทและกำกับฉาก (AI Script Director)</h2>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {SCRIPT_PROVIDERS.map((p) => {
            const active = settings.aiProvider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, aiProvider: p.id })}
                className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-violet-500 bg-violet-500/15 text-white'
                    : 'border-white/10 bg-[#1b1d29] text-[#d6d3eb] hover:border-white/25'
                }`}
              >
                <div className="text-sm font-semibold">{p.label}</div>
                <div className="mt-1 text-[11px] text-[#9894b8] leading-snug">{p.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2 rounded-xl border border-white/10 bg-[#1b1d29] p-4">
            <label className="block text-xs font-semibold text-white">OpenRouter API Key</label>
            <input
              type="password"
              value={draftSecrets.openRouterKey || ''}
              onChange={(e) => setDraftSecrets({ ...draftSecrets, openRouterKey: e.target.value })}
              placeholder="sk-or-v1-..."
              className="w-full min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleTestOpenRouter}
                className="min-h-[34px] rounded-lg border border-white/10 bg-[#13141d] px-3 text-xs text-white hover:border-violet-400/50 cursor-pointer"
              >
                ทดสอบ Key
              </button>
              <button
                type="button"
                onClick={handleLoadOpenRouterModels}
                disabled={loadingOrModels}
                className="inline-flex items-center gap-1 min-h-[34px] rounded-lg border border-white/10 bg-[#13141d] px-3 text-xs text-white hover:border-violet-400/50 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${loadingOrModels ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>โหลดโมเดล</span>
              </button>
            </div>
            {orStatus && <p className="text-[11px] text-violet-300">{orStatus}</p>}
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-[#1b1d29] p-4">
            <label className="block text-xs font-semibold text-white">OpenAI API Key</label>
            <input
              type="password"
              value={draftSecrets.openAiKey || ''}
              onChange={(e) => setDraftSecrets({ ...draftSecrets, openAiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            />
            <input
              type="text"
              value={settings.openAiScriptModel}
              onChange={(e) => onUpdateSettings({ ...settings, openAiScriptModel: e.target.value })}
              placeholder="gpt-4o-mini"
              className="w-full min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-[#d6d3eb]"
            />
            <button
              type="button"
              onClick={async () => {
                const res = await verifyOpenAiKey(draftSecrets.openAiKey || '');
                setScriptTestMsg(res.ok ? 'OpenAI Key ใช้งานได้' : `OpenAI: ${res.error}`);
              }}
              className="min-h-[34px] rounded-lg border border-white/10 bg-[#13141d] px-3 text-xs text-white cursor-pointer"
            >
              ทดสอบ OpenAI Key
            </button>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-[#1b1d29] p-4">
            <label className="block text-xs font-semibold text-white">Google Gemini API Key (BYOK)</label>
            <input
              type="password"
              value={draftSecrets.geminiKey || ''}
              onChange={(e) => setDraftSecrets({ ...draftSecrets, geminiKey: e.target.value })}
              placeholder="AIza..."
              className="w-full min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            />
            <input
              type="text"
              value={settings.geminiByokModel}
              onChange={(e) => onUpdateSettings({ ...settings, geminiByokModel: e.target.value })}
              placeholder="gemini-2.5-flash"
              className="w-full min-h-[36px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-[#d6d3eb]"
            />
            <button
              type="button"
              onClick={async () => {
                const res = await verifyGeminiKey(draftSecrets.geminiKey || '');
                setScriptTestMsg(res.ok ? 'Gemini BYOK ใช้งานได้' : `Gemini: ${res.error}`);
              }}
              className="min-h-[34px] rounded-lg border border-white/10 bg-[#13141d] px-3 text-xs text-white cursor-pointer"
            >
              ทดสอบ Gemini Key
            </button>
          </div>
        </div>

        {orModels.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-[#1b1d29] p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">เลือกโมเดล OpenRouter สำหรับเขียนบท</span>
              <label className="inline-flex items-center gap-1.5 text-xs text-[#d6d3eb]">
                <input
                  type="checkbox"
                  checked={onlyFreeModels}
                  onChange={(e) => setOnlyFreeModels(e.target.checked)}
                />
                <span>แสดงเฉพาะโมเดลฟรี (:free)</span>
              </label>
            </div>
            <select
              value={settings.openRouterModel}
              onChange={(e) => onUpdateSettings({ ...settings, openRouterModel: e.target.value })}
              className="w-full min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            >
              {filteredModels.slice(0, 120).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.isFree ? '[FREE] ' : ''}
                  {m.id}
                </option>
              ))}
            </select>
          </div>
        )}

        {scriptTestMsg && <p className="text-xs font-medium text-emerald-300">{scriptTestMsg}</p>}
      </section>

      {/* Section 2: Multi-Provider Thai Voice TTS (6 Adapters) */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-lg">
            <Volume2 className="h-5 w-5 text-violet-400" aria-hidden="true" />
            <h2>2. ผู้ให้บริการพากย์เสียงไทย (6 Separate TTS Adapters)</h2>
          </div>
          <button
            type="button"
            onClick={handleTestTtsProvider}
            disabled={testingTts}
            className="min-h-[38px] rounded-xl border border-violet-500/40 bg-violet-500/15 px-3.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/25 cursor-pointer"
          >
            {testingTts ? 'กำลังตรวจสอบ…' : 'ทดสอบเชื่อมต่อ & โหลดรายชื่อเสียง'}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(TTS_PROVIDERS_META) as TtsProviderId[]).map((pid) => {
            const meta = TTS_PROVIDERS_META[pid];
            const active = settings.ttsProvider === pid;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, ttsProvider: pid })}
                className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-violet-500 bg-violet-500/15 text-white'
                    : 'border-white/10 bg-[#1b1d29] text-[#d6d3eb] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{meta.name}</span>
                  {meta.supportsPhonemeTiming && (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                      Lip-Sync Timestamps
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[#9894b8] leading-snug">{meta.shortDesc}</p>
              </button>
            );
          })}
        </div>

        {/* Honest CORS & Auth Disclosure */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
          <div>
            <strong>หมายเหตุการเชื่อมต่อ {activeTtsMeta.name}:</strong> {activeTtsMeta.corsNote} — ระบบจะไม่นำ API Key ของผู้ให้บริการหนึ่งไปใช้แทนอีกผู้ให้บริการหนึ่ง
          </div>
        </div>

        {/* Provider-specific credential inputs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-white/10 bg-[#1b1d29] p-4">
            <label className="block text-xs font-semibold text-white">ElevenLabs API Key</label>
            <input
              type="password"
              value={draftSecrets.elevenLabsKey || ''}
              onChange={(e) => setDraftSecrets({ ...draftSecrets, elevenLabsKey: e.target.value })}
              placeholder="xi-api-key (elevenlabs)"
              className="w-full min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-[#1b1d29] p-4">
            <label className="block text-xs font-semibold text-white">
              Microsoft Azure Speech Key & Region
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={draftSecrets.azureSpeechKey || ''}
                onChange={(e) => setDraftSecrets({ ...draftSecrets, azureSpeechKey: e.target.value })}
                placeholder="Ocp-Apim-Subscription-Key"
                className="flex-1 min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              />
              <input
                type="text"
                value={settings.azureRegion}
                onChange={(e) => onUpdateSettings({ ...settings, azureRegion: e.target.value })}
                placeholder="southeastasia"
                className="w-36 min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-[#1b1d29] p-4">
            <label className="block text-xs font-semibold text-white">
              Google Cloud Text-to-Speech API Key
            </label>
            <input
              type="password"
              value={draftSecrets.googleCloudTtsKey || ''}
              onChange={(e) =>
                setDraftSecrets({ ...draftSecrets, googleCloudTtsKey: e.target.value })
              }
              placeholder="Google Cloud API Key (เปิด Cloud Text-to-Speech API)"
              className="w-full min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-[#1b1d29] p-4">
            <label className="block text-xs font-semibold text-white">
              OpenAI TTS Model & OpenRouter Audio Model
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={settings.openAiTtsModel}
                onChange={(e) => onUpdateSettings({ ...settings, openAiTtsModel: e.target.value })}
                placeholder="gpt-4o-mini-tts"
                className="min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              />
              <input
                type="text"
                value={settings.openRouterTtsModel}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, openRouterTtsModel: e.target.value })
                }
                placeholder="openai/gpt-audio-mini"
                className="min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              />
            </div>
          </div>
        </div>

        {/* Custom HTTP TTS Config */}
        <div className="rounded-xl border border-white/10 bg-[#1b1d29] p-4 space-y-3">
          <div className="text-xs font-bold text-white">Custom HTTP TTS Provider Config</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="url"
              value={settings.customTtsEndpoint}
              onChange={(e) => onUpdateSettings({ ...settings, customTtsEndpoint: e.target.value })}
              placeholder="https://your-tts-endpoint.example/synthesize"
              className="min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            />
            <input
              type="password"
              value={draftSecrets.customTtsKey || ''}
              onChange={(e) => setDraftSecrets({ ...draftSecrets, customTtsKey: e.target.value })}
              placeholder="Custom TTS Bearer/API Token"
              className="min-h-[40px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.customTtsHeaderName}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, customTtsHeaderName: e.target.value })
                }
                placeholder="Header Name (Authorization)"
                className="flex-1 min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              />
              <input
                type="text"
                value={settings.customTtsHeaderPrefix}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, customTtsHeaderPrefix: e.target.value })
                }
                placeholder="Prefix (Bearer )"
                className="w-28 min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              />
            </div>
            <input
              type="text"
              value={settings.customTtsBodyTemplate}
              onChange={(e) =>
                onUpdateSettings({ ...settings, customTtsBodyTemplate: e.target.value })
              }
              placeholder='{"text":"{{text}}","voice":"{{voice}}","speed":{{speed}}}'
              className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 font-mono-tabular text-[11px] text-white"
            />
          </div>
        </div>

        {ttsTestMsg && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-violet-200">
              {ttsTestMsg.includes('สร้างเสียงทดสอบจริงสำเร็จ') ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" aria-hidden="true" />
              )}
              <span>{ttsTestMsg}</span>
            </div>
            {ttsTestAudioUrl && <audio controls preload="metadata" src={ttsTestAudioUrl} className="w-full" />}
          </div>
        )}
      </section>
    </div>
  );
}
