import type {
  PhonemeMark,
  PronunciationEntry,
  StudioSettings,
  TtsProviderId,
  VoiceEmotion,
  VoiceOption,
  WorkspaceSecrets,
} from '../types/cartoon';
import { buildAzureSsml, prepareThaiSpeechText } from './thaiSpeech';

export interface TtsProviderMeta {
  id: TtsProviderId;
  name: string;
  shortDesc: string;
  supportsStyleInstruction: boolean;
  supportsSpeedControl: boolean;
  supportsEmotions: VoiceEmotion[];
  supportsPhonemeTiming: boolean;
  corsNote: string;
  keyField: keyof WorkspaceSecrets;
}

export const TTS_PROVIDERS_META: Record<TtsProviderId, TtsProviderMeta> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter TTS',
    shortDesc: 'ใช้ OpenRouter Key เรียกโมเดลที่รองรับ output audio (เช่น gpt-audio)',
    supportsStyleInstruction: true,
    supportsSpeedControl: false,
    supportsEmotions: ['neutral', 'warm', 'excited', 'sad', 'tense'],
    supportsPhonemeTiming: false,
    corsNote: 'เรียกจากเบราว์เซอร์ได้โดยตรง (ต้องเลือกโมเดลที่รองรับ modalities: ["text","audio"])',
    keyField: 'openRouterKey',
  },
  elevenlabs: {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    shortDesc: 'ElevenLabs v2/v3 Multilingual ภาษาไทยธรรมชาติ + Timestamp Lip Sync',
    supportsStyleInstruction: false,
    supportsSpeedControl: true,
    supportsEmotions: ['neutral', 'energetic', 'sad', 'warm'],
    supportsPhonemeTiming: true,
    corsNote: 'เรียก api.elevenlabs.io จากเบราว์เซอร์ได้โดยตรงด้วย xi-api-key ของผู้ใช้',
    keyField: 'elevenLabsKey',
  },
  azure: {
    id: 'azure',
    name: 'Microsoft Azure Speech',
    shortDesc: 'เสียงไทย Niwat/Premwadee/Achara ผ่าน Neural SSML + อารมณ์',
    supportsStyleInstruction: false,
    supportsSpeedControl: true,
    supportsEmotions: ['neutral', 'energetic', 'excited', 'sad', 'whisper', 'warm', 'tense'],
    supportsPhonemeTiming: false,
    corsNote: 'รองรับ CORS จากเบราว์เซอร์โดยตรงตาม Region ที่ตั้งค่า (เช่น southeastasia)',
    keyField: 'azureSpeechKey',
  },
  google_cloud: {
    id: 'google_cloud',
    name: 'Google Cloud Text-to-Speech',
    shortDesc: 'Google Cloud Wavenet / Neural2 / Chirp3 ภาษาไทย (th-TH)',
    supportsStyleInstruction: false,
    supportsSpeedControl: true,
    supportsEmotions: ['neutral'],
    supportsPhonemeTiming: false,
    corsNote: 'เรียก texttospeech.googleapis.com ด้วย API Key ที่มีสิทธิ์ Text-to-Speech API',
    keyField: 'googleCloudTtsKey',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI TTS',
    shortDesc: 'gpt-4o-mini-tts / tts-1 พร้อม Style Instructions สำหรับกำกับน้ำเสียง',
    supportsStyleInstruction: true,
    supportsSpeedControl: true,
    supportsEmotions: ['neutral', 'energetic', 'excited', 'sad', 'whisper', 'warm', 'tense'],
    supportsPhonemeTiming: false,
    corsNote: 'รองรับ CORS จากเบราว์เซอร์ด้วย Bearer API Key ของผู้ใช้เอง',
    keyField: 'openAiKey',
  },
  custom_http: {
    id: 'custom_http',
    name: 'Custom HTTP TTS Provider',
    shortDesc: 'เชื่อมต่อ TTS API เฉพาะขององค์กร / Local Server / PyThaiTTS HTTP',
    supportsStyleInstruction: true,
    supportsSpeedControl: true,
    supportsEmotions: ['neutral', 'energetic', 'excited', 'sad', 'whisper', 'warm', 'tense'],
    supportsPhonemeTiming: false,
    corsNote: 'Endpoint ปลายทางต้องเปิด Access-Control-Allow-Origin มิฉะนั้นเบราว์เซอร์จะบล็อกด้วย CORS',
    keyField: 'customTtsKey',
  },
};

export interface TtsSynthesisRequest {
  text: string;
  voiceId: string;
  voiceName?: string;
  emotion: VoiceEmotion;
  speed: number;
  pitch?: number;
  styleInstruction?: string;
  dictionary?: PronunciationEntry[];
  settings: StudioSettings;
  secrets: WorkspaceSecrets;
  signal?: AbortSignal;
}

export interface TtsSynthesisResponse {
  audioBlob: Blob;
  mimeType: string;
  durationSec: number;
  envelope: number[];
  phonemeMarks?: PhonemeMark[];
  preparedText: string;
}

export interface TtsProviderAdapter {
  id: TtsProviderId;
  fetchVoices(settings: StudioSettings, secrets: WorkspaceSecrets): Promise<VoiceOption[]>;
  synthesize(req: TtsSynthesisRequest): Promise<TtsSynthesisResponse>;
}

function b64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function pcm16ToWavBlob(pcmBytes: Uint8Array, sampleRate = 24000, channels = 1): Blob {
  const byteLength = pcmBytes.byteLength;
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + byteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, byteLength, true);
  new Uint8Array(buffer, 44).set(pcmBytes);
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function analyzeAudioBlob(blob: Blob): Promise<{
  durationSec: number;
  envelope: number[];
}> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const arr = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(arr);
    const ch = decoded.getChannelData(0);
    const sr = decoded.sampleRate;
    const step = Math.max(1, Math.floor(sr * 0.02));
    const envelope: number[] = [];
    for (let i = 0; i < ch.length; i += step) {
      let sum = 0;
      const end = Math.min(ch.length, i + step);
      for (let j = i; j < end; j++) {
        sum += ch[j] * ch[j];
      }
      const rms = Math.sqrt(sum / Math.max(1, end - i));
      envelope.push(Math.min(1, rms * 3.8));
    }
    return { durationSec: Math.max(0.4, decoded.duration), envelope };
  } finally {
    await ctx.close().catch(() => {});
  }
}

function classifyHttpError(provider: string, status: number, detail: string): Error {
  if (status === 401 || status === 403) {
    return new Error(`${provider}: API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ (HTTP ${status})`);
  }
  if (status === 429) {
    return new Error(`${provider}: โควตาหรือ Rate Limit เต็มชั่วคราว (HTTP 429)`);
  }
  return new Error(`${provider}: คำขอไม่สำเร็จ (HTTP ${status}) ${detail.slice(0, 140)}`);
}

// 1. OpenRouter TTS Adapter
export const OpenRouterTtsAdapter: TtsProviderAdapter = {
  id: 'openrouter',
  async fetchVoices(_settings, secrets) {
    const key = secrets.openRouterKey?.trim();
    const headers: Record<string, string> = {};
    if (key) headers.Authorization = `Bearer ${key}`;
    const resp = await fetch('https://openrouter.ai/api/v1/models', { headers });
    if (!resp.ok) throw classifyHttpError('OpenRouter', resp.status, await resp.text().catch(() => ''));
    const data = (await resp.json()) as {
      data?: Array<{
        id: string;
        name?: string;
        architecture?: { output_modalities?: string[]; modality?: string };
      }>;
    };
    const audioModels = (data.data || []).filter((m) => {
      const outMods = m.architecture?.output_modalities || [];
      return outMods.includes('audio') || /audio/i.test(m.id);
    });
    if (audioModels.length === 0) {
      throw new Error('ไม่พบโมเดล OpenRouter ที่ระบุว่าส่งออก Audio ได้ในรายการล่าสุด');
    }
    return audioModels.map((m) => ({
      id: m.id,
      name: `${m.name || m.id}`,
      providerId: 'openrouter' as const,
      locale: 'th-TH / multi',
      gender: 'neutral' as const,
      roleType: 'narrator' as const,
      supportsStyleInstruction: true,
      supportsPhonemeTiming: false,
      description: 'OpenRouter Audio Output Model',
    }));
  },

  async synthesize(req) {
    const key = req.secrets.openRouterKey?.trim();
    if (!key) throw new Error('กรุณาใส่ OpenRouter API Key ก่อนสร้างเสียง');
    const preparedText = prepareThaiSpeechText(req.text, { dictionary: req.dictionary });
    const modelId = req.voiceId && req.voiceId.includes('/') ? req.voiceId : req.settings.openRouterTtsModel || 'openai/gpt-audio-mini';
    const voiceChoice = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(req.voiceId)
      ? req.voiceId
      : 'nova';

    const instruction = req.styleInstruction?.trim()
      ? `${req.styleInstruction} — อ่านข้อความภาษาไทยต่อไปนี้ตรงตามตัวอักษรโดยไม่เพิ่มคำ:`
      : 'อ่านข้อความภาษาไทยต่อไปนี้เป็นเสียงพากย์อย่างเป็นธรรมชาติ ตรงตามตัวอักษร:';

    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      signal: req.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'X-Title': 'ZKatoon Studio',
      },
      body: JSON.stringify({
        model: modelId,
        modalities: ['text', 'audio'],
        audio: { voice: voiceChoice, format: 'pcm16' },
        messages: [
          { role: 'system', content: instruction },
          { role: 'user', content: preparedText },
        ],
      }),
    });

    if (!resp.ok) {
      throw classifyHttpError('OpenRouter TTS', resp.status, await resp.text().catch(() => ''));
    }
    const payload = (await resp.json()) as {
      choices?: Array<{ message?: { audio?: { data?: string; format?: string } } }>;
      error?: { message?: string };
    };
    const audioObj = payload.choices?.[0]?.message?.audio;
    if (!audioObj?.data) {
      throw new Error(
        payload.error?.message ||
          `โมเดล ${modelId} ไม่ได้ส่งข้อมูลเสียง Audio กลับมา (ตรวจสอบว่าโมเดลรองรับ Audio Output บน OpenRouter)`
      );
    }
    const bytes = b64ToUint8Array(audioObj.data);
    const audioBlob =
      audioObj.format === 'mp3'
        ? new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/mpeg' })
        : pcm16ToWavBlob(bytes, 24000, 1);
    const analyzed = await analyzeAudioBlob(audioBlob);
    return { audioBlob, mimeType: audioBlob.type, ...analyzed, preparedText };
  },
};

// 2. ElevenLabs Adapter
export const ElevenLabsAdapter: TtsProviderAdapter = {
  id: 'elevenlabs',
  async fetchVoices(_settings, secrets) {
    const key = secrets.elevenLabsKey?.trim();
    if (!key) throw new Error('กรุณาใส่ ElevenLabs API Key เพื่อโหลดรายการเสียงจริงจากบัญชีของคุณ');
    const resp = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key },
    });
    if (!resp.ok) throw classifyHttpError('ElevenLabs', resp.status, await resp.text().catch(() => ''));
    const data = (await resp.json()) as {
      voices?: Array<{
        voice_id: string;
        name: string;
        preview_url?: string;
        labels?: { gender?: string; age?: string; accent?: string; use_case?: string };
      }>;
    };
    return (data.voices || []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      providerId: 'elevenlabs' as const,
      locale: v.labels?.accent || 'multilingual',
      gender: v.labels?.gender === 'male' ? 'male' : v.labels?.gender === 'female' ? 'female' : 'neutral',
      ageGroup:
        v.labels?.age === 'young' ? 'teen' : v.labels?.age === 'old' ? 'elder' : 'adult',
      roleType: v.labels?.use_case === 'narration' ? 'narrator' : 'character',
      supportedEmotions: ['neutral', 'energetic', 'sad', 'warm'],
      supportsStyleInstruction: false,
      supportsPhonemeTiming: true,
      previewUrl: v.preview_url,
      description: [v.labels?.gender, v.labels?.age, v.labels?.use_case].filter(Boolean).join(' · '),
    }));
  },

  async synthesize(req) {
    const key = req.secrets.elevenLabsKey?.trim();
    if (!key) throw new Error('กรุณาใส่ ElevenLabs API Key ก่อนสร้างเสียง');
    if (!req.voiceId) throw new Error('กรุณาเลือก Voice ID จากรายการ ElevenLabs ก่อน');
    const preparedText = prepareThaiSpeechText(req.text, { dictionary: req.dictionary });

    const stability = req.emotion === 'energetic' || req.emotion === 'excited' ? 0.35 : 0.55;
    const style = req.emotion === 'sad' ? 0.25 : req.emotion === 'excited' ? 0.65 : 0.3;

    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(req.voiceId)}/with-timestamps`,
      {
        method: 'POST',
        signal: req.signal,
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify({
          text: preparedText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability,
            similarity_boost: 0.78,
            style,
            speed: Math.min(1.2, Math.max(0.7, req.speed || 1)),
          },
        }),
      }
    );

    if (!resp.ok) {
      throw classifyHttpError('ElevenLabs', resp.status, await resp.text().catch(() => ''));
    }

    const payload = (await resp.json()) as {
      audio_base64: string;
      alignment?: {
        characters?: string[];
        character_start_times_seconds?: number[];
        character_end_times_seconds?: number[];
      };
    };

    const bytes = b64ToUint8Array(payload.audio_base64);
    const audioBlob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/mpeg' });
    const analyzed = await analyzeAudioBlob(audioBlob);

    const phonemeMarks: PhonemeMark[] | undefined = payload.alignment?.characters?.map((ch, idx) => {
      const start = payload.alignment?.character_start_times_seconds?.[idx] ?? 0;
      const end = payload.alignment?.character_end_times_seconds?.[idx] ?? start + 0.05;
      const isPause = /[\s,.!?]/.test(ch);
      const isOpenVowel = /[าอาแแอออัวเอือไใ]/.test(ch);
      return {
        timeSec: start,
        endSec: end,
        value: ch,
        openness: isPause ? 0.05 : isOpenVowel ? 0.9 : 0.55,
      };
    });

    return {
      audioBlob,
      mimeType: 'audio/mpeg',
      ...analyzed,
      phonemeMarks,
      preparedText,
    };
  },
};

// 3. Microsoft Azure Speech Adapter
export const AzureSpeechAdapter: TtsProviderAdapter = {
  id: 'azure',
  async fetchVoices(settings, secrets) {
    const key = secrets.azureSpeechKey?.trim();
    const region = settings.azureRegion?.trim() || 'southeastasia';
    if (!key) throw new Error('กรุณาใส่ Azure Speech Key ก่อนโหลดรายการเสียงจริง');
    const resp = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    });
    if (!resp.ok) throw classifyHttpError('Azure Speech', resp.status, await resp.text().catch(() => ''));
    const list = (await resp.json()) as Array<{
      ShortName: string;
      LocalName: string;
      DisplayName: string;
      Gender: string;
      Locale: string;
      StyleList?: string[];
    }>;
    const thaiAndEng = list.filter((v) => v.Locale.startsWith('th-') || v.Locale === 'en-US');
    return thaiAndEng.map((v) => ({
      id: v.ShortName,
      name: `${v.LocalName || v.DisplayName} (${v.Locale})`,
      providerId: 'azure' as const,
      locale: v.Locale,
      gender: v.Gender === 'Male' ? 'male' : 'female',
      supportedEmotions: v.StyleList?.length
        ? ['neutral', 'energetic', 'excited', 'sad', 'whisper', 'warm', 'tense']
        : ['neutral'],
      supportsStyleInstruction: false,
      supportsPhonemeTiming: false,
      description: v.StyleList?.length ? `สไตล์: ${v.StyleList.join(', ')}` : v.ShortName,
    }));
  },

  async synthesize(req) {
    const key = req.secrets.azureSpeechKey?.trim();
    const region = req.settings.azureRegion?.trim() || 'southeastasia';
    if (!key) throw new Error('กรุณาใส่ Azure Speech Key ก่อนสร้างเสียง');
    if (!req.voiceId) throw new Error('กรุณาเลือก Voice ของ Azure ก่อน');
    const preparedText = prepareThaiSpeechText(req.text, { dictionary: req.dictionary });
    const ssml = buildAzureSsml({
      text: preparedText,
      voiceId: req.voiceId,
      emotion: req.emotion,
      speed: req.speed,
      pitch: req.pitch,
    });

    const resp = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      signal: req.signal,
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      },
      body: ssml,
    });
    if (!resp.ok) throw classifyHttpError('Azure Speech', resp.status, await resp.text().catch(() => ''));
    const audioBlob = new Blob([await resp.arrayBuffer()], { type: 'audio/mpeg' });
    const analyzed = await analyzeAudioBlob(audioBlob);
    return { audioBlob, mimeType: 'audio/mpeg', ...analyzed, preparedText };
  },
};

// 4. Google Cloud Text-to-Speech Adapter
export const GoogleCloudTtsAdapter: TtsProviderAdapter = {
  id: 'google_cloud',
  async fetchVoices(_settings, secrets) {
    const key = secrets.googleCloudTtsKey?.trim();
    if (!key) throw new Error('กรุณาใส่ Google Cloud TTS API Key ก่อนโหลดรายการเสียงจริง');
    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1/voices?languageCode=th-TH&key=${encodeURIComponent(key)}`
    );
    if (!resp.ok) throw classifyHttpError('Google Cloud TTS', resp.status, await resp.text().catch(() => ''));
    const data = (await resp.json()) as {
      voices?: Array<{ name: string; ssmlGender?: string; languageCodes?: string[] }>;
    };
    return (data.voices || []).map((v) => ({
      id: v.name,
      name: v.name,
      providerId: 'google_cloud' as const,
      locale: v.languageCodes?.[0] || 'th-TH',
      gender:
        v.ssmlGender === 'MALE' ? 'male' : v.ssmlGender === 'FEMALE' ? 'female' : 'neutral',
      supportedEmotions: ['neutral'],
      supportsStyleInstruction: false,
      supportsPhonemeTiming: false,
      description: `Google Cloud (${v.ssmlGender || 'NEUTRAL'})`,
    }));
  },

  async synthesize(req) {
    const key = req.secrets.googleCloudTtsKey?.trim();
    if (!key) throw new Error('กรุณาใส่ Google Cloud TTS API Key ก่อนสร้างเสียง');
    if (!req.voiceId) throw new Error('กรุณาเลือก Voice ของ Google Cloud ก่อน');
    const preparedText = prepareThaiSpeechText(req.text, { dictionary: req.dictionary });

    const resp = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        signal: req.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text: preparedText },
          voice: { languageCode: 'th-TH', name: req.voiceId },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: Math.min(2.0, Math.max(0.5, req.speed || 1)),
            pitch: Math.min(12, Math.max(-12, req.pitch || 0)),
          },
        }),
      }
    );
    if (!resp.ok) throw classifyHttpError('Google Cloud TTS', resp.status, await resp.text().catch(() => ''));
    const payload = (await resp.json()) as { audioContent?: string };
    if (!payload.audioContent) throw new Error('Google Cloud TTS ไม่ได้ส่งข้อมูล audioContent กลับมา');
    const bytes = b64ToUint8Array(payload.audioContent);
    const audioBlob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/mpeg' });
    const analyzed = await analyzeAudioBlob(audioBlob);
    return { audioBlob, mimeType: 'audio/mpeg', ...analyzed, preparedText };
  },
};

// 5. OpenAI TTS Adapter
const OPENAI_VOICES: VoiceOption[] = [
  { id: 'alloy', name: 'alloy (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'neutral', supportsStyleInstruction: true },
  { id: 'ash', name: 'ash (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'male', supportsStyleInstruction: true },
  { id: 'ballad', name: 'ballad (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'female', supportsStyleInstruction: true },
  { id: 'coral', name: 'coral (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'female', supportsStyleInstruction: true },
  { id: 'echo', name: 'echo (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'male', supportsStyleInstruction: true },
  { id: 'fable', name: 'fable (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'neutral', supportsStyleInstruction: true },
  { id: 'nova', name: 'nova (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'female', supportsStyleInstruction: true },
  { id: 'onyx', name: 'onyx (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'male', supportsStyleInstruction: true },
  { id: 'sage', name: 'sage (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'female', supportsStyleInstruction: true },
  { id: 'shimmer', name: 'shimmer (OpenAI)', providerId: 'openai', locale: 'multi', gender: 'female', supportsStyleInstruction: true },
];

export const OpenAiTtsAdapter: TtsProviderAdapter = {
  id: 'openai',
  async fetchVoices(_settings, secrets) {
    if (!secrets.openAiKey?.trim()) {
      throw new Error('กรุณาใส่ OpenAI API Key ก่อนตรวจสอบสิทธิ์รายการเสียง');
    }
    // Verify key against OpenAI models endpoint so we don't fake active access
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${secrets.openAiKey.trim()}` },
    });
    if (!resp.ok) throw classifyHttpError('OpenAI', resp.status, await resp.text().catch(() => ''));
    return OPENAI_VOICES;
  },

  async synthesize(req) {
    const key = req.secrets.openAiKey?.trim();
    if (!key) throw new Error('กรุณาใส่ OpenAI API Key ก่อนสร้างเสียง');
    const preparedText = prepareThaiSpeechText(req.text, { dictionary: req.dictionary });
    const model = req.settings.openAiTtsModel || 'gpt-4o-mini-tts';
    const voice = req.voiceId || 'coral';

    const body: Record<string, unknown> = {
      model,
      input: preparedText,
      voice,
      speed: Math.min(2.0, Math.max(0.5, req.speed || 1)),
      response_format: 'mp3',
    };
    if (model.includes('gpt-4o-mini-tts') && req.styleInstruction?.trim()) {
      body.instructions = req.styleInstruction.trim();
    }

    const resp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      signal: req.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw classifyHttpError('OpenAI TTS', resp.status, await resp.text().catch(() => ''));
    const audioBlob = new Blob([await resp.arrayBuffer()], { type: 'audio/mpeg' });
    const analyzed = await analyzeAudioBlob(audioBlob);
    return { audioBlob, mimeType: 'audio/mpeg', ...analyzed, preparedText };
  },
};

// 6. Custom HTTP TTS Adapter
export const CustomHttpTtsAdapter: TtsProviderAdapter = {
  id: 'custom_http',
  async fetchVoices(settings) {
    const endpoint = settings.customTtsEndpoint?.trim();
    if (!endpoint) {
      throw new Error('กรุณากรอก Custom HTTP TTS Endpoint URL ก่อน');
    }
    return [
      {
        id: settings.ttsVoiceId || 'default',
        name: `Custom Endpoint Voice (${settings.ttsVoiceId || 'default'})`,
        providerId: 'custom_http',
        locale: 'th-TH',
        gender: 'neutral',
        supportsStyleInstruction: true,
        supportsPhonemeTiming: false,
        description: endpoint,
      },
    ];
  },

  async synthesize(req) {
    const endpoint = req.settings.customTtsEndpoint?.trim();
    if (!endpoint) throw new Error('กรุณาระบุ Endpoint URL ของ Custom HTTP TTS ในหน้า API Settings');
    const preparedText = prepareThaiSpeechText(req.text, { dictionary: req.dictionary });
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = req.secrets.customTtsKey?.trim();
    if (apiKey) {
      const hName = req.settings.customTtsHeaderName?.trim() || 'Authorization';
      const prefix = req.settings.customTtsHeaderPrefix ?? 'Bearer ';
      headers[hName] = `${prefix}${apiKey}`;
    }

    let payloadObj: Record<string, unknown> = {
      text: preparedText,
      voice: req.voiceId || 'default',
      speed: req.speed || 1,
      emotion: req.emotion,
      instructions: req.styleInstruction || undefined,
    };
    if (req.settings.customTtsBodyTemplate?.trim()) {
      try {
        const templated = req.settings.customTtsBodyTemplate
          .replace(/\{\{text\}\}/g, JSON.stringify(preparedText).slice(1, -1))
          .replace(/\{\{voice\}\}/g, JSON.stringify(req.voiceId || 'default').slice(1, -1))
          .replace(/\{\{speed\}\}/g, String(req.speed || 1));
        payloadObj = JSON.parse(templated) as Record<string, unknown>;
      } catch {
        // Fallback to standard JSON body
      }
    }

    let resp: Response;
    try {
      resp = await fetch(endpoint, {
        method: 'POST',
        signal: req.signal,
        headers,
        body: JSON.stringify(payloadObj),
      });
    } catch (err) {
      throw new Error(
        `ไม่สามารถเรียก ${endpoint} จากเบราว์เซอร์ได้ (อาจติด CORS จากฝั่งเซิร์ฟเวอร์ปลายทาง หรือเซิร์ฟเวอร์ไม่ทำงาน): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    if (!resp.ok) {
      throw classifyHttpError('Custom HTTP TTS', resp.status, await resp.text().catch(() => ''));
    }
    const ct = resp.headers.get('content-type') || '';
    let audioBlob: Blob;
    if (ct.includes('application/json')) {
      const json = (await resp.json()) as { audioBase64?: string; audio?: string; audioContent?: string; mimeType?: string };
      const b64 = json.audioBase64 || json.audio || json.audioContent;
      if (!b64) throw new Error('Custom HTTP TTS JSON ไม่มีฟิลด์ audioBase64 / audio / audioContent');
      const bytes = b64ToUint8Array(b64);
      audioBlob = new Blob([bytes.buffer as ArrayBuffer], { type: json.mimeType || 'audio/wav' });
    } else {
      audioBlob = new Blob([await resp.arrayBuffer()], { type: ct || 'audio/wav' });
    }
    const analyzed = await analyzeAudioBlob(audioBlob);
    return { audioBlob, mimeType: audioBlob.type, ...analyzed, preparedText };
  },
};

export const TTS_ADAPTERS: Record<TtsProviderId, TtsProviderAdapter> = {
  openrouter: OpenRouterTtsAdapter,
  elevenlabs: ElevenLabsAdapter,
  azure: AzureSpeechAdapter,
  google_cloud: GoogleCloudTtsAdapter,
  openai: OpenAiTtsAdapter,
  custom_http: CustomHttpTtsAdapter,
};

export function getTtsAdapter(providerId: TtsProviderId): TtsProviderAdapter {
  return TTS_ADAPTERS[providerId] || ElevenLabsAdapter;
}
