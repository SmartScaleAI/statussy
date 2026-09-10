-- SMA-118: split Major vs Partial digest toggles + 6h Partial cooldown.
-- Existing opted-in rows (email_major_partial=true) become master on,
-- Major on, Partial off — do not suddenly enable Partial mail.
-- CASCADE on Better Auth account delete.

ALTER TABLE user_digest_prefs
  ADD COLUMN notify_major boolean NOT NULL DEFAULT false,
  ADD COLUMN notify_partial boolean NOT NULL DEFAULT false;

UPDATE user_digest_prefs
   SET notify_major = true
 WHERE email_major_partial = true;

ALTER TABLE user_digest_prefs
  RENAME COLUMN email_major_partial TO email_enabled;

CREATE TABLE digest_partial_notifies (
  user_id          text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  service_id       text NOT NULL,
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, service_id),
  CONSTRAINT digest_partial_notifies_user_id_not_empty
    CHECK (length(btrim(user_id)) > 0),
  CONSTRAINT digest_partial_notifies_service_id_not_empty
    CHECK (length(btrim(service_id)) > 0)
);

CREATE INDEX digest_partial_notifies_user_last_idx
  ON digest_partial_notifies (user_id, last_notified_at DESC);
