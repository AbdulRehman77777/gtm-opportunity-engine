import 'dotenv/config';
import { Worker } from './worker.js';

const worker = new Worker();
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => worker.stop());
await worker.run();
worker.close();
