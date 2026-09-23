-- Admin LINE identities were added to the Drizzle schema before the
-- production migration path was introduced. Create the table idempotently so
-- LINE Login callbacks can resolve approved team members and claim invites.

CREATE TABLE IF NOT EXISTS public.admin_members (
  id serial PRIMARY KEY,
  line_user_id varchar(255) NOT NULL,
  display_name varchar(160) NOT NULL,
  picture_url text,
  role varchar(16) NOT NULL DEFAULT 'staff',
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_members_line_user_id_unique
  ON public.admin_members (line_user_id);