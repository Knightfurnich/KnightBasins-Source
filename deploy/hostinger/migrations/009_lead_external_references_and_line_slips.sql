-- Migration 009: Add lead_external_references and line slip intake fields to payment_slips

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS next_follow_up_date varchar(10),
  ADD COLUMN IF NOT EXISTS assigned_to varchar(160);

CREATE TABLE IF NOT EXISTS public.lead_external_references (
  id serial PRIMARY KEY,
  lead_id integer NOT NULL REFERENCES public.customer_leads(id) ON DELETE CASCADE,
  reference_type varchar(32) NOT NULL,
  reference_value varchar(64) NOT NULL,
  normalized_value varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_external_references_type_value_unique
  ON public.lead_external_references (reference_type, normalized_value);

CREATE INDEX IF NOT EXISTS lead_external_references_lead_id_idx
  ON public.lead_external_references (lead_id);

ALTER TABLE public.payment_slips
  ALTER COLUMN lead_id DROP NOT NULL,
  ALTER COLUMN status TYPE varchar(24);

ALTER TABLE public.payment_slips
  ADD COLUMN IF NOT EXISTS source_type varchar(32) NOT NULL DEFAULT 'direct_upload',
  ADD COLUMN IF NOT EXISTS reference_value varchar(64),
  ADD COLUMN IF NOT EXISTS archive_message_id varchar(128),
  ADD COLUMN IF NOT EXISTS archive_attachment_id varchar(128),
  ADD COLUMN IF NOT EXISTS source_hash varchar(64);

CREATE UNIQUE INDEX IF NOT EXISTS payment_slips_source_attachment_unique
  ON public.payment_slips (source_type, archive_attachment_id);

ALTER TABLE public.payment_slips
  DROP CONSTRAINT IF EXISTS payment_slips_lead_id_customer_leads_id_fk;

ALTER TABLE public.payment_slips
  ADD CONSTRAINT payment_slips_lead_id_customer_leads_id_fk
  FOREIGN KEY (lead_id) REFERENCES public.customer_leads(id) ON DELETE SET NULL;
