import type { z } from 'zod';
import type { AIHealth, AIProvider, StructuredGeneration } from './types.js';

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';
  constructor(private readonly baseUrl: string, private readonly model: string, private readonly fetcher: typeof fetch = fetch) {}

  modelInfo() { return { provider: this.name, model: this.model, baseUrl: this.baseUrl }; }
  async healthCheck(): Promise<AIHealth> {
    if (!this.baseUrl || !this.model) return { status: 'misconfigured', provider: this.name, model: this.model || 'unset', detail: 'OLLAMA_BASE_URL or OLLAMA_MODEL is missing' };
    try {
      const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(3_000) });
      if (!response.ok) return { status: 'unavailable', provider: this.name, model: this.model, detail: `Ollama returned HTTP ${response.status}` };
      const data = await response.json() as { models?: Array<{ name?: string; model?: string }> };
      const available = data.models?.some((item) => item.name === this.model || item.model === this.model || item.name?.startsWith(`${this.model}:`));
      return available ? { status: 'available', provider: this.name, model: this.model } : { status: 'misconfigured', provider: this.name, model: this.model, detail: 'Configured model is not installed' };
    } catch (error) { return { status: 'unavailable', provider: this.name, model: this.model, detail: error instanceof Error ? error.message : String(error) }; }
  }

  async generateStructured<T>(input: { system: string; prompt: string; schema: z.ZodType<T>; schemaName: string; temperature?: number }): Promise<StructuredGeneration<T>> {
    const started = Date.now();
    const response = await this.fetcher(`${this.baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST', signal: AbortSignal.timeout(120_000), headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: this.model, stream: false, format: 'json', options: { temperature: input.temperature ?? 0.1 }, messages: [{ role: 'system', content: input.system }, { role: 'user', content: input.prompt }] })
    });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
    const raw = await response.json() as { message?: { content?: string }; prompt_eval_count?: number; eval_count?: number };
    if (!raw.message?.content) throw new Error('Ollama returned no structured content');
    let json: unknown; try { json = JSON.parse(raw.message.content); } catch { throw new Error(`Ollama returned invalid JSON for ${input.schemaName}`); }
    return { data: input.schema.parse(json), raw, model: this.model, provider: this.name, latencyMs: Date.now() - started, promptTokens: raw.prompt_eval_count ?? null, completionTokens: raw.eval_count ?? null };
  }
}
