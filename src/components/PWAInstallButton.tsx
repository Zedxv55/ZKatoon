import { Download, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';

export function PWAInstallButton({ compact = false }: { compact?: boolean }) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 font-bold text-slate-950 transition-transform active:scale-95 cursor-pointer ${
          compact ? 'min-h-[40px] px-3 text-xs' : 'min-h-[48px] px-4 text-sm'
        }`}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>ติดตั้งแอปลงเครื่อง (PWA)</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 font-semibold text-amber-200 transition-colors cursor-pointer ${
            compact ? 'min-h-[40px] px-3 text-xs' : 'min-h-[48px] px-4 text-sm'
          }`}
        >
          <Smartphone className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>ติดตั้งบน iPhone / iPad</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#13141d] p-5 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">ติดตั้งแอปลงหน้าจอโฮม</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white/70 cursor-pointer"
                  aria-label="ปิด"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="space-y-2 text-sm text-[#c7c3e0] list-decimal pl-5">
                <li>แตะปุ่ม <strong>แชร์ (Share)</strong> ที่แถบล่างของ Safari</li>
                <li>เลื่อนลงแล้วเลือก <strong>เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)</strong></li>
                <li>แตะ <strong>เพิ่ม (Add)</strong> เพื่อเปิดใช้งานแบบออฟไลน์ได้ทันที</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[48px] rounded-xl bg-amber-400 font-bold text-slate-950 cursor-pointer"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
