-- Add started_at date field and divider_label to repertoire_items
-- Replace 'composer' with 'started_at' for tracking when pieces were started

ALTER TABLE repertoire_items 
ADD COLUMN IF NOT EXISTS started_at DATE,
ADD COLUMN IF NOT EXISTS divider_label TEXT;

-- Migrate any existing composer data if needed (optional, can be commented out)
-- UPDATE repertoire_items SET divider_label = composer WHERE type = 'divider';

-- Drop composer column
ALTER TABLE repertoire_items 
DROP COLUMN IF EXISTS composer;
