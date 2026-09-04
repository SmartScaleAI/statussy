-- SMA-32: catalog entities are services, not providers.
-- Historical migrations 0001–0004 keep their original names; this file
-- renames live tables, columns, indexes, and the status enum.

ALTER TYPE provider_status RENAME TO service_status;

ALTER TABLE providers RENAME TO services;
ALTER TABLE services RENAME CONSTRAINT providers_pkey TO services_pkey;

ALTER TABLE provider_snapshots RENAME TO service_snapshots;
ALTER TABLE service_snapshots RENAME COLUMN provider_id TO service_id;
ALTER TABLE service_snapshots RENAME CONSTRAINT provider_snapshots_pkey TO service_snapshots_pkey;
ALTER TABLE service_snapshots RENAME CONSTRAINT provider_snapshots_provider_id_fkey TO service_snapshots_service_id_fkey;
ALTER INDEX provider_snapshots_provider_fetched_idx RENAME TO service_snapshots_service_fetched_idx;
ALTER SEQUENCE provider_snapshots_id_seq RENAME TO service_snapshots_id_seq;

ALTER TABLE components RENAME COLUMN provider_id TO service_id;
ALTER TABLE components RENAME CONSTRAINT components_provider_id_fkey TO components_service_id_fkey;
ALTER TABLE components RENAME CONSTRAINT components_provider_id_external_id_key TO components_service_id_external_id_key;

ALTER TABLE incidents RENAME COLUMN provider_id TO service_id;
ALTER TABLE incidents RENAME CONSTRAINT incidents_provider_id_fkey TO incidents_service_id_fkey;
ALTER TABLE incidents RENAME CONSTRAINT incidents_provider_id_external_id_key TO incidents_service_id_external_id_key;
ALTER INDEX incidents_provider_started_idx RENAME TO incidents_service_started_idx;

ALTER TABLE provider_suggestions RENAME TO service_suggestions;
ALTER TABLE service_suggestions RENAME CONSTRAINT provider_suggestions_pkey TO service_suggestions_pkey;
ALTER TABLE service_suggestions RENAME CONSTRAINT provider_suggestions_name_not_empty TO service_suggestions_name_not_empty;
ALTER SEQUENCE provider_suggestions_id_seq RENAME TO service_suggestions_id_seq;
