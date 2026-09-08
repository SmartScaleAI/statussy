-- SMA-104: signed-in My Stack stars (Railway Postgres).
-- user_id is the Better Auth user id (SMA-103). No FK to "user" so this
-- migration can land independently of auth tables. service_id is the board
-- catalog slug (data/services.ts). Unique pair only — one star per user
-- per service. No anonymous / localStorage rows.

CREATE TABLE user_favorites (
  user_id     text NOT NULL,
  service_id  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, service_id),
  CONSTRAINT user_favorites_user_id_not_empty
    CHECK (length(btrim(user_id)) > 0),
  CONSTRAINT user_favorites_service_id_not_empty
    CHECK (length(btrim(service_id)) > 0)
);

CREATE INDEX user_favorites_user_id_created_idx
  ON user_favorites (user_id, created_at);
