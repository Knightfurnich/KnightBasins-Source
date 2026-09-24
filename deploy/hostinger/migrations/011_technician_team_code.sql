-- Dedicated team-assignment column for the Technician Dispatch Calendar.
-- Replaces free-text regex matching (lead.notes/lead.project) as the
-- write path going forward; matchedTechnicianTeamCode() stays as a
-- fallback for leads created before this column existed.

ALTER TABLE public.customer_leads
  ADD COLUMN IF NOT EXISTS technician_team_code varchar(8);

CREATE INDEX IF NOT EXISTS customer_leads_technician_team_code_idx
  ON public.customer_leads (technician_team_code);

CREATE INDEX IF NOT EXISTS customer_leads_expected_installation_date_idx
  ON public.customer_leads (expected_installation_date);
