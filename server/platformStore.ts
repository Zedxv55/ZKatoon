import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AccessCodeRecord,
  AdminOverviewStats,
  AuditLogRecord,
  ByokCredentialSummary,
  CmsPageRecord,
  CreditLedgerEntry,
  CreditWallet,
  ManualPaymentRecord,
  MemberTier,
  ModelRegistryItem,
  OnboardingDefaults,
  PlatformUserRecord,
  ProviderConfig,
  ServerRenderJob,
  SystemLogRecord,
  SystemSettings,
} from '../src/types/platform.ts';
import type { VerifiedFirebaseUser } from './authMiddleware.ts';

export interface EncryptedByokRecord {
  id: string;
  uid: string;
  providerId: string;
  providerName: string;
  baseUrl: string;
  ciphertextB64: string;
  ivB64: string;
  authTagB64: string;
  maskedKey: string;
  selectedModelId: string;
  status: 'active' | 'invalid';
  updatedAt: number;
}

export interface StoredWorkflowRecord {
  id: string;
  ownerUid: string;
  name: string;
  description: string;
  nodes: unknown[];
  edges: unknown[];
  updatedAt: number;
  createdAt: number;
}

export interface PlatformDatabase {
  users: Record<string, PlatformUserRecord>;
  wallets: Record<string, CreditWallet>;
  creditLedger: CreditLedgerEntry[];
  providers: ProviderConfig[];
  providerSecrets: Record<string, { ciphertextB64: string; ivB64: string; authTagB64: string; maskedKey: string }>;
  models: ModelRegistryItem[];
  byok: Record<string, EncryptedByokRecord>;
  payments: ManualPaymentRecord[];
  processedWebhookIds: string[];
  accessCodes: Record<string, AccessCodeRecord>;
  settings: SystemSettings;
  gatewaySecrets: {
    webhookSecretEnc?: { ciphertextB64: string; ivB64: string; authTagB64: string };
    apiKeyEnc?: { ciphertextB64: string; ivB64: string; authTagB64: string };
  };
  pages: CmsPageRecord[];
  workflows: Record<string, StoredWorkflowRecord>;
  renderJobs: Record<string, ServerRenderJob>;
  auditLogs: AuditLogRecord[];
  systemLogs: SystemLogRecord[];
}

export const DATA_DIR = path.resolve(process.cwd(), '.zkatoon-data');
const DB_PATH = path.join(DATA_DIR, 'platform-db.json');
const VAULT_KEY_PATH = path.join(DATA_DIR, '.vault.key');

let writeChain: Promise<void> = Promise.resolve();
let memoryDb: PlatformDatabase | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

export function getOrCreateVaultKey(secretOverride?: string): Buffer {
  if (secretOverride && secretOverride.trim()) {
    return crypto.createHash('sha256').update(secretOverride.trim()).digest();
  }
  const envSecret = process.env.ZKATOON_VAULT_SECRET?.trim();
  if (envSecret) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }
  ensureDataDir();
  if (fs.existsSync(VAULT_KEY_PATH)) {
    const hex = fs.readFileSync(VAULT_KEY_PATH, 'utf8').trim();
    if (/^[a-f0-9]{64}$/i.test(hex)) {
      return Buffer.from(hex, 'hex');
    }
  }
  const key = crypto.randomBytes(32);
  fs.writeFileSync(VAULT_KEY_PATH, key.toString('hex'), { mode: 0o600 });
  return key;
}

export function encryptSecret(
  plaintext: string,
  vaultKey: Buffer = getOrCreateVaultKey()
): { ciphertextB64: string; ivB64: string; authTagB64: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertextB64: encrypted.toString('base64'),
    ivB64: iv.toString('base64'),
    authTagB64: authTag.toString('base64'),
  };
}

export function decryptSecret(
  payload: { ciphertextB64: string; ivB64: string; authTagB64: string },
  vaultKey: Buffer = getOrCreateVaultKey()
): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    vaultKey,
    Buffer.from(payload.ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(payload.authTagB64, 'base64'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

export function maskApiKey(rawKey: string): string {
  const clean = rawKey.trim();
  if (!clean) return '';
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••`;
  return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
}

export function isPrivateOrUnsafeHost(hostname: string): boolean {
  const h = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h.startsWith('fe80:') || h.startsWith('fc00:') || h.startsWith('fd00:')) return true;
  if (h === '169.254.169.254' || h === '0.0.0.0') return true;
  const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

export function validateOutboundProviderUrl(
  rawUrl: string,
  allowedHosts: string[]
): { ok: true; url: URL } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'URL ไม่ถูกต้อง' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'อนุญาตเฉพาะ HTTPS เท่านั้นเพื่อความปลอดภัย' };
  }
  if (isPrivateOrUnsafeHost(parsed.hostname)) {
    return { ok: false, error: 'ไม่อนุญาตให้เชื่อมต่อไปยัง Localhost หรือ IP ภายใน (SSRF Guard)' };
  }
  const normalizedAllowed = allowedHosts.map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      error: `โฮสต์ "${parsed.hostname}" ยังไม่อยู่ใน Allowed Hosts ที่ Super Admin อนุญาต`,
    };
  }
  return { ok: true, url: parsed };
}

export function createDefaultOnboarding(): OnboardingDefaults {
  return {
    completed: false,
    videoType: 'ai_cartoon',
    style: 'cut_paper',
    durationSec: 30,
    aspect: '9:16',
    language: 'th',
    audioPref: 'ai_voice',
    preferredPlan: 'free',
    updatedAt: Date.now(),
  };
}

export function createDefaultSettings(): SystemSettings {
  return {
    websiteName: 'ZKatoon AI Video Studio',
    tagline: 'Create Your Story with AI',
    splashDurationMs: 650,
    primaryAccent: '#f5c542',
    secondaryAccent: '#8b5cf6',
    maintenanceMode: false,
    requireEmailVerification: true,
    studioPassPriceThb: 350,
    studioPassDays: 30,
    studioPassMonthlyCredits: 1500,
    maxCreditsBalance: 50000,
    freeMaxConcurrentJobs: 1,
    paidMaxConcurrentJobs: 3,
    freeMaxDurationSec: 90,
    paidMaxDurationSec: 300,
    freeMaxResolution: '720p',
    paidMaxResolution: '4k',
    defaultFps: 30,
    creditRates: {
      perVideoBase: 10,
      perSecond: 1,
      perImage: 2,
      perAudioClip: 2,
      multiplier1080p: 1.5,
      multiplier1440p: 2,
      multiplier4k: 3,
    },
    defaultBrainModel: 'nvidia/nemotron-3.5-super-vl:free',
    defaultBrainProvider: 'openrouter',
    fallbackBrainModel: 'gemini-4-hydrogen',
    defaultVoiceModel: 'fish-audio/s2.1-pro-free:free',
    defaultVoiceProvider: 'openrouter',
    manualPaymentEnabled: true,
    promptPayId: '',
    promptPayAccountName: 'ZKatoon Studio (รอผู้ดูแลตั้งค่าหมายเลข PromptPay)',
    bankAccountInfo: 'กรุณาโอนตามหมายเลข PromptPay ที่ผู้ดูแลกำหนด และแนบสลิปพร้อมรหัสอ้างอิง',
    promptPayQrDataUrl: '',
    paymentExpirationMinutes: 60,
    promoBannerText: 'Studio Pass 350 บาท / เดือน — ปลดล็อก Export 1080p–4K และคิวเรนเดอร์ระดับสตูดิโอ',
    gatewayEnabled: false,
    gatewayProvider: 'none',
    gatewayConfigured: false,
    mapTileStyleUrl: 'https://demotiles.maplibre.org/style.json',
    mapAttribution: '© MapLibre • OpenStreetMap / Natural Earth Contributors',
    allowedCustomHosts: [
      'openrouter.ai',
      'api.openai.com',
      'api.anthropic.com',
      'generativelanguage.googleapis.com',
      'api.together.xyz',
      'api.groq.com',
    ],
    featureFlags: {
      onboardingWizard: true,
      workflowEditor: true,
      mapEngine: true,
      animatePlugins: true,
      pageBuilder: true,
      serverRenderQueue: true,
      cloudProjectSync: true,
    },
  };
}

export function createDefaultProviders(): ProviderConfig[] {
  return [
    {
      id: 'openrouter',
      type: 'openrouter',
      name: 'OpenRouter Universal Hub',
      baseUrl: 'https://openrouter.ai/api/v1',
      enabled: true,
      supportsModelFetch: true,
      supportsBalanceCheck: true,
      whitelistedHosts: ['openrouter.ai'],
      lastTestStatus: 'not_configured',
    },
    {
      id: 'google_gemini',
      type: 'google_gemini',
      name: 'Google Gemini API',
      baseUrl: 'https://generativelanguage.googleapis.com',
      enabled: true,
      supportsModelFetch: true,
      supportsBalanceCheck: false,
      whitelistedHosts: ['generativelanguage.googleapis.com'],
      lastTestStatus: process.env.GEMINI_API_KEY ? 'ok' : 'not_configured',
    },
    {
      id: 'openai',
      type: 'openai',
      name: 'OpenAI Platform',
      baseUrl: 'https://api.openai.com/v1',
      enabled: true,
      supportsModelFetch: true,
      supportsBalanceCheck: false,
      whitelistedHosts: ['api.openai.com'],
      lastTestStatus: 'not_configured',
    },
    {
      id: 'anthropic',
      type: 'anthropic',
      name: 'Anthropic Claude API',
      baseUrl: 'https://api.anthropic.com/v1',
      enabled: true,
      supportsModelFetch: false,
      supportsBalanceCheck: false,
      whitelistedHosts: ['api.anthropic.com'],
      lastTestStatus: 'not_configured',
    },
    {
      id: 'openai_compatible',
      type: 'openai_compatible',
      name: 'OpenAI-Compatible Gateway',
      baseUrl: 'https://api.groq.com/openai/v1',
      enabled: true,
      supportsModelFetch: true,
      supportsBalanceCheck: false,
      whitelistedHosts: ['api.groq.com', 'api.together.xyz'],
      lastTestStatus: 'not_configured',
    },
  ];
}

export function createDefaultModels(): ModelRegistryItem[] {
  return [
    {
      id: 'nvidia/nemotron-3.5-super-vl:free',
      providerId: 'openrouter',
      displayName: 'NVIDIA Nemotron 3.5 Super VL (Free Default Brain)',
      apiModelId: 'nvidia/nemotron-3.5-super-vl:free',
      category: 'LLM',
      capabilities: ['thai-script', 'structured-json', 'vision', 'storyboarding'],
      promptPricePerM: 0,
      completionPricePerM: 0,
      creditCostPerCall: 2,
      contextLength: 131072,
      maxOutputTokens: 8192,
      supportedLanguages: ['th', 'en', 'multilingual'],
      inputFormats: ['text', 'image'],
      outputFormats: ['text', 'json'],
      availability: 'available',
      isFreeTierModel: true,
      active: true,
      isDefaultBrain: true,
      fallbackModelId: 'gemini-4-hydrogen',
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://openrouter.ai/models/nvidia/nemotron-3.5-super-vl:free',
    },
    {
      id: 'fish-audio/s2.1-pro-free:free',
      providerId: 'openrouter',
      displayName: 'Fish Audio S2.1 Pro (Free Default Voice)',
      apiModelId: 'fish-audio/s2.1-pro-free:free',
      category: 'Text-to-Speech',
      capabilities: ['thai-tts', 'multilingual-voice', 'expressive-cadence'],
      promptPricePerM: 0,
      completionPricePerM: 0,
      creditCostPerCall: 2,
      contextLength: 8192,
      maxOutputTokens: 4096,
      supportedLanguages: ['th', 'en', 'ja', 'zh'],
      inputFormats: ['text'],
      outputFormats: ['audio/wav', 'audio/mp3'],
      availability: 'available',
      isFreeTierModel: true,
      active: true,
      isDefaultVoice: true,
      fallbackModelId: 'gemini-3.8-flash-lite-tts',
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://openrouter.ai/models',
    },
    {
      id: 'gemini-4-hydrogen',
      providerId: 'google_gemini',
      displayName: 'Gemini 4 Hydrogen (Fallback & Structured Studio)',
      apiModelId: 'gemini-4-hydrogen',
      category: 'Vision',
      capabilities: ['thai-script', 'vision', 'json-schema'],
      promptPricePerM: 0.15,
      completionPricePerM: 0.6,
      creditCostPerCall: 4,
      contextLength: 1000000,
      maxOutputTokens: 16384,
      supportedLanguages: ['th', 'en', 'multilingual'],
      inputFormats: ['text', 'image', 'audio'],
      outputFormats: ['text', 'json'],
      availability: 'available',
      isFreeTierModel: true,
      active: true,
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://ai.google.dev',
    },
    {
      id: 'gemini-3.8-flash-lite-tts',
      providerId: 'google_gemini',
      displayName: 'Gemini Flash Lite TTS (Thai Voice Fallback)',
      apiModelId: 'gemini-3.8-flash-lite-tts',
      category: 'Text-to-Speech',
      capabilities: ['thai-tts', 'style-prompt'],
      promptPricePerM: 0.1,
      completionPricePerM: 0.4,
      creditCostPerCall: 3,
      contextLength: 32768,
      maxOutputTokens: 8192,
      supportedLanguages: ['th', 'en'],
      inputFormats: ['text'],
      outputFormats: ['audio/wav'],
      availability: 'available',
      isFreeTierModel: true,
      active: true,
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://ai.google.dev',
    },
    {
      id: 'black-forest-labs/flux-pro',
      providerId: 'openrouter',
      displayName: 'FLUX Pro Scene Illustrator',
      apiModelId: 'black-forest-labs/flux.1-pro',
      category: 'Image Generation',
      capabilities: ['storyboard-frame', 'character-sheet', '9:16'],
      promptPricePerM: 2.0,
      completionPricePerM: 5.0,
      creditCostPerCall: 6,
      contextLength: 4096,
      maxOutputTokens: 1024,
      supportedLanguages: ['en', 'th'],
      inputFormats: ['text'],
      outputFormats: ['image/png'],
      availability: 'available',
      isFreeTierModel: false,
      active: true,
      allowedTiers: ['studio_pass'],
      docsUrl: 'https://openrouter.ai/models',
    },
    {
      id: 'openai/gpt-image-edit',
      providerId: 'openai',
      displayName: 'GPT Image Edit & Inpaint',
      apiModelId: 'gpt-image-1',
      category: 'Image Editing',
      capabilities: ['inpaint', 'style-transfer', 'character-consistency'],
      promptPricePerM: 2.5,
      completionPricePerM: 6.0,
      creditCostPerCall: 8,
      contextLength: 8192,
      maxOutputTokens: 1024,
      supportedLanguages: ['en', 'th'],
      inputFormats: ['text', 'image'],
      outputFormats: ['image/png'],
      availability: 'available',
      isFreeTierModel: false,
      active: true,
      allowedTiers: ['studio_pass'],
      docsUrl: 'https://platform.openai.com/docs/models',
    },
    {
      id: 'openai/whisper-large-v3',
      providerId: 'openai',
      displayName: 'Whisper Thai Auto-Caption STT',
      apiModelId: 'whisper-1',
      category: 'Speech-to-Text',
      capabilities: ['thai-stt', 'word-timestamps'],
      promptPricePerM: 0.2,
      completionPricePerM: 0.2,
      creditCostPerCall: 3,
      contextLength: 16384,
      maxOutputTokens: 4096,
      supportedLanguages: ['th', 'en'],
      inputFormats: ['audio/wav', 'audio/mp3'],
      outputFormats: ['text', 'srt'],
      availability: 'available',
      isFreeTierModel: false,
      active: true,
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://platform.openai.com/docs/models',
    },
    {
      id: 'zkatoon/sfx-foley-gen',
      providerId: 'openrouter',
      displayName: 'Studio Foley & BGM Synth Engine',
      apiModelId: 'studio-procedural-audio-v2',
      category: 'Audio Generation',
      capabilities: ['bgm', 'sfx', 'ducking'],
      promptPricePerM: 0,
      completionPricePerM: 0,
      creditCostPerCall: 1,
      contextLength: 4096,
      maxOutputTokens: 1024,
      supportedLanguages: ['th', 'en'],
      inputFormats: ['text'],
      outputFormats: ['audio/wav'],
      availability: 'available',
      isFreeTierModel: true,
      active: true,
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://github.com',
    },
    {
      id: 'google/veo-studio-pass',
      providerId: 'google_gemini',
      displayName: 'Cinema Video Generator (Studio Pass)',
      apiModelId: 'veo-2.0-generate-001',
      category: 'Video Generation',
      capabilities: ['1080p', 'camera-control'],
      promptPricePerM: 10,
      completionPricePerM: 25,
      creditCostPerCall: 25,
      contextLength: 8192,
      maxOutputTokens: 2048,
      supportedLanguages: ['en', 'th'],
      inputFormats: ['text', 'image'],
      outputFormats: ['video/mp4'],
      availability: 'limited',
      isFreeTierModel: false,
      active: true,
      allowedTiers: ['studio_pass'],
      docsUrl: 'https://ai.google.dev',
    },
    {
      id: 'zkatoon/ffmpeg-transcode-qa',
      providerId: 'openai_compatible',
      displayName: 'FFmpeg Server Video Transcode & QA',
      apiModelId: 'ffmpeg-local-qa-v1',
      category: 'Video Editing',
      capabilities: ['720p', '1080p', '1440p', '4k', 'blackdetect-qa'],
      promptPricePerM: 0,
      completionPricePerM: 0,
      creditCostPerCall: 5,
      contextLength: 32768,
      maxOutputTokens: 4096,
      supportedLanguages: ['th', 'en'],
      inputFormats: ['video/mp4', 'video/webm', 'json'],
      outputFormats: ['video/mp4'],
      availability: 'available',
      isFreeTierModel: true,
      active: true,
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://ffmpeg.org',
    },
    {
      id: 'openai/text-embedding-3-small',
      providerId: 'openai',
      displayName: 'Series Bible Semantic Embedding',
      apiModelId: 'text-embedding-3-small',
      category: 'Embedding',
      capabilities: ['continuity-memory', 'semantic-search'],
      promptPricePerM: 0.02,
      completionPricePerM: 0,
      creditCostPerCall: 1,
      contextLength: 8192,
      maxOutputTokens: 1536,
      supportedLanguages: ['th', 'en'],
      inputFormats: ['text'],
      outputFormats: ['vector'],
      availability: 'available',
      isFreeTierModel: false,
      active: true,
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://platform.openai.com/docs/models',
    },
    {
      id: 'cth9191/animate-canvas-engine',
      providerId: 'openrouter',
      displayName: 'ZKatoon Animate Engine (cth9191/animate MIT)',
      apiModelId: 'zkatoon-animate-v2',
      category: 'Animation',
      capabilities: ['cut_paper', 'crosshatch', 'riso_print', 'sketchbook', 'math', 'pixel', 'isometric'],
      promptPricePerM: 0,
      completionPricePerM: 0,
      creditCostPerCall: 0,
      contextLength: 65536,
      maxOutputTokens: 16384,
      supportedLanguages: ['th', 'en'],
      inputFormats: ['json'],
      outputFormats: ['canvas2d', 'video/mp4'],
      availability: 'available',
      isFreeTierModel: true,
      active: true,
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://github.com/cth9191/animate',
    },
    {
      id: 'maplibre/geojson-flyover-engine',
      providerId: 'openrouter',
      displayName: 'MapLibre GeoJSON Flyover Renderer',
      apiModelId: 'maplibre-gl-v6',
      category: 'Map Rendering',
      capabilities: ['world_map', 'historical_map', 'travel_route', 'flight_path', 'border_changes'],
      promptPricePerM: 0,
      completionPricePerM: 0,
      creditCostPerCall: 0,
      contextLength: 32768,
      maxOutputTokens: 8192,
      supportedLanguages: ['th', 'en'],
      inputFormats: ['geojson', 'json'],
      outputFormats: ['canvas2d', 'video/mp4'],
      availability: 'available',
      isFreeTierModel: true,
      active: true,
      allowedTiers: ['free', 'studio_pass'],
      docsUrl: 'https://maplibre.org',
    },
  ];
}

export function createDefaultPages(): CmsPageRecord[] {
  const now = Date.now();
  return [
    {
      id: 'page_home',
      slug: 'home',
      title: 'หน้าหลักสตูดิโอ ZKatoon',
      status: 'published',
      seoTitle: 'ZKatoon AI Video Studio — Create Your Story with AI',
      seoDescription: 'สตูดิโอสร้างวิดีโอการ์ตูน AI แผนที่แอนิเมชัน และ LEGO Workflow ภาษาไทยครบวงจร',
      blocks: [
        {
          id: 'blk_hero_1',
          type: 'hero',
          title: 'ZKatoon AI Video Studio',
          subtitle: 'Create Your Story with AI',
          body: 'เปลี่ยนไอเดียเป็นวิดีโอการ์ตูน 2D/3D แอนิเมชันแผนที่ประวัติศาสตร์ และ Motion Graphic พร้อมเสียงพากย์ภาษาไทยและตรวจคุณภาพ FFmpeg QA ในที่เดียว',
          ctaLabel: 'เริ่มสร้างโปรเจกต์',
          ctaHref: '#create',
          widthCols: 12,
        },
        {
          id: 'blk_feat_1',
          type: 'feature_cards',
          title: 'จุดเด่นระดับโปรดักชัน',
          widthCols: 12,
          items: [
            { title: 'Animate Engine 13 สไตล์', description: 'Cut Paper, Riso Print, Crosshatch, Math, Pixel, Isometric', badge: 'MIT Plugin' },
            { title: 'Map Animation Engine', description: 'แผนที่เดินทาง ประวัติศาสตร์ สงคราม และเส้นทางบินจริง', badge: 'MapLibre' },
            { title: 'LEGO Workflow Editor', description: 'ต่อโหนด AI ควบคุมภาพ เสียง และเรนเดอร์เป็นขั้นตอน', badge: 'DAG' },
          ],
        },
      ],
      versions: [],
      updatedAt: now,
    },
    {
      id: 'page_pricing',
      slug: 'pricing',
      title: 'แพ็กเกจสมาชิก (Free BYOK & Studio Pass)',
      status: 'published',
      seoTitle: 'แพ็กเกจราคา — ZKatoon AI Video Studio',
      seoDescription: 'ใช้งานฟรีด้วย API Key ของคุณเอง (BYOK) หรืออัปเกรดเป็น Studio Pass 350 บาท/เดือน',
      blocks: [
        {
          id: 'blk_price_1',
          type: 'pricing',
          title: 'เลือกแพ็กเกจที่เหมาะกับงานของคุณ',
          subtitle: 'รองรับทั้งสมาชิกฟรี (BYOK) และ Studio Pass สำหรับครีเอเตอร์มืออาชีพ',
          widthCols: 12,
          items: [
            {
              title: 'Free Member (BYOK) — 0 บาท',
              description: 'ใช้คีย์ OpenRouter / Gemini / OpenAI / Anthropic ของคุณเอง สร้างโปรเจกต์ออฟไลน์และส่งออก 720p ได้ทันที',
              badge: 'FREE',
            },
            {
              title: 'Studio Pass — 350 บาท / 30 วัน',
              description: 'รับ 1,500 เครดิต/เดือน ใช้โมเดลกลางของสตูดิโอ คิวเรนเดอร์ 1080p–4K พร้อม FFmpeg QA เต็มรูปแบบ',
              badge: '350 THB / เดือน',
            },
          ],
        },
      ],
      versions: [],
      updatedAt: now,
    },
    {
      id: 'page_faq',
      slug: 'faq',
      title: 'คำถามที่พบบ่อย (FAQ)',
      status: 'published',
      seoTitle: 'คำถามที่พบบ่อย — ZKatoon AI Video Studio',
      seoDescription: 'คำตอบเกี่ยวกับ BYOK, เครดิต, PromptPay และการตรวจคุณภาพวิดีโอ',
      blocks: [
        {
          id: 'blk_faq_1',
          type: 'faq',
          title: 'คำถามที่พบบ่อย',
          widthCols: 12,
          items: [
            {
              title: 'Free Member ต้องจ่ายเงินไหม?',
              description: 'ไม่จำเป็น! คุณสามารถใส่ API Key ของ OpenRouter, Gemini หรือผู้ให้บริการอื่นเพื่อใช้งานได้ฟรีตลอดเวลา',
            },
            {
              title: 'Studio Pass ชำระเงินอย่างไร?',
              description: 'รองรับการโอนผ่าน PromptPay พร้อมแนบสลิปและรหัสอ้างอิง โดยผู้ดูแลระบบจะตรวจสอบและอนุมัติภายในระบบอย่างโปร่งใส',
            },
            {
              title: 'ความแตกต่างระหว่าง Native กับ Upscaled คืออะไร?',
              description: 'ระบบจะแสดงผลชัดเจนเสมอว่าไฟล์ MP4 ที่ส่งออกเป็นความละเอียดจริง (Native) หรือผ่านการ Upscale ด้วย FFmpeg',
            },
          ],
        },
      ],
      versions: [],
      updatedAt: now,
    },
  ];
}

export function createInitialDatabase(): PlatformDatabase {
  return {
    users: {},
    wallets: {},
    creditLedger: [],
    providers: createDefaultProviders(),
    providerSecrets: {},
    models: createDefaultModels(),
    byok: {},
    payments: [],
    processedWebhookIds: [],
    accessCodes: {},
    settings: createDefaultSettings(),
    gatewaySecrets: {},
    pages: createDefaultPages(),
    workflows: {},
    renderJobs: {},
    auditLogs: [],
    systemLogs: [],
  };
}

export function getPlatformDb(): PlatformDatabase {
  if (memoryDb) return memoryDb;
  ensureDataDir();
  if (fs.existsSync(DB_PATH)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) as Partial<PlatformDatabase>;
      const base = createInitialDatabase();
      memoryDb = {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings || {}), creditRates: { ...base.settings.creditRates, ...(parsed.settings?.creditRates || {}) }, featureFlags: { ...base.settings.featureFlags, ...(parsed.settings?.featureFlags || {}) } },
        providers: parsed.providers && parsed.providers.length > 0 ? parsed.providers : base.providers,
        models: parsed.models && parsed.models.length > 0 ? parsed.models : base.models,
        pages: parsed.pages && parsed.pages.length > 0 ? parsed.pages : base.pages,
      };
      return memoryDb;
    } catch {
      memoryDb = createInitialDatabase();
      return memoryDb;
    }
  }
  memoryDb = createInitialDatabase();
  persistDbSync(memoryDb);
  return memoryDb;
}

export function persistDbSync(db: PlatformDatabase): void {
  ensureDataDir();
  const tmpPath = `${DB_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(db, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, DB_PATH);
}

export async function withDbLock<T>(fn: (db: PlatformDatabase) => Promise<T> | T): Promise<T> {
  const prev = writeChain;
  let release!: () => void;
  writeChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prev;
  try {
    const db = getPlatformDb();
    const result = await fn(db);
    persistDbSync(db);
    return result;
  } finally {
    release();
  }
}

export function appendAuditLog(
  db: PlatformDatabase,
  actorUid: string,
  actorEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  detail: string
): void {
  db.auditLogs.unshift({
    id: `aud_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    actorUid,
    actorEmail,
    action,
    targetType,
    targetId,
    detail,
    createdAt: Date.now(),
  });
  if (db.auditLogs.length > 500) db.auditLogs.length = 500;
}

export function appendSystemLog(
  db: PlatformDatabase,
  level: 'info' | 'warn' | 'error',
  scope: string,
  message: string
): void {
  db.systemLogs.unshift({
    id: `syslog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    level,
    scope,
    message,
    createdAt: Date.now(),
  });
  if (db.systemLogs.length > 500) db.systemLogs.length = 500;
}

export function ensureUserAndWallet(
  db: PlatformDatabase,
  authUser: VerifiedFirebaseUser
): { user: PlatformUserRecord; wallet: CreditWallet } {
  const now = Date.now();
  let user = db.users[authUser.uid];
  const expectedRole = authUser.isSuperAdmin ? 'super_admin' : 'member';

  if (!user) {
    user = {
      uid: authUser.uid,
      email: authUser.email,
      emailVerified: authUser.emailVerified,
      displayName: authUser.name,
      photoURL: authUser.picture,
      role: expectedRole,
      tier: authUser.isSuperAdmin ? 'studio_pass' : 'free',
      status: 'active',
      subscriptionStartedAt: authUser.isSuperAdmin ? now : null,
      subscriptionExpiresAt: authUser.isSuperAdmin ? now + 365 * 86400_000 : null,
      onboarding: createDefaultOnboarding(),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    };
    db.users[authUser.uid] = user;
  } else {
    user.email = authUser.email || user.email;
    user.emailVerified = authUser.emailVerified;
    user.displayName = authUser.name || user.displayName;
    user.photoURL = authUser.picture ?? user.photoURL;
    // Role is ALWAYS derived strictly from verified token allowlist on login
    user.role = expectedRole;
    user.lastLoginAt = now;
    user.updatedAt = now;
    // Downgrade expired studio_pass automatically (unless super_admin)
    if (
      !authUser.isSuperAdmin &&
      user.tier === 'studio_pass' &&
      user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt < now
    ) {
      user.tier = 'free';
    }
  }

  let wallet = db.wallets[authUser.uid];
  if (!wallet) {
    const initialCredits = authUser.isSuperAdmin ? 5000 : 30;
    wallet = {
      uid: authUser.uid,
      balance: initialCredits,
      reserved: 0,
      monthlyAllowance: authUser.isSuperAdmin ? db.settings.studioPassMonthlyCredits : 30,
      totalSpent: 0,
      updatedAt: now,
    };
    db.wallets[authUser.uid] = wallet;
    db.creditLedger.unshift({
      id: `tx_${now}_${crypto.randomBytes(3).toString('hex')}`,
      uid: authUser.uid,
      type: 'grant',
      amount: initialCredits,
      balanceAfter: initialCredits,
      note: authUser.isSuperAdmin ? 'เครดิตเริ่มต้นบัญชี Super Admin' : 'เครดิตทดลองเริ่มต้นสำหรับสมาชิกใหม่',
      actorUid: 'system',
      createdAt: now,
    });
  }

  return { user, wallet };
}

// ---------- PURE UNIT-TESTABLE WALLET & LEDGER TRANSACTIONS ----------

export function reserveCredits(
  db: PlatformDatabase,
  uid: string,
  amount: number,
  jobId: string,
  modelId: string,
  note: string,
  actorUid: string
): { ok: true; wallet: CreditWallet; tx: CreditLedgerEntry } | { ok: false; error: string } {
  const cleanAmount = Math.ceil(amount);
  if (cleanAmount <= 0) {
    return { ok: false, error: 'จำนวนเครดิตที่จองต้องมากกว่า 0' };
  }
  const wallet = db.wallets[uid];
  if (!wallet) {
    return { ok: false, error: 'ไม่พบกระเป๋าเครดิตของผู้ใช้' };
  }
  if (wallet.balance < cleanAmount) {
    return {
      ok: false,
      error: `เครดิตไม่เพียงพอ (คงเหลือ ${wallet.balance} เครดิต แต่ต้องการ ${cleanAmount} เครดิต)`,
    };
  }
  const now = Date.now();
  wallet.balance -= cleanAmount;
  wallet.reserved += cleanAmount;
  wallet.updatedAt = now;

  const tx: CreditLedgerEntry = {
    id: `tx_${now}_${crypto.randomBytes(3).toString('hex')}`,
    uid,
    type: 'reserve',
    amount: -cleanAmount,
    balanceAfter: wallet.balance,
    jobId,
    modelId,
    note,
    actorUid,
    createdAt: now,
  };
  db.creditLedger.unshift(tx);
  return { ok: true, wallet, tx };
}

export function settleReservedCredits(
  db: PlatformDatabase,
  uid: string,
  reservedAmount: number,
  actualAmount: number,
  jobId: string,
  modelId: string,
  note: string,
  actorUid: string
): CreditWallet {
  const wallet = db.wallets[uid];
  const now = Date.now();
  const cleanReserved = Math.max(0, Math.ceil(reservedAmount));
  const cleanActual = Math.max(0, Math.min(cleanReserved, Math.ceil(actualAmount)));
  const refundDelta = cleanReserved - cleanActual;

  wallet.reserved = Math.max(0, wallet.reserved - cleanReserved);
  wallet.totalSpent += cleanActual;
  if (refundDelta > 0) {
    wallet.balance += refundDelta;
    db.creditLedger.unshift({
      id: `tx_${now}_${crypto.randomBytes(3).toString('hex')}`,
      uid,
      type: 'refund',
      amount: refundDelta,
      balanceAfter: wallet.balance,
      jobId,
      modelId,
      note: `${note} (คืนส่วนต่างที่ไม่ได้ใช้)`,
      actorUid,
      createdAt: now,
    });
  }
  wallet.updatedAt = now;
  db.creditLedger.unshift({
    id: `tx_${now}_${crypto.randomBytes(3).toString('hex')}`,
    uid,
    type: 'settle',
    amount: 0,
    balanceAfter: wallet.balance,
    jobId,
    modelId,
    note: `${note} (ตัดยอดจริง ${cleanActual} เครดิต)`,
    actorUid,
    createdAt: now,
  });
  return wallet;
}

export function refundReservedCredits(
  db: PlatformDatabase,
  uid: string,
  reservedAmount: number,
  jobId: string,
  modelId: string,
  note: string,
  actorUid: string
): CreditWallet {
  const wallet = db.wallets[uid];
  const now = Date.now();
  const cleanReserved = Math.max(0, Math.ceil(reservedAmount));
  wallet.reserved = Math.max(0, wallet.reserved - cleanReserved);
  wallet.balance += cleanReserved;
  wallet.updatedAt = now;
  db.creditLedger.unshift({
    id: `tx_${now}_${crypto.randomBytes(3).toString('hex')}`,
    uid,
    type: 'refund',
    amount: cleanReserved,
    balanceAfter: wallet.balance,
    jobId,
    modelId,
    note,
    actorUid,
    createdAt: now,
  });
  return wallet;
}

export function adjustCredits(
  db: PlatformDatabase,
  uid: string,
  delta: number,
  type: CreditLedgerEntry['type'],
  note: string,
  actorUid: string
): { ok: true; wallet: CreditWallet } | { ok: false; error: string } {
  const wallet = db.wallets[uid];
  if (!wallet) return { ok: false, error: 'ไม่พบกระเป๋าเครดิต' };
  const nextBal = wallet.balance + Math.trunc(delta);
  if (nextBal < 0) return { ok: false, error: 'ยอดเครดิตคงเหลือห้ามติดลบ' };
  if (nextBal > db.settings.maxCreditsBalance) {
    return { ok: false, error: `ยอดเครดิตเกินขีดจำกัดสูงสุด (${db.settings.maxCreditsBalance})` };
  }
  const now = Date.now();
  wallet.balance = nextBal;
  wallet.updatedAt = now;
  db.creditLedger.unshift({
    id: `tx_${now}_${crypto.randomBytes(3).toString('hex')}`,
    uid,
    type,
    amount: Math.trunc(delta),
    balanceAfter: wallet.balance,
    note,
    actorUid,
    createdAt: now,
  });
  return { ok: true, wallet };
}

// ---------- PURE UNIT-TESTABLE PAYMENT & ACCESS CODE LOGIC ----------

export function createManualPaymentRequest(
  db: PlatformDatabase,
  user: PlatformUserRecord,
  input: { slipImageDataUrl?: string; slipNote?: string }
): ManualPaymentRecord {
  const now = Date.now();
  const refCode = `ZK-${now.toString(36).toUpperCase().slice(-5)}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;
  const rec: ManualPaymentRecord = {
    id: `pay_${now}_${crypto.randomBytes(3).toString('hex')}`,
    uid: user.uid,
    userEmail: user.email,
    referenceCode: refCode,
    planId: 'studio_pass',
    amountThb: db.settings.studioPassPriceThb,
    currency: 'THB',
    method: 'manual_promptpay',
    slipImageDataUrl: input.slipImageDataUrl?.slice(0, 600_000),
    slipNote: input.slipNote?.slice(0, 500),
    status: 'pending',
    createdAt: now,
    expiresAt: now + db.settings.paymentExpirationMinutes * 60_000,
  };
  db.payments.unshift(rec);
  return rec;
}

export function approveManualPaymentInDb(
  db: PlatformDatabase,
  paymentId: string,
  adminUser: { uid: string; email: string }
): { ok: true; payment: ManualPaymentRecord } | { ok: false; error: string } {
  const payment = db.payments.find((p) => p.id === paymentId);
  if (!payment) return { ok: false, error: 'ไม่พบรายการชำระเงิน' };
  if (payment.status !== 'pending') {
    return { ok: false, error: `รายการนี้ถูกดำเนินการไปแล้ว (สถานะ: ${payment.status})` };
  }
  const targetUser = db.users[payment.uid];
  if (!targetUser) return { ok: false, error: 'ไม่พบบัญชีผู้ใช้ของรายการนี้' };

  const now = Date.now();
  payment.status = 'approved';
  payment.reviewedByEmail = adminUser.email;
  payment.reviewedAt = now;

  const baseStart =
    targetUser.tier === 'studio_pass' &&
    targetUser.subscriptionExpiresAt &&
    targetUser.subscriptionExpiresAt > now
      ? targetUser.subscriptionExpiresAt
      : now;

  targetUser.tier = 'studio_pass';
  targetUser.subscriptionStartedAt = targetUser.subscriptionStartedAt || now;
  targetUser.subscriptionExpiresAt = baseStart + db.settings.studioPassDays * 86400_000;
  targetUser.updatedAt = now;

  const wallet = db.wallets[payment.uid];
  if (wallet) {
    wallet.monthlyAllowance = db.settings.studioPassMonthlyCredits;
    adjustCredits(
      db,
      payment.uid,
      db.settings.studioPassMonthlyCredits,
      'grant',
      `อนุมัติ Studio Pass (${payment.referenceCode})`,
      adminUser.uid
    );
  }
  appendAuditLog(
    db,
    adminUser.uid,
    adminUser.email,
    'payment_approved',
    'payment',
    payment.id,
    `Approved Studio Pass ${payment.amountThb} THB for ${payment.userEmail}`
  );
  return { ok: true, payment };
}

export function rejectManualPaymentInDb(
  db: PlatformDatabase,
  paymentId: string,
  reason: string,
  adminUser: { uid: string; email: string }
): { ok: true; payment: ManualPaymentRecord } | { ok: false; error: string } {
  const payment = db.payments.find((p) => p.id === paymentId);
  if (!payment) return { ok: false, error: 'ไม่พบรายการชำระเงิน' };
  if (payment.status !== 'pending') {
    return { ok: false, error: `รายการนี้ถูกดำเนินการไปแล้ว (สถานะ: ${payment.status})` };
  }
  payment.status = 'rejected';
  payment.rejectReason = reason.trim() || 'หลักฐานการชำระเงินไม่ถูกต้อง';
  payment.reviewedByEmail = adminUser.email;
  payment.reviewedAt = Date.now();
  appendAuditLog(
    db,
    adminUser.uid,
    adminUser.email,
    'payment_rejected',
    'payment',
    payment.id,
    `Rejected payment (${payment.referenceCode}): ${payment.rejectReason}`
  );
  return { ok: true, payment };
}

export function redeemAccessCodeInDb(
  db: PlatformDatabase,
  codeRaw: string,
  uid: string
): { ok: true; tier: MemberTier; creditsAdded: number } | { ok: false; error: string } {
  const code = codeRaw.trim().toUpperCase();
  const rec = db.accessCodes[code];
  const now = Date.now();
  if (!rec || !rec.active) return { ok: false, error: 'รหัสใช้งานไม่ถูกต้องหรือถูกปิดใช้งานแล้ว' };
  if (rec.expiresAt > 0 && rec.expiresAt < now) {
    return { ok: false, error: 'รหัสใช้งานหมดอายุแล้ว' };
  }
  if (rec.usedCount >= rec.maxUses) {
    return { ok: false, error: 'รหัสนี้ถูกใช้งานครบจำนวนสิทธิ์แล้ว' };
  }
  if (rec.usedByUids.includes(uid)) {
    return { ok: false, error: 'คุณได้ใช้รหัสนี้ไปแล้ว' };
  }
  const user = db.users[uid];
  if (!user) return { ok: false, error: 'ไม่พบบัญชีผู้ใช้' };

  rec.usedCount += 1;
  rec.usedByUids.push(uid);
  if (rec.usedCount >= rec.maxUses) {
    rec.active = false;
  }

  if (rec.tier === 'studio_pass' && rec.days > 0) {
    const base =
      user.tier === 'studio_pass' && user.subscriptionExpiresAt && user.subscriptionExpiresAt > now
        ? user.subscriptionExpiresAt
        : now;
    user.tier = 'studio_pass';
    user.subscriptionStartedAt = user.subscriptionStartedAt || now;
    user.subscriptionExpiresAt = base + rec.days * 86400_000;
    user.updatedAt = now;
  }

  if (rec.bonusCredits > 0) {
    adjustCredits(db, uid, rec.bonusCredits, 'promo_bonus', `แลกรหัสสิทธิ์ ${code}`, uid);
  }
  appendAuditLog(db, uid, user.email, 'access_code_redeemed', 'access_code', code, `Redeemed code ${code}`);
  return { ok: true, tier: user.tier, creditsAdded: rec.bonusCredits };
}

export function verifyGatewayHmacSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !webhookSecret) return false;
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function listUserByokSummaries(db: PlatformDatabase, uid: string): ByokCredentialSummary[] {
  return Object.values(db.byok)
    .filter((b) => b.uid === uid)
    .map((b) => ({
      id: b.id,
      uid: b.uid,
      providerId: b.providerId,
      providerName: b.providerName,
      baseUrl: b.baseUrl,
      maskedKey: b.maskedKey,
      selectedModelId: b.selectedModelId,
      status: b.status,
      updatedAt: b.updatedAt,
    }));
}

export function buildAdminOverview(db: PlatformDatabase): AdminOverviewStats {
  const allUsers = Object.values(db.users);
  const now = Date.now();
  const freeUsers = allUsers.filter((u) => u.tier === 'free').length;
  const paidUsers = allUsers.filter(
    (u) => u.tier === 'studio_pass' && (!u.subscriptionExpiresAt || u.subscriptionExpiresAt > now)
  ).length;
  const expiredUsers = allUsers.filter(
    (u) => u.subscriptionExpiresAt && u.subscriptionExpiresAt <= now && u.tier === 'free'
  ).length;
  const jobs = Object.values(db.renderJobs);
  const totalCreditsUsed = Object.values(db.wallets).reduce((acc, w) => acc + w.totalSpent, 0);
  const approvedPayments = db.payments.filter((p) => p.status === 'approved');
  const totalRevenueThb = approvedPayments.reduce((acc, p) => acc + p.amountThb, 0);
  return {
    totalUsers: allUsers.length,
    freeUsers,
    paidUsers,
    expiredUsers,
    activeJobs: jobs.filter((j) => j.status === 'queued' || j.status === 'rendering' || j.status === 'qa_checking').length,
    completedJobs: jobs.filter((j) => j.status === 'completed').length,
    failedJobs: jobs.filter((j) => j.status === 'failed').length,
    totalCreditsUsed,
    estimatedApiCostUsd: Number((totalCreditsUsed * 0.0005).toFixed(4)),
    totalRevenueThb,
    pendingPayments: db.payments.filter((p) => p.status === 'pending').length,
    storageMode: 'local-server-store',
  };
}
