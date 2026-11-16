import { ArrowLeft, ArrowRight, Check, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import type {
  AnimateStylePluginId,
  MemberTier,
  OnboardingAspect,
  OnboardingAudioPref,
  OnboardingDefaults,
  OnboardingLanguage,
  OnboardingVideoType,
} from '../../types/platform';
import { ANIMATE_STYLE_PLUGINS } from '../../utils/animateStyles';

interface OnboardingWizardProps {
  initial?: Partial<OnboardingDefaults>;
  onComplete: (defaults: OnboardingDefaults) => Promise<void> | void;
  onClose: () => void;
}

const VIDEO_TYPES: Array<{ id: OnboardingVideoType; label: string; desc: string; swatch: string }> = [
  { id: 'ai_cartoon', label: 'AI Cartoon', desc: 'การ์ตูน AI เล่าเรื่องครบฉาก', swatch: '#f59e0b' },
  { id: '2d_animation', label: '2D Animation', desc: 'แอนิเมชัน 2D เวกเตอร์เส้นคม', swatch: '#38bdf8' },
  { id: '3d_animation', label: '3D Animation', desc: 'ตัวละคร 3 มิติพร้อมแสงเงา', swatch: '#818cf8' },
  { id: 'claymation', label: 'Claymation', desc: 'สต็อปโมชันดินปั้นโทนอบอุ่น', swatch: '#fb923c' },
  { id: 'explainer_video', label: 'Explainer Video', desc: 'อินโฟกราฟิกอธิบายความรู้', swatch: '#10b981' },
  { id: 'historical_animation', label: 'Historical Animation', desc: 'เล่าประวัติศาสตร์ย้อนยุค', swatch: '#d97706' },
  { id: 'map_animation', label: 'Map Animation', desc: 'แผนที่เคลื่อนไหวและเส้นทาง', swatch: '#22d3ee' },
  { id: 'geography', label: 'Geography', desc: 'ภูมิศาสตร์ ประเทศ และพรมแดน', swatch: '#14b8a6' },
  { id: 'documentary', label: 'Documentary', desc: 'สารคดีสืบสวนและข้อเท็จจริง', swatch: '#64748b' },
  { id: 'cinematic', label: 'Cinematic', desc: 'มุมกล้องภาพยนตร์แสงสวย', swatch: '#eab308' },
  { id: 'product_ad', label: 'Product Ad', desc: 'โฆษณาสินค้าสั้นกระชับ', swatch: '#ec4899' },
  { id: 'social_shorts', label: 'Social Shorts', desc: 'TikTok / Reels / Shorts ไวรัล', swatch: '#f43f5e' },
  { id: 'whiteboard', label: 'Whiteboard', desc: 'วาดอธิบายบนกระดานขาว', swatch: '#cbd5e1' },
  { id: 'custom_project', label: 'Custom Project', desc: 'กำหนดเองทั้งหมด', swatch: '#a855f7' },
];

export function OnboardingWizard({ initial, onComplete, onClose }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [videoType, setVideoType] = useState<OnboardingVideoType>(initial?.videoType || 'ai_cartoon');
  const [style, setStyle] = useState<AnimateStylePluginId>(initial?.style || 'cut_paper');
  const [durationSec, setDurationSec] = useState<number>(initial?.durationSec || 30);
  const [aspect, setAspect] = useState<OnboardingAspect>(initial?.aspect || '9:16');
  const [language, setLanguage] = useState<OnboardingLanguage>(initial?.language || 'th');
  const [customLanguage, setCustomLanguage] = useState(initial?.customLanguage || '');
  const [audioPref, setAudioPref] = useState<OnboardingAudioPref>(initial?.audioPref || 'ai_voice');
  const [preferredPlan, setPreferredPlan] = useState<MemberTier>(initial?.preferredPlan || 'free');

  const steps = [
    'ประเภทวิดีโอ (Video Type)',
    'สไตล์ภาพ (Visual Style)',
    'ความยาววิดีโอ (Duration)',
    'สัดส่วนภาพ (Aspect Ratio)',
    'ภาษา (Language)',
    'ระบบเสียง (Audio)',
    'แพ็กเกจ (Free BYOK / Studio Pass)',
  ];

  const handleFinish = async () => {
    setSaving(true);
    try {
      await onComplete({
        completed: true,
        videoType,
        style,
        durationSec,
        aspect,
        language,
        customLanguage: language === 'custom' ? customLanguage : undefined,
        audioPref,
        preferredPlan,
        updatedAt: Date.now(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid="onboarding-wizard"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm"
    >
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#12131c] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300" aria-hidden="true" />
            <div>
              <div className="text-sm font-bold text-white">ตั้งค่าเริ่มต้นสตูดิโอ (Step {step + 1}/7)</div>
              <div className="text-xs text-[#9894b8]">{steps[step]}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white cursor-pointer"
            aria-label="ปิดตัวช่วยตั้งค่า"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex gap-1 bg-black/30 px-4 py-2">
          {steps.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-1.5 flex-1 rounded-full transition-colors cursor-pointer ${
                i <= step ? 'bg-amber-400' : 'bg-white/10'
              }`}
              aria-label={`ขั้นตอนที่ ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {VIDEO_TYPES.map((vt) => {
                const selected = videoType === vt.id;
                return (
                  <button
                    key={vt.id}
                    type="button"
                    onClick={() => setVideoType(vt.id)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-amber-400 bg-amber-400/15'
                        : 'border-white/10 bg-[#191a26] hover:border-white/25'
                    }`}
                  >
                    <div
                      className="mb-2 h-2 w-10 rounded-full"
                      style={{ backgroundColor: vt.swatch }}
                    />
                    <div className="text-xs font-bold text-white">{vt.label}</div>
                    <div className="mt-0.5 text-[11px] text-[#9894b8]">{vt.desc}</div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {ANIMATE_STYLE_PLUGINS.filter((s) => s.id !== 'none').map((st) => {
                const selected = style === st.id;
                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setStyle(st.id)}
                    className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all cursor-pointer ${
                      selected
                        ? 'border-amber-400 bg-amber-400/15'
                        : 'border-white/10 bg-[#191a26] hover:border-white/25'
                    }`}
                  >
                    <div
                      className="mb-2 flex h-10 w-full items-center justify-between rounded-lg px-2.5 border border-white/10"
                      style={{ backgroundColor: st.previewBg }}
                    >
                      <span className="text-[11px] font-bold" style={{ color: st.previewAccent }}>
                        {st.name}
                      </span>
                      {st.mitAttributed && (
                        <span className="text-[9px] text-white/55">MIT Engine</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white">{st.nameTh}</div>
                    <div className="mt-0.5 text-[11px] text-[#9894b8]">{st.description}</div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[15, 30, 45, 60].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => setDurationSec(sec)}
                    className={`min-h-[64px] rounded-xl border text-center font-mono-tabular cursor-pointer ${
                      durationSec === sec
                        ? 'border-amber-400 bg-amber-400/20 text-amber-300 font-bold'
                        : 'border-white/10 bg-[#191a26] text-white'
                    }`}
                  >
                    <div className="text-lg font-extrabold">{sec} วินาที</div>
                    <div className="text-[11px] text-[#9894b8]">
                      {sec === 15 ? 'สั้นไวรัล' : sec === 30 ? 'มาตรฐาน Shorts' : sec === 45 ? 'เล่าเรื่องกระชับ' : 'เต็ม 1 นาที'}
                    </div>
                  </button>
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-[#191a26] p-4">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span>กำหนดเวลาเอง (Custom Duration)</span>
                  <span className="font-mono-tabular text-amber-300">{durationSec} วินาที</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={180}
                  step={5}
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="studio-range mt-3 w-full"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(
                [
                  { id: '9:16', label: '9:16 แนวตั้ง', sub: 'TikTok / Reels / Shorts', box: 'w-7 h-12' },
                  { id: '16:9', label: '16:9 แนวนอน', sub: 'YouTube / สารคดี', box: 'w-12 h-7' },
                  { id: '1:1', label: '1:1 จัตุรัส', sub: 'Instagram / Feed', box: 'w-9 h-9' },
                  { id: '4:5', label: '4:5 พอร์ตเทรต', sub: 'Facebook / Ads', box: 'w-8 h-10' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAspect(item.id)}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border p-4 cursor-pointer ${
                    aspect === item.id
                      ? 'border-amber-400 bg-amber-400/15'
                      : 'border-white/10 bg-[#191a26]'
                  }`}
                >
                  <div className={`rounded border-2 border-amber-300/80 ${item.box}`} />
                  <div className="text-xs font-bold text-white">{item.label}</div>
                  <div className="text-[11px] text-[#9894b8]">{item.sub}</div>
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    { id: 'th', label: 'ภาษาไทย (Thai)', desc: 'พากย์ไทยและซับไทยแม่นยำ' },
                    { id: 'en', label: 'English', desc: 'สคริปต์และพากย์อังกฤษ' },
                    { id: 'multilingual', label: 'สองภาษา (TH + EN)', desc: 'ซับไทยพร้อมคำแปลอังกฤษ' },
                    { id: 'custom', label: 'กำหนดภาษาเอง', desc: 'ระบุภาษาเป้าหมายเพิ่มเติม' },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLanguage(l.id)}
                    className={`rounded-xl border p-3.5 text-left cursor-pointer ${
                      language === l.id
                        ? 'border-amber-400 bg-amber-400/15'
                        : 'border-white/10 bg-[#191a26]'
                    }`}
                  >
                    <div className="text-xs font-bold text-white">{l.label}</div>
                    <div className="mt-1 text-[11px] text-[#9894b8]">{l.desc}</div>
                  </button>
                ))}
              </div>
              {language === 'custom' && (
                <input
                  type="text"
                  value={customLanguage}
                  onChange={(e) => setCustomLanguage(e.target.value)}
                  placeholder="เช่น Japanese, Korean, Bahasa..."
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white"
                />
              )}
            </div>
          )}

          {step === 5 && (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {(
                [
                  { id: 'ai_voice', label: 'AI Voiceover', desc: 'ให้ AI สร้างเสียงพากย์อัตโนมัติ (Fish Audio / Gemini / ElevenLabs)' },
                  { id: 'voice_music_sfx', label: 'Voice + Music + SFX', desc: 'เสียงพากย์ + ดนตรีประกอบ + เอฟเฟกต์ Foley ครบชุด' },
                  { id: 'upload_voice', label: 'Upload Your Voice', desc: 'อัปโหลดเสียงพากย์ของคุณเองเพื่อซิงก์ฉาก' },
                  { id: 'music_only', label: 'Background Music Only', desc: 'ใช้เฉพาะดนตรีประกอบและซับไตเติล' },
                  { id: 'no_audio', label: 'No Audio (Silent)', desc: 'วิดีโอเงียบสำหรับนำไปตัดต่อเพิ่ม' },
                ] as const
              ).map((au) => (
                <button
                  key={au.id}
                  type="button"
                  onClick={() => setAudioPref(au.id)}
                  className={`rounded-xl border p-3.5 text-left cursor-pointer ${
                    audioPref === au.id
                      ? 'border-amber-400 bg-amber-400/15'
                      : 'border-white/10 bg-[#191a26]'
                  }`}
                >
                  <div className="text-xs font-bold text-white">{au.label}</div>
                  <div className="mt-1 text-[11px] text-[#9894b8]">{au.desc}</div>
                </button>
              ))}
            </div>
          )}

          {step === 6 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPreferredPlan('free')}
                className={`rounded-2xl border p-4 text-left cursor-pointer ${
                  preferredPlan === 'free'
                    ? 'border-amber-400 bg-amber-400/15'
                    : 'border-white/10 bg-[#191a26]'
                }`}
              >
                <div className="text-sm font-extrabold text-white">Free Member (BYOK)</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-emerald-300">0 บาท / เดือน</div>
                <ul className="mt-2.5 space-y-1 text-xs text-[#c7c3e0]">
                  <li>• ใช้ API Key ของคุณเอง (OpenRouter / Gemini / OpenAI / Anthropic)</li>
                  <li>• สตูดิโอออฟไลน์ IndexedDB + Export MP4 720p</li>
                  <li>• ใช้งาน Workflow & Animate Engine ฟรี</li>
                </ul>
              </button>

              <button
                type="button"
                onClick={() => setPreferredPlan('studio_pass')}
                className={`rounded-2xl border p-4 text-left cursor-pointer ${
                  preferredPlan === 'studio_pass'
                    ? 'border-amber-400 bg-amber-400/15'
                    : 'border-white/10 bg-[#191a26]'
                }`}
              >
                <div className="text-sm font-extrabold text-white">Studio Pass</div>
                <div className="mt-1 font-mono-tabular text-lg font-bold text-amber-300">350 บาท / 30 วัน</div>
                <ul className="mt-2.5 space-y-1 text-xs text-[#c7c3e0]">
                  <li>• เครดิตกลาง 1,500 เครดิต/เดือน พร้อมระบบ Fallback อัตโนมัติ</li>
                  <li>• Export คมชัดสูงสุด 1080p–4K + FFmpeg Server Render QA</li>
                  <li>• ชำระเงินผ่าน PromptPay หรือ Activation Code</li>
                </ul>
              </button>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-white/10 bg-[#0e0f17] px-4 py-3">
          <button
            type="button"
            onClick={() => (step > 0 ? setStep(step - 1) : onClose())}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-white hover:bg-white/10 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{step > 0 ? 'ย้อนกลับ' : 'ข้าม'}</span>
          </button>

          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-amber-400 px-5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 cursor-pointer"
            >
              <span>ถัดไป</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleFinish()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-400 px-5 text-xs font-extrabold text-slate-950 hover:bg-emerald-300 disabled:opacity-60 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              <span>{saving ? 'กำลังบันทึก...' : 'บันทึกค่าเริ่มต้น & เริ่มใช้งาน'}</span>
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
