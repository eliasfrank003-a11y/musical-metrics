-- Add description field to milestones for notes
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS description text;

-- Add milestone_type to distinguish between interval milestones and custom ones
ALTER TABLE public.milestones ADD COLUMN IF NOT EXISTS milestone_type text NOT NULL DEFAULT 'interval';

-- Add DELETE policy for milestones (was missing)
CREATE POLICY "Allow public delete access on milestones" 
ON public.milestones 
FOR DELETE 
USING (true);