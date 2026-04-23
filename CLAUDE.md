# JobHunter — Project Instructions

## Stack
- **Framework:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4 (CSS-only `@theme`)
- **Database:** Neon Postgres (serverless, raw SQL via `@neondatabase/serverless`)
- **Auth:** NextAuth v5 (Google OAuth, JWT sessions)
- **AI:** Gemini 2.0 Flash (resume extraction, AI summaries)
- **Data:** SWR (client fetching), pdfjs-dist (client-side PDF parsing)
- **Icons:** lucide-react (tree-shakeable, 16/20/24px sizing)
- **Deploy:** Vercel Hobby (from repo root, `web/` as source dir)

## Project Structure
```
web/
  src/
    app/                    # Next.js App Router pages
    components/
      dashboard/            # Dashboard page components
      landing/              # Landing page sections (Hero, HowItWorks, FAQ, etc.)
      layout/               # Shared layout (SiteHeader)
      saved/                # Tracker/saved jobs page
      ui/                   # Shared UI (Toast, CopyButton, SearchBar, etc.)
    hooks/                  # Custom hooks (useUrlFilters, etc.)
    lib/
      scrapers/             # 16 server-side job scrapers (registered in index.ts)
      migrations/           # SQL migration files (018 total)
      match-scoring.ts      # 4-component scoring: skill 50pt + title 20pt + desc 20pt + exp 10pt
      synonyms.ts           # ~85 synonym groups for query expansion
      schema.sql            # Canonical DB schema
      city-filter.ts        # Multi-city + metro alias filtering
    styles/globals.css      # @theme tokens, keyframes, stagger utilities
```

## Key Patterns

### Scrapers
- All scrapers in `web/src/lib/scrapers/`, registered in `index.ts`
- New scrapers export `{ scrapeX }` function, return `ScrapedJob[]`
- Synonym expansion happens at scrape time (~85 groups in `synonyms.ts`)
- Never add dead ATS companies — verify endpoints first

### Navigation
- **SiteHeader** (`components/layout/SiteHeader.tsx`) — unified nav with left/right/mobileLinks slots
- All pages use SiteHeader — never duplicate nav code

### Filters
- **useUrlFilters** (`hooks/useUrlFilters.ts`) — 12 params synced to URL search params
- Short param names: q, src, st, exp, type, smin, smax, fresh, ghost, remote, co, loc
- `<Suspense>` wrapper required around any component using `useSearchParams`

### Sessions
- Session codes: JH-XXXX (anonymous 48h, authenticated permanent)
- Cross-source dedup with `duplicate_of` FK
- Ghost job detection via daily cron HEAD-checks

### Animations
- Spring physics: `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring-in
- Stagger classes: `.stagger-1` through `.stagger-8` (60ms intervals)
- Modal exit: `leaving` state -> `animate-slide-out-right` -> 150ms delay -> unmount
- All animations defined in `globals.css` @theme block

### Icons
- Use lucide-react for ALL icons (never inline SVGs)
- Exception: Google logo SVGs (brand assets with specific colors)
- Consistent sizing: 12/14/16/20/24px

### Database
- Raw SQL via `@neondatabase/serverless` — no ORM
- Migrations: sequential numbered files in `lib/migrations/`
- Run migrations manually on Neon (not auto-applied)
- All queries use parameterized inputs (never string interpolation)

## Build & Test
```bash
cd web && npm run build          # Next.js build
cd web && npx tsc --noEmit       # Type check
cd web && npx vitest run         # Unit tests (57 tests)
```

## Deploy
- Push to `main` branch — Vercel auto-deploys
- Vercel project: `prj_8njR3wiPfa7GSuKkJ4BTmrMNCM6T`
- Vercel Hobby = 300s timeout (Fluid Compute), NOT 10s
- DB migrations must be run manually after deploy

## Constraints
- $0/month — all features must use free tiers only
- No dark mode
- No dream job feature (removed in migration 018)

## Auto-Scraper-Debug Protocol

When debugging scraper failures, automatically follow this protocol:
1. Run the failing scraper in isolation — capture the raw response/error payload
2. Show the actual output before hypothesizing root cause
3. Verify env vars are loaded, endpoint is reachable, and SDK version is correct
4. Implement a fix based on evidence, not assumptions
5. Re-run the scraper to confirm the fix works before moving to the next
6. After all scrapers pass, run the full test suite
7. If any scraper fails after 3 fix attempts, stop and report with raw output
