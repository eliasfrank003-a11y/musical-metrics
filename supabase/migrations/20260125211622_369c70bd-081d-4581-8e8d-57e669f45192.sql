-- Milestones table for the 10k timeline
CREATE TABLE public.milestones (
  id SERIAL PRIMARY KEY,
  hours INTEGER NOT NULL UNIQUE,
  achieved_at TIMESTAMPTZ,
  average_at_milestone DECIMAL(10, 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

-- Public read/insert access (matching existing security model)
CREATE POLICY "Allow public read access on milestones"
ON public.milestones FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on milestones"
ON public.milestones FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on milestones"
ON public.milestones FOR UPDATE USING (true);

-- Repertoire items table
CREATE TABLE public.repertoire_items (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'piece' CHECK (type IN ('piece', 'divider')),
  title TEXT NOT NULL,
  composer TEXT,
  status TEXT DEFAULT 'grey' CHECK (status IN ('grey', 'green', 'red')),
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.repertoire_items ENABLE ROW LEVEL SECURITY;

-- Public CRUD access (matching existing security model)
CREATE POLICY "Allow public read access on repertoire_items"
ON public.repertoire_items FOR SELECT USING (true);

CREATE POLICY "Allow public insert access on repertoire_items"
ON public.repertoire_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access on repertoire_items"
ON public.repertoire_items FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access on repertoire_items"
ON public.repertoire_items FOR DELETE USING (true);