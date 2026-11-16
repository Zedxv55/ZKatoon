# PROJECT_AUDIT.md — ZKatoon AI Video Studio
วันที่ตรวจสอบ: 2026-11-15 | ประเภทงาน: ต่อยอดจากโปรเจกต์เดิม (Existing Project Upgrade)

## 1. Current Architecture
- **Frontend**: React 19.0.1 + Vite 8.3.0 + TypeScript 7.0.2 + Tailwind CSS v4 (`@tailwindcss/vite` 4.3.3) + `lucide-react` + `motion` + `vite-plugin-pwa`
- **Backend (`server.ts`)**: Express 4.21.2 รันบนพอร์ต `3000` (รวม `vite.middlewares` ใน dev และ serve `dist/` ใน prod) มี Route `/api/health`, `/api/generate-script`, `/api/generate-tts`, `/api/tts-pythai`, `/api/tts-custom`
- **Database & Auth Config**:
  - `firebase-applet-config.json` เชื่อมต่อ Project `extreme-victor-q3n78` และ Firestore DB `ai-studio-aicartoonstudio-994eb5b3-1265-427a-a725-7d92230f52fd`
  - Client SDK `src/utils/firebaseClient.ts` รองรับ Google Sign-In (`signInWithPopup`) และ `testFirestoreServerConnection()`
  - Local Storage: IndexedDB (`zkatoon_studio_v3`) + OPFS chunked storage + localStorage (`zkatoon_studio_config_v3`)
- **Video & Audio Engine**:
  - Single Canvas 2D Pure-Time Engine (`src/utils/canvasEngine.ts`, `drawBackgrounds.ts`, `drawCharacter.ts`, `drawPropsAndCards.ts`)
  - Web Audio Graph + `@breezystack/lamejs` MP3 Export (`src/utils/studioAudio.ts`)
  - WebCodecs H.264 + AAC/PCM `.MP4` Exporter (`src/utils/mp4Exporter.ts` ผ่าน `mediabunny` / `mp4-muxer`)
  - ไบนารีในระบบ: `/usr/bin/ffmpeg` และ `/usr/bin/ffprobe` พร้อมใช้งานบน Server

## 2. Existing Features & Working Components
1. **StudioPlayer (`src/components/studio/StudioPlayer.tsx`)**: Sticky player, scrub timeline, mute, fullscreen, Undo/Redo 60 ขั้น
2. **ProjectsTab**: 3 Demo เริ่มต้น (Pack A `9:16`, Pack B `portrait_letterbox`, Pack C สรุปหนังสือ) + IndexedDB + Export/Import `.ZIP` (`fflate`)
3. **CreateTab**: Wizard 12 ตัวเลือก + Multi-step OpenRouter/Custom LLM Pipeline + `sceneValidator.ts`
4. **ScenesTab**: จัดการฉาก, แก้ตัวละคร, Bottom Sheet editor, AI Chat Ops
5. **AudioExportTab**: TTS 3 ค่าย (ElevenLabs, OpenAI/Custom, Google Cloud) + Freesound/Local SFX + WebCodecs `.MP4` & `.MP3`
6. **SettingsTab**: จัดการ Key (รองรับโหมด "ไม่จำคีย์" RAM-only), OpenRouter Model Browser, Prompt Templates, Visual QA Gallery (29 BGs, 14 Poses × 9 Faces, 20 Cards)

## 3. Broken / Incomplete / Missing Components
- **Brand Splash & Onboarding**: ยังไม่มี Splash screen (`0.5–0.8s`) และ First-Time Onboarding Wizard 7 ขั้นที่บันทึก Default ของผู้ใช้
- **Authentication & Tier Enforcement**: `firebaseClient.ts` ยังไม่มี Email+Password Sign-Up / Sign-In / Email Verification / Forgot Password และยังไม่มีระบบ Free vs Studio Pass + Credit Wallet / Ledger
- **Super Admin & RBAC**: ยังไม่มีระบบตรวจ Firebase ID Token ฝั่ง Backend (`zbcd1053@gmail.com`, `zeetosit@gmail.com`) และ Admin Dashboard 18 เมนู
- **Payment System**: ยังไม่มี Manual PromptPay/Bank Slip + Admin Approve/Reject + Gateway Adapter (`NOT CONFIGURED` จนกว่าแอดมินจะตั้งค่า) + One-Time Activation Codes
- **Universal AI Hub & Central API**: API Key ยังถูกเก็บเฉพาะ client ไม่มีการเข้ารหัส BYOK บน Server และยังไม่มี Central API Gateway สำหรับ Studio Pass (`nvidia/nemotron-3.5-super-vl:free` + `fish-audio/s2.1-pro-free:free` + Fallback)
- **Model Registry**: ยังไม่มีฐานข้อมูลกลางที่แยก Category (LLM, Vision, Image, TTS, Map ฯลฯ) และแยกสิทธิ์ Free vs Studio Pass
- **Workflow LEGO Editor**: ยังไม่มี React Flow / XYFlow Visual DAG Editor
- **Admin LEGO Page Builder**: ยังไม่มีระบบจัดหน้า Home/Pricing/FAQ/Custom Pages
- **Animate Styles & Map Engine**: ยังไม่เชื่อม `cth9191/animate` style plugins (Cut Paper, Crosshatch, Riso Print, Sketchbook, Math, Pixel, Isometric) และ MapLibre GL JS Map Animation Engine
- **Background Render Queue & FFmpeg QA**: ยังทำงานเรนเดอร์เฉพาะใน Browser ขาด Render Queue + FFmpeg verification (`ffprobe`) จริง

## 4. Security Risks Identified
1. Client-side localStorage API Keys: ต้องมี Server-side Encrypted BYOK Vault (AES-256-GCM) ไม่ส่ง Key กลับ Frontend และไม่เขียนลง Log
2. ไม่มี Server-side ID Token Verification (`email_verified` + exact-match allowlist) สำหรับ Admin APIs และ Wallet Transactions
3. OpenAI-compatible Custom Base URL อาจเสี่ยง SSRF หากไม่จำกัด/Whitelist Host ฝั่ง Server
4. `firestore.rules` เดิมครอบคลุมเฉพาะ `/users/{userId}/workspaces/...` ยังไม่มี Collection ของแพลตฟอร์ม (`plans`, `wallets`, `creditLedger`, `payments`, `accessCodes`, `providers`, `models`, `systemSettings`, `workflows`, `pages`, `pageVersions`, `renderJobs`, `auditLogs`)

## 5. Recommended Upgrade Plan (Phases 0 → 6)
- **Phase 0**: Audit (`PROJECT_AUDIT.md`) + `DEVELOPMENT_LOG.md` + คงพฤติกรรม Studio เดิม 100%
- **Phase 1**: Foundation — Firebase Auth (Email/Password + Verification + Forgot Password + Google), Server Token Verification + Super Admin Allowlist, Firestore Blueprint + Hardened `firestore.rules` + ESLint, Brand Splash + 7-Step Onboarding
- **Phase 2**: AI Provider Hub + Model Registry + Encrypted BYOK Vault + Central Gateway (`nvidia/nemotron-3.5-super-vl:free` / `fish-audio/s2.1-pro-free:free`) + Atomic Credit Wallet & Ledger
- **Phase 3**: Manual Payment (PromptPay QR + Slip Upload + Admin Approve/Reject) + Payment Gateway Adapter + Activation Codes + Studio Pass (350 THB / 30 days)
- **Phase 4**: Video Workflow LEGO Editor (`@xyflow/react` + DAG runner + Undo/Redo/JSON) + Admin LEGO Page Builder (Versioned JSON + Public Pages) + Project Manager Cloud Sync
- **Phase 5**: Animate Engine Style Plugins (`cth9191/animate` MIT-attributed styles: Cut Paper, Crosshatch, Riso, Sketchbook, Math, Pixel, Isometric) + Map Animation Engine (`maplibre-gl` + GeoJSON + Route Flyover)
- **Phase 6**: Server Background Render Queue + FFmpeg/FFprobe QA Verification (`PASS`/`WARNING`/`FAILED`) + Super Admin 18-Menu Console + Feature Flags / System Settings
