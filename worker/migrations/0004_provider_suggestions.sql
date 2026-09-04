-- SMA-28: footer "Suggest a Provider" queue.
-- Suggestions are NOT added to the providers catalog — Slack is the v0
-- processing path. `status` stays 'new' until a later admin flow exists.

CREATE TABLE provider_suggestions (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name       text NOT NULL,
  email      text,
  status     text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_suggestions_name_not_empty CHECK (length(btrim(name)) > 0)
);
