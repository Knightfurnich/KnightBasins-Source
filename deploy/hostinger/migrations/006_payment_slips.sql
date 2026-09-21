-- Adds SlipOK-verified payment slip tracking. A lead can have more than one
-- slip over its life (deposit now, final payment later, a re-upload if a
-- slip is rejected), so this is a child table rather than columns bolted
-- onto customer_leads -- same shape as customer_profile_update_confirmations
-- (migration 005).

CREATE TABLE IF NOT EXISTS public.payment_slips (
  id serial PRIMARY KEY,
  lead_id integer NOT NULL,
  kind varchar(16) NOT NULL DEFAULT 'deposit',
  status varchar(16) NOT NULL DEFAULT 'pending',
  slip_image_url text NOT NULL,
  claimed_amount_thb integer,
  verified_amount_thb integer,
  sender_name varchar(200),
  trans_ref varchar(64),
  slipok_error_code varchar(16),
  slipok_raw_response jsonb,
  reviewed_by_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_slips_lead_id_idx
  ON public.payment_slips (lead_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_slips_lead_id_customer_leads_id_fk'
  ) THEN
    ALTER TABLE public.payment_slips
      ADD CONSTRAINT payment_slips_lead_id_customer_leads_id_fk
      FOREIGN KEY (lead_id) REFERENCES public.customer_leads (id) ON DELETE CASCADE;
  END IF;
END $$;
