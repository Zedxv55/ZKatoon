import { CheckCircle2, Clock, CreditCard, Gift, QrCode, Upload, X } from 'lucide-react';
import { useState } from 'react';
import type {
  CreditLedgerEntry,
  CreditWallet,
  ManualPaymentRecord,
  PlatformUserRecord,
  SystemSettings,
} from '../../types/platform';
import { platformApi } from '../../utils/platformApi';

interface BillingModalProps {
  user: PlatformUserRecord | null;
  wallet: CreditWallet | null;
  payments: ManualPaymentRecord[];
  ledger: CreditLedgerEntry[];
  settings: Partial<SystemSettings>;
  onRefresh: () => Promise<void>;
  onRequireLogin: () => void;
  onClose: () => void;
}

export function BillingModal({
  user,
  wallet,
  payments,
  ledger,
  settings,
  onRefresh,
  onRequireLogin,
  onClose,
}: BillingModalProps) {
  const [slipDataUrl, setSlipDataUrl] = useState<string>('');
  const [slipNote, setSlipNote] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const price = settings.studioPassPriceThb ?? 350;
  const days = settings.studioPassDays ?? 30;
  const monthlyCredits = settings.studioPassMonthlyCredits ?? 1500;

  const handleSlipFile = (file: File | null) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      setErr('ไฟล์สลิปใหญ่เกิน 1.5 MB กรุณาย่อรูปก่อนอัปโหลด');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setSlipDataUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitManual = async () => {
    if (!user) {
      onRequireLogin();
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await platformApi.submitManualPayment({
        slipImageDataUrl: slipDataUrl || undefined,
        slipNote,
      });
      setSlipDataUrl('');
      setSlipNote('');
      await onRefresh();
      setMsg(
        `ส่งคำขอแจ้งโอนสำเร็จ (รหัสอ้างอิง ${res.payment.referenceCode}) — สถานะปัจจุบัน: รอผู้ดูแลระบบตรวจสอบและอนุมัติ`
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRedeem = async () => {
    if (!user) {
      onRequireLogin();
      return;
    }
    if (!codeInput.trim()) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await platformApi.redeemAccessCode(codeInput);
      setCodeInput('');
      await onRefresh();
      setMsg(`แลกรหัสสำเร็จ! แพ็กเกจปัจจุบัน: ${res.tier} • ได้รับ +${res.creditsAdded} เครดิต`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="billing-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm"
    >
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#12131c] shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <CreditCard className="h-4 w-4 text-amber-300" />
            <span>สมาชิก Studio Pass & กระเป๋าเครดิต</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างสมาชิก"
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-white/70 hover:bg-white/10 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {/* Wallet Summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#191a26] p-3">
              <div className="text-[11px] text-[#9894b8]">แพ็กเกจปัจจุบัน</div>
              <div className="mt-1 text-base font-extrabold text-white">
                {user?.tier === 'studio_pass' ? 'Studio Pass' : 'Free Member (BYOK)'}
              </div>
              {user?.subscriptionExpiresAt && (
                <div className="mt-0.5 text-[11px] text-amber-300">
                  หมดอายุ: {new Date(user.subscriptionExpiresAt).toLocaleDateString('th-TH')}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-[#191a26] p-3">
              <div className="text-[11px] text-[#9894b8]">เครดิตคงเหลือ</div>
              <div className="mt-1 font-mono-tabular text-xl font-extrabold text-amber-300">
                {wallet ? wallet.balance.toLocaleString() : '—'}
              </div>
              <div className="text-[11px] text-[#9894b8]">
                จองระหว่างรัน: {wallet?.reserved ?? 0} • ใช้ไปแล้ว: {wallet?.totalSpent ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#191a26] p-3">
              <div className="text-[11px] text-[#9894b8]">Payment Gateway อัตโนมัติ</div>
              <div className="mt-1 text-sm font-bold text-white">
                {settings.gatewayConfigured
                  ? `เชื่อมต่อ ${settings.gatewayProvider} แล้ว`
                  : 'NOT CONFIGURED'}
              </div>
              <div className="text-[11px] text-[#9894b8]">
                {settings.gatewayConfigured
                  ? 'รองรับชำระเงินอัตโนมัติ'
                  : 'ใช้ PromptPay แนบสลิป หรือ Activation Code ด้านล่าง'}
              </div>
            </div>
          </div>

          {settings.promoBannerText && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3.5 py-2.5 text-xs font-semibold text-amber-200">
              {settings.promoBannerText}
            </div>
          )}

          {/* Redeem Code */}
          <div className="rounded-xl border border-white/10 bg-[#191a26] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Gift className="h-4 w-4 text-emerald-300" />
              <span>แลกรหัสใช้งาน / Activation Code (Single-use)</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                placeholder="กรอกรหัส เช่น ZKSTUDIO30"
                className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm font-mono-tabular text-white"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRedeem()}
                className="min-h-[42px] rounded-xl bg-emerald-400 px-4 text-xs font-extrabold text-slate-950 hover:bg-emerald-300 cursor-pointer"
              >
                แลกสิทธิ์
              </button>
            </div>
          </div>

          {/* Manual PromptPay */}
          {settings.manualPaymentEnabled !== false && (
            <div className="rounded-xl border border-white/10 bg-[#191a26] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <QrCode className="h-4 w-4 text-amber-300" />
                  <span>ชำระเงินผ่าน PromptPay / โอนธนาคาร (อนุมัติโดยผู้ดูแลระบบ)</span>
                </div>
                <span className="font-mono-tabular text-sm font-extrabold text-amber-300">
                  {price} THB / {days} วัน (+{monthlyCredits.toLocaleString()} เครดิต)
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-[#c7c3e0] space-y-1">
                <div>
                  <span className="text-[#9894b8]">PromptPay ID: </span>
                  <span className="font-mono-tabular font-bold text-white">
                    {settings.promptPayId || 'ยังไม่ได้ตั้งค่า (กรุณาติดต่อ Super Admin)'}
                  </span>
                </div>
                <div>
                  <span className="text-[#9894b8]">ชื่อบัญชี: </span>
                  <span className="text-white">{settings.promptPayAccountName || '-'}</span>
                </div>
                <div>{settings.bankAccountInfo}</div>
                {settings.promptPayQrDataUrl && (
                  <img
                    src={settings.promptPayQrDataUrl}
                    alt="PromptPay QR"
                    className="mt-2 h-36 w-36 rounded-lg bg-white p-1 object-contain"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <label className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 bg-black/30 px-3 text-xs font-semibold text-white/85 hover:border-amber-400">
                  <Upload className="h-4 w-4 text-amber-300" />
                  <span>{slipDataUrl ? 'เลือกสลิปใหม่ (อัปโหลดแล้ว)' : 'แนบรูปสลิปการโอน'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleSlipFile(e.target.files?.[0] || null)}
                  />
                </label>
                <input
                  type="text"
                  value={slipNote}
                  onChange={(e) => setSlipNote(e.target.value)}
                  placeholder="หมายเหตุ / เวลาโอน / 4 ตัวท้ายบัญชี"
                  className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSubmitManual()}
                className="min-h-[44px] w-full rounded-xl bg-amber-400 text-xs font-extrabold text-slate-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer"
              >
                {busy ? 'กำลังส่งคำขอ...' : 'ส่งหลักฐานการโอนเงิน (รอผู้ดูแลอนุมัติ)'}
              </button>
            </div>
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

          {/* User Payment History */}
          {payments.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#191a26] p-3 space-y-2">
              <div className="text-xs font-bold text-white">ประวัติคำขอชำระเงินของคุณ</div>
              <div className="space-y-1.5">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-mono-tabular font-bold text-white">{p.referenceCode}</span>
                      <span className="ml-2 text-[#9894b8]">{p.amountThb} THB</span>
                      {p.rejectReason && (
                        <span className="ml-2 text-rose-300">เหตุผล: {p.rejectReason}</span>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        p.status === 'approved'
                          ? 'text-emerald-300'
                          : p.status === 'rejected'
                            ? 'text-rose-300'
                            : 'text-amber-300'
                      }`}
                    >
                      {p.status === 'approved' ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        <Clock className="h-3.5 w-3.5" />
                      )}
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Credit Ledger */}
          {ledger.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#191a26] p-3 space-y-2">
              <div className="text-xs font-bold text-white">รายการเคลื่อนไหวเครดิตล่าสุด</div>
              <div className="max-h-44 space-y-1 overflow-y-auto">
                {ledger.slice(0, 15).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/25 px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate text-[#c7c3e0]">{tx.note}</span>
                    <span
                      className={`font-mono-tabular shrink-0 font-bold ${
                        tx.amount > 0 ? 'text-emerald-300' : tx.amount < 0 ? 'text-rose-300' : 'text-white/60'
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount} (คงเหลือ {tx.balanceAfter})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
