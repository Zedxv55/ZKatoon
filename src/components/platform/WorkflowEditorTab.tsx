import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Copy,
  Download,
  LayoutGrid,
  Play,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AnimateStylePluginId } from '../../types/platform';
import type { AppConfig, StudioProject } from '../../types/studio';
import { platformApi } from '../../utils/platformApi';
import { DEMO_PROJECT_A, DEMO_PROJECT_B } from '../../utils/studioData';
import {
  WORKFLOW_CATEGORY_LABELS,
  WORKFLOW_NODE_DEFINITIONS,
  WORKFLOW_TEMPLATES,
  autoLayoutWorkflowNodes,
  computeTopologicalLevels,
  hashNodeConfig,
  type WorkflowEdgeInstance,
  type WorkflowNodeInstance,
} from '../../utils/workflowRegistry';

interface WorkflowEditorTabProps {
  activeProject: StudioProject;
  config: AppConfig;
  isSignedIn: boolean;
  onApplyProjectToStudio: (project: StudioProject) => void;
  onNotify?: (msg: string) => void;
}

type LegoNodeData = {
  typeId: string;
  label: string;
  category: keyof typeof WORKFLOW_CATEGORY_LABELS;
  params: Record<string, string | number | boolean>;
  status: 'idle' | 'running' | 'cached' | 'completed' | 'failed';
  outputPreview?: string;
  lastError?: string;
  hasInput: boolean;
  hasOutput: boolean;
};

function LegoWorkflowNode({ data, selected }: NodeProps<Node<LegoNodeData>>) {
  const catMeta = WORKFLOW_CATEGORY_LABELS[data.category] || WORKFLOW_CATEGORY_LABELS.ai;
  const statusColor =
    data.status === 'completed'
      ? 'text-emerald-300'
      : data.status === 'cached'
        ? 'text-sky-300'
        : data.status === 'running'
          ? 'text-amber-300'
          : data.status === 'failed'
            ? 'text-rose-300'
            : 'text-white/50';

  return (
    <div
      className={`min-w-[205px] max-w-[240px] rounded-xl border bg-[#161724] p-2.5 shadow-xl transition-colors ${
        selected ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-white/15'
      }`}
    >
      {data.hasInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-[#0a0b10] !bg-amber-400"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[10px] font-extrabold uppercase tracking-wider"
          style={{ color: catMeta.color }}
        >
          {catMeta.label}
        </span>
        <span className={`font-mono-tabular text-[10px] font-bold uppercase ${statusColor}`}>
          {data.status}
        </span>
      </div>
      <div className="mt-1 truncate text-xs font-bold text-white">{data.label}</div>
      {data.outputPreview && (
        <div className="mt-1.5 line-clamp-2 rounded-lg bg-black/40 px-2 py-1 text-[10px] text-[#c7c3e0]">
          {data.outputPreview}
        </div>
      )}
      {data.lastError && (
        <div className="mt-1.5 line-clamp-2 rounded-lg bg-rose-950/60 px-2 py-1 text-[10px] text-rose-200">
          {data.lastError}
        </div>
      )}
      {data.hasOutput && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-[#0a0b10] !bg-emerald-400"
        />
      )}
    </div>
  );
}

const NODE_TYPES = { legoNode: LegoWorkflowNode };

function toReactFlowNodes(list: WorkflowNodeInstance[]): Node<LegoNodeData>[] {
  return list.map((n) => {
    const def = WORKFLOW_NODE_DEFINITIONS.find((d) => d.typeId === n.typeId);
    return {
      id: n.id,
      type: 'legoNode',
      position: n.position,
      data: {
        typeId: n.typeId,
        label: n.label,
        category: def?.category || 'ai',
        params: n.params,
        status: n.status || 'idle',
        outputPreview: n.outputPreview,
        lastError: n.lastError,
        hasInput: (def?.inputs.length || 0) > 0,
        hasOutput: (def?.outputs.length || 0) > 0,
      },
    };
  });
}

function toWorkflowInstances(rfNodes: Node<LegoNodeData>[]): WorkflowNodeInstance[] {
  return rfNodes.map((n) => ({
    id: n.id,
    typeId: n.data.typeId,
    label: n.data.label,
    position: n.position,
    params: n.data.params,
    status: n.data.status,
    outputPreview: n.data.outputPreview,
    lastError: n.data.lastError,
  }));
}

export function WorkflowEditorTab({
  activeProject,
  config,
  isSignedIn,
  onApplyProjectToStudio,
  onNotify,
}: WorkflowEditorTabProps) {
  const initialTpl = WORKFLOW_TEMPLATES[0];
  const [wfName, setWfName] = useState(initialTpl.name);
  const [wfId, setWfId] = useState<string | undefined>(undefined);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<LegoNodeData>>(
    toReactFlowNodes(initialTpl.nodes)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialTpl.edges.map((e) => ({ ...e, animated: true }))
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialTpl.nodes[0]?.id || null);
  const [undoStack, setUndoStack] = useState<Array<{ nodes: Node<LegoNodeData>[]; edges: Edge[] }>>([]);
  const [redoStack, setRedoStack] = useState<Array<{ nodes: Node<LegoNodeData>[]; edges: Edge[] }>>([]);
  const cacheMapRef = useRef<Record<string, { hash: string; preview: string; data: unknown }>>({});

  const [running, setRunning] = useState(false);
  const [statusLog, setStatusLog] = useState<string[]>([]);
  const [savedList, setSavedList] = useState<Array<{ id: string; name: string; nodes: unknown[]; edges: unknown[] }>>([]);

  const pushSnapshot = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-29), { nodes, edges }]);
    setRedoStack([]);
  }, [nodes, edges]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack((r) => [...r.slice(-29), { nodes, edges }]);
    setUndoStack((u) => u.slice(0, -1));
    setNodes(prev.nodes);
    setEdges(prev.edges);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((u) => [...u.slice(-29), { nodes, edges }]);
    setRedoStack((r) => r.slice(0, -1));
    setNodes(next.nodes);
    setEdges(next.edges);
  };

  const onConnect = useCallback(
    (conn: Connection) => {
      pushSnapshot();
      setEdges((eds) => addEdge({ ...conn, animated: true }, eds));
    },
    [pushSnapshot, setEdges]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );

  const handleAddNode = (typeId: string) => {
    const def = WORKFLOW_NODE_DEFINITIONS.find((d) => d.typeId === typeId);
    if (!def) return;
    pushSnapshot();
    const id = `node_${Date.now().toString(36)}`;
    const newNode: Node<LegoNodeData> = {
      id,
      type: 'legoNode',
      position: { x: 120 + (nodes.length % 4) * 230, y: 80 + Math.floor(nodes.length / 4) * 140 },
      data: {
        typeId: def.typeId,
        label: def.title,
        category: def.category,
        params: { ...def.defaultParams },
        status: 'idle',
        hasInput: def.inputs.length > 0,
        hasOutput: def.outputs.length > 0,
      },
    };
    setNodes((prev) => [...prev, newNode]);
    setSelectedNodeId(id);
  };

  const handleDuplicateSelected = () => {
    if (!selectedNode) return;
    pushSnapshot();
    const id = `node_${Date.now().toString(36)}`;
    const copy: Node<LegoNodeData> = {
      ...selectedNode,
      id,
      selected: false,
      position: { x: selectedNode.position.x + 40, y: selectedNode.position.y + 40 },
      data: { ...selectedNode.data, label: `${selectedNode.data.label} (Copy)`, status: 'idle' },
    };
    setNodes((prev) => [...prev, copy]);
    setSelectedNodeId(id);
  };

  const handleDeleteSelected = () => {
    if (!selectedNode) return;
    pushSnapshot();
    setNodes((prev) => prev.filter((n) => n.id !== selectedNode.id));
    setEdges((prev) => prev.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNodeId(null);
  };

  const handleAutoLayout = () => {
    pushSnapshot();
    const laidOut = autoLayoutWorkflowNodes(
      toWorkflowInstances(nodes),
      edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
    );
    setNodes(toReactFlowNodes(laidOut));
  };

  const handleExportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ name: wfName, nodes: toWorkflowInstances(nodes), edges }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wfName.replace(/\s+/g, '_')}.workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}')) as {
          name?: string;
          nodes?: WorkflowNodeInstance[];
          edges?: WorkflowEdgeInstance[];
        };
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          throw new Error('ไฟล์ Workflow JSON ไม่ถูกต้อง');
        }
        pushSnapshot();
        if (parsed.name) setWfName(parsed.name);
        setNodes(toReactFlowNodes(parsed.nodes));
        setEdges(parsed.edges.map((e) => ({ ...e, animated: true })));
      } catch (err) {
        onNotify?.(err instanceof Error ? err.message : String(err));
      }
    };
    reader.readAsText(file);
  };

  const executeSingleNode = async (
    n: WorkflowNodeInstance,
    upstreamPreviews: string[],
    workingProject: StudioProject
  ): Promise<{ preview: string; data: unknown; projectPatch?: Partial<StudioProject> }> => {
    const hash = hashNodeConfig(n, upstreamPreviews);
    const cached = cacheMapRef.current[n.id];
    if (cached && cached.hash === hash) {
      return { preview: `[Cached] ${cached.preview}`, data: cached.data };
    }

    if (n.typeId === 'input_topic') {
      const topic = String(n.params.topic || activeProject.title);
      const preview = `หัวข้อ: ${topic} (${n.params.durationSec || 30}s, ${n.params.aspect || '9:16'})`;
      const data = { topic, durationSec: n.params.durationSec, aspect: n.params.aspect };
      cacheMapRef.current[n.id] = { hash, preview, data };
      return {
        preview,
        data,
        projectPatch: {
          title: topic,
          layout: n.params.aspect === '16:9' ? 'landscape' : 'portrait_full',
        },
      };
    }

    if (n.typeId === 'input_reference') {
      const preview = `ข้อเท็จจริง: ${String(n.params.facts || '').slice(0, 60)}`;
      cacheMapRef.current[n.id] = { hash, preview, data: n.params };
      return { preview, data: n.params };
    }

    if (n.typeId === 'ai_script_brain') {
      const promptBrief = upstreamPreviews.join('\n') || String(activeProject.title);
      let summary = `โครงเรื่อง 6 ฉากสำหรับ "${promptBrief.slice(0, 40)}"`;
      // Try real backend AI if signed in or openrouter key available; fallback deterministically if offline/unconfigured
      if (isSignedIn) {
        try {
          const resp = await platformApi.generateAi({
            mode: n.params.billingMode === 'central' ? 'central' : 'byok',
            providerId: 'openrouter',
            modelId: String(n.params.modelId || 'nvidia/nemotron-3.5-super-vl:free'),
            systemPrompt: 'สรุปไอเดียบทการ์ตูนภาษาไทย 3 บรรทัดกระชับ',
            userPrompt: promptBrief,
            maxTokens: 320,
          });
          summary = resp.text.slice(0, 140);
        } catch {
          summary = `[Local Outline] ${summary}`;
        }
      } else if (config.openRouterKey.trim()) {
        summary = `พร้อมเขียนบทผ่าน OpenRouter (${String(n.params.modelId || config.modelScript)})`;
      }
      cacheMapRef.current[n.id] = { hash, preview: summary, data: { summary } };
      return { preview: summary, data: { summary } };
    }

    if (n.typeId === 'visual_animate_style') {
      const styleId = String(n.params.animateStyle || 'cut_paper') as AnimateStylePluginId;
      const preview = `Animate Style: ${styleId} • HUD: ${n.params.hudEnabled ? 'ON' : 'OFF'}`;
      cacheMapRef.current[n.id] = { hash, preview, data: { styleId } };
      return {
        preview,
        data: { styleId },
        projectPatch: {
          animateStyle: styleId,
          settings: {
            ...workingProject.settings,
            hudEnabled: Boolean(n.params.hudEnabled),
          },
        },
      };
    }

    if (n.typeId === 'visual_map_flyover') {
      const preview = `Map Preset: ${String(n.params.presetId || 'bangkok_ayutthaya')}`;
      cacheMapRef.current[n.id] = { hash, preview, data: n.params };
      return { preview, data: n.params };
    }

    if (n.typeId === 'video_render_qa') {
      const preview = `เตรียมส่งเข้า Studio (${String(n.params.resolution || '1080p')} @ ${n.params.fps || 30}fps)`;
      cacheMapRef.current[n.id] = { hash, preview, data: n.params };
      return { preview, data: n.params };
    }

    const generic = `ประมวลผล ${n.label} สำเร็จ`;
    cacheMapRef.current[n.id] = { hash, preview: generic, data: n.params };
    return { preview: generic, data: n.params };
  };

  const runWorkflow = async (mode: 'all' | 'selected' | 'resume_failed') => {
    const instances = toWorkflowInstances(nodes);
    const edgeInstances: WorkflowEdgeInstance[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));

    const topo = computeTopologicalLevels(instances, edgeInstances);
    if (!topo.ok) {
      setStatusLog([topo.error]);
      return;
    }

    setRunning(true);
    setStatusLog([`เริ่มประมวลผล Workflow (${topo.levels.length} ระดับ DAG, รองรับ Parallel Branches)...`]);

    let workingProj: StudioProject = { ...activeProject };
    if (workingProj.id === DEMO_PROJECT_A.id || workingProj.id === DEMO_PROJECT_B.id) {
      workingProj = {
        ...activeProject,
        id: `wf_proj_${Date.now()}`,
        updatedAt: Date.now(),
      };
    }

    const previewById: Record<string, string> = {};
    for (const n of instances) {
      if (n.outputPreview) previewById[n.id] = n.outputPreview;
    }

    try {
      for (let lvlIdx = 0; lvlIdx < topo.levels.length; lvlIdx++) {
        const levelNodes = topo.levels[lvlIdx].filter((n) => {
          if (mode === 'selected') return n.id === selectedNodeId;
          if (mode === 'resume_failed') return n.status === 'failed' || n.status === 'idle';
          return true;
        });
        if (levelNodes.length === 0) continue;

        setNodes((prev) =>
          prev.map((rf) =>
            levelNodes.some((ln) => ln.id === rf.id)
              ? { ...rf, data: { ...rf.data, status: 'running', lastError: undefined } }
              : rf
          )
        );

        await Promise.all(
          levelNodes.map(async (ln) => {
            const upstreamIds = edgeInstances.filter((e) => e.target === ln.id).map((e) => e.source);
            const upstreamPreviews = upstreamIds.map((uid) => previewById[uid] || '');
            try {
              const out = await executeSingleNode(ln, upstreamPreviews, workingProj);
              previewById[ln.id] = out.preview;
              if (out.projectPatch) {
                workingProj = { ...workingProj, ...out.projectPatch };
              }
              const isCached = out.preview.startsWith('[Cached]');
              setNodes((prev) =>
                prev.map((rf) =>
                  rf.id === ln.id
                    ? {
                        ...rf,
                        data: {
                          ...rf.data,
                          status: isCached ? 'cached' : 'completed',
                          outputPreview: out.preview,
                        },
                      }
                    : rf
                )
              );
              setStatusLog((l) => [...l, `✓ [${ln.label}] ${out.preview}`]);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              setNodes((prev) =>
                prev.map((rf) =>
                  rf.id === ln.id ? { ...rf, data: { ...rf.data, status: 'failed', lastError: msg } } : rf
                )
              );
              throw new Error(`Node "${ln.label}" failed: ${msg}`);
            }
          })
        );
      }

      onApplyProjectToStudio(workingProj);
      setStatusLog((l) => [...l, 'อัปเดตผลลัพธ์เข้าสู่ตัวเล่น Studio เรียบร้อยแล้ว']);
    } catch (err) {
      setStatusLog((l) => [...l, `✕ หยุดการทำงาน: ${err instanceof Error ? err.message : String(err)}`]);
    } finally {
      setRunning(false);
    }
  };

  const handleSaveToServer = async () => {
    if (!isSignedIn) {
      onNotify?.('กรุณาเข้าสู่ระบบเพื่อบันทึก Workflow ลงบัญชีของคุณ (หรือใช้ Export JSON ด้านบน)');
      return;
    }
    try {
      const res = await platformApi.saveWorkflow({
        id: wfId,
        name: wfName,
        nodes: toWorkflowInstances(nodes),
        edges,
      });
      setWfId(res.workflow.id);
      const list = await platformApi.listWorkflows();
      setSavedList(list.workflows);
      onNotify?.(`บันทึก Workflow "${wfName}" เรียบร้อย`);
    } catch (err) {
      onNotify?.(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div data-testid="workflow-editor-tab" className="space-y-3 px-3 py-4 pb-28">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-[#13141d] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={wfName}
            onChange={(e) => setWfName(e.target.value)}
            aria-label="ชื่อ Workflow"
            className="min-h-[40px] rounded-xl border border-white/15 bg-black/40 px-3 text-xs font-bold text-white"
          />
          <select
            aria-label="โหลดเทมเพลต Workflow"
            defaultValue=""
            onChange={(e) => {
              const tpl = WORKFLOW_TEMPLATES.find((t) => t.id === e.target.value);
              if (!tpl) return;
              pushSnapshot();
              setWfName(tpl.name);
              setNodes(toReactFlowNodes(tpl.nodes));
              setEdges(tpl.edges.map((ed) => ({ ...ed, animated: true })));
            }}
            className="min-h-[40px] rounded-xl border border-white/15 bg-black/40 px-2.5 text-xs text-white"
          >
            <option value="">โหลดเทมเพลตสำเร็จรูป...</option>
            {WORKFLOW_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white disabled:opacity-30 cursor-pointer"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white disabled:opacity-30 cursor-pointer"
            title="Redo"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleAutoLayout}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white hover:bg-white/10 cursor-pointer"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>จัดเรียงอัตโนมัติ</span>
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white hover:bg-white/10 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>JSON</span>
          </button>
          <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white hover:bg-white/10">
            <Upload className="h-3.5 w-3.5" />
            <span>Import</span>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => handleImportJson(e.target.files?.[0] || null)}
            />
          </label>
          <button
            type="button"
            onClick={() => void handleSaveToServer()}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-200 cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            <span>บันทึก</span>
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void runWorkflow('all')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-400 px-4 text-xs font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
          >
            <Play className="h-3.5 w-3.5" />
            <span>{running ? 'กำลังรัน...' : 'รันทั้ง Workflow'}</span>
          </button>
        </div>
      </div>

      {/* Main Split: Palette + ReactFlow Canvas + Node Inspector */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Node Palette */}
        <aside className="rounded-2xl border border-white/10 bg-[#13141d] p-3 lg:col-span-3 space-y-2.5 max-h-[470px] overflow-y-auto">
          <div className="text-xs font-extrabold text-white">คลัง LEGO Nodes (คลิกเพื่อเพิ่ม)</div>
          {(Object.keys(WORKFLOW_CATEGORY_LABELS) as Array<keyof typeof WORKFLOW_CATEGORY_LABELS>).map((cat) => (
            <div key={cat} className="space-y-1">
              <div
                className="text-[10px] font-extrabold uppercase tracking-wider"
                style={{ color: WORKFLOW_CATEGORY_LABELS[cat].color }}
              >
                {WORKFLOW_CATEGORY_LABELS[cat].label}
              </div>
              {WORKFLOW_NODE_DEFINITIONS.filter((d) => d.category === cat).map((def) => (
                <button
                  key={def.typeId}
                  type="button"
                  onClick={() => handleAddNode(def.typeId)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#1b1d29] px-2.5 py-2 text-left hover:border-amber-400/50 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-bold text-white">{def.title}</div>
                    <div className="truncate text-[10px] text-[#9894b8]">{def.subtitle}</div>
                  </div>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Visual Flow Canvas */}
        <div className="h-[470px] overflow-hidden rounded-2xl border border-white/15 bg-[#0c0d14] lg:col-span-6">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
            fitView
            minZoom={0.25}
            fitViewOptions={{ padding: 0.18, minZoom: 0.25 }}
            onInit={(inst) => {
              window.setTimeout(() => {
                void inst.fitView({ padding: 0.18 });
              }, 80);
            }}
            colorMode="dark"
          >
            <Background color="#25283d" gap={18} />
            <Controls />
            <MiniMap nodeColor="#f5c542" maskColor="rgba(10,11,16,0.78)" />
          </ReactFlow>
        </div>

        {/* Node Inspector & Execution Log */}
        <aside className="rounded-2xl border border-white/10 bg-[#13141d] p-3 lg:col-span-3 space-y-3 max-h-[470px] overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-white">ตั้งค่าโหนดที่เลือก</div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-white hover:bg-white/10 cursor-pointer"
                    title="ทำซ้ำโหนด"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/15 p-1.5 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                    title="ลบโหนด"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <input
                type="text"
                value={selectedNode.data.label}
                onChange={(e) =>
                  setNodes((prev) =>
                    prev.map((n) =>
                      n.id === selectedNode.id ? { ...n, data: { ...n.data, label: e.target.value } } : n
                    )
                  )
                }
                className="w-full rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs font-bold text-white"
              />

              {Object.entries(selectedNode.data.params).map(([k, val]) => (
                <div key={k} className="space-y-1">
                  <label className="text-[11px] font-semibold text-[#9894b8]">{k}</label>
                  {typeof val === 'boolean' ? (
                    <button
                      type="button"
                      onClick={() =>
                        setNodes((prev) =>
                          prev.map((n) =>
                            n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, params: { ...n.data.params, [k]: !val } } }
                              : n
                          )
                        )
                      }
                      className={`w-full min-h-[36px] rounded-xl text-xs font-bold cursor-pointer ${
                        val ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40' : 'bg-black/40 text-white/60 border border-white/10'
                      }`}
                    >
                      {val ? 'เปิดใช้งาน (true)' : 'ปิด (false)'}
                    </button>
                  ) : (
                    <input
                      type={typeof val === 'number' ? 'number' : 'text'}
                      value={String(val)}
                      onChange={(e) => {
                        const nextVal = typeof val === 'number' ? Number(e.target.value) : e.target.value;
                        setNodes((prev) =>
                          prev.map((n) =>
                            n.id === selectedNode.id
                              ? { ...n, data: { ...n.data, params: { ...n.data.params, [k]: nextVal } } }
                              : n
                          )
                        );
                      }}
                      className="w-full rounded-xl border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white"
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void runWorkflow('selected')}
                  className="flex-1 min-h-[38px] rounded-xl border border-amber-400/40 bg-amber-400/15 text-[11px] font-bold text-amber-200 cursor-pointer"
                >
                  รันเฉพาะโหนดนี้
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void runWorkflow('resume_failed')}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2.5 text-[11px] font-bold text-white cursor-pointer"
                  title="รันต่อจากจุดที่ค้าง/ผิดพลาด"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Resume</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#9894b8]">คลิกเลือกโหนดบนกระดานเพื่อปรับตั้งค่า</div>
          )}

          {statusLog.length > 0 && (
            <div className="border-t border-white/10 pt-2.5 space-y-1">
              <div className="text-[11px] font-bold text-white">ผลการรัน Workflow</div>
              <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl bg-black/40 p-2 text-[10px] font-mono-tabular text-[#c7c3e0]">
                {statusLog.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {savedList.length > 0 && (
            <div className="border-t border-white/10 pt-2 space-y-1">
              <div className="text-[11px] font-bold text-white">Workflow ที่บันทึกไว้</div>
              {savedList.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setWfId(w.id);
                    setWfName(w.name);
                    setNodes(toReactFlowNodes(w.nodes as WorkflowNodeInstance[]));
                    setEdges((w.edges as WorkflowEdgeInstance[]).map((e) => ({ ...e, animated: true })));
                  }}
                  className="block w-full truncate rounded-lg bg-black/30 px-2 py-1 text-left text-[11px] text-amber-200 hover:bg-black/50 cursor-pointer"
                >
                  {w.name}
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
