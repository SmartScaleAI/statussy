-- SMA-16: mark a provider's latest snapshot stale when a fetch fails,
-- so the board can distinguish "fresh data" from "last-known data".
ALTER TABLE provider_snapshots
  ADD COLUMN stale boolean NOT NULL DEFAULT false;
