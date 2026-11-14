# ZKatoon — Thai AI Voice Studio & Cinematic 3D Cartoon Production Engine

สตูดิโอสร้างการ์ตูนแอนิเมชัน 3 มิติ (Three.js / WebGL) และ 2D สมุดสเก็ตช์ (`PAPER-SKETCH`) แบบใช้งานได้ทันทีโดยไม่ต้องสมัครสมาชิก ข้อมูลโปรเจกต์ เสียงพากย์ Preset และ API Key แยกเก็บเฉพาะในเบราว์เซอร์ของผู้ใช้ (IndexedDB + Web Crypto API AES-GCM)

---

## สถาปัตยกรรมและโครงสร้างระบบ

- **Zero-Login Local-First Workspaces (`src/utils/workspaceStore.ts`, `src/utils/workspaceCrypto.ts`)**
  - รองรับหลาย Workspace แยกข้อมูล `projects`, `scene_audio`, `voice_presets`, `pronunciation_dict`, `glb_assets` และ `settings` ออกจากกันบน IndexedDB (`zkatoon_workspace_db`)
  - Device UUID แบบสุ่มในเครื่อง (`crypto.randomUUID()`) ไม่ทำ Browser Fingerprinting และไม่ส่งออกไปยังเซิร์ฟเวอร์กลาง
  - รองรับการล็อก Workspace ด้วย PIN / Passphrase ผ่าน **PBKDF2 (100,000 รอบ, SHA-256) + AES-GCM-256** สำหรับเข้ารหัส API Key
  - รองรับ Export / Import Backup (`.json` พร้อมข้อมูลเสียงรายฉาก)
- **8 เมนูหลัก (`src/components/TopBar.tsx`)**
  1. **สร้างเรื่อง (`CreateView`)**: AI Director โหมดง่ายและโหมดขั้นสูง (กำหนดเวลา ฉาก จำนวนตัวละคร ความซับซ้อนกล้อง เอฟเฟกต์) + **Production Plan Review Gate** ให้ตรวจสอบ/แก้ไขก่อนเข้าสตูดิโอ + นำเข้า `JSON / OUTPUT G`
  2. **ตัวละคร (`CharactersView`)**: ตัวละคร 3D แบบ Bone Hierarchy (`THREE.Bone` + `THREE.Skeleton` + `THREE.AnimationMixer`) หมุนตรวจสอบ 360° และนำเข้าโมเดล `.glb / .gltf` พร้อมตรวจสอบ Skeleton/Animation Clips จริง
  3. **ห้องพากย์ (`VoiceStudioView`)**: Multi-Provider Thai Voice Studio (6 Adapters) + Voice Library (ดึงรายการเสียงจริงจากผู้ให้บริการ ไม่สร้างรายชื่อปลอม) + Voice Presets + Thai Speech Preprocessor + Pronunciation Dictionary + พากย์และสร้างซ้ำรายฉากพร้อม Waveform และปุ่มรวมเสียงเข้า Timeline
  4. **กำกับฉาก (`SceneDirectorView`)**: สไตล์ภาพ 3D 10 แบบ, ฉาก 3D 6 สภาพแวดล้อม, สภาพอากาศ/หมอก/แสง/ลม, มุมกล้อง 17 แบบพร้อมเหตุผล, และคลิปท่าทาง 12 แบบ
  5. **สตูดิโอ (`StudioView`)**: เล่นและขัดไทม์ไลน์แบบ Real-time ทั้ง 3D WebGL และ 2D Paper Sketch พร้อมแยก Preview Quality vs Export Quality, ตรวจสอบสเปกเครื่อง, ส่งออก MP4 (`WebCodecs` H.264) / WebM Fallback / MP3 และ VERIFY ไฟล์จริงก่อนรายงานเสร็จ 100%
  6. **โปรเจกต์ (`ProjectsView`)**: จัดการโปรเจกต์ที่บันทึกไว้เฉพาะใน Workspace ปัจจุบัน และเลือกโฟลเดอร์บันทึกไฟล์ลงเครื่อง
  7. **คลังเครื่อง (`LocalStorageView`)**: สร้าง/สลับ/เปลี่ยนชื่อ/ลบ Workspace, ตั้งรหัสล็อก AES-GCM, ตรวจสอบโควตา IndexedDB และ Backup/Restore
  8. **ตั้งค่า API (`SettingsView`)**: จัดการ BYOK API Key (OpenRouter, OpenAI, Gemini, ElevenLabs, Azure Speech, Google Cloud TTS, Custom HTTP TTS) พร้อมทดสอบเชื่อมต่อจริง

---

## ระบบเสียงพากย์ภาษาไทย (6 TTS Provider Adapters & CORS Notice)

แต่ละผู้ให้บริการมี Adapter แยกขาดใน `src/utils/ttsAdapters.ts`:
1. **OpenRouter TTS** (`openrouter.ai`) — เรียก `chat/completions` ด้วยโมเดลที่รองรับ audio
2. **ElevenLabs** (`api.elevenlabs.io`) — รองรับโหลด Voices จริง และ `/with-timestamps` สำหรับ Phoneme Timing Lip-Sync
3. **Microsoft Azure Speech** (`*.tts.speech.microsoft.com`) — สร้าง SSML ภาษาไทย (`th-TH`) พร้อม `<prosody>` และ `<mstts:express-as>`
4. **Google Cloud Text-to-Speech** (`texttospeech.googleapis.com`) — โหลดเสียง `th-TH` จริงและสังเคราะห์ MP3
5. **OpenAI TTS** (`api.openai.com`) — รองรับ `gpt-4o-mini-tts` พร้อมคำสั่งควบคุมอารมณ์
6. **Custom HTTP TTS** — ยืดหยุ่นสำหรับการเชื่อมต่อเซิร์ฟเวอร์พากย์เสียงของคุณเอง (เช่น PyThaiTTS / Local FastAPI)

> **หมายเหตุเรื่อง CORS บนเบราว์เซอร์ (Static Hosting):**  
> เนื่องจากการเชื่อมต่อทั้งหมดยิงตรงจากเบราว์เซอร์ด้วย API Key ของผู้ใช้เอง ผู้ให้บริการบางรายหรือเซิร์ฟเวอร์ Custom HTTP ที่ไม่ได้เปิด Header `Access-Control-Allow-Origin` อาจถูกเบราว์เซอร์บล็อก CORS ได้ โดยระบบจะแจ้งสาเหตุตรงไปตรงมา (เช่น แนะนำให้ใช้ Reverse Proxy ที่เปิด CORS หรือรันเซิร์ฟเวอร์ในเครื่องที่มี CORS middleware)

---

## เครื่องยนต์แอนิเมชัน 3 มิติ (`src/engine3d/`)

- **Procedural Textures Zero-404**: สร้าง `CanvasTexture` และ `DataTexture` ในหน่วยความจำทั้งหมด
- **Bone Rig 3D (`characterRig3d.ts`)**: โครงกระดูก `hips -> spine -> chest -> neck -> head/jaw`, แขนซ้าย-ขวา, ขาซ้าย-ขวา พร้อม `AnimationMixer` รองรับ 12 คลิป (`Idle`, `Walk`, `Run`, `Turn`, `Jump`, `Sit`, `Talk`, `LookAround`, `Fear`, `Smile`, `Cry`, `Action`), กระพริบตา, หันตามสายตา และขยับปากตามเสียง (Phoneme marks หรือ Audio Envelope 20ms)
- **Software WebGL / GPU Compatibility (`ThreeSceneStage.ts`)**: ตรวจจับ SwiftShader/Software WebGL เพื่อลด Shadow/DPR และใช้ `afterDraw` (`fenceSync` + timeout cap) เพื่อไม่ให้หน้าจอค้าง

---

## การพัฒนาในเครื่อง (Local Development)

```bash
npm install
npm run dev
```

เปิดใช้งานได้ที่ `http://localhost:3000` (รองรับ Express dev server และสามารถใส่ `?autostart=1` เพื่อเปิดสตูดิโอ 3D ตัวอย่างทันที)

การรันทดสอบ Unit Tests:

```bash
npx --yes tsx --test src/utils/*.test.ts
```

การสร้าง Static Production Build:

```bash
npm run build
```
