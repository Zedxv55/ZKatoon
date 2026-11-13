import { CheckCircle2, AlertTriangle, Volume2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { StudioSettings, VoiceName } from '../types/cartoon';
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
  const [testingVoice, setTestingVoice] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleTestVoice() {
    setTestingVoice(true);
    setTestResult(null);
    try {
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
      if (!resp.ok || !data.audioBase64) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
      await audio.play().catch(() => {});
      const sizeKb = Math.round((data.audioBase64.length * 0.75) / 1024);
      setTestResult(`ทดสอบเสียง ${settings.voiceName} สำเร็จ (${sizeKb} KB)`);
      onNotify('เล่นเสียงตัวอย่างแล้ว');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult(`ทดสอบเสียงไม่สำเร็จ: ${msg}`);
    } finally {
      setTestingVoice(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          ตั้งค่าเสียงพากย์และสตูดิโอ
        </h1>
        <p className="mt-1 text-sm text-[#9894b8]">
          ระบบ AI ทำงานผ่านเซิร์ฟเวอร์โดยอัตโนมัติ คุณสามารถปรับแต่งโทนเสียงพากย์ ความละเอียดวิดีโอ และขนาดซับไตเติลได้ที่นี่
        </p>
      </div>

      {/* Server AI Connection Status */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            {aiHealth?.aiReady ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <div>
              <h2 className="text-base font-semibold text-white">สถานะการเชื่อมต่อบริการ AI</h2>
              <p className="mt-1 text-sm text-[#9894b8]">
                {aiHealth === null
                  ? 'กำลังตรวจสอบเซิร์ฟเวอร์…'
                  : aiHealth.aiReady
                    ? `พร้อมใช้งาน · เขียนบท: ${aiHealth.models?.script} · เสียงพากย์: ${aiHealth.models?.tts}`
                    : 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Settings > Secrets ของโปรเจกต์ (ยังใช้โหมดตัวอย่างและนำเข้าเสียงเองได้)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCheckHealth}
            className="inline-flex items-center gap-2 self-start min-h-[44px] whitespace-nowrap rounded-xl border border-white/10 bg-[#1b1d29] px-4 py-2 text-xs font-medium text-white hover:border-violet-400/50 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 text-violet-400" aria-hidden="true" />
            <span>ตรวจสอบสถานะ</span>
          </button>
        </div>
      </section>

      {/* Voice Settings */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
        <h2 className="text-base font-semibold text-white">เสียงพากย์เริ่มต้น (Gemini TTS)</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {VOICE_PRESETS.map((v) => {
            const active = settings.voiceName === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onUpdateSettings({ ...settings, voiceName: v.id as VoiceName })}
                className={`min-h-[68px] rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                  active
                    ? 'border-violet-400 bg-violet-500/15 text-white'
                    : 'border-white/[0.08] bg-[#0a0b10] text-[#d6d3eb] hover:border-white/20'
                }`}
              >
                <div className="text-sm font-bold">{v.name}</div>
                <div className="mt-1 text-xs text-[#9894b8]">{v.desc}</div>
              </button>
            );
          })}
        </div>

        <div>
          <label htmlFor="voice-style-input" className="block text-sm font-medium text-[#d6d3eb] mb-1.5">
            คำสั่งกำกับน้ำเสียง (Voice Style Prompt)
          </label>
          <input
            id="voice-style-input"
            type="text"
            value={settings.voiceStyle}
            onChange={(e) => onUpdateSettings({ ...settings, voiceStyle: e.target.value })}
            placeholder="เช่น พูดช้าลงเล็กน้อย น้ำเสียงลึกลับน่าค้นหา"
            className="w-full min-h-[44px] rounded-xl border border-white/15 bg-[#0a0b10] px-3.5 py-2 text-sm text-white focus:border-violet-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={testingVoice}
            onClick={handleTestVoice}
            className="inline-flex items-center gap-2 min-h-[44px] rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60 transition-colors cursor-pointer"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            <span>{testingVoice ? 'กำลังสังเคราะห์เสียง…' : 'ทดสอบเสียงพากย์'}</span>
          </button>
          {testResult && <span className="text-sm text-[#d6d3eb]">{testResult}</span>}
        </div>
      </section>

      {/* Export & Subtitle Preferences */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-5">
        <h2 className="text-base font-semibold text-white">การตั้งค่าการแสดงผลและส่งออก</h2>
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
              <option value="720">720p (720×1280 — เรนเดอร์เร็ว ประหยัดแรม)</option>
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
