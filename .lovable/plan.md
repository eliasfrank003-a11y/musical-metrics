# Handing the App to Your Friend

Here is everything in the project that is "yours" and needs swapping for your friend, plus the cleanest way to share it.

---

## 1. Personal Data Hardcoded in the Code

These are the spots your friend (or his LLM) needs to edit.

### A. Start date / visual chart anchor
- `src/lib/practiceAnalytics.ts` — `VISUAL_START_DATE = new Date('2024-03-01')`
  - Used as the "All-Time" floor on charts. He should set this to the date he started tracking (or remove it so it's dynamic from the first session).

### B. Personal year markers (Y1 / Y2)
Hardcoded "1 Feb 2025" and "1 Feb 2026" appear in 3 files:
- `src/components/TenKOverview.tsx` (lines ~41–58)
- `src/components/DailyAverageSection.tsx` (lines ~115–132)
- `src/pages/Dashboard.tsx` (lines ~50–67)

He should replace these with his own anniversary dates, or we can refactor them to read from one shared config.

### C. Teacher / location milestone labels
Your teachers and cities are baked into the chart axis labels:
- `src/components/AllTimeChart.tsx` (lines ~47–84): `teacherKeywords = ['Florence','Ibu Septi','Didier',…]`, `teacherHours = [250, 447, 530, 641]`, locations `['Maastricht','Rungan Sari','Florence']`.
- `src/components/dashboard/VerticalTimeline.tsx` (lines ~140–152): same labels duplicated.

He needs to either clear these or replace with his own teacher transition hours and city list.

### D. Delete passcode
- `supabase/functions/delete-all-sessions/index.ts` — `const DELETE_PASSCODE = "Elias"`
  - He must change this string to his own passcode. (Better: move to a secret `DELETE_PASSCODE` so it lives outside the code.)

### E. Google Calendar connection (secrets, not code)
The calendar source lives in two backend secrets — no code change needed, just replace values in his own backend:
- `GOOGLE_CALENDAR_ID` — his calendar's ID
- `GOOGLE_SERVICE_ACCOUNT_JSON` — a service account JSON he creates and shares his calendar with

### F. Database content (not code, but "yours")
When he gets his own backend, these tables will be empty for him — perfect:
- `practice_sessions` — your calendar imports
- `milestones` — your 100h markers + Florence/Y1/Y2 notes
- `repertoire_items` — your piano pieces and dividers

He should NOT copy your DB; he gets a fresh one automatically when he remixes (see below).

### G. Branding / metadata (optional but nice)
- `index.html` — page title, meta description
- `public/manifest.json` — PWA name, icons
- Published URLs `musical-metrics.lovable.app` / `pianopractice.pro` — these stay yours; his remix gets a new URL.

---

## 2. Best Way to Share

You have three options. Recommended path in **bold**.

### Option A — **Public Remix (recommended, simplest)**
1. You: Project Settings → "Project" tab → enable **Public remixing**.
2. Send him the project link.
3. He clicks "Remix" → he gets his own Lovable project, his own fresh Lovable Cloud backend (empty DB, his own secrets), and his own published URL.
4. He then does the edits in section 1 (his LLM can do it from this checklist) and adds his own `GOOGLE_CALENDAR_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON` secrets.
5. You can disable public remixing afterwards.

Pros: one click for him, completely isolated backend, your data stays private.

### Option B — GitHub import
- Send him the GitHub repo, he imports it into a new Lovable project. Same end result as remix but more steps and he has to wire up Cloud manually. Use only if remix isn't available.

### Option C — Share access to your project
- Don't do this. He'd be editing your live app and your data.

---

## 3. What I Suggest We Do Before You Send It

To make his life (and his LLM's life) easier, I can — in a follow-up build turn — do any of these. Tell me which:

1. **Move the passcode to a secret** (`DELETE_PASSCODE`) so it's no longer in code.
2. **Centralize Y1/Y2 dates** into one config file instead of three duplicated spots.
3. **Make `VISUAL_START_DATE` dynamic** (auto = first practice session date).
4. **Add a `SETUP.md`** at the repo root with this exact checklist for his LLM to follow.
5. **Wipe the teacher/location labels** to neutral defaults so he starts from a clean slate.

Nothing in your live app changes data-wise — these are pure code edits that benefit the remix.
