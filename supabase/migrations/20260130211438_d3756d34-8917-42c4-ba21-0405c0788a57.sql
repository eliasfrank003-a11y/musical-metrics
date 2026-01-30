-- Add started_at column for tracking when a piece was started
ALTER TABLE public.repertoire_items 
ADD COLUMN IF NOT EXISTS started_at date;

-- Add divider_label column for divider text
ALTER TABLE public.repertoire_items 
ADD COLUMN IF NOT EXISTS divider_label text;