# การ Deploy ZKatoon ขึ้น Vercel (Static Frontend + BYOK)

ZKatoon ออกแบบมาให้ทำงานเป็น **Static Web Application (Vite + React + Three.js + WebCodecs + IndexedDB)** ได้สมบูรณ์บน Vercel โดย **ไม่จำเป็นต้องมีฐานข้อมูล Cloud กลาง** และ **ไม่ต้องใส่ API Key กลางไว้ที่เซิร์ฟเวอร์**

---

## 1. ขั้นตอนการ Deploy ผ่าน Vercel CLI หรือ GitHub Integration

1. ตรวจสอบว่าไฟล์ `vercel.json` อยู่ใน Root ของโปรเจกต์เรียบร้อยแล้ว:
   ```json
   {
     "$schema": "https://openapi.vercel.sh/vercel.json",
     "framework": "vite",
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
2. เชื่อมต่อ Repository เข้ากับ Vercel Dashboard หรือรันคำสั่ง:
   ```bash
   npx vercel --prod
   ```
3. ตั้งค่า Build Settings บน Vercel (ค่าเริ่มต้นจาก `vercel.json`):
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

---

## 2. สิ่งที่ทำงานทันทีบน Vercel (Client-Side 100%)

- หน้าเว็บ UI ทั้ง 8 เมนูและการแสดงผล 3D Three.js / 2D Paper Sketch
- ระบบ Multi-Workspace บน IndexedDB + การเข้ารหัส API Key ด้วย PBKDF2 + AES-GCM
- การสร้างบทและแผนการผลิตผ่าน BYOK (**OpenRouter**, **OpenAI**, **Google Gemini API Key ของผู้ใช้เอง**)
- การสังเคราะห์เสียงผ่าน BYOK (**ElevenLabs**, **Azure Speech**, **Google Cloud TTS**, **OpenAI TTS**, **OpenRouter**, หรือ **Custom HTTP TTS** ที่เปิด CORS)
- การผสมเสียง (`OfflineAudioContext`) และส่งออกวิดีโอ MP4 (`WebCodecs`) / WebM Fallback / MP3 (`lamejs`)

---

## 3. ข้อจำกัดเมื่อรันแบบ Static บน Vercel

- ตัวเลือก **`Dev Server Gemini (Local Only)`** (endpoint `/api/generate-script`) ใช้ได้เฉพาะเมื่อรันเซิร์ฟเวอร์ Node/Express เต็มรูปแบบ (เช่น `npm run dev` หรือ `npm start` บน VPS/Cloud Run) — เมื่อรันแบบ Static บน Vercel ให้ผู้ใช้เลือกใช้ **OpenRouter / OpenAI / Google Gemini (BYOK)** ในเมนู **"ตั้งค่า API"** แทน
- สำหรับผู้ให้บริการ TTS ภายนอกหรือ Custom HTTP TTS: Endpoint ปลายทางต้องอนุญาต CORS (`Access-Control-Allow-Origin`) ให้เรียกจากโดเมน `.vercel.app` ของคุณได้
