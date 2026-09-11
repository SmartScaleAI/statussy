-- SMA-120: Report / Suggest panel.
-- Suggest-a-service still writes to service_suggestions (SMA-28). Existing
-- suggestion rows are untouched. Report kinds land here.

CREATE TABLE user_reports (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind         text NOT NULL,
  description  text NOT NULL,
  service      text,
  email        text,
  user_id      text REFERENCES "user" ("id") ON DELETE SET NULL,
  status       text NOT NULL DEFAULT 'new',
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_reports_kind_valid CHECK (
    kind IN ('wrong_status', 'wrong_info', 'site_bug', 'other')
  ),
  CONSTRAINT user_reports_description_not_empty
    CHECK (length(btrim(description)) > 0),
  CONSTRAINT user_reports_status_not_empty
    CHECK (length(btrim(status)) > 0)
);

CREATE INDEX user_reports_created_at_idx ON user_reports (created_at DESC);
