import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  Film,
  Loader2,
  Mic,
  Music,
  Play,
  Share2,
  SlidersHorizontal,
  StopCircle,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { MemberTier, ServerRenderJob } from '../../types/platform';
import type {
  AppConfig,
  StudioEpisode,
  StudioProject,
  StudioTimelineSegment,
  TtsEngineId,
  UserAudioAsset,
} from '../../types/studio';
import { exportProjectMp4, getResumableOpfsExportInfo, runMp4Preflight } from '../../utils/mp4Exporter';
import type { Mp4PreflightReport, Mp4VerifiedPart } from '../../utils/mp4Exporter';
import { clearOpfsParts, readOpfsPartBlob } from '../../utils/opfsStorage';
import { platformApi } from '../../utils/platformApi';
import { exportStudioMp3 } from '../../utils/studioAudio';
import { runPerSceneTtsQueue, synthesizeSceneTts } from '../../utils/studioTts';
import type { PauseCandidate, TimelineSyncDiagnostics } from '../../utils/timelineSync';

interface AudioExportTabProps {
  project: StudioProject;
  episode: StudioEpisode;
  timeline: StudioTimelineSegment[];
  totalDuration: number;
  config: AppConfig;
  voiceBuffer: AudioBuffer | null;
  speechStartSec: number;
  leadSec: number;
  envelope: number[];
  pauseCandidates: PauseCandidate[];
  syncDiagnostics: TimelineSyncDiagnostics;
  assets: UserAudioAsset[];
  perSceneAssetIds: Set<string>;
  sfxBuffers: Record<string, AudioBuffer>;
  isSignedIn?: boolean;
  userTier?: MemberTier;
  onUpdateConfig: (next: AppConfig) => void;
  onUpdateProject: (next: StudioProject) => void;
  onSaveSceneAudioBlob: (sceneId: string, blob: Blob, sourceText: string) => Promise<void>;
  onUploadMasterAudioFile: (file: File) => Promise<void>;
  onImportSfxFile: (file: File) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
  onOpenAuth?: () => void;
  onOpenBilling?: () => void;
  onRefreshPlatform?: () => Promise<void>;
}

export function AudioExportTab(props: AudioExportTabProps) {
  const {
    project,
    episode,
    timeline,
    totalDuration,
    config,
    voiceBuffer,
    speechStartSec,
    leadSec,
    envelope,
    pauseCandidates,
    syncDiagnostics,
    assets,
    perSceneAssetIds,
    sfxBuffers,
    isSignedIn = false,
    userTier = 'free',
    onUpdateConfig,
    onUpdateProject,
    onSaveSceneAudioBlob,
    onUploadMasterAudioFile,
    onImportSfxFile,
    onDeleteAsset,
    onOpenAuth,
    onOpenBilling,
    onRefreshPlatform,
  } = props;

  const [voiceMode, setVoiceMode] = useState<'tts' | 'upload'>('tts');
  const [showOffsetPanel, setShowOffsetPanel] = useState(false);
  const [serverRes, setServerRes] = useState<'720p' | '1080p' | '1440p' | '4k'>('1080p');
  const [serverJobs, setServerJobs] = useState<ServerRenderJob[]>([]);
  const [serverBusy, setServerBusy] = useState(false);
  const [serverErr, setServerErr] = useState<string | null>(null);

  // TTS queue state
  const ttsAbortRef = useRef<AbortController | null>(null);
  const [ttsRunning, setTtsRunning] = useState(false);
  const [ttsProgress, setTtsProgress] = useState<{ done: number; total: number; currentSceneId: string; error?: string } | null>(null);
  const [ttsErrors, setTtsErrors] = useState<Array<{ sceneId: string; error: string }>>([]);
  const [ttsTestMsg, setTtsTestMsg] = useState<string | null>(null);

  // Freesound / SFX library state
  const [sfxSearch, setSfxSearch] = useState('whoosh');
  const [freesoundResults, setFreesoundResults] = useState<Array<{ id: number; name: string; previewUrl: string }>>([]);
  const [sfxStatus, setSfxStatus] = useState<string | null>(null);
  const sfxInputRef = useRef<HTMLInputElement | null>(null);
  const masterInputRef = useRef<HTMLInputElement | null>(null);

  // Export state
  const exportAbortRef = useRef<AbortController | null>(null);
  const [preflight, setPreflight] = useState<Mp4PreflightReport | null>(null);
  const [opfsResumeCount, setOpfsResumeCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProg, setExportProg] = useState<{ message: string; percent: number; partIndex: number; totalParts: number; etaSec?: number } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [verifiedParts, setVerifiedParts] = useState<Mp4VerifiedPart[]>([]);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [mp3Loading, setMp3Loading] = useState(false);

  useEffect(() => {
    void runMp4Preflight({
      layout: project.layout,
      resolution: project.settings.resolution,
      hasVoiceover: Boolean(voiceBuffer),
    }).then(setPreflight);
    void getResumableOpfsExportInfo(project.id).then((parts) => setOpfsResumeCount(parts.length));
  }, [project.id, project.layout, project.settings.resolution, voiceBuffer]);

  useEffect(() => {
    if (verifiedParts.length > 0) {
      const url = URL.createObjectURL(verifiedParts[0].blob);
      setPreviewVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewVideoUrl(null);
  }, [verifiedParts]);

  const handleTestTtsSentence = async () => {
    setTtsTestMsg('กำลังทดสอบสร้างเสียงประโยคสั้น...');
    try {
      const res = await synthesizeSceneTts('สวัสดีครับ นี่คือเสียงพากย์ตัวอย่างภาษาไทย', config);
      const url = URL.createObjectURL(res.blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
      setTtsTestMsg('เล่นเสียงทดสอบสำเร็จ!');
    } catch (err) {
      setTtsTestMsg(err instanceof Error ? err.message : 'ทดสอบเสียงไม่สำเร็จ');
    }
  };

  const handleRunTtsQueue = async (skipExisting: boolean) => {
    setTtsRunning(true);
    setTtsErrors([]);
    const ac = new AbortController();
    ttsAbortRef.current = ac;
    try {
      const res = await runPerSceneTtsQueue({
        scenes: episode.scenes,
        config,
        existingSceneIds: perSceneAssetIds,
        skipExisting,
        signal: ac.signal,
        onSceneSuccess: onSaveSceneAudioBlob,
        onProgress: setTtsProgress,
      });
      setTtsErrors(res.failed);
    } finally {
      setTtsRunning(false);
      ttsAbortRef.current = null;
    }
  };

  const handleSearchFreesound = async () => {
    if (!config.freesoundKey.trim()) {
      setSfxStatus('ยังไม่ได้ใส่ Freesound API Key (ใส่ได้ที่แท็บตั้งค่า หรือใช้ปุ่มค้นหา Myinstants ด้านล่าง)');
      return;
    }
    setSfxStatus('กำลังค้นหา Freesound...');
    try {
      const url = `https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(sfxSearch)}&fields=id,name,previews&page_size=6&token=${encodeURIComponent(config.freesoundKey.trim())}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Freesound HTTP ${res.status}`);
      const json = (await res.json()) as {
        results?: Array<{ id: number; name: string; previews?: { 'preview-hq-mp3'?: string } }>;
      };
      const items = (json.results || [])
        .map((r) => ({ id: r.id, name: r.name, previewUrl: r.previews?.['preview-hq-mp3'] || '' }))
        .filter((r) => r.previewUrl);
      setFreesoundResults(items);
      setSfxStatus(`พบ ${items.length} เสียงจาก Freesound`);
    } catch (err) {
      setSfxStatus(err instanceof Error ? err.message : 'ค้นหา Freesound ไม่สำเร็จ');
    }
  };

  const handleStartMp4Export = async (resumeFromPart = 0) => {
    setExportError(null);
    setExporting(true);
    setVerifiedParts([]);
    const ac = new AbortController();
    exportAbortRef.current = ac;
    try {
      const parts = await exportProjectMp4({
        project,
        episode,
        timeline,
        totalDuration,
        voiceBuffer,
        speechStartSec,
        leadSec,
        envelope,
        pauseCandidates,
        sfxBuffers,
        partMinutes: config.partMinutes,
        resumeFromPart,
        signal: ac.signal,
        onProgress: setExportProg,
      });
      setVerifiedParts(parts);
      setOpfsResumeCount(0);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'ส่งออก MP4 ไม่สำเร็จ');
    } finally {
      setExporting(false);
      exportAbortRef.current = null;
    }
  };

  const handleDownloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleShareBlob = async (blob: Blob, filename: string) => {
    const file = new File([blob], filename, { type: 'video/mp4' });
    const nav = navigator as unknown as {
      canShare?: (d: { files?: File[] }) => boolean;
      share?: (d: { files?: File[]; title?: string }) => Promise<void>;
    };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: project.title });
        return;
      } catch {
        // fallback to download
      }
    }
    handleDownloadBlob(blob, filename);
  };

  const handleDownloadMp3 = async () => {
    setMp3Loading(true);
    try {
      const mp3Blob = await exportStudioMp3({
        episode,
        timeline,
        totalDuration,
        voiceBuffer,
        speechStartSec,
        leadSec,
        envelope,
        pauseCandidates,
        sfxBuffers,
        enableBgmAndSfx: true,
      });
      handleDownloadBlob(mp3Blob, `${project.title.replace(/[^\wก-๙]+/g, '_') || 'audio'}.mp3`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'สร้างไฟล์ MP3 ไม่สำเร็จ');
    } finally {
      setMp3Loading(false);
    }
  };

  const userSfxAssets = assets.filter((a) => a.kind === 'user_sfx');

  return (
    <div className="space-y-5 p-4 pb-28">
      <div>
        <h2 className="text-lg font-bold text-white">เสียงพากย์ & ส่งออก MP4</h2>
        <p className="text-xs text-[#9894b8]">เลือกวิธีใส่เสียงพากย์ จากนั้นเรนเดอร์เป็น MP4 (H.264+AAC) หรือ MP3 ได้ทันที</p>
      </div>

      {/* Mode Selector: TTS Queue vs Master Audio Upload */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#13141d] p-1.5">
        <button
          type="button"
          onClick={() => setVoiceMode('tts')}
          className={`min-h-[46px] rounded-xl text-xs font-bold cursor-pointer ${
            voiceMode === 'tts' ? 'bg-amber-400 text-slate-950' : 'text-white/75'
          }`}
        >
          1) สร้างเสียงพากย์ AI (ทีละฉาก)
        </button>
        <button
          type="button"
          onClick={() => setVoiceMode('upload')}
          className={`min-h-[46px] rounded-xl text-xs font-bold cursor-pointer ${
            voiceMode === 'upload' ? 'bg-amber-400 text-slate-950' : 'text-white/75'
          }`}
        >
          2) อัปโหลดไฟล์เสียงเดี่ยว
        </button>
      </div>

      {voiceMode === 'tts' ? (
        <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-bold text-white">
              <Mic className="h-4 w-4 text-amber-300" />
              ระบบพากย์ไทย ({config.ttsEngine})
            </span>
            <select
              value={config.ttsEngine}
              onChange={(e) => onUpdateConfig({ ...config, ttsEngine: e.target.value as TtsEngineId })}
              className="min-h-[40px] rounded-xl border border-white/15 bg-black/30 px-2.5 text-xs text-white"
            >
              <option value="elevenlabs">ElevenLabs</option>
              <option value="openai_compat">OpenAI / Custom TTS</option>
              <option value="google_cloud">Google Cloud TTS</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-[#9894b8]">
            <span>ความเร็ว: {config.ttsSpeed.toFixed(2)}x</span>
            <input
              type="range"
              min={0.7}
              max={1.3}
              step={0.05}
              value={config.ttsSpeed}
              onChange={(e) => onUpdateConfig({ ...config, ttsSpeed: parseFloat(e.target.value) })}
              className="studio-range flex-1"
            />
            <button
              type="button"
              onClick={() => void handleTestTtsSentence()}
              className="min-h-[38px] rounded-xl border border-white/15 bg-white/5 px-3 font-semibold text-white cursor-pointer"
            >
              ทดสอบ 1 ประโยค
            </button>
          </div>

          {ttsTestMsg && <div className="text-xs text-amber-200">{ttsTestMsg}</div>}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={ttsRunning}
              onClick={() => void handleRunTtsQueue(true)}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-amber-400 text-xs font-bold text-slate-950 disabled:opacity-45 cursor-pointer"
            >
              <Play className="h-4 w-4" />
              <span>สร้างเฉพาะฉากที่ยังไม่มี/บทแก้</span>
            </button>
            <button
              type="button"
              disabled={ttsRunning}
              onClick={() => void handleRunTtsQueue(false)}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white disabled:opacity-45 cursor-pointer"
            >
              <span>สร้างใหม่ทุกฉาก ({episode.scenes.length})</span>
            </button>
          </div>

          {ttsRunning && ttsProgress && (
            <div className="flex items-center justify-between rounded-xl bg-black/30 p-2.5 text-xs text-amber-200">
              <span>
                กำลังสร้างฉาก {ttsProgress.currentSceneId} ({ttsProgress.done}/{ttsProgress.total})
              </span>
              <button
                type="button"
                onClick={() => ttsAbortRef.current?.abort()}
                className="rounded-lg bg-rose-500/20 px-2.5 py-1 text-rose-200 font-bold cursor-pointer"
              >
                หยุด
              </button>
            </div>
          )}

          {ttsErrors.length > 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-2.5 text-xs text-rose-200 space-y-1">
              <div className="font-bold">ฉากที่สร้างเสียงไม่สำเร็จ ({ttsErrors.length}):</div>
              {ttsErrors.slice(0, 3).map((e) => (
                <div key={e.sceneId}>
                  • {e.sceneId}: {e.error}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-3">
          <div className="text-sm font-bold text-white">อัปโหลดไฟล์เสียงพากย์รวม (.mp3, .wav, .m4a)</div>
          <p className="text-xs text-[#9894b8]">
            ระบบจะวิเคราะห์คลื่นเสียงหาช่วงหยุดหายใจ (RMS ≥220ms) และซิงก์แบ่งเวลาให้ตรงกับทุกฉากโดยอัตโนมัติ
          </p>
          <button
            type="button"
            onClick={() => masterInputRef.current?.click()}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-violet-500 font-bold text-white text-sm cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            <span>เลือกไฟล์เสียงจากเครื่อง</span>
          </button>
          <input
            ref={masterInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUploadMasterAudioFile(f);
              e.target.value = '';
            }}
          />
          <div className="rounded-xl bg-black/30 p-3 text-xs text-[#c7c3e0] flex items-center justify-between">
            <span>สถานะซิงก์: {syncDiagnostics.mode}</span>
            <span>
              พบช่วงหยุด {syncDiagnostics.foundPauses} จุด • จับคู่ฉาก {syncDiagnostics.matchedBoundaries}/{syncDiagnostics.totalBoundaries}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowOffsetPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 cursor-pointer"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>{showOffsetPanel ? 'ซ่อนตัวขยับจังหวะเสียง' : 'ปรับชดเชยจังหวะฉาก (-0.1 / +0.1 วิ)'}</span>
          </button>

          {showOffsetPanel && (
            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {episode.scenes.map((sc, i) => (
                <div key={sc.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-1.5 text-xs">
                  <span className="truncate text-white/85">
                    #{i + 1} {sc.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = episode.scenes.map((s) =>
                          s.id === sc.id ? { ...s, syncOffset: Number(((s.syncOffset || 0) - 0.1).toFixed(2)) } : s
                        );
                        onUpdateProject({
                          ...project,
                          episodes: project.episodes.map((ep) => (ep.id === episode.id ? { ...ep, scenes: next } : ep)),
                        });
                      }}
                      className="rounded bg-white/10 px-2 py-1 font-bold text-white cursor-pointer"
                    >
                      -0.1 วิ
                    </button>
                    <span className="w-12 text-center font-mono text-amber-300">{(sc.syncOffset || 0).toFixed(1)}s</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = episode.scenes.map((s) =>
                          s.id === sc.id ? { ...s, syncOffset: Number(((s.syncOffset || 0) + 0.1).toFixed(2)) } : s
                        );
                        onUpdateProject({
                          ...project,
                          episodes: project.episodes.map((ep) => (ep.id === episode.id ? { ...ep, scenes: next } : ep)),
                        });
                      }}
                      className="rounded bg-white/10 px-2 py-1 font-bold text-white cursor-pointer"
                    >
                      +0.1 วิ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* User SFX Library + External Search */}
      <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-bold text-white">
            <Music className="h-4 w-4 text-emerald-400" />
            คลังเสียงประกอบ (SFX ส่วนตัว + ค้นหาภายนอก)
          </span>
          <button
            type="button"
            onClick={() => sfxInputRef.current?.click()}
            className="min-h-[38px] rounded-xl bg-white/10 px-3 text-xs font-bold text-white cursor-pointer"
          >
            + นำเข้า .mp3/.wav
          </button>
          <input
            ref={sfxInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onImportSfxFile(f);
              e.target.value = '';
            }}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            value={sfxSearch}
            onChange={(e) => setSfxSearch(e.target.value)}
            placeholder="ค้นหาเสียงประกอบ เช่น whoosh, bell, crowd..."
            className="min-h-[42px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 text-xs text-white"
          />
          <button
            type="button"
            onClick={() => void handleSearchFreesound()}
            className="min-h-[42px] rounded-xl bg-emerald-500/20 px-3 text-xs font-bold text-emerald-200 cursor-pointer"
          >
            ค้น Freesound
          </button>
          <a
            href={`https://www.myinstants.com/en/search/?name=${encodeURIComponent(sfxSearch)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[42px] items-center gap-1 rounded-xl border border-white/15 px-3 text-xs font-semibold text-white/85"
          >
            <span>Myinstants</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        {sfxStatus && <div className="text-xs text-amber-200">{sfxStatus}</div>}

        {freesoundResults.length > 0 && (
          <div className="space-y-1.5">
            {freesoundResults.map((fr) => (
              <div key={fr.id} className="flex items-center justify-between gap-2 rounded-xl bg-black/30 px-3 py-2 text-xs">
                <span className="truncate text-white">{fr.name}</span>
                <audio controls src={fr.previewUrl} className="h-7 w-40" />
              </div>
            ))}
          </div>
        )}

        {userSfxAssets.length > 0 && (
          <div className="space-y-1.5">
            {userSfxAssets.map((as) => (
              <div key={as.id} className="flex items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs">
                <span className="truncate text-white/90">{as.name}</span>
                <button
                  type="button"
                  onClick={() => void onDeleteAsset(as.id)}
                  className="rounded-lg bg-rose-500/15 p-1.5 text-rose-300 cursor-pointer"
                  aria-label={`ลบเสียง ${as.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MP4-Only Preflight + Export + Post-Export VERIFY */}
      <div className="rounded-2xl border border-white/15 bg-[#13141d] p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-bold text-white">
            <Film className="h-5 w-5 text-amber-300" />
            ส่งออกวิดีโอ MP4 (H.264 + AAC เท่านั้น)
          </h3>
          <span className="text-xs text-[#9894b8]">ความยาว {totalDuration.toFixed(1)} วิ</span>
        </div>

        {/* Preflight Checklist */}
        {preflight && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/30 p-3 text-xs">
            <div className="flex items-center gap-1.5">
              {preflight.webCodecsSupported ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-rose-400" />
              )}
              <span>WebCodecs H.264: {preflight.selectedVideoCodec || 'ไม่รองรับ'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>เสียง {preflight.selectedAudioCodec?.toUpperCase() || 'AAC'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>ขนาด {preflight.selectedWidth}×{preflight.selectedHeight}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {preflight.hasVoiceover ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              )}
              <span>{preflight.hasVoiceover ? 'มีเสียงพากย์พร้อม' : 'ยังไม่มีเสียงพากย์ (มีเพลง/SFX)'}</span>
            </div>
          </div>
        )}

        {preflight?.isInIframe && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-100">
            หมายเหตุ: ขณะเปิดใน iframe ตัวอย่าง การดาวน์โหลดอัตโนมัติอาจถูกบล็อก — สามารถเปิดในแท็บใหม่หรือกดดาวน์โหลดจากตัวเล่นหลังส่งออกได้
          </div>
        )}

        {/* Export Settings Row */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <label className="text-[#9894b8]">ความละเอียด</label>
            <select
              value={project.settings.resolution}
              onChange={(e) =>
                onUpdateProject({
                  ...project,
                  settings: { ...project.settings, resolution: e.target.value as '540p' | '720p' | '1080p' },
                })
              }
              className="mt-1 min-h-[42px] w-full rounded-xl border border-white/15 bg-black/30 px-2 text-white"
            >
              <option value="540p">540p (เร็วมาก)</option>
              <option value="720p">720p (แนะนำ)</option>
              <option value="1080p">1080p Full HD</option>
            </select>
          </div>
          <div>
            <label className="text-[#9894b8]">FPS</label>
            <select
              value={project.settings.fps}
              onChange={(e) =>
                onUpdateProject({
                  ...project,
                  settings: { ...project.settings, fps: Number(e.target.value) as 24 | 30 },
                })
              }
              className="mt-1 min-h-[42px] w-full rounded-xl border border-white/15 bg-black/30 px-2 text-white"
            >
              <option value={24}>24 FPS</option>
              <option value={30}>30 FPS</option>
            </select>
          </div>
          <div>
            <label className="text-[#9894b8]">แบ่งไฟล์ยาว</label>
            <select
              value={config.partMinutes}
              onChange={(e) => onUpdateConfig({ ...config, partMinutes: Number(e.target.value) })}
              className="mt-1 min-h-[42px] w-full rounded-xl border border-white/15 bg-black/30 px-2 text-white"
            >
              <option value={3}>ทุก 3 นาที/ไฟล์</option>
              <option value={5}>ทุก 5 นาที/ไฟล์</option>
              <option value={10}>ทุก 10 นาที/ไฟล์</option>
            </select>
          </div>
        </div>

        {opfsResumeCount > 0 && !exporting && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-400/30 bg-violet-500/15 p-3 text-xs">
            <span className="text-violet-100">พบชิ้นส่วน OPFS ค้างอยู่ {opfsResumeCount} ช่วงจากครั้งก่อน</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => void handleStartMp4Export(opfsResumeCount)}
                className="rounded-lg bg-violet-500 px-3 py-1.5 font-bold text-white cursor-pointer"
              >
                ทำช่วงที่เหลือต่อ
              </button>
              <button
                type="button"
                onClick={() => void clearOpfsParts(`${project.id}_`).then(() => setOpfsResumeCount(0))}
                className="rounded-lg bg-white/10 px-2.5 py-1.5 text-white cursor-pointer"
              >
                ล้าง
              </button>
            </div>
          </div>
        )}

        {exportError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-200">
            {exportError}
          </div>
        )}

        {exporting && exportProg ? (
          <div className="rounded-xl border border-amber-400/30 bg-black/30 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold text-amber-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                {exportProg.message}
              </span>
              <span className="font-mono text-white">
                {exportProg.percent}%{exportProg.etaSec ? ` • เหลือ ~${exportProg.etaSec} วิ` : ''}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-amber-400 transition-all" style={{ width: `${exportProg.percent}%` }} />
            </div>
            <button
              type="button"
              onClick={() => exportAbortRef.current?.abort()}
              className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-rose-500/20 text-xs font-bold text-rose-200 cursor-pointer"
            >
              <StopCircle className="h-4 w-4" /> ยกเลิกการส่งออก
            </button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={Boolean(preflight?.fatalError)}
              onClick={() => void handleStartMp4Export(0)}
              className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-amber-400 text-base font-extrabold text-slate-950 disabled:opacity-40 cursor-pointer"
            >
              <Film className="h-5 w-5" />
              <span>สร้างไฟล์วิดีโอ .MP4</span>
            </button>

            <button
              type="button"
              disabled={mp3Loading}
              onClick={() => void handleDownloadMp3()}
              className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 text-sm font-bold text-white cursor-pointer"
            >
              <Download className="h-5 w-5 text-emerald-300" />
              <span>{mp3Loading ? 'กำลังสร้างเสียง .MP3...' : 'ดาวน์โหลดเสียงรวม .MP3'}</span>
            </button>
          </div>
        )}

        {/* Post-Export VERIFY Video Preview & Large Share/Download Actions */}
        {verifiedParts.length > 0 && previewVideoUrl && (
          <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-emerald-300">
                ✓ ตรวจสอบไฟล์ MP4 สำเร็จ ({verifiedParts[0].usedWidth}×{verifiedParts[0].usedHeight} @ {verifiedParts[0].usedFps}fps •{' '}
                {(verifiedParts[0].blob.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
              {verifiedParts[0].durationSec && (
                <span className="font-mono text-white">ความยาวในไฟล์: {verifiedParts[0].durationSec.toFixed(1)}s</span>
              )}
            </div>

            {!verifiedParts[0].audioRmsDetected && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-500/20 p-2.5 text-xs text-rose-100">
                คำเตือน VERIFY: ไม่พบสัญญาณเสียงในแทร็กเสียงของ MP4 (กรุณาตรวจสอบเสียงพากย์หรือเพลงประกอบ)
              </div>
            )}

            <video
              ref={previewVideoRef}
              controls
              playsInline
              src={previewVideoUrl}
              className="max-h-[340px] w-full rounded-xl bg-black"
            />

            <div className="grid gap-2 sm:grid-cols-3">
              {verifiedParts.map((part) => (
                <div key={part.partIndex} className="contents">
                  <button
                    type="button"
                    onClick={() => handleDownloadBlob(part.blob, part.filename)}
                    className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-emerald-500 font-bold text-slate-950 text-sm cursor-pointer"
                  >
                    <Download className="h-5 w-5" />
                    <span>ดาวน์โหลด {verifiedParts.length > 1 ? `ตอนที่ ${part.partIndex}` : 'MP4'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleShareBlob(part.blob, part.filename)}
                    className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl bg-violet-500 font-bold text-white text-sm cursor-pointer"
                  >
                    <Share2 className="h-5 w-5" />
                    <span>บันทึก / แชร์ลงเครื่อง</span>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => void handleDownloadMp3()}
                className="flex min-h-[56px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 font-bold text-white text-sm cursor-pointer"
              >
                <Download className="h-5 w-5 text-amber-300" />
                <span>ดาวน์โหลดเสียง .MP3</span>
              </button>
            </div>

            <div className="text-[11px] text-[#c7c3e0]">
              วิธีเซฟบนมือถือ: iPhone แตะ “บันทึก / แชร์ลงเครื่อง” แล้วเลือก Save Video / Save to Files • Android แตะดาวน์โหลดหรือเมนู ⋮ บนตัวเล่นวิดีโอเพื่อบันทึกเข้าโฟลเดอร์ Downloads
            </div>
          </div>
        )}
      </div>

      {/* Server FFmpeg Background Render Queue & Real QA Inspector */}
      <div className="rounded-2xl border border-amber-400/25 bg-[#13141d] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-bold text-white">
              Server FFmpeg Render Queue & Automated QA Check
            </div>
            <div className="text-[11px] text-[#9894b8]">
              เรนเดอร์เบื้องหลังบนเซิร์ฟเวอร์ (720p–4K) พร้อมตรวจ Native vs Upscaled, เฟรมดำ (blackdetect) และ Audio Sync ผ่าน ffprobe
            </div>
          </div>
          {!isSignedIn && onOpenAuth && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
            >
              เข้าสู่ระบบเพื่อใช้ Server Render
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={serverRes}
            onChange={(e) => setServerRes(e.target.value as '720p' | '1080p' | '1440p' | '4k')}
            className="min-h-[40px] rounded-xl border border-white/15 bg-black/40 px-3 text-xs font-bold text-white"
          >
            <option value="720p">720p HD (Free & Studio Pass)</option>
            <option value="1080p">1080p Full HD</option>
            <option value="1440p" disabled={userTier === 'free'}>
              1440p QHD {userTier === 'free' ? '(Studio Pass)' : ''}
            </option>
            <option value="4k" disabled={userTier === 'free'}>
              4K Ultra HD {userTier === 'free' ? '(Studio Pass)' : ''}
            </option>
          </select>

          <button
            type="button"
            disabled={!isSignedIn || serverBusy}
            onClick={async () => {
              setServerBusy(true);
              setServerErr(null);
              try {
                let sourceB64: string | undefined;
                if (verifiedParts.length > 0) {
                  const ab = await verifiedParts[0].blob.arrayBuffer();
                  let bin = '';
                  const bytes = new Uint8Array(ab);
                  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
                  sourceB64 = btoa(bin);
                }
                const res = await platformApi.enqueueRenderJob({
                  projectId: project.id,
                  projectTitle: project.title,
                  aspect: project.layout === 'landscape' ? '16:9' : '9:16',
                  resolution: serverRes,
                  fps: project.settings.fps,
                  durationSec: Math.min(30, Math.max(4, Math.round(totalDuration))),
                  sourceVideoBase64: sourceB64,
                  sourceWidth: verifiedParts[0]?.usedWidth,
                  sourceHeight: verifiedParts[0]?.usedHeight,
                });
                setServerJobs((prev) => [res.job, ...prev]);
                await onRefreshPlatform?.();
                // Poll until terminal state
                for (let k = 0; k < 20; k++) {
                  await new Promise((r) => setTimeout(r, 1200));
                  const poll = await platformApi.getRenderJob(res.job.id);
                  setServerJobs((prev) => prev.map((j) => (j.id === poll.job.id ? poll.job : j)));
                  if (poll.job.status === 'completed' || poll.job.status === 'failed') {
                    await onRefreshPlatform?.();
                    break;
                  }
                }
              } catch (e) {
                setServerErr(e instanceof Error ? e.message : String(e));
              } finally {
                setServerBusy(false);
              }
            }}
            className="min-h-[40px] rounded-xl bg-amber-400 px-4 text-xs font-extrabold text-slate-950 disabled:opacity-40 cursor-pointer"
          >
            {serverBusy ? 'กำลังส่งคิว & ตรวจ QA...' : 'ส่งคิวเรนเดอร์ FFmpeg & ตรวจ QA'}
          </button>

          {isSignedIn && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const list = await platformApi.listRenderJobs();
                  setServerJobs(list.jobs);
                } catch (e) {
                  setServerErr(e instanceof Error ? e.message : String(e));
                }
              }}
              className="min-h-[40px] rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold text-white cursor-pointer"
            >
              โหลดสถานะคิวล่าสุด
            </button>
          )}
          {userTier === 'free' && onOpenBilling && (
            <button
              type="button"
              onClick={onOpenBilling}
              className="min-h-[40px] rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 text-xs font-bold text-amber-200 cursor-pointer"
            >
              อัปเกรด Studio Pass เพื่อปลดล็อก 4K
            </button>
          )}
        </div>

        {serverErr && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 p-2.5 text-xs text-rose-200">
            {serverErr}
          </div>
        )}

        {serverJobs.length > 0 && (
          <div className="space-y-2">
            {serverJobs.slice(0, 6).map((j) => (
              <div
                key={j.id}
                className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-white">
                    {j.projectTitle} • {j.resolution} ({j.upscaled ? 'Upscaled' : 'Native'}) @ {j.fps}fps
                  </span>
                  <span className="font-mono-tabular font-bold text-amber-300">
                    {j.status} {j.qaReport ? `• QA: ${j.qaReport.status}` : ''}
                  </span>
                </div>
                {j.qaReport && (
                  <div className="text-[11px] text-[#c7c3e0]">
                    Resolution: {j.qaReport.resolution} (Native {j.qaReport.nativeResolution}) • Frames:{' '}
                    {j.qaReport.frameCount} • Black Segments: {j.qaReport.blackFrameSegments} • Audio Sync Δ:{' '}
                    {j.qaReport.audioSyncDeltaSec}s
                  </div>
                )}
                {j.status === 'completed' && (
                  <button
                    type="button"
                    onClick={() => void platformApi.downloadRenderJob(j.id, `${j.projectId}_${j.resolution}.mp4`)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-1.5 text-[11px] font-extrabold text-slate-950 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>ดาวน์โหลด MP4 จากเซิร์ฟเวอร์</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
