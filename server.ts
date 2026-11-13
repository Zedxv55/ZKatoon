import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { concatWavClips } from './src/utils/wavUtils.ts';
import { normalizeProject, parseJsonSafely } from './src/utils/projectLogic.ts';
import type { CartoonEnding, CartoonLength, CartoonStyleKey } from './src/types/cartoon.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const SCENE_COUNTS: Record<number, number> = { 30: 6, 60: 9, 90: 13 };
const CHAR_BUDGETS: Record<number, number> = { 30: 380, 60: 650, 90: 980 };

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

function buildSystemInstruction(len: CartoonLength): string {
  const sceneCount = SCENE_COUNTS[len] ?? 6;
  const charBudget = CHAR_BUDGETS[len] ?? 420;
  return `คุณเป็นผู้กำกับและนักเขียนบทวิดีโอแอนิเมชันภาษาไทยแนวตั้ง 9:16
กฎสำคัญ:
1. ห้ามแต่งข้อเท็จจริง ตัวเลข สถิติ งานวิจัย หรือชื่อบุคคลจริงที่ผู้ใช้ไม่ได้ระบุ หากเป็นเรื่องแต่งหรือสมมติให้เล่าอย่างชัดเจนว่าเป็นเรื่องสมมติ
2. เขียนบทพากย์ภาษาไทยให้เป็นธรรมชาติ พูดแล้วลื่นหู มี Hook ดึงดูดความสนใจในฉากแรก (1-3 วินาทีแรก)
3. ใช้เครื่องหมายจุลภาค "," สำหรับการหยุดสั้น และมหัพภาค "." เมื่อจบประโยคหรือจบฉาก แต่ละประโยคไม่ควรยาวเกิน 60 ตัวอักษรเพื่อให้ขึ้นซับไตเติลอ่านง่ายบนมือถือ
4. จำนวนฉากต้องมี ${sceneCount} ฉากพอดี และความยาวบทพากย์รวมทุกฉากประมาณ ${charBudget} ตัวอักษร
5. ฉากสุดท้ายต้องมี card ที่ type เป็น "end" เพื่อสรุปหรือชวนติดตามตามรูปแบบการจบที่เลือก
6. ออกแบบตัวละคร 1-3 ตัวที่มีสีผิว ทรงผม และสีเสื้อต่างกันชัดเจน ตำแหน่ง x ของตัวละครอยู่ระหว่าง 0.2 ถึง 0.8 และมีตัวละครในแต่ละฉากไม่เกิน 2 ตัว
7. สลับฉากที่มีการ์ดข้อมูล (text, bignumber, list) กับฉากสนทนาของตัวละครเพื่อความน่าสนใจ โดยตัวเลขในการ์ดต้องมาจากบทหรือข้อมูลผู้ใช้เท่านั้น`;
}

function getFriendlyGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return {
      status: 403,
      message: 'API Key ของ Gemini ยังไม่พร้อมใช้งานหรือไม่มีสิทธิ์ กรุณาตรวจสอบใน Settings > Secrets',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'ขณะนี้มีการใช้งานเกินโควตาชั่วคราว กรุณารอสักครู่แล้วลองใหม่อีกครั้ง',
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    const aiReady = Boolean(process.env.GEMINI_API_KEY?.trim());
    res.json({
      ok: true,
      aiReady,
      models: {
        script: 'gemini-4-hydrogen',
        tts: 'gemini-3.8-flash-lite-tts',
      },
    });
  });

  app.post('/api/generate-script', async (req, res) => {
    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตั้งค่าใน Settings > Secrets',
      });
      return;
    }

    const body = req.body as {
      mode?: string;
      genre?: string;
      lengthSec?: number;
      style?: CartoonStyleKey;
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
      body.lengthSec === 60 || body.lengthSec === 90 ? body.lengthSec : 30;
    const style: CartoonStyleKey = body.style || 'night';
    const end: CartoonEnding = body.end || 'summary';

    const userPrompt = `โหมด: ${body.mode || 'story'}
แนวเรื่อง: ${body.genre || 'ให้ความรู้'}
ความยาวเป้าหมาย: ${len} วินาที
รูปแบบการจบ: ${end}
หัวข้อ: ${topic}
ข้อเท็จจริง/ตัวเลข/ข้อห้ามจากผู้ใช้: ${String(body.facts || '').trim() || 'ไม่มี'}`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction: buildSystemInstruction(len),
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
                    hairStyle: { type: Type.STRING, enum: ['short', 'long', 'bun'] },
                    shirt: { type: Type.STRING },
                    glasses: { type: Type.BOOLEAN },
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
                    mood: { type: Type.STRING, enum: ['day', 'dusk', 'night', 'dark', 'room'] },
                    actors: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          char: { type: Type.STRING },
                          x: { type: Type.NUMBER },
                          pose: {
                            type: Type.STRING,
                            enum: ['idle', 'talk', 'scared', 'cheer', 'think', 'walk'],
                          },
                          face: {
                            type: Type.STRING,
                            enum: [
                              'happy',
                              'sad',
                              'scared',
                              'surprised',
                              'neutral',
                              'smirk',
                              'angry',
                            ],
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
                        type: { type: Type.STRING, enum: ['text', 'bignumber', 'list', 'end'] },
                        text: { type: Type.STRING },
                        label: { type: Type.STRING },
                        items: { type: Type.ARRAY, items: { type: Type.STRING } },
                        badge: { type: Type.STRING },
                        at: { type: Type.STRING },
                      },
                      required: ['type', 'text'],
                    },
                    fx: { type: Type.STRING, enum: ['none', 'rain', 'snow', 'sparkles', 'fog'] },
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
      const project = normalizeProject(parsed, { style, end });
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
        error: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์ กรุณาตั้งค่าใน Settings > Secrets',
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
        // Synthesize in batches of 2 to keep speed high while staying gentle on rate limits
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
