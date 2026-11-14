import {
  Clapperboard,
  Film,
  FolderKanban,
  HardDrive,
  KeyRound,
  Lock,
  Mic2,
  Sparkles,
  Users,
} from 'lucide-react';

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
  onOpenDemo3D,
}: TopBarProps) {
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
              className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap min-h-[36px] rounded-lg border border-white/10 bg-[#13141d] px-2.5 text-xs text-[#d6d3eb] hover:border-violet-400/40 cursor-pointer"
            >
              {isLocked && <Lock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />}
              <span className="max-w-[120px] truncate">{workspaceName}</span>
            </button>

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
