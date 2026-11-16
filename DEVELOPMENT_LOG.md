# DEVELOPMENT_LOG.md — ZKatoon AI Video Studio

## Phase 0: Audit & Preservation Baseline
- ตรวจสอบโครงสร้างเดิม: `src/App.tsx`, `src/components/studio/*`, `src/utils/canvasEngine.ts`, `src/utils/mp4Exporter.ts`, `server.ts`, `firebase-blueprint.json`, `firestore.rules`
- ยืนยันระบบเดิมยังคงเปิดใช้งานได้ทันที (Guest/Offline Preview + Built-in Demos A/B/C + WebCodecs `.MP4` + `.MP3` + `.ZIP`)
- ตรวจสอบ container binaries: พบ `/usr/bin/ffmpeg` และ `/usr/bin/ffprobe` พร้อมใช้สำหรับงาน Render Worker และ QA Verification

## Roadmap Status
- [x] Phase 0: Audit (`PROJECT_AUDIT.md`) + Dependency install (`firebase-admin`, `@xyflow/react`, `maplibre-gl`)
- [x] Phase 1: Foundation (Auth + Verification + Super Admin Allowlist + 650ms Splash + 7-Step Onboarding + Firestore Blueprint/Rules deployed)
- [x] Phase 2: AI Provider Hub + 12-Category Model Registry + AES-256-GCM Encrypted BYOK Vault + Central Gateway + Atomic Credit Ledger
- [x] Phase 3: Payment System (Manual PromptPay Slip Pending/Approve/Reject + HMAC Gateway Adapter + Single-use Access Codes + Studio Pass Subscription)
- [x] Phase 4: Workflow LEGO Editor (`@xyflow/react`) + Admin LEGO Page Builder (14 Block Types, Versioning, Rollback) + CMS Pages
- [x] Phase 5: Animate Style Plugins (`cth9191/animate` MIT in `canvasEngine.ts`) + Map Animation Engine (`maplibre-gl` + offline Canvas 2D GeoJSON fallback)
- [x] Phase 6: Background FFmpeg Render Queue + FFprobe/blackdetect QA (`PASS`/`WARNING`/`FAILED`) + Super Admin 18-Menu Dashboard

## Verification Checklist
- [x] `npx eslint firestore.rules` + Rules deployed via `fax.DeployRules`
- [x] Unit tests (`npx --yes tsx --test src/utils/*.test.ts server/*.test.ts`): 39/39 passed
- [x] TypeScript & Vite Build (`compile_applet` + `lint_applet`) passed with 0 errors
- [x] Server FFmpeg Render + FFprobe/blackdetect QA Check passed (`PASS` on 1080x1920 @ 30fps)
- [x] Playwright Browser UI/UX Verification (1440×900 Desktop & 390×844 Mobile, 0 console errors)
