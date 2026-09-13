import fs from 'node:fs';
import path from 'node:path';
import { createDatabase } from '@gtm/db';

export function createMigratedTestDatabase() {
  const connection = createDatabase(':memory:');
  const directory = path.resolve('packages/db/drizzle');
  for (const file of fs.readdirSync(directory).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    connection.sqlite.exec(fs.readFileSync(path.join(directory, file), 'utf8').replaceAll('--> statement-breakpoint', ''));
  }
  return connection;
}
