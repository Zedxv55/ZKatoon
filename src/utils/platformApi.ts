import type {
  AccessCodeRecord,
  AdminOverviewStats,
  AuditLogRecord,
  ByokCredentialSummary,
  CmsPageRecord,
  CreditLedgerEntry,
  CreditWallet,
  ManualPaymentRecord,
  MemberTier,
  ModelRegistryItem,
  OnboardingDefaults,
  PlatformUserRecord,
  ProviderConfig,
  ServerRenderJob,
  SystemLogRecord,
  SystemSettings,
} from '../types/platform';
import { getFirebaseIdToken } from './firebaseClient';

export interface PlatformBootstrapResponse {
  authenticated: boolean;
  user?: PlatformUserRecord;
  wallet?: CreditWallet;
  byok?: ByokCredentialSummary[];
  creditLedger?: CreditLedgerEntry[];
  payments?: ManualPaymentRecord[];
  renderJobs?: ServerRenderJob[];
  settings: Partial<SystemSettings>;
  providers: ProviderConfig[];
  models: ModelRegistryItem[];
  pages: CmsPageRecord[];
  storageMode: 'firestore-admin' | 'local-server-store';
}

export interface AdminDashboardResponse {
  overview: AdminOverviewStats;
  users: Array<PlatformUserRecord & { wallet: CreditWallet | null }>;
  payments: ManualPaymentRecord[];
  accessCodes: AccessCodeRecord[];
  providers: ProviderConfig[];
  providerKeyStatus: Record<string, { configured: boolean; maskedKey: string }>;
  models: ModelRegistryItem[];
  pages: CmsPageRecord[];
  renderJobs: ServerRenderJob[];
  creditLedger: CreditLedgerEntry[];
  auditLogs: AuditLogRecord[];
  systemLogs: SystemLogRecord[];
  settings: SystemSettings;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getFirebaseIdToken();
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Content-Type') && init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const resp = await fetch(url, { ...init, headers });
  const data = (await resp.json().catch(() => ({}))) as T & { error?: string };
  if (!resp.ok) {
    throw new Error(data.error || `HTTP ${resp.status}`);
  }
  return data;
}

export const platformApi = {
  bootstrap: () => apiFetch<PlatformBootstrapResponse>('/api/platform/bootstrap'),

  saveOnboarding: (onboarding: Partial<OnboardingDefaults>) =>
    apiFetch<{ user: PlatformUserRecord }>('/api/platform/onboarding', {
      method: 'POST',
      body: JSON.stringify(onboarding),
    }),

  listByok: () => apiFetch<{ credentials: ByokCredentialSummary[] }>('/api/platform/byok'),

  saveByok: (payload: {
    providerId: string;
    apiKey: string;
    baseUrl?: string;
    selectedModelId?: string;
  }) =>
    apiFetch<{ credentials: ByokCredentialSummary[] }>('/api/platform/byok', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteByok: (providerId: string) =>
    apiFetch<{ credentials: ByokCredentialSummary[] }>(
      `/api/platform/byok/${encodeURIComponent(providerId)}`,
      { method: 'DELETE' }
    ),

  testByok: (payload: { providerId: string; apiKey?: string; baseUrl?: string }) =>
    apiFetch<{ ok: boolean; modelCount?: number; message?: string; error?: string }>(
      '/api/platform/byok/test',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),

  generateAi: (payload: {
    mode: 'byok' | 'central';
    providerId?: string;
    modelId?: string;
    systemPrompt?: string;
    userPrompt: string;
    jsonMode?: boolean;
    maxTokens?: number;
  }) =>
    apiFetch<{
      text: string;
      providerId: string;
      modelId: string;
      billingMode: string;
      creditsCharged?: number;
      wallet?: CreditWallet;
    }>('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  submitManualPayment: (payload: { slipImageDataUrl?: string; slipNote?: string }) =>
    apiFetch<{ payment: ManualPaymentRecord }>('/api/payments/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  redeemAccessCode: (code: string) =>
    apiFetch<{ ok: boolean; tier: MemberTier; creditsAdded: number }>('/api/payments/redeem-code', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  listWorkflows: () =>
    apiFetch<{ workflows: Array<{ id: string; name: string; description: string; nodes: unknown[]; edges: unknown[]; updatedAt: number }> }>(
      '/api/workflows'
    ),

  saveWorkflow: (payload: {
    id?: string;
    name: string;
    description?: string;
    nodes: unknown[];
    edges: unknown[];
  }) =>
    apiFetch<{ workflow: { id: string; name: string; updatedAt: number } }>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteWorkflow: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/workflows/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  getPageBySlug: (slug: string) =>
    apiFetch<{ page: CmsPageRecord }>(`/api/pages/${encodeURIComponent(slug)}`),

  listRenderJobs: () => apiFetch<{ jobs: ServerRenderJob[] }>('/api/render-jobs'),

  enqueueRenderJob: (payload: {
    projectId: string;
    projectTitle: string;
    aspect: '9:16' | '16:9' | '1:1' | '4:5';
    resolution: '720p' | '1080p' | '1440p' | '4k';
    fps: 24 | 30 | 60;
    durationSec: number;
    sourceVideoBase64?: string;
    sourceWidth?: number;
    sourceHeight?: number;
  }) =>
    apiFetch<{ job: ServerRenderJob }>('/api/render-jobs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRenderJob: (id: string) =>
    apiFetch<{ job: ServerRenderJob }>(`/api/render-jobs/${encodeURIComponent(id)}`),

  async downloadRenderJob(id: string, filename: string): Promise<void> {
    const token = await getFirebaseIdToken();
    const resp = await fetch(`/api/render-jobs/${encodeURIComponent(id)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || `HTTP ${resp.status}`);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Super Admin endpoints
  adminDashboard: () => apiFetch<AdminDashboardResponse>('/api/admin/dashboard'),

  adminUpdateUser: (uid: string, payload: { tier?: MemberTier; status?: 'active' | 'suspended'; days?: number }) =>
    apiFetch<{ user: PlatformUserRecord }>(`/api/admin/users/${encodeURIComponent(uid)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminAdjustCredits: (payload: { uid: string; delta: number; note?: string }) =>
    apiFetch<{ wallet: CreditWallet }>('/api/admin/credits/adjust', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminApprovePayment: (id: string) =>
    apiFetch<{ payment: ManualPaymentRecord }>(`/api/admin/payments/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    }),

  adminRejectPayment: (id: string, reason: string) =>
    apiFetch<{ payment: ManualPaymentRecord }>(`/api/admin/payments/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  adminCreateAccessCode: (payload: Partial<AccessCodeRecord>) =>
    apiFetch<{ accessCode: AccessCodeRecord }>('/api/admin/access-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminDeleteAccessCode: (code: string) =>
    apiFetch<{ ok: boolean }>(`/api/admin/access-codes/${encodeURIComponent(code)}`, {
      method: 'DELETE',
    }),

  adminSaveProvider: (payload: Partial<ProviderConfig> & { centralApiKey?: string }) =>
    apiFetch<{ provider: ProviderConfig }>('/api/admin/providers', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminSaveModel: (payload: Partial<ModelRegistryItem>) =>
    apiFetch<{ model: ModelRegistryItem }>('/api/admin/models', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminDeleteModel: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api/admin/models/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  adminSaveSettings: (
    payload: Partial<SystemSettings> & { gatewayWebhookSecret?: string; gatewayApiKey?: string }
  ) =>
    apiFetch<{ settings: SystemSettings }>('/api/admin/settings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminSavePage: (payload: Partial<CmsPageRecord>) =>
    apiFetch<{ page: CmsPageRecord }>('/api/admin/pages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminRollbackPage: (pageId: string, version: number) =>
    apiFetch<{ page: CmsPageRecord }>(`/api/admin/pages/${encodeURIComponent(pageId)}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ version }),
    }),
};
