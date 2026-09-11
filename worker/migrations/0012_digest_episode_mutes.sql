-- SMA-135: mute-until-Live episode ledger (replaces SMA-118 6h Partial cooldown).
-- Presence of a row = this user+favorite is muted until the service is Live.
-- Existing Partial notify rows become episode mutes (same PK).
-- CASCADE on Better Auth account delete is unchanged.

ALTER TABLE digest_partial_notifies
  RENAME TO digest_episode_mutes;

ALTER TABLE digest_episode_mutes
  RENAME COLUMN last_notified_at TO last_alerted_at;

ALTER INDEX digest_partial_notifies_user_last_idx
  RENAME TO digest_episode_mutes_user_last_idx;

ALTER TABLE digest_episode_mutes
  RENAME CONSTRAINT digest_partial_notifies_pkey
  TO digest_episode_mutes_pkey;

ALTER TABLE digest_episode_mutes
  RENAME CONSTRAINT digest_partial_notifies_user_id_fkey
  TO digest_episode_mutes_user_id_fkey;

ALTER TABLE digest_episode_mutes
  RENAME CONSTRAINT digest_partial_notifies_user_id_not_empty
  TO digest_episode_mutes_user_id_not_empty;

ALTER TABLE digest_episode_mutes
  RENAME CONSTRAINT digest_partial_notifies_service_id_not_empty
  TO digest_episode_mutes_service_id_not_empty;
