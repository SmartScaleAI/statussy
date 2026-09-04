-- Statussy live-data schema (SMA-15).
-- Normalized tables only: parsed fields, no raw HTML blobs as source of truth.

CREATE TYPE provider_status AS ENUM (
  'operational',
  'degraded',
  'partial_outage',
  'major_outage',
  'maintenance',
  'unknown'
);

-- Static provider registry. `id` is the board slug (matches public/logos/{id}.svg
-- and data/services.ts in the Next.js app).
CREATE TABLE providers (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  category     text NOT NULL DEFAULT 'ai',
  status_url   text NOT NULL,
  -- Placeholder until fetchers land (later tickets): which fetcher implementation
  -- handles this provider, e.g. 'statuspage', 'rss'. 'none' = not fetched yet.
  fetcher_type text NOT NULL DEFAULT 'none',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- One row per fetch: the provider's overall status at a point in time.
-- The board reads the latest snapshot per provider.
CREATE TABLE provider_snapshots (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id    text NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  status         provider_status NOT NULL,
  incident_title text,
  -- Structured, parsed detail from the fetcher (never raw HTML).
  detail         jsonb,
  fetched_at     timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX provider_snapshots_provider_fetched_idx
  ON provider_snapshots (provider_id, fetched_at DESC);

-- Sub-components of a provider's status page (e.g. "API", "Chat").
-- `external_id` is the vendor's component id when the source exposes one.
CREATE TABLE components (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id text NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  external_id text,
  name        text NOT NULL,
  status      provider_status NOT NULL DEFAULT 'unknown',
  position    integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, external_id)
);

-- Incidents and maintenance windows reported by the provider.
-- `status` is the vendor lifecycle state (investigating/identified/monitoring/resolved/...).
-- `impact` is the vendor severity label (minor/major/critical/maintenance/...).
CREATE TABLE incidents (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_id text NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  external_id text,
  title       text NOT NULL,
  status      text NOT NULL,
  impact      text,
  url         text,
  started_at  timestamptz,
  resolved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, external_id)
);

CREATE INDEX incidents_provider_started_idx
  ON incidents (provider_id, started_at DESC);
