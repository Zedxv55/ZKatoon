import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../utils/usePWAInstall';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500/20 border-b border-amber-400/30 px-3 py-1.5 text-xs font-medium text-amber-200"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>โหมดออฟไลน์ — ยังดูและแก้ไขโปรเจกต์ในเครื่องได้ตามปกติ (AI/TTS ต้องใช้อินเทอร์เน็ต)</span>
    </div>
  );
}
