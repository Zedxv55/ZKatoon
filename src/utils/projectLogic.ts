import type {
  ActorFace,
  ActorPose,
  AmbientType,
  AnimationClip3D,
  BgPreset,
  CameraMove,
  CameraShotType,
  CardDef,
  CardType,
  CartoonEnding,
  CartoonProject,
  CartoonStyleKey,
  CharacterDef,
  EnvironmentConfig3D,
  EnvironmentPreset3D,
  HairStyle,
  LookGrade,
  OutfitType,
  PauseCandidate,
  ProductionPlanMeta,
  RenderEngineMode,
  SceneAudioRecord,
  SceneDef,
  SceneFx,
  SceneMood,
  SceneTransition,
  SfxName,
  ShotScale,
  StylePreset3D,
  SubtitleStyle,
  SyncDiagnostics,
  TimelineSegment,
  VideoLayoutMode,
} from '../types/cartoon';

const VALID_MOODS: SceneMood[] = ['day', 'dusk', 'night', 'dark', 'room', 'paper'];
const VALID_POSES: ActorPose[] = ['idle', 'talk', 'scared', 'cheer', 'think', 'walk', 'sit', 'hold_flower'];
const VALID_FACES: ActorFace[] = [
  'happy',
  'sad',
  'scared',
  'surprised',
  'neutral',
  'smirk',
  'angry',
  'worried',
];
const VALID_FX: SceneFx[] = ['none', 'rain', 'snow', 'sparkles', 'fog', 'dust', 'flicker'];
const VALID_CARD_TYPES: CardType[] = [
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
  'end',
];
const VALID_HAIR: HairStyle[] = ['short', 'long', 'bun', 'ponytail', 'curly', 'cap', 'bald'];
const VALID_OUTFITS: OutfitType[] = ['tshirt', 'hoodie', 'dress', 'suit', 'uniform', 'coat', 'apron', 'plaid_shirt'];
const VALID_STYLES: CartoonStyleKey[] = [
  'paper',
  'night',
  'rural',
  'bright',
  'cinema',
  'shrine',
  'street',
  'cute',
  'dark',
  'clay',
  'cinema_real',
  'custom',
];
const VALID_STYLES_3D: StylePreset3D[] = [
  'stylized_3d',
  'cinematic_3d',
  'semi_realistic_3d',
  'fantasy_3d',
  'dark_cinematic_3d',
  'clay_3d',
  'stop_motion_3d',
  'realistic_film_3d',
  'anime_3d',
  'custom_3d',
];
const VALID_ENVS_3D: EnvironmentPreset3D[] = [
  'forest_trail',
  'riverside_sunset',
  'cozy_living_room',
  'neon_city_night',
  'thai_temple',
  'studio_stage',
];
const VALID_SHOTS_3D: CameraShotType[] = [
  'establishing_wide',
  'extreme_wide',
  'medium',
  'closeup',
  'extreme_closeup',
  'over_the_shoulder',
  'low_angle',
  'high_angle',
  'birds_eye',
  'tracking',
  'dolly_in',
  'dolly_out',
  'pan',
  'tilt',
  'orbit',
  'crane',
  'pov',
];
const VALID_CLIPS_3D: AnimationClip3D[] = [
  'Idle',
  'Walk',
  'Run',
  'Turn',
  'Jump',
  'Sit',
  'Talk',
  'LookAround',
  'Fear',
  'Smile',
  'Cry',
  'Action',
];
const VALID_ENDINGS: CartoonEnding[] = ['twist', 'summary', 'next', 'cta', 'open'];
const VALID_LAYOUTS: VideoLayoutMode[] = ['full', 'letterbox'];
const VALID_SUB_STYLES: SubtitleStyle[] = ['sticker_dual', 'red_pill', 'yellow_text', 'plain', 'dark_box', 'none'];
const VALID_CAMERAS: CameraMove[] = ['static', 'push_in', 'pull_out', 'pan_left', 'pan_right', 'tilt_up', 'shake'];
const VALID_SHOTS: ShotScale[] = ['wide', 'medium', 'close'];
const VALID_TRANSITIONS: SceneTransition[] = ['cut', 'fade', 'slide_left', 'slide_up', 'zoom', 'wipe', 'flash'];
const VALID_AMBIENTS: AmbientType[] = ['none', 'wind', 'rain', 'city', 'room', 'forest', 'night_insects'];

const STYLE_CODE_MAP: Record<string, CartoonStyleKey> = {
  'PAPER-SKETCH': 'paper',
  'REF-NIGHT': 'night',
  'REF-RURAL': 'rural',
  'REF-BRIGHT': 'bright',
  'REF-CINEMA': 'cinema',
  'REF-SHRINE': 'shrine',
  'REF-STREET': 'street',
  'CLAY-3D': 'clay',
  'CINEMA-REAL': 'cinema_real',
  'CUSTOM': 'custom',
  'STICKMAN REALISTIC': 'dark',
  'การ์ตูนสีสดน่ารัก': 'cute',
};

export function mapStyleKey(raw: unknown, fallback: CartoonStyleKey = 'paper'): CartoonStyleKey {
  const s = String(raw || '').trim();
  if (STYLE_CODE_MAP[s]) return STYLE_CODE_MAP[s];
  const lower = s.toLowerCase() as CartoonStyleKey;
  if (VALID_STYLES.includes(lower)) return lower;
  return fallback;
}

export function poseToDefaultClip3D(pose: ActorPose): AnimationClip3D {
  switch (pose) {
    case 'walk':
      return 'Walk';
    case 'talk':
      return 'Talk';
    case 'scared':
      return 'Fear';
    case 'cheer':
      return 'Smile';
    case 'think':
      return 'LookAround';
    case 'sit':
      return 'Sit';
    default:
      return 'Idle';
  }
}

export function bgPresetToEnv3D(bgPreset: BgPreset | undefined, mood: SceneMood): EnvironmentConfig3D {
  const map: Partial<Record<BgPreset, EnvironmentPreset3D>> = {
    forest: 'forest_trail',
    mountain: 'forest_trail',
    village: 'riverside_sunset',
    ocean: 'riverside_sunset',
    harbor_dusk: 'riverside_sunset',
    sunset: 'riverside_sunset',
    room: 'cozy_living_room',
    living_room_night: 'cozy_living_room',
    classroom: 'cozy_living_room',
    office: 'cozy_living_room',
    city_night: 'neon_city_night',
    street_night: 'neon_city_night',
    metro_station: 'neon_city_night',
    shrine_hall: 'thai_temple',
    paper: 'studio_stage',
    grid_tech: 'studio_stage',
  };
  const preset = (bgPreset && map[bgPreset]) || (mood === 'night' || mood === 'dark' ? 'neon_city_night' : mood === 'dusk' ? 'riverside_sunset' : 'forest_trail');
  const timeOfDay: EnvironmentConfig3D['timeOfDay'] =
    mood === 'night' || mood === 'dark'
      ? 'night'
      : mood === 'dusk'
        ? 'dusk'
        : mood === 'room'
          ? 'golden'
          : 'day';
  return {
    preset,
    timeOfDay,
    fogDensity: mood === 'dark' ? 0.5 : mood === 'dusk' ? 0.25 : 0.14,
    windStrength: 0.3,
    rainIntensity: 0,
    dustAmount: 0.35,
    sunRays: mood === 'dusk' || mood === 'day' ? 0.5 : 0.2,
    treesDensity: preset === 'forest_trail' ? 0.75 : 0.45,
    waterRipple: preset === 'riverside_sunset',
  };
}

export function parseJsonSafely(text: string): unknown {
  const cleaned = text.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('AI ไม่ส่งข้อมูล JSON กลับมา กรุณาลองใหม่อีกครั้ง');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

function normalizeCard(raw: unknown): CardDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  const rawType = String(c.type || 'text').toLowerCase();
  const type: CardType =
    rawType === 'end_card'
      ? 'end'
      : VALID_CARD_TYPES.includes(rawType as CardType)
        ? (rawType as CardType)
        : 'text';

  return {
    type,
    text: String(c.text ?? c.title ?? ''),
    label: c.label ? String(c.label) : c.subtitle ? String(c.subtitle) : undefined,
    sublabel: c.sublabel ? String(c.sublabel) : undefined,
    items: Array.isArray(c.items) ? c.items.map((x) => String(x)).slice(0, 6) : undefined,
    badge: c.badge ? String(c.badge) : undefined,
    at: c.at ? String(c.at) : c.atText ? String(c.atText) : undefined,
    atText: c.atText ? String(c.atText) : c.at ? String(c.at) : undefined,
    values: Array.isArray(c.values) ? c.values.map((n) => Number(n) || 0) : undefined,
    labels: Array.isArray(c.labels) ? c.labels.map((s) => String(s)) : undefined,
    leftTitle: c.leftTitle ? String(c.leftTitle) : undefined,
    rightTitle: c.rightTitle ? String(c.rightTitle) : undefined,
    leftItems: Array.isArray(c.leftItems) ? c.leftItems.map((x) => String(x)) : undefined,
    rightItems: Array.isArray(c.rightItems) ? c.rightItems.map((x) => String(x)) : undefined,
    chatTitle: c.chatTitle ? String(c.chatTitle) : undefined,
    chatSubtitle: c.chatSubtitle ? String(c.chatSubtitle) : undefined,
    typingText: c.typingText ? String(c.typingText) : undefined,
    messages: Array.isArray(c.messages) ? (c.messages as CardDef['messages']) : undefined,
    dayBadge: c.dayBadge ? String(c.dayBadge) : undefined,
    stations: Array.isArray(c.stations) ? (c.stations as CardDef['stations']) : undefined,
    lineColor: c.lineColor ? String(c.lineColor) : undefined,
    source: c.source ? String(c.source) : undefined,
    stampColor: c.stampColor ? String(c.stampColor) : undefined,
  };
}

/**
 * Supports standard flat project JSON, ZKatoon 3D Director JSON, AND legacy OUTPUT G (G1/G2/G3/G4/G5).
 */
export function normalizeProject(
  raw: unknown,
  defaults?: {
    renderEngine?: RenderEngineMode;
    style3d?: StylePreset3D;
    style?: CartoonStyleKey;
    end?: CartoonEnding;
    layout?: VideoLayoutMode;
    topText?: string;
    bottomText?: string;
    subtitleStyle?: SubtitleStyle;
    hudEnabled?: boolean;
    cineEnabled?: boolean;
  }
): CartoonProject {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const g1 = (obj.G1 || obj.brief || {}) as Record<string, unknown>;
  const rawScenes = Array.isArray(obj.G4)
    ? obj.G4
    : Array.isArray(obj.scenes)
      ? obj.scenes
      : [];
  if (rawScenes.length === 0) {
    throw new Error('ไม่พบฉากในบทการ์ตูนที่ได้รับ (ต้องมี scenes หรือ G4)');
  }

  const rawChars = Array.isArray(obj.G2)
    ? obj.G2
    : Array.isArray(obj.characters)
      ? obj.characters
      : [];

  const characters: CharacterDef[] =
    rawChars.length > 0
      ? rawChars.slice(0, 8).map((c, idx) => {
          const item = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
          const hs = String(item.hairStyle || item.hair_style || 'short') as HairStyle;
          const outfitObj =
            item.outfit && typeof item.outfit === 'object'
              ? (item.outfit as Record<string, unknown>)
              : null;
          const rawOutfit = String(outfitObj?.type || item.outfit || 'tshirt') as OutfitType;
          const acc = Array.isArray(item.accessories)
            ? item.accessories.map((a) => String(a) as NonNullable<CharacterDef['accessories']>[number])
            : [];
          const sigPose = String(item.signaturePose || 'Idle') as AnimationClip3D;
          return {
            id: String(item.id || `C${idx + 1}`),
            name: String(item.name || `ตัวละคร ${idx + 1}`),
            role: item.role ? String(item.role) : undefined,
            gender: (item.gender as CharacterDef['gender']) || 'neutral',
            species: (item.species as CharacterDef['species']) || 'human',
            age: (item.age as CharacterDef['age']) || 'adult',
            body: (item.body as CharacterDef['body']) || 'normal',
            proportion3d: (item.proportion3d as CharacterDef['proportion3d']) || 'stylized',
            personality: item.personality ? String(item.personality) : undefined,
            walkStyle: (item.walkStyle as CharacterDef['walkStyle']) || 'normal',
            signaturePose: VALID_CLIPS_3D.includes(sigPose) ? sigPose : 'Idle',
            skin: String(item.skin || '#f1c27d'),
            hair: String(item.hair || '#3b2a20'),
            hairStyle: VALID_HAIR.includes(hs) ? hs : 'short',
            shirt: String(outfitObj?.color || item.shirt || '#6366f1'),
            pants: item.pants ? String(item.pants) : '#475569',
            shoes: item.shoes ? String(item.shoes) : '#1e293b',
            outfit: VALID_OUTFITS.includes(rawOutfit) ? rawOutfit : 'tshirt',
            outfitAccent: outfitObj?.accent ? String(outfitObj.accent) : undefined,
            glasses: Boolean(item.glasses || acc.includes('glasses')),
            accessories: acc,
            glbAssetId: item.glbAssetId ? String(item.glbAssetId) : undefined,
            glbFileName: item.glbFileName ? String(item.glbFileName) : undefined,
            glbHasSkeleton: typeof item.glbHasSkeleton === 'boolean' ? item.glbHasSkeleton : undefined,
            glbClipNames: Array.isArray(item.glbClipNames) ? item.glbClipNames.map(String) : undefined,
            preferredVoiceId: item.preferredVoiceId ? String(item.preferredVoiceId) : undefined,
          };
        })
      : [
          {
            id: 'C1',
            name: 'ตัวเอก',
            skin: '#f1c27d',
            hair: '#3b2a20',
            hairStyle: 'short',
            shirt: '#6366f1',
            pants: '#334155',
            proportion3d: 'stylized',
            glasses: false,
          },
        ];

  const scenes: SceneDef[] = rawScenes.map((s, sceneIdx) => {
    const sc = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const rawActors = Array.isArray(sc.actors) ? sc.actors : [];
    const actors = rawActors.slice(0, 6).map((a, idx) => {
      const act = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
      const rawX = typeof act.x === 'number' && Number.isFinite(act.x) ? act.x : idx === 0 ? 0.45 : 0.72;
      const pose = String(act.pose || 'idle') as ActorPose;
      const validPose = VALID_POSES.includes(pose) ? pose : 'idle';
      const rawClip = String(act.clip3d || '') as AnimationClip3D;
      const clip3d = VALID_CLIPS_3D.includes(rawClip) ? rawClip : poseToDefaultClip3D(validPose);
      const face = String(act.face || 'neutral') as ActorFace;
      return {
        char: String(act.char || characters[0].id),
        x: Math.min(0.9, Math.max(0.1, rawX)),
        y: typeof act.y === 'number' ? act.y : undefined,
        z: typeof act.z === 'number' ? act.z : 0,
        rotY: typeof act.rotY === 'number' ? act.rotY : undefined,
        scale: typeof act.scale === 'number' ? Math.min(1.6, Math.max(0.5, act.scale)) : 1,
        pose: validPose,
        clip3d,
        face: VALID_FACES.includes(face) ? face : 'neutral',
        flip: Boolean(act.flip),
        lookTarget: (act.lookTarget as SceneDef['actors'][number]['lookTarget']) || 'camera',
        moveTo:
          act.moveTo && typeof act.moveTo === 'object'
            ? (act.moveTo as SceneDef['actors'][number]['moveTo'])
            : undefined,
      };
    });

    let card: CardDef | null = null;
    let extraCards: CardDef[] | undefined;
    if (Array.isArray(sc.cards) && sc.cards.length > 0) {
      const normalizedList = sc.cards.map(normalizeCard).filter((x): x is CardDef => Boolean(x));
      card = normalizedList[0] ?? null;
      if (normalizedList.length > 1) extraCards = normalizedList.slice(1, 2);
    } else if (sc.card) {
      card = normalizeCard(sc.card);
    }

    const bgObj = sc.bg && typeof sc.bg === 'object' ? (sc.bg as Record<string, unknown>) : null;
    const bgPreset = (bgObj?.preset || sc.bgPreset || undefined) as BgPreset | undefined;
    const rawMood = String(sc.mood || (bgPreset === 'paper' ? 'paper' : 'night')) as SceneMood;
    const mood: SceneMood = VALID_MOODS.includes(rawMood) ? rawMood : 'night';
    const rawFx = String(Array.isArray(sc.fx) ? sc.fx[0] || 'none' : sc.fx || 'none') as SceneFx;
    const hl = Array.isArray(sc.hl || sc.highlightWords)
      ? ((sc.hl || sc.highlightWords) as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];

    const sfxList = Array.isArray(sc.sfx)
      ? sc.sfx.map((item) => {
          if (typeof item === 'string') return { name: item as SfxName };
          const o = (item || {}) as Record<string, unknown>;
          return {
            name: String(o.name || 'click') as SfxName,
            atText: o.atText ? String(o.atText) : undefined,
            gain: typeof o.gain === 'number' ? o.gain : undefined,
          };
        })
      : undefined;

    const rawCamera = String(sc.camera || 'static') as CameraMove;
    const rawShot = String(sc.shot || 'medium') as ShotScale;
    const rawShot3d = String(sc.shotType3d || 'medium') as CameraShotType;
    const rawTrans = String(sc.transition || 'fade') as SceneTransition;
    const rawAmb = String(sc.ambient || 'none') as AmbientType;

    const rawEnv3d = sc.env3d && typeof sc.env3d === 'object' ? (sc.env3d as Record<string, unknown>) : null;
    const fallbackEnv = bgPresetToEnv3D(bgPreset, mood);
    const envPreset = String(rawEnv3d?.preset || fallbackEnv.preset) as EnvironmentPreset3D;
    const env3d: EnvironmentConfig3D = {
      preset: VALID_ENVS_3D.includes(envPreset) ? envPreset : fallbackEnv.preset,
      timeOfDay: (rawEnv3d?.timeOfDay as EnvironmentConfig3D['timeOfDay']) || fallbackEnv.timeOfDay,
      fogDensity: typeof rawEnv3d?.fogDensity === 'number' ? rawEnv3d.fogDensity : fallbackEnv.fogDensity,
      windStrength: typeof rawEnv3d?.windStrength === 'number' ? rawEnv3d.windStrength : fallbackEnv.windStrength,
      rainIntensity: typeof rawEnv3d?.rainIntensity === 'number' ? rawEnv3d.rainIntensity : fallbackEnv.rainIntensity,
      dustAmount: typeof rawEnv3d?.dustAmount === 'number' ? rawEnv3d.dustAmount : fallbackEnv.dustAmount,
      sunRays: typeof rawEnv3d?.sunRays === 'number' ? rawEnv3d.sunRays : fallbackEnv.sunRays,
      treesDensity: typeof rawEnv3d?.treesDensity === 'number' ? rawEnv3d.treesDensity : fallbackEnv.treesDensity,
      waterRipple:
        typeof rawEnv3d?.waterRipple === 'boolean' ? rawEnv3d.waterRipple : fallbackEnv.waterRipple,
    };

    const manualDur =
      typeof sc.manualDurationSec === 'number' && Number.isFinite(sc.manualDurationSec) && sc.manualDurationSec >= 0.8
        ? Number(sc.manualDurationSec.toFixed(2))
        : undefined;

    return {
      id: sc.id ? String(sc.id) : `S${sceneIdx + 1}`,
      title: sc.title ? String(sc.title) : `ฉากที่ ${sceneIdx + 1}`,
      storyBeat: sc.storyBeat ? String(sc.storyBeat) : undefined,
      narration: String(sc.narration || sc.text || '').trim(),
      subtitleEn: sc.subtitleEn ? String(sc.subtitleEn).trim() : undefined,
      mood,
      bgPreset,
      env3d,
      blurBg: Boolean(sc.blurBg),
      shot: VALID_SHOTS.includes(rawShot) ? rawShot : 'medium',
      shotType3d: VALID_SHOTS_3D.includes(rawShot3d) ? rawShot3d : 'medium',
      shotReason: sc.shotReason ? String(sc.shotReason) : undefined,
      camera: VALID_CAMERAS.includes(rawCamera) ? rawCamera : 'static',
      transition: VALID_TRANSITIONS.includes(rawTrans) ? rawTrans : 'fade',
      hudText: sc.hudText ? String(sc.hudText) : sc.hud && typeof sc.hud === 'string' ? sc.hud : undefined,
      holdAfter:
        typeof sc.holdAfter === 'number' && Number.isFinite(sc.holdAfter) && sc.holdAfter >= 0
          ? Math.min(8, sc.holdAfter)
          : undefined,
      syncOffset:
        typeof sc.syncOffset === 'number' && Number.isFinite(sc.syncOffset)
          ? Math.max(-3, Math.min(3, sc.syncOffset))
          : 0,
      manualDurationSec: manualDur,
      voiceConfig: sc.voiceConfig && typeof sc.voiceConfig === 'object' ? (sc.voiceConfig as SceneDef['voiceConfig']) : undefined,
      actors,
      props: Array.isArray(sc.props) ? (sc.props as SceneDef['props']) : undefined,
      pov: (sc.pov as SceneDef['pov']) || 'none',
      card,
      extraCards,
      fx: VALID_FX.includes(rawFx) ? rawFx : 'none',
      sfx: sfxList,
      ambient: VALID_AMBIENTS.includes(rawAmb) ? rawAmb : 'none',
      look: sc.look && typeof sc.look === 'object' ? (sc.look as SceneDef['look']) : undefined,
      hl,
    };
  });

  const style = mapStyleKey(g1.style_preset || obj.style, defaults?.style || 'cinema_real');
  const rawStyle3d = String(obj.style3d || defaults?.style3d || (style === 'clay' ? 'clay_3d' : 'cinematic_3d')) as StylePreset3D;
  const style3d: StylePreset3D = VALID_STYLES_3D.includes(rawStyle3d) ? rawStyle3d : 'cinematic_3d';
  const renderEngine: RenderEngineMode =
    obj.renderEngine === '2d_paper' || obj.renderEngine === '3d'
      ? obj.renderEngine
      : defaults?.renderEngine || (style === 'paper' ? '2d_paper' : '3d');

  const rawEnd = String(g1.ending_type || obj.end || defaults?.end || 'summary') as CartoonEnding;
  const rawLayout = String(g1.layout || obj.layout || defaults?.layout || 'full') as VideoLayoutMode;
  const rawSub = String(
    g1.subtitle_style || obj.subtitleStyle || defaults?.subtitleStyle || (style === 'paper' ? 'sticker_dual' : 'yellow_text')
  ) as SubtitleStyle;

  const g1Letterbox = (g1.letterbox || obj.letterbox || {}) as Record<string, unknown>;
  const topText = String(g1Letterbox.top_text || g1Letterbox.topText || defaults?.topText || '');
  const bottomText = String(g1Letterbox.bottom_text || g1Letterbox.bottomText || defaults?.bottomText || '');

  const rawHud = (g1.hud || obj.hud || {}) as Record<string, unknown>;
  const hudEnabled =
    typeof rawHud.enabled === 'boolean'
      ? rawHud.enabled
      : defaults?.hudEnabled ?? (style === 'paper' || style === 'cinema');

  const rawCine = (g1.cine_layer || obj.cineLayer || {}) as Record<string, unknown>;
  const cineEnabled =
    typeof rawCine.enabled === 'boolean' ? rawCine.enabled : defaults?.cineEnabled ?? true;

  const rawDurations = Array.isArray(obj.sceneDurations)
    ? obj.sceneDurations.filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d > 0)
    : undefined;

  const rawG5 = (obj.G5 || obj.music || {}) as Record<string, unknown>;
  const rawPlan =
    obj.productionPlan && typeof obj.productionPlan === 'object'
      ? (obj.productionPlan as ProductionPlanMeta)
      : undefined;

  return {
    id: obj.id ? String(obj.id) : undefined,
    title: String(g1.title || obj.title || 'การ์ตูนเรื่องใหม่').trim(),
    renderEngine,
    style3d,
    customStyle3d:
      obj.customStyle3d && typeof obj.customStyle3d === 'object'
        ? (obj.customStyle3d as CartoonProject['customStyle3d'])
        : undefined,
    style,
    customStyleDesc: g1.custom_style ? String(g1.custom_style) : obj.customStyleDesc ? String(obj.customStyleDesc) : undefined,
    end: VALID_ENDINGS.includes(rawEnd) ? rawEnd : 'summary',
    layout: VALID_LAYOUTS.includes(rawLayout) ? rawLayout : 'full',
    letterbox: rawLayout === 'letterbox' || topText || bottomText ? { topText, bottomText } : undefined,
    subtitleStyle: VALID_SUB_STYLES.includes(rawSub) ? rawSub : 'yellow_text',
    hud: {
      enabled: hudEnabled,
      startText: String(rawHud.start || rawHud.startText || g1.title || obj.title || ''),
      showDot: typeof rawHud.showDot === 'boolean' ? rawHud.showDot : false,
    },
    cineLayer: {
      enabled: cineEnabled,
      defaultGrade: (rawCine.defaultGrade as LookGrade) || 'golden_hour',
    },
    clay: style === 'clay' || style3d === 'clay_3d' ? { stopmotionFps: 12 } : undefined,
    music: {
      mood: (rawG5.mood as NonNullable<CartoonProject['music']>['mood']) || (style === 'paper' ? 'warm' : 'calm'),
      bpm: typeof rawG5.bpm === 'number' ? rawG5.bpm : 88,
      key: (rawG5.key as NonNullable<CartoonProject['music']>['key']) || 'C',
      mode: (rawG5.mode as NonNullable<CartoonProject['music']>['mode']) || 'major',
    },
    globalOffset: typeof obj.globalOffset === 'number' ? obj.globalOffset : 0,
    productionPlan: rawPlan,
    characters,
    scenes,
    sceneDurations:
      rawDurations && rawDurations.length === scenes.length ? rawDurations : undefined,
  };
}

/**
 * Computes Thai text speaking weight:
 * regular char = 1, comma/pause = 2.5, period/newline = 6
 */
export function computeThaiTextWeight(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (ch === '.' || ch === '\n') w += 6;
    else if (ch === ',' || ch === ' ') w += 2.5;
    else w += 1;
  }
  return Math.max(8, w);
}

export interface AudioEnvelopeResult {
  envelope: number[];
  speechStartSec: number;
  speechEndSec: number;
  pauseCandidates: PauseCandidate[];
}

export function computeAudioEnvelope(
  samples: Float32Array,
  sampleRate: number
): AudioEnvelopeResult {
  const step = Math.max(1, Math.floor(sampleRate * 0.02)); // 20ms frame
  const count = Math.floor(samples.length / step);
  if (count === 0) {
    return {
      envelope: [],
      speechStartSec: 0,
      speechEndSec: samples.length / Math.max(1, sampleRate),
      pauseCandidates: [],
    };
  }

  const rms: number[] = [];
  for (let i = 0; i < count; i++) {
    let sumSq = 0;
    const base = i * step;
    for (let j = 0; j < step; j++) {
      const v = samples[base + j];
      sumSq += v * v;
    }
    rms.push(Math.sqrt(sumSq / step));
  }

  const sorted = [...rms].sort((a, b) => a - b);
  const refPeak = sorted[Math.floor(sorted.length * 0.95)] || 1;
  const threshold = refPeak * 0.08;

  let first = rms.findIndex((v) => v > threshold);
  const revIdx = [...rms].reverse().findIndex((v) => v > threshold);
  let last = revIdx >= 0 ? rms.length - 1 - revIdx : -1;

  if (first < 0 || last < first) {
    first = 0;
    last = rms.length - 1;
  }

  // Detect pauses >= 220ms (11 frames * 20ms) inside [first, last]
  const pauseCandidates: PauseCandidate[] = [];
  let silentRunStart = -1;
  for (let i = first; i <= last; i++) {
    if (rms[i] <= threshold) {
      if (silentRunStart < 0) silentRunStart = i;
    } else if (silentRunStart >= 0) {
      const frames = i - silentRunStart;
      if (frames >= 11) {
        const startRel = (silentRunStart - first) * 0.02;
        const durSec = frames * 0.02;
        pauseCandidates.push({
          midSec: Number((startRel + durSec / 2).toFixed(3)),
          durSec: Number(durSec.toFixed(3)),
        });
      }
      silentRunStart = -1;
    }
  }

  return {
    envelope: rms.map((v) => Math.min(1, v / refPeak)),
    speechStartSec: first * 0.02,
    speechEndSec: (last + 1) * 0.02,
    pauseCandidates,
  };
}

export interface TimelineBuildResult {
  timeline: TimelineSegment[];
  totalDuration: number;
  leadSec: number;
  speechStartSec: number;
  speechEndSec: number;
  syncDiagnostics: SyncDiagnostics;
}

function matchSceneBoundariesWithPauses(
  expectedBounds: number[],
  totalSpeechSpan: number,
  pauseCandidates: PauseCandidate[]
): { boundaries: number[]; matchedCount: number } {
  const nBounds = expectedBounds.length;
  if (nBounds === 0) return { boundaries: [], matchedCount: 0 };

  const minScene = 1.2;
  const maxSnap = 1.2;
  const result: number[] = [];
  let prev = 0;
  let lastPauseIdx = -1;
  let matchedCount = 0;

  for (let i = 0; i < nBounds; i++) {
    const exp = expectedBounds[i];
    const remainingScenes = nBounds - i;
    const minAllowed = prev + minScene;
    const maxAllowed = totalSpeechSpan - remainingScenes * minScene;

    let bestScore = Infinity;
    let bestIdx = -1;

    for (let p = lastPauseIdx + 1; p < pauseCandidates.length; p++) {
      const cand = pauseCandidates[p];
      if (cand.midSec < minAllowed || cand.midSec > maxAllowed) continue;
      const dist = Math.abs(cand.midSec - exp);
      if (dist <= maxSnap) {
        const score = dist - Math.min(0.4, cand.durSec * 0.45);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = p;
        }
      }
    }

    if (bestIdx >= 0) {
      const chosen = pauseCandidates[bestIdx].midSec;
      result.push(chosen);
      prev = chosen;
      lastPauseIdx = bestIdx;
      matchedCount++;
    } else {
      const clamped = Math.max(minAllowed, Math.min(maxAllowed, exp));
      result.push(clamped);
      prev = clamped;
    }
  }

  return { boundaries: result, matchedCount };
}

export function buildTimeline(
  scenes: SceneDef[],
  options: {
    audioDurationSec?: number;
    speechStartSec?: number;
    speechEndSec?: number;
    sceneDurations?: number[];
    pauseCandidates?: PauseCandidate[];
    globalOffset?: number;
    sceneAudioMap?: Record<string, SceneAudioRecord>;
  } = {}
): TimelineBuildResult {
  if (scenes.length === 0) {
    return {
      timeline: [],
      totalDuration: 1,
      leadSec: 0.4,
      speechStartSec: 0,
      speechEndSec: 1,
      syncDiagnostics: {
        foundPauses: 0,
        matchedBoundaries: 0,
        totalBoundaries: 0,
        mode: 'estimated',
      },
    };
  }

  const leadSec = Math.max(0.1, 0.4 + (options.globalOffset ?? 0));
  const defaultEndHold = 2.0;
  const hasAnyManualDur = scenes.some((s) => typeof s.manualDurationSec === 'number' && s.manualDurationSec > 0);
  const pauseCandidates = options.pauseCandidates ?? [];

  // Derive per-scene durations from sceneAudioMap if all or some scenes have generated audio
  const perSceneAudioDurations = options.sceneAudioMap
    ? scenes.map((s) => {
        const rec = s.id ? options.sceneAudioMap?.[s.id] : undefined;
        return rec && rec.durationSec > 0.1 ? rec.durationSec : 0;
      })
    : [];
  const hasPerSceneAudio =
    perSceneAudioDurations.length === scenes.length && perSceneAudioDurations.some((d) => d > 0);

  // Case 1: Per-scene TTS durations, explicit sceneDurations, or manual durations
  if (
    hasPerSceneAudio ||
    hasAnyManualDur ||
    (options.sceneDurations &&
      options.sceneDurations.length === scenes.length &&
      options.sceneDurations.every((d) => d > 0.1))
  ) {
    let cursor = leadSec;
    const timeline: TimelineSegment[] = scenes.map((s, i) => {
      const isLast = i === scenes.length - 1;
      const perAudioDur = perSceneAudioDurations[i] > 0 ? perSceneAudioDurations[i] : undefined;
      const fallbackDur =
        perAudioDur ?? options.sceneDurations?.[i] ?? Math.max(1.5, computeThaiTextWeight(s.narration) / 11);
      const baseSpeechDur =
        perAudioDur ??
        (typeof s.manualDurationSec === 'number' && s.manualDurationSec > 0
          ? s.manualDurationSec
          : fallbackDur);
      const adjustedSpeech = Math.max(1.0, baseSpeechDur + (s.syncOffset ?? 0));
      const hold = s.holdAfter ?? (isLast ? defaultEndHold : 0);
      const speechEnd = cursor + adjustedSpeech;
      const b = speechEnd + hold;
      const seg: TimelineSegment = { a: cursor, b, speechEnd, s, index: i };
      cursor = b;
      return seg;
    });

    const speechLen = timeline[timeline.length - 1]?.speechEnd - leadSec;
    return {
      timeline,
      totalDuration: Math.max(1, cursor),
      leadSec,
      speechStartSec: options.speechStartSec ?? 0,
      speechEndSec: options.speechEndSec ?? Math.max(1, speechLen),
      syncDiagnostics: {
        foundPauses: pauseCandidates.length,
        matchedBoundaries: Math.max(0, scenes.length - 1),
        totalBoundaries: Math.max(0, scenes.length - 1),
        mode: hasPerSceneAudio ? 'per-scene-tts' : hasAnyManualDur ? 'manual' : 'per-scene-tts',
      },
    };
  }

  // Case 2: Single audio buffer or character-weighted silent estimation
  const weights = scenes.map((s) => computeThaiTextWeight(s.narration));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const ss = options.speechStartSec ?? 0;
  const hasRealAudio = Boolean(options.audioDurationSec && options.audioDurationSec > 0);
  const se =
    options.speechEndSec ??
    (hasRealAudio ? options.audioDurationSec! : totalWeight / 11);

  const speechSpan = Math.max(scenes.length * 1.2, se - ss);

  const expectedBounds: number[] = [];
  let accW = 0;
  for (let i = 0; i < scenes.length - 1; i++) {
    accW += weights[i];
    expectedBounds.push((accW / totalWeight) * speechSpan);
  }

  const { boundaries, matchedCount } =
    hasRealAudio && pauseCandidates.length > 0
      ? matchSceneBoundariesWithPauses(expectedBounds, speechSpan, pauseCandidates)
      : { boundaries: expectedBounds, matchedCount: 0 };

  let cursor = leadSec;
  let prevRel = 0;
  const timeline: TimelineSegment[] = scenes.map((s, i) => {
    const isLast = i === scenes.length - 1;
    const nextRel = isLast ? speechSpan : boundaries[i];
    const baseDur = Math.max(1.2, nextRel - prevRel);
    prevRel = nextRel;

    const adjustedSpeech = Math.max(1.0, baseDur + (s.syncOffset ?? 0));
    const hold = s.holdAfter ?? (isLast ? defaultEndHold : 0);
    const speechEnd = cursor + adjustedSpeech;
    const b = speechEnd + hold;
    const seg: TimelineSegment = { a: cursor, b, speechEnd, s, index: i };
    cursor = b;
    return seg;
  });

  return {
    timeline,
    totalDuration: Math.max(1, cursor),
    leadSec,
    speechStartSec: ss,
    speechEndSec: se,
    syncDiagnostics: {
      foundPauses: pauseCandidates.length,
      matchedBoundaries: matchedCount,
      totalBoundaries: Math.max(0, scenes.length - 1),
      mode: hasRealAudio
        ? pauseCandidates.length > 0
          ? 'pause-matched'
          : 'weighted-audio'
        : 'estimated',
    },
  };
}

export function resolveAtTextLocalTime(
  narration: string,
  atText: string | undefined,
  sceneSpeechDuration: number,
  sceneStartRelToSpeech = 0,
  pauseCandidates: PauseCandidate[] = []
): number {
  if (!atText || !narration) return 0.25;
  const charIdx = narration.indexOf(atText);
  if (charIdx < 0) return 0.25;

  const proportion = charIdx / Math.max(1, narration.length);
  const rawLocal = proportion * sceneSpeechDuration;

  if (pauseCandidates.length > 0) {
    const absTarget = sceneStartRelToSpeech + rawLocal;
    let best = rawLocal;
    let bestDist = 0.4;
    for (const p of pauseCandidates) {
      const d = Math.abs(p.midSec - absTarget);
      if (d <= bestDist) {
        bestDist = d;
        best = Math.max(0, Math.min(sceneSpeechDuration - 0.1, p.midSec - sceneStartRelToSpeech));
      }
    }
    return best;
  }
  return rawLocal;
}

export function getMouthOpenAt(
  time: number,
  envelope: number[],
  leadSec = 0.4,
  speechStartSec = 0
): number {
  if (!envelope.length) {
    return 0.45 + 0.45 * Math.sin(time * 14);
  }
  const speechTime = time - leadSec + speechStartSec;
  if (speechTime < 0) return 0;
  const idx = Math.floor(speechTime / 0.02);
  return envelope[idx] ?? 0;
}

/**
 * Resolves lip-sync openness (0..1) using per-scene phoneme marks when available,
 * then per-scene audio envelope, then global audio envelope, then subtle speaking wave.
 */
export function getLipSyncOpennessAt(
  time: number,
  seg: TimelineSegment | undefined,
  sceneAudioMap: Record<string, SceneAudioRecord> | undefined,
  globalEnvelope: number[],
  leadSec = 0.4,
  speechStartSec = 0
): number {
  if (!seg) return 0;
  if (time > seg.speechEnd) return 0;
  const localT = Math.max(0, time - seg.a);
  const sceneId = seg.s.id;
  const rec = sceneId && sceneAudioMap ? sceneAudioMap[sceneId] : undefined;

  if (rec) {
    if (rec.phonemeMarks && rec.phonemeMarks.length > 0) {
      for (let i = 0; i < rec.phonemeMarks.length; i++) {
        const mark = rec.phonemeMarks[i];
        const end = mark.endSec ?? mark.timeSec + 0.08;
        if (localT >= mark.timeSec && localT <= end) {
          return mark.openness;
        }
      }
    }
    if (rec.envelope.length > 0) {
      const idx = Math.floor(localT / 0.02);
      return rec.envelope[idx] ?? 0;
    }
  }

  return getMouthOpenAt(time, globalEnvelope, leadSec, speechStartSec);
}

export interface SubtitleState {
  text: string;
  subtitleEn?: string;
  highlightRanges: Array<[number, number]>;
}

export function getSubtitleState(
  narration: string,
  highlights: string[],
  localTime: number,
  sceneDuration: number,
  subtitleEn?: string
): SubtitleState | null {
  const clauses = narration
    .split(/(?<=[,.\n])\s*/)
    .map((z) => z.trim())
    .filter(Boolean);
  if (clauses.length === 0) return null;

  const weights = clauses.map((c) => Math.max(1, computeThaiTextWeight(c)));
  const total = weights.reduce((a, b) => a + b, 0);

  let acc = 0;
  let activeIndex = clauses.length - 1;
  for (let i = 0; i < clauses.length; i++) {
    acc += (weights[i] / total) * sceneDuration;
    if (localTime < acc) {
      activeIndex = i;
      break;
    }
  }

  const text = clauses[activeIndex].replace(/[,.]+$/, '');
  const highlightRanges: Array<[number, number]> = [];
  for (const kw of highlights) {
    if (!kw) continue;
    let from = 0;
    while (from < text.length) {
      const idx = text.indexOf(kw, from);
      if (idx < 0) break;
      highlightRanges.push([idx, idx + kw.length]);
      from = idx + kw.length;
    }
  }

  return { text, subtitleEn, highlightRanges };
}

export function sanitizeFilename(title: string): string {
  const cleaned = title.replace(/[^\wก-๙]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'cartoon_video';
}

export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
