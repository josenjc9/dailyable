import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url));
let localMigrationQueue = Promise.resolve();

const MIGRATION_LOCK_ID = 0x4441494c;

async function runMigrations(pool, { useAdvisoryLock }) {
  const client = await pool.connect();
  let advisoryLocked = false;
  try {
    if (useAdvisoryLock) {
      await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
      advisoryLocked = true;
    }
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP)');
    await client.query('CREATE TABLE IF NOT EXISTS migration_lock (id integer PRIMARY KEY)');
    await client.query('INSERT INTO migration_lock(id) VALUES(1) ON CONFLICT(id) DO NOTHING');
    await client.query('BEGIN');
    await client.query('SELECT id FROM migration_lock WHERE id=1 FOR UPDATE');
    const files = (await readdir(MIGRATIONS)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    for (const version of files) {
      const found = await client.query('SELECT version FROM schema_migrations WHERE version = $1', [version]);
      if (found.rowCount) continue;
      await client.query(await readFile(join(MIGRATIONS, version), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    if (advisoryLocked) await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}

export function migrate(pool, { useAdvisoryLock = true } = {}) {
  const next = localMigrationQueue.then(() => runMigrations(pool, { useAdvisoryLock }));
  localMigrationQueue = next.catch(() => {});
  return next;
}

export async function connectDatabase(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('DATABASE_URL is required unless DAILYABLE_DEMO_MODE=true');
  const pool = new pg.Pool({ connectionString });
  await migrate(pool);
  return pool;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  connectDatabase().then((pool) => pool.end()).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
