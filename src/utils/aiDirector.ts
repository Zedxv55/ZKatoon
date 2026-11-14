import type {
  AiScriptProvider,
  CartoonProject,
  StudioSelection,
  StudioSettings,
  WorkspaceSecrets,
} from '../types/cartoon';
import { normalizeProject, parseJsonSafely } from './projectLogic';

export function buildCinematicDirectorPrompt(params: {
  selection: StudioSelection;
  topic: string;
  facts: string;
}): string {
  const { selection, topic, facts } = params;
  const { director } = selection;

  return `คุณคือผู้กำกับภาพยนตร์แอนิเมชัน 3 มิติและนักเขียนบทมืออาชีพ (ZKatoon AI Director)
หน้าที่ของคุณคือวิเคราะห์เรื่อง วางโครงสร้างบท กำหนด Production Plan, Shot List, Lighting, Character Actions และ Environment Description แล้วส่งคืนเป็น JSON ที่ตรวจสอบได้เท่านั้น (ห้ามเขียนคำอธิบายนอก JSON)

กติกา:
1. ห้ามแต่งข้อเท็จจริง ตัวเลข งานวิจัย หรือชื่อบุคคลจริงที่ผู้ใช้ไม่ได้ระบุ
2. ผู้ใช้กำหนดค่าอิสระดังนี้:
   - โหมด: ${selection.mode} | แนวเรื่อง: ${selection.genre} | ผู้ชม: ${selection.audience}
   - ความยาวรวมเป้าหมาย: ${director.targetDurationSec} วินาที | จำนวนฉากที่ต้องการ: ${director.sceneCount} ฉากพอดี
   - สไตล์ 3D: ${director.style3d} | ความละเอียด: ${director.resolution}p
   - ระดับรายละเอียดฉาก (1-5): ${director.detailLevel} | ความสมจริง (1-5): ${director.realismLevel} | ความเร็วการเคลื่อนไหว: ${director.motionSpeed}
   - จำนวนตัวละครหลัก: ${director.characterCount} ตัว | ความซับซ้อนของกล้อง (1-5): ${director.cameraComplexity} | ระดับเอฟเฟกต์ (0-5): ${director.fxLevel}
3. เลือก Camera Shot ให้เหมาะกับอารมณ์เรื่อง (เช่น establishing_wide, extreme_wide, medium, closeup, extreme_closeup, over_the_shoulder, low_angle, high_angle, birds_eye, tracking, dolly_in, dolly_out, pan, tilt, orbit, crane, pov) และเขียน shotReason อธิบายเหตุผลมุมกล้องของแต่ละฉาก
4. กำหนด 3D Animation Clip (Idle, Walk, Run, Turn, Jump, Sit, Talk, LookAround, Fear, Smile, Cry, Action) และ Environment 3D (forest_trail, riverside_sunset, cozy_living_room, neon_city_night, thai_temple, studio_stage) พร้อมสภาพอากาศ (fogDensity, windStrength, rainIntensity, dustAmount, sunRays) ให้สอดคล้องกันทั้งฉาก
5. บทพากย์ภาษาไทยใช้ "," สำหรับเว้นวรรคหายใจ และ "." เมื่อจบประโยค และกำหนดระยะเวลาเป้าหมายต่อฉากใน manualDurationSec เพื่อให้รวมกันได้ประมาณ ${director.targetDurationSec} วินาที

ส่งคืน JSON โครงสร้างนี้เท่านั้น:
{
  "title": "ชื่อเรื่อง",
  "renderEngine": "${selection.renderEngine}",
  "style3d": "${director.style3d}",
  "style": "${selection.style}",
  "layout": "${selection.layout}",
  "letterbox": { "topText": "${selection.topText}", "bottomText": "${selection.bottomText}" },
  "subtitleStyle": "${selection.subtitleStyle}",
  "hud": { "enabled": ${selection.hudEnabled}, "startText": "ข้อความ HUD สั้นๆ" },
  "cineLayer": { "enabled": ${selection.cineEnabled}, "defaultGrade": "golden_hour" },
  "music": { "mood": "warm|tense|happy|epic|sad|mystery|calm", "bpm": 92, "key": "C", "mode": "major" },
  "end": "${selection.end}",
  "productionPlan": {
    "logline": "สรุปแก่นเรื่อง 1-2 ประโยค",
    "storyStructure": [
      { "act": "Hook / เปิดเรื่อง", "summary": "..." },
      { "act": "Climax / จุดเปลี่ยน", "summary": "..." },
      { "act": "Resolution / บทสรุป", "summary": "..." }
    ],
    "environmentSummary": "บรรยากาศ โทนแสง และสภาพแวดล้อมหลัก",
    "aiNotes": "แนวทางการกำกับกล้องและการแสดง"
  },
  "characters": [
    {
      "id": "C1",
      "name": "ชื่อตัวละคร",
      "role": "บทบาท",
      "gender": "male|female|neutral",
      "age": "child|teen|adult|elder",
      "body": "slim|normal|chubby",
      "proportion3d": "stylized|chibi|realistic",
      "personality": "บุคลิก",
      "walkStyle": "normal|energetic|cautious|elder",
      "skin": "#f2c8a2",
      "hair": "#2d2420",
      "hairStyle": "short|long|bun|ponytail|curly|cap|bald",
      "shirt": "#3b82f6",
      "pants": "#334155",
      "shoes": "#1e293b",
      "outfit": "tshirt|hoodie|dress|suit|uniform|coat|apron|plaid_shirt",
      "glasses": false,
      "accessories": ["scarf"]
    }
  ],
  "scenes": [
    {
      "id": "S1",
      "title": "ชื่อฉาก",
      "storyBeat": "จังหวะเล่าเรื่องของฉากนี้",
      "narration": "บทพากย์ภาษาไทย, จังหวะหยุดสั้น, จบประโยค.",
      "subtitleEn": "Short English subtitle translation",
      "manualDurationSec": 5.5,
      "mood": "day|dusk|night|dark|room|paper",
      "bgPreset": "forest|sunset|room|city_night|shrine_hall|paper",
      "env3d": {
        "preset": "forest_trail|riverside_sunset|cozy_living_room|neon_city_night|thai_temple|studio_stage",
        "timeOfDay": "dawn|day|golden|dusk|night",
        "fogDensity": 0.25,
        "windStrength": 0.4,
        "rainIntensity": 0.0,
        "dustAmount": 0.35,
        "sunRays": 0.45,
        "treesDensity": 0.6,
        "waterRipple": false
      },
      "shotType3d": "establishing_wide|medium|closeup|tracking|dolly_in|orbit|low_angle|over_the_shoulder",
      "shotReason": "เหตุผลที่ผู้กำกับเลือกมุมกล้องนี้",
      "camera": "static|push_in|pull_out|pan_left|pan_right|tilt_up",
      "transition": "cut|fade|slide_left|zoom",
      "hudText": "ข้อความ HUD",
      "actors": [
        {
          "char": "C1",
          "x": 0.5,
          "z": 0,
          "pose": "idle|talk|walk|scared|cheer|think|sit",
          "clip3d": "Idle|Walk|Run|Turn|Jump|Sit|Talk|LookAround|Fear|Smile|Cry|Action",
          "face": "neutral|happy|sad|scared|surprised|smirk|angry|worried",
          "flip": false
        }
      ],
      "props": [{ "kind": "tree|lamp|bench|table|lantern|rock", "x": 0.25, "y": 0, "z": -1.5, "scale": 1 }],
      "card": null,
      "fx": "none|sparkles|fog|rain|dust|snow",
      "sfx": [{ "name": "wind|footstep|ding|whoosh|door|pop", "atText": "คำสำคัญในบท" }],
      "ambient": "forest|wind|rain|city|room|night_insects|none",
      "look": { "grade": "golden_hour", "keyLightDir": "left", "keyLightIntensity": 1.1 },
      "hl": ["คำสำคัญ"]
    }
  ]
}

หัวข้อเรื่องจากผู้ใช้: ${topic}
ข้อมูล/ข้อเท็จจริง/รายละเอียดเพิ่มเติมจากผู้ใช้: ${facts || 'ไม่มี'}`;
}

export async function generateDirectorPlan(params: {
  provider: AiScriptProvider;
  settings: StudioSettings;
  secrets: WorkspaceSecrets;
  selection: StudioSelection;
  topic: string;
  facts: string;
}): Promise<CartoonProject> {
  const { provider, settings, secrets, selection, topic, facts } = params;
  const prompt = buildCinematicDirectorPrompt({ selection, topic, facts });

  let rawJsonText = '';

  if (provider === 'openrouter') {
    const key = secrets.openRouterKey?.trim();
    if (!key) throw new Error('กรุณาใส่ OpenRouter API Key ในหน้า API Settings ก่อน');
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'X-Title': 'ZKatoon Studio',
      },
      body: JSON.stringify({
        model: settings.openRouterModel || 'google/gemini-2.0-flash-exp:free',
        messages: [
          { role: 'system', content: 'Output strictly valid JSON matching the requested schema. No extra text.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!resp.ok) throw new Error(data.error?.message || `OpenRouter HTTP ${resp.status}`);
    rawJsonText = data.choices?.[0]?.message?.content || '';
  } else if (provider === 'openai') {
    const key = secrets.openAiKey?.trim();
    if (!key) throw new Error('กรุณาใส่ OpenAI API Key ในหน้า API Settings ก่อน');
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: settings.openAiScriptModel || 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Output strictly valid JSON matching the requested schema.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!resp.ok) throw new Error(data.error?.message || `OpenAI HTTP ${resp.status}`);
    rawJsonText = data.choices?.[0]?.message?.content || '';
  } else if (provider === 'gemini_byok') {
    const key = secrets.geminiKey?.trim();
    if (!key) throw new Error('กรุณาใส่ Gemini API Key ของคุณในหน้า API Settings ก่อน');
    const model = settings.geminiByokModel || 'gemini-2.5-flash';
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );
    const data = (await resp.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    };
    if (!resp.ok) throw new Error(data.error?.message || `Gemini API HTTP ${resp.status}`);
    rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } else {
    // Optional local server route when running under Express dev server
    const resp = await fetch('/api/generate-script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: selection.mode,
        genre: selection.genre,
        audience: selection.audience,
        lengthSec: selection.director.targetDurationSec,
        style: selection.style,
        layout: selection.layout,
        topText: selection.topText,
        bottomText: selection.bottomText,
        subtitleStyle: selection.subtitleStyle,
        hudEnabled: selection.hudEnabled,
        cineEnabled: selection.cineEnabled,
        end: selection.end,
        topic,
        facts,
      }),
    });
    const data = (await resp.json()) as { project?: unknown; error?: string };
    if (!resp.ok || !data.project) {
      throw new Error(
        data.error ||
          'Server endpoint ไม่พร้อมใช้งาน (หากรันแบบ Static บน Vercel กรุณาเลือก OpenRouter / OpenAI / Gemini BYOK ในหน้า API Settings)'
      );
    }
    return normalizeProject(data.project, {
      style: selection.style,
      style3d: selection.style3d,
      renderEngine: selection.renderEngine,
      end: selection.end,
      layout: selection.layout,
      topText: selection.topText,
      bottomText: selection.bottomText,
      subtitleStyle: selection.subtitleStyle,
      hudEnabled: selection.hudEnabled,
      cineEnabled: selection.cineEnabled,
    });
  }

  if (!rawJsonText.trim()) {
    throw new Error('AI ไม่ได้ส่งข้อความ JSON กลับมา');
  }
  const parsed = parseJsonSafely(rawJsonText);
  return normalizeProject(parsed, {
    style: selection.style,
    style3d: selection.style3d,
    renderEngine: selection.renderEngine,
    end: selection.end,
    layout: selection.layout,
    topText: selection.topText,
    bottomText: selection.bottomText,
    subtitleStyle: selection.subtitleStyle,
    hudEnabled: selection.hudEnabled,
    cineEnabled: selection.cineEnabled,
  });
}
