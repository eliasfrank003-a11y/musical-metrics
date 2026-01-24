-- Drop the user-scoped policies
DROP POLICY IF EXISTS "Users can view their own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can insert their own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can update their own practice sessions" ON public.practice_sessions;
DROP POLICY IF EXISTS "Users can delete their own practice sessions" ON public.practice_sessions;

-- Remove the user_id column since we don't need it
ALTER TABLE public.practice_sessions DROP COLUMN IF EXISTS user_id;

-- Create simple public policies for read and insert
CREATE POLICY "Allow public read access"
ON public.practice_sessions
FOR SELECT
USING (true);

CREATE POLICY "Allow public insert access"
ON public.practice_sessions
FOR INSERT
WITH CHECK (true);

-- NO delete policy - deletion will only be possible via edge function with password