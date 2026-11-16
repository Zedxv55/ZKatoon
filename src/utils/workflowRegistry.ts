import type { AnimateStylePluginId } from '../types/platform';

export type WorkflowNodeCategory = 'input' | 'ai' | 'character' | 'visual' | 'audio' | 'video';

export interface WorkflowPortDef {
  id: string;
  label: string;
  dataType: 'text' | 'script' | 'character' | 'visual' | 'audio' | 'video';
}

export interface WorkflowNodeTypeDef {
  typeId: string;
  category: WorkflowNodeCategory;
  title: string;
  subtitle: string;
  inputs: WorkflowPortDef[];
  outputs: WorkflowPortDef[];
  defaultParams: Record<string, string | number | boolean>;
}

export interface WorkflowNodeInstance {
  id: string;
  typeId: string;
  label: string;
  position: { x: number; y: number };
  params: Record<string, string | number | boolean>;
  status?: 'idle' | 'running' | 'cached' | 'completed' | 'failed';
  lastError?: string;
  outputPreview?: string;
  cachedHash?: string;
}

export interface WorkflowEdgeInstance {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export const WORKFLOW_CATEGORY_LABELS: Record<WorkflowNodeCategory, { label: string; color: string }> = {
  input: { label: 'Input Nodes', color: '#38bdf8' },
  ai: { label: 'AI Nodes', color: '#a855f7' },
  character: { label: 'Character Nodes', color: '#f59e0b' },
  visual: { label: 'Visual / Map', color: '#10b981' },
  audio: { label: 'Audio Nodes', color: '#ec4899' },
  video: { label: 'Video / QA', color: '#f43f5e' },
};

export const WORKFLOW_NODE_DEFINITIONS: WorkflowNodeTypeDef[] = [
  {
    typeId: 'input_topic',
    category: 'input',
    title: 'หัวข้อ / บทตั้งต้น',
    subtitle: 'กำหนดหัวข้อเรื่อง ความยาว และกลุ่มเป้าหมาย',
    inputs: [],
    outputs: [{ id: 'out_text', label: 'Topic & Brief', dataType: 'text' }],
    defaultParams: {
      topic: 'ความลับของแม่น้ำเจ้าพระยากับการค้าสมัยอยุธยา',
      durationSec: 45,
      aspect: '9:16',
    },
  },
  {
    typeId: 'input_reference',
    category: 'input',
    title: 'ข้อมูลอ้างอิง / ข้อห้าม',
    subtitle: 'แนบข้อเท็จจริงและกฎที่ห้ามแต่งเพิ่ม',
    inputs: [],
    outputs: [{ id: 'out_facts', label: 'Fact Sheet', dataType: 'text' }],
    defaultParams: {
      facts: 'อ้างอิงเส้นทางเดินเรือประวัติศาสตร์ ห้ามแต่งตัวเลขสถิติเอง',
    },
  },
  {
    typeId: 'ai_script_brain',
    category: 'ai',
    title: 'AI Script Writer',
    subtitle: 'เขียนบทพากย์ไทยแยกฉากและคำบรรยาย',
    inputs: [
      { id: 'in_topic', label: 'Topic', dataType: 'text' },
      { id: 'in_facts', label: 'Facts', dataType: 'text' },
    ],
    outputs: [{ id: 'out_script', label: 'Scene Script JSON', dataType: 'script' }],
    defaultParams: {
      modelId: 'nvidia/nemotron-3.5-super-vl:free',
      mode: 'mix',
      billingMode: 'byok',
    },
  },
  {
    typeId: 'ai_prompt_enhancer',
    category: 'ai',
    title: 'Prompt Director',
    subtitle: 'แปลงบทเป็นมุมกล้อง อารมณ์ และการ์ดข้อมูล',
    inputs: [{ id: 'in_script', label: 'Script', dataType: 'script' }],
    outputs: [{ id: 'out_directed', label: 'Directed Storyboard', dataType: 'script' }],
    defaultParams: {
      cameraStyle: 'cinematic_push_in',
      includeCharts: true,
    },
  },
  {
    typeId: 'char_designer',
    category: 'character',
    title: 'Character Cast',
    subtitle: 'ออกแบบตัวละคร สีผิว ทรงผม ชุด และเสียง',
    inputs: [{ id: 'in_script', label: 'Script', dataType: 'script' }],
    outputs: [{ id: 'out_chars', label: 'Character Cast', dataType: 'character' }],
    defaultParams: {
      castCount: 2,
      species: 'human',
      outfit: 'suit',
    },
  },
  {
    typeId: 'visual_animate_style',
    category: 'visual',
    title: 'Animate Style Plugin',
    subtitle: 'เลือกสไตล์ภาพ cth9191/animate (Cut Paper, Riso, Math)',
    inputs: [
      { id: 'in_script', label: 'Storyboard', dataType: 'script' },
      { id: 'in_chars', label: 'Characters', dataType: 'character' },
    ],
    outputs: [{ id: 'out_visual', label: 'Styled Scenes', dataType: 'visual' }],
    defaultParams: {
      animateStyle: 'cut_paper' satisfies AnimateStylePluginId,
      hudEnabled: true,
    },
  },
  {
    typeId: 'visual_map_flyover',
    category: 'visual',
    title: 'Map Animation Block',
    subtitle: 'สร้างฉากแผนที่และเส้นทางบิน MapLibre',
    inputs: [{ id: 'in_topic', label: 'Route Topic', dataType: 'text' }],
    outputs: [{ id: 'out_map', label: 'Map Layer', dataType: 'visual' }],
    defaultParams: {
      presetId: 'bangkok_ayutthaya',
      showRoutePath: true,
    },
  },
  {
    typeId: 'audio_tts_voice',
    category: 'audio',
    title: 'Thai Voice TTS',
    subtitle: 'สังเคราะห์เสียงพากย์ภาษาไทย (Fish Audio / Gemini / BYOK)',
    inputs: [{ id: 'in_script', label: 'Narration', dataType: 'script' }],
    outputs: [{ id: 'out_audio', label: 'Voice Track', dataType: 'audio' }],
    defaultParams: {
      voiceModel: 'fish-audio/s2.1-pro-free:free',
      speed: 1.0,
    },
  },
  {
    typeId: 'audio_bgm_sfx',
    category: 'audio',
    title: 'BGM + Foley Mixer',
    subtitle: 'สร้างดนตรีประกอบและ Auto-Ducking ตามเสียงพากย์',
    inputs: [{ id: 'in_audio', label: 'Voice Track', dataType: 'audio' }],
    outputs: [{ id: 'out_mix', label: 'Master Audio', dataType: 'audio' }],
    defaultParams: {
      mood: 'epic',
      duckingDb: -12,
    },
  },
  {
    typeId: 'video_render_qa',
    category: 'video',
    title: 'FFmpeg Render & QA',
    subtitle: 'ส่งออก MP4 พร้อมตรวจความคมชัด เสียง และเฟรมดำ',
    inputs: [
      { id: 'in_visual', label: 'Visuals', dataType: 'visual' },
      { id: 'in_audio', label: 'Master Audio', dataType: 'audio' },
    ],
    outputs: [{ id: 'out_video', label: 'Final MP4 + QA', dataType: 'video' }],
    defaultParams: {
      resolution: '1080p',
      fps: 30,
      applyToStudio: true,
    },
  },
];

export interface WorkflowTemplatePreset {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNodeInstance[];
  edges: WorkflowEdgeInstance[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplatePreset[] = [
  {
    id: 'tpl_thai_story_9_16',
    name: 'การ์ตูนเล่าเรื่อง 9:16 + Cut Paper + Thai Voice',
    description: 'ท่อผลิตเรื่องสั้นครบวงจรตั้งแต่หัวข้อ -> เขียนบท -> ตัวละคร -> Cut Paper -> พากย์เสียง -> Render',
    nodes: [
      { id: 'n1', typeId: 'input_topic', label: 'หัวข้อเรื่อง', position: { x: 40, y: 120 }, params: { topic: 'วิธีประหยัดเวลาทำงาน 2 ชั่วโมงต่อวัน', durationSec: 45, aspect: '9:16' } },
      { id: 'n2', typeId: 'ai_script_brain', label: 'AI Script Writer', position: { x: 310, y: 120 }, params: { modelId: 'nvidia/nemotron-3.5-super-vl:free', mode: 'mix', billingMode: 'byok' } },
      { id: 'n3', typeId: 'char_designer', label: 'Character Cast', position: { x: 580, y: 40 }, params: { castCount: 2, species: 'human', outfit: 'suit' } },
      { id: 'n4', typeId: 'audio_tts_voice', label: 'Thai Voice TTS', position: { x: 580, y: 220 }, params: { voiceModel: 'fish-audio/s2.1-pro-free:free', speed: 1.0 } },
      { id: 'n5', typeId: 'visual_animate_style', label: 'Cut Paper Engine', position: { x: 850, y: 40 }, params: { animateStyle: 'cut_paper', hudEnabled: true } },
      { id: 'n6', typeId: 'video_render_qa', label: 'FFmpeg Render & QA', position: { x: 1120, y: 120 }, params: { resolution: '1080p', fps: 30, applyToStudio: true } },
    ],
    edges: [
      { id: 'e1-2', source: 'n1', target: 'n2' },
      { id: 'e2-3', source: 'n2', target: 'n3' },
      { id: 'e2-4', source: 'n2', target: 'n4' },
      { id: 'e3-5', source: 'n3', target: 'n5' },
      { id: 'e2-5', source: 'n2', target: 'n5' },
      { id: 'e5-6', source: 'n5', target: 'n6' },
      { id: 'e4-6', source: 'n4', target: 'n6' },
    ],
  },
  {
    id: 'tpl_map_history_doc',
    name: 'สารคดีแผนที่ประวัติศาสตร์ (MapLibre + Riso)',
    description: 'ผสานแผนที่เส้นทางเดินทัพ/การค้ากับสไตล์ภาพ Riso Print และเสียงพากย์บรรยาย',
    nodes: [
      { id: 'm1', typeId: 'input_topic', label: 'หัวข้อสารคดีแผนที่', position: { x: 40, y: 120 }, params: { topic: 'เส้นทางเรือสำเภาอยุธยา-กรุงเทพฯ', durationSec: 60, aspect: '16:9' } },
      { id: 'm2', typeId: 'visual_map_flyover', label: 'Map Animation Block', position: { x: 320, y: 40 }, params: { presetId: 'bangkok_ayutthaya', showRoutePath: true } },
      { id: 'm3', typeId: 'ai_script_brain', label: 'AI Documentary Script', position: { x: 320, y: 220 }, params: { modelId: 'nvidia/nemotron-3.5-super-vl:free', mode: 'explainer', billingMode: 'byok' } },
      { id: 'm4', typeId: 'audio_tts_voice', label: 'Narration Voice', position: { x: 610, y: 220 }, params: { voiceModel: 'fish-audio/s2.1-pro-free:free', speed: 1.0 } },
      { id: 'm5', typeId: 'visual_animate_style', label: 'Riso Print Pass', position: { x: 610, y: 40 }, params: { animateStyle: 'riso_print', hudEnabled: true } },
      { id: 'm6', typeId: 'video_render_qa', label: 'Final Render & QA', position: { x: 900, y: 120 }, params: { resolution: '1080p', fps: 30, applyToStudio: true } },
    ],
    edges: [
      { id: 'me1', source: 'm1', target: 'm2' },
      { id: 'me2', source: 'm1', target: 'm3' },
      { id: 'me3', source: 'm2', target: 'm5' },
      { id: 'me4', source: 'm3', target: 'm5' },
      { id: 'me5', source: 'm3', target: 'm4' },
      { id: 'me6', source: 'm5', target: 'm6' },
      { id: 'me7', source: 'm4', target: 'm6' },
    ],
  },
];

/**
 * Pure topological level grouping (Kahn's algorithm) with cycle detection.
 * Independent nodes in the same level execute in parallel.
 */
export function computeTopologicalLevels(
  nodes: WorkflowNodeInstance[],
  edges: WorkflowEdgeInstance[]
): { ok: true; levels: WorkflowNodeInstance[][] } | { ok: false; error: string } {
  const nodeMap = new Map<string, WorkflowNodeInstance>(nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    if (!nodeMap.has(e.source) || !nodeMap.has(e.target)) continue;
    if (e.source === e.target) {
      return { ok: false, error: `พบลูปตัวเองที่โหนด "${nodeMap.get(e.source)?.label}"` };
    }
    adj.get(e.source)!.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
  }

  let frontier = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0);
  const levels: WorkflowNodeInstance[][] = [];
  let visitedCount = 0;

  while (frontier.length > 0) {
    levels.push(frontier);
    const nextFrontier: WorkflowNodeInstance[] = [];
    for (const u of frontier) {
      visitedCount++;
      for (const vId of adj.get(u.id) || []) {
        const nextDeg = (inDegree.get(vId) || 0) - 1;
        inDegree.set(vId, nextDeg);
        if (nextDeg === 0) {
          const targetNode = nodeMap.get(vId);
          if (targetNode) nextFrontier.push(targetNode);
        }
      }
    }
    frontier = nextFrontier;
  }

  if (visitedCount !== nodes.length) {
    return {
      ok: false,
      error: 'Workflow มีการเชื่อมต่อวนเป็นวงกลม (Cycle Detected) กรุณาลบเส้นที่วนกลับก่อนรัน',
    };
  }

  return { ok: true, levels };
}

export function hashNodeConfig(node: WorkflowNodeInstance, inputPreviews: string[]): string {
  return JSON.stringify({
    typeId: node.typeId,
    params: node.params,
    inputs: inputPreviews,
  });
}

export function autoLayoutWorkflowNodes(
  nodes: WorkflowNodeInstance[],
  edges: WorkflowEdgeInstance[]
): WorkflowNodeInstance[] {
  const topo = computeTopologicalLevels(nodes, edges);
  if (!topo.ok) return nodes;
  const posById = new Map<string, { x: number; y: number }>();
  topo.levels.forEach((levelNodes, colIdx) => {
    levelNodes.forEach((n, rowIdx) => {
      posById.set(n.id, {
        x: 40 + colIdx * 280,
        y: 50 + rowIdx * 165,
      });
    });
  });
  return nodes.map((n) => ({
    ...n,
    position: posById.get(n.id) || n.position,
  }));
}
