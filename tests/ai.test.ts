import { describe, expect, it, vi } from 'vitest';
import { companyAnalysisSchema, OllamaProvider } from '@gtm/ai';

const valid = { companySummary: 'Acme provides an AI support product.', industry: 'Software', businessModel: 'SaaS', companyStage: null, products: ['Support assistant'], customerTypes: ['Support teams'], technicalFocus: ['LLM'], aiRelevance: .9, engineeringNeed: .7, buyingIntent: .6, possiblePainPoints: [{ text: 'May need delivery capacity', classification: 'HYPOTHESIS', confidence: .6, evidenceIds: [] }], recommendedServices: [], signals: [], risks: [], confidence: .8 };

describe('Ollama provider', () => {
  it('reports configured model availability', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [{ name: 'qwen2.5:7b' }] }), { status: 200 }));
    await expect(new OllamaProvider('http://localhost:11434', 'qwen2.5:7b', fetcher).healthCheck()).resolves.toMatchObject({ status: 'available' });
  });
  it('validates structured output with Zod', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: JSON.stringify(valid) }, prompt_eval_count: 10, eval_count: 20 }), { status: 200 }));
    const result = await new OllamaProvider('http://localhost:11434', 'qwen2.5:7b', fetcher).generateStructured({ system: 'grounded', prompt: '{}', schema: companyAnalysisSchema, schemaName: 'company' });
    expect(result.data.confidence).toBe(.8); expect(result.promptTokens).toBe(10);
  });
  it('rejects invalid model output rather than trusting it', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: { content: '{"companySummary":42}' } }), { status: 200 }));
    await expect(new OllamaProvider('http://localhost:11434', 'qwen2.5:7b', fetcher).generateStructured({ system: 'grounded', prompt: '{}', schema: companyAnalysisSchema, schemaName: 'company' })).rejects.toThrow();
  });
});
