-- SMA-137: outbound HTTPS webhook prefs + per-poll send ledger.
-- One URL per user. URL can sit saved while enabled=false.
-- consecutive_failures + disabled_reason surface auto-disable after 3 hard failures.
-- webhook_sends (user_id, poll_id) is unique so one poll never double-POSTs.
-- CASCADE on Better Auth account delete.
-- Email and webhook share digest_episode_mutes (mute-until-Live).

CREATE TABLE user_webhook_prefs (
  user_id               text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  url                   text,
  enabled               boolean NOT NULL DEFAULT false,
  signing_secret        text NOT NULL,
  consecutive_failures  integer NOT NULL DEFAULT 0,
  disabled_reason       text,
  last_error            text,
  last_success_at       timestamptz,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_webhook_prefs_user_id_not_empty
    CHECK (length(btrim(user_id)) > 0),
  CONSTRAINT user_webhook_prefs_secret_not_empty
    CHECK (length(btrim(signing_secret)) > 0),
  CONSTRAINT user_webhook_prefs_failures_nonneg
    CHECK (consecutive_failures >= 0)
);

CREATE TABLE webhook_sends (
  user_id        text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  poll_id        text NOT NULL,
  sent_at        timestamptz NOT NULL DEFAULT now(),
  service_count  integer NOT NULL,
  PRIMARY KEY (user_id, poll_id),
  CONSTRAINT webhook_sends_user_id_not_empty
    CHECK (length(btrim(user_id)) > 0),
  CONSTRAINT webhook_sends_poll_id_not_empty
    CHECK (length(btrim(poll_id)) > 0),
  CONSTRAINT webhook_sends_service_count_positive
    CHECK (service_count > 0)
);

CREATE INDEX webhook_sends_sent_at_idx ON webhook_sends (sent_at DESC);
