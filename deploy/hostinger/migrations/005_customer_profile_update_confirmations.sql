-- customer_profile_update_confirmations exists in the Drizzle schema
-- (lib/db/src/schema/index.ts) and is used on every KnightSupport LINE-bot
-- profile-update confirm/cancel exchange (artifacts/api-server/src/routes/support.ts),
-- but like the customer_leads/customer_accounts drift in 004, this table was
-- never created on production. Every confirm/cancel of a profile update via
-- the support chat currently 500s with Postgres error 42P01 (undefined_table).

CREATE TABLE IF NOT EXISTS public.customer_profile_update_confirmations (
  id serial PRIMARY KEY,
  account_id integer NOT NULL,
  fields jsonb NOT NULL,
  comparison jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_profile_update_confirmations_account_id_unique
  ON public.customer_profile_update_confirmations (account_id);

CREATE INDEX IF NOT EXISTS customer_profile_update_confirmations_expires_at_idx
  ON public.customer_profile_update_confirmations (expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_profile_update_confirmations_account_id_fk'
  ) THEN
    ALTER TABLE public.customer_profile_update_confirmations
      ADD CONSTRAINT customer_profile_update_confirmations_account_id_fk
      FOREIGN KEY (account_id) REFERENCES public.customer_accounts (id) ON DELETE CASCADE;
  END IF;
END $$;
