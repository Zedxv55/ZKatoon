import { BookOpen, X } from 'lucide-react';
import { useState } from 'react';
import type { CmsPageRecord } from '../../types/platform';

interface CmsPagesModalProps {
  pages: CmsPageRecord[];
  initialSlug?: string;
  onActionCreate?: () => void;
  onClose: () => void;
}

export function CmsPagesModal({ pages, initialSlug = 'home', onActionCreate, onClose }: CmsPagesModalProps) {
  const [activeSlug, setActiveSlug] = useState(initialSlug);
  const current = pages.find((p) => p.slug === activeSlug) || pages[0];

  return (
    <div
      data-testid="cms-pages-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm"
    >
      <div className="flex max-h-[90dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#12131c] shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-300" />
            <div className="flex gap-1.5">
              {pages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveSlug(p.slug)}
                  className={`min-h-[36px] rounded-lg px-3 text-xs font-bold cursor-pointer ${
                    current?.slug === p.slug
                      ? 'bg-amber-400 text-slate-950'
                      : 'border border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างคู่มือและราคา"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-white/70 hover:bg-white/10 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          {!current ? (
            <div className="text-center text-sm text-[#9894b8]">ยังไม่มีหน้าเว็บที่เผยแพร่</div>
          ) : (
            <div className="grid grid-cols-12 gap-4">
              {current.blocks.map((blk) => {
                const colClass =
                  blk.widthCols === 4
                    ? 'col-span-12 md:col-span-4'
                    : blk.widthCols === 6
                      ? 'col-span-12 md:col-span-6'
                      : 'col-span-12';
                return (
                  <section
                    key={blk.id}
                    className={`${colClass} rounded-2xl border border-white/10 bg-[#191a26] p-5`}
                  >
                    {blk.type === 'hero' ? (
                      <div className="space-y-3 text-center py-4">
                        <h2 className="text-2xl font-extrabold text-white">{blk.title}</h2>
                        {blk.subtitle && (
                          <p className="text-sm font-semibold text-amber-300">{blk.subtitle}</p>
                        )}
                        {blk.body && (
                          <p className="mx-auto max-w-2xl text-sm text-[#c7c3e0]">{blk.body}</p>
                        )}
                        {blk.ctaLabel && (
                          <button
                            type="button"
                            onClick={() => {
                              onActionCreate?.();
                              onClose();
                            }}
                            className="mt-2 min-h-[44px] rounded-xl bg-amber-400 px-6 text-sm font-extrabold text-slate-950 hover:bg-amber-300 cursor-pointer"
                          >
                            {blk.ctaLabel}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <h3 className="text-base font-extrabold text-white">{blk.title}</h3>
                        {blk.subtitle && <p className="text-xs text-[#9894b8]">{blk.subtitle}</p>}
                        {blk.body && <p className="text-sm text-[#c7c3e0]">{blk.body}</p>}
                        {blk.mediaUrl && (
                          <img
                            src={blk.mediaUrl}
                            alt={blk.title}
                            className="max-h-64 w-full rounded-xl object-cover"
                          />
                        )}
                        {blk.items && blk.items.length > 0 && (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {blk.items.map((it, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl border border-white/10 bg-black/30 p-3.5"
                              >
                                {it.badge && (
                                  <span className="mb-1 inline-block text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                    {it.badge}
                                  </span>
                                )}
                                <div className="text-sm font-bold text-white">{it.title}</div>
                                <div className="mt-1 text-xs text-[#c7c3e0]">{it.description}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
