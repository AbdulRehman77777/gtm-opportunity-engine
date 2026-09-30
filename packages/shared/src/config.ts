import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: z.coerce.number().int().positive().default(4100),
  DATABASE_URL: z.string().default('./data/gtm.db'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  SOURCE_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(30),
  SOURCE_CONCURRENCY: z.coerce.number().int().positive().default(2),
  TARGET_COUNTRIES: z.string().default('US'),
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen2.5:7b'),
  MIN_RESEARCH_JOB_SCORE: z.coerce.number().int().min(0).max(100).default(65),
  MIN_RESEARCH_CLIENT_SCORE: z.coerce.number().int().min(0).max(100).default(60),
  MIN_CONTACT_CLIENT_SCORE: z.coerce.number().int().min(0).max(100).default(75),
  CONTACT_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  DNS_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  MAX_PAGES_PER_COMPANY: z.coerce.number().int().min(1).max(50).default(12),
  MAX_CRAWL_DEPTH: z.coerce.number().int().min(0).max(3).default(1),
  MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(2_000_000),
  REQUESTS_PER_DOMAIN: z.coerce.number().int().min(1).max(10).default(2),
  GLOBAL_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(4),
  CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14)
  ,EMAILS_PER_HOUR: z.coerce.number().int().positive().default(10)
  ,EMAILS_PER_DAY: z.coerce.number().int().positive().default(40)
  ,MIN_CONTACT_CONFIDENCE: z.coerce.number().int().min(0).max(100).default(75)
  ,FOLLOWUP_DAYS: z.string().default('0,4,9,16')
  ,FOLLOWUP_APPROVAL_MODE: z.enum(['MANUAL_APPROVAL', 'CONTROLLED_AUTO_SEND']).default('MANUAL_APPROVAL')
  ,SMTP_HOST: z.string().optional(), SMTP_PORT: z.coerce.number().int().positive().default(587), SMTP_SECURE: z.coerce.boolean().default(false), SMTP_USER: z.string().optional(), SMTP_PASSWORD: z.string().optional(), SMTP_FROM: z.string().optional(), SMTP_REPLY_TO: z.string().optional()
  ,IMAP_HOST: z.string().optional(), IMAP_PORT: z.coerce.number().int().positive().default(993), IMAP_SECURE: z.coerce.boolean().default(true), IMAP_USER: z.string().optional(), IMAP_PASSWORD: z.string().optional(), IMAP_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(300_000)
  ,MIN_MODEL_SAMPLES: z.coerce.number().int().min(30).default(100)
  ,ANALYTICS_WINDOW_DAYS: z.coerce.number().int().positive().default(365)
  ,BACKUP_DIRECTORY: z.string().default('./backups')
  ,ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:4173')
  ,MCP_HOST: z.string().default('127.0.0.1')
  ,MCP_PORT: z.coerce.number().int().positive().default(4200)
  ,MCP_BEARER_TOKEN: z.string().min(24).optional()
  ,ACADEMIC_DOCUMENT_DIRECTORY: z.string().default('./data/academic-documents')
  ,ACADEMIC_MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(10_000_000)
  ,ACADEMIC_REFRESH_HOURS: z.coerce.number().int().min(1).default(168)
  ,API_REQUESTS_PER_MINUTE: z.coerce.number().int().min(10).default(240)
});

export type AppConfig = z.infer<typeof envSchema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export const DEFAULT_JOB_KEYWORDS = [
  'ai engineer', 'artificial intelligence engineer', 'llm engineer', 'genai', 'generative ai',
  'rag engineer', 'machine learning engineer', 'python engineer', 'fastapi', 'full stack engineer',
  'full-stack engineer', 'product engineer', 'automation engineer', 'ai solutions engineer', 'ai consultant'
];
export const DEFAULT_EXCLUDED_KEYWORDS = ['sales engineer', 'civil engineer', 'mechanical engineer', 'electrical engineer'];
