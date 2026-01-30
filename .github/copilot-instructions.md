# Musical Metrics - AI Agent Instructions

## Project Overview
Musical Metrics is a practice tracking app for musicians that syncs with Google Calendar to aggregate practice time. It displays cumulative averages, milestone achievements, and repertoire management.

**Tech Stack:** Vite + React + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Bun

## Architecture & Data Flow

### Backend (Supabase)
- **practice_sessions**: Core table storing `started_at`, `duration_seconds`, `source` (csv/calendar)
- **milestones**: Achievement markers at hours thresholds (e.g., 1000, 2500, 10000)
- **repertoire_items**: Pieces with `type` (piece/divider), `status` (grey/green/red), `sort_order`
- **Edge Function**: `sync-calendar` - Google Calendar service account integration (30s timeout)

### Frontend State Management
- **Supabase Client**: Direct queries with pagination (1000 row chunks) - see `fetchData()` pattern in pages
- **React Query**: Used for Supabase integration (@tanstack/react-query)
- **Local State**: Analytics computed client-side from raw sessions in `lib/practiceAnalytics.ts`

### Key Data Transformation Pipeline
1. Raw sessions fetched from Supabase → stored as `RawSession[]`
2. Converted to `PracticeSession[]` format (add calculated fields)
3. Passed to `calculateAnalytics()` → produces `AnalyticsResult` with daily/intraday aggregations
4. Filtered by time range (1D/1W/1M/6M/1Y/ALL) → downsampled for chart rendering

## Critical Patterns & Conventions

### Version Management (Source of Truth)
- `package.json` version is the single source of truth
- UI displays version via `src/lib/version.ts` which imports `package.json` (requires `resolveJsonModule: true` in tsconfig)
- **Never hardcode version strings** - import `APP_VERSION` from `@/lib/version`

### Environment-Based Configuration
- **Base URL**: `vite.config.ts` sets `base: mode === 'production' ? '/musical-metrics/' : '/'`
- **Router**: `App.tsx` uses `basename={import.meta.env.BASE_URL}` (NOT hardcoded)
- Why: Supports both Lovable dev preview (/) and GitHub Pages deployment (/musical-metrics/)

### Component Architecture
- **SwipeableLayout**: Mobile-first swipeable tabs (Time/Repertoire views)
- **DailyAverageSection**: Main analytics component - fetches data, calculates analytics, renders charts
- **TenKOverview**: Milestone tracker with vertical timeline
- **Repertoire Components**: Drag-and-drop reordering with status indicators

### Styling Rules (from .cursorrules)
- **Use Tailwind + shadcn/ui exclusively** - no new CSS files or inline styles
- **Reuse `@/components/ui`** - don't rebuild primitives (Button, Card, Chart, etc.)
- **Visual-first development**: UI changes must be visible in preview immediately
- **Color system**: Trade Republic-inspired with `text-muted-foreground` (#595A5F) for secondary elements

### Calendar Sync Hook Pattern
```typescript
const { syncCalendar, isSyncing } = useCalendarSync();
const hasNewData = await syncCalendar(showToast);
// Returns boolean - true if new sessions added
```

### Data Fetching Pattern (Pagination)
```typescript
// All components use this pattern for >1000 sessions
const allData = [];
let from = 0;
const pageSize = 1000;
do {
  const { data } = await supabase
    .from('practice_sessions')
    .select('*')
    .order('started_at', { ascending: true })
    .range(from, from + pageSize - 1);
  allData.push(...data);
  from += pageSize;
} while (data?.length === pageSize);
```

## Development Workflows

### Run Commands (use Bun, not npm)
```bash
bun run dev          # Dev server on :8080
bun run build        # Production build
bun run build:dev    # Dev mode build (base: '/')
bun run test         # Vitest
```

### Deployment
- **Auto-deploy**: `.github/workflows/deploy.yml` triggers on push to main
- **GitHub Pages**: Builds with production base path, deploys dist/ folder
- **Manual**: Requires Pages source set to "GitHub Actions" in repo settings

### Common Tasks
- **Update version**: Change `package.json` only - UI auto-updates via `@/lib/version`
- **Add UI component**: Use `npx shadcn-ui@latest add <component>` (outputs to `src/components/ui/`)
- **Database changes**: Edit migrations in `supabase/migrations/`, apply via Supabase CLI

## Integration Points

### Supabase Setup
- Client configured in `src/integrations/supabase/client.ts`
- Types auto-generated in `src/integrations/supabase/types.ts`
- Edge functions in `supabase/functions/` (Deno runtime)

### Google Calendar Sync
- Uses service account JWT auth (not OAuth)
- Filters events with "practice" in summary (case-insensitive)
- Deduplicates by checking existing `started_at` timestamps
- Timeout: 30 seconds with error handling

## Gotchas & Anti-Patterns

❌ **Don't** hardcode version strings (v8, v7) - import from `@/lib/version`
❌ **Don't** hardcode base path in router - use `import.meta.env.BASE_URL`
❌ **Don't** forget pagination for `practice_sessions` queries
❌ **Don't** introduce new CSS approaches - stick to Tailwind
✅ **Do** make UI changes visible immediately (HMR-friendly incremental edits)
✅ **Do** use `multi_replace_string_in_file` for batched edits
✅ **Do** check `.cursorrules` for visual-first development guidelines
