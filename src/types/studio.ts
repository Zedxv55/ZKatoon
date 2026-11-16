export type StoryMode = 'story' | 'explainer' | 'mix';
export type VideoLayout = 'portrait_full' | 'portrait_letterbox' | 'landscape';
export type StylePackId = 'A' | 'B' | 'C' | 'custom';
export type EndingType = 'twist' | 'summary' | 'next' | 'cta';
export type SubtitleMode =
  | 'yellow_highlight'
  | 'red_pill'
  | 'white_plain'
  | 'dark_box'
  | 'capsule_highlight';

export type BgPresetId =
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
  | 'paper'
  | 'plain_gradient';

export type PoseId =
  | 'idle'
  | 'walk'
  | 'run'
  | 'talk'
  | 'point'
  | 'scared'
  | 'jump'
  | 'sit'
  | 'wave'
  | 'think'
  | 'cheer'
  | 'cry'
  | 'fall'
  | 'hide';

export type FaceId =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'scared'
  | 'neutral'
  | 'smirk'
  | 'sleepy'
  | 'love';

export type SpeciesId = 'human' | 'cat' | 'dog' | 'robot' | 'zombie';
export type AgeGroupId = 'kid' | 'teen' | 'adult' | 'elder';
export type BodyShapeId = 'slim' | 'normal' | 'round';
export type HairStyleId = 'short' | 'long' | 'bun' | 'ponytail' | 'curly' | 'cap' | 'bald';
export type OutfitStyleId =
  | 'tshirt'
  | 'hoodie'
  | 'dress'
  | 'suit'
  | 'uniform'
  | 'coat'
  | 'apron'
  | 'plaid_shirt';
export type AccessoryId =
  | 'glasses'
  | 'hat'
  | 'bag'
  | 'scarf'
  | 'mask'
  | 'headphones'
  | 'badge'
  | 'backpack';

export type CameraTypeId =
  | 'static'
  | 'push_in'
  | 'pull_out'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'shake';
export type ShotTypeId = 'wide' | 'medium' | 'close';

export type FxTypeId =
  | 'rain'
  | 'snow'
  | 'fog'
  | 'sparkles'
  | 'flash'
  | 'vignette'
  | 'flicker'
  | 'speedlines'
  | 'dust'
  | 'confetti'
  | 'embers'
  | 'fireflies';

export type TransitionTypeId =
  | 'cut'
  | 'fade'
  | 'slide_left'
  | 'slide_up'
  | 'zoom'
  | 'wipe'
  | 'flash';

export type SfxTypeId =
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

export type AmbientTypeId = 'none' | 'wind' | 'rain' | 'city' | 'room' | 'forest' | 'night_insects';
export type MusicMoodId = 'calm' | 'tense' | 'happy' | 'epic' | 'sad' | 'mystery';
export type LookGradeId =
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

export type PovId = null | 'hand_phone' | 'hand_pencil' | 'hand_hold' | 'hand_point';

export type CardTypeId =
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
  | 'end_card'
  | 'speech_bubble'
  | 'thought_bubble'
  | 'year_chip'
  | 'time_tag'
  | 'source_chip';

export interface PaletteColor {
  hex: string;
  role: string;
}

export interface StudioCharacter {
  id: string;
  name: string;
  role: 'main' | 'support' | 'extra';
  personality: string;
  species: SpeciesId;
  age: AgeGroupId;
  body: BodyShapeId;
  skin: string;
  hair: { style: HairStyleId; color: string };
  outfit: { type: OutfitStyleId; color: string; accent: string };
  accessories: AccessoryId[];
  signature: string;
  locked: boolean;
  voiceId?: string;
}

export interface SceneActor {
  char: string;
  x: number;
  y: number;
  scale: number;
  pose: PoseId;
  face: FaceId;
  flip: boolean;
  moveTo?: { x: number; y: number; atText: string };
}

export interface ScenePropItem {
  name: string;
  emoji?: string;
  x: number;
  y: number;
  size: number;
  text?: string;
  appearAtText?: string;
}

export interface StudioCard {
  type: CardTypeId;
  atText?: string;
  dur?: number;
  text?: string;
  subline?: string;
  style?: string;
  label?: string;
  title?: string;
  bars?: Array<{ label: string; value: number }>;
  items?: Array<string | { text: string; state?: 'done' | 'locked' | 'pending' }>;
  left?: { title: string; items: string[] };
  right?: { title: string; items: string[] };
  points?: Array<{ x: string; y: number }>;
  callouts?: string[];
  from?: string;
  to?: string;
  region?: string;
  lines?: string[] | Array<{ name: string; color: string; stations: string[] }>;
  stations?: number;
  highlight?: string;
  route?: string[];
  screen?: 'chat' | 'feed' | 'call' | 'locked';
  messages?: Array<{ sender: string; text: string; mine?: boolean; time?: string; read?: boolean }>;
  accent?: string;
  angle?: number;
  badge?: string;
  headline?: string;
  cta?: string;
  icon?: string;
  cover?: string;
  tag?: string;
  author?: string;
}

export interface SceneSfxCue {
  name?: SfxTypeId;
  assetId?: string;
  atText?: string;
  vol: number;
}

export interface SceneLookConfig {
  grade: LookGradeId;
  key_light: { dir: 'left' | 'right' | 'top' | 'center'; color: string; intensity: number; softness: number };
  practicals: Array<{ x: number; y: number; color: string; radius: number }>;
  fog: number;
  godrays: number;
  bloom: number;
  dof: number;
  grain: number;
  vignette: number;
}

export interface StudioScene {
  id: string;
  narration: string;
  speech?: string;
  speaker?: 'narrator' | string;
  subtitle?: null | string;
  highlightWords: string[];
  holdAfter: number;
  syncOffset?: number;
  bg: { preset: BgPresetId; tint?: string; colors?: string[] };
  blurBg: boolean;
  hud: Record<string, string | number>;
  actors: SceneActor[];
  props: ScenePropItem[];
  pov: PovId;
  cards: StudioCard[];
  camera: { type: CameraTypeId; shot: ShotTypeId };
  fx: Array<{ type: FxTypeId; intensity: number }>;
  sfx: SceneSfxCue[];
  ambient: AmbientTypeId;
  transition: TransitionTypeId;
  look?: SceneLookConfig;
  visualIntent: string;
  audio?: { assetId?: string; durationSec?: number; stale?: boolean; sourceText?: string };
}

export interface EpisodeChapter {
  id: string;
  title: string;
  sceneIds: string[];
}

export interface EpisodeMusic {
  mood: MusicMoodId;
  bpm: number;
  key: 'C' | 'D' | 'E' | 'F' | 'G' | 'A';
  mode: 'major' | 'minor';
  swells: number[];
  quietScenes: number[];
  endStyle: 'resolve' | 'sting' | 'fade';
}

export interface StudioEpisode {
  id: string;
  ep: number;
  total: number;
  title: string;
  chapters: EpisodeChapter[];
  scenes: StudioScene[];
  music: EpisodeMusic;
  endingType: EndingType;
}

export interface ProjectSettings {
  subtitleMode: SubtitleMode;
  letterboxTopText: string;
  letterboxBottomText: string;
  sourceNotes: string[];
  cinematicEnabled: boolean;
  hudEnabled: boolean;
  fps: 24 | 30;
  resolution: '540p' | '720p' | '1080p';
}

export interface StudioProject {
  id: string;
  title: string;
  mode: StoryMode;
  layout: VideoLayout;
  stylePack: StylePackId;
  animateStyle?: string;
  customStyleDesc?: string;
  palette: PaletteColor[];
  characters: StudioCharacter[];
  episodes: StudioEpisode[];
  seriesBible: {
    recap: string;
    lockedCharacterIds: string[];
  };
  settings: ProjectSettings;
  fullScript?: string;
  updatedAt: number;
}

export interface StudioTimelineSegment {
  scene: StudioScene;
  index: number;
  startSec: number;
  endSec: number;
  speechEndSec: number;
}

export interface ValidationFixItem {
  sceneId: string;
  field: string;
  before: string;
  after: string;
  reason: string;
}

export interface ValidationReport {
  ok: boolean;
  warnings: string[];
  fixes: ValidationFixItem[];
  scriptExactMatch: boolean;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  promptPricePerM: number;
  completionPricePerM: number;
  supportsStructuredOutput: boolean;
  supportedParameters: string[];
}

export interface PromptTemplates {
  conceptAndPalette: string;
  outline: string;
  chapterScript: string;
  chapterScenes: string;
  chatEdit: string;
}

export type TtsEngineId = 'elevenlabs' | 'openai_compat' | 'google_cloud';

export interface AppConfig {
  openRouterKey: string;
  dontRememberKeys: boolean;
  customLlmBaseUrl: string;
  customLlmKey: string;
  customLlmModel: string;
  useCustomLlm: boolean;
  modelScript: string;
  modelSceneJson: string;
  modelChatEdit: string;
  useSameModel: boolean;
  favoriteModelIds: string[];
  promptTemplates: PromptTemplates;
  ttsEngine: TtsEngineId;
  elevenLabsKey: string;
  elevenLabsVoiceId: string;
  openAiTtsBaseUrl: string;
  openAiTtsKey: string;
  openAiTtsModel: string;
  openAiTtsVoice: string;
  googleTtsKey: string;
  googleTtsVoice: string;
  ttsSpeed: number;
  speakerVoices: Record<string, string>;
  freesoundKey: string;
  partMinutes: number;
}

export interface UserAudioAsset {
  id: string;
  name: string;
  kind: 'scene_audio' | 'master_audio' | 'user_sfx';
  tags: string[];
  mimeType: string;
  blob: Blob;
  durationSec: number;
  envelope?: number[];
  createdAt: number;
}

export interface WizardAnswers {
  topic: string;
  mode: StoryMode | 'auto';
  genre: string | 'auto';
  durationLabel: string | 'auto';
  durationSec: number;
  audience: 'general' | 'kids' | 'worker' | 'auto';
  stylePack: StylePackId | 'auto';
  customStyleDesc: string;
  layout: VideoLayout | 'auto';
  characterPreset: '1' | '2' | '3-4' | 'none' | 'auto';
  ending: EndingType | 'auto';
  elements: string[];
  subtitleMode: SubtitleMode | 'auto';
  seriesMode: 'single' | 'ep1' | 'sequel' | 'auto';
  sequelSourceProjectId: string;
  extraFacts: string;
  extraBrands: string;
  extraForbidden: string;
  extraSources: string;
  approvalMode: 'auto_all' | 'step_by_step';
}

export type AiEditOp =
  | { op: 'addScene'; afterSceneId?: string; scene: Partial<StudioScene> & { narration: string } }
  | { op: 'updateScene'; id: string; patch: Partial<StudioScene> }
  | { op: 'deleteScene'; id: string }
  | { op: 'moveScene'; id: string; toIndex: number }
  | { op: 'updateCharacter'; id: string; patch: Partial<StudioCharacter> }
  | { op: 'setStyle'; stylePack?: StylePackId; layout?: VideoLayout; subtitleMode?: SubtitleMode }
  | { op: 'regenerateScene'; id: string; scene: Partial<StudioScene> };
