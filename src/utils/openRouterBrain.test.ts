import assert from 'node:assert/strict';
import test from 'node:test';
import {
  estimateCostUsd,
  estimateThaiPipelineTokens,
  extractJsonFromText,
  parseOpenRouterModels,
} from './openRouterBrain';

test('parseOpenRouterModels extracts pricing, contextLength, and structured output support', () => {
  const models = parseOpenRouterModels({
    data: [
      {
        id: 'google/gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        context_length: 1000000,
        pricing: { prompt: '0.00000015', completion: '0.0000006' },
        supported_parameters: ['temperature', 'response_format', 'structured_outputs'],
      },
      {
        id: 'legacy/plain-model',
        name: 'Plain Model',
        context_length: 8192,
        pricing: { prompt: '0.000001', completion: '0.000002' },
        supported_parameters: ['temperature'],
      },
    ],
  });

  assert.equal(models.length, 2);
  const gem = models.find((m) => m.id === 'google/gemini-2.5-flash')!;
  assert.equal(gem.supportsStructuredOutput, true);
  assert.ok(Math.abs(gem.promptPricePerM - 0.15) < 0.001);
  assert.ok(Math.abs(gem.completionPricePerM - 0.6) < 0.001);

  const plain = models.find((m) => m.id === 'legacy/plain-model')!;
  assert.equal(plain.supportsStructuredOutput, false);

  const est = estimateThaiPipelineTokens(60);
  const cost = estimateCostUsd(gem, est.estimatedInputTokens, est.estimatedOutputTokens);
  assert.ok(cost > 0 && cost < 0.1);
});

test('extractJsonFromText strips markdown fences cleanly', () => {
  const parsed = extractJsonFromText('```json\n{"title":"ทดสอบ","ok":true}\n```') as {
    title: string;
    ok: boolean;
  };
  assert.equal(parsed.title, 'ทดสอบ');
  assert.equal(parsed.ok, true);
});
