-- Create practice_sessions table
CREATE TABLE public.practice_sessions (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_seconds INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'csv_import',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

-- For now, allow public read/write (no auth required for this personal tracker)
-- You can add user_id column and auth later if needed
CREATE POLICY "Allow public read access"
  ON public.practice_sessions
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access"
  ON public.practice_sessions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public delete access"
  ON public.practice_sessions
  FOR DELETE
  USING (true);

-- Create index for faster queries on started_at
CREATE INDEX idx_practice_sessions_started_at ON public.practice_sessions(started_at DESC);