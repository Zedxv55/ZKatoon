import crypto from 'node:crypto';
import fs from 'node:fs';
import express, { type Express } from 'express';
import { GoogleGenAI } from '@google/genai';
import type {
  AccessCodeRecord,
  CmsPageRecord,
  MemberTier,
  ModelRegistryItem,
  OnboardingAspect,
  OnboardingDefaults,
  ProviderConfig,
  SystemSettings,
} from '../src/types/platform.ts';
import {
  attachAuth,
  requireAuth,
  requireSuperAdmin,
  requireVerifiedUser,
} from './authMiddleware.ts';
import {
  adjustCredits,
  appendAuditLog,
  appendSystemLog,
  approveManualPaymentInDb,
  buildAdminOverview,
  createManualPaymentRequest,
  decryptSecret,
  encryptSecret,
  ensureUserAndWallet,
  getPlatformDb,
  listUserByokSummaries,
  maskApiKey,
  redeemAccessCodeInDb,
  refundReservedCredits,
  rejectManualPaymentInDb,
  reserveCredits,
  settleReservedCredits,
  validateOutboundProviderUrl,
  verifyGatewayHmacSignature,
  withDbLock,
} from './platformStore.ts';
import { enqueueServerRenderJob } from './renderWorker.ts';

function sanitizePublicSettings(s: SystemSettings) {
  return {
    websiteName: s.websiteName,
    tagline: s.tagline,
    splashDurationMs: s.splashDurationMs,
    primaryAccent: s.primaryAccent,
    secondaryAccent: s.secondaryAccent,
    maintenanceMode: s.maintenanceMode,
    requireEmailVerification: s.requireEmailVerification,
    studioPassPriceThb: s.studioPassPriceThb,
    studioPassDays: s.studioPassDays,
    studioPassMonthlyCredits: s.studioPassMonthlyCredits,
    freeMaxDurationSec: s.freeMaxDurationSec,
    paidMaxDurationSec: s.paidMaxDurationSec,
    freeMaxResolution: s.freeMaxResolution,
    paidMaxResolution: s.paidMaxResolution,
    defaultFps: s.defaultFps,
    creditRates: s.creditRates,
    defaultBrainModel: s.defaultBrainModel,
    defaultVoiceModel: s.defaultVoiceModel,
    manualPaymentEnabled: s.manualPaymentEnabled,
    promptPayId: s.promptPayId,
    promptPayAccountName: s.promptPayAccountName,
    bankAccountInfo: s.bankAccountInfo,
    promptPayQrDataUrl: s.promptPayQrDataUrl,
    paymentExpirationMinutes: s.paymentExpirationMinutes,
    promoBannerText: s.promoBannerText,
    gatewayEnabled: s.gatewayEnabled,
    gatewayProvider: s.gatewayProvider,
    gatewayConfigured: s.gatewayConfigured,
    mapTileStyleUrl: s.mapTileStyleUrl,
    mapAttribution: s.mapAttribution,
    featureFlags: s.featureFlags,
  };
}

async function callOpenAiCompatibleChat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  jsonMode?: boolean;
  maxTokens?: number;
}): Promise<{ text: string; usage?: { prompt_tokens?: number; completion_tokens?: number } }> {
  const cleanBase = params.baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBase.endsWith('/chat/completions')
    ? cleanBase
    : `${cleanBase}/chat/completions`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey}`,
      'HTTP-Referer': process.env.APP_URL || 'https://zkatoon.studio',
      'X-Title': 'ZKatoon AI Video Studio',
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      max_tokens: params.maxTokens || 2400,
      ...(params.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => '');
    throw new Error(`Provider HTTP ${resp.status}: ${errTxt.slice(0, 220)}`);
  }
  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content?.trim() || '';
  if (!text) throw new Error('Provider returned empty completion');
  return { text, usage: json.usage };
}

async function callAnthropicChat(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ text: string }> {
  const cleanBase = params.baseUrl.replace(/\/+$/, '');
  const endpoint = cleanBase.endsWith('/messages') ? cleanBase : `${cleanBase}/messages`;
  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: params.model || 'claude-3-5-sonnet-latest',
      max_tokens: params.maxTokens || 2400,
      ...(params.systemPrompt ? { system: params.systemPrompt } : {}),
      messages: [{ role: 'user', content: params.userPrompt }],
    }),
  });
  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${resp.status}: ${errTxt.slice(0, 220)}`);
  }
  const json = (await resp.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = json.content?.find((c) => c.type === 'text')?.text?.trim() || '';
  if (!text) throw new Error('Anthropic returned empty response');
  return { text };
}

async function callGeminiChat(params: {
  apiKey: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  jsonMode?: boolean;
}): Promise<{ text: string }> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey });
  const resp = await ai.models.generateContent({
    model: params.model || 'gemini-4-hydrogen',
    contents: params.userPrompt,
    config: {
      ...(params.systemPrompt ? { systemInstruction: params.systemPrompt } : {}),
      ...(params.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const text = (resp.text || '').trim();
  if (!text) throw new Error('Gemini returned empty response');
  return { text };
}

export function registerPlatformRoutes(app: Express): void {
  // Attach verified Firebase user if Authorization header is present
  app.use('/api', attachAuth);

  // 1. Bootstrap (public branding + models + published pages + authenticated user/wallet)
  app.get('/api/platform/bootstrap', async (req, res) => {
    const authUser = req.authUser;
    if (!authUser) {
      const db = getPlatformDb();
      res.json({
        authenticated: false,
        settings: sanitizePublicSettings(db.settings),
        providers: db.providers.filter((p) => p.enabled),
        models: db.models.filter((m) => m.active),
        pages: db.pages.filter((p) => p.status === 'published'),
        storageMode: 'local-server-store',
      });
      return;
    }

    const payload = await withDbLock((db) => {
      const { user, wallet } = ensureUserAndWallet(db, authUser);
      const ledger = db.creditLedger.filter((tx) => tx.uid === user.uid).slice(0, 60);
      const payments = db.payments.filter((p) => p.uid === user.uid).slice(0, 30);
      const byok = listUserByokSummaries(db, user.uid);
      const renderJobs = Object.values(db.renderJobs)
        .filter((j) => j.uid === user.uid)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 30);
      return {
        authenticated: true,
        user,
        wallet,
        byok,
        creditLedger: ledger,
        payments,
        renderJobs,
        settings: sanitizePublicSettings(db.settings),
        providers: db.providers.filter((p) => p.enabled),
        models: db.models.filter((m) => m.active),
        pages: db.pages.filter((p) => p.status === 'published'),
        storageMode: 'local-server-store',
      };
    });
    res.json(payload);
  });

  // 2. Onboarding Defaults Save
  app.post('/api/platform/onboarding', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const body = req.body as Partial<OnboardingDefaults>;
    const updated = await withDbLock((db) => {
      const { user } = ensureUserAndWallet(db, authUser);
      user.onboarding = {
        ...user.onboarding,
        completed: body.completed ?? true,
        videoType: body.videoType || user.onboarding.videoType,
        style: body.style || user.onboarding.style,
        durationSec: Math.max(5, Math.min(300, Number(body.durationSec || user.onboarding.durationSec))),
        aspect: body.aspect || user.onboarding.aspect,
        language: body.language || user.onboarding.language,
        customLanguage: body.customLanguage?.slice(0, 60),
        audioPref: body.audioPref || user.onboarding.audioPref,
        preferredPlan: body.preferredPlan === 'studio_pass' ? 'studio_pass' : 'free',
        updatedAt: Date.now(),
      };
      user.updatedAt = Date.now();
      return user;
    });
    res.json({ user: updated });
  });

  // 3. BYOK Encrypted Vault CRUD (AES-256-GCM server-side only)
  app.get('/api/platform/byok', requireAuth, async (req, res) => {
    const db = getPlatformDb();
    res.json({ credentials: listUserByokSummaries(db, req.authUser!.uid) });
  });

  app.post('/api/platform/byok', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const body = req.body as {
      providerId?: string;
      apiKey?: string;
      baseUrl?: string;
      selectedModelId?: string;
    };
    const providerId = String(body.providerId || 'openrouter').trim();
    const rawKey = String(body.apiKey || '').trim();
    if (!rawKey || rawKey.length < 8) {
      res.status(400).json({ error: 'กรุณาระบุ API Key ที่ถูกต้อง (อย่างน้อย 8 ตัวอักษร)' });
      return;
    }

    const result = await withDbLock((db) => {
      ensureUserAndWallet(db, authUser);
      const prov = db.providers.find((p) => p.id === providerId);
      if (!prov) {
        return { ok: false as const, status: 404, error: 'ไม่พบ Provider ที่ระบุ' };
      }
      const targetUrl = String(body.baseUrl || prov.baseUrl).trim();
      const check = validateOutboundProviderUrl(targetUrl, [
        ...db.settings.allowedCustomHosts,
        ...prov.whitelistedHosts,
      ]);
      if (!check.ok) {
        return { ok: false as const, status: 400, error: check.error };
      }

      const recId = `${authUser.uid}__${providerId}`;
      const enc = encryptSecret(rawKey);
      db.byok[recId] = {
        id: recId,
        uid: authUser.uid,
        providerId,
        providerName: prov.name,
        baseUrl: targetUrl,
        ciphertextB64: enc.ciphertextB64,
        ivB64: enc.ivB64,
        authTagB64: enc.authTagB64,
        maskedKey: maskApiKey(rawKey),
        selectedModelId: String(body.selectedModelId || '').trim(),
        status: 'active',
        updatedAt: Date.now(),
      };
      return { ok: true as const, credentials: listUserByokSummaries(db, authUser.uid) };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ credentials: result.credentials });
  });

  app.delete('/api/platform/byok/:providerId', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const providerId = String(req.params.providerId || '');
    const credentials = await withDbLock((db) => {
      delete db.byok[`${authUser.uid}__${providerId}`];
      return listUserByokSummaries(db, authUser.uid);
    });
    res.json({ credentials });
  });

  app.post('/api/platform/byok/test', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const body = req.body as { providerId?: string; apiKey?: string; baseUrl?: string };
    const providerId = String(body.providerId || 'openrouter');
    const db = getPlatformDb();
    const prov = db.providers.find((p) => p.id === providerId);
    if (!prov) {
      res.status(404).json({ error: 'ไม่พบ Provider' });
      return;
    }

    let apiKey = String(body.apiKey || '').trim();
    let targetBase = String(body.baseUrl || prov.baseUrl).trim();
    if (!apiKey) {
      const saved = db.byok[`${authUser.uid}__${providerId}`];
      if (!saved) {
        res.status(400).json({ error: 'ยังไม่ได้บันทึก API Key สำหรับผู้ให้บริการนี้' });
        return;
      }
      apiKey = decryptSecret(saved);
      targetBase = saved.baseUrl;
    }

    const urlCheck = validateOutboundProviderUrl(targetBase, [
      ...db.settings.allowedCustomHosts,
      ...prov.whitelistedHosts,
    ]);
    if (!urlCheck.ok) {
      res.status(400).json({ error: urlCheck.error });
      return;
    }

    try {
      if (prov.type === 'google_gemini') {
        const resp = await fetch(
          `${targetBase.replace(/\/+$/, '')}/v1beta/models?key=${encodeURIComponent(apiKey)}`
        );
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = (await resp.json()) as { models?: unknown[] };
        res.json({ ok: true, modelCount: json.models?.length || 0, message: 'เชื่อมต่อ Gemini API สำเร็จ' });
        return;
      }
      if (prov.type === 'anthropic') {
        await callAnthropicChat({
          baseUrl: targetBase,
          apiKey,
          model: 'claude-3-5-haiku-latest',
          userPrompt: 'ping',
          maxTokens: 16,
        });
        res.json({ ok: true, message: 'เชื่อมต่อ Anthropic API สำเร็จ' });
        return;
      }
      const modelsResp = await fetch(`${targetBase.replace(/\/+$/, '')}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!modelsResp.ok) throw new Error(`HTTP ${modelsResp.status}`);
      const json = (await modelsResp.json()) as { data?: unknown[] };
      res.json({
        ok: true,
        modelCount: json.data?.length || 0,
        message: `เชื่อมต่อ ${prov.name} สำเร็จ`,
      });
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: `เชื่อมต่อไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

  // 4. Universal AI Gateway (BYOK zero-credit or Studio Pass Central w/ atomic credit reserve/settle/refund)
  app.post('/api/ai/generate', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const dbSnapshot = getPlatformDb();
    if (dbSnapshot.settings.maintenanceMode && !authUser.isSuperAdmin) {
      res.status(503).json({ error: 'ระบบกำลังปิดปรับปรุงชั่วคราว' });
      return;
    }

    const body = req.body as {
      mode?: 'byok' | 'central';
      providerId?: string;
      modelId?: string;
      systemPrompt?: string;
      userPrompt?: string;
      jsonMode?: boolean;
      maxTokens?: number;
    };

    const userPrompt = String(body.userPrompt || '').trim();
    if (!userPrompt) {
      res.status(400).json({ error: 'กรุณาระบุข้อความคำสั่ง (Prompt)' });
      return;
    }

    const reqMode = body.mode || 'byok';
    if (reqMode === 'central' && dbSnapshot.settings.requireEmailVerification && !authUser.emailVerified) {
      res.status(403).json({
        error: 'กรุณายืนยันอีเมลก่อนใช้งานโหมด Central AI',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    const requestedProviderId = String(body.providerId || dbSnapshot.settings.defaultBrainProvider || 'openrouter');
    const requestedModelId = String(body.modelId || dbSnapshot.settings.defaultBrainModel || 'nvidia/nemotron-3.5-super-vl:free');

    if (reqMode === 'byok') {
      const byokRec = dbSnapshot.byok[`${authUser.uid}__${requestedProviderId}`];
      if (!byokRec) {
        res.status(400).json({
          error: `ยังไม่ได้เพิ่ม BYOK Key สำหรับ "${requestedProviderId}" กรุณาเพิ่มคีย์ใน Settings หรือสลับเป็น Central Studio Pass`,
        });
        return;
      }
      const prov = dbSnapshot.providers.find((p) => p.id === requestedProviderId);
      const apiKey = decryptSecret(byokRec);
      try {
        if (prov?.type === 'google_gemini') {
          const out = await callGeminiChat({
            apiKey,
            model: requestedModelId,
            systemPrompt: body.systemPrompt,
            userPrompt,
            jsonMode: body.jsonMode,
          });
          res.json({ text: out.text, providerId: requestedProviderId, modelId: requestedModelId, billingMode: 'byok' });
          return;
        }
        if (prov?.type === 'anthropic') {
          const out = await callAnthropicChat({
            baseUrl: byokRec.baseUrl,
            apiKey,
            model: requestedModelId,
            systemPrompt: body.systemPrompt,
            userPrompt,
            maxTokens: body.maxTokens,
          });
          res.json({ text: out.text, providerId: requestedProviderId, modelId: requestedModelId, billingMode: 'byok' });
          return;
        }
        const out = await callOpenAiCompatibleChat({
          baseUrl: byokRec.baseUrl,
          apiKey,
          model: requestedModelId,
          messages: [
            ...(body.systemPrompt ? [{ role: 'system', content: body.systemPrompt }] : []),
            { role: 'user', content: userPrompt },
          ],
          jsonMode: body.jsonMode,
          maxTokens: body.maxTokens,
        });
        res.json({ text: out.text, providerId: requestedProviderId, modelId: requestedModelId, billingMode: 'byok' });
      } catch (err) {
        res.status(502).json({
          error: `BYOK AI call failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      return;
    }

    // Central Studio Pass mode (Atomic Reserve -> Call -> Settle/Refund)
    const jobId = `ai_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const prep = await withDbLock((db) => {
      const { user } = ensureUserAndWallet(db, authUser);
      if (user.status === 'suspended') {
        return { ok: false as const, status: 403, error: 'บัญชีของคุณถูกระงับการใช้งานชั่วคราว' };
      }
      const modelMeta = db.models.find((m) => m.id === requestedModelId || m.apiModelId === requestedModelId);
      const creditCost = Math.max(1, modelMeta?.creditCostPerCall ?? 2);
      if (modelMeta && !modelMeta.allowedTiers.includes(user.tier)) {
        return {
          ok: false as const,
          status: 403,
          error: `โมเดล "${modelMeta.displayName}" สงวนสิทธิ์เฉพาะสมาชิก Studio Pass`,
        };
      }
      const resv = reserveCredits(
        db,
        user.uid,
        creditCost,
        jobId,
        requestedModelId,
        `เรียกใช้ Central AI (${requestedModelId})`,
        user.uid
      );
      if (!resv.ok) {
        return { ok: false as const, status: 402, error: resv.error };
      }
      const centralOpenRouterKey = db.providerSecrets.openrouter
        ? decryptSecret(db.providerSecrets.openrouter)
        : process.env.OPENROUTER_API_KEY?.trim() || '';
      const centralGeminiKey = db.providerSecrets.google_gemini
        ? decryptSecret(db.providerSecrets.google_gemini)
        : process.env.GEMINI_API_KEY?.trim() || '';

      return {
        ok: true as const,
        creditCost,
        centralOpenRouterKey,
        centralGeminiKey,
        fallbackModel: db.settings.fallbackBrainModel || 'gemini-4-hydrogen',
      };
    });

    if (!prep.ok) {
      res.status(prep.status).json({ error: prep.error });
      return;
    }

    try {
      let outText = '';
      let usedModel = requestedModelId;
      let usedProvider = requestedProviderId;

      if (requestedProviderId === 'openrouter' && prep.centralOpenRouterKey) {
        try {
          const out = await callOpenAiCompatibleChat({
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: prep.centralOpenRouterKey,
            model: requestedModelId,
            messages: [
              ...(body.systemPrompt ? [{ role: 'system', content: body.systemPrompt }] : []),
              { role: 'user', content: userPrompt },
            ],
            jsonMode: body.jsonMode,
            maxTokens: body.maxTokens,
          });
          outText = out.text;
        } catch (primaryErr) {
          if (prep.centralGeminiKey) {
            const fb = await callGeminiChat({
              apiKey: prep.centralGeminiKey,
              model: prep.fallbackModel,
              systemPrompt: body.systemPrompt,
              userPrompt,
              jsonMode: body.jsonMode,
            });
            outText = fb.text;
            usedModel = prep.fallbackModel;
            usedProvider = 'google_gemini';
          } else {
            throw primaryErr;
          }
        }
      } else if (prep.centralGeminiKey) {
        const fb = await callGeminiChat({
          apiKey: prep.centralGeminiKey,
          model: requestedProviderId === 'google_gemini' ? requestedModelId : prep.fallbackModel,
          systemPrompt: body.systemPrompt,
          userPrompt,
          jsonMode: body.jsonMode,
        });
        outText = fb.text;
        usedProvider = 'google_gemini';
        usedModel = requestedProviderId === 'google_gemini' ? requestedModelId : prep.fallbackModel;
      } else {
        throw new Error(
          'ยังไม่ได้ตั้งค่า Central Provider API Key บนเซิร์ฟเวอร์ (ผู้ดูแลระบบต้องเพิ่ม OpenRouter หรือ Gemini Key ใน Admin > API Providers หรือคุณสามารถสลับใช้โหมด BYOK ด้วยคีย์ของคุณเองได้)'
        );
      }

      const wallet = await withDbLock((db) =>
        settleReservedCredits(
          db,
          authUser.uid,
          prep.creditCost,
          prep.creditCost,
          jobId,
          usedModel,
          `ใช้งาน ${usedModel} สำเร็จ`,
          authUser.uid
        )
      );
      res.json({
        text: outText,
        providerId: usedProvider,
        modelId: usedModel,
        billingMode: 'central',
        creditsCharged: prep.creditCost,
        wallet,
      });
    } catch (err) {
      await withDbLock((db) =>
        refundReservedCredits(
          db,
          authUser.uid,
          prep.creditCost,
          jobId,
          requestedModelId,
          'คืนเครดิตอัตโนมัติเนื่องจากเรียก AI ไม่สำเร็จ',
          'system'
        )
      );
      res.status(502).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // 4b. Universal AI Voice (BYOK or Central Studio Pass w/ Fish Audio + Gemini TTS fallback)
  app.post('/api/ai/tts', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const db = getPlatformDb();
    const body = req.body as { text?: string; voice?: string; mode?: 'byok' | 'central' };
    const text = String(body.text || '').trim();
    if (!text) {
      res.status(400).json({ error: 'ไม่มีข้อความสำหรับสังเคราะห์เสียง' });
      return;
    }

    const geminiKey = db.providerSecrets.google_gemini
      ? decryptSecret(db.providerSecrets.google_gemini)
      : process.env.GEMINI_API_KEY?.trim() || '';

    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const resp = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [{ role: 'user', parts: [{ text }] }],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: body.voice || 'Kore' } },
            },
          },
        });
        const b64 = resp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (b64) {
          res.json({ audioBase64: b64, mimeType: 'audio/wav', provider: 'google_gemini', uid: authUser.uid });
          return;
        }
      } catch {
        // fall through to error below
      }
    }

    res.status(503).json({
      error: 'ยังไม่ได้ตั้งค่า Voice Provider Key สำหรับ Central TTS — สามารถใช้งาน ElevenLabs / OpenAI TTS / Google TTS ผ่าน BYOK ในแท็บเสียงได้ทันที',
    });
  });

  // 5. Payments (Manual PromptPay + Single-use Access Codes + Gateway Webhook)
  app.post('/api/payments/manual', requireAuth, requireVerifiedUser, async (req, res) => {
    const authUser = req.authUser!;
    const body = req.body as { slipImageDataUrl?: string; slipNote?: string };
    const result = await withDbLock((db) => {
      if (!db.settings.manualPaymentEnabled) {
        return { ok: false as const, error: 'ระบบโอนชำระแบบ Manual ปิดให้บริการชั่วคราว' };
      }
      const { user } = ensureUserAndWallet(db, authUser);
      const payment = createManualPaymentRequest(db, user, {
        slipImageDataUrl: body.slipImageDataUrl,
        slipNote: body.slipNote,
      });
      appendSystemLog(db, 'info', 'payments', `New manual payment ${payment.referenceCode} from ${user.email}`);
      return { ok: true as const, payment };
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ payment: result.payment });
  });

  app.post('/api/payments/redeem-code', requireAuth, requireVerifiedUser, async (req, res) => {
    const authUser = req.authUser!;
    const body = req.body as { code?: string };
    if (!body.code?.trim()) {
      res.status(400).json({ error: 'กรุณากรอกรหัสใช้งาน' });
      return;
    }
    const result = await withDbLock((db) => {
      ensureUserAndWallet(db, authUser);
      return redeemAccessCodeInDb(db, body.code!, authUser.uid);
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json(result);
  });

  app.post('/api/payments/webhook', async (req, res) => {
      const db = getPlatformDb();
      if (!db.settings.gatewayEnabled || !db.settings.gatewayConfigured || !db.gatewaySecrets.webhookSecretEnc) {
        res.status(503).json({ error: 'Payment Gateway is NOT CONFIGURED' });
        return;
      }
      const sig = String(req.headers['x-zkatoon-signature'] || req.headers['stripe-signature'] || '');
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body || {});
      const secret = decryptSecret(db.gatewaySecrets.webhookSecretEnc);
      if (!verifyGatewayHmacSignature(rawBody, sig, secret)) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
      const payload = JSON.parse(rawBody) as { eventId?: string; paymentId?: string; uid?: string };
      if (!payload.eventId) {
        res.status(400).json({ error: 'Missing eventId' });
        return;
      }
      const outcome = await withDbLock((lockedDb) => {
        if (lockedDb.processedWebhookIds.includes(payload.eventId!)) {
          return { duplicate: true };
        }
        lockedDb.processedWebhookIds.push(payload.eventId!);
        if (payload.paymentId) {
          approveManualPaymentInDb(lockedDb, payload.paymentId, {
            uid: 'gateway_webhook',
            email: 'gateway@webhook',
          });
        }
        return { duplicate: false };
      });
      res.json({ received: true, ...outcome });
    }
  );

  // 6. Workflows (User LEGO Workflows CRUD)
  app.get('/api/workflows', requireAuth, (req, res) => {
    const db = getPlatformDb();
    const list = Object.values(db.workflows)
      .filter((w) => w.ownerUid === req.authUser!.uid || req.authUser!.isSuperAdmin)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    res.json({ workflows: list });
  });

  app.post('/api/workflows', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const body = req.body as {
      id?: string;
      name?: string;
      description?: string;
      nodes?: unknown[];
      edges?: unknown[];
    };
    const name = String(body.name || 'Workflow ใหม่').trim().slice(0, 160);
    const id = String(body.id || `wf_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`);
    const saved = await withDbLock((db) => {
      const existing = db.workflows[id];
      if (existing && existing.ownerUid !== authUser.uid && !authUser.isSuperAdmin) {
        return null;
      }
      const rec = {
        id,
        ownerUid: existing?.ownerUid || authUser.uid,
        name,
        description: String(body.description || '').slice(0, 500),
        nodes: Array.isArray(body.nodes) ? body.nodes : [],
        edges: Array.isArray(body.edges) ? body.edges : [],
        createdAt: existing?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      db.workflows[id] = rec;
      return rec;
    });
    if (!saved) {
      res.status(403).json({ error: 'ไม่มีสิทธิ์แก้ไข Workflow ของผู้ใช้อื่น' });
      return;
    }
    res.json({ workflow: saved });
  });

  app.delete('/api/workflows/:id', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const id = String(req.params.id || '');
    const ok = await withDbLock((db) => {
      const existing = db.workflows[id];
      if (!existing) return false;
      if (existing.ownerUid !== authUser.uid && !authUser.isSuperAdmin) return false;
      delete db.workflows[id];
      return true;
    });
    if (!ok) {
      res.status(404).json({ error: 'ไม่พบ Workflow หรือไม่มีสิทธิ์ลบ' });
      return;
    }
    res.json({ ok: true });
  });

  // 7. Public CMS Pages (Admin LEGO Page Builder output)
  app.get('/api/pages/:slug', (req, res) => {
    const slug = String(req.params.slug || 'home').toLowerCase();
    const db = getPlatformDb();
    const page = db.pages.find((p) => p.slug.toLowerCase() === slug);
    if (!page || (page.status !== 'published' && !req.authUser?.isSuperAdmin)) {
      res.status(404).json({ error: 'ไม่พบหน้าเว็บที่ต้องการ' });
      return;
    }
    res.json({ page });
  });

  // 8. Background Server Render Queue & FFmpeg QA
  app.get('/api/render-jobs', requireAuth, (req, res) => {
    const db = getPlatformDb();
    const jobs = Object.values(db.renderJobs)
      .filter((j) => j.uid === req.authUser!.uid || req.authUser!.isSuperAdmin)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);
    res.json({ jobs });
  });

  app.post('/api/render-jobs', requireAuth, async (req, res) => {
    const authUser = req.authUser!;
    const db = getPlatformDb();
    if (db.settings.requireEmailVerification && !authUser.emailVerified) {
      res.status(403).json({
        error: 'กรุณายืนยันอีเมลก่อนส่งคิวเรนเดอร์บนเซิร์ฟเวอร์',
        code: 'EMAIL_NOT_VERIFIED',
      });
      return;
    }

    const body = req.body as {
      projectId?: string;
      projectTitle?: string;
      aspect?: OnboardingAspect;
      resolution?: '720p' | '1080p' | '1440p' | '4k';
      fps?: 24 | 30 | 60;
      durationSec?: number;
      sourceVideoBase64?: string;
      sourceWidth?: number;
      sourceHeight?: number;
    };

    const resolution = body.resolution || '720p';
    const user = db.users[authUser.uid];
    if (user && user.tier === 'free' && (resolution === '1440p' || resolution === '4k')) {
      res.status(403).json({
        error: `ความละเอียด ${resolution.toUpperCase()} สงวนสิทธิ์เฉพาะสมาชิก Studio Pass (แพ็กเกจฟรีรองรับสูงสุด ${db.settings.freeMaxResolution})`,
      });
      return;
    }

    const resJob = await enqueueServerRenderJob({
      uid: authUser.uid,
      projectId: String(body.projectId || 'proj_studio'),
      projectTitle: String(body.projectTitle || 'ZKatoon Render').slice(0, 160),
      aspect: body.aspect || '9:16',
      resolution,
      fps: body.fps === 60 ? 60 : body.fps === 24 ? 24 : 30,
      durationSec: Number(body.durationSec || 6),
      sourceVideoBase64: body.sourceVideoBase64,
      sourceWidth: body.sourceWidth,
      sourceHeight: body.sourceHeight,
    });
    if (!resJob.ok) {
      res.status(resJob.status).json({ error: resJob.error });
      return;
    }
    res.status(202).json({ job: resJob.job });
  });

  app.get('/api/render-jobs/:id', requireAuth, (req, res) => {
    const db = getPlatformDb();
    const job = db.renderJobs[String(req.params.id || '')];
    if (!job) {
      res.status(404).json({ error: 'ไม่พบงานเรนเดอร์' });
      return;
    }
    if (job.uid !== req.authUser!.uid && !req.authUser!.isSuperAdmin) {
      res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึงงานเรนเดอร์ของผู้ใช้อื่น' });
      return;
    }
    res.json({ job });
  });

  app.get('/api/render-jobs/:id/download', requireAuth, (req, res) => {
    const db = getPlatformDb();
    const job = db.renderJobs[String(req.params.id || '')];
    if (!job) {
      res.status(404).json({ error: 'ไม่พบงานเรนเดอร์' });
      return;
    }
    if (job.uid !== req.authUser!.uid && !req.authUser!.isSuperAdmin) {
      res.status(403).json({ error: 'ไม่มีสิทธิ์ดาวน์โหลดไฟล์ของผู้ใช้อื่น' });
      return;
    }
    if (!job.outputFilePath || !fs.existsSync(job.outputFilePath)) {
      res.status(404).json({ error: 'ไฟล์ MP4 ยังไม่พร้อมหรือถูกลบไปแล้ว' });
      return;
    }
    res.download(job.outputFilePath, `${job.projectId}_${job.resolution}.mp4`);
  });

  // 9. SUPER ADMIN 18-MENU CONSOLE ROUTES (strict email + email_verified enforcement)
  app.get('/api/admin/dashboard', requireAuth, requireSuperAdmin, (req, res) => {
    const db = getPlatformDb();
    const usersWithWallets = Object.values(db.users).map((u) => ({
      ...u,
      wallet: db.wallets[u.uid] || null,
    }));
    const providerKeyStatus: Record<string, { configured: boolean; maskedKey: string }> = {};
    for (const p of db.providers) {
      const sec = db.providerSecrets[p.id];
      providerKeyStatus[p.id] = {
        configured: Boolean(sec) || (p.id === 'google_gemini' && Boolean(process.env.GEMINI_API_KEY)),
        maskedKey: sec?.maskedKey || (p.id === 'google_gemini' && process.env.GEMINI_API_KEY ? 'ENV:GEMINI_API_KEY' : ''),
      };
    }

    res.json({
      overview: buildAdminOverview(db),
      users: usersWithWallets,
      payments: db.payments,
      accessCodes: Object.values(db.accessCodes),
      providers: db.providers,
      providerKeyStatus,
      models: db.models,
      pages: db.pages,
      renderJobs: Object.values(db.renderJobs).sort((a, b) => b.createdAt - a.createdAt),
      creditLedger: db.creditLedger.slice(0, 120),
      auditLogs: db.auditLogs.slice(0, 120),
      systemLogs: db.systemLogs.slice(0, 120),
      settings: db.settings,
    });
  });

  app.post('/api/admin/users/:uid', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const targetUid = String(req.params.uid || '');
    const body = req.body as { tier?: MemberTier; status?: 'active' | 'suspended'; days?: number };
    const updated = await withDbLock((db) => {
      const target = db.users[targetUid];
      if (!target) return null;
      const now = Date.now();
      if (body.tier === 'free' || body.tier === 'studio_pass') {
        target.tier = body.tier;
        if (body.tier === 'studio_pass') {
          const days = Math.max(1, Number(body.days || db.settings.studioPassDays));
          target.subscriptionStartedAt = now;
          target.subscriptionExpiresAt = now + days * 86400_000;
        } else {
          target.subscriptionExpiresAt = null;
        }
      }
      if (body.status === 'active' || body.status === 'suspended') {
        target.status = body.status;
      }
      target.updatedAt = now;
      appendAuditLog(
        db,
        admin.uid,
        admin.email,
        'admin_user_updated',
        'user',
        targetUid,
        `tier=${target.tier}, status=${target.status}`
      );
      return target;
    });
    if (!updated) {
      res.status(404).json({ error: 'ไม่พบผู้ใช้' });
      return;
    }
    res.json({ user: updated });
  });

  app.post('/api/admin/credits/adjust', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const body = req.body as { uid?: string; delta?: number; note?: string };
    const targetUid = String(body.uid || '');
    const delta = Number(body.delta || 0);
    if (!targetUid || !Number.isFinite(delta) || delta === 0) {
      res.status(400).json({ error: 'กรุณาระบุผู้ใช้และจำนวนเครดิตที่ถูกต้อง' });
      return;
    }
    const result = await withDbLock((db) => {
      const r = adjustCredits(
        db,
        targetUid,
        delta,
        'admin_adjust',
        body.note?.trim() || `ปรับเครดิตโดย Super Admin (${admin.email})`,
        admin.uid
      );
      if (r.ok) {
        appendAuditLog(
          db,
          admin.uid,
          admin.email,
          'admin_credit_adjust',
          'wallet',
          targetUid,
          `delta=${delta}, balanceAfter=${r.wallet.balance}`
        );
      }
      return r;
    });
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ wallet: result.wallet });
  });

  app.post('/api/admin/payments/:id/approve', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const id = String(req.params.id || '');
    const result = await withDbLock((db) => approveManualPaymentInDb(db, id, admin));
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ payment: result.payment });
  });

  app.post('/api/admin/payments/:id/reject', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const id = String(req.params.id || '');
    const body = req.body as { reason?: string };
    const result = await withDbLock((db) =>
      rejectManualPaymentInDb(db, id, String(body.reason || ''), admin)
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ payment: result.payment });
  });

  app.post('/api/admin/access-codes', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const body = req.body as Partial<AccessCodeRecord>;
    const code = (body.code || `ZK${crypto.randomBytes(3).toString('hex')}`).trim().toUpperCase();
    const rec = await withDbLock((db) => {
      const created: AccessCodeRecord = {
        code,
        tier: body.tier === 'free' ? 'free' : 'studio_pass',
        days: Math.max(1, Number(body.days || 30)),
        bonusCredits: Math.max(0, Number(body.bonusCredits || 500)),
        maxUses: Math.max(1, Number(body.maxUses || 1)),
        usedCount: 0,
        usedByUids: [],
        active: true,
        expiresAt: body.expiresAt || Date.now() + 90 * 86400_000,
        createdByEmail: admin.email,
        createdAt: Date.now(),
      };
      db.accessCodes[code] = created;
      appendAuditLog(db, admin.uid, admin.email, 'access_code_created', 'access_code', code, `days=${created.days}, credits=${created.bonusCredits}`);
      return created;
    });
    res.json({ accessCode: rec });
  });

  app.delete('/api/admin/access-codes/:code', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const code = String(req.params.code || '').toUpperCase();
    await withDbLock((db) => {
      delete db.accessCodes[code];
      appendAuditLog(db, admin.uid, admin.email, 'access_code_deleted', 'access_code', code, 'Deleted');
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/providers', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const body = req.body as Partial<ProviderConfig> & { centralApiKey?: string };
    if (!body.id) {
      res.status(400).json({ error: 'Missing provider id' });
      return;
    }
    const resProv = await withDbLock((db) => {
      const idx = db.providers.findIndex((p) => p.id === body.id);
      if (idx < 0) return null;
      const prev = db.providers[idx];
      const nextUrl = String(body.baseUrl || prev.baseUrl).trim();
      const check = validateOutboundProviderUrl(nextUrl, [
        ...db.settings.allowedCustomHosts,
        ...(body.whitelistedHosts || prev.whitelistedHosts),
      ]);
      if (!check.ok) {
        return { error: check.error };
      }
      db.providers[idx] = {
        ...prev,
        ...body,
        baseUrl: nextUrl,
      };
      if (body.centralApiKey && body.centralApiKey.trim()) {
        const enc = encryptSecret(body.centralApiKey.trim());
        db.providerSecrets[prev.id] = { ...enc, maskedKey: maskApiKey(body.centralApiKey.trim()) };
        db.providers[idx].lastTestStatus = 'ok';
      }
      appendAuditLog(db, admin.uid, admin.email, 'provider_updated', 'provider', prev.id, `enabled=${db.providers[idx].enabled}`);
      return { provider: db.providers[idx] };
    });
    if (!resProv) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }
    if ('error' in resProv) {
      res.status(400).json({ error: resProv.error });
      return;
    }
    res.json(resProv);
  });

  app.post('/api/admin/models', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const body = req.body as Partial<ModelRegistryItem>;
    if (!body.id || !body.displayName || !body.category) {
      res.status(400).json({ error: 'กรุณาระบุ id, displayName และ category ของโมเดล' });
      return;
    }
    const model = await withDbLock((db) => {
      const item: ModelRegistryItem = {
        id: body.id!.trim(),
        providerId: body.providerId || 'openrouter',
        displayName: body.displayName!.trim(),
        apiModelId: body.apiModelId || body.id!.trim(),
        category: body.category!,
        capabilities: body.capabilities || ['general'],
        promptPricePerM: Number(body.promptPricePerM || 0),
        completionPricePerM: Number(body.completionPricePerM || 0),
        creditCostPerCall: Math.max(0, Number(body.creditCostPerCall ?? 2)),
        contextLength: Number(body.contextLength || 32768),
        maxOutputTokens: Number(body.maxOutputTokens || 4096),
        supportedLanguages: body.supportedLanguages || ['th', 'en'],
        inputFormats: body.inputFormats || ['text'],
        outputFormats: body.outputFormats || ['text'],
        availability: body.availability || 'available',
        isFreeTierModel: Boolean(body.isFreeTierModel),
        active: body.active !== false,
        isDefaultBrain: Boolean(body.isDefaultBrain),
        isDefaultVoice: Boolean(body.isDefaultVoice),
        fallbackModelId: body.fallbackModelId,
        allowedTiers: body.allowedTiers && body.allowedTiers.length > 0 ? body.allowedTiers : ['free', 'studio_pass'],
        docsUrl: body.docsUrl || 'https://openrouter.ai/models',
      };
      if (item.isDefaultBrain) {
        db.models.forEach((m) => (m.isDefaultBrain = false));
        db.settings.defaultBrainModel = item.id;
        db.settings.defaultBrainProvider = item.providerId;
      }
      if (item.isDefaultVoice) {
        db.models.forEach((m) => (m.isDefaultVoice = false));
        db.settings.defaultVoiceModel = item.id;
        db.settings.defaultVoiceProvider = item.providerId;
      }
      const idx = db.models.findIndex((m) => m.id === item.id);
      if (idx >= 0) db.models[idx] = item;
      else db.models.unshift(item);

      appendAuditLog(db, admin.uid, admin.email, 'model_upserted', 'model', item.id, `${item.category} active=${item.active}`);
      return item;
    });
    res.json({ model });
  });

  app.delete('/api/admin/models/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const id = decodeURIComponent(String(req.params.id || ''));
    await withDbLock((db) => {
      db.models = db.models.filter((m) => m.id !== id);
      appendAuditLog(db, admin.uid, admin.email, 'model_deleted', 'model', id, 'Deleted model');
    });
    res.json({ ok: true });
  });

  app.post('/api/admin/settings', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const body = req.body as Partial<SystemSettings> & {
      gatewayWebhookSecret?: string;
      gatewayApiKey?: string;
    };
    const settings = await withDbLock((db) => {
      const { gatewayWebhookSecret, gatewayApiKey, ...rest } = body;
      db.settings = {
        ...db.settings,
        ...rest,
        creditRates: { ...db.settings.creditRates, ...(rest.creditRates || {}) },
        featureFlags: { ...db.settings.featureFlags, ...(rest.featureFlags || {}) },
      };
      if (gatewayWebhookSecret?.trim()) {
        db.gatewaySecrets.webhookSecretEnc = encryptSecret(gatewayWebhookSecret.trim());
      }
      if (gatewayApiKey?.trim()) {
        db.gatewaySecrets.apiKeyEnc = encryptSecret(gatewayApiKey.trim());
      }
      db.settings.gatewayConfigured = Boolean(
        db.settings.gatewayProvider !== 'none' &&
          db.gatewaySecrets.webhookSecretEnc &&
          db.gatewaySecrets.apiKeyEnc
      );
      appendAuditLog(db, admin.uid, admin.email, 'settings_updated', 'system_settings', 'global', 'Updated platform settings');
      return db.settings;
    });
    res.json({ settings });
  });

  app.post('/api/admin/pages', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const body = req.body as Partial<CmsPageRecord>;
    if (!body.slug || !body.title) {
      res.status(400).json({ error: 'กรุณาระบุ slug และ title ของหน้าเว็บ' });
      return;
    }
    const page = await withDbLock((db) => {
      const slug = body.slug!.trim().toLowerCase();
      const idx = db.pages.findIndex((p) => p.id === body.id || p.slug === slug);
      const now = Date.now();
      if (idx >= 0) {
        const prev = db.pages[idx];
        const nextVerNum = (prev.versions[0]?.version || 0) + 1;
        const snapshot = {
          version: nextVerNum,
          savedAt: now,
          savedByEmail: admin.email,
          blocks: prev.blocks,
          seoTitle: prev.seoTitle,
          seoDescription: prev.seoDescription,
        };
        const updated: CmsPageRecord = {
          ...prev,
          title: body.title!,
          slug,
          status: body.status || prev.status,
          seoTitle: body.seoTitle || prev.seoTitle,
          seoDescription: body.seoDescription || prev.seoDescription,
          blocks: Array.isArray(body.blocks) ? body.blocks : prev.blocks,
          versions: [snapshot, ...prev.versions].slice(0, 20),
          updatedAt: now,
        };
        db.pages[idx] = updated;
        appendAuditLog(db, admin.uid, admin.email, 'page_updated', 'cms_page', updated.id, `slug=${slug} status=${updated.status}`);
        return updated;
      }
      const created: CmsPageRecord = {
        id: body.id || `page_${slug}_${now}`,
        slug,
        title: body.title!,
        status: body.status || 'draft',
        seoTitle: body.seoTitle || body.title!,
        seoDescription: body.seoDescription || '',
        blocks: Array.isArray(body.blocks) ? body.blocks : [],
        versions: [],
        updatedAt: now,
      };
      db.pages.push(created);
      appendAuditLog(db, admin.uid, admin.email, 'page_created', 'cms_page', created.id, `slug=${slug}`);
      return created;
    });
    res.json({ page });
  });

  app.post('/api/admin/pages/:id/rollback', requireAuth, requireSuperAdmin, async (req, res) => {
    const admin = req.authUser!;
    const pageId = String(req.params.id || '');
    const versionNum = Number((req.body as { version?: number }).version || 0);
    const page = await withDbLock((db) => {
      const p = db.pages.find((x) => x.id === pageId);
      if (!p) return null;
      const targetVer = p.versions.find((v) => v.version === versionNum);
      if (!targetVer) return null;
      p.blocks = targetVer.blocks;
      p.seoTitle = targetVer.seoTitle;
      p.seoDescription = targetVer.seoDescription;
      p.updatedAt = Date.now();
      appendAuditLog(db, admin.uid, admin.email, 'page_rollback', 'cms_page', p.id, `Rolled back to v${versionNum}`);
      return p;
    });
    if (!page) {
      res.status(404).json({ error: 'ไม่พบหน้าเว็บหรือเวอร์ชันที่ต้องการกู้คืน' });
      return;
    }
    res.json({ page });
  });
}
