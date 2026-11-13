export type CartoonMode = 'story' | 'explain' | 'mix';
export type CartoonGenre =
  | 'ตลก'
  | 'ลึกลับสยองขวัญ'
  | 'ดราม่าซึ้ง'
  | 'สืบสวนตื่นเต้น'
  | 'ให้ความรู้';
export type CartoonLength = 30 | 60 | 90 | 150;
export type CartoonAudience = 'general' | 'kids' | 'worker';

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
  species?: 'human' | 'cat' | 'dog' | 'robot';
  age?: 'child' | 'teen' | 'adult' | 'elder';
  body?: 'slim' | 'normal' | 'chubby';
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  pants?: string;
  outfit?: OutfitType;
  outfitAccent?: string;
  glasses?: boolean;
  accessories?: AccessoryType[];
}

export interface ActorDef {
  char: string;
  x: number;
  y?: number;
  scale?: number;
  pose: ActorPose;
  face: ActorFace;
  flip: boolean;
  moveTo?: { x: number; y?: number; atText?: string };
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
  // Chart / compare / phone / metro / map extras
  values?: number[];
  labels?: string[];
  leftTitle?: string;
  rightTitle?: string;
  leftItems?: string[];
  rightItems?: string[];
  // Phone mockup (LINE/Chat style matching reference video)
  chatTitle?: string;
  chatSubtitle?: string;
  typingText?: string;
  messages?: ChatBubbleItem[];
  dayBadge?: string;
  // Metro / route
  stations?: Array<{ name: string; x: number; y: number; active?: boolean }>;
  lineColor?: string;
  // Source / stamp
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
    | 'photo_wall';
  x: number;
  y: number;
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

export interface SceneDef {
  id?: string;
  narration: string;
  subtitleEn?: string;
  mood: SceneMood;
  bgPreset?: BgPreset;
  blurBg?: boolean;
  shot?: ShotScale;
  camera?: CameraMove;
  transition?: SceneTransition;
  hudText?: string;
  holdAfter?: number;
  syncOffset?: number;
  manualDurationSec?: number;
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

export interface CartoonProject {
  title: string;
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

export type AiScriptProvider = 'gemini' | 'openrouter';
export type TtsProvider = 'gemini' | 'pythai' | 'openai_compatible';
export type PyThaiModelType = 'khanomtan' | 'lunar' | 'edge_bridge' | 'mms' | 'custom';

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  isFree: boolean;
  contextLength?: number;
  promptPrice?: string;
}

export interface StudioSelection {
  mode: CartoonMode;
  genre: CartoonGenre;
  len: CartoonLength;
  audience: CartoonAudience;
  style: CartoonStyleKey;
  layout: VideoLayoutMode;
  topText: string;
  bottomText: string;
  subtitleStyle: SubtitleStyle;
  hudEnabled: boolean;
  cineEnabled: boolean;
  end: CartoonEnding;
}

export interface StudioSettings {
  // Script AI
  aiProvider: AiScriptProvider;
  openRouterModel: string;
  rememberOpenRouterKey: boolean;
  allowPaidOpenRouter: boolean;
  // TTS
  ttsProvider: TtsProvider;
  voiceName: VoiceName;
  voiceStyle: string;
  pythaiEndpoint: string;
  pythaiModel: PyThaiModelType;
  pythaiSpeaker: string;
  customTtsEndpoint: string;
  customTtsModel: string;
  customTtsVoice: string;
  // Render / Audio / Export
  defaultRes: '720' | '1080';
  subtitleScale: 'normal' | 'large';
  enableBgmAndSfx: boolean;
}

export interface SavedProjectRecord {
  id: string;
  title: string;
  data: CartoonProject;
  audio: ArrayBuffer | null;
  ext: string;
  video: Blob | null;
  thumb: string | null;
  at: number;
}
