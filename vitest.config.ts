import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  resolve: { alias: {
    '@gtm/shared': `${root}packages/shared/src/index.ts`,
    '@gtm/scoring': `${root}packages/scoring/src/index.ts`,
    '@gtm/sources': `${root}packages/sources/src/index.ts`,
    '@gtm/db': `${root}packages/db/src/index.ts`,
    '@gtm/analytics': `${root}packages/analytics/src/index.ts`,
    '@gtm/contacts': `${root}packages/contacts/src/index.ts`,
    '@gtm/crawler': `${root}packages/crawler/src/index.ts`,
    '@gtm/research': `${root}packages/research/src/index.ts`,
    '@gtm/signals': `${root}packages/signals/src/index.ts`,
    '@gtm/ai': `${root}packages/ai/src/index.ts`
    ,'@gtm/operations': `${root}packages/operations/src/index.ts`
    ,'@gtm/email': `${root}packages/email/src/index.ts`
  } },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' }
});
