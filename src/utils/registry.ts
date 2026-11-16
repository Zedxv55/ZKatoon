import type {
  AmbientTypeId,
  BgPresetId,
  CameraTypeId,
  CardTypeId,
  FaceId,
  FxTypeId,
  LookGradeId,
  MusicMoodId,
  PoseId,
  SfxTypeId,
  ShotTypeId,
  TransitionTypeId,
} from '../types/studio';

export const BG_PRESETS: readonly BgPresetId[] = [
  'sky_day',
  'sunset',
  'city_day',
  'city_night',
  'street_night',
  'street_day',
  'room',
  'living_room_night',
  'classroom',
  'office',
  'lab',
  'hospital',
  'hallway',
  'forest',
  'mountain',
  'ocean',
  'harbor_dusk',
  'village',
  'rural_night_field',
  'bus_night',
  'metro_station',
  'supermarket',
  'noodle_shop',
  'shrine_hall',
  'space',
  'dark_fog',
  'grid_tech',
  'paper',
  'plain_gradient',
];

export const POSES: readonly PoseId[] = [
  'idle',
  'walk',
  'run',
  'talk',
  'point',
  'scared',
  'jump',
  'sit',
  'wave',
  'think',
  'cheer',
  'cry',
  'fall',
  'hide',
];

export const FACES: readonly FaceId[] = [
  'happy',
  'sad',
  'angry',
  'surprised',
  'scared',
  'neutral',
  'smirk',
  'sleepy',
  'love',
];

export const PROP_KINDS = [
  'door',
  'phone',
  'car',
  'house',
  'tree',
  'book',
  'bulb',
  'key',
  'box',
  'flag',
  'clock',
  'heart',
  'star',
  'coin',
  'rocket',
  'shield',
  'magnifier',
  'laptop',
  'bottle',
  'bell',
  'camera',
  'map',
  'flashlight',
  'remote',
  'cat',
  'dog',
  'bus',
  'pillow',
  'sofa',
  'lamp',
  'photo_wall',
  'walkie_talkie',
  'lantern',
  'candle',
  'ship',
  'train',
  'noodle_pot',
  'sign',
] as const;
export type PropKindId = (typeof PROP_KINDS)[number];

export const CARD_TYPES: readonly CardTypeId[] = [
  'text',
  'title_card',
  'bignumber',
  'bar_chart',
  'list',
  'checklist',
  'compare',
  'line_chart',
  'map_route',
  'metro_map',
  'phone_mockup',
  'notebook',
  'stamp',
  'source_note',
  'end_card',
  'speech_bubble',
  'thought_bubble',
  'year_chip',
  'time_tag',
  'source_chip',
];

export const CAMERA_TYPES: readonly CameraTypeId[] = [
  'static',
  'push_in',
  'pull_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'shake',
];

export const CAMERA_SHOTS: readonly ShotTypeId[] = ['wide', 'medium', 'close'];

export const FX_TYPES: readonly FxTypeId[] = [
  'rain',
  'snow',
  'fog',
  'sparkles',
  'flash',
  'vignette',
  'flicker',
  'speedlines',
  'dust',
  'confetti',
  'embers',
  'fireflies',
];

export const TRANSITION_TYPES: readonly TransitionTypeId[] = [
  'cut',
  'fade',
  'slide_left',
  'slide_up',
  'zoom',
  'wipe',
  'flash',
];

export const SFX_NAMES: readonly SfxTypeId[] = [
  'whoosh',
  'hit',
  'boom',
  'siren',
  'footstep',
  'click',
  'pop',
  'wind',
  'rain',
  'heartbeat',
  'door',
  'ding',
  'glitch',
  'laugh',
  'sparkle',
  'alarm',
  'typing',
  'coin',
  'error',
  'tick',
  'stamp',
  'paper',
];

export const AMBIENT_TYPES: readonly AmbientTypeId[] = [
  'none',
  'wind',
  'rain',
  'city',
  'room',
  'forest',
  'night_insects',
];

export const MUSIC_MOODS: readonly MusicMoodId[] = [
  'calm',
  'tense',
  'happy',
  'epic',
  'sad',
  'mystery',
];

export const LOOK_GRADES: readonly LookGradeId[] = [
  'neutral_day',
  'golden_hour',
  'blue_hour',
  'overcast',
  'warm_interior',
  'cold_night',
  'neon_night',
  'tense_green',
  'sepia_memory',
  'harsh_noon',
  'foggy_dawn',
];

export const POV_TYPES = ['hand_phone', 'hand_pencil', 'hand_hold', 'hand_point'] as const;

export const HAIR_STYLES = ['short', 'long', 'bun', 'ponytail', 'curly', 'cap', 'bald'] as const;
export const OUTFIT_STYLES = ['tshirt', 'hoodie', 'dress', 'suit', 'uniform', 'coat', 'apron', 'plaid_shirt'] as const;
export const ACCESSORIES = ['glasses', 'hat', 'bag', 'scarf', 'mask', 'headphones', 'badge', 'backpack'] as const;

export function mapToClosest<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  aliases: Record<string, T>,
  fallback: T
): { value: T; changed: boolean } {
  const clean = String(raw || '').trim().toLowerCase();
  if ((allowed as readonly string[]).includes(clean)) {
    return { value: clean as T, changed: false };
  }
  if (aliases[clean]) {
    return { value: aliases[clean], changed: true };
  }
  const fuzzy = allowed.find((item) => clean.includes(item) || item.includes(clean));
  if (fuzzy && clean.length > 0) {
    return { value: fuzzy, changed: true };
  }
  return { value: fallback, changed: clean.length > 0 };
}
