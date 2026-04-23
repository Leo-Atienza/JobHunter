---
title: Activity Log
type: log
---

# Activity Log

| Date | Action | Page | Notes |
|------|--------|------|-------|
| 2026-04-10 | init | - | Project wiki initialized |
| 2026-04-10 | ingest | context/stack.md | Compiled stack + architecture from CLAUDE.md |
| 2026-04-22 | audit-fix | web/src/ (6 files) | L99 bug audit — safe SWR fetcher, hydration mismatch, notes data-loss, silent duplicate count, missing useCallback deps. Commit 4185021, deployed to Vercel. |
| 2026-04-23 | handoff | wiki/, web/PYTHON-REWRITE-PLAN.md, .gitignore | Housekeeping commit — wiki scaffolding + Python (Botasaurus) rewrite plan landed; local tooling dirs (.claude/, graphify-out/, .next/, raw/) now gitignored. No source changes; tsc clean, vitest 57/57. |
| 2026-04-23 | feat | web/src/lib/scrapers/, landing pages | Replaced 3 dead scrapers (indeed-rss 403, talent 404, careerjet HTML-not-RSS) with new Ashby scraper (18 verified tenants incl. OpenAI, Cohere, Notion, Linear, Vercel, Supabase, Ramp). Expanded Greenhouse 19→32 and Lever 4→7 companies, all live-verified. Landing page source counts now derive from JOB_SOURCES.length. Python rewrite DEFERRED with activation criteria. Registry: 16 → 14 sources; net job count +++. Commit dd060d7, deployed to Vercel. |
