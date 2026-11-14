export type CartoonMode = 'story' | 'explain' | 'mix';
export type CartoonGenre =
  | 'ตลก'
  | 'ลึกลับสยองขวัญ'
  | 'ดราม่าซึ้ง'
  | 'สืบสวนตื่นเต้น'
  | 'ให้ความรู้';
export type CartoonLength = number; // Unlocked flexible length in seconds (e.g. 15–300+)
export type CartoonAudience = 'general' | 'kids' | 'worker';
export type RenderEngineMode = '3d' | '2d_paper';

export type CartoonStyleKey =
  | 'paper'
  | 'night'
  | 'rural'
  | 'bright'
  | 'cinema'
  | 'shrine'
  | 'street'
  | 'cute'
  | 'dark'
  | 'clay'
  | 'cinema_real'
  | 'custom';

export type StylePreset3D =
  | 'stylized_3d'
  | 'cinematic_3d'
  | 'semi_realistic_3d'
  | 'fantasy_3d'
  | 'dark_cinematic_3d'
  | 'clay_3d'
  | 'stop_motion_3d'
  | 'realistic_film_3d'
  | 'anime_3d'
  | 'custom_3d';

export interface Custom3DStyleConfig {
  keyLightColor: string;
  keyLightIntensity: number;
  fillLightColor: string;
  fillLightIntensity: number;
  rimLightColor: string;
  rimLightIntensity: number;
  fogColor: string;
  fogDensity: number;
  exposure: number;
  roughnessBias: number;
  metalnessBias: number;
  headScale: number;
  stopMotionFps: number;
  toonMode: boolean;
  outlineWidth: number;
}

export type CameraShotType =
  | 'establishing_wide'
  | 'extreme_wide'
  | 'medium'
  | 'closeup'
  | 'extreme_closeup'
  | 'over_the_shoulder'
  | 'low_angle'
  | 'high_angle'
  | 'birds_eye'
  | 'tracking'
  | 'dolly_in'
  | 'dolly_out'
  | 'pan'
  | 'tilt'
  | 'orbit'
  | 'crane'
  | 'pov';

export type EnvironmentPreset3D =
  | 'forest_trail'
  | 'riverside_sunset'
  | 'cozy_living_room'
  | 'neon_city_night'
  | 'thai_temple'
  | 'studio_stage';

export type AnimationClip3D =
  | 'Idle'
  | 'Walk'
  | 'Run'
  | 'Turn'
  | 'Jump'
  | 'Sit'
  | 'Talk'
  | 'LookAround'
  | 'Fear'
  | 'Smile'
  | 'Cry'
  | 'Action';

export type CartoonEnding = 'twist' | 'summary' | 'next' | 'cta' | 'open';
export type VideoLayoutMode = 'full' | 'letterbox';
export type SubtitleStyle =
  | 'sticker_dual'
  | 'red_pill'
  | 'yellow_text'
  | 'plain'
  | 'dark_box'
  | 'none';

export type LookGrade =
  | 'neutral_day'
  | 'golden_hour'
  | 'blue_hour'
  | 'overcast'
  | 'warm_interior'
  | 'cold_night'
  | 'neon_night'
  | 'tense_green'
  | 'sepia_memory'
  | 'harsh_noon'
  | 'foggy_dawn';

export type BgPreset =
  | 'paper'
  | 'sky_day'
  | 'sunset'
  | 'city_day'
  | 'city_night'
  | 'street_night'
  | 'street_day'
  | 'room'
  | 'living_room_night'
  | 'classroom'
  | 'office'
  | 'lab'
  | 'hospital'
  | 'hallway'
  | 'forest'
  | 'mountain'
  | 'ocean'
  | 'harbor_dusk'
  | 'village'
  | 'rural_night_field'
  | 'bus_night'
  | 'metro_station'
  | 'supermarket'
  | 'noodle_shop'
  | 'shrine_hall'
  | 'space'
  | 'dark_fog'
  | 'grid_tech'
  | 'plain_gradient';

export type SceneMood = 'day' | 'dusk' | 'night' | 'dark' | 'room' | 'paper';
export type ActorPose = 'idle' | 'talk' | 'scared' | 'cheer' | 'think' | 'walk' | 'sit' | 'hold_flower';
export type ActorFace =
  | 'happy'
  | 'sad'
  | 'scared'
  | 'surprised'
  | 'neutral'
  | 'smirk'
  | 'angry'
  | 'worried';

export type SceneFx = 'none' | 'rain' | 'snow' | 'sparkles' | 'fog' | 'dust' | 'flicker';
export type CameraMove = 'static' | 'push_in' | 'pull_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'shake';
export type ShotScale = 'wide' | 'medium' | 'close';
export type SceneTransition = 'cut' | 'fade' | 'slide_left' | 'slide_up' | 'zoom' | 'wipe' | 'flash';

export type CardType =
  | 'text'
  | 'title_card'
  | 'bignumber'
  | 'bar_chart'
  | 'list'
  | 'checklist'
  | 'compare'
  | 'line_chart'
  | 'map_route'
  | 'metro_map'
  | 'phone_mockup'
  | 'notebook'
  | 'stamp'
  | 'source_note'
  | 'end';

export type HairStyle = 'short' | 'long' | 'bun' | 'ponytail' | 'curly' | 'cap' | 'bald';
export type OutfitType =
  | 'tshirt'
  | 'hoodie'
  | 'dress'
  | 'suit'
  | 'uniform'
  | 'coat'
  | 'apron'
  | 'plaid_shirt';
export type AccessoryType =
  | 'glasses'
  | 'hat'
  | 'flower_hat'
  | 'bag'
  | 'scarf'
  | 'mask'
  | 'headphones'
  | 'badge'
  | 'backpack';

export type SfxName =
  | 'whoosh'
  | 'hit'
  | 'boom'
  | 'siren'
  | 'footstep'
  | 'click'
  | 'pop'
  | 'wind'
  | 'rain'
  | 'heartbeat'
  | 'door'
  | 'ding'
  | 'glitch'
  | 'laugh'
  | 'sparkle'
  | 'alarm'
  | 'typing'
  | 'coin'
  | 'error'
  | 'tick'
  | 'stamp'
  | 'paper';

export type AmbientType = 'none' | 'wind' | 'rain' | 'city' | 'room' | 'forest' | 'night_insects';
export type PovType = 'none' | 'hand_phone' | 'hand_pencil' | 'hand_hold' | 'hand_point';

export interface CharacterDef {
  id: string;
  name: string;
  role?: string;
  gender?: 'male' | 'female' | 'neutral';
  species?: 'human' | 'cat' | 'dog' | 'robot';
  age?: 'child' | 'teen' | 'adult' | 'elder';
  body?: 'slim' | 'normal' | 'chubby';
  proportion3d?: 'chibi' | 'stylized' | 'realistic';
  personality?: string;
  walkStyle?: 'normal' | 'energetic' | 'cautious' | 'elder';
  signaturePose?: AnimationClip3D;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants?: string;
  shoes?: string;
  outfit?: OutfitType;
  outfitAccent?: string;
  glasses?: boolean;
  accessories?: AccessoryType[];
  // Optional GLB/GLTF 3D model stored in IndexedDB
  glbAssetId?: string;
  glbFileName?: string;
  glbHasSkeleton?: boolean;
  glbClipNames?: string[];
  // Per-character voice mapping
  preferredVoiceId?: string;
}

export interface ActorDef {
  char: string;
  x: number;
  y?: number;
  z?: number;
  rotY?: number;
  scale?: number;
  pose: ActorPose;
  clip3d?: AnimationClip3D;
  face: ActorFace;
  flip: boolean;
  lookTarget?: 'camera' | 'left' | 'right' | 'center';
  moveTo?: { x: number; y?: number; z?: number; atText?: string };
}

export interface ChatBubbleItem {
  sender?: string;
  text?: string;
  mine?: boolean;
  system?: boolean;
  flowerCard?: { title: string; subtitle?: string; bgColor: string; flowerColor: string };
  stickerCat?: boolean;
  readCount?: string;
  time?: string;
  atText?: string;
}

export interface CardDef {
  type: CardType;
  text: string;
  label?: string;
  sublabel?: string;
  items?: string[];
  badge?: string;
  at?: string;
  atText?: string;
  x?: number;
  y?: number;
  values?: number[];
  labels?: string[];
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
  chatTitle?: string;
  chatSubtitle?: string;
  typingText?: string;
  messages?: ChatBubbleItem[];
  dayBadge?: string;
  stations?: Array<{ name: string; x: number; y: number; active?: boolean }>;
  lineColor?: string;
  source?: string;
  stampColor?: string;
}

export interface SceneProp {
  kind:
    | 'door'
    | 'phone'
    | 'sign'
    | 'cat'
    | 'flower_bouquet'
    | 'window'
    | 'sofa'
    | 'lamp'
    | 'walkie_talkie'
    | 'lantern'
    | 'candle'
    | 'noodle_pot'
    | 'clock'
    | 'book'
    | 'photo_wall'
    | 'tree'
    | 'rock'
    | 'bench'
    | 'table';
  x: number;
  y: number;
  z?: number;
  scale?: number;
  text?: string;
  color?: string;
  atText?: string;
}

export interface SfxCue {
  name: SfxName;
  atText?: string;
  gain?: number;
}

export interface SceneLook {
  grade: LookGrade;
  keyLightDir?: 'left' | 'right' | 'top' | 'center';
  keyLightColor?: string;
  keyLightIntensity?: number;
  practicals?: Array<{ x: number; y: number; radius?: number; color?: string; flicker?: boolean }>;
  fog?: number;
  godrays?: number;
  bloom?: number;
  vignette?: number;
}

export interface EnvironmentConfig3D {
  preset: EnvironmentPreset3D;
  timeOfDay?: 'dawn' | 'day' | 'golden' | 'dusk' | 'night';
  fogDensity?: number; // 0 - 1
  windStrength?: number; // 0 - 1
  rainIntensity?: number; // 0 - 1
  dustAmount?: number; // 0 - 1
  sunRays?: number; // 0 - 1
  treesDensity?: number; // 0 - 1
  waterRipple?: boolean;
}

export interface SceneVoiceOverride {
  providerId?: TtsProviderId;
  voiceId?: string;
  voiceName?: string;
  emotion?: VoiceEmotion;
  styleInstruction?: string;
  speed?: number; // 0.6 - 1.6
  pitch?: number; // -6 to +6
  emphasis?: 'low' | 'normal' | 'strong';
}

export interface SceneDef {
  id?: string;
  title?: string;
  storyBeat?: string;
  narration: string;
  subtitleEn?: string;
  mood: SceneMood;
  bgPreset?: BgPreset;
  env3d?: EnvironmentConfig3D;
  blurBg?: boolean;
  shot?: ShotScale;
  shotType3d?: CameraShotType;
  shotReason?: string;
  camera?: CameraMove;
  transition?: SceneTransition;
  hudText?: string;
  holdAfter?: number;
  syncOffset?: number;
  manualDurationSec?: number;
  voiceConfig?: SceneVoiceOverride;
  actors: ActorDef[];
  props?: SceneProp[];
  pov?: PovType;
  card: CardDef | null;
  extraCards?: CardDef[];
  fx: SceneFx;
  sfx?: SfxCue[];
  ambient?: AmbientType;
  look?: SceneLook;
  hl: string[];
}

export interface MusicConfig {
  mood: 'calm' | 'tense' | 'happy' | 'epic' | 'sad' | 'mystery' | 'warm';
  bpm: number;
  key: 'C' | 'D' | 'E' | 'F' | 'G' | 'A';
  mode: 'major' | 'minor';
  quietScenes?: number[];
}

export interface ProductionPlanMeta {
  logline?: string;
  storyStructure?: Array<{ act: string; summary: string }>;
  environmentSummary?: string;
  aiNotes?: string;
  approvedAt?: number;
}

export interface CartoonProject {
  id?: string;
  title: string;
  renderEngine?: RenderEngineMode;
  style3d?: StylePreset3D;
  customStyle3d?: Partial<Custom3DStyleConfig>;
  style: CartoonStyleKey;
  customStyleDesc?: string;
  end: CartoonEnding;
  layout?: VideoLayoutMode;
  letterbox?: {
    topText: string;
    bottomText: string;
  };
  subtitleStyle?: SubtitleStyle;
  hud?: {
    enabled: boolean;
    startText: string;
    showDot?: boolean;
  };
  cineLayer?: {
    enabled: boolean;
    defaultGrade?: LookGrade;
  };
  clay?: {
    stopmotionFps?: number;
  };
  series?: {
    ep: number;
    total: number;
    recap?: string;
  };
  paletteOverrides?: {
    bg?: string;
    surface?: string;
    accent?: string;
    highlight?: string;
    ink?: string;
  };
  music?: MusicConfig;
  sourceNotes?: string[];
  globalOffset?: number;
  productionPlan?: ProductionPlanMeta;
  characters: CharacterDef[];
  scenes: SceneDef[];
  sceneDurations?: number[];
}

export interface TimelineSegment {
  a: number;
  b: number;
  speechEnd: number;
  s: SceneDef;
  index: number;
}

export interface PauseCandidate {
  midSec: number;
  durSec: number;
}

export interface SyncDiagnostics {
  foundPauses: number;
  matchedBoundaries: number;
  totalBoundaries: number;
  mode: 'manual' | 'per-scene-tts' | 'pause-matched' | 'weighted-audio' | 'estimated';
}

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

// Multi-provider AI & TTS types (ZKatoon Part A)
export type AiScriptProvider = 'openrouter' | 'openai' | 'gemini_byok' | 'server_gemini';
export type TtsProviderId =
  | 'openrouter'
  | 'elevenlabs'
  | 'azure'
  | 'google_cloud'
  | 'openai'
  | 'custom_http';

export type VoiceGender = 'male' | 'female' | 'neutral';
export type VoiceAgeGroup = 'teen' | 'adult' | 'elder';
export type VoicePitchTone = 'deep' | 'medium' | 'high';
export type VoiceRoleType = 'narrator' | 'character' | 'storyteller';
export type VoiceStyleTone = 'polite' | 'casual' | 'serious';
export type VoiceEmotion = 'neutral' | 'energetic' | 'excited' | 'sad' | 'whisper' | 'warm' | 'tense';

export interface VoiceOption {
  id: string;
  name: string;
  providerId: TtsProviderId;
  locale: string;
  gender?: VoiceGender;
  ageGroup?: VoiceAgeGroup;
  pitchTone?: VoicePitchTone;
  roleType?: VoiceRoleType;
  styleTone?: VoiceStyleTone;
  supportedEmotions?: VoiceEmotion[];
  supportsStyleInstruction?: boolean;
  supportsPhonemeTiming?: boolean;
  previewUrl?: string;
  description?: string;
}

export interface VoicePreset {
  id: string;
  name: string;
  providerId: TtsProviderId;
  voiceId: string;
  voiceName: string;
  gender: VoiceGender;
  ageGroup: VoiceAgeGroup;
  pitchTone: VoicePitchTone;
  roleType: VoiceRoleType;
  styleTone: VoiceStyleTone;
  emotion: VoiceEmotion;
  speed: number;
  weight: number; // emphasis/volume weight 0.5 - 1.5
  emphasis: 'low' | 'normal' | 'strong';
  styleInstruction: string;
  createdAt: number;
}

export interface PronunciationEntry {
  id: string;
  word: string;
  reading: string;
  note?: string;
}

export interface PhonemeMark {
  timeSec: number;
  endSec?: number;
  value: string;
  openness: number; // 0..1 mouth openness
}

export interface SceneAudioRecord {
  key: string; // `${workspaceId}::${projectId}::${sceneId}`
  workspaceId: string;
  projectId: string;
  sceneId: string;
  providerId: TtsProviderId;
  voiceId: string;
  voiceName: string;
  emotion: VoiceEmotion;
  textRaw: string;
  textPrepared: string;
  audioBlob: Blob;
  mimeType: string;
  durationSec: number;
  envelope: number[];
  phonemeMarks?: PhonemeMark[];
  generatedAt: number;
}

export interface GlbAssetRecord {
  id: string;
  workspaceId: string;
  fileName: string;
  blob: Blob;
  sizeBytes: number;
  hasSkeleton: boolean;
  boneNames: string[];
  clipNames: string[];
  uploadedAt: number;
}

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  isFree: boolean;
  supportsAudio?: boolean;
  contextLength?: number;
  promptPrice?: string;
}

export type PerformancePreset = 'low' | 'balanced' | 'high' | 'ultra';
export type ExportFps = 24 | 30 | 60;

export interface HardwareCapabilities {
  webgl2: boolean;
  webgl1: boolean;
  isSoftwareGl: boolean;
  rendererName: string;
  deviceMemoryGB: number | null;
  hardwareConcurrency: number;
  webCodecsSupported: boolean;
  mp4H264Supported: boolean;
  aacSupported: boolean;
  webmFallbackSupported: boolean;
  maxRecommendedFps: ExportFps;
  recommendedPreset: PerformancePreset;
}

export interface DirectorOptions {
  targetDurationSec: number;
  sceneCount: number;
  resolution: '720' | '1080';
  style3d: StylePreset3D;
  detailLevel: number; // 1..5
  realismLevel: number; // 1..5
  motionSpeed: number; // 0.6..1.5
  characterCount: number; // 1..6
  cameraComplexity: number; // 1..5
  fxLevel: number; // 0..5
}

export interface StudioSelection {
  mode: CartoonMode;
  genre: CartoonGenre;
  len: CartoonLength;
  audience: CartoonAudience;
  renderEngine: RenderEngineMode;
  style3d: StylePreset3D;
  style: CartoonStyleKey;
  layout: VideoLayoutMode;
  topText: string;
  bottomText: string;
  subtitleStyle: SubtitleStyle;
  hudEnabled: boolean;
  cineEnabled: boolean;
  end: CartoonEnding;
  director: DirectorOptions;
}

export interface StudioSettings {
  // Script AI
  aiProvider: AiScriptProvider;
  openRouterModel: string;
  openAiScriptModel: string;
  geminiByokModel: string;
  allowPaidOpenRouter: boolean;
  // TTS Multi-Provider
  ttsProvider: TtsProviderId;
  ttsVoiceId: string;
  ttsVoiceName: string;
  openRouterTtsModel: string;
  azureRegion: string;
  openAiTtsModel: string;
  customTtsEndpoint: string;
  customTtsHeaderName: string;
  customTtsHeaderPrefix: string;
  customTtsBodyTemplate: string;
  // Voice Style defaults
  voiceEmotion: VoiceEmotion;
  voiceStyle: string;
  voiceSpeed: number;
  // 3D Performance & Export
  performancePreset: PerformancePreset;
  previewQuality: PerformancePreset;
  defaultRes: '720' | '1080';
  exportFps: ExportFps;
  subtitleScale: 'normal' | 'large';
  enableBgmAndSfx: boolean;
}

export interface WorkspaceSecrets {
  openRouterKey?: string;
  openAiKey?: string;
  geminiKey?: string;
  elevenLabsKey?: string;
  azureSpeechKey?: string;
  googleCloudTtsKey?: string;
  customTtsKey?: string;
}

export interface WorkspaceMeta {
  id: string;
  name: string;
  deviceId: string;
  createdAt: number;
  updatedAt: number;
  hasPassphrase: boolean;
  saltB64?: string;
  keyCheckCipherB64?: string;
  keyCheckIvB64?: string;
  encryptedSecretsCipherB64?: string;
  encryptedSecretsIvB64?: string;
  // Unencrypted secrets kept in session only or plain IndexedDB when no PIN lock is active
  plainSecrets?: WorkspaceSecrets;
}

export interface SavedProjectRecord {
  id: string;
  workspaceId?: string;
  title: string;
  data: CartoonProject;
  audio: ArrayBuffer | null;
  ext: string;
  video: Blob | null;
  thumb: string | null;
  at: number;
}
