export const SUPER_ADMIN_ALLOWLIST = [
  'zbcd1053@gmail.com',
  'zeetosit@gmail.com',
] as const;

export type MemberTier = 'free' | 'studio_pass';
export type UserAccountStatus = 'active' | 'suspended';
export type AppRole = 'member' | 'super_admin';

export type OnboardingVideoType =
  | 'ai_cartoon'
  | '2d_animation'
  | '3d_animation'
  | 'claymation'
  | 'explainer_video'
  | 'historical_animation'
  | 'map_animation'
  | 'geography'
  | 'documentary'
  | 'cinematic'
  | 'product_ad'
  | 'social_shorts'
  | 'whiteboard'
  | 'custom_project';

export type AnimateStylePluginId =
  | 'none'
  | 'cut_paper'
  | 'crosshatch'
  | 'riso_print'
  | 'sketchbook'
  | 'math_animation'
  | 'pixel_art'
  | 'isometric'
  | '2d_cartoon'
  | '3d_cartoon'
  | 'clay_3d'
  | 'cinema_realistic'
  | 'custom_reference';

export type OnboardingAspect = '9:16' | '16:9' | '1:1' | '4:5';
export type OnboardingLanguage = 'th' | 'en' | 'multilingual' | 'custom';
export type OnboardingAudioPref =
  | 'ai_voice'
  | 'upload_voice'
  | 'music_only'
  | 'no_audio'
  | 'voice_music_sfx';

export interface OnboardingDefaults {
  completed: boolean;
  videoType: OnboardingVideoType;
  style: AnimateStylePluginId;
  durationSec: number;
  aspect: OnboardingAspect;
  language: OnboardingLanguage;
  customLanguage?: string;
  audioPref: OnboardingAudioPref;
  preferredPlan: MemberTier;
  updatedAt: number;
}

export interface PlatformUserRecord {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoURL?: string | null;
  role: AppRole;
  tier: MemberTier;
  status: UserAccountStatus;
  subscriptionStartedAt?: number | null;
  subscriptionExpiresAt?: number | null;
  onboarding: OnboardingDefaults;
  createdAt: number;
  updatedAt: number;
  lastLoginAt: number;
}

export interface CreditWallet {
  uid: string;
  balance: number;
  reserved: number;
  monthlyAllowance: number;
  totalSpent: number;
  updatedAt: number;
}

export type CreditTxType =
  | 'grant'
  | 'monthly_reset'
  | 'reserve'
  | 'settle'
  | 'refund'
  | 'admin_adjust'
  | 'promo_bonus';

export interface CreditLedgerEntry {
  id: string;
  uid: string;
  type: CreditTxType;
  amount: number;
  balanceAfter: number;
  jobId?: string;
  modelId?: string;
  note: string;
  actorUid: string;
  createdAt: number;
}

export type ModelCategory =
  | 'LLM'
  | 'Vision'
  | 'Image Generation'
  | 'Image Editing'
  | 'Text-to-Speech'
  | 'Speech-to-Text'
  | 'Audio Generation'
  | 'Video Generation'
  | 'Video Editing'
  | 'Embedding'
  | 'Animation'
  | 'Map Rendering';

export type ProviderTypeId =
  | 'openrouter'
  | 'google_gemini'
  | 'openai'
  | 'anthropic'
  | 'openai_compatible';

export interface ProviderConfig {
  id: string;
  type: ProviderTypeId;
  name: string;
  baseUrl: string;
  enabled: boolean;
  supportsModelFetch: boolean;
  supportsBalanceCheck: boolean;
  whitelistedHosts: string[];
  lastTestedAt?: number;
  lastTestStatus?: 'ok' | 'error' | 'not_configured';
  lastTestMessage?: string;
}

export interface ModelRegistryItem {
  id: string;
  providerId: string;
  displayName: string;
  apiModelId: string;
  category: ModelCategory;
  capabilities: string[];
  promptPricePerM: number;
  completionPricePerM: number;
  creditCostPerCall: number;
  contextLength: number;
  maxOutputTokens: number;
  supportedLanguages: string[];
  inputFormats: string[];
  outputFormats: string[];
  availability: 'available' | 'limited' | 'unavailable';
  isFreeTierModel: boolean;
  active: boolean;
  isDefaultBrain?: boolean;
  isDefaultVoice?: boolean;
  fallbackModelId?: string;
  allowedTiers: MemberTier[];
  docsUrl: string;
}

export interface ByokCredentialSummary {
  id: string;
  uid: string;
  providerId: string;
  providerName: string;
  baseUrl: string;
  maskedKey: string;
  selectedModelId: string;
  status: 'active' | 'invalid';
  updatedAt: number;
}

export interface ManualPaymentRecord {
  id: string;
  uid: string;
  userEmail: string;
  referenceCode: string;
  planId: 'studio_pass';
  amountThb: number;
  currency: 'THB';
  method: 'manual_promptpay' | 'gateway';
  gatewayProvider?: string;
  gatewaySessionId?: string;
  slipImageDataUrl?: string;
  slipNote?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  rejectReason?: string;
  reviewedByEmail?: string;
  reviewedAt?: number;
  createdAt: number;
  expiresAt: number;
}

export interface AccessCodeRecord {
  code: string;
  tier: MemberTier;
  days: number;
  bonusCredits: number;
  maxUses: number;
  usedCount: number;
  usedByUids: string[];
  active: boolean;
  expiresAt: number;
  createdByEmail: string;
  createdAt: number;
}

export interface SystemSettings {
  websiteName: string;
  tagline: string;
  splashDurationMs: number;
  primaryAccent: string;
  secondaryAccent: string;
  maintenanceMode: boolean;
  requireEmailVerification: boolean;
  studioPassPriceThb: number;
  studioPassDays: number;
  studioPassMonthlyCredits: number;
  maxCreditsBalance: number;
  freeMaxConcurrentJobs: number;
  paidMaxConcurrentJobs: number;
  freeMaxDurationSec: number;
  paidMaxDurationSec: number;
  freeMaxResolution: '720p' | '1080p';
  paidMaxResolution: '720p' | '1080p' | '1440p' | '4k';
  defaultFps: 24 | 30 | 60;
  creditRates: {
    perVideoBase: number;
    perSecond: number;
    perImage: number;
    perAudioClip: number;
    multiplier1080p: number;
    multiplier1440p: number;
    multiplier4k: number;
  };
  defaultBrainModel: string;
  defaultBrainProvider: string;
  fallbackBrainModel: string;
  defaultVoiceModel: string;
  defaultVoiceProvider: string;
  manualPaymentEnabled: boolean;
  promptPayId: string;
  promptPayAccountName: string;
  bankAccountInfo: string;
  promptPayQrDataUrl: string;
  paymentExpirationMinutes: number;
  promoBannerText: string;
  gatewayEnabled: boolean;
  gatewayProvider: 'none' | 'stripe' | 'omise' | 'custom_webhook';
  gatewayConfigured: boolean;
  mapTileStyleUrl: string;
  mapAttribution: string;
  allowedCustomHosts: string[];
  featureFlags: {
    onboardingWizard: boolean;
    workflowEditor: boolean;
    mapEngine: boolean;
    animatePlugins: boolean;
    pageBuilder: boolean;
    serverRenderQueue: boolean;
    cloudProjectSync: boolean;
  };
}

export type QaStatus = 'PASS' | 'WARNING' | 'FAILED';

export interface RenderQaReport {
  status: QaStatus;
  checkedAt: number;
  resolution: string;
  nativeResolution: string;
  upscaled: boolean;
  fps: number;
  durationSec: number;
  frameCount: number;
  blackFrameSegments: number;
  blankFramesDetected: boolean;
  missingAssets: string[];
  hasAudioTrack: boolean;
  audioDurationSec: number;
  audioSyncDeltaSec: number;
  textOverflowWarnings: string[];
  safeAreaWarnings: string[];
  renderIntegrityOk: boolean;
  notes: string[];
}

export interface ServerRenderJob {
  id: string;
  uid: string;
  projectId: string;
  projectTitle: string;
  aspect: OnboardingAspect;
  resolution: '720p' | '1080p' | '1440p' | '4k';
  nativeResolution: string;
  upscaled: boolean;
  fps: 24 | 30 | 60;
  durationSec: number;
  status: 'queued' | 'rendering' | 'qa_checking' | 'completed' | 'failed' | 'cancelled';
  progressPct: number;
  reservedCredits: number;
  settledCredits: number;
  outputFilePath?: string;
  outputByteSize?: number;
  qaReport?: RenderQaReport;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuditLogRecord {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: number;
}

export interface SystemLogRecord {
  id: string;
  level: 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  createdAt: number;
}

export type PageBlockType =
  | 'header'
  | 'hero'
  | 'text'
  | 'image'
  | 'video'
  | 'gallery'
  | 'feature_cards'
  | 'pricing'
  | 'faq'
  | 'testimonials'
  | 'cta'
  | 'contact_form'
  | 'footer'
  | 'custom_section';

export interface PageBlockItem {
  id: string;
  type: PageBlockType;
  title: string;
  subtitle?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  mediaUrl?: string;
  widthCols: 12 | 6 | 4;
  items?: Array<{ title: string; description: string; badge?: string }>;
}

export interface CmsPageVersion {
  version: number;
  savedAt: number;
  savedByEmail: string;
  blocks: PageBlockItem[];
  seoTitle: string;
  seoDescription: string;
}

export interface CmsPageRecord {
  id: string;
  slug: string;
  title: string;
  status: 'draft' | 'published';
  seoTitle: string;
  seoDescription: string;
  blocks: PageBlockItem[];
  versions: CmsPageVersion[];
  updatedAt: number;
}

export interface MapWaypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  pitch: number;
  bearing: number;
  durationSec: number;
  narration: string;
}

export interface MapAnimationProject {
  id: string;
  title: string;
  category:
    | 'world_map'
    | 'country_map'
    | 'city_map'
    | 'historical_map'
    | 'geography'
    | 'war_history'
    | 'travel_route'
    | 'flight_path'
    | 'border_changes';
  projection: 'mercator' | 'globe';
  waypoints: MapWaypoint[];
  showRoutePath: boolean;
  routeColor: string;
}

export interface AdminOverviewStats {
  totalUsers: number;
  freeUsers: number;
  paidUsers: number;
  expiredUsers: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalCreditsUsed: number;
  estimatedApiCostUsd: number;
  totalRevenueThb: number;
  pendingPayments: number;
  storageMode: 'firestore-admin' | 'local-server-store';
}
