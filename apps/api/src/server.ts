import 'dotenv/config';
import { loadConfig } from '@gtm/shared';
import { buildApp } from './app.js';

const config = loadConfig();
const app = await buildApp();
try { await app.listen({ host: config.API_HOST, port: config.API_PORT }); }
catch (error) { app.log.error(error); process.exit(1); }
