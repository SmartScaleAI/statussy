/**
 * One-shot: apply pending migrations and (re)seed providers, then exit.
 * Usage: npm run migrate (requires DATABASE_URL).
 */
import { loadConfig } from "./config.js"
import { createPool } from "./db.js"
import { runMigrations } from "./migrate.js"
import { seedProviders } from "./seed.js"

const config = loadConfig()
const pool = createPool(config.databaseUrl)

try {
  const applied = await runMigrations(pool)
  console.log(
    applied.length > 0
      ? `[migrate] applied: ${applied.join(", ")}`
      : "[migrate] no pending migrations",
  )
  await seedProviders(pool)
  console.log("[migrate] providers seeded")
} finally {
  await pool.end()
}
