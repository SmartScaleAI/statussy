-- SMA-115: opt-in My Stack email digest prefs + send ledger.
-- Missing row = email off, banner not dismissed (true opt-in).
-- CASCADE on Better Auth account delete.
-- digest_sends (user_id, poll_id) is unique so one poll never double-sends.

CREATE TABLE user_digest_prefs (
  user_id              text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  email_major_partial  boolean NOT NULL DEFAULT false,
  banner_dismissed     boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_digest_prefs_user_id_not_empty
    CHECK (length(btrim(user_id)) > 0)
);

CREATE TABLE digest_sends (
  user_id        text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  poll_id        text NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  service_count  integer NOT NULL,
  PRIMARY KEY (user_id, poll_id),
  CONSTRAINT digest_sends_user_id_not_empty
    CHECK (length(btrim(user_id)) > 0),
  CONSTRAINT digest_sends_poll_id_not_empty
    CHECK (length(btrim(poll_id)) > 0),
  CONSTRAINT digest_sends_service_count_positive
    CHECK (service_count > 0)
);

CREATE INDEX digest_sends_sent_at_idx ON digest_sends (sent_at DESC);
