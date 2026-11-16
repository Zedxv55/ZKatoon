import { CheckCircle2, KeyRound, Mail, RefreshCw, ShieldAlert, X } from 'lucide-react';
import { useState } from 'react';
import {
  refreshCurrentFirebaseUser,
  resendVerificationEmail,
  sendResetPasswordEmail,
  signInWithEmailPassword,
  signInWithGooglePopup,
  signUpWithEmailPassword,
} from '../../utils/firebaseClient';

interface AuthModalProps {
  currentEmail?: string | null;
  emailVerified?: boolean;
  isSignedIn: boolean;
  onAuthChanged: () => Promise<void> | void;
  onClose: () => void;
}

export function AuthModal({
  currentEmail,
  emailVerified,
  isSignedIn,
  onAuthChanged,
  onClose,
}: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    setErr(null);
    try {
      if (mode === 'forgot') {
        await sendResetPasswordEmail(email);
        setMsg('ส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลของคุณแล้ว');
      } else if (mode === 'register') {
        await signUpWithEmailPassword(email, password, displayName);
        await onAuthChanged();
        setMsg('สมัครสมาชิกสำเร็จ! ระบบส่งอีเมลยืนยันตัวตน (Verification Email) ไปแล้ว กรุณากดยืนยันในกล่องจดหมาย');
      } else {
        await signInWithEmailPassword(email, password);
        await onAuthChanged();
        onClose();
      }
    } catch (e2) {
      const raw = e2 instanceof Error ? e2.message : String(e2);
      if (raw.includes('auth/operation-not-allowed')) {
        setErr(
          'ผู้ดูแลระบบยังไม่ได้เปิดใช้งาน Email/Password Sign-In ใน Firebase Console ของโปรเจกต์นี้ — กรุณาใช้ปุ่ม Google Sign-In ด้านล่างแทน'
        );
      } else {
        setErr(raw);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setErr(null);
    try {
      await signInWithGooglePopup(true);
      await onAuthChanged();
      onClose();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const handleCheckVerify = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await refreshCurrentFirebaseUser();
      await onAuthChanged();
      if (res.emailVerified) {
        setMsg('ยืนยันอีเมลเรียบร้อยแล้ว!');
      } else {
        setErr('ระบบยังไม่พบสถานะยืนยันอีเมล กรุณาคลิกลิงก์ในอีเมลแล้วกดตรวจสอบอีกครั้ง');
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    setBusy(true);
    setErr(null);
    try {
      await resendVerificationEmail();
      setMsg('ส่งอีเมลยืนยันซ้ำเรียบร้อยแล้ว กรุณาตรวจสอบ Inbox / Spam');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-[#12131c] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <KeyRound className="h-4 w-4 text-amber-300" />
            <span>
              {isSignedIn
                ? 'สถานะบัญชีและยืนยันอีเมล'
                : mode === 'register'
                  ? 'สมัครสมาชิก ZKatoon Studio'
                  : mode === 'forgot'
                    ? 'กู้คืนรหัสผ่าน'
                    : 'เข้าสู่ระบบ ZKatoon Studio'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างเข้าสู่ระบบ"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-white/70 hover:bg-white/10 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          {isSignedIn && currentEmail && (
            <div className="rounded-xl border border-white/10 bg-[#191a26] p-3.5 space-y-2.5">
              <div className="text-xs text-[#9894b8]">อีเมลปัจจุบัน</div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-white">{currentEmail}</span>
                {emailVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" /> ยืนยันแล้ว
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                    <ShieldAlert className="h-4 w-4" /> ยังไม่ยืนยันอีเมล
                  </span>
                )}
              </div>
              {!emailVerified && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleResend()}
                    className="min-h-[40px] rounded-xl border border-amber-400/30 bg-amber-400/15 px-3 text-xs font-bold text-amber-200 cursor-pointer"
                  >
                    ส่งอีเมลยืนยันซ้ำ
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCheckVerify()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-emerald-400 px-3 text-xs font-bold text-slate-950 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span>ฉันยืนยันแล้ว (รีเฟรช)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {!isSignedIn && (
            <>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-black/40 p-1">
                {(
                  [
                    { id: 'login', label: 'เข้าสู่ระบบ' },
                    { id: 'register', label: 'สมัครสมาชิก' },
                    { id: 'forgot', label: 'ลืมรหัสผ่าน' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setMode(t.id);
                      setErr(null);
                      setMsg(null);
                    }}
                    className={`min-h-[38px] rounded-lg text-xs font-bold cursor-pointer ${
                      mode === t.id ? 'bg-amber-400 text-slate-950' : 'text-white/70 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
                {mode === 'register' && (
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="ชื่อแสดงผล (Display Name)"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white"
                  />
                )}
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="อีเมล (Email)"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white"
                />
                {mode !== 'forgot' && (
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white"
                  />
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-xl bg-amber-400 text-sm font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
                >
                  {busy
                    ? 'กำลังดำเนินการ...'
                    : mode === 'register'
                      ? 'สมัครสมาชิก & ส่งอีเมลยืนยัน'
                      : mode === 'forgot'
                        ? 'ส่งลิงก์รีเซ็ตรหัสผ่าน'
                        : 'เข้าสู่ระบบ'}
                </button>
              </form>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-white/10" />
                <span className="mx-3 text-[11px] text-[#9894b8]">หรือ</span>
                <div className="flex-grow border-t border-white/10" />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleGoogle()}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-white hover:bg-white/10 cursor-pointer"
              >
                <Mail className="h-4 w-4 text-amber-300" />
                <span>เข้าสู่ระบบด้วย Google</span>
              </button>
            </>
          )}

          {err && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-xs text-rose-200">
              {err}
            </div>
          )}
          {msg && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-3 text-xs text-emerald-200">
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
