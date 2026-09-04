export type Config = {
  databaseUrl: string
  refreshIntervalSeconds: number
  port: number
}

const DEFAULT_REFRESH_INTERVAL_SECONDS = 300

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required (postgres connection string)")
  }

  let refreshIntervalSeconds = DEFAULT_REFRESH_INTERVAL_SECONDS
  if (env.REFRESH_INTERVAL_SECONDS !== undefined) {
    const parsed = Number(env.REFRESH_INTERVAL_SECONDS)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `REFRESH_INTERVAL_SECONDS must be a positive integer, got ${JSON.stringify(env.REFRESH_INTERVAL_SECONDS)}`,
      )
    }
    refreshIntervalSeconds = parsed
  }

  const port = env.PORT ? Number(env.PORT) : 8080
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`PORT must be a positive integer, got ${JSON.stringify(env.PORT)}`)
  }

  return { databaseUrl, refreshIntervalSeconds, port }
}
