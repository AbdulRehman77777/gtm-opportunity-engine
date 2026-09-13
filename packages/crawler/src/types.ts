export type PageType = 'HOME' | 'ABOUT' | 'PRODUCT' | 'SOLUTIONS' | 'SERVICES' | 'PRICING' | 'CUSTOMERS' | 'CAREERS' | 'TEAM' | 'BLOG' | 'NEWS' | 'CONTACT' | 'OTHER';
export interface CleanPage {
  url: string; canonicalUrl: string; pageType: PageType; title: string | null; metaDescription: string | null; headings: string[]; textContent: string;
  links: Array<{ url: string; text: string; internal: boolean }>; emails: string[]; socialUrls: string[]; structuredData: unknown[];
}
export interface CrawlResult {
  page: CleanPage | null; url: string; httpStatus: number | null; contentType: string | null; fetchDurationMs: number; contentHash: string | null; error: string | null;
  relevanceScore: number;
}
export interface CrawlerConfig {
  maxPages: number; maxDepth: number; timeoutMs: number; maxResponseBytes: number; requestsPerDomain: number; globalConcurrency: number; userAgent?: string;
}
