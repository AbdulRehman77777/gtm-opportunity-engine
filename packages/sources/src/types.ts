import type { NormalizedOpportunity, SourceKind } from '@gtm/shared';

export interface DiscoveryContext {
  signal?: AbortSignal;
  checkpoint?: string | null;
  onRateLimit?: (retryAfterMs: number) => void;
}

export interface SourcePage {
  records: NormalizedOpportunity[];
  checkpoint: string | null;
  done: boolean;
  rawRecordCount: number;
}

export interface OpportunitySource {
  readonly kind: SourceKind;
  discover(config: Record<string, unknown>, context?: DiscoveryContext): AsyncGenerator<SourcePage>;
}

export function requiredString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Source configuration requires ${key}`);
  return value.trim();
}

export function optionalString(config: Record<string, unknown>, key: string): string | null {
  const value = config[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
