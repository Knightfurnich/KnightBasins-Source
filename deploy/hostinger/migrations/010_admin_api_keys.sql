-- Revocable, least-privilege credentials for automation such as David's
-- LINE archive worker. The raw token is never stored in production.

CREATE TABLE IF NOT EXISTS public.admin_api_keys (
  id serial PRIMARY KEY,
  name varchar(120) NOT NULL,
  key_prefix varchar(24) NOT NULL,
  token_hash varchar(64) NOT NULL,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_api_keys_token_hash_unique
  ON public.admin_api_keys (token_hash);

CREATE INDEX IF NOT EXISTS admin_api_keys_revoked_at_idx
  ON public.admin_api_keys (revoked_at);