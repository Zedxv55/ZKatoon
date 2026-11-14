import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CharactersView } from './components/CharactersView';
import { CreateView } from './components/CreateView';
import { LocalStorageView } from './components/LocalStorageView';
import { ProjectsView } from './components/ProjectsView';
import { SceneDirectorView } from './components/SceneDirectorView';
import { SettingsView } from './components/SettingsView';
import { StudioView } from './components/StudioView';
import { TopBar, type AppTab } from './components/TopBar';
import { VoiceStudioView } from './components/VoiceStudioView';
import { ThreeSceneStage } from './engine3d/ThreeSceneStage';
import type {
  AuthUserProfile,
  CartoonProject,
  ExportFps,
  HardwareCapabilities,
  MergeAudioOutcome,
  PauseCandidate,
  PerformancePreset,
  PronunciationEntry,
  SavedProjectRecord,
  SceneAudioRecord,
  StudioSelection,
  StudioSettings,
  VoicePreset,
  WorkspaceMeta,
  WorkspaceSecrets,
} from './types/cartoon';
import {
  assertMatchingAccountUid,
  resolveAccountScopeKey,
  runSafeAccountSwitchSequence,
} from './utils/accountLifecycle';
import {
  getCurrentFirebaseUid,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeFirebaseAuth,
  testFirestoreServerConnection,
} from './utils/firebaseClient';
import { generateDirectorPlan } from './utils/aiDirector';
import {
  buildAudioGraph,
  exportMixedMp3,
  mergeSceneAudioRecordsToBuffer,
  type AudioGraphHandle,
} from './utils/audioEngine';
import { CANVAS_H, CANVAS_W, renderCartoonFrame } from './utils/canvasRenderer';
import { probeHardwareCapabilities } from './utils/capabilities';
import {
  DEFAULT_SELECTION,
  DEFAULT_SETTINGS,
  DEMO_3D_PROJECT,
  DEMO_PROJECT,
} from './utils/cartoonData';
import {
  buildTimeline,
  computeAudioEnvelope,
  sanitizeFilename,
} from './utils/projectLogic';
import {
  getStorageSummary,
  requestPersistentStorage,
  saveProjectFilesToLocal,
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
import { generateUuid } from './utils/workspaceCrypto';
import {
  createWorkspace,
  deleteVoicePreset,
  deleteWorkspace,
  deleteWorkspaceProject,
  deleteWorkspaceProjectVideo,
  enableWorkspacePassphrase,
  exportWorkspaceBackupBlob,
  getActiveWorkspace,
  getOrCreateLocalDeviceId,
  getPronunciationDict,
  importWorkspaceBackupFile,
  listProjectSceneAudio,
  listVoicePresets,
  listWorkspaceProjects,
  listWorkspaces,
  loadWorkspaceSettings,
  removeWorkspacePassphrase,
  renameWorkspace,
  savePronunciationDict,
  saveSceneAudioRecord,
  saveVoicePreset,
  saveWorkspaceProject,
  saveWorkspaceSecrets,
  saveWorkspaceSettings,
  setActiveWorkspaceId,
  unlockWorkspace,
} from './utils/workspaceStore';

const INITIAL_WORKSPACE: WorkspaceMeta = {
  id: 'ws_loading',
  name: 'กำลังโหลด Workspace…',
  deviceId: 'local-init',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  hasPassphrase: false,
  plainSecrets: {},
};

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') return 'studio';
    const qTab = params.get('tab') as AppTab | null;
    if (
      qTab &&
      ['create', 'characters', 'voice', 'director', 'studio', 'projects', 'storage', 'settings'].includes(
        qTab
      )
    ) {
      return qTab;
    }
    return 'create';
  });

  // Auth & Multi-Workspace Local-First State (keyed strictly by Firebase UID or 'guest')
  const [authProfile, setAuthProfile] = useState<AuthUserProfile | null>(null);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [idbError, setIdbError] = useState<string | null>(null);
  const accountScopeRef = useRef<string>('guest');
  const initialBootRef = useRef<boolean>(false);

  const [deviceId, setDeviceId] = useState<string>('local');
  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([INITIAL_WORKSPACE]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMeta>(INITIAL_WORKSPACE);
  const [unlockedKey, setUnlockedKey] = useState<CryptoKey | null>(null);
  const [secrets, setSecrets] = useState<WorkspaceSecrets>({});
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [voicePresets, setVoicePresets] = useState<VoicePreset[]>([]);
  const [dictionary, setDictionary] = useState<PronunciationEntry[]>([]);
  const [savedProjects, setSavedProjects] = useState<SavedProjectRecord[]>([]);
  const [storageSummary, setStorageSummary] = useState<StorageSummary>({
    supported: true,
    usageMB: 0,
    quotaMB: 0,
    freeMB: 0,
    ratio: 0,
    persisted: false,
  });

  // Hardware probe
  const [capabilities, setCapabilities] = useState<HardwareCapabilities | null>(null);

  // Story Director & Wizard state
  const [selection, setSelection] = useState<StudioSelection>(DEFAULT_SELECTION);
  const [topic, setTopic] = useState('');
  const [facts, setFacts] = useState('');
  const [draftPlanProject, setDraftPlanProject] = useState<CartoonProject | null>(null);

  // Active Project + Per-Scene Audio + Master Audio state
  const [project, setProject] = useState<CartoonProject | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      return params.get('demo') === '2d' ? DEMO_PROJECT : DEMO_3D_PROJECT;
    }
    return null;
  });
  const [projectId, setProjectId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      return params.get('demo') === '2d' ? DEMO_PROJECT.id || 'demo-2d' : DEMO_3D_PROJECT.id || 'demo-3d';
    }
    return null;
  });
  const [sceneAudioMap, setSceneAudioMap] = useState<Record<string, SceneAudioRecord>>({});
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

  // Directory & Toast
  const [dirHandle, setDirHandle] = useState<DirHandle | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Refs for Web Audio, 2D Canvas, and 3D ThreeSceneStage
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stage3dContainerRef = useRef<HTMLDivElement | null>(null);
  const stage3dRef = useRef<ThreeSceneStage | null>(null);
  const playbackStop3dRef = useRef<(() => void) | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioGraphRef = useRef<AudioGraphHandle | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartCtxTimeRef = useRef(0);
  const exportAbortRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const ttsStopHandlersRef = useRef<Set<() => void>>(new Set());

  const registerTtsStopHandler = useCallback((fn: () => void) => {
    ttsStopHandlersRef.current.add(fn);
    return () => {
      ttsStopHandlersRef.current.delete(fn);
    };
  }, []);

  // Live refs for reactive rendering inside ThreeSceneStage playback loops
  const projectRef = useRef(project);
  projectRef.current = project;
  const envelopeRef = useRef(envelope);
  envelopeRef.current = envelope;
  const speechBoundsRef = useRef(speechBounds);
  speechBoundsRef.current = speechBounds;
  const sceneAudioMapRef = useRef(sceneAudioMap);
  sceneAudioMapRef.current = sceneAudioMap;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const isLocked = activeWorkspace.hasPassphrase && unlockedKey === null;

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3800);
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

  // Load workspace data helper (strictly guards IndexedDB read errors)
  const loadWorkspaceData = useCallback(async (ws: WorkspaceMeta, keyForLocked: CryptoKey | null = null) => {
    setActiveWorkspace(ws);
    setActiveWorkspaceId(ws.id, resolveAccountScopeKey(ws.ownerUid));
    setUnlockedKey(keyForLocked);
    setSecrets(ws.hasPassphrase ? {} : ws.plainSecrets || {});

    const wsSettings = loadWorkspaceSettings(ws.id);
    setSettings(wsSettings);

    const [projects, presets, dict, sum] = await Promise.all([
      listWorkspaceProjects(ws.id),
      listVoicePresets(ws.id),
      getPronunciationDict(ws.id),
      getStorageSummary(),
    ]);
    setSavedProjects(projects);
    setVoicePresets(presets);
    setDictionary(dict);
    setStorageSummary(sum);
  }, []);

  const loadAccountWorkspaces = useCallback(
    async (scopeKey: string, hwOverride?: HardwareCapabilities | null) => {
      try {
        setIdbError(null);
        const [activeWs, allWs] = await Promise.all([
          getActiveWorkspace(scopeKey),
          listWorkspaces(scopeKey),
        ]);
        // Confirm account has not changed mid-flight
        if (accountScopeRef.current !== scopeKey) return;
        setWorkspaces(allWs);
        await loadWorkspaceData(activeWs, null);

        const hw = hwOverride ?? capabilities;
        if (hw?.isSoftwareGl) {
          const wsSet = loadWorkspaceSettings(activeWs.id);
          if (wsSet.previewQuality !== 'low') {
            const next = { ...wsSet, previewQuality: 'low' as PerformancePreset };
            saveWorkspaceSettings(activeWs.id, next);
            setSettings(next);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ไม่สามารถอ่านฐานข้อมูล IndexedDB ในเครื่องได้';
        setIdbError(`IndexedDB Error: ${msg} — ระบบหยุดการสร้าง Workspace ว่างอัตโนมัติเพื่อปกป้องข้อมูลเดิมของคุณ`);
      }
    },
    [capabilities, loadWorkspaceData]
  );

  // Stop any active TTS HTTP requests and playing preview audio safely
  const stopTtsPreviews = useCallback(() => {
    ttsStopHandlersRef.current.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore
      }
    });
    if (typeof document !== 'undefined') {
      document.querySelectorAll('audio').forEach((el) => {
        try {
          el.pause();
        } catch {
          // ignore
        }
      });
    }
  }, []);

  // Safe clear of previous user React state on account switch
  const clearUserReactState = useCallback(() => {
    setDraftPlanProject(null);
    setProject(null);
    setProjectId(null);
    setSceneAudioMap({});
    setAudioRaw(null);
    setAudioBuffer(null);
    setEnvelope([]);
    setPauseCandidates([]);
    setSpeechBounds({ ss: 0 });
    setAudioNote('');
    setSecrets({});
    setUnlockedKey(null);
    setVoicePresets([]);
    setSavedProjects([]);
    setExportResult(null);
    setExportError(null);
    setExportProgressText('');
    setExportProgressPct(0);
    setCurrentTime(0);
  }, []);

  // Bootstrap hardware capabilities, Firestore ping, and Auth state listener
  useEffect(() => {
    let mounted = true;
    const devId = getOrCreateLocalDeviceId();
    setDeviceId(devId);

    void testFirestoreServerConnection();

    const hwPromise = probeHardwareCapabilities().then((hw) => {
      if (mounted) setCapabilities(hw);
      return hw;
    });

    const unsub = subscribeFirebaseAuth(async (profile) => {
      if (!mounted) return;
      const nextScope = resolveAccountScopeKey(profile?.uid);
      const prevScope = accountScopeRef.current;
      const isFirstBoot = !initialBootRef.current;
      initialBootRef.current = true;

      setAuthProfile(profile);

      if (isFirstBoot && prevScope === nextScope) {
        accountScopeRef.current = nextScope;
        const hw = await hwPromise;
        if (!mounted) return;
        await loadAccountWorkspaces(nextScope, hw);
        return;
      }

      if (prevScope !== nextScope) {
        accountScopeRef.current = nextScope;
        await runSafeAccountSwitchSequence(nextScope, {
          stopPlayback: () => {
            setIsPlaying(false);
            if (rafRef.current !== null) {
              cancelAnimationFrame(rafRef.current);
              rafRef.current = null;
            }
            playbackStop3dRef.current?.();
            playbackStop3dRef.current = null;
            try {
              audioGraphRef.current?.stop();
            } catch {
              // ignore
            }
            audioGraphRef.current = null;
          },
          stopTts: stopTtsPreviews,
          abortExport: async () => {
            if (exportAbortRef.current) {
              exportAbortRef.current.abort();
              await new Promise((r) => setTimeout(r, 80));
            }
          },
          clearUserReactState: () => {
            if (exportVideoUrl) URL.revokeObjectURL(exportVideoUrl);
            setExportVideoUrl(null);
            clearUserReactState();
          },
          loadAccountData: async (targetScope) => {
            const hw = await hwPromise;
            if (!mounted) return;
            await loadAccountWorkspaces(targetScope, hw);
          },
        });
      }
    });

    return () => {
      mounted = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload per-scene audio whenever projectId or activeWorkspace changes
  useEffect(() => {
    if (!projectId || !activeWorkspace.id || activeWorkspace.id === 'ws_loading') {
      setSceneAudioMap({});
      return;
    }
    let mounted = true;
    listProjectSceneAudio(activeWorkspace.id, projectId).then((map) => {
      if (mounted) setSceneAudioMap(map);
    });
    return () => {
      mounted = false;
    };
  }, [activeWorkspace.id, projectId]);

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
      sceneAudioMap,
    });
  }, [project, audioBuffer, speechBounds, pauseCandidates, sceneAudioMap]);

  const timelineResultRef = useRef(timelineResult);
  timelineResultRef.current = timelineResult;

  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (playbackStop3dRef.current) {
      playbackStop3dRef.current();
      playbackStop3dRef.current = null;
    }
    try {
      audioGraphRef.current?.stop();
    } catch {
      // ignore
    }
    audioGraphRef.current = null;
  }, []);

  // Initialize / dispose ThreeSceneStage when Studio is open & engine is 3D
  const is3dProject = Boolean(project && project.renderEngine !== '2d_paper');
  useEffect(() => {
    if (activeTab !== 'studio' || !is3dProject) {
      if (stage3dRef.current) {
        stage3dRef.current.dispose();
        stage3dRef.current = null;
      }
      return;
    }

    const container = stage3dContainerRef.current;
    if (!container) return;

    const stage = new ThreeSceneStage({
      container,
      preset: settingsRef.current.previewQuality || 'balanced',
      style3d: projectRef.current?.style3d || 'cinematic_3d',
      onContextLost: () => notify('WebGL context ถูกพักชั่วคราว กำลังกู้คืน…'),
      onContextRestored: () => {
        if (projectRef.current && stage3dRef.current) {
          stage3dRef.current.rebuildAllCharacters(projectRef.current);
        }
      },
    });
    stage3dRef.current = stage;

    if (projectRef.current) {
      void stage.syncProjectAssets(projectRef.current).then(() => {
        if (projectRef.current && timelineResultRef.current.timeline.length) {
          stage.renderFrameAt(projectRef.current, timelineResultRef.current.timeline, currentTime, {
            envelope: envelopeRef.current,
            leadSec: timelineResultRef.current.leadSec,
            speechStartSec: speechBoundsRef.current.ss,
            subtitleScale: settingsRef.current.subtitleScale,
            sceneAudioMap: sceneAudioMapRef.current,
          });
        }
      });
    }

    return () => {
      stage.dispose();
      if (stage3dRef.current === stage) stage3dRef.current = null;
    };
    // Mount once per entering Studio in 3D mode; asset updates handled cleanly below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, is3dProject]);

  // Sync 3D character rigs / quality preset changes without tearing down WebGLRenderer
  const charDigest = useMemo(
    () => (project ? JSON.stringify(project.characters) + '|' + (project.style3d || '') : ''),
    [project]
  );

  useEffect(() => {
    const stage = stage3dRef.current;
    if (!stage || !project || !is3dProject || activeTab !== 'studio') return;
    stage.rebuildAllCharacters(project);
    const tmr = window.setTimeout(() => {
      if (stage3dRef.current === stage && timelineResultRef.current.timeline.length) {
        stage.renderFrameAt(project, timelineResultRef.current.timeline, currentTime, {
          envelope: envelopeRef.current,
          leadSec: timelineResultRef.current.leadSec,
          speechStartSec: speechBoundsRef.current.ss,
          subtitleScale: settings.subtitleScale,
          sceneAudioMap: sceneAudioMapRef.current,
        });
      }
    }, 60);
    return () => window.clearTimeout(tmr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charDigest]);

  useEffect(() => {
    const stage = stage3dRef.current;
    if (stage) {
      stage.setPerformancePreset(settings.previewQuality);
    }
  }, [settings.previewQuality]);

  const drawAt = useCallback(
    (t: number) => {
      if (!project || !timelineResult.timeline.length) return;
      if (project.renderEngine !== '2d_paper') {
        stage3dRef.current?.renderFrameAt(project, timelineResult.timeline, t, {
          envelope,
          leadSec: timelineResult.leadSec,
          speechStartSec: speechBounds.ss,
          subtitleScale: settings.subtitleScale,
          sceneAudioMap,
        });
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
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
    [project, timelineResult, envelope, speechBounds.ss, settings.subtitleScale, pauseCandidates, sceneAudioMap]
  );

  // Clamp currentTime if timeline shrinks
  useEffect(() => {
    if (!isPlaying && timelineResult.totalDuration > 0 && currentTime > timelineResult.totalDuration) {
      setCurrentTime(Math.max(0, Number((timelineResult.totalDuration - 0.05).toFixed(2))));
    }
  }, [isPlaying, currentTime, timelineResult.totalDuration]);

  // Redraw whenever paused frame time or project changes
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

      const handleTick = () => {
        const elapsed = ctx.currentTime - playStartCtxTimeRef.current;
        if (elapsed >= timelineResult.totalDuration) {
          setCurrentTime(timelineResult.totalDuration);
          stopPlayback();
          drawAt(timelineResult.totalDuration);
          return false;
        }
        audioGraphRef.current?.schedulerTick(elapsed);
        setCurrentTime(elapsed);
        drawAt(elapsed);
        return true;
      };

      if (project.renderEngine !== '2d_paper' && stage3dRef.current) {
        playbackStop3dRef.current = stage3dRef.current.createPlaybackLoop(() => handleTick());
      } else {
        const tick = () => {
          if (handleTick()) {
            rafRef.current = requestAnimationFrame(tick);
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      }
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

  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  const refreshWorkspaceLists = useCallback(async (wsId = activeWorkspace.id) => {
    const scope = accountScopeRef.current;
    const [allWs, projs, sum] = await Promise.all([
      listWorkspaces(scope),
      listWorkspaceProjects(wsId),
      getStorageSummary(),
    ]);
    setWorkspaces(allWs);
    setSavedProjects(projs);
    setStorageSummary(sum);
  }, [activeWorkspace.id]);

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
      const id = existingId || proj.id || `proj_${generateUuid()}`;
      let thumb: string | null = null;
      try {
        const tmp = document.createElement('canvas');
        tmp.width = 90;
        tmp.height = 160;
        if (proj.renderEngine !== '2d_paper' && stage3dRef.current) {
          tmp.getContext('2d')?.drawImage(stage3dRef.current.getWebGLCanvas(), 0, 0, 90, 160);
          thumb = tmp.toDataURL('image/jpeg', 0.65);
        } else {
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
        }
      } catch {
        thumb = null;
      }

      const expectedScope = accountScopeRef.current;
      assertMatchingAccountUid(expectedScope, getCurrentFirebaseUid(), 'บันทึกโปรเจกต์');

      const projWithId = { ...proj, id };
      await saveWorkspaceProject(activeWorkspace.id, {
        id,
        workspaceId: activeWorkspace.id,
        title: proj.title || 'ไม่มีชื่อเรื่อง',
        data: projWithId,
        audio: rawAudio,
        ext,
        video: videoBlob,
        thumb,
        at: Date.now(),
      });
      assertMatchingAccountUid(expectedScope, getCurrentFirebaseUid(), 'อัปเดตสถานะโปรเจกต์');
      setProject(projWithId);
      setProjectId(id);
      await refreshWorkspaceLists(activeWorkspace.id);
      if (!silent) notify(`บันทึก "${proj.title}" ลง Workspace "${activeWorkspace.name}" แล้ว`);
      return id;
    },
    [activeWorkspace.id, activeWorkspace.name, settings.subtitleScale, refreshWorkspaceLists, notify]
  );

  // Determine whether active AI script provider has key configured
  const hasActiveAiKey = useMemo(() => {
    if (settings.aiProvider === 'openrouter') return Boolean(secrets.openRouterKey?.trim());
    if (settings.aiProvider === 'openai') return Boolean(secrets.openAiKey?.trim());
    if (settings.aiProvider === 'gemini_byok') return Boolean(secrets.geminiKey?.trim());
    return true; // server_gemini fallback
  }, [settings.aiProvider, secrets]);

  // Step 1: Generate AI Director Production Plan (editable review gate)
  async function handleGeneratePlan() {
    if (!topic.trim()) {
      setGenError('กรุณากรอกหัวข้อเรื่องก่อนกดให้ AI Director ออกแบบแผน');
      return;
    }
    stopPlayback();
    setGenError(null);
    setIsGenerating(true);
    setGenProgressText('AI Director กำลังวิเคราะห์เรื่อง วาง Production Plan และ Shot List…');
    setGenProgressPct(45);

    try {
      const planProj = await generateDirectorPlan({
        provider: settings.aiProvider,
        settings,
        secrets,
        selection,
        topic: topic.trim(),
        facts: facts.trim(),
      });
      setDraftPlanProject(planProj);
      setGenProgressText('วาง Production Plan สำเร็จ! ตรวจสอบและแก้ไขได้ด้านบนก่อนอนุมัติ');
      setGenProgressPct(100);
      notify('AI Director สร้าง Production Plan แล้ว — ตรวจสอบก่อนเข้าสู่สตูดิโอ');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setGenError(msg);
      setGenProgressText('');
      setGenProgressPct(0);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleApprovePlan(approved: CartoonProject) {
    stopPlayback();
    const id = approved.id || `proj_${generateUuid()}`;
    const cleanProj = { ...approved, id };
    setDraftPlanProject(null);
    setProject(cleanProj);
    setProjectId(id);
    setAudioRaw(null);
    setAudioBuffer(null);
    setEnvelope([]);
    setPauseCandidates([]);
    setSpeechBounds({ ss: 0 });
    setAudioNote('อนุมัติ Production Plan แล้ว — ไปที่เมนู "ห้องพากย์" เพื่อพากย์เสียงทีละฉากหรือทั้งหมด');
    if (exportVideoUrl) {
      URL.revokeObjectURL(exportVideoUrl);
      setExportVideoUrl(null);
    }
    setExportResult(null);
    setCurrentTime(0);
    await persistProject(cleanProj, null, 'wav', null, id, true);
    setActiveTab('studio');
    notify('เปิดโปรเจกต์ในสตูดิโอ 3D แล้ว');
  }

  function handleImportOutputG(imported: CartoonProject) {
    stopPlayback();
    const id = imported.id || `proj_${generateUuid()}`;
    const cleanProj = { ...imported, id };
    setProject(cleanProj);
    setProjectId(id);
    setAudioRaw(null);
    setAudioBuffer(null);
    setEnvelope([]);
    setPauseCandidates([]);
    setSpeechBounds({ ss: 0 });
    setAudioNote('นำเข้า JSON / OUTPUT G สำเร็จ — ไปที่ "ห้องพากย์" เพื่อพากย์เสียงไทย หรือนำเข้าไฟล์เสียง');
    if (exportVideoUrl) {
      URL.revokeObjectURL(exportVideoUrl);
      setExportVideoUrl(null);
    }
    setExportResult(null);
    setCurrentTime(0);
    setActiveTab('studio');
    notify(`นำเข้า "${cleanProj.title}" สำเร็จ`);
  }

  function handleOpenDemo3D() {
    stopPlayback();
    const id = DEMO_3D_PROJECT.id || 'demo-3d-riverside';
    setProject({ ...DEMO_3D_PROJECT, id });
    setProjectId(id);
    setAudioRaw(null);
    setAudioBuffer(null);
    setEnvelope([]);
    setPauseCandidates([]);
    setSpeechBounds({ ss: 0 });
    setAudioNote('โปรเจกต์ตัวอย่าง 3D ("คืนโคมไฟริมน้ำ") — กดเล่นเพื่อดูกล้อง 3D หรือไปห้องพากย์เพื่อใส่เสียงไทย');
    if (exportVideoUrl) {
      URL.revokeObjectURL(exportVideoUrl);
      setExportVideoUrl(null);
    }
    setExportResult(null);
    setCurrentTime(0);
    setActiveTab('studio');
  }

  function handleOpenDemo2D() {
    stopPlayback();
    const id = DEMO_PROJECT.id || 'demo-paper-sketch';
    setProject({ ...DEMO_PROJECT, id });
    setProjectId(id);
    setAudioRaw(null);
    setAudioBuffer(null);
    setEnvelope([]);
    setPauseCandidates([]);
    setSpeechBounds({ ss: 0 });
    setAudioNote('โปรเจกต์ตัวอย่าง 2D PAPER-SKETCH ("สวัสดีวันจันทร์") — รักษาความสามารถเดิมครบถ้วน');
    if (exportVideoUrl) {
      URL.revokeObjectURL(exportVideoUrl);
      setExportVideoUrl(null);
    }
    setExportResult(null);
    setCurrentTime(0);
    setActiveTab('studio');
  }

  async function handleOpenSavedProject(id: string) {
    const rec = savedProjects.find((p) => p.id === id);
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
        setAudioNote('ไฟล์เสียงที่บันทึกไว้ไม่สามารถถอดรหัสได้');
      }
    } else {
      setAudioBuffer(null);
      setEnvelope([]);
      setPauseCandidates([]);
      setAudioNote('โปรเจกต์นี้ยังไม่มีเสียงพากย์รวม สามารถสร้างใน "ห้องพากย์" หรือนำเข้าเสียงเองได้');
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
        audioVerifiedStatus: rec.audio ? 'detected' : 'unverifiable',
        usedScale: 1,
        usedWidth: 720,
        usedHeight: 1280,
        usedFps: settings.exportFps || 30,
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

  // Merge per-scene audio blobs into master timeline AudioBuffer & envelope (reads authoritative records, reports real failures)
  async function handleMergeAllAudioToStudio(
    overrideSceneMap?: Record<string, SceneAudioRecord>
  ): Promise<MergeAudioOutcome> {
    if (!project) {
      return { ok: false, mergedCount: 0, failedScenes: [], error: 'ยังไม่ได้เปิดโปรเจกต์' };
    }
    stopPlayback();
    try {
      const projId = projectId || project.id || 'active-project';
      const persistedMap = await listProjectSceneAudio(activeWorkspace.id, projId).catch(() => ({}));
      const latestMap: Record<string, SceneAudioRecord> = {
        ...persistedMap,
        ...sceneAudioMapRef.current,
        ...(overrideSceneMap || {}),
      };
      setSceneAudioMap(latestMap);

      const ctx = getAudioCtx();
      const merged = await mergeSceneAudioRecordsToBuffer(ctx, project.scenes, latestMap);
      if (!merged.voiceBuffer || !merged.rawWav) {
        const errText =
          merged.failedScenes.length > 0
            ? `ถอดรหัสไฟล์เสียงล้มเหลว (${merged.failedScenes.map((f) => `${f.sceneId}: ${f.reason}`).join(', ')})`
            : 'ยังไม่มีไฟล์เสียงพากย์รายฉากที่สมบูรณ์ในโปรเจกต์นี้';
        notify(errText);
        return {
          ok: false,
          mergedCount: 0,
          failedScenes: merged.failedScenes,
          error: errText,
        };
      }

      const nextProj: CartoonProject = {
        ...project,
        sceneDurations: merged.sceneDurations,
      };
      setProject(nextProj);
      setAudioBuffer(merged.voiceBuffer);
      setAudioRaw(merged.rawWav);
      setAudioExt('wav');
      setEnvelope(merged.envelope);
      setPauseCandidates(merged.pauseCandidates);
      setSpeechBounds({ ss: merged.speechStartSec, se: merged.speechEndSec });

      if (merged.failedScenes.length > 0) {
        const failList = merged.failedScenes.map((f) => f.sceneId).join(', ');
        const partialMsg = `รวมเสียงได้ ${merged.decodedSceneCount} ฉาก แต่ฉาก ${failList} ถอดรหัสล้มเหลว กรุณากดลองใหม่`;
        setAudioNote(partialMsg);
        notify(partialMsg);
        await persistProject(nextProj, merged.rawWav, 'wav', exportResult?.blob ?? null, projectId, true);
        return {
          ok: false,
          mergedCount: merged.decodedSceneCount,
          failedScenes: merged.failedScenes,
          error: partialMsg,
        };
      }

      setAudioNote(
        `รวมเสียงพากย์ ${merged.decodedSceneCount} ฉากเข้า Timeline แล้ว (${merged.voiceBuffer.duration.toFixed(1)}s)`
      );
      await persistProject(nextProj, merged.rawWav, 'wav', exportResult?.blob ?? null, projectId, true);
      setActiveTab('studio');
      notify(`รวมเสียง ${merged.decodedSceneCount} ฉากเข้า Timeline และซิงก์ Lip-Sync แล้ว`);
      return {
        ok: true,
        mergedCount: merged.decodedSceneCount,
        failedScenes: [],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'รวมเสียงเข้า Timeline ไม่สำเร็จ';
      setAudioNote(`รวมเสียงล้มเหลว: ${msg}`);
      notify(msg);
      return {
        ok: false,
        mergedCount: 0,
        failedScenes: [],
        error: msg,
      };
    }
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

  async function handleExportVideo(forceFormat: 'auto' | 'webm' = 'auto') {
    if (!project) return;
    stopPlayback();
    setExportError(null);
    setIsExporting(true);
    setExportProgressText('เตรียมตัวเข้ารหัสวิดีโอ…');
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
        sceneAudioMap,
        voiceBuffer: audioBuffer,
        enableBgmAndSfx: settings.enableBgmAndSfx,
        cineEnabled: Boolean(project.cineLayer?.enabled),
        want1080: settings.defaultRes === '1080',
        fps: settings.exportFps || 30,
        performancePreset: settings.performancePreset || 'high',
        forceFormat,
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
      triggerDownload(res.blob, `${sanitizeFilename(project.title)}.${res.ext}`);
      await persistProject(project, audioRaw, audioExt, res.blob, projectId, true);
      notify(`สร้างและตรวจสอบไฟล์ ${res.ext.toUpperCase()} เสร็จสมบูรณ์`);
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
    const filename = `${sanitizeFilename(project.title)}.${exportResult.ext}`;
    const file = new File([exportResult.blob], filename, { type: exportResult.mimeType });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: project.title });
      } catch {
        // cancelled
      }
    } else {
      notify('เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์โดยตรง กรุณาใช้ปุ่มดาวน์โหลดวิดีโอ');
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
      notify(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ');
    }
  }

  const handleUpdateSettings = useCallback(
    (next: StudioSettings) => {
      setSettings(next);
      saveWorkspaceSettings(activeWorkspace.id, next);
    },
    [activeWorkspace.id]
  );

  const handleSignInGoogle = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      const profile = await signInWithGooglePopup(false);
      notify(`เข้าสู่ระบบสำเร็จ (${profile.displayName} · UID ${profile.uid.slice(0, 6)}…)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เข้าสู่ระบบ Google ไม่สำเร็จ';
      notify(msg);
    } finally {
      setIsAuthBusy(false);
    }
  }, [notify]);

  const handleSwitchAccount = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      const profile = await signInWithGooglePopup(true);
      notify(`สลับบัญชีเป็น ${profile.displayName} (UID ${profile.uid.slice(0, 6)}…)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เปลี่ยนบัญชีไม่สำเร็จ';
      notify(msg);
    } finally {
      setIsAuthBusy(false);
    }
  }, [notify]);

  const handleSignOut = useCallback(async () => {
    setIsAuthBusy(true);
    try {
      await signOutFirebase();
      notify('ออกจากระบบแล้ว — ใช้งานต่อในโหมด Guest ในเครื่อง');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'ออกจากระบบไม่สำเร็จ');
    } finally {
      setIsAuthBusy(false);
    }
  }, [notify]);

  return (
    <div className="min-h-screen bg-[#0a0b10] text-[#f3f2fa] pb-16 md:pb-8">
      <TopBar
        activeTab={activeTab}
        onChangeTab={(tab) => {
          if (tab !== 'studio') stopPlayback();
          setActiveTab(tab);
          if (tab === 'projects' || tab === 'storage') {
            void refreshWorkspaceLists(activeWorkspace.id);
          }
        }}
        hasProject={Boolean(project)}
        workspaceName={activeWorkspace.name}
        isLocked={isLocked}
        authProfile={authProfile}
        isAuthBusy={isAuthBusy}
        onSignInGoogle={handleSignInGoogle}
        onSwitchAccount={handleSwitchAccount}
        onSignOut={handleSignOut}
        onOpenDemo3D={handleOpenDemo3D}
      />

      {idbError && (
        <div
          role="alert"
          className="mx-auto max-w-[1440px] px-4 pt-3 sm:px-6"
        >
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs text-rose-100">
            <strong>เกิดข้อผิดพลาดในการอ่านฐานข้อมูลในเครื่อง:</strong> {idbError}
          </div>
        </div>
      )}

      <main>
        {activeTab === 'create' && (
          <CreateView
            selection={selection}
            onChangeSelection={setSelection}
            topic={topic}
            onChangeTopic={setTopic}
            facts={facts}
            onChangeFacts={setFacts}
            aiProvider={settings.aiProvider}
            hasActiveKey={hasActiveAiKey}
            isGenerating={isGenerating}
            progressText={genProgressText}
            progressPct={genProgressPct}
            errorText={genError}
            draftPlanProject={draftPlanProject}
            onGeneratePlan={handleGeneratePlan}
            onApprovePlan={handleApprovePlan}
            onDiscardPlan={() => setDraftPlanProject(null)}
            onImportOutputG={handleImportOutputG}
            onLoadDemo3D={handleOpenDemo3D}
            onLoadDemo2D={handleOpenDemo2D}
            onGoSettings={() => setActiveTab('settings')}
            savedProjects={savedProjects}
            onOpenProject={handleOpenSavedProject}
          />
        )}

        {activeTab === 'characters' && (
          <CharactersView
            key={`${activeWorkspace.id}:${authProfile?.uid || 'guest'}`}
            workspaceId={activeWorkspace.id}
            project={project}
            onUpdateProject={setProject}
            onOpenDemo3D={handleOpenDemo3D}
            onNotify={notify}
          />
        )}

        {activeTab === 'voice' && (
          <VoiceStudioView
            key={`${activeWorkspace.id}:${authProfile?.uid || 'guest'}`}
            workspaceId={activeWorkspace.id}
            project={project}
            settings={settings}
            secrets={secrets}
            voicePresets={voicePresets}
            dictionary={dictionary}
            sceneAudioMap={sceneAudioMap}
            onUpdateSettings={handleUpdateSettings}
            onUpdateProject={setProject}
            onSaveVoicePreset={async (preset) => {
              assertMatchingAccountUid(accountScopeRef.current, getCurrentFirebaseUid(), 'บันทึก Voice Preset');
              await saveVoicePreset(activeWorkspace.id, preset);
              setVoicePresets(await listVoicePresets(activeWorkspace.id));
            }}
            onDeleteVoicePreset={async (id) => {
              assertMatchingAccountUid(accountScopeRef.current, getCurrentFirebaseUid(), 'ลบ Voice Preset');
              await deleteVoicePreset(id);
              setVoicePresets(await listVoicePresets(activeWorkspace.id));
            }}
            onSaveDictionary={async (entries) => {
              assertMatchingAccountUid(accountScopeRef.current, getCurrentFirebaseUid(), 'บันทึกพจนานุกรม');
              await savePronunciationDict(activeWorkspace.id, entries);
              setDictionary(entries);
            }}
            onSaveSceneAudio={async (rec) => {
              assertMatchingAccountUid(accountScopeRef.current, getCurrentFirebaseUid(), 'บันทึกเสียงพากย์');
              await saveSceneAudioRecord(rec);
              setSceneAudioMap((prev) => ({ ...prev, [rec.sceneId]: rec }));
            }}
            onMergeAllAudioToStudio={handleMergeAllAudioToStudio}
            onOpenDemo3D={handleOpenDemo3D}
            onGoSettings={() => setActiveTab('settings')}
            onNotify={notify}
            onRegisterTtsStop={registerTtsStopHandler}
          />
        )}

        {activeTab === 'director' && (
          <SceneDirectorView
            project={project}
            onUpdateProject={setProject}
            onOpenDemo3D={handleOpenDemo3D}
            onGoStudio={() => setActiveTab('studio')}
          />
        )}

        {activeTab === 'studio' && (
          <StudioView
            canvasRef={canvasRef}
            stage3dContainerRef={stage3dContainerRef}
            project={project}
            timeline={timelineResult.timeline}
            syncDiagnostics={timelineResult.syncDiagnostics}
            capabilities={capabilities}
            currentTime={currentTime}
            totalDuration={timelineResult.totalDuration}
            isPlaying={isPlaying}
            isMuted={isMuted}
            hasAudio={Boolean(audioRaw)}
            audioExt={audioExt}
            audioNote={audioNote}
            isExportingMp3={isExportingMp3}
            previewQuality={settings.previewQuality}
            exportQuality={settings.performancePreset}
            exportResolution={settings.defaultRes}
            exportFps={settings.exportFps}
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
            onGoVoiceStudio={() => setActiveTab('voice')}
            onGoDirector={() => setActiveTab('director')}
            onDownloadMp3={handleDownloadMp3}
            onSaveProject={() =>
              project &&
              persistProject(project, audioRaw, audioExt, exportResult?.blob ?? null, projectId)
            }
            onSaveLocal={handleSaveLocal}
            onUpdateProject={setProject}
            onChangePreviewQuality={(q) => handleUpdateSettings({ ...settings, previewQuality: q })}
            onChangeExportQuality={(q) => handleUpdateSettings({ ...settings, performancePreset: q })}
            onChangeExportRes={(res) => handleUpdateSettings({ ...settings, defaultRes: res })}
            onChangeExportFps={(fps: ExportFps) => handleUpdateSettings({ ...settings, exportFps: fps })}
            onChangeSubtitleScale={(scale) => handleUpdateSettings({ ...settings, subtitleScale: scale })}
            onRunPreflight={handleRunPreflight}
            onExportVideo={handleExportVideo}
            onCancelExport={() => exportAbortRef.current?.abort()}
            onShareVideo={handleShareVideo}
            onGoCreate={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsView
            key={`${activeWorkspace.id}:${authProfile?.uid || 'guest'}`}
            workspaceName={activeWorkspace.name}
            projects={savedProjects}
            storage={storageSummary}
            dirName={dirHandle?.name ?? null}
            onOpenProject={handleOpenSavedProject}
            onDeleteProject={async (id) => {
              assertMatchingAccountUid(accountScopeRef.current, getCurrentFirebaseUid(), 'ลบโปรเจกต์');
              await deleteWorkspaceProject(id);
              if (projectId === id) setProjectId(null);
              await refreshWorkspaceLists(activeWorkspace.id);
              notify('ลบโปรเจกต์แล้ว');
            }}
            onDeleteVideo={async (id) => {
              assertMatchingAccountUid(accountScopeRef.current, getCurrentFirebaseUid(), 'ล้างแคชวิดีโอ');
              await deleteWorkspaceProjectVideo(id);
              if (projectId === id) {
                setExportResult(null);
                if (exportVideoUrl) URL.revokeObjectURL(exportVideoUrl);
                setExportVideoUrl(null);
              }
              await refreshWorkspaceLists(activeWorkspace.id);
              notify('ล้างแคชวิดีโอแล้ว');
            }}
            onPickDirectory={handlePickDirectory}
            onGoStorage={() => setActiveTab('storage')}
          />
        )}

        {activeTab === 'storage' && (
          <LocalStorageView
            key={`${activeWorkspace.id}:${authProfile?.uid || 'guest'}`}
            workspaces={workspaces}
            activeWorkspace={activeWorkspace}
            isLocked={isLocked}
            deviceId={deviceId}
            storage={storageSummary}
            onSwitchWorkspace={async (id) => {
              const target = workspaces.find((w) => w.id === id);
              if (!target) return;
              stopPlayback();
              setProject(null);
              setProjectId(null);
              await loadWorkspaceData(target, null);
              notify(`สลับไปยัง Workspace "${target.name}" แล้ว`);
            }}
            onCreateWorkspace={async (name) => {
              const scope = accountScopeRef.current;
              assertMatchingAccountUid(scope, getCurrentFirebaseUid(), 'สร้าง Workspace');
              const ws = await createWorkspace(name, undefined, scope);
              setWorkspaces(await listWorkspaces(scope));
              stopPlayback();
              setProject(null);
              setProjectId(null);
              await loadWorkspaceData(ws, null);
              notify(`สร้าง Workspace "${ws.name}" แล้ว`);
            }}
            onRenameWorkspace={async (id, name) => {
              const scope = accountScopeRef.current;
              assertMatchingAccountUid(scope, getCurrentFirebaseUid(), 'เปลี่ยนชื่อ Workspace');
              const updated = await renameWorkspace(id, name);
              if (updated && updated.id === activeWorkspace.id) {
                setActiveWorkspace(updated);
              }
              setWorkspaces(await listWorkspaces(scope));
              notify('เปลี่ยนชื่อ Workspace แล้ว');
            }}
            onDeleteWorkspace={async (id) => {
              try {
                const scope = accountScopeRef.current;
                assertMatchingAccountUid(scope, getCurrentFirebaseUid(), 'ลบ Workspace');
                await deleteWorkspace(id, scope);
                const list = await listWorkspaces(scope);
                setWorkspaces(list);
                if (id === activeWorkspace.id) {
                  await loadWorkspaceData(list[0], null);
                }
                notify('ลบ Workspace แล้ว');
              } catch (err) {
                notify(err instanceof Error ? err.message : 'ลบไม่สำเร็จ');
              }
            }}
            onSetPinLock={async (passphrase) => {
              const scope = accountScopeRef.current;
              assertMatchingAccountUid(scope, getCurrentFirebaseUid(), 'ตั้งรหัสผ่าน Workspace');
              const { workspace, cryptoKey } = await enableWorkspacePassphrase(
                activeWorkspace.id,
                passphrase,
                secrets
              );
              setActiveWorkspace(workspace);
              setUnlockedKey(cryptoKey);
              setWorkspaces(await listWorkspaces(scope));
              notify('เปิดใช้รหัสผ่าน AES-GCM สำหรับ Workspace นี้แล้ว');
            }}
            onUnlockWithPin={async (passphrase) => {
              const res = await unlockWorkspace(activeWorkspace, passphrase);
              if (!res) return false;
              setUnlockedKey(res.cryptoKey);
              setSecrets(res.secrets);
              notify('ปลดล็อก Workspace สำเร็จ');
              return true;
            }}
            onRemovePinLock={async (currentPassphrase) => {
              const scope = accountScopeRef.current;
              assertMatchingAccountUid(scope, getCurrentFirebaseUid(), 'ถอดรหัสผ่าน Workspace');
              if (isLocked) {
                const res = await unlockWorkspace(activeWorkspace, currentPassphrase);
                if (!res) return false;
                const updated = await removeWorkspacePassphrase(activeWorkspace.id, res.secrets);
                if (updated) setActiveWorkspace(updated);
                setSecrets(res.secrets);
              } else {
                const ok = await unlockWorkspace(activeWorkspace, currentPassphrase);
                if (!ok) return false;
                const updated = await removeWorkspacePassphrase(activeWorkspace.id, secrets);
                if (updated) setActiveWorkspace(updated);
              }
              setUnlockedKey(null);
              setWorkspaces(await listWorkspaces(scope));
              notify('ถอดรหัสผ่าน Workspace แล้ว');
              return true;
            }}
            onRequestPersist={async () => {
              const ok = await requestPersistentStorage();
              await refreshWorkspaceLists(activeWorkspace.id);
              notify(ok ? 'เปิดสิทธิ์พื้นที่เก็บข้อมูลถาวรแล้ว' : 'เบราว์เซอร์ไม่อนุญาตหรือยังไม่รองรับ');
            }}
            onExportWorkspaceBackup={async () => {
              const { blob, filename, projectCount } = await exportWorkspaceBackupBlob(
                activeWorkspace.id
              );
              triggerDownload(blob, filename);
              notify(`ส่งออก Backup ${projectCount} โปรเจกต์ของ Workspace นี้แล้ว`);
            }}
            onImportWorkspaceBackup={async (file) => {
              try {
                assertMatchingAccountUid(accountScopeRef.current, getCurrentFirebaseUid(), 'นำเข้า Backup');
                const { importedProjects, importedAudio } = await importWorkspaceBackupFile(
                  activeWorkspace.id,
                  file
                );
                await loadWorkspaceData(activeWorkspace, unlockedKey);
                notify(`นำเข้า ${importedProjects} โปรเจกต์ และ ${importedAudio} เสียงพากย์สำเร็จ`);
              } catch (err) {
                notify(err instanceof Error ? err.message : 'นำเข้า Backup ไม่สำเร็จ');
              }
            }}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            key={`${activeWorkspace.id}:${authProfile?.uid || 'guest'}:${isLocked ? 'locked' : 'open'}`}
            workspaceName={activeWorkspace.name}
            hasPinLock={activeWorkspace.hasPassphrase}
            isLocked={isLocked}
            settings={settings}
            secrets={secrets}
            onUpdateSettings={handleUpdateSettings}
            onSaveSecrets={async (nextSecrets) => {
              assertMatchingAccountUid(accountScopeRef.current, getCurrentFirebaseUid(), 'บันทึก API Key');
              const updated = await saveWorkspaceSecrets(
                activeWorkspace.id,
                nextSecrets,
                unlockedKey
              );
              setSecrets(nextSecrets);
              if (updated) setActiveWorkspace(updated);
            }}
            onGoStorage={() => setActiveTab('storage')}
            onNotify={notify}
          />
        )}
      </main>

      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-16 md:bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/15 bg-[#1b1d29] px-4 py-2.5 text-sm font-medium text-white shadow-2xl"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
