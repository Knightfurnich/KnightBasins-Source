-- Action Tracker records for Owner follow-up on recurring audit issues.
-- Additive only: no existing table or audit-log row is changed.

CREATE TABLE IF NOT EXISTS public.audit_issue_trackers (
  id          serial PRIMARY KEY,
  error_code  varchar(64)  NOT NULL,
  title       varchar(200) NOT NULL,
  category    varchar(32)  NOT NULL,
  status      varchar(24)  NOT NULL DEFAULT 'pending',
  assignee    varchar(120) DEFAULT 'Owner',
  notes       text,
  resolved_at timestamptz,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_issue_trackers_status_updated_at_idx
  ON public.audit_issue_trackers (status, updated_at);

CREATE INDEX IF NOT EXISTS audit_issue_trackers_error_code_idx
  ON public.audit_issue_trackers (error_code);