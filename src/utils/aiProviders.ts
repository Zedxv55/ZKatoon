import type {
  CartoonAudience,
  CartoonEnding,
  CartoonLength,
  CartoonProject,
  CartoonStyleKey,
  OpenRouterModelInfo,
  PyThaiModelType,
  StudioSelection,
} from '../types/cartoon';
import { normalizeProject, parseJsonSafely } from './projectLogic';

const SESSION_OR_KEY = 'acs_openrouter_key_session';
const LOCAL_OR_KEY = 'acs_openrouter_key_local';
const SESSION_CUSTOM_TTS_KEY = 'acs_custom_tts_key_session';

export function getSavedOpenRouterKey(): string {
  try {
    return (
      window.sessionStorage.getItem(SESSION_OR_KEY) ||
      window.localStorage.getItem(LOCAL_OR_KEY) ||
      ''
    );
  } catch {
    return '';
  }
}

export function saveOpenRouterKey(key: string, rememberOnDevice: boolean): void {
  const trimmed = key.trim();
  try {
    if (!trimmed) {
      window.sessionStorage.removeItem(SESSION_OR_KEY);
      window.localStorage.removeItem(LOCAL_OR_KEY);
      return;
    }
    window.sessionStorage.setItem(SESSION_OR_KEY, trimmed);
    if (rememberOnDevice) {
      window.localStorage.setItem(LOCAL_OR_KEY, trimmed);
    } else {
      window.localStorage.removeItem(LOCAL_OR_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearOpenRouterKey(): void {
  try {
    window.sessionStorage.removeItem(SESSION_OR_KEY);
    window.localStorage.removeItem(LOCAL_OR_KEY);
  } catch {
    // ignore
  }
}

export function getSavedCustomTtsKey(): string {
  try {
    return window.sessionStorage.getItem(SESSION_CUSTOM_TTS_KEY) || '';
  } catch {
    return '';
  }
}

export function saveCustomTtsKey(key: string): void {
  try {
    if (key.trim()) {
      window.sessionStorage.setItem(SESSION_CUSTOM_TTS_KEY, key.trim());
    } else {
      window.sessionStorage.removeItem(SESSION_CUSTOM_TTS_KEY);
    }
  } catch {
    // ignore
  }
}

export async function verifyOpenRouterKey(apiKey: string): Promise<{
  ok: boolean;
  label?: string;
  limitRemaining?: number | null;
  error?: string;
}> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, error: 'กรุณากรอก API Key ของ OpenRouter' };
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/key', {
      headers: {
        Authorization: `Bearer ${trimmed}`,
      },
    });
    const data = (await resp.json()) as {
      data?: { label?: string; limit_remaining?: number | null };
      error?: { message?: string };
    };
    if (!resp.ok) {
      return { ok: false, error: data.error?.message || `HTTP ${resp.status}` };
    }
    return {
      ok: true,
      label: data.data?.label || 'OpenRouter Key ใช้งานได้',
      limitRemaining: data.data?.limit_remaining ?? null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'เชื่อมต่อ OpenRouter ไม่สำเร็จ' };
  }
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModelInfo[]> {
  const resp = await fetch('https://openrouter.ai/api/v1/models');
  if (!resp.ok) {
    throw new Error(`โหลดรายชื่อโมเดล OpenRouter ไม่สำเร็จ (HTTP ${resp.status})`);
  }
  const payload = (await resp.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
    }>;
  };
  const list = (payload.data || []).map((m) => {
    const promptCost = Number(m.pricing?.prompt ?? '1');
    const isFree = m.id.endsWith(':free') || (promptCost === 0 && Number(m.pricing?.completion ?? '1') === 0);
    return {
      id: m.id,
      name: m.name || m.id,
      isFree,
      contextLength: m.context_length,
      promptPrice: m.pricing?.prompt,
    };
  });

  // Sort free models first, then popular chat models
  return list.sort((a, b) => Number(b.isFree) - Number(a.isFree));
}

export function buildDirectorPromptText(params: {
  selection: StudioSelection;
  topic: string;
  facts: string;
}): string {
  const { selection, topic, facts } = params;
  const sceneMap: Record<CartoonLength, number> = { 30: 6, 60: 9, 90: 13, 150: 16 };
  const audienceLabel: Record<CartoonAudience, string> = {
    general: 'คนทั่วไป',
    kids: 'เด็กและนักเรียน',
    worker: 'วัยทำงาน',
  };

  return `คุณคือผู้กำกับและนักเขียนบทวิดีโอแอนิเมชันภาษาไทย (ตอบเป็น JSON ตามโครงสร้าง OUTPUT G เท่านั้น ห้ามใส่ข้อความอธิบายนอก JSON)
กติกาเข้มงวด:
1. ห้ามแต่งข้อเท็จจริง ตัวเลข งานวิจัย หรือชื่อบุคคลจริงที่ผู้ใช้ไม่ได้ให้มา
2. โหมด: ${selection.mode}, แนวเรื่อง: ${selection.genre}, ผู้ชม: ${audienceLabel[selection.audience]}
3. ความยาวเป้าหมาย: ${selection.len} วินาที (~${sceneMap[selection.len] || 6} ฉาก), สไตล์: ${selection.style}, เค้าโครง: ${selection.layout}
4. รูปแบบซับไตเติล: ${selection.subtitleStyle}, HUD มุมบน: ${selection.hudEnabled ? 'เปิด' : 'ปิด'}, จบแบบ: ${selection.end}
5. ใช้ "," สำหรับจังหวะหยุดสั้น และ "." เมื่อจบประโยคเพื่อซิงก์ซับไตเติลทีละท่อน
6. ถ้าสไตล์เป็น "paper" (PAPER-SKETCH) หรือมีแชต ให้ใช้ card type "phone_mockup" พร้อม messages[] หรือ "bignumber" / "list" สลับกับตัวละคร และใส่ subtitleEn เป็นคำแปลภาษาอังกฤษสั้นๆ ในทุกฉากด้วย
7. ให้ส่งคืน JSON โครงสร้าง:
{
  "title": "ชื่อเรื่อง",
  "style": "${selection.style}",
  "layout": "${selection.layout}",
  "letterbox": { "topText": "${selection.topText}", "bottomText": "${selection.bottomText}" },
  "subtitleStyle": "${selection.subtitleStyle}",
  "hud": { "enabled": ${selection.hudEnabled}, "startText": "ข้อความบน HUD" },
  "cineLayer": { "enabled": ${selection.cineEnabled}, "defaultGrade": "neutral_day" },
  "music": { "mood": "warm", "bpm": 88, "key": "C", "mode": "major" },
  "end": "${selection.end}",
  "characters": [
    { "id": "C1", "name": "ชื่อ", "skin": "#f2c8a2", "hair": "#3a312c", "hairStyle": "short|long|bun|ponytail|curly|cap|bald", "shirt": "#69825c", "outfit": "tshirt|hoodie|dress|suit|uniform|coat|apron|plaid_shirt", "glasses": true, "accessories": ["flower_hat", "scarf"] }
  ],
  "scenes": [
    {
      "narration": "บทพากย์ภาษาไทย, แบ่งท่อนด้วยจุลภาค.",
      "subtitleEn": "Optional short English translation line",
      "mood": "paper|day|dusk|night|dark|room",
      "bgPreset": "paper|room|city_night|street_day|rural_night_field|shrine_hall",
      "hudText": "ข้อความบน HUD ของฉากนี้",
      "camera": "static|push_in|pull_out|pan_left|pan_right",
      "actors": [{ "char": "C1", "x": 0.5, "pose": "idle|talk|scared|cheer|think|walk|sit|hold_flower", "face": "happy|sad|scared|surprised|neutral|smirk|angry|worried", "flip": false }],
      "card": { "type": "bignumber|text|list|phone_mockup|bar_chart|compare|checklist|end", "text": "...", "label": "...", "items": [], "chatTitle": "...", "messages": [{"sender":"...", "text":"..."}], "atText": "คำในบท" },
      "fx": "none|sparkles|fog|rain|snow",
      "sfx": [{ "name": "ding|pop|paper|click|whoosh|door|sparkle", "atText": "คำในบท" }],
      "hl": ["คำเน้นสี"]
    }
  ]
}

หัวข้อเรื่อง: ${topic}
ข้อมูล/ข้อเท็จจริง/ข้อห้ามจากผู้ใช้: ${facts || 'ไม่มี'}`;
}

export async function generateScriptViaOpenRouter(params: {
  apiKey: string;
  model: string;
  selection: StudioSelection;
  topic: string;
  facts: string;
}): Promise<CartoonProject> {
  const prompt = buildDirectorPromptText(params);
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey.trim()}`,
      'X-Title': 'AI Cartoon Studio',
    },
    body: JSON.stringify({
      model: params.model,
      messages: [
        { role: 'system', content: 'You output strict valid JSON only, no markdown commentary.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!resp.ok) {
    throw new Error(data.error?.message || `OpenRouter HTTP ${resp.status}`);
  }
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenRouter ไม่ได้ส่งข้อความบทการ์ตูนกลับมา');
  }

  const parsed = parseJsonSafely(content);
  return normalizeProject(parsed, {
    style: params.selection.style as CartoonStyleKey,
    end: params.selection.end as CartoonEnding,
    layout: params.selection.layout,
    topText: params.selection.topText,
    bottomText: params.selection.bottomText,
    subtitleStyle: params.selection.subtitleStyle,
    hudEnabled: params.selection.hudEnabled,
    cineEnabled: params.selection.cineEnabled,
  });
}

export const PYTHAI_SERVER_SNIPPET = `# ติดตั้ง PyThaiTTS (https://github.com/PyThaiNLP/PyThaiTTS) + FastAPI
pip install fastapi uvicorn pythaitts torch

# สร้างไฟล์ pythai_server.py แล้วรันด้วย: uvicorn pythai_server:app --host 0.0.0.0 --port 8000
from fastapi import FastAPI
from fastapi.responses import Response
from pydantic import BaseModel
from pythaitts import TTS

app = FastAPI()
tts = TTS(pretrained="khanomtan")  # หรือ "lunar" / "mms"

class TTSReq(BaseModel):
    text: str
    speaker: str = "default"
    model: str = "khanomtan"

@app.post("/tts")
def synthesize(req: TTSReq):
    wav_bytes = tts.tts(req.text, speaker_idx=req.speaker, return_type="wav")
    return Response(content=wav_bytes, media_type="audio/wav")`;

export async function testPyThaiTtsConnection(
  endpoint: string,
  model: PyThaiModelType,
  speaker: string
): Promise<{ ok: boolean; detail: string; audioBase64?: string }> {
  const resp = await fetch('/api/tts-pythai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'สวัสดีครับ ทดสอบเสียงภาษาไทยจาก PyThaiTTS',
      endpoint,
      model,
      speaker,
    }),
  });
  const data = (await resp.json()) as { audioBase64?: string; error?: string };
  if (!resp.ok || !data.audioBase64) {
    return { ok: false, detail: data.error || `HTTP ${resp.status}` };
  }
  return {
    ok: true,
    detail: `เชื่อมต่อ PyThaiTTS สำเร็จ (${model})`,
    audioBase64: data.audioBase64,
  };
}
