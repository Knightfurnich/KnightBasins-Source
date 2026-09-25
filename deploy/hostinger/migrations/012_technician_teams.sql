-- Admin-managed roster of the install teams shown in the Technician Dispatch
-- Calendar. Until now the 10 teams lived as a constant inside the API and the
-- web bundle, so adding or retiring a team meant a code change plus a deploy.

CREATE TABLE IF NOT EXISTS public.technician_teams (
  id         serial PRIMARY KEY,
  code       varchar(8)  NOT NULL UNIQUE,
  name       varchar(80) NOT NULL,
  short_name varchar(40) NOT NULL,
  aliases    jsonb       NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer     NOT NULL DEFAULT 0,
  active     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technician_teams_active_sort_idx
  ON public.technician_teams (active, sort_order, code);

INSERT INTO public.technician_teams (code, name, short_name, aliases, sort_order) VALUES
  ('TP', 'ช่างยี่',   'ยี่',    '["แอนนี่"]'::jsonb,                 10),
  ('PP', 'ช่างเนตร',  'เนตร',  '[]'::jsonb,                          20),
  ('ST', 'ช่างทู',    'ทู',     '[]'::jsonb,                          30),
  ('CM', 'ช่างเจมส์', 'เจมส์',  '[]'::jsonb,                          40),
  ('KF', 'ทีมโรงงาน', 'โรงงาน', '["ออฟฟิศ", "ออฟฟิต"]'::jsonb,          50),
  ('PA', 'ช่างเปา',   'เปา',    '[]'::jsonb,                          60),
  ('PM', 'ช่างพร้อม', 'พร้อม',  '[]'::jsonb,                          70),
  ('TJ', 'ช่างกอล์ฟ', 'กอล์ฟ',  '[]'::jsonb,                          80),
  ('AM', 'ช่างเจ๋ง',  'เจ๋ง',   '[]'::jsonb,                          90),
  ('CL', 'ช่างชัยยา', 'ชัยยา',  '[]'::jsonb,                         100)
ON CONFLICT (code) DO NOTHING;
