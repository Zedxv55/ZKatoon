import type {
  StudioScene,
  StudioTimelineSegment,
} from '../types/studio';

export interface PauseCandidate {
  midSec: number;
  durSec: number;
}

export interface AudioEnvelopeAnalysis {
  envelope: number[];
  speechStartSec: number;
  speechEndSec: number;
  pauseCandidates: PauseCandidate[];
}

export interface TimelineSyncDiagnostics {
  mode: 'per-scene-tts' | 'pause-matched' | 'weighted-audio' | 'estimated';
  foundPauses: number;
  matchedBoundaries: number;
  totalBoundaries: number;
}

export interface TimelineBuildOutput {
  segments: StudioTimelineSegment[];
  totalDuration: number;
  leadSec: number;
  speechStartSec: number;
  speechEndSec: number;
  diagnostics: TimelineSyncDiagnostics;
}

/**
 * Computes Thai text speaking weight:
 * regular char = 1, comma/space = 3, period/newline = 6
 */
export function computeThaiSpeechWeight(text: string): number {
  let w = 0;
  for (const ch of text) {
    if (ch === '.' || ch === '\n') w += 6;
    else if (ch === ',' || ch === ' ') w += 3;
    else w += 1;
  }
  return Math.max(8, w);
}

/**
 * Analyzes RMS envelope in 20ms frames and detects pauses >= 220ms
 * using an adaptive 8% threshold relative to the 95th-percentile peak.
 */
export function analyzeAudioEnvelope(
  samples: Float32Array,
  sampleRate: number
): AudioEnvelopeAnalysis {
  const step = Math.max(1, Math.floor(sampleRate * 0.02));
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
  const refPeak = Math.max(1e-5, sorted[Math.floor(sorted.length * 0.95)] || 1);
  const threshold = refPeak * 0.08;

  let first = rms.findIndex((v) => v > threshold);
  let last = -1;
  for (let i = rms.length - 1; i >= 0; i--) {
    if (rms[i] > threshold) {
      last = i;
      break;
    }
  }
  if (first < 0 || last < first) {
    first = 0;
    last = rms.length - 1;
  }

  const pauseCandidates: PauseCandidate[] = [];
  let silentStart = -1;
  for (let i = first; i <= last; i++) {
    if (rms[i] <= threshold) {
      if (silentStart < 0) silentStart = i;
    } else if (silentStart >= 0) {
      const frames = i - silentStart;
      if (frames >= 11) {
        // >= 220ms
        const startRel = (silentStart - first) * 0.02;
        const durSec = frames * 0.02;
        pauseCandidates.push({
          midSec: Number((startRel + durSec / 2).toFixed(3)),
          durSec: Number(durSec.toFixed(3)),
        });
      }
      silentStart = -1;
    }
  }

  return {
    envelope: rms.map((v) => Math.min(1, v / refPeak)),
    speechStartSec: first * 0.02,
    speechEndSec: (last + 1) * 0.02,
    pauseCandidates,
  };
}

function snapMonotonicBoundaries(
  expectedBounds: number[],
  totalSpeechSpan: number,
  pauseCandidates: PauseCandidate[]
): { boundaries: number[]; matchedCount: number } {
  const nBounds = expectedBounds.length;
  if (nBounds === 0) return { boundaries: [], matchedCount: 0 };

  const minScene = 1.2;
  const maxSnap = 1.2;
  const out: number[] = [];
  let prev = 0;
  let lastPauseIdx = -1;
  let matchedCount = 0;

  for (let i = 0; i < nBounds; i++) {
    const exp = expectedBounds[i];
    const remaining = nBounds - i;
    const minAllowed = prev + minScene;
    const maxAllowed = Math.max(minAllowed, totalSpeechSpan - remaining * minScene);

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
      out.push(chosen);
      prev = chosen;
      lastPauseIdx = bestIdx;
      matchedCount++;
    } else {
      const clamped = Math.max(minAllowed, Math.min(maxAllowed, exp));
      out.push(clamped);
      prev = clamped;
    }
  }

  return { boundaries: out, matchedCount };
}

export function buildStudioTimeline(
  scenes: StudioScene[],
  options: {
    masterAudioDurationSec?: number;
    speechStartSec?: number;
    speechEndSec?: number;
    pauseCandidates?: PauseCandidate[];
    perSceneDurations?: Record<string, number>;
    globalOffsetSec?: number;
  } = {}
): TimelineBuildOutput {
  if (scenes.length === 0) {
    return {
      segments: [],
      totalDuration: 1,
      leadSec: 0.35,
      speechStartSec: 0,
      speechEndSec: 1,
      diagnostics: { mode: 'estimated', foundPauses: 0, matchedBoundaries: 0, totalBoundaries: 0 },
    };
  }

  const leadSec = Math.max(0.1, 0.35 + (options.globalOffsetSec ?? 0));
  const pauses = options.pauseCandidates ?? [];
  const hasPerScene =
    Boolean(options.perSceneDurations) &&
    scenes.some((s) => (options.perSceneDurations?.[s.id] ?? s.audio?.durationSec ?? 0) > 0.2);

  if (hasPerScene) {
    let cursor = leadSec;
    const segments: StudioTimelineSegment[] = scenes.map((s, i) => {
      const isLast = i === scenes.length - 1;
      const rawDur =
        options.perSceneDurations?.[s.id] ??
        s.audio?.durationSec ??
        Math.max(2.0, computeThaiSpeechWeight(s.narration) / 11);
      const speechDur = Math.max(1.0, rawDur + (s.syncOffset ?? 0));
      const hold = s.holdAfter ?? (isLast ? 2.5 : 0.3);
      const speechEndSec = cursor + speechDur;
      const endSec = speechEndSec + hold;
      const seg: StudioTimelineSegment = {
        scene: s,
        index: i,
        startSec: cursor,
        speechEndSec,
        endSec,
      };
      cursor = endSec;
      return seg;
    });
    const speechLen = Math.max(1, (segments[segments.length - 1]?.speechEndSec ?? 1) - leadSec);
    return {
      segments,
      totalDuration: Math.max(1, cursor),
      leadSec,
      speechStartSec: 0,
      speechEndSec: speechLen,
      diagnostics: {
        mode: 'per-scene-tts',
        foundPauses: pauses.length,
        matchedBoundaries: Math.max(0, scenes.length - 1),
        totalBoundaries: Math.max(0, scenes.length - 1),
      },
    };
  }

  const weights = scenes.map((s) => computeThaiSpeechWeight(s.narration));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const ss = options.speechStartSec ?? 0;
  const hasRealAudio = Boolean(options.masterAudioDurationSec && options.masterAudioDurationSec > 0);
  const se = options.speechEndSec ?? (hasRealAudio ? options.masterAudioDurationSec! : totalWeight / 11);
  const speechSpan = Math.max(scenes.length * 1.2, se - ss);

  const expectedBounds: number[] = [];
  let accW = 0;
  for (let i = 0; i < scenes.length - 1; i++) {
    accW += weights[i];
    expectedBounds.push((accW / totalWeight) * speechSpan);
  }

  const { boundaries, matchedCount } =
    hasRealAudio && pauses.length > 0
      ? snapMonotonicBoundaries(expectedBounds, speechSpan, pauses)
      : { boundaries: expectedBounds, matchedCount: 0 };

  let cursor = leadSec;
  let prevRel = 0;
  const segments: StudioTimelineSegment[] = scenes.map((s, i) => {
    const isLast = i === scenes.length - 1;
    const nextRel = isLast ? speechSpan : boundaries[i];
    const baseDur = Math.max(1.2, nextRel - prevRel);
    prevRel = nextRel;
    const adjustedSpeech = Math.max(1.0, baseDur + (s.syncOffset ?? 0));
    const hold = s.holdAfter ?? (isLast ? 2.5 : 0.3);
    const speechEndSec = cursor + adjustedSpeech;
    const endSec = speechEndSec + hold;
    const seg: StudioTimelineSegment = {
      scene: s,
      index: i,
      startSec: cursor,
      speechEndSec,
      endSec,
    };
    cursor = endSec;
    return seg;
  });

  return {
    segments,
    totalDuration: Math.max(1, cursor),
    leadSec,
    speechStartSec: ss,
    speechEndSec: se,
    diagnostics: {
      mode: hasRealAudio ? (pauses.length > 0 ? 'pause-matched' : 'weighted-audio') : 'estimated',
      foundPauses: pauses.length,
      matchedBoundaries: matchedCount,
      totalBoundaries: Math.max(0, scenes.length - 1),
    },
  };
}

export function resolveAtTextLocalSec(
  narration: string,
  atText: string | undefined,
  sceneSpeechDuration: number,
  sceneStartRelToSpeech = 0,
  pauseCandidates: PauseCandidate[] = []
): number {
  if (!atText || !narration) return 0;
  const charIdx = narration.indexOf(atText);
  if (charIdx < 0) return 0;

  const rawLocal = (charIdx / Math.max(1, narration.length)) * sceneSpeechDuration;
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

export function getActiveSubtitleClause(
  narration: string,
  highlightWords: string[],
  localTime: number,
  speechDuration: number
): { text: string; highlights: string[] } | null {
  const clauses = String(narration || '')
    .split(/(?<=[,.\n])\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (clauses.length === 0) return null;

  const weights = clauses.map((c) => computeThaiSpeechWeight(c));
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  let active = clauses[clauses.length - 1];
  for (let i = 0; i < clauses.length; i++) {
    acc += (weights[i] / total) * Math.max(0.5, speechDuration);
    if (localTime < acc) {
      active = clauses[i];
      break;
    }
  }
  const cleanText = active.replace(/[,.]+$/, '');
  return { text: cleanText, highlights: highlightWords || [] };
}
