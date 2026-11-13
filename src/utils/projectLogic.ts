import type {
  ActorFace,
  ActorPose,
  CardType,
  CartoonEnding,
  CartoonProject,
  CartoonStyleKey,
  CharacterDef,
  HairStyle,
  SceneDef,
  SceneFx,
  SceneMood,
  TimelineSegment,
} from '../types/cartoon';

const VALID_MOODS: SceneMood[] = ['day', 'dusk', 'night', 'dark', 'room'];
const VALID_POSES: ActorPose[] = ['idle', 'talk', 'scared', 'cheer', 'think', 'walk'];
const VALID_FACES: ActorFace[] = [
  'happy',
  'sad',
  'scared',
  'surprised',
  'neutral',
  'smirk',
  'angry',
];
const VALID_FX: SceneFx[] = ['none', 'rain', 'snow', 'sparkles', 'fog'];
const VALID_CARD_TYPES: CardType[] = ['text', 'bignumber', 'list', 'end'];
const VALID_HAIR: HairStyle[] = ['short', 'long', 'bun'];
const VALID_STYLES: CartoonStyleKey[] = [
  'bright',
  'night',
  'cinema',
  'shrine',
  'street',
  'cute',
  'dark',
  'clay',
];
const VALID_ENDINGS: CartoonEnding[] = ['twist', 'summary', 'next', 'cta'];

export function parseJsonSafely(text: string): unknown {
  const cleaned = text.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('AI ไม่ส่งข้อมูล JSON กลับมา กรุณาลองใหม่อีกครั้ง');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function normalizeProject(
  raw: unknown,
  defaults?: { style?: CartoonStyleKey; end?: CartoonEnding }
): CartoonProject {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawScenes = Array.isArray(obj.scenes) ? obj.scenes : [];
  if (rawScenes.length === 0) {
    throw new Error('ไม่พบฉากในบทการ์ตูนที่ได้รับ');
  }

  const rawChars = Array.isArray(obj.characters) ? obj.characters : [];
  const characters: CharacterDef[] =
    rawChars.length > 0
      ? rawChars.slice(0, 4).map((c, idx) => {
          const item = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>;
          const hs = String(item.hairStyle || 'short') as HairStyle;
          return {
            id: String(item.id || `C${idx + 1}`),
            name: String(item.name || `ตัวละคร ${idx + 1}`),
            skin: String(item.skin || '#f1c27d'),
            hair: String(item.hair || '#3b2a20'),
            hairStyle: VALID_HAIR.includes(hs) ? hs : 'short',
            shirt: String(item.shirt || '#6366f1'),
            glasses: Boolean(item.glasses),
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
            glasses: false,
          },
        ];

  const scenes: SceneDef[] = rawScenes.map((s) => {
    const sc = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
    const rawActors = Array.isArray(sc.actors) ? sc.actors : [];
    const actors = rawActors.slice(0, 2).map((a, idx) => {
      const act = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>;
      const rawX = typeof act.x === 'number' && Number.isFinite(act.x) ? act.x : idx === 0 ? 0.45 : 0.72;
      const pose = String(act.pose || 'idle') as ActorPose;
      const face = String(act.face || 'neutral') as ActorFace;
      return {
        char: String(act.char || characters[0].id),
        x: Math.min(0.88, Math.max(0.12, rawX)),
        pose: VALID_POSES.includes(pose) ? pose : 'idle',
        face: VALID_FACES.includes(face) ? face : 'neutral',
        flip: Boolean(act.flip),
      };
    });

    let card: SceneDef['card'] = null;
    if (sc.card && typeof sc.card === 'object') {
      const c = sc.card as Record<string, unknown>;
      const type = String(c.type || 'text') as CardType;
      card = {
        type: VALID_CARD_TYPES.includes(type) ? type : 'text',
        text: String(c.text || ''),
        label: c.label ? String(c.label) : undefined,
        items: Array.isArray(c.items) ? c.items.map((x) => String(x)).slice(0, 5) : undefined,
        badge: c.badge ? String(c.badge) : undefined,
        at: c.at ? String(c.at) : undefined,
      };
    }

    const mood = String(sc.mood || 'night') as SceneMood;
    const fx = String(sc.fx || 'none') as SceneFx;
    const hl = Array.isArray(sc.hl) ? sc.hl.map((x) => String(x)).filter(Boolean) : [];

    return {
      narration: String(sc.narration || '').trim(),
      mood: VALID_MOODS.includes(mood) ? mood : 'night',
      actors,
      card,
      fx: VALID_FX.includes(fx) ? fx : 'none',
      hl,
    };
  });

  const rawStyle = String(obj.style || defaults?.style || 'night') as CartoonStyleKey;
  const rawEnd = String(obj.end || defaults?.end || 'summary') as CartoonEnding;
  const rawDurations = Array.isArray(obj.sceneDurations)
    ? obj.sceneDurations.filter((d): d is number => typeof d === 'number' && Number.isFinite(d) && d > 0)
    : undefined;

  return {
    title: String(obj.title || 'การ์ตูนเรื่องใหม่').trim(),
    style: VALID_STYLES.includes(rawStyle) ? rawStyle : 'night',
    end: VALID_ENDINGS.includes(rawEnd) ? rawEnd : 'summary',
    characters,
    scenes,
    sceneDurations:
      rawDurations && rawDurations.length === scenes.length ? rawDurations : undefined,
  };
}

export interface TimelineBuildResult {
  timeline: TimelineSegment[];
  totalDuration: number;
  leadSec: number;
  speechStartSec: number;
  speechEndSec: number;
}

export function buildTimeline(
  scenes: SceneDef[],
  options: {
    audioDurationSec?: number;
    speechStartSec?: number;
    speechEndSec?: number;
    sceneDurations?: number[];
  } = {}
): TimelineBuildResult {
  if (scenes.length === 0) {
    return {
      timeline: [],
      totalDuration: 1,
      leadSec: 0.4,
      speechStartSec: 0,
      speechEndSec: 1,
    };
  }

  const leadSec = 0.4;
  const holdSec = 2.4;

  // Case 1: Exact per-scene audio durations (from Gemini per-scene TTS synthesis)
  if (
    options.sceneDurations &&
    options.sceneDurations.length === scenes.length &&
    options.sceneDurations.every((d) => d > 0.1)
  ) {
    let cursor = leadSec;
    const timeline: TimelineSegment[] = scenes.map((s, i) => {
      const dur = options.sceneDurations![i];
      const isLast = i === scenes.length - 1;
      const b = cursor + dur + (isLast ? holdSec : 0);
      const seg: TimelineSegment = { a: cursor, b, s };
      cursor = b;
      return seg;
    });
    const speechLen = options.sceneDurations.reduce((acc, d) => acc + d, 0);
    return {
      timeline,
      totalDuration: Math.max(1, cursor),
      leadSec,
      speechStartSec: options.speechStartSec ?? 0,
      speechEndSec: options.speechEndSec ?? speechLen,
    };
  }

  // Case 2: Single audio buffer or silent estimation proportional to Thai character count
  const weights = scenes.map((s) => Math.max(8, s.narration.replace(/\s/g, '').length));
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const ss = options.speechStartSec ?? 0;
  const se =
    options.speechEndSec ??
    (options.audioDurationSec && options.audioDurationSec > 0
      ? options.audioDurationSec
      : totalWeight / 11);

  const speechSpan = Math.max(1, se - ss);
  const totalDuration = leadSec + speechSpan + holdSec;

  let cursor = leadSec;
  const timeline: TimelineSegment[] = scenes.map((s, i) => {
    const isLast = i === scenes.length - 1;
    const b = isLast ? totalDuration : cursor + (speechSpan * weights[i]) / totalWeight;
    const seg: TimelineSegment = { a: cursor, b, s };
    cursor = b;
    return seg;
  });

  return {
    timeline,
    totalDuration,
    leadSec,
    speechStartSec: ss,
    speechEndSec: se,
  };
}

export interface AudioEnvelopeResult {
  envelope: number[];
  speechStartSec: number;
  speechEndSec: number;
}

export function computeAudioEnvelope(
  samples: Float32Array,
  sampleRate: number
): AudioEnvelopeResult {
  const step = Math.max(1, Math.floor(sampleRate * 0.02));
  const count = Math.floor(samples.length / step);
  if (count === 0) {
    return { envelope: [], speechStartSec: 0, speechEndSec: samples.length / Math.max(1, sampleRate) };
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

  return {
    envelope: rms.map((v) => Math.min(1, v / refPeak)),
    speechStartSec: first * 0.02,
    speechEndSec: (last + 1) * 0.02,
  };
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

export interface SubtitleState {
  text: string;
  highlightRanges: Array<[number, number]>;
}

export function getSubtitleState(
  narration: string,
  highlights: string[],
  localTime: number,
  sceneDuration: number
): SubtitleState | null {
  const clauses = narration
    .split(/(?<=[,.\n])\s*/)
    .map((z) => z.trim())
    .filter(Boolean);
  if (clauses.length === 0) return null;

  const weights = clauses.map((c) => Math.max(1, c.length));
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

  return { text, highlightRanges };
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
