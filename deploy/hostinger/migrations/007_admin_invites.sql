-- One-time LINE account invitations for Admin team members.

CREATE TABLE IF NOT EXISTS public.admin_invites (
  id serial PRIMARY KEY,
  token_hash varchar(64) NOT NULL,
  code_hash varchar(64) NOT NULL,
  role varchar(16) NOT NULL DEFAULT 'staff',
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_token_hash_unique
  ON public.admin_invites (token_hash);

CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_code_hash_unique
  ON public.admin_invites (code_hash);

CREATE INDEX IF NOT EXISTS admin_invites_expires_at_idx
  ON public.admin_invites (expires_at);