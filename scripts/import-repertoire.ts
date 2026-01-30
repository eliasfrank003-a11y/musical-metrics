/**
 * Import Repertoire Script
 * 
 * Run with: 
 *   npx tsx scripts/import-repertoire.ts
 * 
 * Make sure to set environment variables:
 *   export VITE_SUPABASE_URL=xxx
 *   export VITE_SUPABASE_ANON_KEY=xxx
 * 
 * Or run with inline env vars:
 *   VITE_SUPABASE_URL=xxx VITE_SUPABASE_ANON_KEY=xxx npx tsx scripts/import-repertoire.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface RepertoireInsert {
  title: string;
  type: 'piece' | 'divider';
  status: 'grey' | 'green' | 'red';
  sort_order: number;
  started_at?: string | null;
  divider_label?: string | null;
}

async function importRepertoire(pieces: (string | { divider: string })[]) {
  // Get current max sort_order
  const { data: existing } = await supabase
    .from('repertoire_items')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1);

  let sortOrder = existing?.[0]?.sort_order ?? 0;

  const items: RepertoireInsert[] = pieces.map((piece) => {
    sortOrder++;

    // Handle dividers
    if (typeof piece === 'object' && 'divider' in piece) {
      return {
        title: '',
        type: 'divider' as const,
        status: 'grey' as const,
        sort_order: sortOrder,
        divider_label: piece.divider || null,
      };
    }

    // Parse piece with optional date in parentheses
    // Format: "29. Chopin: Mazurka Op. 24 No. 1 (Started: 18.01.2026 • 1 weeks)"
    const pieceStr = piece as string;
    
    // Remove the number prefix like "29. "
    const withoutNumber = pieceStr.replace(/^\d+\.\s*/, '');
    
    // Check for date in parentheses
    const dateMatch = withoutNumber.match(/\(Started:\s*(\d{2})\.(\d{2})\.(\d{4})/);
    let startedAt: string | null = null;
    let title = withoutNumber;
    
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      startedAt = `${year}-${month}-${day}`; // ISO format
      // Remove the parentheses part from title
      title = withoutNumber.replace(/\s*\(Started:.*\)/, '').trim();
    }

    return {
      title: title.trim(),
      type: 'piece' as const,
      status: 'grey' as const,
      sort_order: sortOrder,
      started_at: startedAt,
    };
  });

  console.log('Items to import:', JSON.stringify(items, null, 2));

  const { error } = await supabase.from('repertoire_items').insert(items);

  if (error) {
    console.error('Error importing:', error);
  } else {
    console.log(`\n✅ Successfully imported ${items.length} items!`);
  }
}

// Your list - ordered from bottom to top (lowest sort_order first)
const piecesToImport: (string | { divider: string })[] = [
  "1. Tiersen: Comptine d'un autre été",
  "2. Chopin: Waltz in A minor",
  "3. Tiersen: La Valse d'Amélie",
  "4. Ponce: Intermezzo No. 1",
  "5. Hurwitz: Mia and Sebastian's Theme",
  "6. Brahms: Op. 30 No. 9",
  { divider: "FLORENCE" },
  "7. Czerny: Op. 740 No. 1",
  "8. Chopin: Op. 69 No. 1",
  "9. Clementi: Op. 36 No. 6",
  "10. Czerny: Op. 299 No. 6",
  "11. Czerny: Op. 299 No. 7",
  "12. Kuhlau: Op. 20 No. 1",
  { divider: "IBU SEPTI" },
  "13. Haydn: Minuet and Trio",
  "14. Tan: Jester's Jig",
  "15. Cornick: In the Groove",
  "16. Bach: Prelude in C",
  "17. Czerny: Op. 849 No. 1",
  { divider: "" },
  "18. Cimarosa: Allegro",
  "19. Kabalevsky: Scherzo",
  "20. Agay: Blue Waltz",
  "21. Heller: Étude No. 15",
  { divider: "700" },
  "22. Massenet: Mélodie",
  "23. Schumann: Kinderszenen No. 1",
  "24. Heller: Prelude in C Sharp Minor",
  { divider: "DIDIER" },
  "25. Bach: Invention No. 1",
  { divider: "800" },
  "26. Bach: Invention No. 8",
  { divider: "900" },
  "27. Schubert: D899 No. 2 (Started: 12.12.2025 • 7 weeks)",
  "28. Sibelius: Etude Op. 76 No. 2 (Started: 08.01.2026 • 3 weeks)",
  { divider: "1000" },
  "29. Chopin: Mazurka Op. 24 No. 1 (Started: 18.01.2026 • 1 weeks)",
];

importRepertoire(piecesToImport);
