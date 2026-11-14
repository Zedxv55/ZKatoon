import { FolderInput, HardDrive, Play, Trash2 } from 'lucide-react';
import type { SavedProjectRecord } from '../types/cartoon';
import { STYLES, STYLE_PRESETS_3D } from '../utils/cartoonData';
import type { StorageSummary } from '../utils/storage';

interface ProjectsViewProps {
  workspaceName: string;
  projects: SavedProjectRecord[];
  storage: StorageSummary;
  dirName: string | null;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteVideo: (id: string) => void;
  onPickDirectory: () => void;
  onGoStorage: () => void;
}

export function ProjectsView({
  workspaceName,
  projects,
  storage,
  dirName,
  onOpenProject,
  onDeleteProject,
  onDeleteVideo,
  onPickDirectory,
  onGoStorage,
}: ProjectsViewProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            โปรเจกต์ของฉัน ({workspaceName})
          </h1>
          <p className="mt-1 text-sm text-[#9894b8]">
            โปรเจกต์ทั้งหมดแยกจัดเก็บเฉพาะภายใน Workspace ปัจจุบันบน IndexedDB ของเบราว์เซอร์คุณ
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPickDirectory}
            className="inline-flex items-center gap-1.5 min-h-[42px] rounded-xl border border-white/10 bg-[#13141d] px-3.5 py-2 text-xs font-medium text-white hover:border-violet-400/50 cursor-pointer"
          >
            <FolderInput className="h-4 w-4 text-violet-400" aria-hidden="true" />
            <span>{dirName ? `โฟลเดอร์: ${dirName}` : 'เลือกโฟลเดอร์บันทึกในเครื่อง'}</span>
          </button>
          <button
            type="button"
            onClick={onGoStorage}
            className="inline-flex items-center gap-1.5 min-h-[42px] rounded-xl border border-white/10 bg-[#13141d] px-3.5 py-2 text-xs font-medium text-white hover:border-violet-400/50 cursor-pointer"
          >
            <HardDrive className="h-4 w-4 text-violet-400" aria-hidden="true" />
            <span>จัดการ Workspace & Backup</span>
          </button>
        </div>
      </div>

      {storage.supported && (
        <div className="rounded-xl border border-white/[0.08] bg-[#13141d] px-4 py-3 text-xs text-[#9894b8] flex flex-wrap items-center justify-between gap-2">
          <span>
            พื้นที่ใช้งานในเครื่อง: <strong className="text-white tabular-nums">{storage.usageMB.toFixed(1)} MB</strong> /{' '}
            {storage.quotaMB.toFixed(0)} MB (ว่าง ~{storage.freeMB.toFixed(0)} MB)
          </span>
          <span>Persistent Storage: {storage.persisted ? 'เปิดใช้งานแล้ว' : 'ยังไม่เปิดถาวร'}</span>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#13141d] p-10 text-center">
          <p className="text-sm text-[#9894b8]">
            ยังไม่มีโปรเจกต์ที่บันทึกไว้ใน Workspace "{workspaceName}"
          </p>
          <p className="mt-1 text-xs text-[#7a769b]">
            ไปที่เมนู "สร้างเรื่อง" เพื่อสร้างเรื่องใหม่ หรือเปิดตัวอย่าง 3D เพื่อทดลองแก้ไขและบันทึก
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const is3d = p.data.renderEngine !== '2d_paper';
            const styleLabel = is3d
              ? STYLE_PRESETS_3D.find((s) => s.id === p.data.style3d)?.name || '3D Cinematic'
              : STYLES[p.data.style]?.code || 'PAPER-SKETCH';
            return (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#13141d] p-4 transition-colors hover:border-violet-400/35"
              >
                <div className="flex gap-3.5">
                  {p.thumb ? (
                    <img
                      src={p.thumb}
                      alt={p.title}
                      className="h-24 w-14 shrink-0 rounded-lg border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-14 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1b1d29] text-[10px] font-bold text-[#9894b8]">
                      {is3d ? '3D' : '2D'}
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <h2 className="truncate text-base font-bold text-white">{p.title}</h2>
                    <p className="text-xs text-[#9894b8] truncate">
                      {is3d ? 'เอนจิน 3D WebGL' : 'เอนจิน 2D Paper'} · {styleLabel}
                    </p>
                    <p className="text-xs text-[#9894b8] tabular-nums">
                      {p.data.scenes.length} ฉาก · {p.data.characters.length} ตัวละคร
                    </p>
                    <p className="text-[11px] text-[#7a769b]">
                      {new Date(p.at).toLocaleString('th-TH')}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenProject(p.id)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 min-h-[40px] rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>เปิดแก้ไข</span>
                  </button>
                  {p.video && (
                    <button
                      type="button"
                      onClick={() => onDeleteVideo(p.id)}
                      className="min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-2.5 text-xs text-[#d6d3eb] hover:text-amber-300 cursor-pointer"
                    >
                      ล้างไฟล์วิดีโอ
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteProject(p.id)}
                    aria-label={`ลบโปรเจกต์ ${p.title}`}
                    className="min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-2.5 text-xs text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
