import type { z } from 'zod';

export type AIHealth = { status: 'available' | 'unavailable' | 'misconfigured'; provider: string; model: string; detail?: string };
export interface StructuredGeneration<T> { data: T; raw: unknown; model: string; provider: string; latencyMs: number; promptTokens: number | null; completionTokens: number | null; }
export interface AIProvider {
  readonly name: string;
  generateStructured<T>(input: { system: string; prompt: string; schema: z.ZodType<T>; schemaName: string; temperature?: number }): Promise<StructuredGeneration<T>>;
  healthCheck(): Promise<AIHealth>;
  modelInfo(): { provider: string; model: string; baseUrl: string };
}
