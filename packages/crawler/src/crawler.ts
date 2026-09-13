import { isIP } from 'node:net';
import { normalizeDomain } from '@gtm/shared';
import { cleanHtml, hashCleanPage, rankInternalLinks } from './cleaner.js';
import type { CrawlResult, CrawlerConfig } from './types.js';

const defaultConfig: CrawlerConfig = { maxPages: 12, maxDepth: 1, timeoutMs: 15_000, maxResponseBytes: 2_000_000, requestsPerDomain: 2, globalConcurrency: 4, userAgent: 'NorthstarGTMResearch/0.2 (+evidence-first; public-pages-only)' };

export class CompanyCrawler {
  constructor(private readonly config: CrawlerConfig = defaultConfig, private readonly fetcher: typeof fetch = fetch) {}

  async crawl(domain: string): Promise<CrawlResult[]> {
    const normalized = normalizeDomain(domain); if (!normalized) throw new Error('Cannot crawl an invalid domain'); assertSafeHostname(normalized);
    const root = `https://${normalized}/`; const robots = await this.loadRobots(root); if (!robots.allowed(root)) return [failed(root, 'Blocked by robots.txt', 0)];
    const home = await this.fetchPage(root, 100); if (!home.page) return [home];
    const sitemapLinks = await this.loadSitemap(root, robots.sitemaps);
    const results = [home]; const seen = new Set([home.page.canonicalUrl, root]);
    let frontier = [...rankInternalLinks(home.page), ...sitemapLinks].filter((item) => robots.allowed(item.url));
    for (let depth = 1; depth <= this.config.maxDepth && results.length < this.config.maxPages && frontier.length; depth += 1) {
      const unique = new Map<string, { url: string; score: number }>();
      for (const item of frontier) if (normalizeDomain(item.url) === normalized && !seen.has(item.url) && !unique.has(item.url)) unique.set(item.url, { url: item.url, score: item.score });
      const selected = [...unique.values()].sort((a, b) => b.score - a.score).slice(0, this.config.maxPages - results.length); selected.forEach((item) => seen.add(item.url));
      const fetched = await mapLimit(selected, Math.min(this.config.globalConcurrency, this.config.requestsPerDomain), (item) => this.fetchPage(item.url, item.score)); results.push(...fetched);
      frontier = fetched.flatMap((item) => item.page ? rankInternalLinks(item.page) : []).filter((item) => robots.allowed(item.url));
    }
    return results;
  }

  private async fetchPage(url: string, relevanceScore: number): Promise<CrawlResult> {
    const started = Date.now();
    try {
      const response = await this.withRetry(url, 'text/html,application/xhtml+xml'); const contentType = response.headers.get('content-type');
      if (!contentType?.toLowerCase().includes('text/html')) throw new Error(`Unsupported content type: ${contentType ?? 'missing'}`);
      const declaredSize = Number(response.headers.get('content-length') ?? 0); if (declaredSize > this.config.maxResponseBytes) throw new Error('Response exceeds configured size limit');
      const buffer = await readWithLimit(response, this.config.maxResponseBytes);
      const page = cleanHtml(new TextDecoder().decode(buffer), response.url || url);
      return { page, url, httpStatus: response.status, contentType, fetchDurationMs: Date.now() - started, contentHash: hashCleanPage(page), error: null, relevanceScore };
    } catch (error) { return failed(url, error instanceof Error ? error.message : String(error), Date.now() - started, relevanceScore); }
  }

  private async withRetry(url: string, accept: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.fetcher(url, { redirect: 'follow', signal: AbortSignal.timeout(this.config.timeoutMs), headers: { accept, 'user-agent': this.config.userAgent ?? defaultConfig.userAgent! } });
        if (response.status === 429 || response.status >= 500) { const wait = retryAfter(response.headers.get('retry-after'), attempt); await delay(wait); lastError = new Error(`HTTP ${response.status}`); continue; }
        if (!response.ok) throw new Error(`HTTP ${response.status}`); return response;
      } catch (error) { lastError = error; if (attempt < 2) await delay(250 * 2 ** attempt); }
    }
    throw lastError instanceof Error ? lastError : new Error('Request failed');
  }

  private async loadRobots(root: string) {
    try { const response = await this.withRetry(new URL('/robots.txt', root).toString(), 'text/plain'); const text = await response.text(); return parseRobots(text, root); }
    catch { return { allowed: () => true, sitemaps: [] as string[] }; }
  }
  private async loadSitemap(root: string, declared: string[]) {
    const urls = declared.length ? declared.slice(0, 2) : [new URL('/sitemap.xml', root).toString()]; const output: Array<{ url: string; pageType: ReturnType<typeof cleanHtml>['pageType']; score: number }> = [];
    for (const url of urls) { try { const response = await this.withRetry(url, 'application/xml,text/xml,*/*'); const xml = await response.text(); for (const match of xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)) { const candidate = match[1]?.trim(); if (!candidate) continue; const synthetic = cleanHtml(`<a href="${candidate}"></a>`, root); output.push(...rankInternalLinks(synthetic)); } } catch { /* sitemap is optional */ } }
    return output;
  }
}

function parseRobots(text: string, root: string) {
  const disallowed: string[] = []; const sitemaps: string[] = []; let applies = false;
  for (const raw of text.split(/\r?\n/)) { const line = raw.split('#')[0]?.trim() ?? ''; const [field, ...rest] = line.split(':'); const value = rest.join(':').trim();
    if (field?.toLowerCase() === 'user-agent') applies = value === '*'; else if (applies && field?.toLowerCase() === 'disallow' && value) disallowed.push(value); else if (field?.toLowerCase() === 'sitemap' && value) sitemaps.push(value);
  }
  return { allowed: (url: string) => !disallowed.some((path) => new URL(url).pathname.startsWith(path)), sitemaps: sitemaps.map((url) => new URL(url, root).toString()) };
}
function assertSafeHostname(hostname: string) { const host = hostname.toLowerCase(); if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Private hostnames are not crawlable'); if (isIP(host) && /^(127\.|10\.|192\.168\.|169\.254\.|0\.|::1$|fc|fd)/i.test(host)) throw new Error('Private IP addresses are not crawlable'); }
function retryAfter(value: string | null, attempt: number) { const seconds = Number(value); if (Number.isFinite(seconds) && seconds > 0) return Math.min(30_000, seconds * 1000); return 500 * 2 ** attempt; }
function delay(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function failed(url: string, error: string, fetchDurationMs: number, relevanceScore = 100): CrawlResult { return { page: null, url, httpStatus: null, contentType: null, fetchDurationMs, contentHash: null, error, relevanceScore }; }
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> { const result: R[] = []; let cursor = 0; await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => { while (cursor < items.length) { const index = cursor++; result[index] = await task(items[index]!); } })); return result; }
async function readWithLimit(response: Response, maximum: number): Promise<Uint8Array> { if (!response.body) return new Uint8Array(); const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0; while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) { await reader.cancel(); throw new Error('Response exceeds configured size limit'); } chunks.push(value); } const output = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.byteLength; } return output; }
