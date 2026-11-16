import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bot,
  Check,
  Coins,
  Compass,
  CreditCard,
  FileText,
  Film,
  Gift,
  Globe,
  KeyRound,
  Layout,
  Layers,
  Mic,
  Monitor,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type {
  CmsPageRecord,
  ModelCategory,
  ModelRegistryItem,
  PageBlockItem,
  PageBlockType,
  SystemSettings,
} from '../../types/platform';
import { ANIMATE_STYLE_PLUGINS } from '../../utils/animateStyles';
import { platformApi, type AdminDashboardResponse } from '../../utils/platformApi';
import { WORKFLOW_NODE_DEFINITIONS, WORKFLOW_TEMPLATES } from '../../utils/workflowRegistry';

interface AdminDashboardProps {
  onClose: () => void;
  onBootstrapRefresh: () => Promise<void>;
}

type AdminMenuId =
  | 'overview'
  | 'users'
  | 'membership'
  | 'payments'
  | 'access_codes'
  | 'providers'
  | 'models'
  | 'credits'
  | 'voice'
  | 'animation'
  | 'map'
  | 'workflow_builder'
  | 'page_builder'
  | 'templates'
  | 'render_jobs'
  | 'logs'
  | 'security'
  | 'website';

const ADMIN_MENUS: Array<{ id: AdminMenuId; label: string; icon: typeof Activity }> = [
  { id: 'overview', label: '1. Overview', icon: Activity },
  { id: 'users', label: '2. User Management', icon: Users },
  { id: 'membership', label: '3. Membership Management', icon: CreditCard },
  { id: 'payments', label: '4. Payment Management', icon: Coins },
  { id: 'access_codes', label: '5. Access Code Management', icon: Gift },
  { id: 'providers', label: '6. API Provider Management', icon: KeyRound },
  { id: 'models', label: '7. Model Management', icon: Bot },
  { id: 'credits', label: '8. Credit Management', icon: Coins },
  { id: 'voice', label: '9. Voice Management', icon: Mic },
  { id: 'animation', label: '10. Animation Engine', icon: Palette },
  { id: 'map', label: '11. Map Engine', icon: Compass },
  { id: 'workflow_builder', label: '12. Workflow Node Builder', icon: Workflow },
  { id: 'page_builder', label: '13. Page Builder (LEGO)', icon: Layout },
  { id: 'templates', label: '14. Template Management', icon: Layers },
  { id: 'render_jobs', label: '15. Jobs & Render Monitor', icon: Film },
  { id: 'logs', label: '16. System Logs', icon: FileText },
  { id: 'security', label: '17. Security Settings', icon: Shield },
  { id: 'website', label: '18. Website Settings', icon: Globe },
];

const MODEL_CATEGORIES: ModelCategory[] = [
  'LLM',
  'Vision',
  'Image Generation',
  'Image Editing',
  'Text-to-Speech',
  'Speech-to-Text',
  'Audio Generation',
  'Video Generation',
  'Video Editing',
  'Embedding',
  'Animation',
  'Map Rendering',
];

const PAGE_BLOCK_TYPES: PageBlockType[] = [
  'header',
  'hero',
  'text',
  'image',
  'video',
  'gallery',
  'feature_cards',
  'pricing',
  'faq',
  'testimonials',
  'cta',
  'contact_form',
  'footer',
  'custom_section',
];

export function AdminDashboard({ onClose, onBootstrapRefresh }: AdminDashboardProps) {
  const [menu, setMenu] = useState<AdminMenuId>('overview');
  const [data, setData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Forms state
  const [creditTargetUid, setCreditTargetUid] = useState('');
  const [creditDelta, setCreditDelta] = useState('100');
  const [creditNote, setCreditNote] = useState('โบนัสจากผู้ดูแลระบบ');

  const [newCode, setNewCode] = useState('');
  const [newCodeDays, setNewCodeDays] = useState('30');
  const [newCodeCredits, setNewCodeCredits] = useState('500');
  const [newCodeMaxUses, setNewCodeMaxUses] = useState('1');

  const [providerKeys, setProviderKeys] = useState<Record<string, string>>({});
  const [modelCatFilter, setModelCatFilter] = useState<ModelCategory | 'ALL'>('ALL');
  const [newModelId, setNewModelId] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelCat, setNewModelCat] = useState<ModelCategory>('LLM');
  const [newModelProvider, setNewModelProvider] = useState('openrouter');
  const [newModelFree, setNewModelFree] = useState(true);

  const [settingsDraft, setSettingsDraft] = useState<SystemSettings | null>(null);
  const [gatewaySecretDraft, setGatewaySecretDraft] = useState('');
  const [gatewayKeyDraft, setGatewayKeyDraft] = useState('');

  // Admin LEGO Page Builder state
  const [activePageId, setActivePageId] = useState<string>('');
  const [pageDraft, setPageDraft] = useState<CmsPageRecord | null>(null);
  const [pageViewport, setPageViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [newBlockType, setNewBlockType] = useState<PageBlockType>('feature_cards');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await platformApi.adminDashboard();
      setData(res);
      setSettingsDraft(res.settings);
      if (res.users.length > 0 && !creditTargetUid) {
        setCreditTargetUid(res.users[0].uid);
      }
      if (res.pages.length > 0) {
        const chosen = res.pages.find((p) => p.id === activePageId) || res.pages[0];
        setActivePageId(chosen.id);
        setPageDraft(JSON.parse(JSON.stringify(chosen)) as CmsPageRecord);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activePageId, creditTargetUid]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const runAction = async (fn: () => Promise<void>, successText: string) => {
    setBusy(true);
    setErr(null);
    setNotice(null);
    try {
      await fn();
      await loadDashboard();
      await onBootstrapRefresh();
      setNotice(successText);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleMoveBlock = (idx: number, dir: -1 | 1) => {
    if (!pageDraft) return;
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= pageDraft.blocks.length) return;
    const copy = [...pageDraft.blocks];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    setPageDraft({ ...pageDraft, blocks: copy });
  };

  const handleAddBlock = () => {
    if (!pageDraft) return;
    const blk: PageBlockItem = {
      id: `blk_${Date.now().toString(36)}`,
      type: newBlockType,
      title: `บล็อก ${newBlockType}`,
      subtitle: 'คำอธิบายย่อย',
      body: 'เนื้อหาตัวอย่างในบล็อกนี้สามารถแก้ไขได้ทันที',
      widthCols: 12,
    };
    setPageDraft({ ...pageDraft, blocks: [...pageDraft.blocks, blk] });
  };

  return (
    <div
      data-testid="admin-dashboard"
      className="fixed inset-0 z-50 flex flex-col bg-[#0a0b10] text-white"
    >
      <header className="flex items-center justify-between border-b border-white/10 bg-[#12131c] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Shield className="h-5 w-5 text-amber-300" />
          <div>
            <div className="text-sm font-extrabold text-white">ZKatoon Super Admin Console (18 Menus)</div>
            <div className="text-[11px] text-[#9894b8]">
              Storage Mode: {data?.overview.storageMode || 'loading...'} • Backend ID-Token Verified
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold hover:bg-white/10 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>รีเฟรช</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer"
            aria-label="ปิดหน้าต่างผู้ดูแลระบบ"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 18-Menu Sidebar */}
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-white/10 bg-[#0e0f17] p-2 space-y-0.5 hidden md:block">
          {ADMIN_MENUS.map((m) => {
            const Icon = m.icon;
            const active = menu === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMenu(m.id)}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-amber-400 text-slate-950 font-extrabold'
                    : 'text-[#c7c3e0] hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{m.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Mobile menu selector */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-white/10 bg-[#0e0f17] p-2 md:hidden">
            <select
              value={menu}
              onChange={(e) => setMenu(e.target.value as AdminMenuId)}
              className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-bold text-white"
            >
              {ADMIN_MENUS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <main className="flex-1 overflow-y-auto p-4 space-y-4">
            {err && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 text-xs text-rose-200">
                {err}
              </div>
            )}
            {notice && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/60 p-3 text-xs text-emerald-200">
                {notice}
              </div>
            )}

            {loading || !data || !settingsDraft ? (
              <div className="text-sm text-[#9894b8]">กำลังโหลดข้อมูลผู้ดูแลระบบ...</div>
            ) : (
              <>
                {menu === 'overview' && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {[
                      { k: 'ผู้ใช้ทั้งหมด', v: data.overview.totalUsers },
                      { k: 'Free Users', v: data.overview.freeUsers },
                      { k: 'Studio Pass Active', v: data.overview.paidUsers },
                      { k: 'Expired Subscriptions', v: data.overview.expiredUsers },
                      { k: 'งานเรนเดอร์กำลังทำ', v: data.overview.activeJobs },
                      { k: 'งานเรนเดอร์สำเร็จ', v: data.overview.completedJobs },
                      { k: 'เครดิตใช้ไปทั้งหมด', v: data.overview.totalCreditsUsed.toLocaleString() },
                      { k: 'รายได้อนุมัติแล้ว (THB)', v: `${data.overview.totalRevenueThb.toLocaleString()} ฿` },
                      { k: 'สลิปรอตรวจสอบ', v: data.overview.pendingPayments },
                      { k: 'ประมาณการต้นทุน API', v: `$${data.overview.estimatedApiCostUsd}` },
                    ].map((card) => (
                      <div
                        key={card.k}
                        className="rounded-2xl border border-white/10 bg-[#151622] p-3.5"
                      >
                        <div className="text-[11px] text-[#9894b8]">{card.k}</div>
                        <div className="mt-1 font-mono-tabular text-xl font-extrabold text-amber-300">
                          {card.v}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {menu === 'users' && (
                  <div className="space-y-2.5">
                    <h2 className="text-sm font-extrabold">จัดการผู้ใช้งาน (Users)</h2>
                    {data.users.map((u) => (
                      <div
                        key={u.uid}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#151622] p-3 text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {u.displayName} ({u.email})
                          </div>
                          <div className="mt-0.5 font-mono-tabular text-[11px] text-[#9894b8]">
                            role: {u.role} • tier: {u.tier} • status: {u.status} • credits:{' '}
                            {u.wallet?.balance ?? 0}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                () =>
                                  platformApi
                                    .adminUpdateUser(u.uid, {
                                      tier: u.tier === 'studio_pass' ? 'free' : 'studio_pass',
                                    })
                                    .then(() => undefined),
                                `อัปเดตแพ็กเกจของ ${u.email} แล้ว`
                              )
                            }
                            className="rounded-lg border border-amber-400/35 bg-amber-400/15 px-2.5 py-1.5 font-bold text-amber-200 cursor-pointer"
                          >
                            สลับ Free / Studio Pass
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void runAction(
                                () =>
                                  platformApi
                                    .adminUpdateUser(u.uid, {
                                      status: u.status === 'active' ? 'suspended' : 'active',
                                    })
                                    .then(() => undefined),
                                `อัปเดตสถานะบัญชี ${u.email} แล้ว`
                              )
                            }
                            className="rounded-lg border border-rose-500/35 bg-rose-500/15 px-2.5 py-1.5 font-bold text-rose-200 cursor-pointer"
                          >
                            {u.status === 'active' ? 'ระงับบัญชี' : 'ปลดระงับ'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {menu === 'payments' && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-extrabold">ตรวจสลิป & อนุมัติชำระเงิน (Manual PromptPay Queue)</h2>
                    {data.payments.length === 0 ? (
                      <div className="text-xs text-[#9894b8]">ยังไม่มีคำขอแจ้งชำระเงิน</div>
                    ) : (
                      data.payments.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-xl border border-white/10 bg-[#151622] p-3.5 space-y-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-mono-tabular font-extrabold text-amber-300">
                                {p.referenceCode}
                              </span>
                              <span className="ml-2 text-white">{p.userEmail}</span>
                              <span className="ml-2 font-mono-tabular text-emerald-300">
                                {p.amountThb} THB
                              </span>
                            </div>
                            <span className="font-bold uppercase">{p.status}</span>
                          </div>
                          {p.slipNote && <div className="text-[#c7c3e0]">หมายเหตุ: {p.slipNote}</div>}
                          {p.slipImageDataUrl && (
                            <img
                              src={p.slipImageDataUrl}
                              alt="Slip"
                              className="max-h-48 rounded-lg border border-white/10 object-contain"
                            />
                          )}
                          {p.status === 'pending' && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(
                                    () => platformApi.adminApprovePayment(p.id).then(() => undefined),
                                    `อนุมัติรายการ ${p.referenceCode} และอัปเกรด Studio Pass สำเร็จ`
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-3 py-1.5 font-extrabold text-slate-950 cursor-pointer"
                              >
                                <Check className="h-3.5 w-3.5" />
                                <span>อนุมัติ Studio Pass</span>
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void runAction(
                                    () =>
                                      platformApi
                                        .adminRejectPayment(p.id, 'หลักฐานสลิปไม่ถูกต้อง')
                                        .then(() => undefined),
                                    `ปฏิเสธรายการ ${p.referenceCode} แล้ว`
                                  )
                                }
                                className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 font-bold text-rose-200 cursor-pointer"
                              >
                                ปฏิเสธรายการ
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {menu === 'access_codes' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-[#151622] p-3.5 space-y-2.5">
                      <div className="text-xs font-extrabold">สร้างรหัสเปิดใช้งาน (Access Code / Single-use)</div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <input
                          type="text"
                          value={newCode}
                          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                          placeholder="รหัส (เว้นว่าง=สุ่ม)"
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs font-mono-tabular text-white"
                        />
                        <input
                          type="number"
                          value={newCodeDays}
                          onChange={(e) => setNewCodeDays(e.target.value)}
                          placeholder="จำนวนวัน"
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                        <input
                          type="number"
                          value={newCodeCredits}
                          onChange={(e) => setNewCodeCredits(e.target.value)}
                          placeholder="โบนัสเครดิต"
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                        <input
                          type="number"
                          value={newCodeMaxUses}
                          onChange={(e) => setNewCodeMaxUses(e.target.value)}
                          placeholder="จำนวนครั้งสูงสุด"
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            () =>
                              platformApi
                                .adminCreateAccessCode({
                                  code: newCode || undefined,
                                  days: Number(newCodeDays || 30),
                                  bonusCredits: Number(newCodeCredits || 500),
                                  maxUses: Number(newCodeMaxUses || 1),
                                })
                                .then(() => setNewCode('')),
                            'สร้างรหัสเปิดใช้งานเรียบร้อย'
                          )
                        }
                        className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                      >
                        + สร้าง Access Code
                      </button>
                    </div>

                    <div className="space-y-2">
                      {data.accessCodes.map((c) => (
                        <div
                          key={c.code}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-[#151622] px-3 py-2.5 text-xs"
                        >
                          <div>
                            <span className="font-mono-tabular font-extrabold text-amber-300">{c.code}</span>
                            <span className="ml-2 text-[#c7c3e0]">
                              {c.tier} • {c.days} วัน • +{c.bonusCredits} เครดิต • ใช้แล้ว {c.usedCount}/{c.maxUses}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(
                                () => platformApi.adminDeleteAccessCode(c.code).then(() => undefined),
                                `ลบรหัส ${c.code} แล้ว`
                              )
                            }
                            className="text-rose-300 hover:text-rose-200 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {menu === 'providers' && (
                  <div className="space-y-3">
                    <h2 className="text-sm font-extrabold">จัดการผู้ให้บริการ AI กลาง (Central API Providers)</h2>
                    {data.providers.map((p) => {
                      const status = data.providerKeyStatus[p.id];
                      return (
                        <div
                          key={p.id}
                          className="rounded-xl border border-white/10 bg-[#151622] p-3.5 space-y-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="font-bold text-white">{p.name}</span>
                              <span className="ml-2 font-mono-tabular text-[11px] text-[#9894b8]">
                                {p.baseUrl}
                              </span>
                            </div>
                            <span className={status?.configured ? 'text-emerald-300 font-bold' : 'text-amber-300'}>
                              {status?.configured ? `Configured (${status.maskedKey})` : 'No Central Key'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="password"
                              value={providerKeys[p.id] || ''}
                              onChange={(e) =>
                                setProviderKeys((prev) => ({ ...prev, [p.id]: e.target.value }))
                              }
                              placeholder="อัปเดต Central API Key (เข้ารหัส AES-256-GCM บนเซิร์ฟเวอร์)"
                              className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                            />
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void runAction(
                                  () =>
                                    platformApi
                                      .adminSaveProvider({
                                        id: p.id,
                                        enabled: p.enabled,
                                        centralApiKey: providerKeys[p.id] || undefined,
                                      })
                                      .then(() =>
                                        setProviderKeys((prev) => ({ ...prev, [p.id]: '' }))
                                      ),
                                  `บันทึก Provider ${p.name} สำเร็จ`
                                )
                              }
                              className="rounded-xl bg-amber-400 px-3.5 py-2 font-extrabold text-slate-950 cursor-pointer"
                            >
                              บันทึก Key
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void runAction(
                                  () =>
                                    platformApi
                                      .adminSaveProvider({ id: p.id, enabled: !p.enabled })
                                      .then(() => undefined),
                                  `สลับสถานะ ${p.name} แล้ว`
                                )
                              }
                              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 font-bold text-white cursor-pointer"
                            >
                              {p.enabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {(menu === 'models' || menu === 'voice') && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setModelCatFilter('ALL')}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                          modelCatFilter === 'ALL' ? 'bg-amber-400 text-slate-950' : 'bg-white/5 text-white/75'
                        }`}
                      >
                        ทั้งหมด ({data.models.length})
                      </button>
                      {MODEL_CATEGORIES.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setModelCatFilter(c)}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                            modelCatFilter === c ? 'bg-amber-400 text-slate-950' : 'bg-white/5 text-white/75'
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#151622] p-3 space-y-2">
                      <div className="text-xs font-extrabold">เพิ่มโมเดลใหม่เข้าสู่ Registry (12 Categories)</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                        <input
                          type="text"
                          value={newModelId}
                          onChange={(e) => setNewModelId(e.target.value)}
                          placeholder="Model ID เช่น openai/gpt-4o-mini"
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={newModelName}
                          onChange={(e) => setNewModelName(e.target.value)}
                          placeholder="Display Name"
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                        <select
                          value={newModelCat}
                          onChange={(e) => setNewModelCat(e.target.value as ModelCategory)}
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        >
                          {MODEL_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newModelProvider}
                          onChange={(e) => setNewModelProvider(e.target.value)}
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        >
                          {data.providers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={newModelFree}
                            onChange={(e) => setNewModelFree(e.target.checked)}
                          />
                          <span>Free Tier Allowed</span>
                        </label>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () =>
                                platformApi
                                  .adminSaveModel({
                                    id: newModelId,
                                    displayName: newModelName || newModelId,
                                    category: newModelCat,
                                    providerId: newModelProvider,
                                    isFreeTierModel: newModelFree,
                                    allowedTiers: newModelFree ? ['free', 'studio_pass'] : ['studio_pass'],
                                  })
                                  .then(() => {
                                    setNewModelId('');
                                    setNewModelName('');
                                  }),
                              'เพิ่มโมเดลเข้า Registry แล้ว'
                            )
                          }
                          className="rounded-xl bg-amber-400 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 cursor-pointer"
                        >
                          + เพิ่มโมเดล
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {data.models
                        .filter(
                          (m) =>
                            (menu === 'voice' ? m.category === 'Text-to-Speech' || m.category === 'Audio Generation' : true) &&
                            (modelCatFilter === 'ALL' || m.category === modelCatFilter)
                        )
                        .map((m: ModelRegistryItem) => (
                          <div
                            key={m.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#151622] p-3 text-xs"
                          >
                            <div>
                              <div className="font-bold text-white">
                                {m.displayName}{' '}
                                <span className="font-mono-tabular text-[11px] text-amber-300">
                                  [{m.category}]
                                </span>
                                {m.isDefaultBrain && (
                                  <span className="ml-2 text-emerald-300 font-extrabold">★ Default Brain</span>
                                )}
                                {m.isDefaultVoice && (
                                  <span className="ml-2 text-sky-300 font-extrabold">★ Default Voice</span>
                                )}
                              </div>
                              <div className="text-[11px] text-[#9894b8]">
                                {m.id} • {m.providerId} • {m.creditCostPerCall} credits/call • Tiers:{' '}
                                {m.allowedTiers.join(', ')}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {m.category === 'LLM' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void runAction(
                                      () => platformApi.adminSaveModel({ ...m, isDefaultBrain: true }).then(() => undefined),
                                      `ตั้ง ${m.id} เป็น Default Brain แล้ว`
                                    )
                                  }
                                  className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-200 cursor-pointer"
                                >
                                  ตั้งเป็น Default Brain
                                </button>
                              )}
                              {m.category === 'Text-to-Speech' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void runAction(
                                      () => platformApi.adminSaveModel({ ...m, isDefaultVoice: true }).then(() => undefined),
                                      `ตั้ง ${m.id} เป็น Default Voice แล้ว`
                                    )
                                  }
                                  className="rounded-lg border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-200 cursor-pointer"
                                >
                                  ตั้งเป็น Default Voice
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  void runAction(
                                    () => platformApi.adminSaveModel({ ...m, active: !m.active }).then(() => undefined),
                                    'สลับสถานะโมเดลแล้ว'
                                  )
                                }
                                className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold cursor-pointer"
                              >
                                {m.active ? 'Active' : 'Disabled'}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {menu === 'credits' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-[#151622] p-3.5 space-y-2.5">
                      <div className="text-xs font-extrabold">เพิ่ม / ลด เครดิตผู้ใช้ (Manual Adjustment)</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <select
                          value={creditTargetUid}
                          onChange={(e) => setCreditTargetUid(e.target.value)}
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        >
                          {data.users.map((u) => (
                            <option key={u.uid} value={u.uid}>
                              {u.email} (คงเหลือ {u.wallet?.balance ?? 0})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={creditDelta}
                          onChange={(e) => setCreditDelta(e.target.value)}
                          placeholder="จำนวน (+/-)"
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={creditNote}
                          onChange={(e) => setCreditNote(e.target.value)}
                          placeholder="เหตุผลใน Ledger"
                          className="rounded-xl border border-white/15 bg-black/40 px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={busy || !creditTargetUid}
                        onClick={() =>
                          void runAction(
                            () =>
                              platformApi
                                .adminAdjustCredits({
                                  uid: creditTargetUid,
                                  delta: Number(creditDelta),
                                  note: creditNote,
                                })
                                .then(() => undefined),
                            'ปรับยอดเครดิตและบันทึก Ledger แล้ว'
                          )
                        }
                        className="rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                      >
                        บันทึกการปรับเครดิต
                      </button>
                    </div>
                    <div className="space-y-1">
                      {data.creditLedger.slice(0, 40).map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-[#151622] px-3 py-1.5 text-[11px]"
                        >
                          <span>
                            {tx.uid.slice(0, 8)} • {tx.note}
                          </span>
                          <span className="font-mono-tabular font-bold text-amber-300">
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount} (bal {tx.balanceAfter})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {menu === 'page_builder' && pageDraft && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#151622] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={pageDraft.id}
                          onChange={(e) => {
                            const found = data.pages.find((p) => p.id === e.target.value);
                            if (found) {
                              setActivePageId(found.id);
                              setPageDraft(JSON.parse(JSON.stringify(found)) as CmsPageRecord);
                            }
                          }}
                          className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs font-bold text-white"
                        >
                          {data.pages.map((p) => (
                            <option key={p.id} value={p.id}>
                              /{p.slug} — {p.title} ({p.status})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setPageDraft({
                              ...pageDraft,
                              status: pageDraft.status === 'published' ? 'draft' : 'published',
                            })
                          }
                          className={`rounded-xl px-3 py-2 text-xs font-extrabold cursor-pointer ${
                            pageDraft.status === 'published'
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-amber-400/20 text-amber-200 border border-amber-400/40'
                          }`}
                        >
                          สถานะ: {pageDraft.status === 'published' ? 'Published' : 'Draft'}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {(
                          [
                            { id: 'desktop', icon: Monitor },
                            { id: 'tablet', icon: Tablet },
                            { id: 'mobile', icon: Smartphone },
                          ] as const
                        ).map((vp) => {
                          const Icon = vp.icon;
                          return (
                            <button
                              key={vp.id}
                              type="button"
                              onClick={() => setPageViewport(vp.id)}
                              className={`rounded-lg p-2 cursor-pointer ${
                                pageViewport === vp.id ? 'bg-amber-400 text-slate-950' : 'bg-white/5 text-white'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void runAction(
                              () => platformApi.adminSavePage(pageDraft).then(() => undefined),
                              `บันทึกหน้า /${pageDraft.slug} (${pageDraft.status}) และสร้าง Snapshot เวอร์ชันใหม่แล้ว`
                            )
                          }
                          className="ml-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-950 cursor-pointer"
                        >
                          บันทึก & เผยแพร่หน้าเว็บ
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <input
                        type="text"
                        value={pageDraft.title}
                        onChange={(e) => setPageDraft({ ...pageDraft, title: e.target.value })}
                        placeholder="ชื่อหน้าเว็บ"
                        className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={pageDraft.seoTitle}
                        onChange={(e) => setPageDraft({ ...pageDraft, seoTitle: e.target.value })}
                        placeholder="SEO Title"
                        className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                      />
                      <input
                        type="text"
                        value={pageDraft.seoDescription}
                        onChange={(e) => setPageDraft({ ...pageDraft, seoDescription: e.target.value })}
                        placeholder="SEO Description"
                        className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                      />
                    </div>

                    {/* Add LEGO Block */}
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={newBlockType}
                        onChange={(e) => setNewBlockType(e.target.value as PageBlockType)}
                        className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                      >
                        {PAGE_BLOCK_TYPES.map((bt) => (
                          <option key={bt} value={bt}>
                            Block: {bt}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddBlock}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-xs font-bold text-amber-200 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>เพิ่ม LEGO Block</span>
                      </button>
                    </div>

                    {/* Responsive Preview & Block Controls */}
                    <div
                      className={`mx-auto rounded-2xl border border-white/15 bg-[#0c0d14] p-4 transition-all ${
                        pageViewport === 'mobile'
                          ? 'max-w-[390px]'
                          : pageViewport === 'tablet'
                            ? 'max-w-[768px]'
                            : 'w-full'
                      }`}
                    >
                      <div className="grid grid-cols-12 gap-3">
                        {pageDraft.blocks.map((blk, idx) => (
                          <div
                            key={blk.id}
                            className={`${
                              blk.widthCols === 4
                                ? 'col-span-4'
                                : blk.widthCols === 6
                                  ? 'col-span-6'
                                  : 'col-span-12'
                            } rounded-xl border border-white/15 bg-[#161724] p-3 space-y-2`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-mono-tabular font-bold uppercase text-amber-300">
                                {blk.type} ({blk.widthCols}/12)
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(idx, -1)}
                                  className="rounded bg-white/5 p-1 hover:bg-white/15 cursor-pointer"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(idx, 1)}
                                  className="rounded bg-white/5 p-1 hover:bg-white/15 cursor-pointer"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                                <select
                                  value={blk.widthCols}
                                  onChange={(e) => {
                                    const w = Number(e.target.value) as 12 | 6 | 4;
                                    setPageDraft({
                                      ...pageDraft,
                                      blocks: pageDraft.blocks.map((b) =>
                                        b.id === blk.id ? { ...b, widthCols: w } : b
                                      ),
                                    });
                                  }}
                                  className="rounded bg-black/50 px-1 py-0.5 text-[10px]"
                                >
                                  <option value={12}>12 cols</option>
                                  <option value={6}>6 cols</option>
                                  <option value={4}>4 cols</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPageDraft({
                                      ...pageDraft,
                                      blocks: pageDraft.blocks.filter((b) => b.id !== blk.id),
                                    })
                                  }
                                  className="rounded bg-rose-500/20 p-1 text-rose-300 cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            <input
                              type="text"
                              value={blk.title}
                              onChange={(e) =>
                                setPageDraft({
                                  ...pageDraft,
                                  blocks: pageDraft.blocks.map((b) =>
                                    b.id === blk.id ? { ...b, title: e.target.value } : b
                                  ),
                                })
                              }
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs font-bold text-white"
                            />
                            <textarea
                              rows={2}
                              value={blk.body || ''}
                              onChange={(e) =>
                                setPageDraft({
                                  ...pageDraft,
                                  blocks: pageDraft.blocks.map((b) =>
                                    b.id === blk.id ? { ...b, body: e.target.value } : b
                                  ),
                                })
                              }
                              placeholder="เนื้อหาของบล็อก..."
                              className="w-full rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] text-[#c7c3e0]"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {pageDraft.versions.length > 0 && (
                      <div className="rounded-xl border border-white/10 bg-[#151622] p-3 space-y-1.5">
                        <div className="text-xs font-bold">ประวัติเวอร์ชัน (Rollback)</div>
                        <div className="flex flex-wrap gap-2">
                          {pageDraft.versions.map((v) => (
                            <button
                              key={v.version}
                              type="button"
                              onClick={() =>
                                void runAction(
                                  () =>
                                    platformApi
                                      .adminRollbackPage(pageDraft.id, v.version)
                                      .then(() => undefined),
                                  `กู้คืนหน้า /${pageDraft.slug} กลับเป็นเวอร์ชัน v${v.version} แล้ว`
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>v{v.version} ({new Date(v.savedAt).toLocaleTimeString('th-TH')})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {menu === 'render_jobs' && (
                  <div className="space-y-2.5">
                    <h2 className="text-sm font-extrabold">FFmpeg Background Render Queue & QA Monitor</h2>
                    {data.renderJobs.length === 0 ? (
                      <div className="text-xs text-[#9894b8]">ยังไม่มีคิวเรนเดอร์บนเซิร์ฟเวอร์</div>
                    ) : (
                      data.renderJobs.map((j) => (
                        <div
                          key={j.id}
                          className="rounded-xl border border-white/10 bg-[#151622] p-3 text-xs space-y-1"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-white">
                              {j.projectTitle} ({j.resolution} {j.upscaled ? 'Upscaled' : 'Native'} @ {j.fps}fps)
                            </span>
                            <span className="font-mono-tabular font-extrabold text-amber-300">
                              {j.status} • QA: {j.qaReport?.status || 'PENDING'}
                            </span>
                          </div>
                          {j.qaReport && (
                            <div className="text-[11px] text-[#c7c3e0]">
                              {j.qaReport.resolution} • {j.qaReport.frameCount} frames • black segments:{' '}
                              {j.qaReport.blackFrameSegments} • audio sync delta: {j.qaReport.audioSyncDeltaSec}s
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {menu === 'logs' && (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-[#151622] p-3 space-y-1.5">
                      <div className="text-xs font-extrabold">Admin Audit Logs</div>
                      {data.auditLogs.map((a) => (
                        <div key={a.id} className="rounded bg-black/30 px-2.5 py-1.5 text-[11px]">
                          <span className="font-bold text-amber-300">{a.action}</span> • {a.actorEmail} •{' '}
                          <span className="text-[#c7c3e0]">{a.detail}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-[#151622] p-3 space-y-1.5">
                      <div className="text-xs font-extrabold">System Runtime Logs</div>
                      {data.systemLogs.map((l) => (
                        <div key={l.id} className="rounded bg-black/30 px-2.5 py-1.5 text-[11px]">
                          <span className="font-bold uppercase text-sky-300">[{l.level}]</span> {l.scope}:{' '}
                          {l.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {(menu === 'membership' ||
                  menu === 'website' ||
                  menu === 'security' ||
                  menu === 'map' ||
                  menu === 'animation' ||
                  menu === 'workflow_builder' ||
                  menu === 'templates') && (
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-[#151622] p-4">
                    <h2 className="text-sm font-extrabold text-white">
                      ตั้งค่าระบบหมวด: {ADMIN_MENUS.find((m) => m.id === menu)?.label}
                    </h2>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-[11px] text-[#9894b8]">ชื่อเว็บไซต์ (Brand Name)</label>
                        <input
                          type="text"
                          value={settingsDraft.websiteName}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, websiteName: e.target.value })
                          }
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#9894b8]">คำโปรย (Tagline)</label>
                        <input
                          type="text"
                          value={settingsDraft.tagline}
                          onChange={(e) => setSettingsDraft({ ...settingsDraft, tagline: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#9894b8]">ราคา Studio Pass (THB)</label>
                        <input
                          type="number"
                          value={settingsDraft.studioPassPriceThb}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              studioPassPriceThb: Number(e.target.value),
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#9894b8]">เครดิตต่อเดือน (Studio Pass)</label>
                        <input
                          type="number"
                          value={settingsDraft.studioPassMonthlyCredits}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              studioPassMonthlyCredits: Number(e.target.value),
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#9894b8]">PromptPay ID (สำหรับโอนชำระ)</label>
                        <input
                          type="text"
                          value={settingsDraft.promptPayId}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, promptPayId: e.target.value })
                          }
                          placeholder="08x-xxx-xxxx หรือเลขบัตร/นิติบุคคล"
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#9894b8]">ชื่อบัญชี PromptPay</label>
                        <input
                          type="text"
                          value={settingsDraft.promptPayAccountName}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, promptPayAccountName: e.target.value })
                          }
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#9894b8]">MapLibre Tile Style URL</label>
                        <input
                          type="text"
                          value={settingsDraft.mapTileStyleUrl}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, mapTileStyleUrl: e.target.value })
                          }
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#9894b8]">Payment Gateway Provider</label>
                        <select
                          value={settingsDraft.gatewayProvider}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              gatewayProvider: e.target.value as SystemSettings['gatewayProvider'],
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                        >
                          <option value="none">None (NOT CONFIGURED)</option>
                          <option value="stripe">Stripe</option>
                          <option value="omise">Omise</option>
                          <option value="custom_webhook">Custom HMAC Webhook</option>
                        </select>
                      </div>
                      {settingsDraft.gatewayProvider !== 'none' && (
                        <>
                          <input
                            type="password"
                            value={gatewayKeyDraft}
                            onChange={(e) => setGatewayKeyDraft(e.target.value)}
                            placeholder="Gateway Secret API Key"
                            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                          />
                          <input
                            type="password"
                            value={gatewaySecretDraft}
                            onChange={(e) => setGatewaySecretDraft(e.target.value)}
                            placeholder="Gateway Webhook HMAC Secret"
                            className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-xs text-white"
                          />
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settingsDraft.requireEmailVerification}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              requireEmailVerification: e.target.checked,
                            })
                          }
                        />
                        <span>Require Email Verification</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settingsDraft.maintenanceMode}
                          onChange={(e) =>
                            setSettingsDraft({ ...settingsDraft, maintenanceMode: e.target.checked })
                          }
                        />
                        <span>Maintenance Mode</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settingsDraft.featureFlags.animatePlugins}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              featureFlags: {
                                ...settingsDraft.featureFlags,
                                animatePlugins: e.target.checked,
                              },
                            })
                          }
                        />
                        <span>Animate Plugins ({ANIMATE_STYLE_PLUGINS.length} styles)</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={settingsDraft.featureFlags.workflowEditor}
                          onChange={(e) =>
                            setSettingsDraft({
                              ...settingsDraft,
                              featureFlags: {
                                ...settingsDraft.featureFlags,
                                workflowEditor: e.target.checked,
                              },
                            })
                          }
                        />
                        <span>
                          Workflow Builder ({WORKFLOW_NODE_DEFINITIONS.length} nodes / {WORKFLOW_TEMPLATES.length} templates)
                        </span>
                      </label>
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          () =>
                            platformApi
                              .adminSaveSettings({
                                ...settingsDraft,
                                gatewayApiKey: gatewayKeyDraft || undefined,
                                gatewayWebhookSecret: gatewaySecretDraft || undefined,
                              })
                              .then(() => {
                                setGatewayKeyDraft('');
                                setGatewaySecretDraft('');
                              }),
                          'บันทึกการตั้งค่าระบบทั้งหมดเรียบร้อยแล้ว'
                        )
                      }
                      className="min-h-[44px] rounded-xl bg-amber-400 px-5 text-xs font-extrabold text-slate-950 hover:bg-amber-300 cursor-pointer"
                    >
                      บันทึกการตั้งค่าระบบ (Save Settings)
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
