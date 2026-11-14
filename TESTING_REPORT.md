# รายงานการตรวจสอบและทดสอบระบบ (ZKatoon Testing Report)

รายงานฉบับนี้บันทึกเฉพาะผลการทดสอบจริงที่ได้รันและสังเกตผลลัพธ์ในสภาพแวดล้อมนี้ (Node.js + TypeScript + Vite Build + Headless Chromium Playwright บน SwiftShader Software WebGL)

---

## 1. การทดสอบ Unit Tests (Pure Logic — Node Test Runner)

คำสั่งที่ใช้รัน:
```bash
npx --yes tsx --test src/utils/*.test.ts
```

ผลการรันหลังการแก้ไขโค้ดครั้งล่าสุด: **ผ่านทั้งหมด 15/15 ข้อ (0 ล้มเหลว, Exit Code 0)**

- `src/utils/projectLogic.test.ts` (7 tests)
  - `mapStyleKey` แปลงรหัสสไตล์พรีเซ็ต (`PAPER-SKETCH` ฯลฯ) ได้ถูกต้อง
  - `normalizeProject` แปลงทั้ง JSON รูปแบบ `OUTPUT G (G1/G2/G4)` และโปรเจกต์มาตรฐาน
  - `computeAudioEnvelope` ตรวจจับช่วงเสียงพูดและช่วงหยุดหายใจ `>= 220ms` (`pauseCandidates`)
  - `buildTimeline` จัดจุดตัดฉากตรงกับ `pauseCandidates` แบบเรียงลำดับเวลาและรองรับ manual offset
  - `resolveAtTextLocalTime` ค้นหาคำสำคัญและ snap เข้าจังหวะหยุดหายใจภายใน ±0.4 วินาที
  - `parseJsonSafely` ตัด markdown code fence ออกอย่างถูกต้อง
  - `getSubtitleState` แบ่งประโยคซับไตเติลและคำนวณตำแหน่งไฮไลต์คำ
- `src/utils/thaiSpeech.test.ts` (4 tests)
  - `prepareThaiSpeechText` แปลงคำอ่านจากพจนานุกรมกำหนดเองและแปลงตัวเลขไทย
  - `integerToThaiWords` และ `numberStringToThaiWords` อ่านเลขจำนวนเต็มและทศนิยมเป็นคำไทย
  - `splitThaiDialogueSentences` แบ่งประโยคบทสนทนาภาษาไทย
  - `buildAzureSsml` ทำ XML escaping และห่อ `<voice>` + `<prosody rate>` สำหรับ Azure Speech
- `src/utils/wavUtils.test.ts` (2 tests)
  - `buildWavHeader` สร้าง RIFF/WAVE header สมบูรณ์
  - `concatWavClips` รวมคลิปเสียงพร้อมช่วงเงียบคั่นฉากและคำนวณความยาวรวมถูกต้อง
- `src/utils/workspaceCrypto.test.ts` (2 tests)
  - `generateUuid` สร้าง UUID รูปแบบ v4 ที่ไม่ซ้ำ
  - ทดสอบ Web Crypto API PBKDF2 + AES-256-GCM เข้ารหัส/ถอดรหัสและตรวจสอบรหัสผ่านแบบ round-trip

---

## 2. การทดสอบ Build & TypeScript Typecheck

- `npm run lint` (`tsc --noEmit`): **ผ่าน (0 errors)**
- `npm run build` (`vite build`): **ผ่าน (Build succeeded)**

---

## 3. การทดสอบบนเบราว์เซอร์จริง (Playwright Headless Chromium)

สภาพแวดล้อมที่รัน: `http://localhost:3000/?autostart=1` (Hot-restart dev server, CPU SwiftShader Software WebGL)  
ขนาดหน้าจอที่ทดสอบ: Desktop `1440×900` และ Mobile `390×844`

### ผลการทดสอบที่ผ่านและสังเกตเห็นจริง
1. **Console & Runtime Errors**: **0 Errors, 0 Warnings** ในทุกหน้าและทุกขั้นตอนที่ทดสอบ
2. **ตรวจจับสเปกเครื่องอัตโนมัติ (`probeHardwareCapabilities`)**:
   - ระบบตรวจจับ `GPU: Software WebGL` บน headless Chromium ได้ถูกต้อง และตั้งค่า `Preview Quality` เป็น `Low (ลื่นสุด)` อัตโนมัติ พร้อมแยกตัวเลือก `Export Quality` อิสระ
3. **3D Studio Playback & Scene Transitions (`r1`, `r2-motion.webm`)**:
   - เปิด `?autostart=1` แสดงโปรเจกต์ตัวอย่าง **"คืนโคมไฟริมน้ำ"** (`3D WebGL Engine`, 5 ฉาก, ความยาว `0:29`)
   - ที่เวลา `t = 0:00` แสดงฉาก `S1: พลบค่ำริมแม่น้ำ` (`establishing_wide`) อย่างถูกต้อง (คุณปู่นั่งริมน้ำ, โคมไฟ, ต้นไม้, ผิวน้ำสะท้อน, ซับไตเติลภาษาไทย)
   - กดปุ่ม `S2` สลับไปฉาก `S2: เดินผ่านแนวป่า` (`tracking`) และตัวละครเดินบนทางเดินป่าได้จริง
   - บันทึกวิดีโอ `.webm` ขณะกดปุ่ม `เล่น`: เวลาเล่นเดินหน้าต่อเนื่อง, ตัวละครเคลื่อนไหว, ซับไตเติลเปลี่ยนจาก `"ทุกเย็นวันศุกร์"` เป็น `"คุณปู่จะเดินลงมาวาง"`, กด `หยุด` ทำงานถูกต้อง
   - หน้าต่างแสดงผล 9:16 และปุ่ม `S1..S5` แสดงครบเหนือขอบล่างจอ (above the fold) บน `1440×900`
4. **สตูดิโอออกแบบตัวละคร 3D (`ตัวละคร`)**:
   - ตัวละคร 3D (`ต้นกล้า`, `คุณปู่สิน`) แสดงโครงกระดูก/แขนขา/ข้อต่อ/เสื้อฮู้ดและหมุนโชว์แบบเรียลไทม์ ไม่มีชิ้นส่วนหลุดลอย (ปรับแต่งทรงผมด้านหน้าให้แนบศีรษะในรอบ Round 2 แล้ว และตรวจซ้ำด้วยภาพถ่ายหน้าจอ `r3-desktop-characters.png`)
5. **Dual Render Engine (`2D Paper Sketch` ↔ `3D Cinematic`)**:
   - สลับเอนจินจาก `3D Cinematic` เป็น `2D Paper Sketch (Classic)` แล้วแสดงผล Canvas 2D สไตล์กระดาษ/คัตเอาต์พร้อมป้าย `"18:20 น. • ริมแม่น้ำ"` และซับไตเติล `"ทุกเย็นวันศุกร์"` ได้ทันที (`r2-desktop-2d.png`) และสลับกลับ 3D ได้โดยไม่เกิด error
6. **ระบบ Multi-Workspace ในเครื่อง + เข้ารหัส AES-GCM + Reload Persistence (`คลังเครื่อง`)**:
   - เปิดครั้งแรกมี Workspace เริ่มต้นเพียง **1 รายการ** (`พื้นที่ทำงานหลัก (Default)`, ไม่มีปัญหาสร้างซ้ำ)
   - สร้าง Workspace ใหม่ `"ช่องที่ 2"` ได้สำเร็จ (จำนวนเพิ่มเป็น 2)
   - ตั้งรหัสผ่านล็อก `"1234"` → รีเฟรชหน้าเว็บ (`page.reload()`) → เข้าเมนู `คลังเครื่อง` พบสถานะ **ถูกล็อกคงอยู่หลังรีโหลด** → กรอก `"1234"` กด `ปลดล็อก` กลับมาใช้งานได้สำเร็จ (`r2-desktop-storage.png`)
7. **ห้องพากย์ภาษาไทย & พจนานุกรมคำอ่าน (`ห้องพากย์`)**:
   - เพิ่มคำในพจนานุกรม `"โคมลอย"` → `"โคม-ลอย-สวย"` และพิมพ์ทดสอบ `"คืนนี้มีโคมลอย 2 ดวง"` ระบบพรีโพรเซสเซอร์แปลงผลเป็น `"คืนนี้มีโคม-ลอย-สวย สอง ดวง"` ถูกต้อง (`r2-desktop-voice.png`)
8. **Export Audio (.mp3) & Preflight / MP4 WebCodecs Progress (`สตูดิโอ`)**:
   - กด `ตรวจสอบความพร้อมเครื่อง (Preflight)`: แสดงผลจริง `MP4 WebCodecs: พร้อม (720×1280, avc1.42001f)` / `Audio Codec: pcm-s16 · WebM Fallback: รองรับ`
   - กด `ส่งออกเสียงรวม (.mp3)`: เบราว์เซอร์สร้างและดาวน์โหลดไฟล์ `คืนโคมไฟริมน้ำ.mp3` สำเร็จ
   - กด `สร้างวิดีโอ MP4 (720p · 30 FPS)` (โหมด `2D Paper Sketch`): ระบบผสมเสียงและเริ่มเข้ารหัสเฟรม MP4 จริง (`กำลังเรนเดอร์ MP4 720×1280 @ 30 FPS (1/873)… 12%` → `9/873 13%` → `33/873 15%`) และกดปุ่ม `ยกเลิกการเรนเดอร์` หยุดทำงานได้เรียบร้อย
9. **Responsive Layout**:
   - ตรวจสอบหน้าจอมือถือ `390×844` (`r1-mobile.png`): เมนูและเนื้อหาปรับเรียงแนวตั้ง ไม่หลุดขอบแนวนอน

---

## 4. รายการที่ยังไม่ได้ทดสอบแบบ Live End-to-End ในสภาพแวดล้อมนี้ (แจ้งตามจริง)

- **การเรียก API TTS จริงของทั้ง 6 ผู้ให้บริการ** (OpenRouter TTS, ElevenLabs, Microsoft Azure Speech, Google Cloud TTS, OpenAI TTS, Custom HTTP TTS): **ไม่ได้ยิง API จริง** เนื่องจากแอปออกแบบเป็น Zero-Login BYOK (ใช้ API Key ของผู้ใช้เอง) และในสภาพแวดล้อมทดสอบไม่มี API Key ส่วนตัวของผู้ใช้; รวมถึงอาจมีข้อจำกัด CORS ในเบราว์เซอร์สำหรับบางผู้ให้บริการ (ซึ่งระบบได้แสดงหมายเหตุและหน้าต่างจัดการตามจริงใน UI แล้ว)
- **การส่งออกไฟล์ MP4/WebM ความยาวเต็ม 29 วินาที (873 เฟรม) จนจบ 100% + ขั้นตอน VERIFY Blob**: ทดสอบยืนยันการทำงานจริงของ Preflight, OfflineAudioContext audio mix, การเริ่มเข้ารหัส VideoEncoder MP4 (`1/873` → `33/873`), และการยกเลิกกลางคัน แต่ **ไม่ได้รอจนครบ 873 เฟรมบน CPU container** (ใช้เวลานานกว่า timeout ของสคริปต์อัตโนมัติ)
- **การนำเข้าไฟล์โมเดล `.glb` / `.gltf` ภายนอก**: ตรวจสอบตรรกะตัวโหลดและระบบแจ้งข้อจำกัดกรณีโมเดลไม่มี Bone rig ในโค้ดแล้ว แต่ **ไม่ได้อัปโหลดไฟล์ `.glb` จริงผ่าน file picker** ในการทดสอบอัตโนมัติ
