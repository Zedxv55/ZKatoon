import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreateView } from './components/CreateView';
import { ProjectsView } from './components/ProjectsView';
import { SettingsView } from './components/SettingsView';
import { StudioView } from './components/StudioView';
import { TopBar, type AppTab } from './components/TopBar';
import type {
  CartoonProject,
  PauseCandidate,
  SavedProjectRecord,
  StudioSelection,
  StudioSettings,
  VoiceName,
} from './types/cartoon';
import {
  generateScriptViaOpenRouter,
  getSavedCustomTtsKey,
  getSavedOpenRouterKey,
} from './utils/aiProviders';
import {
  buildAudioGraph,
  exportMixedMp3,
  type AudioGraphHandle,
} from './utils/audioEngine';
import { CANVAS_H, CANVAS_W, renderCartoonFrame } from './utils/canvasRenderer';
import { DEMO_PROJECT } from './utils/cartoonData';
import {
  buildTimeline,
  computeAudioEnvelope,
  normalizeProject,
  sanitizeFilename,
} from './utils/projectLogic';
import {
  deleteProjectFromDB,
  deleteProjectVideoFromDB,
  exportBackupJson,
  getProjectFromDB,
  getStorageSummary,
  listProjectsFromDB,
  loadStudioSettings,
  requestPersistentStorage,
  restoreBackupJson,
  saveProjectFilesToLocal,
  saveProjectToDB,
  saveStudioSettings,
  triggerDownload,
  type DirHandle,
  type StorageSummary,
} from './utils/storage';
import {
  exportCartoonVideo,
  runExportPreflight,
  type ExportPreflightStatus,
  type VideoExportResult,
} from './utils/videoExport';

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? 'studio' : 'create';
  });

  // Creation wizard state (defaults to PAPER-SKETCH style matching reference video)
  const [selection, setSelection] = useState<StudioSelection>({
    mode: 'story',
    genre: 'ดราม่าซึ้ง',
    len: 30,
    audience: 'general',
    style: 'paper',
    layout: 'full',
    topText: '',
    bottomText: '',
    subtitleStyle: 'sticker_dual',
    hudEnabled: true,
    cineEnabled: false,
    end: 'twist',
  });
  const [topic, setTopic] = useState('');
  const [facts, setFacts] = useState('');

  // Studio settings
  const [settings, setSettings] = useState<StudioSettings>(() => loadStudioSettings());
  const [aiHealth, setAiHealth] = useState<{
    ok: boolean;
    aiReady: boolean;
    models?: { script: string; tts: string };
  } | null>(null);

  // Active project & audio state
  const [project, setProject] = useState<CartoonProject | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1' ? DEMO_PROJECT : null;
  });
  const [projectId, setProjectId] = useState<string | null>(null);
  const [audioRaw, setAudioRaw] = useState<ArrayBuffer | null>(null);
  const [audioExt, setAudioExt] = useState('wav');
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [envelope, setEnvelope] = useState<number[]>([]);
  const [pauseCandidates, setPauseCandidates] = useState<PauseCandidate[]>([]);
  const [speechBounds, setSpeechBounds] = useState<{ ss: number; se?: number }>({ ss: 0 });
  const [audioNote, setAudioNote] = useState('');

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Generation & Export state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isExportingMp3, setIsExportingMp3] = useState(false);
  const [genProgressText, setGenProgressText] = useState('');
  const [genProgressPct, setGenProgressPct] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);

  const [preflight, setPreflight] = useState<ExportPreflightStatus | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressText, setExportProgressText] = useState('');
  const [exportProgressPct, setExportProgressPct] = useState(0);
  const [exportResult, setExportResult] = useState<VideoExportResult | null>(null);
  const [exportVideoUrl, setExportVideoUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Storage & Toast state
  const [savedProjects, setSavedProjects] = useState<SavedProjectRecord[]>([]);
  const [storageSummary, setStorageSummary] = useState<StorageSummary>({
    supported: true,
    usageMB: 0,
    quotaMB: 0,
    freeMB: 0,
    ratio: 0,
    persisted: false,
  });
  const [dirHandle, setDirHandle] = useState<DirHandle | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Refs for Web Audio & Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioGraphRef = useRef<AudioGraphHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartCtxTimeRef = useRef(0);
  const exportAbortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3600);
  }, []);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
    }
    return audioCtxRef.current;
  }, []);

  const timelineResult = useMemo(() => {
    if (!project) {
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
          mode: 'estimated' as const,
        },
      };
    }
    return buildTimeline(project.scenes, {
      audioDurationSec: audioBuffer?.duration,
      speechStartSec: speechBounds.ss,
      speechEndSec: speechBounds.se,
      sceneDurations: project.sceneDurations,
      pauseCandidates,
      globalOffset: project.globalOffset,
    });
  }, [project, audioBuffer, speechBounds, pauseCandidates]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      audioGraphRef.current?.stop();
    } catch {
      // ignore
    }
    audioGraphRef.current = null;
  }, []);

  const drawAt = useCallback(
    (t: number) => {
      const canvas = canvasRef.current;
      if (!canvas || !project || !timelineResult.timeline.length) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      renderCartoonFrame(ctx, project, timelineResult.timeline, t, {
        envelope,
        leadSec: timelineResult.leadSec,
        speechStartSec: speechBounds.ss,
        scale: 1,
        subtitleScale: settings.subtitleScale,
        pauseCandidates,
        cineEnabled: project.cineLayer?.enabled,
      });
    },
    [project, timelineResult, envelope, speechBounds.ss, settings.subtitleScale, pauseCandidates]
  );

  // Clamp currentTime if timeline duration shrinks (e.g. deleting scenes or setting shorter manual duration)
  useEffect(() => {
    if (!isPlaying && timelineResult.totalDuration > 0 && currentTime > timelineResult.totalDuration) {
      setCurrentTime(Math.max(0, Number((timelineResult.totalDuration - 0.05).toFixed(2))));
    }
  }, [isPlaying, currentTime, timelineResult.totalDuration]);

  // Redraw canvas whenever frame time or project changes while paused
  useEffect(() => {
    if (!isPlaying && activeTab === 'studio') {
      drawAt(currentTime);
    }
  }, [activeTab, currentTime, isPlaying, drawAt]);

  const startPlayback = useCallback(
    (fromSec: number) => {
      if (!project || !timelineResult.timeline.length) return;
      stopPlayback();
      const ctx = getAudioCtx();
      ctx.resume().catch(() => {});

      const gain = ctx.createGain();
      gain.gain.value = isMuted ? 0 : 1;
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;

      const baseCtxTime = ctx.currentTime;
      audioGraphRef.current = buildAudioGraph(ctx, gain, fromSec, {
        project,
        timeline: timelineResult.timeline,
        totalDuration: timelineResult.totalDuration,
        voiceBuffer: audioBuffer,
        speechStartSec: speechBounds.ss,
        leadSec: timelineResult.leadSec,
        envelope,
        pauseCandidates,
        enableBgmAndSfx: settings.enableBgmAndSfx,
        baseCtxTime,
      });

      playStartCtxTimeRef.current = baseCtxTime - fromSec;
      setIsPlaying(true);

      const tick = () => {
        const elapsed = ctx.currentTime - playStartCtxTimeRef.current;
        if (elapsed >= timelineResult.totalDuration) {
          setCurrentTime(timelineResult.totalDuration);
          stopPlayback();
          drawAt(timelineResult.totalDuration);
          return;
        }
        audioGraphRef.current?.schedulerTick(elapsed);
        setCurrentTime(elapsed);
        drawAt(elapsed);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [
      project,
      timelineResult.timeline,
      timelineResult.totalDuration,
      timelineResult.leadSec,
      stopPlayback,
      getAudioCtx,
      isMuted,
      audioBuffer,
      speechBounds.ss,
      envelope,
      pauseCandidates,
      settings.enableBgmAndSfx,
      drawAt,
    ]
  );

  const togglePlay = useCallback(() => {
    if (!project) return;
    if (isPlaying) {
      stopPlayback();
    } else {
      const startAt = currentTime >= timelineResult.totalDuration - 0.05 ? 0 : currentTime;
      startPlayback(startAt);
    }
  }, [project, isPlaying, stopPlayback, currentTime, timelineResult.totalDuration, startPlayback]);

  const handleSeek = useCallback(
    (time: number) => {
      setCurrentTime(time);
      if (isPlaying) {
        startPlayback(time);
      } else {
        drawAt(time);
      }
    },
    [isPlaying, startPlayback, drawAt]
  );

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = next ? 0 : 1;
      }
      return next;
    });
  }, []);

  const refreshProjectsAndStorage = useCallback(async () => {
    const [list, sum] = await Promise.all([listProjectsFromDB(), getStorageSummary()]);
    setSavedProjects(list);
    setStorageSummary(sum);
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setAiHealth(data);
    } catch {
      setAiHealth({ ok: false, aiReady: false });
    }
  }, []);

  useEffect(() => {
    refreshProjectsAndStorage();
    checkHealth();
  }, [refreshProjectsAndStorage, checkHealth]);

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const decodeAudioBytes = useCallback(
    async (raw: ArrayBuffer, useExactDurations = false) => {
      const ctx = getAudioCtx();
      const decoded = await ctx.decodeAudioData(raw.slice(0));
      const env = computeAudioEnvelope(decoded.getChannelData(0), decoded.sampleRate);
      setAudioBuffer(decoded);
      setEnvelope(env.envelope);
      setPauseCandidates(env.pauseCandidates);
      setSpeechBounds(
        useExactDurations
          ? { ss: 0, se: decoded.duration }
          : { ss: env.speechStartSec, se: env.speechEndSec }
      );
      return decoded;
    },
    [getAudioCtx]
  );

  const persistProject = useCallback(
    async (
      proj: CartoonProject,
      rawAudio: ArrayBuffer | null,
      ext: string,
      videoBlob: Blob | null,
      existingId: string | null,
      silent = false
    ) => {
      const id = existingId || crypto.randomUUID();
      let thumb: string | null = null;
      try {
        const tmp = document.createElement('canvas');
        tmp.width = 90;
        tmp.height = 160;
        const off = document.createElement('canvas');
        off.width = CANVAS_W;
        off.height = CANVAS_H;
        const offCtx = off.getContext('2d');
        if (offCtx) {
          const tl = buildTimeline(proj.scenes, { sceneDurations: proj.sceneDurations });
          renderCartoonFrame(offCtx, proj, tl.timeline, 0.8, {
            envelope: [],
            subtitleScale: settings.subtitleScale,
          });
          tmp.getContext('2d')?.drawImage(off, 0, 0, 90, 160);
          thumb = tmp.toDataURL('image/jpeg', 0.65);
        }
      } catch {
        thumb = null;
      }

      await saveProjectToDB({
        id,
        title: proj.title || 'ไม่มีชื่อเรื่อง',
        data: proj,
        audio: rawAudio,
        ext,
        video: videoBlob,
        thumb,
        at: Date.now(),
      });
      setProjectId(id);
      await refreshProjectsAndStorage();
      if (!silent) notify('บันทึกโปรเจกต์ลงฐานข้อมูลในเครื่องแล้ว');
      return id;
    },
    [settings.subtitleScale, refreshProjectsAndStorage, notify]
  );

  const synthesizeVoicesForProject = useCallback(
    async (proj: CartoonProject): Promise<{
      raw: ArrayBuffer;
      ext: string;
      sceneDurations?: number[];
    }> => {
      const scenes = proj.scenes.map((s) => s.narration);

      if (settings.ttsProvider === 'pythai') {
        const resp = await fetch('/api/tts-pythai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenes,
            endpoint: settings.pythaiEndpoint,
            model: settings.pythaiModel,
            speaker: settings.pythaiSpeaker,
          }),
        });
        const data = (await resp.json()) as {
          audioBase64?: string;
          sceneDurations?: number[];
          error?: string;
        };
        if (!resp.ok || !data.audioBase64) {
          throw new Error(data.error || `PyThaiTTS HTTP ${resp.status}`);
        }
        return {
          raw: base64ToArrayBuffer(data.audioBase64),
          ext: 'wav',
          sceneDurations: data.sceneDurations,
        };
      }

      if (settings.ttsProvider === 'openai_compatible') {
        const apiKey = getSavedCustomTtsKey();
        const resp = await fetch('/api/tts-custom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: settings.customTtsEndpoint,
            apiKey,
            model: settings.customTtsModel,
            voice: settings.customTtsVoice,
            scenes,
          }),
        });
        const data = (await resp.json()) as { audioBase64?: string; error?: string };
        if (!resp.ok || !data.audioBase64) {
          throw new Error(data.error || `Custom TTS HTTP ${resp.status}`);
        }
        return {
          raw: base64ToArrayBuffer(data.audioBase64),
          ext: 'mp3',
        };
      }

      // Default: Built-in Gemini TTS
      const resp = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes,
          voiceName: settings.voiceName,
          stylePrompt: settings.voiceStyle,
        }),
      });
      const data = (await resp.json()) as {
        audioBase64?: string;
        sceneDurations?: number[];
        error?: string;
      };
      if (!resp.ok || !data.audioBase64) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }
      return {
        raw: base64ToArrayBuffer(data.audioBase64),
        ext: 'wav',
        sceneDurations: data.sceneDurations,
      };
    },
    [settings]
  );

  async function handleGenerateCartoon() {
    if (!topic.trim()) {
      setGenError('กรุณากรอกหัวข้อเรื่องก่อนกดสร้างการ์ตูน');
      return;
    }

    stopPlayback();
    setGenError(null);
    setIsGenerating(true);
    setGenProgressText(
      settings.aiProvider === 'openrouter'
        ? `กำลังเขียนบทผ่าน OpenRouter (${settings.openRouterModel})…`
        : 'AI กำลังเขียนบท ออกแบบตัวละคร และวางฉาก…'
    );
    setGenProgressPct(22);

    try {
      let generatedProj: CartoonProject;

      if (settings.aiProvider === 'openrouter') {
        const key = getSavedOpenRouterKey();
        if (!key) {
          throw new Error('กรุณาเพิ่ม OpenRouter API Key ในหน้า "ตั้งค่า" ก่อนใช้งาน');
        }
        generatedProj = await generateScriptViaOpenRouter({
          apiKey: key,
          model: settings.openRouterModel,
          selection,
          topic: topic.trim(),
          facts: facts.trim(),
        });
      } else {
        const scriptResp = await fetch('/api/generate-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: selection.mode,
            genre: selection.genre,
            audience: selection.audience,
            lengthSec: selection.len,
            style: selection.style,
            layout: selection.layout,
            topText: selection.topText,
            bottomText: selection.bottomText,
            subtitleStyle: selection.subtitleStyle,
            hudEnabled: selection.hudEnabled,
            cineEnabled: selection.cineEnabled,
            end: selection.end,
            topic: topic.trim(),
            facts: facts.trim(),
          }),
        });

        const scriptData = (await scriptResp.json()) as {
          project?: CartoonProject;
          error?: string;
        };
        if (!scriptResp.ok || !scriptData.project) {
          throw new Error(scriptData.error || 'สร้างบทการ์ตูนไม่สำเร็จ');
        }

        generatedProj = normalizeProject(scriptData.project, {
          style: selection.style,
          end: selection.end,
          layout: selection.layout,
          topText: selection.topText,
          bottomText: selection.bottomText,
          subtitleStyle: selection.subtitleStyle,
          hudEnabled: selection.hudEnabled,
          cineEnabled: selection.cineEnabled,
        });
      }

      setGenProgressText('กำลังสังเคราะห์เสียงพากย์ภาษาไทย…');
      setGenProgressPct(62);

      let nextAudioRaw: ArrayBuffer | null = null;
      let nextExt = 'wav';
      let nextNote = 'สร้างบทและเสียงพากย์เสร็จสมบูรณ์';

      try {
        const ttsOut = await synthesizeVoicesForProject(generatedProj);
        nextAudioRaw = ttsOut.raw;
        nextExt = ttsOut.ext;
        if (ttsOut.sceneDurations && ttsOut.sceneDurations.length === generatedProj.scenes.length) {
          generatedProj = { ...generatedProj, sceneDurations: ttsOut.sceneDurations };
        }
        await decodeAudioBytes(nextAudioRaw, Boolean(ttsOut.sceneDurations));
      } catch (ttsErr) {
        const msg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
        nextNote = `ยังไม่มีเสียงพากย์ (${msg}) — สามารถสลับไปใช้ PyThaiTTS / Gemini TTS หรือนำเข้าเสียงเองได้`;
        setAudioBuffer(null);
        setEnvelope([]);
        setPauseCandidates([]);
      }

      setAudioRaw(nextAudioRaw);
      setAudioExt(nextExt);
      setAudioNote(nextNote);
      setExportResult(null);
      if (exportVideoUrl) {
        URL.revokeObjectURL(exportVideoUrl);
        setExportVideoUrl(null);
      }
      setProject(generatedProj);
      setCurrentTime(0);

      setGenProgressText('กำลังจัดเก็บโปรเจกต์…');
      setGenProgressPct(92);
      await persistProject(generatedProj, nextAudioRaw, nextExt, null, null, true);

      setGenProgressText('พร้อมรับชมในสตูดิโอแล้ว');
      setGenProgressPct(100);
      setActiveTab('studio');
      notify('สร้างการ์ตูนเรียบร้อยแล้ว');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenError(msg);
      setGenProgressText('');
      setGenProgressPct(0);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleImportOutputG(imported: CartoonProject) {
    stopPlayback();
    setProject(imported);
    setProjectId(null);
    setAudioRaw(null);
    setAudioBuffer(null);
    setEnvelope([]);
    setPauseCandidates([]);
    setSpeechBounds({ ss: 0 });
    setAudioNote('นำเข้าแพ็กเกจ OUTPUT G เรียบร้อย กด "พากย์เสียง AI" หรือ "นำเข้าเสียงพากย์" เพื่อซิงก์');
    setExportResult(null);
    if (exportVideoUrl) {
      URL.revokeObjectURL(exportVideoUrl);
      setExportVideoUrl(null);
    }
    setCurrentTime(0);
    setActiveTab('studio');
    notify(`นำเข้า "${imported.title}" สำเร็จ`);
  }

  async function handleRegenerateAudio() {
    if (!project) return;
    stopPlayback();
    setIsGeneratingAudio(true);
    setAudioNote('กำลังสังเคราะห์เสียงพากย์ใหม่จากบทปัจจุบัน…');
    try {
      const ttsOut = await synthesizeVoicesForProject(project);
      const nextProj =
        ttsOut.sceneDurations && ttsOut.sceneDurations.length === project.scenes.length
          ? { ...project, sceneDurations: ttsOut.sceneDurations }
          : project;
      setProject(nextProj);
      setAudioRaw(ttsOut.raw);
      setAudioExt(ttsOut.ext);
      await decodeAudioBytes(ttsOut.raw, Boolean(ttsOut.sceneDurations));
      setAudioNote('สร้างเสียงพากย์ใหม่เสร็จสมบูรณ์และซิงก์เข้ากับทุกฉากแล้ว');
      notify('อัปเดตเสียงพากย์เรียบร้อย');
      await persistProject(nextProj, ttsOut.raw, ttsOut.ext, exportResult?.blob ?? null, projectId, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setAudioNote(`สังเคราะห์เสียงไม่สำเร็จ: ${msg}`);
      notify(msg);
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  async function handleImportAudio(file: File) {
    if (!project) return;
    stopPlayback();
    try {
      const raw = await file.arrayBuffer();
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
      await decodeAudioBytes(raw, false);
      const nextProj = { ...project, sceneDurations: undefined };
      setProject(nextProj);
      setAudioRaw(raw);
      setAudioExt(ext);
      setAudioNote(`นำเข้าไฟล์เสียง ${file.name} และวิเคราะห์ช่วงเงียบเพื่อซิงก์แล้ว`);
      notify('นำเข้าและซิงก์เสียงสำเร็จ');
      await persistProject(nextProj, raw, ext, exportResult?.blob ?? null, projectId, true);
    } catch {
      notify('ไฟล์เสียงนี้เบราว์เซอร์อ่านไม่ได้ ลองแปลงเป็น MP3 หรือ WAV');
    }
  }

  function handleOpenDemo() {
    stopPlayback();
    setProject(DEMO_PROJECT);
    setProjectId(null);
    setAudioRaw(null);
    setAudioBuffer(null);
    setEnvelope([]);
    setPauseCandidates([]);
    setSpeechBounds({ ss: 0 });
    setAudioNote('ตัวอย่างสไตล์ PAPER-SKETCH ("สวัสดีวันจันทร์ · บ้านเรา 7 คน") — กดพากย์เสียง AI หรือปรับเวลาได้ทันที');
    setExportResult(null);
    if (exportVideoUrl) {
      URL.revokeObjectURL(exportVideoUrl);
      setExportVideoUrl(null);
    }
    setCurrentTime(0);
    setActiveTab('studio');
  }

  async function handleOpenSavedProject(id: string) {
    const rec = await getProjectFromDB(id);
    if (!rec) return;
    stopPlayback();
    setProject(rec.data);
    setProjectId(rec.id);
    setAudioRaw(rec.audio);
    setAudioExt(rec.ext || 'wav');

    if (rec.audio) {
      try {
        await decodeAudioBytes(rec.audio, Boolean(rec.data.sceneDurations?.length));
        setAudioNote('โหลดเสียงพากย์ที่บันทึกไว้แล้ว');
      } catch {
        setAudioBuffer(null);
        setEnvelope([]);
        setPauseCandidates([]);
        setAudioNote('ไฟล์เสียงที่บันทึกไว้ไม่สามารถอ่านได้');
      }
    } else {
      setAudioBuffer(null);
      setEnvelope([]);
      setPauseCandidates([]);
      setAudioNote('โปรเจกต์นี้ยังไม่มีเสียงพากย์ สามารถกดพากย์เสียง AI หรือนำเข้าเสียงเองได้');
    }

    if (exportVideoUrl) URL.revokeObjectURL(exportVideoUrl);
    if (rec.video) {
      const url = URL.createObjectURL(rec.video);
      setExportVideoUrl(url);
      setExportResult({
        blob: rec.video,
        mimeType: 'video/mp4',
        ext: 'mp4',
        durationSec: null,
        hasAudioTrack: Boolean(rec.audio),
        audioVerifiedStatus: rec.audio ? 'detected' : 'unverifiable',
        usedScale: 1,
        usedWidth: 720,
        usedHeight: 1280,
        usedCodec: 'avc1.42001f',
        usedAudioCodec: 'aac',
        downscaleWarning: null,
      });
    } else {
      setExportVideoUrl(null);
      setExportResult(null);
    }

    setCurrentTime(0);
    setActiveTab('studio');
  }

  const handleRunPreflight = useCallback(async () => {
    const ctx = audioCtxRef.current;
    const res = await runExportPreflight({
      hasVoiceover: Boolean(audioBuffer),
      audioCtxState: ctx?.state,
      want1080: settings.defaultRes === '1080',
    });
    setPreflight(res);
  }, [audioBuffer, settings.defaultRes]);

  async function handleExportVideo() {
    if (!project) return;
    stopPlayback();
    setExportError(null);
    setIsExporting(true);
    setExportProgressText('เตรียมตัวเข้ารหัส MP4…');
    setExportProgressPct(2);

    const ac = new AbortController();
    exportAbortRef.current = ac;

    try {
      const ctx = getAudioCtx();
      await ctx.resume().catch(() => {});

      const res = await exportCartoonVideo({
        project,
        timeline: timelineResult.timeline,
        totalDuration: timelineResult.totalDuration,
        envelope,
        leadSec: timelineResult.leadSec,
        speechStartSec: speechBounds.ss,
        pauseCandidates,
        voiceBuffer: audioBuffer,
        enableBgmAndSfx: settings.enableBgmAndSfx,
        cineEnabled: Boolean(project.cineLayer?.enabled),
        want1080: settings.defaultRes === '1080',
        subtitleScale: settings.subtitleScale,
        signal: ac.signal,
        onProgress: (msg, pct) => {
          setExportProgressText(msg);
          setExportProgressPct(pct);
        },
      });

      if (exportVideoUrl) URL.revokeObjectURL(exportVideoUrl);
      const url = URL.createObjectURL(res.blob);
      setExportResult(res);
      setExportVideoUrl(url);
      // Try auto-download once (not relied upon exclusively — player + 4 buttons always remain visible)
      triggerDownload(res.blob, `${sanitizeFilename(project.title)}.mp4`);
      await persistProject(project, audioRaw, audioExt, res.blob, projectId, true);
      notify('สร้างและตรวจสอบไฟล์ MP4 เสร็จสมบูรณ์');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportError(msg);
      setExportProgressText('');
      setExportProgressPct(0);
    } finally {
      setIsExporting(false);
      exportAbortRef.current = null;
    }
  }

  async function handleDownloadMp3() {
    if (!project) return;
    setIsExportingMp3(true);
    try {
      const mp3Blob = await exportMixedMp3({
        project,
        timeline: timelineResult.timeline,
        totalDuration: timelineResult.totalDuration,
        voiceBuffer: audioBuffer,
        speechStartSec: speechBounds.ss,
        leadSec: timelineResult.leadSec,
        envelope,
        pauseCandidates,
        enableBgmAndSfx: settings.enableBgmAndSfx,
      });
      triggerDownload(mp3Blob, `${sanitizeFilename(project.title)}.mp3`);
      notify('ดาวน์โหลดไฟล์เสียงรวม (.mp3) แล้ว');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'ส่งออก MP3 ไม่สำเร็จ');
    } finally {
      setIsExportingMp3(false);
    }
  }

  async function handleShareVideo() {
    if (!exportResult || !project) return;
    const filename = `${sanitizeFilename(project.title)}.mp4`;
    const file = new File([exportResult.blob], filename, { type: 'video/mp4' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: project.title });
      } catch {
        // cancelled
      }
    } else {
      notify('เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์โดยตรง กรุณาใช้ปุ่มดาวน์โหลด MP4');
    }
  }

  async function handlePickDirectory() {
    const picker = (
      window as unknown as { showDirectoryPicker?: (o: { mode: string }) => Promise<DirHandle> }
    ).showDirectoryPicker;
    if (!picker) {
      notify('เบราว์เซอร์นี้ไม่รองรับการเลือกโฟลเดอร์ ใช้การดาวน์โหลดไฟล์แทน');
      return;
    }
    try {
      const handle = await picker({ mode: 'readwrite' });
      setDirHandle(handle);
      notify(`เลือกโฟลเดอร์ ${handle.name} แล้ว`);
    } catch {
      // cancelled
    }
  }

  async function handleSaveLocal() {
    if (!project) return;
    try {
      const mode = await saveProjectFilesToLocal(
        project,
        audioRaw,
        audioExt,
        exportResult?.blob ?? null,
        dirHandle
      );
      notify(mode === 'folder' ? 'บันทึกไฟล์ลงโฟลเดอร์เรียบร้อย' : 'เริ่มดาวน์โหลดไฟล์โปรเจกต์แล้ว');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      notify(msg);
    }
  }

  function handleUpdateSettings(next: StudioSettings) {
    setSettings(next);
    saveStudioSettings(next);
  }

  return (
    <div className="min-h-screen bg-[#0a0b10] text-[#f3f2fa] pb-20 md:pb-8">
      <TopBar
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab !== 'studio') stopPlayback();
          setActiveTab(tab);
          if (tab === 'projects') refreshProjectsAndStorage();
        }}
        hasProject={Boolean(project)}
        onOpenDemo={handleOpenDemo}
      />

      <main>
        {activeTab === 'create' && (
          <CreateView
            selection={selection}
            onChangeSelection={setSelection}
            topic={topic}
            onChangeTopic={setTopic}
            facts={facts}
            onChangeFacts={setFacts}
            voiceName={settings.voiceName}
            onChangeVoice={(voice: VoiceName) =>
              handleUpdateSettings({ ...settings, voiceName: voice })
            }
            aiProvider={settings.aiProvider}
            openRouterModel={settings.openRouterModel}
            ttsProvider={settings.ttsProvider}
            isGenerating={isGenerating}
            progressText={genProgressText}
            progressPct={genProgressPct}
            errorText={genError}
            onGenerate={handleGenerateCartoon}
            onImportOutputG={handleImportOutputG}
            onLoadDemo={handleOpenDemo}
            onGoSettings={() => setActiveTab('settings')}
            savedProjects={savedProjects}
            onOpenProject={handleOpenSavedProject}
          />
        )}

        {activeTab === 'studio' && (
          <StudioView
            canvasRef={canvasRef}
            project={project}
            timeline={timelineResult.timeline}
            syncDiagnostics={timelineResult.syncDiagnostics}
            currentTime={currentTime}
            totalDuration={timelineResult.totalDuration}
            isPlaying={isPlaying}
            isMuted={isMuted}
            hasAudio={Boolean(audioRaw)}
            audioExt={audioExt}
            audioNote={audioNote}
            isGeneratingAudio={isGeneratingAudio}
            isExportingMp3={isExportingMp3}
            exportResolution={settings.defaultRes}
            subtitleScale={settings.subtitleScale}
            preflight={preflight}
            isExporting={isExporting}
            exportProgressText={exportProgressText}
            exportProgressPct={exportProgressPct}
            exportResult={exportResult}
            exportVideoUrl={exportVideoUrl}
            exportError={exportError}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onToggleMute={handleToggleMute}
            onImportAudio={handleImportAudio}
            onRegenerateAudio={handleRegenerateAudio}
            onDownloadMp3={handleDownloadMp3}
            onSaveProject={() =>
              project &&
              persistProject(project, audioRaw, audioExt, exportResult?.blob ?? null, projectId)
            }
            onSaveLocal={handleSaveLocal}
            onUpdateProject={(next) => setProject(next)}
            onChangeExportRes={(res) => handleUpdateSettings({ ...settings, defaultRes: res })}
            onChangeSubtitleScale={(scale) =>
              handleUpdateSettings({ ...settings, subtitleScale: scale })
            }
            onRunPreflight={handleRunPreflight}
            onExportVideo={handleExportVideo}
            onCancelExport={() => exportAbortRef.current?.abort()}
            onShareVideo={handleShareVideo}
            onGoCreate={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            projects={savedProjects}
            storage={storageSummary}
            dirName={dirHandle?.name ?? null}
            onOpenProject={handleOpenSavedProject}
            onDeleteProject={async (id) => {
              await deleteProjectFromDB(id);
              if (projectId === id) setProjectId(null);
              await refreshProjectsAndStorage();
              notify('ลบโปรเจกต์แล้ว');
            }}
            onDeleteVideo={async (id) => {
              await deleteProjectVideoFromDB(id);
              if (projectId === id) {
                setExportResult(null);
                if (exportVideoUrl) URL.revokeObjectURL(exportVideoUrl);
                setExportVideoUrl(null);
              }
              await refreshProjectsAndStorage();
              notify('ล้างแคชวิดีโอแล้ว');
            }}
            onRequestPersist={async () => {
              const ok = await requestPersistentStorage();
              await refreshProjectsAndStorage();
              notify(ok ? 'เปิดสิทธิ์พื้นที่เก็บข้อมูลถาวรแล้ว' : 'เบราว์เซอร์ไม่อนุญาตหรือยังไม่รองรับ');
            }}
            onPickDirectory={handlePickDirectory}
            onBackupJson={async () => {
              const count = await exportBackupJson();
              notify(`ส่งออก Backup ${count} โปรเจกต์แล้ว (ไม่รวมไฟล์วิดีโอ)`);
            }}
            onRestoreJson={async (file) => {
              try {
                const count = await restoreBackupJson(file);
                await refreshProjectsAndStorage();
                notify(`กู้คืน ${count} โปรเจกต์เรียบร้อย`);
              } catch (err) {
                notify(err instanceof Error ? err.message : 'ไฟล์ Backup ไม่ถูกต้อง');
              }
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            aiHealth={aiHealth}
            onCheckHealth={checkHealth}
            onNotify={notify}
          />
        )}
      </main>

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/15 bg-[#1b1d29]/95 px-4 py-2.5 text-sm font-medium text-white shadow-2xl backdrop-blur-md"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
