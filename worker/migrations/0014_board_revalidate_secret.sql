-- Bearer the worker sends to POST /api/revalidate-board after a tick.
-- One row. The worker inserts the secret; the Next.js app reads it to
-- authorize a cache delete. Time-based ISR is not used: that path serves
-- the previous HTML (x-vercel-cache: STALE).

CREATE TABLE board_revalidate_secret (
  id boolean PRIMARY KEY DEFAULT true,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT board_revalidate_secret_singleton CHECK (id),
  CONSTRAINT board_revalidate_secret_not_empty CHECK (length(btrim(secret)) >= 32)
);
