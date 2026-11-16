import type {
  AiEditOp,
  AppConfig,
  StudioEpisode,
  StudioProject,
  StudioScene,
} from '../types/studio';
import { callJsonWithRepair, callLlmWithStreaming } from './openRouterBrain';
import { validateAndFixEpisode } from './sceneValidator';
import { STYLE_PACKS } from './studioData';

export interface ProposedAiEdit {
  summary: string;
  ops: AiEditOp[];
  diffLines: string[];
  previewProject: StudioProject;
}

export function describeAiOps(ops: AiEditOp[], project: StudioProject): string[] {
  const scenes = project.episodes[0]?.scenes || [];
  return ops.map((op) => {
    switch (op.op) {
      case 'addScene':
        return `+ เพิ่มฉากใหม่${op.afterSceneId ? ` หลัง ${op.afterSceneId}` : ''}: "${op.scene.narration?.slice(0, 36)}..."`;
      case 'updateScene': {
        const idx = scenes.findIndex((s) => s.id === op.id);
        return `✎ แก้ไขฉาก ${op.id}${idx >= 0 ? ` (#${idx + 1})` : ''}: ${Object.keys(op.patch || {}).join(', ')}`;
      }
      case 'deleteScene':
        return `✕ ลบฉาก ${op.id}`;
      case 'moveScene':
        return `↕ ย้ายฉาก ${op.id} ไปลำดับที่ ${op.toIndex + 1}`;
      case 'updateCharacter':
        return `👤 แก้ไขตัวละคร ${op.id}: ${Object.keys(op.patch || {}).join(', ')}`;
      case 'setStyle':
        return `🎨 ปรับสไตล์: ${[op.stylePack && `Pack ${op.stylePack}`, op.layout, op.subtitleMode].filter(Boolean).join(', ')}`;
      case 'regenerateScene':
        return `↻ สร้างฉาก ${op.id} ใหม่`;
    }
  });
}

export function applyAiEditOps(project: StudioProject, ops: AiEditOp[]): StudioProject {
  let nextChars = [...project.characters];
  let nextSettings = { ...project.settings };
  let nextStylePack = project.stylePack;
  let nextLayout = project.layout;
  let nextPalette = project.palette;

  const currentEp = project.episodes[0];
  let nextScenes = [...(currentEp?.scenes || [])];

  for (const op of ops) {
    if (op.op === 'addScene') {
      const id = op.scene.id || `S${nextScenes.length + 1}_${Date.now().toString(36).slice(-3)}`;
      const newScene: StudioScene = {
        id,
        narration: op.scene.narration || 'ฉากใหม่',
        highlightWords: op.scene.highlightWords || [],
        holdAfter: op.scene.holdAfter ?? 0.35,
        bg: op.scene.bg || { preset: 'city_night' },
        blurBg: Boolean(op.scene.blurBg),
        hud: op.scene.hud || {},
        actors: op.scene.actors || [],
        props: op.scene.props || [],
        pov: op.scene.pov ?? null,
        cards: op.scene.cards || [],
        camera: op.scene.camera || { type: 'static', shot: 'medium' },
        fx: op.scene.fx || [],
        sfx: op.scene.sfx || [],
        ambient: op.scene.ambient || 'none',
        transition: op.scene.transition || 'fade',
        look: op.scene.look,
        visualIntent: op.scene.visualIntent || op.scene.narration || 'ฉากเพิ่มเติม',
      };
      const idx = op.afterSceneId ? nextScenes.findIndex((s) => s.id === op.afterSceneId) : nextScenes.length - 1;
      if (idx >= 0) {
        nextScenes.splice(idx + 1, 0, newScene);
      } else {
        nextScenes.push(newScene);
      }
    } else if (op.op === 'updateScene') {
      nextScenes = nextScenes.map((s) => {
        if (s.id !== op.id) return s;
        const narrationChanged =
          typeof op.patch.narration === 'string' && op.patch.narration !== s.narration;
        return {
          ...s,
          ...op.patch,
          audio: narrationChanged && s.audio ? { ...s.audio, stale: true } : op.patch.audio ?? s.audio,
        };
      });
    } else if (op.op === 'deleteScene') {
      if (nextScenes.length > 1) {
        nextScenes = nextScenes.filter((s) => s.id !== op.id);
      }
    } else if (op.op === 'moveScene') {
      const fromIdx = nextScenes.findIndex((s) => s.id === op.id);
      if (fromIdx >= 0) {
        const [item] = nextScenes.splice(fromIdx, 1);
        const targetIdx = Math.max(0, Math.min(nextScenes.length, op.toIndex));
        nextScenes.splice(targetIdx, 0, item);
      }
    } else if (op.op === 'updateCharacter') {
      nextChars = nextChars.map((c) => (c.id === op.id ? { ...c, ...op.patch } : c));
    } else if (op.op === 'setStyle') {
      if (op.stylePack) {
        nextStylePack = op.stylePack;
        nextPalette = STYLE_PACKS[op.stylePack].palette;
      }
      if (op.layout) nextLayout = op.layout;
      if (op.subtitleMode) nextSettings = { ...nextSettings, subtitleMode: op.subtitleMode };
    } else if (op.op === 'regenerateScene') {
      nextScenes = nextScenes.map((s) =>
        s.id === op.id
          ? {
              ...s,
              ...op.scene,
              audio: s.audio ? { ...s.audio, stale: true } : undefined,
            }
          : s
      );
    }
  }

  const nextEp: StudioEpisode = {
    ...currentEp,
    scenes: nextScenes,
  };
  const draftProject: StudioProject = {
    ...project,
    stylePack: nextStylePack,
    layout: nextLayout,
    palette: nextPalette,
    characters: nextChars,
    settings: nextSettings,
    episodes: [nextEp],
  };

  return validateAndFixEpisode(draftProject, nextEp).project;
}

export async function requestAiChatEditProposal(params: {
  instruction: string;
  project: StudioProject;
  activeSceneId?: string;
  config: AppConfig;
  signal?: AbortSignal;
}): Promise<ProposedAiEdit> {
  const { instruction, project, activeSceneId, config, signal } = params;
  const model = config.useSameModel ? config.modelScript : config.modelChatEdit;
  const ep = project.episodes[0];
  const compactScenes = (ep?.scenes || []).map((s, idx) => ({
    index: idx,
    id: s.id,
    narration: s.narration,
    bg: s.bg.preset,
    camera: s.camera,
    actors: s.actors,
    fx: s.fx,
    cards: s.cards.map((c) => ({ type: c.type, title: c.title, text: c.text })),
  }));

  const userPrompt = [
    `คำสั่งของผู้ใช้: ${instruction}`,
    activeSceneId ? `ฉากที่ผู้ใช้กำลังดูอยู่: ${activeSceneId}` : '',
    `สไตล์ปัจจุบัน: Pack ${project.stylePack}, layout ${project.layout}, subtitle ${project.settings.subtitleMode}`,
    `ตัวละคร: ${JSON.stringify(project.characters)}`,
    `ฉากทั้งหมด: ${JSON.stringify(compactScenes)}`,
  ]
    .filter(Boolean)
    .join('\n');

  const raw = await callJsonWithRepair<{ summary?: string; ops?: AiEditOp[] }>({
    config,
    model,
    systemPrompt: config.promptTemplates.chatEdit,
    userPrompt,
    signal,
  });

  const ops = Array.isArray(raw.ops) ? raw.ops : [];
  const previewProject = applyAiEditOps(project, ops);
  const diffLines = describeAiOps(ops, project);

  return {
    summary: raw.summary || 'AI เสนอรายการแก้ไขดังนี้',
    ops,
    diffLines: diffLines.length > 0 ? diffLines : ['ไม่มีการเปลี่ยนแปลงโครงสร้างฉาก'],
    previewProject,
  };
}

export async function askProjectAdvisor(params: {
  question: string;
  project: StudioProject;
  config: AppConfig;
  signal?: AbortSignal;
  onStream?: (text: string) => void;
}): Promise<string> {
  const { question, project, config, signal, onStream } = params;
  const model = config.useSameModel ? config.modelScript : config.modelChatEdit;
  const ep = project.episodes[0];
  return callLlmWithStreaming({
    config,
    model,
    systemPrompt:
      'คุณคือที่ปรึกษาด้านการเล่าเรื่องและแอนิเมชัน ตอบคำถามเป็นภาษาไทยอย่างกระชับ ตรงจุด และใช้เฉพาะข้อมูลที่ปรากฏในโปรเจกต์นี้เท่านั้น ห้ามแต่งข้อมูลภายนอก',
    userPrompt: `โปรเจกต์ "${project.title}" (โหมด ${project.mode}, สไตล์ Pack ${project.stylePack}):\nบททั้งหมด:\n${(ep?.scenes || []).map((s) => `${s.id}: ${s.narration}`).join('\n')}\n\nคำถาม: ${question}`,
    wantJson: false,
    signal,
    onToken: onStream,
  });
}
