import type { AppConfig, StudioScene } from '../types/studio';
import { prepareThaiSpeechText } from './thaiSpeech';

export interface TtsSynthesizeResult {
  blob: Blob;
  mimeType: string;
  durationSec?: number;
}

export async function synthesizeSceneTts(
  text: string,
  config: AppConfig,
  speakerKey?: string,
  signal?: AbortSignal
): Promise<TtsSynthesizeResult> {
  const prepared = prepareThaiSpeechText(text);
  if (!prepared) {
    throw new Error('ไม่มีข้อความพากย์สำหรับสร้างเสียง');
  }

  const overrideVoice = speakerKey && config.speakerVoices[speakerKey];

  if (config.ttsEngine === 'elevenlabs') {
    const key = config.elevenLabsKey.trim();
    if (!key) throw new Error('ยังไม่ได้ใส่ ElevenLabs API Key');
    const voiceId = (overrideVoice || config.elevenLabsVoiceId || '21m00Tcm4TlvDq8ikWAM').trim();
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      signal,
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: prepared,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.52,
          similarity_boost: 0.78,
          speed: Math.max(0.7, Math.min(1.3, config.ttsSpeed || 1)),
        },
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`ElevenLabs HTTP ${res.status}: ${msg.slice(0, 140)}`);
    }
    const blob = await res.blob();
    return { blob, mimeType: 'audio/mpeg' };
  }

  if (config.ttsEngine === 'openai_compat') {
    const baseUrl = (config.openAiTtsBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const key = config.openAiTtsKey.trim();
    if (!key) throw new Error('ยังไม่ได้ใส่ OpenAI-compatible TTS API Key');
    const voice = (overrideVoice || config.openAiTtsVoice || 'alloy').trim();
    const res = await fetch(`${baseUrl}/audio/speech`, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.openAiTtsModel || 'gpt-4o-mini-tts',
        input: prepared,
        voice,
        speed: Math.max(0.5, Math.min(2, config.ttsSpeed || 1)),
        response_format: 'mp3',
      }),
    });
    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(`OpenAI TTS HTTP ${res.status}: ${msg.slice(0, 140)}`);
    }
    const blob = await res.blob();
    return { blob, mimeType: blob.type || 'audio/mpeg' };
  }

  // Google Cloud Text-to-Speech
  const gKey = config.googleTtsKey.trim();
  if (!gKey) throw new Error('ยังไม่ได้ใส่ Google Cloud TTS API Key');
  const voiceName = (overrideVoice || config.googleTtsVoice || 'th-TH-Standard-A').trim();
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(gKey)}`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: prepared },
      voice: { languageCode: 'th-TH', name: voiceName },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: Math.max(0.5, Math.min(2, config.ttsSpeed || 1)),
      },
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Google TTS HTTP ${res.status}: ${msg.slice(0, 140)}`);
  }
  const data = (await res.json()) as { audioContent?: string };
  if (!data.audioContent) {
    throw new Error('Google Cloud TTS ไม่ได้ส่งข้อมูล audioContent กลับมา');
  }
  const bin = atob(data.audioContent);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { blob: new Blob([bytes], { type: 'audio/mpeg' }), mimeType: 'audio/mpeg' };
}

export async function runPerSceneTtsQueue(params: {
  scenes: StudioScene[];
  config: AppConfig;
  existingSceneIds: Set<string>;
  skipExisting?: boolean;
  signal?: AbortSignal;
  onSceneSuccess: (sceneId: string, blob: Blob, sourceText: string) => Promise<void>;
  onProgress: (info: { done: number; total: number; currentSceneId: string; error?: string }) => void;
}): Promise<{ completed: number; failed: Array<{ sceneId: string; error: string }> }> {
  const { scenes, config, existingSceneIds, skipExisting = true, signal, onSceneSuccess, onProgress } = params;
  const queue = skipExisting
    ? scenes.filter((s) => !existingSceneIds.has(s.id) || s.audio?.stale)
    : scenes;

  let completed = 0;
  const failed: Array<{ sceneId: string; error: string }> = [];

  for (let i = 0; i < queue.length; i++) {
    if (signal?.aborted) break;
    const sc = queue[i];
    onProgress({ done: i, total: queue.length, currentSceneId: sc.id });
    try {
      const speakText = sc.speech || sc.narration;
      const res = await synthesizeSceneTts(speakText, config, sc.speaker, signal);
      await onSceneSuccess(sc.id, res.blob, speakText);
      completed++;
      onProgress({ done: i + 1, total: queue.length, currentSceneId: sc.id });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message.includes('Failed to fetch')
            ? 'เชื่อมต่อไม่ได้หรือติด CORS (ดูวิธีตั้ง Cloudflare Worker Proxy ในตั้งค่า/README)'
            : err.message
          : 'สร้างเสียงไม่สำเร็จ';
      failed.push({ sceneId: sc.id, error: msg });
      onProgress({ done: i + 1, total: queue.length, currentSceneId: sc.id, error: msg });
    }
  }

  return { completed, failed };
}
