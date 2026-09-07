import assert from "node:assert/strict"
import { after, before, beforeEach, test } from "node:test"

import pg from "pg"

import { runMigrations } from "../src/migrate.js"
import {
  markServiceStale,
  persistServiceState,
  type PersistableServiceState,
} from "../src/store.js"
import type { MappedComponent, MappedIncident } from "../src/statuspage.js"

function component(overrides: Partial<MappedComponent> = {}): MappedComponent {
  return {
    externalId: "comp-1",
    name: "API",
    status: "operational",
    position: 1,
    ...overrides,
  }
}

function incident(overrides: Partial<MappedIncident> = {}): MappedIncident {
  return {
    externalId: "inc-1",
    title: "Elevated errors",
    status: "investigating",
    impact: "minor",
    url: "https://status.example.com/incidents/inc-1",
    startedAt: "2026-01-02T03:04:05.000Z",
    resolvedAt: null,
    ...overrides,
  }
}

function state(overrides: Partial<PersistableServiceState> = {}): PersistableServiceState {
  return {
    status: "operational",
    incidentTitle: null,
    detail: { source: "test" },
    components: [],
    incidents: [],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Query-shape tests against a fake pool: no database needed. These pin the
// SMA-99 batching contract — per-service query count is constant, not
// proportional to component/incident count.
// ---------------------------------------------------------------------------

type LoggedQuery = { text: string; values: unknown[] }

function fakePool(failOn?: (text: string) => boolean) {
  const queries: LoggedQuery[] = []
  const client = {
    query(text: string, values: unknown[] = []) {
      queries.push({ text, values })
      if (failOn?.(text)) return Promise.reject(new Error("boom"))
      return Promise.resolve({ rows: [], rowCount: 0 })
    },
    release() {},
  }
  const pool = {
    connect: () => Promise.resolve(client),
    query: client.query,
  }
  return { pool: pool as unknown as pg.Pool, queries }
}

test("large payload persists in a constant number of queries", async () => {
  const { pool, queries } = fakePool()
  const components = Array.from({ length: 120 }, (_, i) =>
    component({ externalId: `comp-${i}`, name: `Component ${i}`, position: i }),
  )
  const incidents = Array.from({ length: 40 }, (_, i) =>
    incident({ externalId: `inc-${i}`, title: `Incident ${i}` }),
  )

  await persistServiceState(pool, "cloudflare", state({ components, incidents }))

  // BEGIN, snapshot insert, components upsert, components delete,
  // incidents upsert, COMMIT — regardless of row counts (was 4 + 120 + 40).
  assert.equal(queries.length, 6)
  assert.deepEqual(
    queries.map((q) => q.text.trim().split(/[\s(]/, 1)[0]),
    ["BEGIN", "INSERT", "INSERT", "DELETE", "INSERT", "COMMIT"],
  )

  const componentUpsert = queries[2]
  assert.match(componentUpsert.text, /unnest/)
  assert.match(componentUpsert.text, /IS DISTINCT FROM/)
  assert.equal((componentUpsert.values[1] as string[]).length, 120)

  const incidentUpsert = queries[4]
  assert.match(incidentUpsert.text, /unnest/)
  assert.match(incidentUpsert.text, /IS DISTINCT FROM/)
  assert.equal((incidentUpsert.values[1] as string[]).length, 40)
})

test("empty component/incident lists skip the upserts but still delete dropped components", async () => {
  const { pool, queries } = fakePool()
  await persistServiceState(pool, "svc", state())

  assert.deepEqual(
    queries.map((q) => q.text.trim().split(/[\s(]/, 1)[0]),
    ["BEGIN", "INSERT", "DELETE", "COMMIT"],
  )
})

test("resolveMissingIncidents adds exactly one batched update", async () => {
  const { pool, queries } = fakePool()
  await persistServiceState(pool, "svc", state({ incidents: [incident()] }), {
    resolveMissingIncidents: true,
  })

  assert.deepEqual(
    queries.map((q) => q.text.trim().split(/[\s(]/, 1)[0]),
    ["BEGIN", "INSERT", "DELETE", "INSERT", "UPDATE", "COMMIT"],
  )
})

test("a failed write rolls back the whole transaction", async () => {
  const { pool, queries } = fakePool((text) => text.includes("DELETE FROM components"))

  await assert.rejects(
    persistServiceState(pool, "svc", state({ components: [component()] })),
    /boom/,
  )
  assert.equal(queries.at(-1)?.text, "ROLLBACK")
  assert.ok(!queries.some((q) => q.text === "COMMIT"))
})

// ---------------------------------------------------------------------------
// Behavior tests against real Postgres: unchanged rows must not churn
// (updated_at untouched, tuple not rewritten), changed rows must update.
// Run with TEST_DATABASE_URL, e.g.
//   TEST_DATABASE_URL=postgres://statussy:statussy@localhost:5432/statussy_test npm test
// ---------------------------------------------------------------------------

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL
const dbTest = TEST_DATABASE_URL
  ? test
  : (name: string) => test(name, { skip: "TEST_DATABASE_URL not set" }, () => {})

if (TEST_DATABASE_URL) {
  let pool: pg.Pool

  before(async () => {
    pool = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 2 })
    await runMigrations(pool)
  })

  beforeEach(async () => {
    await pool.query("TRUNCATE services CASCADE")
    await pool.query(
      `INSERT INTO services (id, name, status_url) VALUES ('svc', 'Test Service', 'https://status.example.com')`,
    )
  })

  after(async () => {
    await pool.end()
  })

  type RowMeta = { xmin: string; updated_at: Date }

  const componentMeta = async () =>
    (
      await pool.query<RowMeta & { external_id: string }>(
        `SELECT external_id, xmin::text AS xmin, updated_at FROM components ORDER BY external_id`,
      )
    ).rows

  const incidentMeta = async () =>
    (
      await pool.query<RowMeta & { external_id: string }>(
        `SELECT external_id, xmin::text AS xmin, updated_at FROM incidents ORDER BY external_id`,
      )
    ).rows

  dbTest("re-persisting identical data does not rewrite component/incident rows", async () => {
    const payload = state({
      components: [
        component({ externalId: "a", name: "API", status: "operational", position: 1 }),
        component({ externalId: "b", name: "Chat", status: "degraded", position: null }),
      ],
      incidents: [incident()],
    })

    await persistServiceState(pool, "svc", payload)
    const componentsBefore = await componentMeta()
    const incidentsBefore = await incidentMeta()

    await persistServiceState(pool, "svc", payload)

    // xmin unchanged ⇒ the tuple was never rewritten (no dead tuple, no WAL
    // for the row); updated_at unchanged ⇒ no timestamp churn.
    assert.deepEqual(await componentMeta(), componentsBefore)
    assert.deepEqual(await incidentMeta(), incidentsBefore)

    // But each tick still records a fresh snapshot.
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM service_snapshots`)
    assert.equal(rows[0].n, 2)
  })

  dbTest("changed rows still update (and only those rows)", async () => {
    await persistServiceState(
      pool,
      "svc",
      state({
        components: [
          component({ externalId: "a", name: "API", status: "operational" }),
          component({ externalId: "b", name: "Chat", status: "operational", position: 2 }),
        ],
        incidents: [incident({ externalId: "inc-1", status: "investigating" })],
      }),
    )
    const before = Object.fromEntries((await componentMeta()).map((r) => [r.external_id, r]))

    await persistServiceState(
      pool,
      "svc",
      state({
        components: [
          component({ externalId: "a", name: "API", status: "major_outage" }),
          component({ externalId: "b", name: "Chat", status: "operational", position: 2 }),
        ],
        incidents: [incident({ externalId: "inc-1", status: "resolved", resolvedAt: "2026-01-02T05:00:00.000Z" })],
      }),
    )

    const after = Object.fromEntries((await componentMeta()).map((r) => [r.external_id, r]))
    assert.notEqual(after.a.xmin, before.a.xmin)
    assert.ok(after.a.updated_at > before.a.updated_at)
    assert.deepEqual(after.b, before.b)

    const { rows } = await pool.query(
      `SELECT status, resolved_at FROM incidents WHERE external_id = 'inc-1'`,
    )
    assert.equal(rows[0].status, "resolved")
    assert.ok(rows[0].resolved_at instanceof Date)

    const { rows: compRows } = await pool.query(
      `SELECT status FROM components WHERE external_id = 'a'`,
    )
    assert.equal(compRows[0].status, "major_outage")
  })

  dbTest("components dropped by the vendor are deleted; new ones inserted", async () => {
    await persistServiceState(
      pool,
      "svc",
      state({
        components: [component({ externalId: "a" }), component({ externalId: "b", name: "Chat" })],
      }),
    )
    await persistServiceState(
      pool,
      "svc",
      state({
        components: [component({ externalId: "b", name: "Chat" }), component({ externalId: "c", name: "New" })],
      }),
    )

    const { rows } = await pool.query(
      `SELECT external_id FROM components ORDER BY external_id`,
    )
    assert.deepEqual(
      rows.map((r) => r.external_id),
      ["b", "c"],
    )
  })

  dbTest("duplicate external ids in one payload keep the last occurrence", async () => {
    await persistServiceState(
      pool,
      "svc",
      state({
        components: [
          component({ externalId: "a", name: "First", status: "operational" }),
          component({ externalId: "a", name: "Last", status: "degraded" }),
        ],
      }),
    )

    const { rows } = await pool.query(`SELECT name, status FROM components`)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].name, "Last")
    assert.equal(rows[0].status, "degraded")
  })

  dbTest("resolveMissingIncidents resolves absent incidents exactly once", async () => {
    await persistServiceState(
      pool,
      "svc",
      state({ incidents: [incident({ externalId: "inc-1" })] }),
      { resolveMissingIncidents: true },
    )
    await persistServiceState(pool, "svc", state(), { resolveMissingIncidents: true })

    const first = (await incidentMeta())[0]
    const { rows } = await pool.query(`SELECT status FROM incidents`)
    assert.equal(rows[0].status, "resolved")

    // A later tick without the incident must not rewrite the resolved row.
    await persistServiceState(pool, "svc", state(), { resolveMissingIncidents: true })
    assert.deepEqual((await incidentMeta())[0], first)
  })

  dbTest("failed fetch keeps last-known rows and flags the snapshot stale", async () => {
    await persistServiceState(
      pool,
      "svc",
      state({ status: "degraded", components: [component()] }),
    )

    await markServiceStale(pool, "svc")

    const { rows: snapshots } = await pool.query(
      `SELECT status, stale FROM service_snapshots ORDER BY fetched_at DESC, id DESC`,
    )
    assert.equal(snapshots.length, 1)
    assert.deepEqual(snapshots[0], { status: "degraded", stale: true })

    const { rows: comps } = await pool.query(`SELECT count(*)::int AS n FROM components`)
    assert.equal(comps[0].n, 1)
  })
} else {
  dbTest("database-backed store tests")
}
