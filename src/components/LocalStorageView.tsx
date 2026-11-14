import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  HardDrive,
  KeyRound,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  Unlock,
  Upload,
} from 'lucide-react';
import type { WorkspaceMeta } from '../types/cartoon';
import type { StorageSummary } from '../utils/storage';

interface LocalStorageViewProps {
  workspaces: WorkspaceMeta[];
  activeWorkspace: WorkspaceMeta;
  isLocked: boolean;
  deviceId: string;
  storage: StorageSummary;
  onSwitchWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onSetPinLock: (passphrase: string) => Promise<void>;
  onUnlockWithPin: (passphrase: string) => Promise<boolean>;
  onRemovePinLock: (currentPassphrase: string) => Promise<boolean>;
  onRequestPersist: () => void;
  onExportWorkspaceBackup: () => Promise<void>;
  onImportWorkspaceBackup: (file: File) => Promise<void>;
}

export function LocalStorageView({
  workspaces,
  activeWorkspace,
  isLocked,
  deviceId,
  storage,
  onSwitchWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onSetPinLock,
  onUnlockWithPin,
  onRemovePinLock,
  onRequestPersist,
  onExportWorkspaceBackup,
  onImportWorkspaceBackup,
}: LocalStorageViewProps) {
  const [newWsName, setNewWsName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const [pinInput, setPinInput] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [removePinInput, setRemovePinInput] = useState('');
  const [pinMsg, setPinMsg] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-white">
          พื้นที่ในเครื่อง & ระบบ Workspace ไม่ต้องสมัครสมาชิก
        </h1>
        <p className="mt-1.5 text-sm text-[#9894b8] max-w-3xl">
          ข้อมูลโปรเจกต์ เสียงพากย์ Preset ตัวละคร ไฟล์ .glb และ API Key ถูกแยกเก็บเฉพาะภายใน Workspace บน IndexedDB ของเครื่องคุณ ไม่มีฐานข้อมูล Cloud กลางของเว็บไซต์
        </p>
      </div>

      {/* Device ID & IndexedDB Quota */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            <h2>ตัวตนเครื่องแบบ Local Only (ไม่มี Tracking / Fingerprint)</h2>
          </div>
          <p className="text-xs text-[#9894b8]">
            Device UUID ที่สุ่มในเครื่องสำหรับระบุเจ้าของ Workspace (ไม่ส่งออกไปยังเซิร์ฟเวอร์ภายนอก):
          </p>
          <div className="rounded-xl border border-white/10 bg-[#0b0c12] px-3 py-2 font-mono-tabular text-xs text-violet-300 break-all">
            {deviceId}
          </div>
          <p className="text-xs text-[#9894b8]">
            Workspace ปัจจุบัน: <strong className="text-white">{activeWorkspace.name}</strong> · ล่าสุดจะถูกเปิดอัตโนมัติเมื่อกลับมา
          </p>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-3">
          <div className="flex items-center gap-2 text-white font-semibold">
            <HardDrive className="h-5 w-5 text-violet-400" aria-hidden="true" />
            <h2>พื้นที่ IndexedDB & การสำรองข้อมูล (Backup / Restore)</h2>
          </div>
          {storage.supported && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-[#9894b8] tabular-nums">
                <span>ใช้ไป {storage.usageMB.toFixed(1)} MB</span>
                <span>โควตา {storage.quotaMB.toFixed(0)} MB</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-violet-500"
                  style={{ width: `${Math.min(100, Math.max(2, storage.ratio * 100))}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={onRequestPersist}
              className="min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3 text-xs font-medium text-white hover:border-violet-400/50 cursor-pointer"
            >
              {storage.persisted ? 'เปิดพื้นที่ถาวรแล้ว' : 'ขอสิทธิ์เก็บถาวร'}
            </button>
            <button
              type="button"
              onClick={onExportWorkspaceBackup}
              className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export Backup (JSON + เสียง)</span>
            </button>
            <label className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl border border-white/10 bg-[#1b1d29] px-3 text-xs font-medium text-white hover:border-violet-400/50 cursor-pointer">
              <Upload className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
              <span>Import Backup</span>
              <input
                type="file"
                accept=".json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onImportWorkspaceBackup(file);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Multi-Workspace Manager */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-bold text-white">จัดการหลาย Workspace ในเครื่อง</h2>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newWsName.trim()) return;
              onCreateWorkspace(newWsName.trim());
              setNewWsName('');
            }}
          >
            <input
              type="text"
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="ชื่อ Workspace ใหม่ เช่น ช่องหลัก / โปรเจกต์ลูกค้า"
              className="min-h-[40px] w-64 rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white placeholder:text-[#7a769b]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 min-h-[40px] rounded-xl bg-violet-600 px-3.5 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>สร้าง</span>
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeWorkspace.id;
            return (
              <div
                key={ws.id}
                className={`rounded-xl border p-4 space-y-3 ${
                  isActive
                    ? 'border-violet-500/60 bg-violet-500/10'
                    : 'border-white/10 bg-[#1b1d29]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  {renameId === ws.id ? (
                    <form
                      className="flex flex-1 gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renameText.trim()) onRenameWorkspace(ws.id, renameText.trim());
                        setRenameId(null);
                      }}
                    >
                      <input
                        type="text"
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        className="w-full rounded-lg border border-white/20 bg-[#0b0c12] px-2 py-1 text-xs text-white"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer"
                      >
                        บันทึก
                      </button>
                    </form>
                  ) : (
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-semibold text-sm text-white">{ws.name}</span>
                        {ws.hasPassphrase && (
                          <Lock className="h-3.5 w-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#9894b8]">
                        แก้ไขล่าสุด: {new Date(ws.updatedAt).toLocaleDateString('th-TH')}
                      </p>
                    </div>
                  )}

                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ใช้งานอยู่
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => onSwitchWorkspace(ws.id)}
                      className="flex-1 min-h-[36px] rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-500 cursor-pointer"
                    >
                      สลับมาใช้
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setRenameId(ws.id);
                      setRenameText(ws.name);
                    }}
                    className="inline-flex items-center gap-1 min-h-[36px] rounded-lg border border-white/10 bg-[#13141d] px-2.5 text-xs text-[#d6d3eb] hover:text-white cursor-pointer"
                  >
                    <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>เปลี่ยนชื่อ</span>
                  </button>
                  {workspaces.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteWorkspace(ws.id)}
                      aria-label={`ลบ ${ws.name}`}
                      className="inline-flex items-center justify-center min-h-[36px] rounded-lg border border-white/10 bg-[#13141d] px-2.5 text-xs text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* PIN / Passphrase AES-GCM Encryption */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#13141d] p-5 space-y-4">
        <div className="flex items-center gap-2 text-white font-semibold">
          <KeyRound className="h-5 w-5 text-amber-400" aria-hidden="true" />
          <h2>ล็อก Workspace ด้วย PIN / รหัสผ่านในเครื่อง (AES-GCM + PBKDF2 Web Crypto API)</h2>
        </div>
        <p className="text-xs text-[#9894b8]">
          เมื่อเปิดใช้รหัสผ่าน API Key ทั้งหมดของ Workspace "{activeWorkspace.name}" จะถูกเข้ารหัสด้วย AES-256-GCM ก่อนบันทึกลง IndexedDB
        </p>

        {activeWorkspace.hasPassphrase ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isLocked ? (
              <form
                className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const ok = await onUnlockWithPin(unlockInput);
                  setPinMsg(ok ? 'ปลดล็อก Workspace สำเร็จแล้ว' : 'รหัสผ่านไม่ถูกต้อง');
                  if (ok) setUnlockInput('');
                }}
              >
                <p className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Lock className="h-4 w-4" aria-hidden="true" />
                  <span>Workspace นี้ถูกล็อกอยู่ กรุณากรอก PIN/รหัสผ่านเพื่อถอดรหัส API Key</span>
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={unlockInput}
                    onChange={(e) => setUnlockInput(e.target.value)}
                    placeholder="กรอกรหัสผ่านปลดล็อก"
                    className="flex-1 min-h-[40px] rounded-xl border border-white/15 bg-[#0b0c12] px-3 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 min-h-[40px] rounded-xl bg-amber-500 px-4 text-xs font-semibold text-slate-950 hover:bg-amber-400 cursor-pointer"
                  >
                    <Unlock className="h-4 w-4" aria-hidden="true" />
                    <span>ปลดล็อก</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200 flex items-center gap-2">
                <Unlock className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>ปลดล็อก Workspace แล้วในเซสชันนี้ (API Key พร้อมใช้งาน)</span>
              </div>
            )}

            <form
              className="space-y-2 rounded-xl border border-white/10 bg-[#1b1d29] p-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await onRemovePinLock(removePinInput);
                setPinMsg(ok ? 'ยกเลิกล็อกรหัสผ่านแล้ว' : 'รหัสผ่านเดิมไม่ถูกต้อง');
                if (ok) setRemovePinInput('');
              }}
            >
              <p className="text-xs font-medium text-white">ยกเลิกการล็อกด้วยรหัสผ่าน</p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={removePinInput}
                  onChange={(e) => setRemovePinInput(e.target.value)}
                  placeholder="ยืนยันรหัสผ่านปัจจุบัน"
                  className="flex-1 min-h-[40px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-xs text-white"
                />
                <button
                  type="submit"
                  className="min-h-[40px] rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                >
                  ปลดล็อกถาวร
                </button>
              </div>
            </form>
          </div>
        ) : (
          <form
            className="flex flex-col sm:flex-row gap-2 max-w-xl"
            onSubmit={async (e) => {
              e.preventDefault();
              if (pinInput.trim().length < 4) {
                setPinMsg('กรุณาตั้ง PIN / รหัสผ่านอย่างน้อย 4 ตัวอักษร');
                return;
              }
              await onSetPinLock(pinInput.trim());
              setPinInput('');
              setPinMsg('ตั้งรหัสล็อกและเข้ารหัส API Key ด้วย AES-GCM สำเร็จ');
            }}
          >
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="ตั้ง PIN หรือรหัสผ่านอย่างน้อย 4 ตัวอักษร"
              className="flex-1 min-h-[42px] rounded-xl border border-white/10 bg-[#0b0c12] px-3 text-sm text-white"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 min-h-[42px] rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              <Lock className="h-4 w-4" aria-hidden="true" />
              <span>เปิดล็อก Workspace</span>
            </button>
          </form>
        )}

        {pinMsg && <p className="text-xs font-medium text-violet-300">{pinMsg}</p>}
      </div>
    </div>
  );
}
