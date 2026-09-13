import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createDatabase } from './client.js';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../drizzle');
const { db, sqlite } = createDatabase();
migrate(db, { migrationsFolder: directory });
sqlite.pragma('optimize');
sqlite.close();
console.log('Database migrations applied.');
