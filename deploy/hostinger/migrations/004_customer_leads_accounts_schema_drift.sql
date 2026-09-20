-- customer_leads and customer_accounts had drifted badly out of sync with the
-- Drizzle schema (lib/db/src/schema/index.ts) — many columns the application
-- code has referenced for a while (tax info, contact preferences, LINE
-- contact, the customer_account_id link, and the quote_access_secret used to
-- gate the public "view your quote" link) were never migrated into either
-- production table. This broke every lead save: Studio draft saves, the
-- final "request a quote" submission, quick-purchase quotes, and sketch
-- uploads all upsert through POST /api/leads, which selects/writes these
-- columns unconditionally and was failing with a hard 500 on every call.
-- Keep this migration safe for an existing database and existing rows.

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS line_contact varchar(120),
  ADD COLUMN IF NOT EXISTS site varchar(240),
  ADD COLUMN IF NOT EXISTS purchasing_department varchar(160),
  ADD COLUMN IF NOT EXISTS quote_access_secret varchar(64),
  ADD COLUMN IF NOT EXISTS customer_account_id integer,
  ADD COLUMN IF NOT EXISTS tax_name varchar(240),
  ADD COLUMN IF NOT EXISTS tax_id varchar(13),
  ADD COLUMN IF NOT EXISTS tax_branch varchar(120),
  ADD COLUMN IF NOT EXISTS tax_address text,
  ADD COLUMN IF NOT EXISTS preferred_contact varchar(24),
  ADD COLUMN IF NOT EXISTS customer_role varchar(64),
  ADD COLUMN IF NOT EXISTS property_type varchar(64),
  ADD COLUMN IF NOT EXISTS condo_floor varchar(32),
  ADD COLUMN IF NOT EXISTS expected_installation_date varchar(10);

CREATE INDEX IF NOT EXISTS customer_leads_customer_account_id_idx
  ON public.customer_leads (customer_account_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_leads_customer_account_id_customer_accounts_id_fk'
  ) THEN
    ALTER TABLE public.customer_leads
      ADD CONSTRAINT customer_leads_customer_account_id_customer_accounts_id_fk
      FOREIGN KEY (customer_account_id) REFERENCES public.customer_accounts (id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.customer_accounts
  ADD COLUMN IF NOT EXISTS full_name varchar(160),
  ADD COLUMN IF NOT EXISTS phone varchar(64),
  ADD COLUMN IF NOT EXISTS line_contact varchar(120),
  ADD COLUMN IF NOT EXISTS email varchar(240),
  ADD COLUMN IF NOT EXISTS company varchar(200),
  ADD COLUMN IF NOT EXISTS project varchar(240),
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS tax_name varchar(240),
  ADD COLUMN IF NOT EXISTS tax_id varchar(13),
  ADD COLUMN IF NOT EXISTS tax_branch varchar(120),
  ADD COLUMN IF NOT EXISTS tax_address text,
  ADD COLUMN IF NOT EXISTS preferred_contact varchar(24),
  ADD COLUMN IF NOT EXISTS customer_role varchar(64),
  ADD COLUMN IF NOT EXISTS property_type varchar(64),
  ADD COLUMN IF NOT EXISTS condo_floor varchar(32),
  ADD COLUMN IF NOT EXISTS expected_installation_date varchar(10);
