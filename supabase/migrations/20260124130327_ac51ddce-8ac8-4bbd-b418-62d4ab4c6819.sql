-- Add user_id column to practice_sessions for user ownership
ALTER TABLE public.practice_sessions 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Allow public delete access" ON public.practice_sessions;
DROP POLICY IF EXISTS "Allow public insert access" ON public.practice_sessions;
DROP POLICY IF EXISTS "Allow public read access" ON public.practice_sessions;

-- Create proper user-scoped RLS policies
CREATE POLICY "Users can view their own practice sessions"
ON public.practice_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own practice sessions"
ON public.practice_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own practice sessions"
ON public.practice_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own practice sessions"
ON public.practice_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);