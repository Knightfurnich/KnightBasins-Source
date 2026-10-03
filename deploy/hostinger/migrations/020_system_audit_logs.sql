-- Append-only operational audit trail (job-214): customer submissions, payment-slip
-- uploads and admin edits. Purely additive: one new table and its indexes, no existing
-- table or row is touched, so it is safe to run on a live database.
-- actor_type: customer | admin | system · status: success | warning | error

CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id          serial PRIMARY KEY,
  actor_type  varchar(16)  NOT NULL,
  actor_name  varchar(120),
  action      varchar(80)  NOT NULL,
  target_id   varchar(120),
  status      varchar(16)  NOT NULL DEFAULT 'success',
  error_code  varchar(64),
  details     jsonb,
  ip_address  varchar(64),
  user_agent  varchar(255),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_audit_logs_created_at_idx ON public.system_audit_logs (created_at);
CREATE INDEX IF NOT EXISTS system_audit_logs_target_id_idx ON public.system_audit_logs (target_id);
CREATE INDEX IF NOT EXISTS system_audit_logs_actor_type_idx ON public.system_audit_logs (actor_type, created_at);
CREATE INDEX IF NOT EXISTS system_audit_logs_status_idx ON public.system_audit_logs (status, created_at);
