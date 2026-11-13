import { Download, FolderInput, HardDrive, Trash2, Upload } from 'lucide-react';
import type { SavedProjectRecord } from '../types/cartoon';
import { STYLES } from '../utils/cartoonData';
import type { StorageSummary } from '../utils/storage';

interface ProjectsViewProps {
  projects: SavedProjectRecord[];
  storage: StorageSummary;
  dirName: string | null;
  onOpenProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onDeleteVideo: (id: string) => void;
  onRequestPersist: () => void;
  onPickDirectory: () => void;
  onBackupJson: () => void;
  onRestoreJson: (file: File) => void;
}

export function ProjectsView({
  projects,
  storage,
  dirName,
  onOpenProject,
  onDeleteProject,
  onDeleteVideo,
  onRequestPersist,
  onPickDirectory,
  onBackupJson,
  onRestoreJson,
}: ProjectsViewProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          คลังโปรเจกต์และพื้นที่จัดเก็บในเครื่อง
        </h1>
        <p className="text-sm text-[#9894b8]">
          ข้อมูลบท เสียงพากย์ และวิดีโอที่เรนเดอร์ไว้จะถูกเก็บในฐานข้อมูล IndexedDB บนเบราว์เซอร์ของคุณ สามารถสำรองข้อมูลเป็นไฟล์ JSON ได้ตลอดเวลา
        </p>
      </div>

      {/* Storage Panel */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <HardDrive className="h-5 w-5 text-violet-400 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-base font-semibold text-white">สถานะพื้นที่เก็บข้อมูล</h2>
              {storage.supported ? (
                <p className="mt-1 text-sm text-[#9894b8] tabular-nums">
                  ใช้ไป {storage.usageMB.toFixed(1)} MB / โควตาโดยประมาณ {storage.quotaMB.toFixed(1)} MB (ว่าง ~{storage.freeMB.toFixed(1)} MB) · Persistent:{' '}
                  {storage.persisted ? 'เปิดใช้งานแล้ว' : 'ยังไม่ขอสิทธิ์ถาวร'}
                </p>
              ) : (
                <p className="mt-1 text-sm text-[#9894b8]">เบราว์เซอร์นี้ไม่รองรับการประเมินพื้นที่จัดเก็บ</p>
              )}
              {storage.ratio > 0.8 && (
                <p className="mt-1 text-xs font-medium text-amber-400">
                  พื้นที่ใกล้เต็ม แนะนำให้ลบแคชไฟล์วิดีโอของโปรเจกต์เก่าออกบ้าง
                </p>
              )}
              <p className="mt-1 text-xs text-[#9894b8]">
                โฟลเดอร์บันทึกอัตโนมัติ: {dirName ? dirName : 'ยังไม่ได้เลือก (ใช้การดาวน์โหลดไฟล์ปกติ)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onRequestPersist}
              className="min-h-[44px] whitespace-nowrap rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 py-2 text-xs font-medium text-white hover:border-violet-400/50 transition-colors cursor-pointer"
            >
              ขอพื้นที่ถาวร
            </button>
            <button
              type="button"
              onClick={onPickDirectory}
              className="inline-flex items-center gap-1.5 min-h-[44px] whitespace-nowrap rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 py-2 text-xs font-medium text-white hover:border-violet-400/50 transition-colors cursor-pointer"
            >
              <FolderInput className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <span>เลือกโฟลเดอร์</span>
            </button>
            <button
              type="button"
              onClick={onBackupJson}
              className="inline-flex items-center gap-1.5 min-h-[44px] whitespace-nowrap rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 py-2 text-xs font-medium text-white hover:border-violet-400/50 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <span>Backup JSON</span>
            </button>
            <label className="inline-flex items-center gap-1.5 min-h-[44px] whitespace-nowrap rounded-xl border border-white/10 bg-[#1b1d29] px-3.5 py-2 text-xs font-medium text-white hover:border-violet-400/50 transition-colors cursor-pointer">
              <Upload className="h-4 w-4 text-violet-400" aria-hidden="true" />
              <span>Restore JSON</span>
              <input
                type="file"
                accept=".json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onRestoreJson(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Saved Projects List */}
      <section aria-labelledby="saved-projects-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="saved-projects-heading" className="text-lg font-semibold text-white">
            โปรเจกต์ทั้งหมด
          </h2>
          <span className="text-sm text-[#9894b8] tabular-nums">{projects.length} โปรเจกต์</span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#13141d] p-10 text-center">
            <p className="text-sm text-[#9894b8]">
              ยังไม่มีโปรเจกต์ที่บันทึกไว้ ลองสร้างการ์ตูนเรื่องแรกหรือเปิดตัวอย่างแล้วกดปุ่มบันทึกในสตูดิโอ
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const styleName = STYLES[p.data.style]?.n || p.data.style;
              const dateStr = new Date(p.at).toLocaleDateString('th-TH', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <article
                  key={p.id}
                  className="flex gap-4 rounded-2xl border border-white/[0.08] bg-[#13141d] p-4"
                >
                  {p.thumb ? (
                    <img
                      src={p.thumb}
                      alt={`ภาพตัวอย่างของ ${p.title}`}
                      className="h-28 w-16 shrink-0 rounded-xl bg-black object-cover border border-white/10"
                    />
                  ) : (
                    <div className="flex h-28 w-16 shrink-0 items-center justify-center rounded-xl bg-[#0a0b10] border border-white/10 text-xs text-[#9894b8]">
                      9:16
                    </div>
                  )}

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <h3 className="truncate text-base font-semibold text-white">{p.title}</h3>
                      <div className="mt-1 text-xs text-[#9894b8]">
                        {styleName} · {p.data.scenes.length} ฉาก
                      </div>
                      <div className="mt-0.5 text-xs text-[#9894b8] tabular-nums">
                        {p.audio ? 'มีเสียงพากย์' : 'ไม่มีเสียง'}
                        {p.video ? ` · วิดีโอ ${(p.video.size / 1048576).toFixed(1)} MB` : ''} · {dateStr}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenProject(p.id)}
                        className="min-h-[40px] rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 transition-colors cursor-pointer"
                      >
                        เปิดในสตูดิโอ
                      </button>
                      {p.video && (
                        <button
                          type="button"
                          onClick={() => onDeleteVideo(p.id)}
                          className="min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-1.5 text-xs text-[#d6d3eb] hover:text-white transition-colors cursor-pointer"
                        >
                          ล้างไฟล์วิดีโอ
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`ลบโปรเจกต์ ${p.title}`}
                        onClick={() => onDeleteProject(p.id)}
                        className="inline-flex items-center gap-1 min-h-[40px] rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
