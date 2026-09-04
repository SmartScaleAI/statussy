import { readdir, readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import type pg from "pg"

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations")

// Arbitrary but stable app-scoped key so concurrent workers never race migrations.
const ADVISORY_LOCK_KEY = 0x57a705 // "statos"

export async function runMigrations(pool: pg.Pool): Promise<string[]> {
  const client = await pool.connect()
  const applied: string[] = []
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY])
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort()

    const { rows } = await client.query<{ name: string }>("SELECT name FROM schema_migrations")
    const alreadyApplied = new Set(rows.map((r) => r.name))

    for (const file of files) {
      if (alreadyApplied.has(file)) continue
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8")
      await client.query("BEGIN")
      try {
        await client.query(sql)
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file])
        await client.query("COMMIT")
      } catch (err) {
        await client.query("ROLLBACK")
        throw new Error(`Migration ${file} failed: ${(err as Error).message}`, { cause: err })
      }
      applied.push(file)
    }
    return applied
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {})
    client.release()
  }
}
