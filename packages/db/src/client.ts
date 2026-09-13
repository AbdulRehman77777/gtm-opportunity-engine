import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export function createDatabase(databaseUrl = process.env.DATABASE_URL ?? './data/gtm.db') {
  const configured = databaseUrl.startsWith('file:') ? databaseUrl.slice(5) : databaseUrl;
  const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const filename = configured === ':memory:' || path.isAbsolute(configured) ? configured : path.resolve(workspaceRoot, configured);
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const sqlite = new Database(filename);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export type DatabaseConnection = ReturnType<typeof createDatabase>;
