import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  KeyRound,
  RefreshCw,
  Server,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';
import type {
  AiScriptProvider,
  OpenRouterModelInfo,
  PyThaiModelType,
  StudioSettings,
  TtsProvider,
  VoiceName,
} from '../types/cartoon';
import {
  clearOpenRouterKey,
  fetchOpenRouterModels,
  getSavedCustomTtsKey,
  getSavedOpenRouterKey,
  PYTHAI_SERVER_SNIPPET,
  saveCustomTtsKey,
  saveOpenRouterKey,
  testPyThaiTtsConnection,
  verifyOpenRouterKey,
} from '../utils/aiProviders';
import { VOICE_PRESETS } from '../utils/cartoonData';

interface SettingsViewProps {
  settings: StudioSettings;
  onUpdateSettings: (next: StudioSettings) => void;
  aiHealth: { ok: boolean; aiReady: boolean; models?: { script: string; tts: string } } | null;
  onCheckHealth: () => void;
  onNotify: (msg: string) => void;
}

export function SettingsView({
  settings,
  onUpdateSettings,
  aiHealth,
  onCheckHealth,
  onNotify,
}: SettingsViewProps) {
  const [orKeyInput, setOrKeyInput] = useState(() => getSavedOpenRouterKey());
  const [orKeyStatus, setOrKeyStatus] = useState<string | null>(null);
  const [orModels, setOrModels] = useState<OpenRouterModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [onlyFreeModels, setOnlyFreeModels] = useState(true);

  const [customTtsKeyInput, setCustomTtsKeyInput] = useState(() => getSavedCustomTtsKey());
  const [testingVoice, setTestingVoice] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showPyThaiGuide, setShowPyThaiGuide] = useState(false);

  async function handleSaveAndTestOpenRouter() {
    saveOpenRouterKey(orKeyInput, settings.rememberOpenRouterKey);
    setOrKeyStatus('กำลังตรวจสอบ Key กับ OpenRouter…');
    const res = await verifyOpenRouterKey(orKeyInput);
    if (res.ok) {
      const rem = res.limitRemaining != null ? ` · เครดิตเหลือ $${res.limitRemaining}` : '';
      setOrKeyStatus(`ใช้งานได้: ${res.label}${rem}`);
      onNotify('ตรวจสอบ OpenRouter API Key สำเร็จ');
    } else {
      setOrKeyStatus(`ไม่สำเร็จ: ${res.error}`);
    }
  }

  async function handleLoadOpenRouterModels() {
    setLoadingModels(true);
    try {
      const list = await fetchOpenRouterModels();
      setOrModels(list);
      onNotify(`โหลดรายชื่อโมเดลแล้ว ${list.length} โมเดล`);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'โหลดโมเดลไม่สำเร็จ');
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleTestVoice() {
    setTestingVoice(true);
    setTestResult(null);
    try {
      if (settings.ttsProvider === 'pythai') {
        const res = await testPyThaiTtsConnection(
          settings.pythaiEndpoint,
          settings.pythaiModel,
          settings.pythaiSpeaker
        );
        if (!res.ok || !res.audioBase64) throw new Error(res.detail);
        const audio = new Audio(`data:audio/wav;base64,${res.audioBase64}`);
        await audio.play().catch(() => {});
        setTestResult(res.detail);
        onNotify('ทดสอบเสียง PyThaiTTS สำเร็จ');
      } else if (settings.ttsProvider === 'openai_compatible') {
        saveCustomTtsKey(customTtsKeyInput);
        const resp = await fetch('/api/tts-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: settings.customTtsEndpoint,
            apiKey: customTtsKeyInput,
            model: settings.customTtsModel,
            voice: settings.customTtsVoice,
            text: 'สวัสดีครับ ทดสอบเสียงจากผู้ให้บริการภายนอก',
          }),
        });
        const data = (await resp.json()) as { audioBase64?: string; mimeType?: string; error?: string };
        if (!resp.ok || !data.audioBase64) throw new Error(data.error || `HTTP ${resp.status}`);
        const audio = new Audio(`data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`);
        await audio.play().catch(() => {});
        setTestResult('ทดสอบ Custom TTS สำเร็จ');
      } else {
        const resp = await fetch('/api/generate-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: 'สวัสดีครับ ยินดีต้อนรับเข้าสู่สตูดิโอสร้างการ์ตูนอัตโนมัติ',
            voiceName: settings.voiceName,
            stylePrompt: settings.voiceStyle,
          }),
        });
        const data = (await resp.json()) as { audioBase64?: string; mimeType?: string; error?: string };
        if (!resp.ok || !data.audioBase64) throw new Error(data.error || `HTTP ${resp.status}`);
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        await audio.play().catch(() => {});
        const sizeKb = Math.round((data.audioBase64.length * 0.75) / 1024);
        setTestResult(`ทดสอบเสียง Gemini (${settings.voiceName}) สำเร็จ (${sizeKb} KB)`);
        onNotify('เล่นเสียงตัวอย่างแล้ว');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult(`ทดสอบเสียงไม่สำเร็จ: ${msg}`);
    } finally {
      setTestingVoice(false);
    }
  }

  const displayedModels = onlyFreeModels ? orModels.filter((m) => m.isFree) : orModels.slice(0, 80);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          ตั้งค่า AI, คีย์ OpenRouter และเสียงพากย์ (PyThaiTTS / Gemini)
        </h1>
        <p className="mt-1 text-sm text-[#9894b8]">
          ใช้ Gemini ในตัวได้ทันที หรือเพิ่ม API Key ของคุณเอง (OpenRouter) เมื่อเครดิตหมด รวมถึงเชื่อมต่อเซิร์ฟเวอร์ PyThaiTTS สำหรับพากย์เสียงภาษาไทย
        </p>
      </div>

      {/* Section 1: Script Generation AI Provider (Gemini vs OpenRouter BYOK) */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">1. ผู้ให้บริการ AI เขียนบทและออกแบบฉาก</h2>
            <p className="mt-0.5 text-xs text-[#9894b8]">
              หากเครดิต Gemini หมด สามารถสลับมาใช้ OpenRouter Key ของคุณเองได้ทันที
            </p>
          </div>
          <button
            type="button"
            onClick={onCheckHealth}
            className="inline-flex items-center gap-2 self-start min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 text-xs font-medium text-white hover:border-violet-400/50 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
            <span>เช็กเซิร์ฟเวอร์</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(
            [
              [
                'gemini',
                'Gemini ในตัว (ไม่ต้องใส่ Key)',
                aiHealth?.aiReady ? 'พร้อมใช้งานบนเซิร์ฟเวอร์' : 'ยังไม่มีคีย์ฝั่งเซิร์ฟเวอร์',
              ],
              [
                'openrouter',
                'OpenRouter (ใส่ Key ของคุณเอง)',
                'เลือกโมเดลฟรี (:free) หรือโมเดลอื่นได้เอง',
              ],
            ] as Array<[AiScriptProvider, string, string]>
          ).map(([id, title, sub]) => {
            const active = settings.aiProvider === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, aiProvider: id })}
                className={`min-h-[68px] rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-violet-400 bg-violet-500/15 text-white'
                    : 'border-white/[0.08] bg-[#0a0b10] text-[#d6d3eb] hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-bold">
                  {id === 'gemini' ? (
                    aiHealth?.aiReady ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    )
                  ) : (
                    <KeyRound className="h-4 w-4 text-violet-400" aria-hidden="true" />
                  )}
                  <span>{title}</span>
                </div>
                <div className="mt-1 text-xs text-[#9894b8]">{sub}</div>
              </button>
            );
          })}
        </div>

        {settings.aiProvider === 'openrouter' && (
          <div className="rounded-xl border border-white/10 bg-[#0a0b10] p-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="or-key-input" className="block text-xs font-medium text-[#d6d3eb]">
                OpenRouter API Key (sk-or-v1-…)
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="or-key-input"
                  type="password"
                  value={orKeyInput}
                  onChange={(e) => {
                    setOrKeyInput(e.target.value);
                    saveOpenRouterKey(e.target.value, settings.rememberOpenRouterKey);
                  }}
                  placeholder="วาง OpenRouter API Key ที่นี่"
                  className="flex-1 min-w-[220px] min-h-[42px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleSaveAndTestOpenRouter}
                  className="min-h-[42px] rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                >
                  ทดสอบ Key
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearOpenRouterKey();
                    setOrKeyInput('');
                    setOrKeyStatus('ลบ Key ออกจากเบราว์เซอร์แล้ว');
                  }}
                  aria-label="ลบ OpenRouter Key"
                  className="inline-flex min-h-[42px] items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-xs text-rose-300 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>ลบ Key</span>
                </button>
              </div>
              {orKeyStatus && <p className="text-xs text-emerald-300">{orKeyStatus}</p>}
            </div>

            <div className="flex flex-wrap gap-5 text-xs text-[#d6d3eb]">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.rememberOpenRouterKey}
                  onChange={(e) => {
                    const remember = e.target.checked;
                    onUpdateSettings({ ...settings, rememberOpenRouterKey: remember });
                    saveOpenRouterKey(orKeyInput, remember);
                  }}
                />
                <span>จำ Key บนเครื่องนี้ (ค่าเริ่มต้นเก็บแค่ Session จนปิดแท็บเพื่อความปลอดภัย)</span>
              </label>
            </div>

            <div className="space-y-2 border-t border-white/[0.08] pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label htmlFor="or-model-input" className="text-xs font-medium text-[#d6d3eb]">
                  โมเดล OpenRouter
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-[#9894b8] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyFreeModels}
                      onChange={(e) => setOnlyFreeModels(e.target.checked)}
                    />
                    <span>เฉพาะโมเดลฟรี (:free)</span>
                  </label>
                  <button
                    type="button"
                    disabled={loadingModels}
                    onClick={handleLoadOpenRouterModels}
                    className="rounded-lg border border-white/15 bg-[#13141d] px-2.5 py-1 text-[11px] text-violet-300 hover:text-white cursor-pointer"
                  >
                    {loadingModels ? 'กำลังโหลด…' : 'ดึงรายชื่อโมเดลล่าสุด'}
                  </button>
                </div>
              </div>

              {displayedModels.length > 0 ? (
                <select
                  aria-label="เลือกโมเดลจาก OpenRouter"
                  value={settings.openRouterModel}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, openRouterModel: e.target.value })
                  }
                  className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                >
                  {displayedModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.isFree ? '[FREE] ' : '[PAID] '}
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="or-model-input"
                  type="text"
                  value={settings.openRouterModel}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, openRouterModel: e.target.value })
                  }
                  placeholder="google/gemini-2.0-flash-exp:free"
                  className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                />
              )}
              <p className="text-[11px] text-[#9894b8]">
                แนะนำสำหรับภาษาไทย: <code className="text-violet-300">google/gemini-2.0-flash-exp:free</code> หรือ <code className="text-violet-300">qwen/qwen-2.5-72b-instruct:free</code>
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Voice / TTS Provider (Gemini TTS vs PyThaiTTS vs Custom) */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-white">2. ระบบสังเคราะห์เสียงพากย์ (TTS)</h2>
          <p className="mt-0.5 text-xs text-[#9894b8]">
            รองรับเสียง Gemini ในตัว, PyThaiTTS (โอเพนซอร์สภาษาไทย), และ API เสียงภายนอก หรือจะนำเข้าไฟล์เสียง MP3/WAV เองก็ได้
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(
            [
              ['gemini', 'Gemini TTS (ในตัว)', 'เสียงไทย 5 สไตล์ ใช้งานได้ทันที'],
              ['pythai', 'PyThaiTTS (PyThaiNLP)', 'เชื่อมโมเดล Khonomtan / Lunar / MMS'],
              ['openai_compatible', 'Custom / OpenAI TTS', 'ใช้ Key API ภายนอก (/audio/speech)'],
            ] as Array<[TtsProvider, string, string]>
          ).map(([id, title, sub]) => {
            const active = settings.ttsProvider === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, ttsProvider: id })}
                className={`min-h-[68px] rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-violet-400 bg-violet-500/15 text-white'
                    : 'border-white/[0.08] bg-[#0a0b10] text-[#d6d3eb] hover:border-white/20'
                }`}
              >
                <div className="text-xs sm:text-sm font-bold">{title}</div>
                <div className="mt-1 text-[11px] text-[#9894b8]">{sub}</div>
              </button>
            );
          })}
        </div>

        {settings.ttsProvider === 'gemini' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {VOICE_PRESETS.map((v) => {
                const active = settings.voiceName === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, voiceName: v.id as VoiceName })}
                    className={`min-h-[64px] rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                      active
                        ? 'border-violet-400 bg-violet-500/15 text-white'
                        : 'border-white/[0.08] bg-[#0a0b10] text-[#d6d3eb] hover:border-white/20'
                    }`}
                  >
                    <div className="text-sm font-bold">{v.name}</div>
                    <div className="mt-0.5 text-xs text-[#9894b8]">{v.desc}</div>
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor="voice-style-input" className="block text-xs font-medium text-[#d6d3eb] mb-1.5">
                คำสั่งกำกับน้ำเสียง (Voice Style Prompt)
              </label>
              <input
                id="voice-style-input"
                type="text"
                value={settings.voiceStyle}
                onChange={(e) => onUpdateSettings({ ...settings, voiceStyle: e.target.value })}
                className="w-full min-h-[42px] rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 text-xs text-white"
              />
            </div>
          </div>
        )}

        {settings.ttsProvider === 'pythai' && (
          <div className="rounded-xl border border-white/10 bg-[#0a0b10] p-4 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Server className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-xs font-bold text-white">การเชื่อมต่อ PyThaiTTS (github.com/PyThaiNLP/PyThaiTTS)</div>
                  <p className="mt-0.5 text-[11px] text-[#9894b8]">
                    ระบุ URL ของ PyThaiTTS HTTP Server (เช่นรันในเครื่องที่ http://127.0.0.1:8000 หรือผ่าน Tunnel)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPyThaiGuide((v) => !v)}
                className="shrink-0 rounded-lg border border-white/15 bg-[#13141d] px-2.5 py-1 text-[11px] text-violet-300 cursor-pointer"
              >
                {showPyThaiGuide ? 'ซ่อนวิธีรันเซิร์ฟเวอร์' : 'ดูโค้ดรันเซิร์ฟเวอร์'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="pythai-endpoint" className="block text-[11px] text-[#9894b8] mb-1">
                  Endpoint URL (POST /tts คืนไฟล์ WAV)
                </label>
                <input
                  id="pythai-endpoint"
                  type="url"
                  value={settings.pythaiEndpoint}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, pythaiEndpoint: e.target.value })
                  }
                  placeholder="http://127.0.0.1:8000"
                  className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                />
              </div>

              <div>
                <label htmlFor="pythai-model" className="block text-[11px] text-[#9894b8] mb-1">
                  โมเดล PyThaiTTS
                </label>
                <select
                  id="pythai-model"
                  value={settings.pythaiModel}
                  onChange={(e) =>
                    onUpdateSettings({
                      ...settings,
                      pythaiModel: e.target.value as PyThaiModelType,
                    })
                  }
                  className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
                >
                  <option value="khanomtan">KhanomTan TTS</option>
                  <option value="lunar">Lunar TTS</option>
                  <option value="mms">Facebook MMS Thai</option>
                  <option value="edge_bridge">Edge-TTS Bridge</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pythai-speaker" className="block text-[11px] text-[#9894b8] mb-1">
                รหัสเสียง / Speaker ID (เช่น default, Linda, Kor)
              </label>
              <input
                id="pythai-speaker"
                type="text"
                value={settings.pythaiSpeaker}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, pythaiSpeaker: e.target.value })
                }
                className="w-full min-h-[40px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
              />
            </div>

            {showPyThaiGuide && (
              <div className="space-y-2 rounded-xl border border-white/10 bg-[#13141d] p-3">
                <div className="flex items-center justify-between text-[11px] text-[#d6d3eb]">
                  <span>ตัวอย่างสคริปต์ Python FastAPI สำหรับ PyThaiTTS:</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(PYTHAI_SERVER_SNIPPET);
                      onNotify('คัดลอกโค้ดเซิร์ฟเวอร์ PyThaiTTS แล้ว');
                    }}
                    className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-0.5 text-[11px] text-violet-300 cursor-pointer"
                  >
                    <Copy className="h-3 w-3" aria-hidden="true" />
                    <span>คัดลอก</span>
                  </button>
                </div>
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-[#cbd5e1] font-mono">
                  {PYTHAI_SERVER_SNIPPET}
                </pre>
              </div>
            )}
          </div>
        )}

        {settings.ttsProvider === 'openai_compatible' && (
          <div className="rounded-xl border border-white/10 bg-[#0a0b10] p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="url"
                aria-label="Custom TTS Endpoint"
                value={settings.customTtsEndpoint}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, customTtsEndpoint: e.target.value })
                }
                placeholder="https://api.openai.com/v1/audio/speech"
                className="min-h-[40px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
              />
              <input
                type="password"
                aria-label="Custom TTS API Key"
                value={customTtsKeyInput}
                onChange={(e) => {
                  setCustomTtsKeyInput(e.target.value);
                  saveCustomTtsKey(e.target.value);
                }}
                placeholder="API Key ของบริการ TTS"
                className="min-h-[40px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
              />
              <input
                type="text"
                aria-label="Custom TTS Model"
                value={settings.customTtsModel}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, customTtsModel: e.target.value })
                }
                placeholder="tts-1"
                className="min-h-[40px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
              />
              <input
                type="text"
                aria-label="Custom TTS Voice"
                value={settings.customTtsVoice}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, customTtsVoice: e.target.value })
                }
                placeholder="alloy"
                className="min-h-[40px] rounded-xl border border-white/15 bg-[#13141d] px-3 text-xs text-white"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={testingVoice}
            onClick={handleTestVoice}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            <span>{testingVoice ? 'กำลังทดสอบเสียง…' : 'ทดสอบเสียงพากย์'}</span>
          </button>
          {testResult && <span className="text-xs sm:text-sm text-[#d6d3eb]">{testResult}</span>}
        </div>
      </section>

      {/* Section 3: Audio Mix, Subtitle & Export Defaults */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
        <h2 className="text-base font-semibold text-white">3. เสียงประกอบ ดนตรี และการส่งออก</h2>

        <label className="inline-flex items-center gap-2.5 text-sm text-[#d6d3eb] cursor-pointer">
          <input
            type="checkbox"
            checked={settings.enableBgmAndSfx}
            onChange={(e) =>
              onUpdateSettings({ ...settings, enableBgmAndSfx: e.target.checked })
            }
          />
          <span>เปิดเพลงบรรเลงสังเคราะห์และ SFX อัตโนมัติ (ลดเสียงเพลงอัตโนมัติระหว่างพูด)</span>
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="default-res-select" className="block text-sm font-medium text-[#d6d3eb] mb-1.5">
              ความละเอียดส่งออกเริ่มต้น
            </label>
            <select
              id="default-res-select"
              value={settings.defaultRes}
              onChange={(e) =>
                onUpdateSettings({ ...settings, defaultRes: e.target.value as '720' | '1080' })
              }
              className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
            >
              <option value="720">720p (720×1280 — เร็ว ประหยัดแรม)</option>
              <option value="1080">1080p (1080×1920 — คมชัดสูง)</option>
            </select>
          </div>

          <div>
            <label htmlFor="subtitle-scale-select" className="block text-sm font-medium text-[#d6d3eb] mb-1.5">
              ขนาดตัวอักษรซับไตเติล
            </label>
            <select
              id="subtitle-scale-select"
              value={settings.subtitleScale}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  subtitleScale: e.target.value as 'normal' | 'large',
                })
              }
              className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
            >
              <option value="normal">ขนาดมาตรฐาน (สมดุลกับฉาก)</option>
              <option value="large">ขนาดใหญ่พิเศษ (อ่านชัดบนจอมือถือ)</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
