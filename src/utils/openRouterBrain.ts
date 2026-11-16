import type {
  AppConfig,
  EndingType,
  EpisodeChapter,
  OpenRouterModel,
  PaletteColor,
  StoryMode,
  StudioCharacter,
  StudioEpisode,
  StudioProject,
  StudioScene,
  StylePackId,
  SubtitleMode,
  VideoLayout,
  WizardAnswers,
} from '../types/studio';
import { validateAndFixEpisode } from './sceneValidator';
import { STYLE_PACKS } from './studioData';

export interface ModelRawItem {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string | number; completion?: string | number };
  supported_parameters?: string[];
}

export function parseOpenRouterModels(data: { data?: ModelRawItem[] }): OpenRouterModel[] {
  const list = Array.isArray(data?.data) ? data.data : [];
  return list
    .filter((m) => typeof m?.id === 'string' && m.id.length > 0)
    .map((m) => {
      const promptPrice = Number(m.pricing?.prompt ?? 0) * 1_000_000;
      const compPrice = Number(m.pricing?.completion ?? 0) * 1_000_000;
      const params = Array.isArray(m.supported_parameters) ? m.supported_parameters.map(String) : [];
      const supportsStructuredOutput =
        params.includes('response_format') || params.includes('structured_outputs');
      return {
        id: m.id,
        name: String(m.name || m.id),
        contextLength: Number(m.context_length || 32000),
        promptPricePerM: Number.isFinite(promptPrice) ? Math.max(0, promptPrice) : 0,
        completionPricePerM: Number.isFinite(compPrice) ? Math.max(0, compPrice) : 0,
        supportsStructuredOutput,
        supportedParameters: params,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchOpenRouterModels(apiKey?: string, signal?: AbortSignal): Promise<OpenRouterModel[]> {
  const headers: Record<string, string> = {};
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers, signal });
  if (!res.ok) {
    throw new Error(`โหลดรายการโมเดลไม่สำเร็จ (HTTP ${res.status})`);
  }
  const json = (await res.json()) as { data?: ModelRawItem[] };
  return parseOpenRouterModels(json);
}

export function extractJsonFromText(raw: string): unknown {
  const cleaned = String(raw || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const objIdx = cleaned.indexOf('{');
  const arrIdx = cleaned.indexOf('[');
  const start =
    objIdx >= 0 && arrIdx >= 0 ? Math.min(objIdx, arrIdx) : Math.max(objIdx, arrIdx);
  if (start < 0) {
    throw new Error('AI ไม่ได้ส่ง JSON กลับมา');
  }
  const openCh = cleaned[start];
  const closeCh = openCh === '[' ? ']' : '}';
  const end = cleaned.lastIndexOf(closeCh);
  if (end <= start) {
    throw new Error('JSON จาก AI ไม่สมบูรณ์');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function estimateThaiPipelineTokens(durationSec: number): {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
} {
  const sceneCount = Math.max(4, Math.round(durationSec / 6));
  const scriptTokens = Math.round(durationSec * 11 * 0.7);
  return {
    estimatedInputTokens: 3200 + sceneCount * 220,
    estimatedOutputTokens: scriptTokens + sceneCount * 280,
  };
}

export function estimateCostUsd(
  model: OpenRouterModel | undefined,
  inputTokens: number,
  outputTokens: number
): number {
  if (!model) return 0;
  return (
    (inputTokens / 1_000_000) * model.promptPricePerM +
    (outputTokens / 1_000_000) * model.completionPricePerM
  );
}

export async function callLlmWithStreaming(params: {
  config: AppConfig;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  wantJson?: boolean;
  signal?: AbortSignal;
  onToken?: (partial: string) => void;
}): Promise<string> {
  const { config, model, systemPrompt, userPrompt, wantJson = false, signal, onToken } = params;

  const isCustom = config.useCustomLlm;
  const baseUrl = isCustom
    ? (config.customLlmBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')
    : 'https://openrouter.ai/api/v1';
  const apiKey = (isCustom ? config.customLlmKey : config.openRouterKey).trim();
  const resolvedModel = isCustom ? (config.customLlmModel || model).trim() : model;

  if (!apiKey) {
    throw new Error(isCustom ? 'ยังไม่ได้ใส่ API Key ของ Custom Endpoint' : 'ยังไม่ได้ใส่ OpenRouter API Key');
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (!isCustom) {
    headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.origin : 'https://zkatoon.local';
    headers['X-Title'] = 'ZKatoon Studio';
  }

  const body: Record<string, unknown> = {
    model: resolvedModel,
    stream: true,
    temperature: wantJson ? 0.45 : 0.75,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
  if (wantJson) {
    body.response_format = { type: 'json_object' };
  }

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) throw new Error('ยกเลิกการทำงานของ AI แล้ว');
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        signal,
        body: JSON.stringify(body),
      });

      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 900 * Math.pow(2, attempt)));
        lastErr = new Error(`AI ตอบกลับ HTTP ${res.status}`);
        continue;
      }

      if (!res.ok) {
        // Retry once without response_format if model rejected structured outputs
        if (wantJson && body.response_format && res.status === 400) {
          delete body.response_format;
          continue;
        }
        const errText = await res.text().catch(() => res.statusText);
        throw new Error(`HTTP ${res.status}: ${errText.slice(0, 180)}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/event-stream') || !res.body) {
        const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const txt = json.choices?.[0]?.message?.content || '';
        onToken?.(txt);
        return txt;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
            };
            const piece = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || '';
            if (piece) {
              fullText += piece;
              onToken?.(fullText);
            }
          } catch {
            // ignore partial SSE line
          }
        }
      }
      return fullText;
    } catch (err) {
      if (signal?.aborted) throw new Error('ยกเลิกการทำงานของ AI แล้ว');
      lastErr = err instanceof Error ? err : new Error('เกิดข้อผิดพลาดระหว่างเรียก AI');
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
      }
    }
  }
  throw lastErr || new Error('เรียก AI ไม่สำเร็จ');
}

export async function callJsonWithRepair<T>(params: {
  config: AppConfig;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
  onToken?: (txt: string) => void;
}): Promise<T> {
  let raw = await callLlmWithStreaming({ ...params, wantJson: true });
  for (let repair = 0; repair < 2; repair++) {
    try {
      return extractJsonFromText(raw) as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'JSON Invalid';
      raw = await callLlmWithStreaming({
        config: params.config,
        model: params.model,
        systemPrompt: 'คุณคือผู้ซ่อม JSON ส่งคืนเฉพาะ JSON ที่ถูกต้องเท่านั้น ห้ามมีคำอธิบาย',
        userPrompt: `แก้ไข JSON นี้ให้ถูกต้องตาม syntax (ข้อผิดพลาด: ${msg}):\n${raw.slice(0, 6000)}`,
        wantJson: true,
        signal: params.signal,
      });
    }
  }
  return extractJsonFromText(raw) as T;
}

export function resolveWizardDefaults(ans: WizardAnswers): {
  mode: StoryMode;
  stylePack: StylePackId;
  layout: VideoLayout;
  subtitleMode: SubtitleMode;
  endingType: EndingType;
} {
  const mode: StoryMode = ans.mode === 'auto' ? 'story' : ans.mode;
  const stylePack: StylePackId = ans.stylePack === 'auto' ? (mode === 'explainer' ? 'C' : 'A') : ans.stylePack;
  const pack = STYLE_PACKS[stylePack];
  const layout: VideoLayout = ans.layout === 'auto' ? pack.defaultLayout : ans.layout;
  const subtitleMode: SubtitleMode = ans.subtitleMode === 'auto' ? pack.defaultSubtitle : ans.subtitleMode;
  const endingType: EndingType = ans.ending === 'auto' ? (mode === 'explainer' ? 'summary' : 'twist') : ans.ending;
  return { mode, stylePack, layout, subtitleMode, endingType };
}

export interface PipelineConceptOutput {
  title: string;
  recap: string;
  palette: PaletteColor[];
  characters: StudioCharacter[];
}

export interface PipelineOutlineChapter {
  id: string;
  title: string;
  beats: string[];
  targetSeconds: number;
}

export async function generateConceptStep(params: {
  answers: WizardAnswers;
  config: AppConfig;
  sequelBibleRecap?: string;
  sequelCharacters?: StudioCharacter[];
  signal?: AbortSignal;
  onStream?: (text: string) => void;
}): Promise<PipelineConceptOutput> {
  const { answers, config, sequelBibleRecap, sequelCharacters, signal, onStream } = params;
  const resolved = resolveWizardDefaults(answers);
  const model = config.useSameModel ? config.modelScript : config.modelScript;

  const userPrompt = [
    `หัวข้อเรื่อง: ${answers.topic}`,
    `โหมด: ${resolved.mode} | แนวเรื่อง: ${answers.genre} | กลุ่มผู้ชม: ${answers.audience}`,
    `สไตล์: Pack ${resolved.stylePack} (${answers.customStyleDesc || STYLE_PACKS[resolved.stylePack].shortDesc})`,
    `จำนวนตัวละครที่ต้องการ: ${answers.characterPreset}`,
    answers.extraFacts ? `ข้อเท็จจริงที่ผู้ใช้ให้ไว้ (ใช้ได้เฉพาะส่วนนี้): ${answers.extraFacts}` : '',
    answers.extraForbidden ? `ห้ามพูดถึง: ${answers.extraForbidden}` : '',
    sequelBibleRecap ? `ภาคต่อจาก Series Bible: ${sequelBibleRecap}` : '',
    sequelCharacters?.length ? `ตัวละครที่ล็อกไว้จากภาคก่อน (ห้ามเปลี่ยนหน้าตา/ชุด): ${JSON.stringify(sequelCharacters)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const out = await callJsonWithRepair<Partial<PipelineConceptOutput>>({
    config,
    model,
    systemPrompt: config.promptTemplates.conceptAndPalette,
    userPrompt,
    signal,
    onToken: onStream,
  });

  return {
    title: String(out.title || answers.topic || 'เรื่องสั้นเรื่องใหม่'),
    recap: String(out.recap || answers.topic),
    palette: Array.isArray(out.palette) && out.palette.length >= 3 ? out.palette : STYLE_PACKS[resolved.stylePack].palette,
    characters:
      sequelCharacters?.length
        ? sequelCharacters
        : Array.isArray(out.characters) && out.characters.length > 0
          ? out.characters
          : [],
  };
}

export async function generateOutlineStep(params: {
  answers: WizardAnswers;
  concept: PipelineConceptOutput;
  config: AppConfig;
  signal?: AbortSignal;
  onStream?: (text: string) => void;
}): Promise<PipelineOutlineChapter[]> {
  const { answers, concept, config, signal, onStream } = params;
  const resolved = resolveWizardDefaults(answers);
  const model = config.modelScript;
  const sys = config.promptTemplates.outline.replace('{{endingType}}', resolved.endingType);

  const userPrompt = [
    `ชื่อเรื่อง: ${concept.title}`,
    `สรุปเรื่อง: ${concept.recap}`,
    `ความยาววิดีโอรวมเป้าหมาย: ${answers.durationSec} วินาที`,
    `องค์ประกอบที่อยากให้มี: ${answers.elements.join(', ') || 'ตามความเหมาะสม'}`,
    answers.extraFacts ? `ข้อมูลอ้างอิงจากผู้ใช้: ${answers.extraFacts}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const res = await callJsonWithRepair<{ chapters?: PipelineOutlineChapter[] }>({
    config,
    model,
    systemPrompt: sys,
    userPrompt,
    signal,
    onToken: onStream,
  });

  if (Array.isArray(res.chapters) && res.chapters.length > 0) {
    return res.chapters;
  }
  return [{ id: 'ch1', title: 'เนื้อเรื่องหลัก', beats: [concept.recap], targetSeconds: answers.durationSec }];
}

export async function generateChapterScriptStep(params: {
  chapter: PipelineOutlineChapter;
  concept: PipelineConceptOutput;
  answers: WizardAnswers;
  config: AppConfig;
  signal?: AbortSignal;
  onStream?: (text: string) => void;
}): Promise<string[]> {
  const { chapter, concept, answers, config, signal, onStream } = params;
  const sys = config.promptTemplates.chapterScript
    .replace('{{seriesBible}}', concept.recap)
    .replace('{{targetSeconds}}', String(chapter.targetSeconds || 30));

  const userPrompt = [
    `บท: ${chapter.title}`,
    `โครงเหตุการณ์ในบทนี้: ${(chapter.beats || []).join(' -> ')}`,
    `ตัวละครหลัก: ${concept.characters.map((c) => `${c.id}(${c.name})`).join(', ')}`,
    answers.extraFacts ? `ข้อเท็จจริงของผู้ใช้: ${answers.extraFacts}` : '',
    answers.extraForbidden ? `ห้ามใส่: ${answers.extraForbidden}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await callLlmWithStreaming({
    config,
    model: config.modelScript,
    systemPrompt: sys,
    userPrompt,
    wantJson: false,
    signal,
    onToken: onStream,
  });

  return raw
    .split('\n')
    .map((l) => l.replace(/^\d+[.)]\s*/, '').trim())
    .filter((l) => l.length > 0);
}

export async function generateScenesForChapterLines(params: {
  project: StudioProject;
  episode: StudioEpisode;
  chapter: EpisodeChapter;
  lines: string[];
  isFinalChapter: boolean;
  config: AppConfig;
  signal?: AbortSignal;
  onStream?: (text: string) => void;
}): Promise<StudioScene[]> {
  const { project, episode, chapter, lines, isFinalChapter, config, signal, onStream } = params;
  const model = config.useSameModel ? config.modelScript : config.modelSceneJson;
  const allScenes: StudioScene[] = [];

  // Process max 20 scenes per LLM call so long videos never blow context or get truncated
  for (let offset = 0; offset < lines.length; offset += 20) {
    const batchLines = lines.slice(offset, offset + 20);
    const isLastBatch = isFinalChapter && offset + 20 >= lines.length;

    const userPrompt = [
      `โปรเจกต์: ${project.title} | Style Pack ${project.stylePack} | Layout ${project.layout}`,
      `บทที่: ${chapter.title} | endingType: ${episode.endingType}`,
      `ตัวละครที่มี: ${JSON.stringify(project.characters)}`,
      project.settings.sourceNotes.length > 0
        ? `แหล่งอ้างอิงที่ผู้ใช้ให้ (ใช้ source_note/source_chip ได้เฉพาะรายการนี้): ${project.settings.sourceNotes.join(', ')}`
        : 'ผู้ใช้ไม่ได้ระบุแหล่งอ้างอิงใดๆ -> ห้ามสร้าง source_note/source_chip เด็ดขาด!',
      isLastBatch ? 'หมายเหตุ: ฉากสุดท้ายของชุดนี้คือฉากจบตอน ต้องใส่ card end_card และ holdAfter >= 2.5' : '',
      `รายการบรรทัดบทพากย์ที่ต้องคงไว้ทุกตัวอักษร (${batchLines.length} ฉาก):`,
      JSON.stringify(batchLines),
    ]
      .filter(Boolean)
      .join('\n');

    const res = await callJsonWithRepair<{ scenes?: StudioScene[] }>({
      config,
      model,
      systemPrompt: config.promptTemplates.chapterScenes,
      userPrompt,
      signal,
      onToken: onStream,
    });

    const parsed = Array.isArray(res.scenes) ? res.scenes : [];
    batchLines.forEach((lineText, idx) => {
      const candidate = parsed[idx] || ({} as Partial<StudioScene>);
      allScenes.push({
        id: candidate.id || `${chapter.id}_S${offset + idx + 1}`,
        narration: lineText, // Guarantee 100% character-exact preservation of script
        speech: candidate.speech,
        speaker: candidate.speaker,
        subtitle: candidate.subtitle,
        highlightWords: Array.isArray(candidate.highlightWords) ? candidate.highlightWords : [],
        holdAfter: typeof candidate.holdAfter === 'number' ? candidate.holdAfter : 0.35,
        bg: candidate.bg?.preset ? candidate.bg : { preset: project.stylePack === 'C' ? 'noodle_shop' : 'city_night' },
        blurBg: Boolean(candidate.blurBg),
        hud: candidate.hud && typeof candidate.hud === 'object' ? candidate.hud : {},
        actors: Array.isArray(candidate.actors) ? candidate.actors : [],
        props: Array.isArray(candidate.props) ? candidate.props : [],
        pov: candidate.pov ?? null,
        cards: Array.isArray(candidate.cards) ? candidate.cards : [],
        camera: candidate.camera || { type: 'static', shot: 'medium' },
        fx: Array.isArray(candidate.fx) ? candidate.fx : [],
        sfx: Array.isArray(candidate.sfx) ? candidate.sfx : [],
        ambient: candidate.ambient || 'none',
        transition: candidate.transition || 'fade',
        look: candidate.look,
        visualIntent: candidate.visualIntent || lineText.slice(0, 40),
      });
    });
  }

  return allScenes;
}

export function buildAndValidateGeneratedProject(params: {
  baseProject: StudioProject;
  chapters: EpisodeChapter[];
  scenes: StudioScene[];
  fullScript: string;
}) {
  const { baseProject, chapters, scenes, fullScript } = params;
  const ep = baseProject.episodes[0];
  const updatedEp: StudioEpisode = {
    ...ep,
    chapters,
    scenes,
  };
  const updatedProj: StudioProject = {
    ...baseProject,
    fullScript,
    episodes: [updatedEp],
  };
  return validateAndFixEpisode(updatedProj, updatedEp, { fullScript });
}
