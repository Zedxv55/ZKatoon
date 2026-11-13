export type CartoonMode = 'story' | 'explain' | 'mix';
export type CartoonGenre =
  | 'ตลก'
  | 'ลึกลับสยองขวัญ'
  | 'ดราม่าซึ้ง'
  | 'สืบสวนตื่นเต้น'
  | 'ให้ความรู้';
export type CartoonLength = 30 | 60 | 90;
export type CartoonStyleKey =
  | 'bright'
  | 'night'
  | 'cinema'
  | 'shrine'
  | 'street'
  | 'cute'
  | 'dark'
  | 'clay';
export type CartoonEnding = 'twist' | 'summary' | 'next' | 'cta';

export type SceneMood = 'day' | 'dusk' | 'night' | 'dark' | 'room';
export type ActorPose = 'idle' | 'talk' | 'scared' | 'cheer' | 'think' | 'walk';
export type ActorFace =
  | 'happy'
  | 'sad'
  | 'scared'
  | 'surprised'
  | 'neutral'
  | 'smirk'
  | 'angry';
export type SceneFx = 'none' | 'rain' | 'snow' | 'sparkles' | 'fog';
export type CardType = 'text' | 'bignumber' | 'list' | 'end';
export type HairStyle = 'short' | 'long' | 'bun';
export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export interface CharacterDef {
  id: string;
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  shirt: string;
  glasses?: boolean;
}

export interface ActorDef {
  char: string;
  x: number;
  pose: ActorPose;
  face: ActorFace;
  flip: boolean;
}

export interface CardDef {
  type: CardType;
  text: string;
  label?: string;
  items?: string[];
  badge?: string;
  at?: string;
}

export interface SceneDef {
  narration: string;
  mood: SceneMood;
  actors: ActorDef[];
  card: CardDef | null;
  fx: SceneFx;
  hl: string[];
}

export interface CartoonProject {
  title: string;
  style: CartoonStyleKey;
  end: CartoonEnding;
  characters: CharacterDef[];
  scenes: SceneDef[];
  sceneDurations?: number[];
}

export interface TimelineSegment {
  a: number;
  b: number;
  s: SceneDef;
}

export interface StudioSelection {
  mode: CartoonMode;
  genre: CartoonGenre;
  len: CartoonLength;
  style: CartoonStyleKey;
  end: CartoonEnding;
}

export interface StudioSettings {
  voiceName: VoiceName;
  voiceStyle: string;
  defaultRes: '720' | '1080';
  subtitleScale: 'normal' | 'large';
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
