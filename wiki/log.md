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
| 2026-04-24 | feat+fix | Session 14 — 5 commits (82abd20…642bc25) | Finished Session 13's 5 follow-ups. (1) Greenhouse display names (Grafanalabs→Grafana Labs, Unity3d→Unity, Gitlab→GitLab, D2l→D2L) via Ashby-style override map. (2) Ashby tenants 18→39, all live-verified HTTP 200. (3) SearchBar recent-search localStorage history (jobhunter_search_history, max 10, keyboard nav, dropdown). (4) LinkedIn retries 2→3 + partial-failure error_message capture in scrape_logs for observability. (5) Job alerts MVP: migration 019 adds job_alerts table, Resend email digest, GET/POST/DELETE /api/alerts + /api/alerts/unsubscribe + /api/cron/alerts-digest cron at 9am ET, AlertsButton + AlertsList UI — all env-gated by RESEND_API_KEY + NEXT_PUBLIC_ALERTS_ENABLED so feature ships disabled until user provisions Resend. Verified: tsc clean, 57/57 vitest, 32-route next build clean. Pushed to main → Vercel deploys. Apply migration 019 manually before enabling alerts cron. |
