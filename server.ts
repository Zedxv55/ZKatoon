import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { concatWavClips } from './src/utils/wavUtils.ts';
import { normalizeProject, parseJsonSafely } from './src/utils/projectLogic.ts';
import { registerPlatformRoutes } from './server/routes.ts';
import type {
  CartoonEnding,
  CartoonLength,
  CartoonStyleKey,
  SubtitleStyle,
  VideoLayoutMode,
} from './src/types/cartoon.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SCENE_COUNTS: Record<number, number> = { 30: 6, 60: 9, 90: 13, 150: 16 };
const CHAR_BUDGETS: Record<number, number> = { 30: 380, 60: 650, 90: 980, 150: 1400 };

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function buildSystemInstruction(
  len: CartoonLength,
  style: CartoonStyleKey,
  layout: VideoLayoutMode,
  subtitleStyle: SubtitleStyle
): string {
  const sceneCount = SCENE_COUNTS[len] ?? 6;
  const charBudget = CHAR_BUDGETS[len] ?? 420;
  return `คุณคือผู้กำกับและนักเขียนบทวิดีโอแอนิเมชันภาษาไทย (รองรับทั้ง 9:16 และแถบกลาง 16:9)
กฎสำคัญ:
1. ห้ามแต่งข้อเท็จจริง ตัวเลข สถิติ งานวิจัย หรือชื่อบุคคลจริงที่ผู้ใช้ไม่ได้ระบุ หากเป็นเรื่องแต่งให้เล่าชัดเจนว่าเป็นเรื่องสมมติ
2. เขียนบทพากย์ภาษาไทยเป็นธรรมชาติ มี Hook ในฉากแรก 1-3 วินาทีแรก
3. ใช้ "," สำหรับจังหวะหยุดสั้น และ "." เมื่อจบประโยค เพื่อซิงก์คำบรรยายทีละท่อน
4. จำนวนฉากต้องมี ${sceneCount} ฉากพอดี และความยาวบทพากย์รวมทุกฉากประมาณ ${charBudget} ตัวอักษร
5. ฉากสุดท้ายต้องมี card type "end" สรุปหรือชวนติดตามตามรูปแบบจบที่เลือก
6. ออกแบบตัวละคร 1-4 ตัว สีผิว ทรงผม เสื้อผ้า และเครื่องประดับ (เช่น flower_hat, glasses, scarf) ชัดเจน ตำแหน่ง x ระหว่าง 0.15 ถึง 0.85
7. สลับการ์ดข้อมูล (bignumber, list, text, bar_chart, compare, phone_mockup) กับฉากตัวละครอย่างลงตัว โดยตัวเลขต้องมาจากข้อมูลผู้ใช้เท่านั้น
8. สไตล์ปัจจุบันคือ "${style}", เค้าโครง "${layout}", รูปแบบซับไตเติล "${subtitleStyle}":
   - ถ้าสไตล์เป็น "paper" (สมุดสเก็ตช์) หรือซับไตเติลเป็น "sticker_dual": ให้ใส่ subtitleEn (แปลอังกฤษสั้นกระชับ 1 ประโยคต่อฉาก) และ hudText สั้นๆ (เช่น "จันทร์ · 06:00", "บ้านเรา 7 คน") และใช้ card type "phone_mockup" พร้อม messages[] เมื่อเล่าเรื่องแชต/มือถือ`;
}

function getFriendlyGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return {
      status: 403,
      message: 'API Key ของ Gemini ยังไม่พร้อมใช้งานหรือไม่มีสิทธิ์ (คุณสามารถเปลี่ยนไปใช้ OpenRouter Key ของตัวเองในหน้าตั้งค่าได้)',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'โควตา Gemini เต็มชั่วคราว — สามารถรอสักครู่ หรือสลับไปใช้ OpenRouter Key ของคุณเองในหน้าตั้งค่าได้ทันที',
    };
  }
  return {
    status: 500,
    message: msg || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับบริการ AI',
  };
}

async function synthesizeClip(
  ai: GoogleGenAI,
  text: string,
  voiceName: string,
  stylePrompt: string
): Promise<Uint8Array> {
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text,
            speechMetadata: {
              style: stylePrompt || 'พูดภาษาไทยอย่างเป็นธรรมชาติ ชัดเจน น่าฟัง',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('ระบบไม่ได้ส่งข้อมูลเสียงกลับมา');
  }
  return new Uint8Array(Buffer.from(base64Audio, 'base64'));
}

async function callPyThaiEndpoint(
  endpoint: string,
  text: string,
  model: string,
  speaker: string
): Promise<Uint8Array> {
  const cleanBase = endpoint.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(cleanBase)) {
    throw new Error('URL ของ PyThaiTTS ต้องขึ้นต้นด้วย http:// หรือ https://');
  }

  // Support both `/tts` direct route or full URL if user pasted `/tts` or `/synthesize`
  const targetUrl =
    /\/(tts|synthesize|api\/tts)$/i.test(cleanBase) ? cleanBase : `${cleanBase}/tts`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model, speaker }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`PyThaiTTS ตอบกลับ HTTP ${resp.status}${errText ? `: ${errText.slice(0, 120)}` : ''}`);
    }
    const contentType = resp.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = (await resp.json()) as { audioBase64?: string; audio?: string };
      const b64 = json.audioBase64 || json.audio;
      if (!b64) throw new Error('PyThaiTTS JSON ไม่มีฟิลด์ audioBase64');
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
    const arr = await resp.arrayBuffer();
    return new Uint8Array(arr);
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
  app.use((req, res, next) => {
    if (req.path === '/api/payments/webhook') return next();
    return express.json({ limit: '25mb' })(req, res, next);
  });

  app.get('/api/health', (_req, res) => {
    const aiReady = Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
    res.json({
      ok: true,
      aiReady,
      storageMode: 'local-server-store',
      models: {
        script: 'gemini-4-hydrogen',
        tts: 'gemini-3.8-flash-lite-tts',
        defaultBrain: 'nvidia/nemotron-3.5-super-vl:free',
        defaultVoice: 'fish-audio/s2.1-pro-free:free',
      },
    });
  });

  registerPlatformRoutes(app);

  app.post('/api/generate-script', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ (สามารถสลับไปใช้ OpenRouter Key ในหน้าตั้งค่าได้)',
      });
      return;
    }

    const body = req.body as {
      mode?: string;
      genre?: string;
      audience?: string;
      lengthSec?: number;
      style?: CartoonStyleKey;
      layout?: VideoLayoutMode;
      topText?: string;
      bottomText?: string;
      subtitleStyle?: SubtitleStyle;
      hudEnabled?: boolean;
      cineEnabled?: boolean;
      end?: CartoonEnding;
      topic?: string;
      facts?: string;
    };

    const topic = String(body.topic || '').trim();
    if (!topic) {
      res.status(400).json({ error: 'กรุณาระบุหัวข้อเรื่องก่อนสร้างบทการ์ตูน' });
      return;
    }

    const len: CartoonLength =
      body.lengthSec === 60 || body.lengthSec === 90 || body.lengthSec === 150 ? body.lengthSec : 30;
    const style: CartoonStyleKey = body.style || 'paper';
    const layout: VideoLayoutMode = body.layout || 'full';
    const subtitleStyle: SubtitleStyle = body.subtitleStyle || (style === 'paper' ? 'sticker_dual' : 'yellow_text');
    const end: CartoonEnding = body.end || 'summary';

    const userPrompt = `โหมด: ${body.mode || 'story'}
แนวเรื่อง: ${body.genre || 'ให้ความรู้'}
ผู้ชมเป้าหมาย: ${body.audience || 'general'}
ความยาวเป้าหมาย: ${len} วินาที
รูปแบบการจบ: ${end}
หัวข้อ: ${topic}
ข้อเท็จจริง/ตัวเลข/ข้อห้ามจากผู้ใช้: ${String(body.facts || '').trim() || 'ไม่มี'}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction: buildSystemInstruction(len, style, layout, subtitleStyle),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              characters: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    name: { type: Type.STRING },
                    skin: { type: Type.STRING },
                    hair: { type: Type.STRING },
                    hairStyle: {
                      type: Type.STRING,
                      enum: ['short', 'long', 'bun', 'ponytail', 'curly', 'cap', 'bald'],
                    },
                    shirt: { type: Type.STRING },
                    outfit: {
                      type: Type.STRING,
                      enum: ['tshirt', 'hoodie', 'dress', 'suit', 'uniform', 'coat', 'apron', 'plaid_shirt'],
                    },
                    glasses: { type: Type.BOOLEAN },
                    accessories: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['id', 'name', 'skin', 'hair', 'hairStyle', 'shirt', 'glasses'],
                },
              },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    narration: { type: Type.STRING },
                    subtitleEn: { type: Type.STRING },
                    hudText: { type: Type.STRING },
                    mood: { type: Type.STRING, enum: ['paper', 'day', 'dusk', 'night', 'dark', 'room'] },
                    bgPreset: { type: Type.STRING },
                    camera: {
                      type: Type.STRING,
                      enum: ['static', 'push_in', 'pull_out', 'pan_left', 'pan_right', 'tilt_up', 'shake'],
                    },
                    actors: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          char: { type: Type.STRING },
                          x: { type: Type.NUMBER },
                          pose: {
                            type: Type.STRING,
                            enum: ['idle', 'talk', 'scared', 'cheer', 'think', 'walk', 'sit', 'hold_flower'],
                          },
                          face: {
                            type: Type.STRING,
                            enum: ['happy', 'sad', 'scared', 'surprised', 'neutral', 'smirk', 'angry', 'worried'],
                          },
                          flip: { type: Type.BOOLEAN },
                        },
                        required: ['char', 'x', 'pose', 'face', 'flip'],
                      },
                    },
                    card: {
                      type: Type.OBJECT,
                      nullable: true,
                      properties: {
                        type: {
                          type: Type.STRING,
                          enum: ['text', 'bignumber', 'list', 'compare', 'bar_chart', 'checklist', 'phone_mockup', 'end'],
                        },
                        text: { type: Type.STRING },
                        label: { type: Type.STRING },
                        items: { type: Type.ARRAY, items: { type: Type.STRING } },
                        badge: { type: Type.STRING },
                        at: { type: Type.STRING },
                        chatTitle: { type: Type.STRING },
                        typingText: { type: Type.STRING },
                        messages: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              sender: { type: Type.STRING },
                              text: { type: Type.STRING },
                              mine: { type: Type.BOOLEAN },
                              system: { type: Type.BOOLEAN },
                            },
                            required: ['text'],
                          },
                        },
                      },
                      required: ['type', 'text'],
                    },
                    fx: { type: Type.STRING, enum: ['none', 'rain', 'snow', 'sparkles', 'fog', 'dust', 'flicker'] },
                    hl: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: ['narration', 'mood', 'actors', 'fx', 'hl'],
                },
              },
            },
            required: ['title', 'characters', 'scenes'],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = parseJsonSafely(rawText);
      const project = normalizeProject(parsed, {
        style,
        end,
        layout,
        topText: body.topText,
        bottomText: body.bottomText,
        subtitleStyle,
        hudEnabled: body.hudEnabled,
        cineEnabled: body.cineEnabled,
      });
      res.json({ project });
    } catch (err) {
      const { status, message } = getFriendlyGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  app.post('/api/generate-tts', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ (สามารถเปลี่ยนเป็น PyThaiTTS หรือ TTS อื่นในหน้าตั้งค่าได้)',
      });
      return;
    }

    const body = req.body as {
      text?: string;
      scenes?: string[];
      voiceName?: string;
      stylePrompt?: string;
    };

    const voiceName = String(body.voiceName || 'Kore');
    const stylePrompt = String(
      body.stylePrompt || 'พูดภาษาไทยเป็นธรรมชาติ มีจังหวะหยุดเว้นวรรคชัดเจน น่าฟัง'
    );

    try {
      if (Array.isArray(body.scenes) && body.scenes.length > 0) {
        const cleanScenes = body.scenes.map((s) => String(s || '').trim() || '...');
        const clips: Uint8Array[] = new Array(cleanScenes.length);
        for (let i = 0; i < cleanScenes.length; i += 2) {
          const batch = cleanScenes.slice(i, i + 2).map(async (line, offset) => {
            clips[i + offset] = await synthesizeClip(ai, line, voiceName, stylePrompt);
          });
          await Promise.all(batch);
        }

        const { wavBuffer, sceneDurations } = concatWavClips(clips, 0.2, 24000);
        res.json({
          audioBase64: Buffer.from(wavBuffer).toString('base64'),
          mimeType: 'audio/wav',
          sampleRate: 24000,
          sceneDurations,
        });
        return;
      }

      const text = String(body.text || '').trim();
      if (!text) {
        res.status(400).json({ error: 'ไม่มีข้อความสำหรับสร้างเสียงพากย์' });
        return;
      }

      const clip = await synthesizeClip(ai, text, voiceName, stylePrompt);
      res.json({
        audioBase64: Buffer.from(clip).toString('base64'),
        mimeType: 'audio/wav',
        sampleRate: 24000,
      });
    } catch (err) {
      const { status, message } = getFriendlyGeminiError(err);
      res.status(status).json({ error: message });
    }
  });

  // PyThaiTTS HTTP server bridge (https://github.com/PyThaiNLP/PyThaiTTS)
  app.post('/api/tts-pythai', async (req, res) => {
    const body = req.body as {
      text?: string;
      scenes?: string[];
      endpoint?: string;
      model?: string;
      speaker?: string;
    };

    const endpoint = String(body.endpoint || '').trim();
    if (!endpoint) {
      res.status(400).json({ error: 'กรุณาระบุ Endpoint URL ของเซิร์ฟเวอร์ PyThaiTTS ก่อน' });
      return;
    }

    const model = String(body.model || 'khanomtan');
    const speaker = String(body.speaker || 'default');

    try {
      if (Array.isArray(body.scenes) && body.scenes.length > 0) {
        const cleanScenes = body.scenes.map((s) => String(s || '').trim() || '...');
        const clips: Uint8Array[] = [];
        for (const line of cleanScenes) {
          clips.push(await callPyThaiEndpoint(endpoint, line, model, speaker));
        }
        const { wavBuffer, sceneDurations } = concatWavClips(clips, 0.2, 22050);
        res.json({
          audioBase64: Buffer.from(wavBuffer).toString('base64'),
          mimeType: 'audio/wav',
          sampleRate: 22050,
          sceneDurations,
        });
        return;
      }

      const text = String(body.text || '').trim();
      if (!text) {
        res.status(400).json({ error: 'ไม่มีข้อความสำหรับสังเคราะห์เสียง PyThaiTTS' });
        return;
      }

      const clip = await callPyThaiEndpoint(endpoint, text, model, speaker);
      res.json({
        audioBase64: Buffer.from(clip).toString('base64'),
        mimeType: 'audio/wav',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        error: `ไม่สามารถเชื่อมต่อ PyThaiTTS (${endpoint}): ${msg} — ตรวจสอบว่าได้รันเซิร์ฟเวอร์ Python PyThaiTTS อยู่และเข้าถึงได้`,
      });
    }
  });

  // Custom OpenAI-compatible /audio/speech proxy
  app.post('/api/tts-custom', async (req, res) => {
    const body = req.body as {
      endpoint?: string;
      apiKey?: string;
      model?: string;
      voice?: string;
      text?: string;
      scenes?: string[];
    };
    const endpoint = String(body.endpoint || '').trim();
    const apiKey = String(body.apiKey || '').trim();
    if (!endpoint || !apiKey) {
      res.status(400).json({ error: 'กรุณาระบุ Endpoint URL และ API Key ของ TTS ภายนอกให้ครบ' });
      return;
    }

    try {
      const fullText = Array.isArray(body.scenes) && body.scenes.length > 0
        ? body.scenes.join(' ')
        : String(body.text || '').trim();
      if (!fullText) {
        res.status(400).json({ error: 'ไม่มีข้อความสำหรับสร้างเสียง' });
        return;
      }

      const url = endpoint.endsWith('/audio/speech')
        ? endpoint
        : `${endpoint.replace(/\/+$/, '')}/audio/speech`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: body.model || 'tts-1',
          input: fullText,
          voice: body.voice || 'alloy',
          response_format: 'mp3',
        }),
      });
      if (!resp.ok) {
        const t = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status} ${t.slice(0, 120)}`);
      }
      const arr = await resp.arrayBuffer();
      res.json({
        audioBase64: Buffer.from(arr).toString('base64'),
        mimeType: 'audio/mpeg',
      });
    } catch (err) {
      res.status(502).json({
        error: `เชื่อมต่อ Custom TTS ไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Cartoon Studio server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
