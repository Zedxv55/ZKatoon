import type { OpenRouterModelInfo } from '../types/cartoon';

export async function verifyOpenRouterKey(apiKey: string): Promise<{
  ok: boolean;
  label?: string;
  limitRemaining?: number | null;
  error?: string;
}> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, error: 'กรุณากรอก API Key ของ OpenRouter' };
  try {
    const resp = await fetch('https://openrouter.ai/api/v1/key', {
      headers: {
        Authorization: `Bearer ${trimmed}`,
      },
    });
    const data = (await resp.json()) as {
      data?: { label?: string; limit_remaining?: number | null };
      error?: { message?: string };
    };
    if (!resp.ok) {
      return { ok: false, error: data.error?.message || `HTTP ${resp.status}` };
    }
    return {
      ok: true,
      label: data.data?.label || 'OpenRouter Key ใช้งานได้',
      limitRemaining: data.data?.limit_remaining ?? null,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'เชื่อมต่อ OpenRouter ไม่สำเร็จ' };
  }
}

export async function fetchOpenRouterModels(): Promise<OpenRouterModelInfo[]> {
  const resp = await fetch('https://openrouter.ai/api/v1/models');
  if (!resp.ok) {
    throw new Error(`โหลดรายชื่อโมเดล OpenRouter ไม่สำเร็จ (HTTP ${resp.status})`);
  }
  const payload = (await resp.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      context_length?: number;
      architecture?: { output_modalities?: string[] };
      pricing?: { prompt?: string; completion?: string };
    }>;
  };
  const list = (payload.data || []).map((m) => {
    const promptCost = Number(m.pricing?.prompt ?? '1');
    const isFree = m.id.endsWith(':free') || (promptCost === 0 && Number(m.pricing?.completion ?? '1') === 0);
    const supportsAudio = Boolean(m.architecture?.output_modalities?.includes('audio')) || /audio/i.test(m.id);
    return {
      id: m.id,
      name: m.name || m.id,
      isFree,
      supportsAudio,
      contextLength: m.context_length,
      promptPrice: m.pricing?.prompt,
    };
  });

  return list.sort((a, b) => Number(b.isFree) - Number(a.isFree));
}

export async function verifyOpenAiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, error: 'กรุณากรอก OpenAI API Key' };
  try {
    const resp = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${trimmed}` },
    });
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: err.error?.message || `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'เชื่อมต่อ OpenAI ไม่สำเร็จ' };
  }
}

export async function verifyGeminiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed) return { ok: false, error: 'กรุณากรอก Gemini API Key' };
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`
    );
    if (!resp.ok) {
      const err = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
      return { ok: false, error: err.error?.message || `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'เชื่อมต่อ Gemini ไม่สำเร็จ' };
  }
}
