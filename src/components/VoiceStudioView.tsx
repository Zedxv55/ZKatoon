import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Download,
  Layers,
  Mic2,
  Play,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Volume2,
} from 'lucide-react';
import type {
  CartoonProject,
  PronunciationEntry,
  SceneAudioRecord,
  StudioSettings,
  TtsProviderId,
  VoiceAgeGroup,
  VoiceEmotion,
  VoiceGender,
  VoiceOption,
  VoicePitchTone,
  VoicePreset,
  VoiceRoleType,
  VoiceStyleTone,
  WorkspaceSecrets,
} from '../types/cartoon';
import { prepareThaiSpeechText } from '../utils/thaiSpeech';
import { getTtsAdapter, TTS_PROVIDERS_META } from '../utils/ttsAdapters';
import { triggerDownload } from '../utils/storage';
import { generateUuid } from '../utils/workspaceCrypto';

interface VoiceStudioViewProps {
  workspaceId: string;
  project: CartoonProject | null;
  settings: StudioSettings;
  secrets: WorkspaceSecrets;
  voicePresets: VoicePreset[];
  dictionary: PronunciationEntry[];
  sceneAudioMap: Record<string, SceneAudioRecord>;
  onUpdateSettings: (next: StudioSettings) => void;
  onUpdateProject: (next: CartoonProject) => void;
  onSaveVoicePreset: (preset: VoicePreset) => Promise<void>;
  onDeleteVoicePreset: (id: string) => Promise<void>;
  onSaveDictionary: (entries: PronunciationEntry[]) => Promise<void>;
  onSaveSceneAudio: (rec: SceneAudioRecord) => Promise<void>;
  onMergeAllAudioToStudio: () => Promise<void>;
  onOpenDemo3D: () => void;
  onGoSettings: () => void;
  onNotify: (msg: string) => void;
}

const EMOTIONS: Array<{ id: VoiceEmotion; label: string }> = [
  { id: 'neutral', label: 'ปกติ (Neutral)' },
  { id: 'warm', label: 'อบอุ่นเป็นกันเอง' },
  { id: 'energetic', label: 'มีพลัง (Energetic)' },
  { id: 'excited', label: 'ตื่นเต้น (Excited)' },
  { id: 'sad', label: 'เศร้า / ซึ้ง' },
  { id: 'whisper', label: 'กระซิบ (Whisper)' },
  { id: 'tense', label: 'จริงจัง / ลุ้นระทึก' },
];

export function VoiceStudioView({
  workspaceId,
  project,
  settings,
  secrets,
  voicePresets,
  dictionary,
  sceneAudioMap,
  onUpdateSettings,
  onUpdateProject,
  onSaveVoicePreset,
  onDeleteVoicePreset,
  onSaveDictionary,
  onSaveSceneAudio,
  onMergeAllAudioToStudio,
  onOpenDemo3D,
  onGoSettings,
  onNotify,
}: VoiceStudioViewProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceLoadErr, setVoiceLoadErr] = useState<string | null>(null);

  // Voice Filters & Metadata Tags
  const [filterGender, setFilterGender] = useState<'all' | VoiceGender>('all');
  const [ageGroup, setAgeGroup] = useState<VoiceAgeGroup>('adult');
  const [pitchTone, setPitchTone] = useState<VoicePitchTone>('medium');
  const [roleType, setRoleType] = useState<VoiceRoleType>('storyteller');
  const [styleTone, setStyleTone] = useState<VoiceStyleTone>('casual');
  const [weight, setWeight] = useState(1.0);
  const [emphasis, setEmphasis] = useState<'low' | 'normal' | 'strong'>('normal');
  const [presetName, setPresetName] = useState('');

  // Dictionary new entry
  const [newWord, setNewWord] = useState('');
  const [newReading, setNewReading] = useState('');
  const [newNote, setNewNote] = useState('');
  const [sampleThaiTest, setSampleThaiTest] = useState(
    'วันที่ 15 เวลา 06:30 น. มีคนส่งสติกเกอร์ 123 ตัวใน ZKatoon กทม.'
  );

  // Per-scene synthesis status
  const [busySceneId, setBusySceneId] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    audioPlayerRef.current?.pause();
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
  }, []);

  const meta = TTS_PROVIDERS_META[settings.ttsProvider];

  async function handleFetchVoices() {
    setLoadingVoices(true);
    setVoiceLoadErr(null);
    try {
      const adapter = getTtsAdapter(settings.ttsProvider);
      const list = await adapter.fetchVoices(settings, secrets);
      setVoices(list);
      if (list.length > 0 && !list.some((v) => v.id === settings.ttsVoiceId)) {
        onUpdateSettings({
          ...settings,
          ttsVoiceId: list[0].id,
          ttsVoiceName: list[0].name,
        });
      }
      onNotify(`โหลด ${list.length} เสียงจาก ${meta.name} สำเร็จ`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setVoiceLoadErr(msg);
      setVoices([]);
    } finally {
      setLoadingVoices(false);
    }
  }

  useEffect(() => {
    setVoices([]);
    setVoiceLoadErr(null);
  }, [settings.ttsProvider]);

  const filteredVoices = voices.filter((v) =>
    filterGender === 'all' ? true : (v.gender || 'neutral') === filterGender
  );

  async function handleSavePreset() {
    if (!presetName.trim()) {
      onNotify('กรุณาตั้งชื่อ Voice Preset');
      return;
    }
    const preset: VoicePreset = {
      id: generateUuid(),
      name: presetName.trim(),
      providerId: settings.ttsProvider,
      voiceId: settings.ttsVoiceId,
      voiceName: settings.ttsVoiceName || settings.ttsVoiceId || 'Default Voice',
      gender: filterGender === 'all' ? 'neutral' : filterGender,
      ageGroup,
      pitchTone,
      roleType,
      styleTone,
      emotion: settings.voiceEmotion,
      speed: settings.voiceSpeed,
      weight,
      emphasis,
      styleInstruction: settings.voiceStyle,
      createdAt: Date.now(),
    };
    await onSaveVoicePreset(preset);
    setPresetName('');
    onNotify(`บันทึก Voice Preset "${preset.name}" ลง Workspace แล้ว`);
  }

  function applyPreset(p: VoicePreset) {
    setAgeGroup(p.ageGroup);
    setPitchTone(p.pitchTone);
    setRoleType(p.roleType);
    setStyleTone(p.styleTone);
    setWeight(p.weight);
    setEmphasis(p.emphasis);
    onUpdateSettings({
      ...settings,
      ttsProvider: p.providerId,
      ttsVoiceId: p.voiceId,
      ttsVoiceName: p.voiceName,
      voiceEmotion: p.emotion,
      voiceSpeed: p.speed,
      voiceStyle: p.styleInstruction,
    });
    onNotify(`ใช้ Preset "${p.name}" แล้ว`);
  }

  async function synthesizeSingleScene(sceneIdx: number, quiet = false): Promise<boolean> {
    if (!project || (!quiet && (busyAll || busySceneId !== null))) return false;
    const scene = project.scenes[sceneIdx];
    if (!scene) return false;
    const sceneId = scene.id || `S${sceneIdx + 1}`;
    const providerId = scene.voiceConfig?.providerId || settings.ttsProvider;
    const voiceId = scene.voiceConfig?.voiceId || settings.ttsVoiceId;
    const voiceName = scene.voiceConfig?.voiceName || settings.ttsVoiceName || voiceId;
    const emotion = scene.voiceConfig?.emotion || settings.voiceEmotion;
    const speed = scene.voiceConfig?.speed || settings.voiceSpeed;
    const styleInstruction = scene.voiceConfig?.styleInstruction || settings.voiceStyle;
    if (!voiceId) { if (!quiet) onNotify('กรุณาเลือก Voice ก่อนสร้างเสียง'); return false; }
    setBusySceneId(sceneId);
    try {
      const adapter = getTtsAdapter(providerId);
      const res = await adapter.synthesize({ text: scene.narration, voiceId, voiceName, emotion, speed, pitch: scene.voiceConfig?.pitch, styleInstruction, dictionary, settings, secrets });
      if (!res.audioBlob.size || !res.durationSec || !Number.isFinite(res.durationSec)) throw new Error('ผู้ให้บริการส่งไฟล์เสียงว่างหรือความยาวไม่ถูกต้อง');
      const projId = project.id || 'active-project';
      const rec: SceneAudioRecord = {
        key: `${workspaceId}::${projId}::${sceneId}`, workspaceId, projectId: projId, sceneId,
        providerId, voiceId, voiceName, emotion, textRaw: scene.narration, textPrepared: res.preparedText,
        audioBlob: res.audioBlob, mimeType: res.mimeType, durationSec: res.durationSec,
        envelope: res.envelope, phonemeMarks: res.phonemeMarks, generatedAt: Date.now(),
      };
      await onSaveSceneAudio(rec);
      if (!quiet) onNotify(`พากย์เสียงฉาก ${sceneId} สำเร็จ (${res.durationSec.toFixed(2)} วิ)`);
      return true;
    } catch (err) {
      if (!quiet) onNotify(err instanceof Error ? err.message : 'พากย์เสียงไม่สำเร็จ');
      return false;
    } finally { setBusySceneId(null); }
  }

  async function handleGenerateAllScenes() {
    if (!project || busyAll || busySceneId !== null) return;
    setBusyAll(true);
    let successCount = 0;
    const failedScenes: string[] = [];
    try {
      for (let i = 0; i < project.scenes.length; i++) {
        const ok = await synthesizeSingleScene(i, true);
        if (ok) successCount++;
        else failedScenes.push(project.scenes[i]?.id || `S${i + 1}`);
      }
      if (successCount > 0) await onMergeAllAudioToStudio();
      if (failedScenes.length) onNotify(`สร้างเสียงสำเร็จ ${successCount}/${project.scenes.length} ฉาก — ไม่สำเร็จ: ${failedScenes.join(', ')}`);
      else onNotify(`สร้างเสียงครบ ${successCount} ฉากแล้ว`);
    } catch (err) { onNotify(err instanceof Error ? err.message : 'การสร้างเสียงทั้งหมดไม่สำเร็จ'); }
    finally { setBusyAll(false); }
  }

  function playSceneAudio(rec: SceneAudioRecord) {
    audioPlayerRef.current?.pause();
    if (audioUrlRef.current) { URL.revokeObjectURL(audioUrlRef.current); audioUrlRef.current = null; }
    const url = URL.createObjectURL(rec.audioBlob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    audioPlayerRef.current = audio;
    setPlayingSceneId(rec.sceneId);
    const release = () => {
      if (audioUrlRef.current === url) audioUrlRef.current = null;
      URL.revokeObjectURL(url);
      if (audioPlayerRef.current === audio) audioPlayerRef.current = null;
      setPlayingSceneId(null);
    };
    audio.onended = release;
    void audio.play().catch(release);
  }

  const preparedSample = prepareThaiSpeechText(sampleThaiTest, { dictionary });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            ห้องพากย์ภาษาไทยมืออาชีพ (Thai AI Voice Studio)
          </h1>
          <p className="mt-1 text-sm text-[#9894b8]">
            รองรับ 6 TTS Adapters แยกขาดจากกัน โหลดรายชื่อเสียงจริงจากผู้ให้บริการ ประมวลผลคำไทย/เลข/วันที่ และสร้างเสียงรายฉากโดยไม่ลบฉากอื่น
          </p>
        </div>
        <button
          type="button"
          onClick={onGoSettings}
          className="min-h-[40px] rounded-xl border border-white/10 bg-[#13141d] px-4 text-xs font-semibold text-white hover:border-violet-400/50 cursor-pointer self-start"
        >
          ตั้งค่า API Key เสียงพากย์
        </button>
      </div>

      {/* Part A1 + A2: Provider & Live Voice Library */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Mic2 className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <span>1. เลือกผู้ให้บริการ & คลังเสียงจริง (Voice Library)</span>
            </h2>
            <button
              type="button"
              onClick={handleFetchVoices}
              disabled={loadingVoices}
              className="inline-flex items-center gap-1.5 min-h-[38px] rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingVoices ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>โหลดเสียงจาก {meta.name}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(TTS_PROVIDERS_META) as TtsProviderId[]).map((pid) => {
              const m = TTS_PROVIDERS_META[pid];
              const active = settings.ttsProvider === pid;
              return (
                <button
                  key={pid}
                  type="button"
                  onClick={() => onUpdateSettings({ ...settings, ttsProvider: pid })}
                  className={`rounded-xl border px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                    active
                      ? 'border-violet-500 bg-violet-500/15 text-white font-semibold'
                      : 'border-white/10 bg-[#1b1d29] text-[#d6d3eb] hover:border-white/25'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>

          {voiceLoadErr && (
            <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs text-amber-200">
              {voiceLoadErr}
            </div>
          )}

          {/* Voice List & Filters */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value as 'all' | VoiceGender)}
              className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
            >
              <option value="all">ทุกเพศ</option>
              <option value="female">ผู้หญิง</option>
              <option value="male">ผู้ชาย</option>
              <option value="neutral">กลาง</option>
            </select>
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value as VoiceAgeGroup)}
              className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
            >
              <option value="teen">วัยรุ่น</option>
              <option value="adult">วัยผู้ใหญ่</option>
              <option value="elder">ผู้สูงอายุ</option>
            </select>
            <select
              value={pitchTone}
              onChange={(e) => setPitchTone(e.target.value as VoicePitchTone)}
              className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
            >
              <option value="deep">เสียงทุ้ม</option>
              <option value="medium">เสียงกลาง</option>
              <option value="high">เสียงสูง</option>
            </select>
            <select
              value={roleType}
              onChange={(e) => setRoleType(e.target.value as VoiceRoleType)}
              className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
            >
              <option value="narrator">ผู้บรรยาย</option>
              <option value="character">ตัวละคร</option>
              <option value="storyteller">นักเล่าเรื่อง</option>
            </select>
          </div>

          {filteredVoices.length > 0 ? (
            <div className="max-h-52 overflow-y-auto space-y-1.5 rounded-xl border border-white/10 bg-[#0b0c12] p-2">
              {filteredVoices.map((v) => {
                const selected = settings.ttsVoiceId === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        ttsVoiceId: v.id,
                        ttsVoiceName: v.name,
                      })
                    }
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                      selected
                        ? 'bg-violet-600 text-white font-semibold'
                        : 'bg-[#13141d] text-[#d6d3eb] hover:bg-[#1b1d29]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">{v.name}</div>
                      <div className="text-[10px] opacity-75 truncate">
                        {v.locale} {v.description ? `· ${v.description}` : ''}
                      </div>
                    </div>
                    {v.supportsPhonemeTiming && (
                      <span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-200">
                        Timestamps
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-[#0b0c12] p-4 text-xs text-[#9894b8]">
              ยังไม่ได้โหลดรายการเสียงจาก {meta.name} — กดปุ่ม "โหลดเสียงจาก {meta.name}" ด้านบน หรือระบุ Voice ID ด้วยตนเอง:
              <input
                type="text"
                value={settings.ttsVoiceId}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    ttsVoiceId: e.target.value,
                    ttsVoiceName: e.target.value,
                  })
                }
                placeholder="เช่น th-TH-PremwadeeNeural หรือ ElevenLabs Voice ID"
                className="mt-2 w-full min-h-[38px] rounded-lg border border-white/10 bg-[#13141d] px-3 text-xs text-white"
              />
            </div>
          )}

          {/* Voice Style, Emotion, Speed, Weight, Emphasis */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] text-[#9894b8] mb-1">อารมณ์เสียง</label>
              <select
                value={settings.voiceEmotion}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, voiceEmotion: e.target.value as VoiceEmotion })
                }
                className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
              >
                {EMOTIONS.map((em) => (
                  <option key={em.id} value={em.id}>
                    {em.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-[#9894b8] mb-1">
                ความเร็วในการพูด ({settings.voiceSpeed.toFixed(2)}x)
              </label>
              <input
                type="range"
                min={0.65}
                max={1.45}
                step={0.05}
                value={settings.voiceSpeed}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, voiceSpeed: Number(e.target.value) })
                }
                className="w-full studio-range mt-2"
              />
            </div>
            <div>
              <label className="block text-[11px] text-[#9894b8] mb-1">
                ความหนักเบา / เน้นคำ ({weight.toFixed(1)})
              </label>
              <select
                value={emphasis}
                onChange={(e) => setEmphasis(e.target.value as 'low' | 'normal' | 'strong')}
                className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
              >
                <option value="low">นุ่มนวล (Low)</option>
                <option value="normal">ปกติ (Normal)</option>
                <option value="strong">เน้นหนักชัดเจน (Strong)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-[#9894b8] mb-1">
              คำสั่งกำกับน้ำเสียง (Style Instruction)
            </label>
            <input
              type="text"
              value={settings.voiceStyle}
              onChange={(e) => onUpdateSettings({ ...settings, voiceStyle: e.target.value })}
              className="w-full min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
            />
          </div>

          {/* Workspace Voice Presets */}
          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="ตั้งชื่อ Voice Preset เพื่อบันทึกไว้ใน Workspace นี้"
                className="flex-1 min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                className="inline-flex items-center gap-1 min-h-[38px] rounded-lg bg-[#1b1d29] border border-white/10 px-3 text-xs font-semibold text-white hover:border-violet-400 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                <span>บันทึก Preset</span>
              </button>
            </div>
            {voicePresets.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {voicePresets.map((p) => (
                  <div
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#1b1d29] px-2.5 py-1 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => applyPreset(p)}
                      className="text-violet-200 hover:text-white font-medium cursor-pointer"
                    >
                      {p.name} ({p.voiceName})
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteVoicePreset(p.id)}
                      aria-label={`ลบ preset ${p.name}`}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Part A3: Thai Speech Preprocessor + Pronunciation Dictionary */}
        <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-400" aria-hidden="true" />
            <span>2. ตัวช่วยอ่านภาษาไทย & พจนานุกรมคำอ่าน</span>
          </h2>
          <p className="text-xs text-[#9894b8]">
            แปลงตัวเลข เวลา วันที่ ตัวย่อภาษาไทย และคำทับศัพท์โดยอัตโนมัติก่อนส่งเข้า TTS ทุกค่าย
          </p>

          <div className="space-y-2 rounded-xl border border-white/10 bg-[#0b0c12] p-3">
            <label className="block text-[11px] text-[#9894b8]">ทดสอบประโยคตัวอย่าง</label>
            <textarea
              rows={2}
              value={sampleThaiTest}
              onChange={(e) => setSampleThaiTest(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#13141d] p-2 text-xs text-white"
            />
            <div className="text-[11px] text-[#9894b8]">ผลลัพธ์ที่จะส่งให้ TTS อ่าน:</div>
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 text-xs text-emerald-200">
              {preparedSample}
            </div>
          </div>

          <form
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newWord.trim() || !newReading.trim()) return;
              const next: PronunciationEntry[] = [
                ...dictionary,
                {
                  id: generateUuid(),
                  word: newWord.trim(),
                  reading: newReading.trim(),
                  note: newNote.trim() || undefined,
                },
              ];
              await onSaveDictionary(next);
              setNewWord('');
              setNewReading('');
              setNewNote('');
              onNotify('เพิ่มคำอ่านลงพจนานุกรมแล้ว');
            }}
          >
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              placeholder="คำเดิม (เช่น TikTok)"
              className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
            />
            <input
              type="text"
              value={newReading}
              onChange={(e) => setNewReading(e.target.value)}
              placeholder="คำอ่าน (เช่น ติ๊กต็อก)"
              className="min-h-[38px] rounded-lg border border-white/10 bg-[#0b0c12] px-2.5 text-xs text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1 min-h-[38px] rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>เพิ่มคำอ่าน</span>
            </button>
          </form>

          <div className="max-h-44 overflow-y-auto space-y-1.5">
            {dictionary.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#1b1d29] px-3 py-1.5 text-xs"
              >
                <div>
                  <strong className="text-white">{entry.word}</strong>
                  <span className="mx-2 text-[#9894b8]">→</span>
                  <span className="text-emerald-300">{entry.reading}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onSaveDictionary(dictionary.filter((d) => d.id !== entry.id))}
                  className="text-rose-300 hover:text-rose-200 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Part A4 + A5: Per-Scene Audio Production + Lip Sync Diagnostics */}
      <section className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-violet-400" aria-hidden="true" />
              <span>3. จัดการเสียงพากย์รายฉาก (Per-Scene Workflow)</span>
            </h2>
            <p className="text-xs text-[#9894b8]">
              สร้างหรือสร้างใหม่ทีละฉากได้โดยไม่กระทบฉากอื่น พร้อมบันทึกลง IndexedDB และรวมเข้าไทม์ไลน์จริง
            </p>
          </div>

          {project && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyAll}
                onClick={handleGenerateAllScenes}
                className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>{busyAll ? 'กำลังพากย์ทุกฉาก…' : 'พากย์เสียงทั้งหมด'}</span>
              </button>
              <button
                type="button"
                onClick={onMergeAllAudioToStudio}
                disabled={busyAll || busySceneId !== null}
                className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/25 cursor-pointer"
              >
                <Layers className="h-4 w-4" aria-hidden="true" />
                <span>รวมเสียงเข้าสตูดิโอ</span>
              </button>
            </div>
          )}
        </div>

        {!project ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-[#0b0c12] p-8 text-center space-y-3">
            <p className="text-sm text-[#9894b8]">ยังไม่ได้เปิดโปรเจกต์</p>
            <button
              type="button"
              onClick={onOpenDemo3D}
              className="min-h-[40px] rounded-xl bg-violet-600 px-4 text-xs font-semibold text-white cursor-pointer"
            >
              เปิดโปรเจกต์ตัวอย่าง 3D เพื่อทดสอบพากย์เสียงรายฉาก
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {project.scenes.map((sc, idx) => {
              const sid = sc.id || `S${idx + 1}`;
              const storedRec = sceneAudioMap[sid];
              const audioIsStale = Boolean(storedRec && storedRec.textRaw.trim() !== sc.narration.trim());
              const rec = audioIsStale ? undefined : storedRec;
              const isBusy = busySceneId === sid;
              const prepared = prepareThaiSpeechText(sc.narration, { dictionary });
              return (
                <div
                  key={sid}
                  className="rounded-xl border border-white/10 bg-[#1b1d29] p-4 space-y-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-300">
                        {sid}
                      </span>
                      <span className="text-sm font-bold text-white">{sc.title || `ฉาก ${idx + 1}`}</span>
                      {rec && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 tabular-nums">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          <span>
                            {rec.durationSec.toFixed(2)} วิ · {rec.voiceName}
                            {rec.phonemeMarks?.length ? ' · Phoneme Lip-Sync' : ' · Envelope Lip-Sync'}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={sc.voiceConfig?.emotion || settings.voiceEmotion}
                        onChange={(e) => {
                          const nextScenes = [...project.scenes];
                          nextScenes[idx] = {
                            ...sc,
                            voiceConfig: {
                              ...sc.voiceConfig,
                              emotion: e.target.value as VoiceEmotion,
                            },
                          };
                          onUpdateProject({ ...project, scenes: nextScenes });
                        }}
                        className="min-h-[34px] rounded-lg border border-white/10 bg-[#0b0c12] px-2 text-xs text-white"
                      >
                        {EMOTIONS.map((em) => (
                          <option key={em.id} value={em.id}>
                            {em.label}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={isBusy || busyAll || busySceneId !== null}
                        onClick={() => synthesizeSingleScene(idx)}
                        className="min-h-[34px] rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50 cursor-pointer"
                      >
                        {isBusy ? 'กำลังสร้าง…' : rec ? 'สร้างเสียงใหม่เฉพาะฉากนี้' : 'สร้างเสียงฉากนี้'}
                      </button>

                      {rec && (
                        <>
                          <button
                            type="button"
                            onClick={() => playSceneAudio(rec)}
                            className="inline-flex items-center gap-1 min-h-[34px] rounded-lg border border-white/10 bg-[#13141d] px-2.5 text-xs text-white hover:border-violet-400 cursor-pointer"
                          >
                            <Play className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                            <span>{playingSceneId === sid ? 'กำลังเล่น' : 'ฟัง'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              triggerDownload(
                                rec.audioBlob,
                                `${project.title}_${sid}.${rec.mimeType.includes('wav') ? 'wav' : 'mp3'}`
                              )
                            }
                            className="inline-flex items-center gap-1 min-h-[34px] rounded-lg border border-white/10 bg-[#13141d] px-2.5 text-xs text-white cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>โหลด</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={sc.narration}
                    onChange={(e) => {
                      const nextScenes = [...project.scenes];
                      nextScenes[idx] = { ...sc, narration: e.target.value };
                      onUpdateProject({ ...project, scenes: nextScenes });
                    }}
                    className="w-full rounded-lg border border-white/10 bg-[#0b0c12] p-2.5 text-xs text-white"
                  />

                  {audioIsStale && (
                    <p className="text-[11px] text-amber-300">บทพูดถูกแก้ไขหลังสร้างเสียง — เสียงเดิมไม่ตรงกับบท กรุณาสร้างเสียงฉากนี้ใหม่ก่อนรวมเสียง</p>
                  )}

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-[#9894b8]">
                    <span className="truncate">คำอ่านที่เตรียมส่ง TTS: {prepared}</span>
                    {rec && rec.envelope.length > 0 && (
                      <div className="flex h-6 w-48 items-end gap-[1px] overflow-hidden rounded bg-[#0b0c12] px-1 py-0.5 shrink-0">
                        {rec.envelope.slice(0, 48).map((v, ei) => (
                          <div
                            key={ei}
                            className="flex-1 bg-violet-400/80"
                            style={{ height: `${Math.max(12, Math.round(v * 100))}%` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
