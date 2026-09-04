-- SMA-23: measured latency probes (phase 2 chicklet).
-- `latency_ms` is round-trip time measured by our own probe against a safe
-- public provider endpoint. It is NOT vendor-reported data and is entirely
-- independent of the official status fields: NULL means "no measurement this
-- tick" (probe disabled, not configured, or failed) and never affects `stale`.
ALTER TABLE provider_snapshots
  ADD COLUMN latency_ms integer;
