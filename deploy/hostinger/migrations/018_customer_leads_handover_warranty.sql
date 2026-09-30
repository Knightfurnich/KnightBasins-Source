-- Digital handover & warranty record fields for a lead (job-159): lets staff
-- record the actual handover date, warranty number, warranty period, and
-- handover notes once installation is complete, so the /handover page (Task
-- 156) and the public tracking portal can display real warranty info instead
-- of guessing. Nullable/defaulted additions only -- existing rows/columns are
-- untouched.

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS handover_date varchar(10),
  ADD COLUMN IF NOT EXISTS warranty_no varchar(64),
  ADD COLUMN IF NOT EXISTS warranty_period_months integer DEFAULT 12 NOT NULL,
  ADD COLUMN IF NOT EXISTS handover_notes text;
