import { useState } from 'react';
import {
  ChevronDown,
  Clapperboard,
  Film,
  FolderKanban,
  HardDrive,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mic2,
  RefreshCw,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import type { AuthUserProfile } from '../types/cartoon';

export type AppTab =
  | 'create'
  | 'characters'
  | 'voice'
  | 'director'
  | 'studio'
  | 'projects'
  | 'storage'
  | 'settings';

interface TopBarProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  hasProject: boolean;
  workspaceName: string;
  isLocked: boolean;
  authProfile: AuthUserProfile | null;
  isAuthBusy: boolean;
  onSignInGoogle: () => void;
  onSwitchAccount: () => void;
  onSignOut: () => void;
  onOpenDemo3D: () => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof Sparkles }> = [
  { id: 'create', label: 'สร้างเรื่อง', icon: Sparkles },
  { id: 'characters', label: 'ตัวละคร', icon: Users },
  { id: 'voice', label: 'ห้องพากย์', icon: Mic2 },
  { id: 'director', label: 'กำกับฉาก', icon: Clapperboard },
  { id: 'studio', label: 'สตูดิโอ', icon: Film },
  { id: 'projects', label: 'โปรเจกต์', icon: FolderKanban },
  { id: 'storage', label: 'คลังเครื่อง', icon: HardDrive },
  { id: 'settings', label: 'ตั้งค่า API', icon: KeyRound },
];

export function TopBar({
  activeTab,
  onChangeTab,
  hasProject,
  workspaceName,
  isLocked,
  authProfile,
  isAuthBusy,
  onSignInGoogle,
  onSwitchAccount,
  onSignOut,
  onOpenDemo3D,
}: TopBarProps) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a0b10]">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onChangeTab('create')}
              className="whitespace-nowrap text-left text-lg font-extrabold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-md cursor-pointer"
            >
              ZKatoon <span className="text-violet-400 font-semibold text-xs ml-1">3D Studio</span>
            </button>
          </div>

          <nav
            aria-label="หลัก"
            className="hidden xl:flex items-center gap-1.5 text-[13px] font-medium overflow-x-auto"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] px-2.5 rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'border-violet-500/60 bg-violet-500/15 text-white font-semibold'
                      : 'border-transparent text-[#9894b8] hover:bg-white/[0.04] hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChangeTab('storage')}
              title="จัดการ Workspace ในเครื่อง"
              className="hidden md:inline-flex items-center gap-1.5 whitespace-nowrap min-h-[36px] rounded-lg border border-white/10 bg-[#13141d] px-2.5 text-xs text-[#d6d3eb] hover:border-violet-400/40 cursor-pointer"
            >
              {isLocked && <Lock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />}
              <span className="max-w-[110px] truncate">{workspaceName}</span>
            </button>

            {/* Account / Guest Menu */}
            <div className="relative">
              <button
                type="button"
                disabled={isAuthBusy}
                onClick={() => setAccountMenuOpen((o) => !o)}
                aria-expanded={accountMenuOpen}
                aria-label="บัญชีผู้ใช้และโหมด Guest"
                className="inline-flex items-center gap-1.5 whitespace-nowrap min-h-[36px] rounded-lg border border-white/10 bg-[#13141d] px-2.5 text-xs font-medium text-[#e7e4f8] hover:border-violet-400/50 disabled:opacity-50 cursor-pointer"
              >
                {authProfile?.photoURL ? (
                  <img
                    src={authProfile.photoURL}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-3.5 w-3.5 text-violet-400 shrink-0" aria-hidden="true" />
                )}
                <span className="max-w-[96px] truncate">
                  {authProfile ? authProfile.displayName : 'Guest'}
                </span>
                <ChevronDown className="h-3 w-3 text-[#9894b8]" aria-hidden="true" />
              </button>

              {accountMenuOpen && (
                <div
                  role="dialog"
                  aria-label="จัดการบัญชีผู้ใช้"
                  className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/15 bg-[#13141d] p-4 shadow-2xl z-50 space-y-3"
                >
                  {authProfile ? (
                    <>
                      <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
                        {authProfile.photoURL ? (
                          <img
                            src={authProfile.photoURL}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600/30 text-violet-200 font-bold text-sm shrink-0">
                            {authProfile.displayName.slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {authProfile.displayName}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-[#9894b8] truncate">
                            UID: {authProfile.uid}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={isAuthBusy}
                          onClick={() => {
                            setAccountMenuOpen(false);
                            onSwitchAccount();
                          }}
                          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-2 text-xs font-medium text-white hover:border-violet-400/50 cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
                          <span>เปลี่ยนบัญชี Google</span>
                        </button>
                        <button
                          type="button"
                          disabled={isAuthBusy}
                          onClick={() => {
                            setAccountMenuOpen(false);
                            onSignOut();
                          }}
                          className="flex w-full items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200 hover:bg-rose-500/20 cursor-pointer"
                        >
                          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>ออกจากระบบ (ใช้โหมด Guest)</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1 border-b border-white/10 pb-3">
                        <div className="text-xs font-bold text-white">โหมด Guest (ใช้งานในเครื่อง)</div>
                        <p className="text-[11px] text-[#9894b8] leading-relaxed">
                          ใช้งานได้ครบทุกฟังก์ชันโดยไม่ต้องล็อกอิน ข้อมูลทั้งหมดอยู่ในเครื่องนี้ หรือเข้าสู่ระบบด้วย Google เพื่อซิงก์คลาวด์แยกตาม UID
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={isAuthBusy}
                          onClick={() => {
                            setAccountMenuOpen(false);
                            onSignInGoogle();
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-100 cursor-pointer"
                        >
                          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Sign in with Google</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountMenuOpen(false)}
                          className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-[#1b1d29] px-3 py-2 text-xs font-medium text-[#d6d3eb] hover:text-white cursor-pointer"
                        >
                          Continue as Guest
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={hasProject ? () => onChangeTab('studio') : onOpenDemo3D}
              className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] rounded-xl bg-violet-600 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-violet-500 cursor-pointer"
            >
              <Film className="h-4 w-4" aria-hidden="true" />
              <span>{hasProject ? 'เข้าสตูดิโอ' : 'เปิดตัวอย่าง 3D'}</span>
            </button>
          </div>
        </div>

        {/* Tablet & Mobile horizontal scrollable 8-menu strip */}
        <nav
          aria-label="เมนูทั้งหมด"
          className="xl:hidden flex items-center gap-1.5 overflow-x-auto border-t border-white/[0.06] px-3 py-2 no-scrollbar"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[36px] rounded-lg px-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white font-semibold'
                    : 'bg-[#13141d] text-[#9894b8] hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </header>
    </>
  );
}
