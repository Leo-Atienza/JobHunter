---
title: "Stack & Architecture"
type: context
related: []
created: 2026-04-10
updated: 2026-04-10
---

# JobHunter — Stack & Architecture

AI-powered job search aggregator. Scrapes 16 job boards, scores matches against your resume, and tracks applications.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 (CSS-only `@theme`) |
| Database | Neon Postgres (serverless, raw SQL via `@neondatabase/serverless`) |
| Auth | NextAuth v5 (Google OAuth, JWT sessions) |
| AI | Gemini 2.0 Flash (resume extraction + AI summaries) |
| Data fetching | SWR (client-side) |
| PDF | pdfjs-dist (client-side PDF parsing) |
| Icons | lucide-react (16/20/24px sizing) |
| Deploy | Vercel Hobby (source dir: `web/`) |

## Key Architectural Decisions

- **Raw SQL over ORM** — Neon serverless with direct SQL, no Prisma/Drizzle
- **16 scrapers** registered in `web/src/lib/scrapers/index.ts`
- **Match scoring** — 4-component: skill 50pt + title 20pt + desc 20pt + exp 10pt
- **Synonym expansion** — ~85 synonym groups in `synonyms.ts` for query matching
- **City filtering** — Multi-city + metro alias support in `city-filter.ts`

## Project Structure

```
web/
  src/
    app/                    # Next.js App Router pages
    components/
      dashboard/            # Dashboard page components
      landing/              # Landing page sections
      layout/               # Shared layout (SiteHeader)
      saved/                # Tracker/saved jobs page
      ui/                   # Shared UI (Toast, CopyButton, SearchBar)
    hooks/                  # Custom hooks (useUrlFilters)
    lib/
      scrapers/             # 16 server-side job scrapers
      migrations/           # SQL migration files (018 total)
      match-scoring.ts
      synonyms.ts
      schema.sql
      city-filter.ts
```

## Database

- 18 migration files in `web/src/lib/migrations/`
- Canonical schema in `web/src/lib/schema.sql`
- Neon serverless — no connection pooling needed

## Deployment

- Vercel Hobby plan
- Deployed from repo root, `web/` as source directory
- Google OAuth configured via NextAuth v5
