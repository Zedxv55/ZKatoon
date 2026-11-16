import { Film } from 'lucide-react';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  brandName?: string;
  tagline?: string;
  durationMs?: number;
  onDone: () => void;
}

export function SplashScreen({
  brandName = 'ZKatoon AI Video Studio',
  tagline = 'Create Your Story with AI',
  durationMs = 650,
  onDone,
}: SplashScreenProps) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const effectiveMs = reducedMotion ? 150 : Math.min(850, Math.max(450, durationMs));

    const t1 = window.setTimeout(() => setFading(true), effectiveMs);
    const t2 = window.setTimeout(() => onDone(), effectiveMs + (reducedMotion ? 50 : 220));
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [durationMs, onDone]);

  return (
    <div
      data-testid="zkatoon-splash"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#090a0f] px-6 text-center transition-opacity duration-200 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-400/20 via-violet-500/15 to-transparent shadow-2xl">
        <Film className="h-8 w-8 text-amber-300" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-extrabold tracking-tight text-white md:text-2xl">{brandName}</h1>
      <p className="mt-1.5 text-sm font-medium text-amber-300/90">{tagline}</p>
      <button
        type="button"
        onClick={onDone}
        className="mt-6 text-xs text-white/45 underline-offset-4 hover:text-white/80 hover:underline cursor-pointer"
      >
        เข้าสู่สตูดิโอทันที
      </button>
    </div>
  );
}
