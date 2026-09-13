import * as cheerio from 'cheerio';
import { contentHash, normalizeDomain } from '@gtm/shared';
import type { CleanPage, PageType } from './types.js';

const noiseSelectors = ['script', 'style', 'noscript', 'svg', 'canvas', 'iframe', 'form', '[aria-hidden="true"]', '[class*="cookie"]', '[id*="cookie"]', '[class*="consent"]', '[class*="modal"]'];
const pagePatterns: Array<[PageType, RegExp]> = [
  ['ABOUT', /\b(about|company|mission)\b/], ['PRODUCT', /\b(products?|platform)\b/], ['SOLUTIONS', /\bsolutions?\b/], ['SERVICES', /\bservices?\b/],
  ['PRICING', /\bpricing\b/], ['CUSTOMERS', /\b(customers?|case-stud|success-stor)\b/], ['CAREERS', /\b(careers?|jobs?|join-us)\b/],
  ['TEAM', /\b(team|leadership|people)\b/], ['BLOG', /\b(blog|resources?)\b/], ['NEWS', /\b(news|press|announcements?)\b/], ['CONTACT', /\bcontact\b/]
];
const priority: Record<PageType, number> = { HOME: 100, PRODUCT: 95, SOLUTIONS: 90, SERVICES: 88, CAREERS: 87, ABOUT: 82, PRICING: 80, CUSTOMERS: 76, TEAM: 74, NEWS: 68, CONTACT: 66, BLOG: 55, OTHER: 10 };

export function cleanHtml(html: string, requestedUrl: string): CleanPage {
  const $ = cheerio.load(html);
  const structuredData = $('script[type="application/ld+json"]').map((_, element) => { try { return JSON.parse($(element).text()) as unknown; } catch { return null; } }).get().filter(Boolean).slice(0, 20);
  noiseSelectors.forEach((selector) => $(selector).remove());
  const canonicalHref = $('link[rel="canonical"]').attr('href');
  const canonicalUrl = normalizeUrl(canonicalHref ?? requestedUrl, requestedUrl) ?? requestedUrl;
  const main = $('main, article, [role="main"]').first(); const root = main.length ? main : $('body');
  root.find('nav, footer, header, aside').remove();
  const title = compact($('title').first().text()) || null;
  const metaDescription = compact($('meta[name="description"]').attr('content') ?? $('meta[property="og:description"]').attr('content') ?? '') || null;
  const headings = root.find('h1,h2,h3').map((_, element) => compact($(element).text())).get().filter(Boolean).slice(0, 30);
  const links = $('a[href]').map((_, element) => {
    const url = normalizeUrl($(element).attr('href') ?? '', requestedUrl); if (!url) return null;
    return { url, text: compact($(element).text()).slice(0, 160), internal: normalizeDomain(url) === normalizeDomain(requestedUrl) };
  }).get().filter((item): item is { url: string; text: string; internal: boolean } => Boolean(item));
  const socialUrls = [...new Set(links.filter((link) => /linkedin\.com|github\.com|x\.com|twitter\.com|facebook\.com|instagram\.com/.test(link.url)).map((link) => link.url))];
  const textRoot = root.clone(); textRoot.find('br,p,div,section,article,li,h1,h2,h3,h4,h5,h6,a').append(' ');
  const textContent = compact(textRoot.text()).slice(0, 120_000);
  const mailto = $('a[href^="mailto:"]').map((_, element) => ($(element).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0]).get();
  const emails = [...new Set([...( `${textContent} ${links.map((link) => link.url).join(' ')}`.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []), ...mailto].map((email) => email.toLowerCase()))];
  return { url: requestedUrl, canonicalUrl, pageType: classifyPage(canonicalUrl), title, metaDescription, headings, textContent, links, emails, socialUrls, structuredData };
}

export function classifyPage(url: string): PageType {
  const pathname = new URL(url).pathname.replace(/^\/+|\/+$/g, '').toLowerCase(); if (!pathname) return 'HOME';
  const match = pagePatterns.find(([, pattern]) => pattern.test(pathname)); return match?.[0] ?? 'OTHER';
}
export function rankInternalLinks(page: CleanPage): Array<{ url: string; pageType: PageType; score: number }> {
  const unique = new Map<string, { url: string; pageType: PageType; score: number }>();
  for (const link of page.links.filter((item) => item.internal)) {
    const pageType = classifyPage(link.url); const textBonus = pagePatterns.some(([, pattern]) => pattern.test(link.text.toLowerCase())) ? 8 : 0;
    const score = priority[pageType] + textBonus - Math.min(15, new URL(link.url).pathname.split('/').filter(Boolean).length * 2);
    const prior = unique.get(link.url); if (!prior || prior.score < score) unique.set(link.url, { url: link.url, pageType, score });
  }
  return [...unique.values()].filter((item) => item.pageType !== 'OTHER').sort((a, b) => b.score - a.score);
}
export function hashCleanPage(page: CleanPage): string { return contentHash({ title: page.title, description: page.metaDescription, text: page.textContent, headings: page.headings }); }
function normalizeUrl(value: string, base: string): string | null { try { const url = new URL(value, base); if (!['http:', 'https:'].includes(url.protocol)) return null; url.hash = ''; return url.toString(); } catch { return null; } }
function compact(value: string): string { return value.replace(/\s+/g, ' ').trim(); }
