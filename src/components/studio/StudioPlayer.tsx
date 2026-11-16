import { Maximize2, Pause, Play, Redo2, Undo2, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { StudioEpisode, StudioProject, StudioTimelineSegment } from '../../types/studio';
import { renderAtTime } from '../../utils/canvasEngine';
import { getBaseDimensions } from '../../utils/canvasHelpers';
import type { PauseCandidate } from '../../utils/timelineSync';

interface StudioPlayerProps {
  project: StudioProject;
  episode: StudioEpisode;
  timeline: StudioTimelineSegment[];
  totalDuration: number;
  currentTime: number;
  isPlaying: boolean;
  isMuted: boolean;
  envelope: number[];
  leadSec: number;
  speechStartSec: number;
  pauseCandidates: PauseCandidate[];
  canUndo: boolean;
  canRedo: boolean;
  activeSceneId: string | null;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onToggleMute: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function StudioPlayer(props: StudioPlayerProps) {
  const {
    project,
    episode,
    timeline,
    totalDuration,
    currentTime,
    isPlaying,
    isMuted,
    envelope,
    leadSec,
    speechStartSec,
    pauseCandidates,
    canUndo,
    canRedo,
    activeSceneId,
    onTogglePlay,
    onSeek,
    onToggleMute,
    onUndo,
    onRedo,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dims = getBaseDimensions(project.layout, 0.75);
    if (canvas.width !== dims.width || canvas.height !== dims.height) {
      canvas.width = dims.width;
      canvas.height = dims.height;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderAtTime(ctx, project, episode, timeline, currentTime, {
      envelope,
      leadSec,
      speechStartSec,
      pauseCandidates,
      showSubtitles: true,
      isExport: false,
    });
  }, [project, episode, timeline, currentTime, envelope, leadSec, speechStartSec, pauseCandidates]);

  const handleFullscreen = () => {
    const el = stageContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void el.requestFullscreen?.().catch(() => {});
    }
  };

  const isLandscape = project.layout === 'landscape';

  return (
    <section
      aria-label="ตัวเล่นตัวอย่างวิดีโอ"
      className="sticky top-0 z-30 border-b border-white/10 bg-[#0d0e15]/95 backdrop-blur-md px-3 py-2"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2 md:flex-row md:items-center md:gap-4">
        <div
          ref={stageContainerRef}
          className={`relative mx-auto overflow-hidden rounded-xl border border-white/10 bg-black shadow-xl ${
            isLandscape ? 'aspect-video w-full max-w-[380px] md:max-w-[420px]' : 'aspect-[9/16] h-[34dvh] max-h-[300px] md:h-[260px]'
          }`}
        >
          <canvas
            ref={canvasRef}
            data-testid="studio-canvas"
            data-scene-id={activeSceneId || ''}
            data-playing={isPlaying ? 'true' : 'false'}
            className="h-full w-full object-contain"
          />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-xs text-[#b8b4d6]">
            <span className="truncate font-semibold text-white">
              {project.title}
              {activeSceneId ? ` • ${activeSceneId}` : ''}
            </span>
            <span className="font-mono-tabular shrink-0 text-amber-300">
              {formatClock(currentTime)} / {formatClock(totalDuration)}
            </span>
          </div>

          <input
            type="range"
            aria-label="แถบเวลาวิดีโอ"
            min={0}
            max={Math.max(0.5, totalDuration)}
            step={0.05}
            value={Math.min(totalDuration, currentTime)}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="studio-range h-6 w-full"
          />

          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onTogglePlay}
                className="inline-flex min-h-[44px] min-w-[100px] items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-sm font-bold text-slate-950 transition-transform active:scale-95 cursor-pointer"
                aria-label={isPlaying ? 'หยุดเล่น' : 'เล่นวิดีโอ'}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                <span>{isPlaying ? 'หยุด' : 'เล่น'}</span>
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 cursor-pointer"
                aria-label={isMuted ? 'เปิดเสียง' : 'ปิดเสียง'}
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={handleFullscreen}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90 hover:bg-white/10 cursor-pointer"
                aria-label="เต็มจอ"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onUndo}
                disabled={!canUndo}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                aria-label="ย้อนกลับ (Undo)"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onRedo}
                disabled={!canRedo}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/90 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                aria-label="ทำซ้ำ (Redo)"
              >
                <Redo2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
