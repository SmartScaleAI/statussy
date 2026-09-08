-- SMA-98: prune service_snapshots older than 30 days (see store.ts).
-- The retention delete filters on fetched_at alone; the existing
-- (service_id, fetched_at DESC) index can't serve that cheaply, so add a
-- plain fetched_at index to keep the per-tick delete an index range scan.
CREATE INDEX service_snapshots_fetched_at_idx
  ON service_snapshots (fetched_at);
