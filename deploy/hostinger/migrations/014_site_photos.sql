-- Photos taken at a job site (survey/installation/service/completed),
-- optionally linked back to a lead once staff match the photo to a job.
-- leadId/jobCode are nullable because a photo often arrives (e.g. via LINE)
-- before it has been identified and matched to a lead.

CREATE TABLE IF NOT EXISTS public.site_photos (
  id           serial PRIMARY KEY,
  lead_id      integer,
  job_code     varchar(32),
  image_url    text        NOT NULL,
  description  text,
  stage        varchar(32) NOT NULL DEFAULT 'installation',
  sender_name  varchar(64),
  captured_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_photos_job_code_idx ON public.site_photos (job_code);
CREATE INDEX IF NOT EXISTS site_photos_lead_id_idx ON public.site_photos (lead_id);
