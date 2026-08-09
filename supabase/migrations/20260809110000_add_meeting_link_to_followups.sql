-- Migration: Add meeting_link to public.follow_ups table
ALTER TABLE public.follow_ups ADD COLUMN IF NOT EXISTS meeting_link text;

-- Index for searching/filtering follow-ups with meeting links
CREATE INDEX IF NOT EXISTS idx_fu_meeting_link ON public.follow_ups(organization_id, meeting_link) WHERE meeting_link IS NOT NULL;
