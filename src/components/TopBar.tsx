import { Film, FolderKanban, Play, SlidersHorizontal, Sparkles } from 'lucide-react';

export type AppTab = 'create' | 'studio' | 'projects' | 'settings';

interface TopBarProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  hasProject: boolean;
  onOpenDemo: () => void;
}

const NAV_ITEMS: Array<{ id: AppTab; label: string; icon: typeof Sparkles }> = [
  { id: 'create', label: 'สร้างการ์ตูน', icon: Sparkles },
  { id: 'studio', label: 'สตูดิโอวิดีโอ', icon: Film },
  { id: 'projects', label: 'โปรเจกต์', icon: FolderKanban },
  { id: 'settings', label: 'ตั้งค่าเสียง', icon: SlidersHorizontal },
];

export function TopBar({ activeTab, onChangeTab, hasProject, onOpenDemo }: TopBarProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0a0b10]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => onChangeTab('create')}
            className="whitespace-nowrap shrink-0 text-left text-lg font-bold tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-md"
          >
            AI Cartoon Studio
          </button>

          <nav
            aria-label="หลัก"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  className={`whitespace-nowrap shrink-0 min-h-[40px] px-1 border-b-2 transition-colors cursor-pointer ${
                    active
                      ? 'border-violet-400 text-white font-semibold'
                      : 'border-transparent text-[#9894b8] hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={
                activeTab === 'studio'
                  ? () => onChangeTab('create')
                  : hasProject
                    ? () => onChangeTab('studio')
                    : onOpenDemo
              }
              className="inline-flex items-center gap-2 whitespace-nowrap shrink-0 min-h-[40px] rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 cursor-pointer"
            >
              {activeTab === 'studio' ? (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>สร้างเรื่องใหม่</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>{hasProject ? 'เปิดสตูดิโอ' : 'ลองเล่นตัวอย่าง'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="เมนูล่าง"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-4 border-t border-white/[0.08] bg-[#0d0e15]/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer ${
                active ? 'text-violet-300' : 'text-[#9894b8] hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
