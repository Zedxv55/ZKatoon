import {
  BookOpen,
  Compass,
  CreditCard,
  Film,
  FolderOpen,
  LayoutList,
  LogIn,
  LogOut,
  Settings,
  Shield,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OfflineIndicator } from './components/OfflineIndicator';
import { AdminDashboard } from './components/platform/AdminDashboard';
import { AuthModal } from './components/platform/AuthModal';
import { BillingModal } from './components/platform/BillingModal';
import { CmsPagesModal } from './components/platform/CmsPagesModal';
import { MapStudioTab } from './components/platform/MapStudioTab';
import { OnboardingWizard } from './components/platform/OnboardingWizard';
import { SplashScreen } from './components/platform/SplashScreen';
import { WorkflowEditorTab } from './components/platform/WorkflowEditorTab';
import { AudioExportTab } from './components/studio/AudioExportTab';
import { CreateTab } from './components/studio/CreateTab';
import { ProjectsTab } from './components/studio/ProjectsTab';
import { ScenesTab } from './components/studio/ScenesTab';
import { SettingsTab } from './components/studio/SettingsTab';
import { StudioPlayer } from './components/studio/StudioPlayer';
import type { OnboardingDefaults } from './types/platform';
import type {
  AppConfig,
  OpenRouterModel,
  StudioProject,
  UserAudioAsset,
} from './types/studio';
import { clearBackgroundCache } from './utils/drawBackgrounds';
import { synthesizeSceneCadenceWav } from './utils/demoAudio';
import {
  getCurrentFirebaseAuthInfo,
  signOutFirebase,
  subscribeFirebaseAuth,
  testFirestoreServerConnection,
} from './utils/firebaseClient';
import { platformApi, type PlatformBootstrapResponse } from './utils/platformApi';
import { buildStudioAudioGraph, mergePerSceneVoiceBlobs } from './utils/studioAudio';
import type { StudioAudioGraphHandle } from './utils/studioAudio';
import { BUILT_IN_DEMOS, DEMO_PROJECT_A } from './utils/studioData';
import {
  deleteAudioAsset,
  deleteStoredProject,
  listAudioAssets,
  listStoredProjects,
  loadAppConfig,
  saveAppConfig,
  saveAudioAsset,
  saveStoredProject,
} from './utils/studioStore';
import { analyzeAudioEnvelope, buildStudioTimeline } from './utils/timelineSync';
import type { PauseCandidate } from './utils/timelineSync';

type StudioTabId = 'projects' | 'create' | 'scenes' | 'workflow' | 'map' | 'audio' | 'settings';

export function App() {
  const [activeTab, setActiveTab] = useState<StudioTabId>('projects');
  const [config, setConfig] = useState<AppConfig>(() => loadAppConfig());
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [savedProjects, setSavedProjects] = useState<StudioProject[]>([]);
  const [assets, setAssets] = useState<UserAudioAsset[]>([]);

  // Platform SaaS State (Splash, Onboarding, Auth, Credits, Pages, Admin)
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showPagesModal, setShowPagesModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [platformData, setPlatformData] = useState<PlatformBootstrapResponse | null>(null);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authVerified, setAuthVerified] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Undo/Redo project state (up to 60 steps)
  const [history, setHistory] = useState<{ past: StudioProject[]; present: StudioProject; future: StudioProject[] }>({
    past: [],
    present: DEMO_PROJECT_A,
    future: [],
  });
  const project = history.present;
  const episode = project.episodes[0];

  // Audio decode & playback state
  const audioCtxRef = useRef<AudioContext | null>(null);
  const graphRef = useRef<StudioAudioGraphHandle | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const playRafRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [voiceBuffer, setVoiceBuffer] = useState<AudioBuffer | null>(null);
  const [envelope, setEnvelope] = useState<number[]>([]);
  const [speechStartSec, setSpeechStartSec] = useState(0);
  const [speechEndSec, setSpeechEndSec] = useState<number | undefined>(undefined);
  const [pauseCandidates, setPauseCandidates] = useState<PauseCandidate[]>([]);
  const [perSceneDurations, setPerSceneDurations] = useState<Record<string, number>>({});
  const [perSceneAssetIds, setPerSceneAssetIds] = useState<Set<string>>(new Set());
  const [sfxBuffers, setSfxBuffers] = useState<Record<string, AudioBuffer>>({});

  const ensureAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AC();
    }
    return audioCtxRef.current;
  }, []);

  const stopPlayback = useCallback(() => {
    if (playRafRef.current !== null) {
      cancelAnimationFrame(playRafRef.current);
      playRafRef.current = null;
    }
    if (graphRef.current) {
      graphRef.current.stop();
      graphRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const refreshPlatformBootstrap = useCallback(async () => {
    try {
      const info = getCurrentFirebaseAuthInfo();
      setAuthEmail(info.email);
      setAuthVerified(info.emailVerified);
      const data = await platformApi.bootstrap();
      setPlatformData(data);
    } catch {
      // keep studio running offline even if backend bootstrap unreachable
    }
  }, []);

  // Load initial IndexedDB projects & assets + Firebase Auth & Platform bootstrap
  useEffect(() => {
    void Promise.all([listStoredProjects(), listAudioAssets()]).then(([projs, loadedAssets]) => {
      setSavedProjects(projs);
      setAssets(loadedAssets);
    });
    void testFirestoreServerConnection();
    void refreshPlatformBootstrap();

    const onboardingSeen = typeof window !== 'undefined' && localStorage.getItem('zkatoon_onboarding_done');
    if (!onboardingSeen) {
      setShowOnboarding(true);
    }

    const unsub = subscribeFirebaseAuth(() => {
      void refreshPlatformBootstrap();
    });
    return () => unsub();
  }, [refreshPlatformBootstrap]);

  // Decode project audio assets OR synthesize clean deterministic demo cadence voiceover
  useEffect(() => {
    let cancelled = false;
    const isDemo = BUILT_IN_DEMOS.some((d) => d.id === project.id);

    const runDecode = async () => {
      const ctx = ensureAudioCtx();
      const sfxDecoded: Record<string, AudioBuffer> = {};
      for (const a of assets.filter((x) => x.kind === 'user_sfx')) {
        try {
          const ab = await a.blob.arrayBuffer();
          sfxDecoded[a.id] = await ctx.decodeAudioData(ab.slice(0));
        } catch {
          // skip corrupt sfx
        }
      }
      if (!cancelled) setSfxBuffers(sfxDecoded);

      // Check per-scene audio blobs first
      const blobsByScene: Record<string, Blob> = {};
      const sceneHasRealAudio = new Set<string>();
      for (const sc of episode.scenes) {
        if (sc.audio?.assetId) {
          const found = assets.find((a) => a.id === sc.audio?.assetId);
          if (found) {
            blobsByScene[sc.id] = found.blob;
            sceneHasRealAudio.add(sc.id);
          }
        }
      }

      if (sceneHasRealAudio.size > 0) {
        const merged = await mergePerSceneVoiceBlobs(ctx, episode.scenes, blobsByScene, 0.35);
        if (!cancelled) {
          setVoiceBuffer(merged.voiceBuffer);
          setEnvelope(merged.envelope);
          setPauseCandidates(merged.pauseCandidates);
          setPerSceneDurations(merged.perSceneDurations);
          setPerSceneAssetIds(sceneHasRealAudio);
          setSpeechStartSec(0);
          setSpeechEndSec(undefined);
        }
        return;
      }

      // Check master uploaded audio for this project
      const masterAsset = assets.find(
        (a) => a.kind === 'master_audio' && a.id === `${project.id}_master`
      );
      if (masterAsset) {
        try {
          const ab = await masterAsset.blob.arrayBuffer();
          const buf = await ctx.decodeAudioData(ab.slice(0));
          const env = analyzeAudioEnvelope(buf.getChannelData(0), buf.sampleRate);
          if (!cancelled) {
            setVoiceBuffer(buf);
            setEnvelope(env.envelope);
            setPauseCandidates(env.pauseCandidates);
            setSpeechStartSec(env.speechStartSec);
            setSpeechEndSec(env.speechEndSec);
            setPerSceneDurations({});
            setPerSceneAssetIds(new Set());
          }
          return;
        } catch {
          // fallback
        }
      }

      // Built-in demo synthetic voiceover cadence so Demo plays real audio immediately
      if (isDemo) {
        const synthBlobs: Record<string, Blob> = {};
        for (const sc of episode.scenes) {
          synthBlobs[sc.id] = synthesizeSceneCadenceWav(sc).blob;
        }
        const merged = await mergePerSceneVoiceBlobs(ctx, episode.scenes, synthBlobs, 0.35);
        if (!cancelled) {
          setVoiceBuffer(merged.voiceBuffer);
          setEnvelope(merged.envelope);
          setPauseCandidates(merged.pauseCandidates);
          setPerSceneDurations(merged.perSceneDurations);
          setPerSceneAssetIds(new Set());
          setSpeechStartSec(0);
          setSpeechEndSec(undefined);
        }
        return;
      }

      if (!cancelled) {
        setVoiceBuffer(null);
        setEnvelope([]);
        setPauseCandidates([]);
        setPerSceneDurations({});
        setPerSceneAssetIds(new Set());
        setSpeechStartSec(0);
        setSpeechEndSec(undefined);
      }
    };

    void runDecode();
    return () => {
      cancelled = true;
    };
  }, [project.id, episode.scenes, assets, ensureAudioCtx]);

  const timelineBuilt = useMemo(
    () =>
      buildStudioTimeline(episode.scenes, {
        masterAudioDurationSec: voiceBuffer?.duration,
        speechStartSec,
        speechEndSec,
        pauseCandidates,
        perSceneDurations: Object.keys(perSceneDurations).length > 0 ? perSceneDurations : undefined,
      }),
    [episode.scenes, voiceBuffer, speechStartSec, speechEndSec, pauseCandidates, perSceneDurations]
  );

  const activeSceneId = useMemo(() => {
    const segs = timelineBuilt.segments;
    if (segs.length === 0) return null;
    if (currentTime < segs[0].startSec) return segs[0].scene.id;
    const seg =
      segs.find((s) => currentTime >= s.startSec && currentTime < s.endSec) ||
      segs[segs.length - 1];
    return seg.scene.id;
  }, [timelineBuilt, currentTime]);

  const commitProject = useCallback(
    (next: StudioProject, recordUndo = true) => {
      setHistory((prev) => ({
        past: recordUndo ? [...prev.past.slice(-59), prev.present] : prev.past,
        present: { ...next, updatedAt: Date.now() },
        future: [],
      }));
      if (!BUILT_IN_DEMOS.some((d) => d.id === next.id)) {
        void saveStoredProject(next).then(() => listStoredProjects().then(setSavedProjects));
      }
    },
    []
  );

  const handleLoadProject = useCallback(
    (proj: StudioProject) => {
      stopPlayback();
      clearBackgroundCache();
      setCurrentTime(0);
      setHistory({ past: [], present: proj, future: [] });
    },
    [stopPlayback]
  );

  const handleUndo = useCallback(() => {
    stopPlayback();
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future.slice(0, 59)],
      };
    });
  }, [stopPlayback]);

  const handleRedo = useCallback(() => {
    stopPlayback();
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      return {
        past: [...prev.past.slice(-59), prev.present],
        present: next,
        future: prev.future.slice(1),
      };
    });
  }, [stopPlayback]);

  const handleTogglePlay = useCallback(async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    const ctx = ensureAudioCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    const startOffset = currentTime >= timelineBuilt.totalDuration - 0.15 ? 0 : currentTime;
    if (startOffset === 0) setCurrentTime(0);

    const masterGain = masterGainRef.current || ctx.createGain();
    masterGain.gain.value = isMuted ? 0 : 1;
    masterGain.connect(ctx.destination);
    masterGainRef.current = masterGain;

    const graph = buildStudioAudioGraph(ctx, masterGain, startOffset, {
      episode,
      timeline: timelineBuilt.segments,
      totalDuration: timelineBuilt.totalDuration,
      voiceBuffer,
      speechStartSec: timelineBuilt.speechStartSec,
      leadSec: timelineBuilt.leadSec,
      envelope,
      pauseCandidates,
      sfxBuffers,
      enableBgmAndSfx: true,
      baseCtxTime: ctx.currentTime + 0.03,
    });
    graphRef.current = graph;
    setIsPlaying(true);

    const startWall = performance.now();
    const tick = () => {
      const nextT = startOffset + (performance.now() - startWall) / 1000;
      if (nextT >= timelineBuilt.totalDuration) {
        setCurrentTime(timelineBuilt.totalDuration);
        stopPlayback();
        return;
      }
      setCurrentTime(nextT);
      graph.schedulerTick(nextT);
      playRafRef.current = requestAnimationFrame(tick);
    };
    playRafRef.current = requestAnimationFrame(tick);
  }, [
    isPlaying,
    stopPlayback,
    ensureAudioCtx,
    currentTime,
    timelineBuilt,
    isMuted,
    episode,
    voiceBuffer,
    envelope,
    pauseCandidates,
    sfxBuffers,
  ]);

  const handleSeek = useCallback(
    (t: number) => {
      stopPlayback();
      setCurrentTime(Math.max(0, Math.min(timelineBuilt.totalDuration, t)));
    },
    [stopPlayback, timelineBuilt.totalDuration]
  );

  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (masterGainRef.current) masterGainRef.current.gain.value = next ? 0 : 1;
      return next;
    });
  }, []);

  const handleUpdateConfig = useCallback((next: AppConfig) => {
    setConfig(next);
    saveAppConfig(next);
  }, []);

  const handleSaveSceneAudioBlob = async (sceneId: string, blob: Blob, sourceText: string) => {
    const assetId = `${project.id}_${sceneId}_voice`;
    const ctx = ensureAudioCtx();
    let dur = 2.5;
    try {
      const dec = await ctx.decodeAudioData((await blob.arrayBuffer()).slice(0));
      dur = dec.duration;
    } catch {
      // fallback duration
    }
    const asset: UserAudioAsset = {
      id: assetId,
      name: `เสียงฉาก ${sceneId}`,
      kind: 'scene_audio',
      tags: [sceneId],
      mimeType: blob.type || 'audio/mpeg',
      blob,
      durationSec: dur,
      createdAt: Date.now(),
    };
    await saveAudioAsset(asset);
    setAssets(await listAudioAssets());
    commitProject({
      ...project,
      episodes: project.episodes.map((ep) =>
        ep.id === episode.id
          ? {
              ...ep,
              scenes: ep.scenes.map((s) =>
                s.id === sceneId ? { ...s, audio: { assetId, durationSec: dur, stale: false, sourceText } } : s
              ),
            }
          : ep
      ),
    });
  };

  const handleUploadMasterAudioFile = async (file: File) => {
    const assetId = `${project.id}_master`;
    const asset: UserAudioAsset = {
      id: assetId,
      name: file.name,
      kind: 'master_audio',
      tags: ['master'],
      mimeType: file.type || 'audio/mpeg',
      blob: file,
      durationSec: 0,
      createdAt: Date.now(),
    };
    await saveAudioAsset(asset);
    setAssets(await listAudioAssets());
  };

  const handleImportSfxFile = async (file: File) => {
    const asset: UserAudioAsset = {
      id: `sfx_${Date.now()}`,
      name: file.name,
      kind: 'user_sfx',
      tags: ['custom'],
      mimeType: file.type || 'audio/mpeg',
      blob: file,
      durationSec: 1,
      createdAt: Date.now(),
    };
    await saveAudioAsset(asset);
    setAssets(await listAudioAssets());
  };

  const tabs: Array<{ id: StudioTabId; label: string; icon: typeof FolderOpen }> = [
    { id: 'projects', label: 'โปรเจกต์', icon: FolderOpen },
    { id: 'create', label: 'สร้าง', icon: Sparkles },
    { id: 'scenes', label: 'ฉาก', icon: LayoutList },
    { id: 'workflow', label: 'โหนด', icon: Workflow },
    { id: 'map', label: 'แผนที่', icon: Compass },
    { id: 'audio', label: 'ส่งออก', icon: Film },
    { id: 'settings', label: 'ตั้งค่า', icon: Settings },
  ];

  const handleSaveOnboarding = async (defaults: OnboardingDefaults) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('zkatoon_onboarding_done', '1');
      localStorage.setItem('zkatoon_onboarding_defaults', JSON.stringify(defaults));
    }
    if (platformData?.authenticated) {
      await platformApi.saveOnboarding(defaults).catch(() => {});
      await refreshPlatformBootstrap();
    }
    commitProject({
      ...project,
      layout: defaults.aspect === '16:9' ? 'landscape' : 'portrait_full',
      animateStyle: defaults.style,
    });
    setShowOnboarding(false);
    setToastMsg('บันทึกค่าเริ่มต้นเรียบร้อยแล้ว');
  };

  const isSignedIn = Boolean(platformData?.authenticated);
  const isSuperAdmin = platformData?.user?.role === 'super_admin';

  return (
    <div className="min-h-dvh flex flex-col bg-[#0a0b10] text-[#f3f2fa] safe-top">
      {showSplash && (
        <SplashScreen
          brandName={platformData?.settings?.websiteName || 'ZKatoon AI Video Studio'}
          tagline={platformData?.settings?.tagline || 'Create Your Story with AI'}
          durationMs={platformData?.settings?.splashDurationMs || 650}
          onDone={() => setShowSplash(false)}
        />
      )}

      <OfflineIndicator />

      {/* Compact 3-Zone Top Platform Bar */}
      <header className="border-b border-white/10 bg-[#0d0e15] px-3 py-2">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 border border-amber-400/35">
              <Film className="h-4 w-4 text-amber-300" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-extrabold text-white sm:text-sm">
                <span className="sm:hidden">ZKatoon</span>
                <span className="hidden sm:inline">
                  {platformData?.settings?.websiteName || 'ZKatoon AI Video Studio'}
                </span>
              </div>
              <div className="hidden truncate text-[10px] text-[#9894b8] sm:block">
                {platformData?.settings?.tagline || 'Create Your Story with AI'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowPagesModal(true)}
              aria-label="คู่มือและราคา"
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 sm:px-2.5 text-[11px] font-bold text-white/85 hover:bg-white/10 whitespace-nowrap cursor-pointer"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-300" />
              <span className="hidden sm:inline">คู่มือ/ราคา</span>
            </button>

            <button
              type="button"
              onClick={() => setShowBillingModal(true)}
              data-testid="open-billing-btn"
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 text-[11px] font-bold text-amber-200 hover:bg-amber-400/20 whitespace-nowrap cursor-pointer"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span className="font-mono-tabular">
                {isSignedIn && platformData?.wallet
                  ? `${platformData.wallet.balance.toLocaleString()} cr`
                  : 'Studio Pass'}
              </span>
            </button>

            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                data-testid="open-admin-btn"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-violet-500 px-2.5 text-[11px] font-extrabold text-white hover:bg-violet-400 whitespace-nowrap cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>Admin</span>
              </button>
            )}

            {isSignedIn ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="inline-flex min-h-[36px] max-w-[130px] items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 text-[11px] font-bold text-white truncate whitespace-nowrap cursor-pointer"
                >
                  <span className="truncate">{platformData?.user?.displayName || authEmail}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void signOutFirebase().then(() => refreshPlatformBootstrap())}
                  aria-label="ออกจากระบบ"
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                data-testid="open-auth-btn"
                className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-amber-400 px-3 text-[11px] font-extrabold text-slate-950 hover:bg-amber-300 whitespace-nowrap cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>เข้าสู่ระบบ</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {toastMsg && (
        <div className="mx-auto mt-2 flex max-w-4xl items-center justify-between gap-3 rounded-xl border border-emerald-400/35 bg-emerald-950/70 px-3.5 py-2 text-xs text-emerald-100">
          <span>{toastMsg}</span>
          <button type="button" onClick={() => setToastMsg(null)} className="font-bold underline cursor-pointer">
            ปิด
          </button>
        </div>
      )}

      <StudioPlayer
        project={project}
        episode={episode}
        timeline={timelineBuilt.segments}
        totalDuration={timelineBuilt.totalDuration}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isMuted={isMuted}
        envelope={envelope}
        leadSec={timelineBuilt.leadSec}
        speechStartSec={timelineBuilt.speechStartSec}
        pauseCandidates={pauseCandidates}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        activeSceneId={activeSceneId}
        onTogglePlay={() => void handleTogglePlay()}
        onSeek={handleSeek}
        onToggleMute={handleToggleMute}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <main className="mx-auto w-full max-w-5xl flex-1">
        {activeTab === 'projects' && (
          <ProjectsTab
            activeProject={project}
            savedProjects={savedProjects}
            assets={assets}
            onLoadProject={handleLoadProject}
            onCreateBlank={() => {
              const blank: StudioProject = {
                ...DEMO_PROJECT_A,
                id: `proj_${Date.now()}`,
                title: 'โปรเจกต์ใหม่ของฉัน',
                episodes: [
                  {
                    ...DEMO_PROJECT_A.episodes[0],
                    id: `ep_${Date.now()}`,
                    scenes: [DEMO_PROJECT_A.episodes[0].scenes[0]],
                  },
                ],
                updatedAt: Date.now(),
              };
              commitProject(blank);
              setActiveTab('scenes');
            }}
            onDeleteProject={(id) =>
              void deleteStoredProject(id).then(() => listStoredProjects().then(setSavedProjects))
            }
            onImportZipBundle={async (importedProj, importedAssets) => {
              for (const a of importedAssets) {
                await saveAudioAsset(a);
              }
              await saveStoredProject(importedProj);
              setAssets(await listAudioAssets());
              setSavedProjects(await listStoredProjects());
              handleLoadProject(importedProj);
            }}
            onGoToCreateTab={() => setActiveTab('create')}
          />
        )}

        {activeTab === 'create' && (
          <CreateTab
            config={config}
            models={models}
            savedProjects={savedProjects}
            onProjectCreated={(created) => {
              commitProject(created);
              setCurrentTime(0);
              setActiveTab('scenes');
            }}
            onGoToSettings={() => setActiveTab('settings')}
          />
        )}

        {activeTab === 'scenes' && (
          <ScenesTab
            project={project}
            episode={episode}
            activeSceneId={activeSceneId}
            config={config}
            onJumpToScene={(sid) => {
              const seg = timelineBuilt.segments.find((s) => s.scene.id === sid);
              if (seg) handleSeek(seg.startSec + 0.05);
            }}
            onUpdateProject={(next) => commitProject(next)}
          />
        )}

        {activeTab === 'workflow' && (
          <WorkflowEditorTab
            activeProject={project}
            config={config}
            isSignedIn={isSignedIn}
            onApplyProjectToStudio={(nextProj) => {
              commitProject(nextProj);
              setToastMsg('อัปเดตผลลัพธ์ Workflow เข้าสู่ตัวเล่นสตูดิโอแล้ว');
            }}
            onNotify={(m) => setToastMsg(m)}
          />
        )}

        {activeTab === 'map' && (
          <MapStudioTab
            activeProject={project}
            tileStyleUrl={platformData?.settings?.mapTileStyleUrl}
            attributionText={platformData?.settings?.mapAttribution}
            onInjectMapScene={(nextProj) => {
              commitProject(nextProj);
              setActiveTab('scenes');
              setToastMsg('เพิ่มฉากแผนที่ MapLibre เข้าสู่โปรเจกต์เรียบร้อยแล้ว');
            }}
          />
        )}

        {activeTab === 'audio' && (
          <AudioExportTab
            project={project}
            episode={episode}
            timeline={timelineBuilt.segments}
            totalDuration={timelineBuilt.totalDuration}
            config={config}
            voiceBuffer={voiceBuffer}
            speechStartSec={timelineBuilt.speechStartSec}
            leadSec={timelineBuilt.leadSec}
            envelope={envelope}
            pauseCandidates={pauseCandidates}
            syncDiagnostics={timelineBuilt.diagnostics}
            assets={assets}
            perSceneAssetIds={perSceneAssetIds}
            sfxBuffers={sfxBuffers}
            isSignedIn={isSignedIn}
            userTier={platformData?.user?.tier || 'free'}
            onUpdateConfig={handleUpdateConfig}
            onUpdateProject={(next) => commitProject(next)}
            onSaveSceneAudioBlob={handleSaveSceneAudioBlob}
            onUploadMasterAudioFile={handleUploadMasterAudioFile}
            onImportSfxFile={handleImportSfxFile}
            onDeleteAsset={async (aid) => {
              await deleteAudioAsset(aid);
              setAssets(await listAudioAssets());
            }}
            onOpenAuth={() => setShowAuthModal(true)}
            onOpenBilling={() => setShowBillingModal(true)}
            onRefreshPlatform={refreshPlatformBootstrap}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            config={config}
            project={project}
            models={models}
            byokList={platformData?.byok}
            registryModels={platformData?.models}
            isSignedIn={isSignedIn}
            onUpdateConfig={handleUpdateConfig}
            onUpdateProject={(next) => commitProject(next)}
            onModelsLoaded={setModels}
            onRefreshPlatform={refreshPlatformBootstrap}
            onOpenOnboarding={() => setShowOnboarding(true)}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        )}
      </main>

      {/* Modals */}
      {showOnboarding && (
        <OnboardingWizard
          initial={platformData?.user?.onboarding}
          onComplete={handleSaveOnboarding}
          onClose={() => {
            if (typeof window !== 'undefined') {
              localStorage.setItem('zkatoon_onboarding_done', '1');
            }
            setShowOnboarding(false);
          }}
        />
      )}

      {showAuthModal && (
        <AuthModal
          currentEmail={authEmail || platformData?.user?.email}
          emailVerified={authVerified || platformData?.user?.emailVerified}
          isSignedIn={isSignedIn}
          onAuthChanged={refreshPlatformBootstrap}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {showBillingModal && (
        <BillingModal
          user={platformData?.user || null}
          wallet={platformData?.wallet || null}
          payments={platformData?.payments || []}
          ledger={platformData?.creditLedger || []}
          settings={platformData?.settings || {}}
          onRefresh={refreshPlatformBootstrap}
          onRequireLogin={() => {
            setShowBillingModal(false);
            setShowAuthModal(true);
          }}
          onClose={() => setShowBillingModal(false)}
        />
      )}

      {showPagesModal && (
        <CmsPagesModal
          pages={platformData?.pages || []}
          onActionCreate={() => setActiveTab('create')}
          onClose={() => setShowPagesModal(false)}
        />
      )}

      {showAdminModal && isSuperAdmin && (
        <AdminDashboard
          onClose={() => setShowAdminModal(false)}
          onBootstrapRefresh={refreshPlatformBootstrap}
        />
      )}

      {/* Fixed Bottom Navigation (7 Tabs >= 56px + safe-area) */}
      <nav
        aria-label="เมนูหลักสตูดิโอ"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0d0e15]/95 backdrop-blur-md safe-bottom"
      >
        <div className="mx-auto grid max-w-5xl grid-cols-7">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-[58px] flex-col items-center justify-center gap-1 px-1 text-[10px] sm:text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
                  active ? 'text-amber-300' : 'text-[#9894b8] hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
