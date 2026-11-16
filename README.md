# ZKatoon — สตูดิโออนิเมชันเล่าเรื่องภาษาไทย (Offline PWA)

แอปเว็บแบบ Static ทำงานบนเครื่อง 100% รองรับการใช้งานแบบออฟไลน์และติดตั้งลงหน้าจอโฮม (PWA) พร้อมระบบเขียนบท AI (OpenRouter / Custom OpenAI Endpoint), พากย์เสียง (ElevenLabs / OpenAI / Google Cloud TTS), ซิงก์คลื่นเสียงอัตโนมัติ และเรนเดอร์เป็น **MP4 (H.264 + AAC)** / **MP3**

## 1. รันบนเครื่อง (Local Development)

```bash
npm install
npm run dev -- --host
```

## 2. Build เป็น Static Web สำหรับโฮสต์ฟรี

```bash
npm run build
```

นำโฟลเดอร์ `dist/` ไปโฮสต์ได้ทันทีบน:
- **Cloudflare Pages** (Build command: `npm run build`, Output directory: `dist`)
- **Netlify** (Publish directory: `dist`)
- **GitHub Pages**

## 3. หมายเหตุเรื่อง CORS สำหรับการเรียก TTS จากเบราว์เซอร์

บริการบางตัว (เช่น OpenAI `/v1/audio/speech` หรือบาง Custom TTS Endpoint) อาจไม่อนุญาตให้เบราว์เซอร์เรียกข้ามโดเมนโดยตรง หากพบข้อผิดพลาด CORS สามารถตั้ง **Cloudflare Worker Proxy** ภายใน 1 นาทีได้ดังนี้:

```js
export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, xi-api-key',
        },
      });
    }
    const url = new URL(request.url);
    const target = 'https://api.openai.com' + url.pathname;
    const res = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });
    const out = new Response(res.body, res);
    out.headers.set('Access-Control-Allow-Origin', '*');
    return out;
  },
};
```

จากนั้นนำ URL ของ Worker (เช่น `https://tts-proxy.yourname.workers.dev/v1`) ไปใส่ในช่อง **OpenAI TTS Base URL** ในแท็บ **ตั้งค่า**
