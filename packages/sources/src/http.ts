export class SourceHttpError extends Error {
  constructor(message: string, public readonly status: number, public readonly retryAfterMs: number | null) {
    super(message);
  }
}

export async function fetchJson(url: string, options: { signal?: AbortSignal | undefined; timeoutMs?: number | undefined; onRateLimit?: ((ms: number) => void) | undefined } = {}): Promise<unknown> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 15_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(url, { signal, headers: { accept: 'application/json', 'user-agent': 'GTMOpportunityEngine/0.1 (+local-first; public-job-discovery)' } });
  if (response.status === 429) {
    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    options.onRateLimit?.(retryAfter);
    throw new SourceHttpError('Source rate limit reached', 429, retryAfter);
  }
  if (!response.ok) throw new SourceHttpError(`Source returned HTTP ${response.status}`, response.status, null);
  return response.json();
}

function parseRetryAfter(value: string | null): number {
  if (!value) return 60_000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(1_000, date - Date.now()) : 60_000;
}
