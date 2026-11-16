import { FolderArchive, FolderOpen, HardDrive, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { StudioProject, UserAudioAsset } from '../../types/studio';
import { estimateStorageUsage } from '../../utils/opfsStorage';
import { BUILT_IN_DEMOS, STYLE_PACKS } from '../../utils/studioData';
import { exportProjectZipBlob, parseProjectZipBytes } from '../../utils/zipProject';
import { PWAInstallButton } from '../PWAInstallButton';

interface ProjectsTabProps {
  activeProject: StudioProject;
  savedProjects: StudioProject[];
  assets: UserAudioAsset[];
  onLoadProject: (project: StudioProject) => void;
  onCreateBlank: () => void;
  onDeleteProject: (id: string) => void;
  onImportZipBundle: (project: StudioProject, assets: UserAudioAsset[]) => Promise<void>;
  onGoToCreateTab: () => void;
}

export function ProjectsTab(props: ProjectsTabProps) {
  const {
    activeProject,
    savedProjects,
    assets,
    onLoadProject,
    onCreateBlank,
    onDeleteProject,
    onImportZipBundle,
    onGoToCreateTab,
  } = props;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [quota, setQuota] = useState<{ usedMB: number; quotaMB: number } | null>(null);

  useEffect(() => {
    void estimateStorageUsage().then(setQuota);
  }, [savedProjects.length, assets.length]);

  const handleExportZip = async () => {
    try {
      setStatusMsg('กำลังแพ็กไฟล์ ZIP โปรเจกต์ + เสียง...');
      const projectAssets = assets.filter(
        (a) =>
          a.id.startsWith(`${activeProject.id}_`) ||
          activeProject.episodes.some((ep) => ep.scenes.some((s) => s.audio?.assetId === a.id || s.sfx.some((x) => x.assetId === a.id)))
      );
      const blob = await exportProjectZipBlob(activeProject, projectAssets);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProject.title.replace(/[^\wก-๙]+/g, '_') || 'zkatoon'}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatusMsg(`ส่งออก ZIP สำเร็จ (${Math.round(blob.size / 1024)} KB, ${projectAssets.length} ไฟล์เสียง)`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'ส่งออก ZIP ไม่สำเร็จ');
    }
  };

  const handleImportZip = async (file: File) => {
    try {
      const ab = await file.arrayBuffer();
      const parsed = parseProjectZipBytes(new Uint8Array(ab));
      await onImportZipBundle(parsed.project, parsed.assets);
      setStatusMsg(`นำเข้าโปรเจกต์ "${parsed.project.title}" สำเร็จ (${parsed.assets.length} ไฟล์เสียง)`);
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์ ZIP นี้ได้');
    }
  };

  return (
    <div className="space-y-5 p-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-white">โปรเจกต์และตัวอย่างเริ่มต้น</h2>
          <p className="text-xs text-[#9894b8]">บันทึกในเครื่อง 100% ไม่ต้องสมัครสมาชิก ทำงานแบบออฟไลน์ได้</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onGoToCreateTab}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-bold text-white cursor-pointer"
          >
            <Sparkles className="h-4 w-4" />
            <span>สร้างเรื่องใหม่ด้วย AI</span>
          </button>
          <button
            type="button"
            onClick={onCreateBlank}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>โปรเจกต์เปล่า</span>
          </button>
        </div>
      </div>

      <PWAInstallButton />

      {statusMsg && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {statusMsg}
        </div>
      )}

      {/* Instant Built-in Demos matching Reference Styles A, B, C */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-amber-300">ตัวอย่าง Demo เล่นได้ทันที (ไม่ต้องใส่ Key)</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {BUILT_IN_DEMOS.map((demo) => {
            const pack = STYLE_PACKS[demo.stylePack];
            const isActive = activeProject.id === demo.id;
            return (
              <div
                key={demo.id}
                className={`rounded-2xl border p-3.5 transition-colors ${
                  isActive
                    ? 'border-amber-400 bg-amber-400/10'
                    : 'border-white/10 bg-[#13141d]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-white">{demo.title}</div>
                    <div className="text-xs text-[#9894b8] mt-0.5">{pack.name}</div>
                  </div>
                  <span className="shrink-0 whitespace-nowrap rounded-lg bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">
                    {demo.episodes[0]?.scenes.length || 0} ฉาก
                  </span>
                </div>

                <div className="mt-2.5 flex items-center gap-1.5">
                  {pack.swatchColors.map((hex) => (
                    <span
                      key={hex}
                      className="h-4 w-4 rounded-full border border-white/20"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <span className="ml-auto text-[11px] text-[#9894b8]">
                    {demo.layout === 'portrait_letterbox' ? 'แถบกลาง 16:9' : 'แนวตั้ง 9:16'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onLoadProject(demo)}
                  className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-bold text-white hover:bg-amber-400 hover:text-slate-950 transition-colors cursor-pointer"
                >
                  <FolderOpen className="h-4 w-4" />
                  <span>{isActive ? 'กำลังเปิดโปรเจกต์นี้' : 'เปิดและเล่นตัวอย่าง'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Saved Local Projects */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-white">โปรเจกต์ที่บันทึกในเครื่อง ({savedProjects.length})</h3>
        {savedProjects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#13141d] p-4 text-xs text-[#9894b8]">
            ยังไม่มีโปรเจกต์ที่สร้างเอง — กด “สร้างเรื่องใหม่ด้วย AI” หรือแก้ไขโปรเจกต์ตัวอย่างแล้วระบบจะบันทึกอัตโนมัติ
          </div>
        ) : (
          <div className="space-y-2">
            {savedProjects.map((proj) => (
              <div
                key={proj.id}
                className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${
                  activeProject.id === proj.id ? 'border-violet-400 bg-violet-500/10' : 'border-white/10 bg-[#13141d]'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">{proj.title}</div>
                  <div className="text-xs text-[#9894b8]">
                    {proj.episodes[0]?.scenes.length || 0} ฉาก • สไตล์ Pack {proj.stylePack} •{' '}
                    {new Date(proj.updatedAt).toLocaleString('th-TH')}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onLoadProject(proj)}
                    className="min-h-[44px] rounded-xl bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 cursor-pointer"
                  >
                    เปิด
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProject(proj.id)}
                    aria-label={`ลบโปรเจกต์ ${proj.title}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup / Restore ZIP & Storage Meter */}
      <div className="rounded-2xl border border-white/10 bg-[#13141d] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-white">สำรอง / ย้ายเครื่อง (.ZIP)</span>
          {quota && (
            <span className="inline-flex items-center gap-1 text-xs text-[#9894b8]">
              <HardDrive className="h-3.5 w-3.5" />
              ใช้ไป {quota.usedMB} MB / {quota.quotaMB} MB
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void handleExportZip()}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white cursor-pointer"
          >
            <FolderArchive className="h-4 w-4 text-amber-300" />
            <span>ส่งออก .ZIP</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm font-semibold text-white cursor-pointer"
          >
            <Upload className="h-4 w-4 text-emerald-300" />
            <span>นำเข้า .ZIP</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImportZip(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
