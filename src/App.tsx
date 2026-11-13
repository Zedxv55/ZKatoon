import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CreateView } from './components/CreateView';
import { ProjectsView } from './components/ProjectsView';
import { SettingsView } from './components/SettingsView';
import { StudioView } from './components/StudioView';
import { TopBar, type AppTab } from './components/TopBar';
import type {
  CartoonProject,
  SavedProjectRecord,
  StudioSelection,
  StudioSettings,
  VoiceName,
} from './types/cartoon';
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
import { exportCartoonVideo, type VideoExportResult } from './utils/videoExport';

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

  // Creation wizard state
  const [selection, setSelection] = useState<StudioSelection>({
    mode: 'story',
    genre: 'ตลก',
    len: 30,
    style: 'night',
    end: 'summary',
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
  const [mixBuffer, setMixBuffer] = useState<AudioBuffer | null>(null);
  const [envelope, setEnvelope] = useState<number[]>([]);
  const [speechBounds, setSpeechBounds] = useState<{ ss: number; se?: number }>({ ss: 0 });
  const [audioNote, setAudioNote] = useState('');

  // Playback state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Generation & Export state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [genProgressText, setGenProgressText] = useState('');
  const [genProgressPct, setGenProgressPct] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);

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
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartCtxTimeRef = useRef(0);
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
      };
    }
    return buildTimeline(project.scenes, {
      audioDurationSec: audioBuffer?.duration,
      speechStartSec: speechBounds.ss,
      speechEndSec: speechBounds.se,
      sceneDurations: project.sceneDurations,
    });
  }, [project, audioBuffer, speechBounds]);

  // Rebuild mixBuffer whenever audioBuffer or timeline totalDuration changes
  useEffect(() => {
    if (!audioBuffer) {
      setMixBuffer(null);
      return;
    }
    const ctx = getAudioCtx();
    const sr = audioBuffer.sampleRate;
    const totalSamples = Math.max(1, Math.ceil(timelineResult.totalDuration * sr));
    const mix = ctx.createBuffer(2, totalSamples, sr);
    const offset = Math.floor(timelineResult.leadSec * sr);
    const from = Math.floor(speechBounds.ss * sr);
    const len = Math.min(audioBuffer.length - from, mix.length - offset);
    if (len > 0) {
      for (let ch = 0; ch < 2; ch++) {
        const srcCh = audioBuffer.getChannelData(Math.min(ch, audioBuffer.numberOfChannels - 1));
        mix.copyToChannel(srcCh.subarray(from, from + len), ch, offset);
      }
    }
    setMixBuffer(mix);
  }, [audioBuffer, timelineResult.totalDuration, timelineResult.leadSec, speechBounds.ss, getAudioCtx]);

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      sourceNodeRef.current?.stop();
    } catch {
      // ignore
    }
    sourceNodeRef.current = null;
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
      });
    },
    [project, timelineResult, envelope, speechBounds.ss, settings.subtitleScale]
  );

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

      if (mixBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = mixBuffer;
        src.connect(gain);
        src.start(0, Math.max(0, fromSec));
        sourceNodeRef.current = src;
      }

      playStartCtxTimeRef.current = ctx.currentTime - fromSec;
      setIsPlaying(true);

      const tick = () => {
        const elapsed = ctx.currentTime - playStartCtxTimeRef.current;
        if (elapsed >= timelineResult.totalDuration) {
          setCurrentTime(timelineResult.totalDuration);
          stopPlayback();
          drawAt(timelineResult.totalDuration);
          return;
        }
        setCurrentTime(elapsed);
        drawAt(elapsed);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [project, timelineResult.timeline.length, timelineResult.totalDuration, stopPlayback, getAudioCtx, isMuted, mixBuffer, drawAt]
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
      sceneDurations?: number[];
    }> => {
      const resp = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: proj.scenes.map((s) => s.narration),
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
        sceneDurations: data.sceneDurations,
      };
    },
    [settings.voiceName, settings.voiceStyle]
  );

  async function handleGenerateCartoon() {
    if (!topic.trim()) {
      setGenError('กรุณากรอกหัวข้อเรื่องก่อนกดสร้างการ์ตูน');
      return;
    }

    stopPlayback();
    setGenError(null);
    setIsGenerating(true);
    setGenProgressText('AI กำลังเขียนบท ออกแบบตัวละคร และวางฉาก…');
    setGenProgressPct(20);

    try {
      const scriptResp = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: selection.mode,
          genre: selection.genre,
          lengthSec: selection.len,
          style: selection.style,
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

      let generatedProj = normalizeProject(scriptData.project, {
        style: selection.style,
        end: selection.end,
      });

      setGenProgressText('กำลังสร้างเสียงพากย์ภาษาไทยทีละฉาก…');
      setGenProgressPct(60);

      let nextAudioRaw: ArrayBuffer | null = null;
      let nextNote = 'สร้างบทและเสียงพากย์เสร็จสมบูรณ์';

      try {
        const ttsOut = await synthesizeVoicesForProject(generatedProj);
        nextAudioRaw = ttsOut.raw;
        if (ttsOut.sceneDurations && ttsOut.sceneDurations.length === generatedProj.scenes.length) {
          generatedProj = { ...generatedProj, sceneDurations: ttsOut.sceneDurations };
        }
        await decodeAudioBytes(nextAudioRaw, true);
      } catch (ttsErr) {
        const msg = ttsErr instanceof Error ? ttsErr.message : String(ttsErr);
        nextNote = `ยังไม่มีเสียงพากย์ (${msg}) — สามารถกดพากย์เสียงใหม่หรือนำเข้าไฟล์เสียงเองได้`;
        setAudioBuffer(null);
        setEnvelope([]);
      }

      setAudioRaw(nextAudioRaw);
      setAudioExt('wav');
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
      await persistProject(generatedProj, nextAudioRaw, 'wav', null, null, true);

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
      setAudioExt('wav');
      await decodeAudioBytes(ttsOut.raw, true);
      setAudioNote('สร้างเสียงพากย์ใหม่เสร็จสมบูรณ์และซิงก์เข้ากับทุกฉากแล้ว');
      notify('อัปเดตเสียงพากย์เรียบร้อย');
      await persistProject(nextProj, ttsOut.raw, 'wav', exportResult?.blob ?? null, projectId, true);
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
      setAudioNote(`นำเข้าไฟล์เสียง ${file.name} แล้ว`);
      notify('นำเข้าไฟล์เสียงสำเร็จ');
      await persistProject(nextProj, raw, ext, exportResult?.blob ?? null, projectId, true);
    } catch {
      notify('ไฟล์เสียงนี้ไม่สามารถถอดรหัสได้ กรุณาลองใช้ MP3 หรือ WAV');
    }
  }

  function handleOpenDemo() {
    stopPlayback();
    setProject(DEMO_PROJECT);
    setProjectId(null);
    setAudioRaw(null);
    setAudioBuffer(null);
    setEnvelope([]);
    setSpeechBounds({ ss: 0 });
    setAudioNote('โปรเจกต์ตัวอย่างพร้อมรับชม (กด "พากย์เสียง AI" เพื่อสร้างเสียงจริง หรือปรับแก้บทได้ทันที)');
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
        setAudioNote('ไฟล์เสียงที่บันทึกไว้ไม่สามารถอ่านได้');
      }
    } else {
      setAudioBuffer(null);
      setEnvelope([]);
      setAudioNote('โปรเจกต์นี้ยังไม่มีเสียงพากย์ สามารถกดพากย์เสียง AI หรือนำเข้าเสียงเองได้');
    }

    if (exportVideoUrl) URL.revokeObjectURL(exportVideoUrl);
    if (rec.video) {
      const url = URL.createObjectURL(rec.video);
      setExportVideoUrl(url);
      setExportResult({
        blob: rec.video,
        mimeType: rec.video.type || 'video/mp4',
        ext: rec.video.type.includes('webm') ? 'webm' : 'mp4',
        durationSec: null,
        hasAudioTrack: Boolean(rec.audio),
        usedScale: 1,
      });
    } else {
      setExportVideoUrl(null);
      setExportResult(null);
    }

    setCurrentTime(0);
    setActiveTab('studio');
  }

  async function handleExportVideo() {
    if (!project) return;
    stopPlayback();
    setExportError(null);
    setIsExporting(true);
    setExportProgressText('เตรียมตัวเข้ารหัสวิดีโอ…');
    setExportProgressPct(2);

    try {
      const res = await exportCartoonVideo({
        project,
        timeline: timelineResult.timeline,
        totalDuration: timelineResult.totalDuration,
        envelope,
        leadSec: timelineResult.leadSec,
        speechStartSec: speechBounds.ss,
        mixBuffer,
        want1080: settings.defaultRes === '1080',
        subtitleScale: settings.subtitleScale,
        onProgress: (msg, pct) => {
          setExportProgressText(msg);
          setExportProgressPct(pct);
        },
      });

      if (exportVideoUrl) URL.revokeObjectURL(exportVideoUrl);
      const url = URL.createObjectURL(res.blob);
      setExportResult(res);
      setExportVideoUrl(url);
      await persistProject(project, audioRaw, audioExt, res.blob, projectId, true);
      notify('สร้างไฟล์วิดีโอเสร็จสมบูรณ์');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportError(msg);
      setExportProgressText('');
      setExportProgressPct(0);
    } finally {
      setIsExporting(false);
    }
  }

  async function handleShareVideo() {
    if (!exportResult || !project) return;
    const filename = `${sanitizeFilename(project.title)}.${exportResult.ext}`;
    const file = new File([exportResult.blob], filename, { type: exportResult.mimeType });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: project.title });
      } catch {
        // user cancelled share
      }
    } else {
      notify('เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์โดยตรง กรุณาใช้ปุ่มดาวน์โหลด');
    }
  }

  async function handlePickDirectory() {
    const picker = (window as unknown as { showDirectoryPicker?: (o: { mode: string }) => Promise<DirHandle> })
      .showDirectoryPicker;
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
            isGenerating={isGenerating}
            progressText={genProgressText}
            progressPct={genProgressPct}
            errorText={genError}
            onGenerate={handleGenerateCartoon}
            onLoadDemo={handleOpenDemo}
            savedProjects={savedProjects}
            onOpenProject={handleOpenSavedProject}
          />
        )}

        {activeTab === 'studio' && (
          <StudioView
            canvasRef={canvasRef}
            project={project}
            timeline={timelineResult.timeline}
            currentTime={currentTime}
            totalDuration={timelineResult.totalDuration}
            isPlaying={isPlaying}
            isMuted={isMuted}
            hasAudio={Boolean(audioRaw)}
            audioExt={audioExt}
            audioNote={audioNote}
            isGeneratingAudio={isGeneratingAudio}
            exportResolution={settings.defaultRes}
            subtitleScale={settings.subtitleScale}
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
            onDownloadAudio={() => {
              if (!audioRaw || !project) return;
              const mime = audioExt === 'wav' ? 'audio/wav' : 'audio/mpeg';
              triggerDownload(
                new Blob([audioRaw], { type: mime }),
                `${sanitizeFilename(project.title)}.voice.${audioExt || 'wav'}`
              );
            }}
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
            onExportVideo={handleExportVideo}
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
