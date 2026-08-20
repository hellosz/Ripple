import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle');

export interface MigrationFile {
  name: string;
  sql: string;
  downSql: string | null;
}

export function loadMigrations(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
    .sort()
    .map((f) => {
      const name = f.replace(/\.sql$/, '');
      let downSql: string | null = null;
      try {
        downSql = readFileSync(join(dir, `${name}.down.sql`), 'utf8');
      } catch {
        /* 无 down 迁移 */
      }
      return { name, sql: readFileSync(join(dir, f), 'utf8'), downSql };
    });
}

async function ensureTable(client: pg.ClientBase): Promise<void> {
  await client.query(`CREATE TABLE IF NOT EXISTS ripple_migrations (
    name varchar(255) PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now(),
    stamped boolean NOT NULL DEFAULT false
  )`);
}

export async function appliedMigrations(client: pg.ClientBase): Promise<Set<string>> {
  await ensureTable(client);
  const res = await client.query<{ name: string }>('SELECT name FROM ripple_migrations');
  return new Set(res.rows.map((r) => r.name));
}

/** 应用全部待执行迁移（每个迁移单独事务） */
export async function upgrade(databaseUrl: string, dir?: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    const done = await appliedMigrations(client);
    for (const migration of loadMigrations(dir)) {
      if (done.has(migration.name)) continue;
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query('INSERT INTO ripple_migrations (name) VALUES ($1)', [migration.name]);
        await client.query('COMMIT');
        applied.push(migration.name);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
  return applied;
}

/** 对既有库：把 baseline 标记为已应用（不执行 DDL）。 */
export async function stampBaseline(databaseUrl: string, dir?: string): Promise<string | null> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const migrations = loadMigrations(dir);
    const baseline = migrations[0];
    if (!baseline) return null;
    const done = await appliedMigrations(client);
    if (done.has(baseline.name)) return null;
    await client.query('INSERT INTO ripple_migrations (name, stamped) VALUES ($1, true)', [
      baseline.name,
    ]);
    return baseline.name;
  } finally {
    await client.end();
  }
}

/** 回退最后一个迁移（需存在 down 文件） */
export async function downgrade(databaseUrl: string, dir?: string): Promise<string | null> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const done = await appliedMigrations(client);
    const migrations = loadMigrations(dir).filter((m) => done.has(m.name));
    const last = migrations[migrations.length - 1];
    if (!last) return null;
    if (!last.downSql) throw new Error(`Migration ${last.name} has no down migration`);
    await client.query('BEGIN');
    try {
      await client.query(last.downSql);
      await client.query('DELETE FROM ripple_migrations WHERE name = $1', [last.name]);
      await client.query('COMMIT');
      return last.name;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    await client.end();
  }
}
