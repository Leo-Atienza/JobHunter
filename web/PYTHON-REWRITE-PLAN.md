# Python Scraper Rewrite Plan — Botasaurus Migration

## Status: DEFERRED (2026-04-23)

**This migration is no longer a near-term priority.** The original motivation was
to restore Indeed + Talent.com coverage, both of which had been blocked:

- `indeed-rss` → HTTP 403 via Cloudflare challenge (permanent, confirmed 2026-04-23)
- `talent.com/rss/jobs` → HTTP 404 (endpoint retired, confirmed 2026-04-23)
- `careerjet.ca/search/jobs?format=rss` → HTTP 200 but returns HTML, not RSS (feed deprecated)

Instead of browser automation, we solved the coverage gap in 2026-04-23 by:

1. **Removing** the 3 dead scrapers (`indeed-rss`, `careerjet`, `talent`) from the registry
2. **Adding the Ashby scraper** (`src/lib/scrapers/ashby.ts`) — 18 verified tenants
   including OpenAI, Notion, Cohere, Linear, Vercel, Supabase, Ramp, Cursor, Replit,
   and more. These companies had silently migrated away from Greenhouse/Lever over the
   past 2 years; Ashby's public JSON API is structured, uncredentialed, and free.
3. **Refreshing Greenhouse + Lever lists** to only known-live tokens (32 + 7
   respectively, all HTTP 200 verified).

Indeed jobs themselves remain accessible through **Adzuna** and **Jooble** (both
aggregators include Indeed listings). No user-visible coverage was lost.

### When to revive this plan

Only if **LinkedIn guest-API reliability collapses** AND the `linkedin-public.ts`
anti-detect headers stop working, OR if a must-have source (e.g., Indeed direct)
becomes strictly necessary for feature parity with a competitor. Even then, prefer
a single-purpose serverless browser (Browserbase, Bright Data SERP API, Apify
actors) over a full Python service rewrite, since a separate Python deployment
conflicts with the $0/month constraint (Vercel serverless cannot run Chromium).

---

## Executive Summary (original, for reference)

Replace all 16 TypeScript scrapers with Python equivalents powered by **Botasaurus**.
This enables true browser automation with anti-detection for blocked sites (LinkedIn,
Indeed) while keeping lightweight `@request`-based scraping for API-friendly sites.

## Architecture

```
Current (TypeScript in Next.js)         Future (Python + Botasaurus)
─────────────────────────────           ───────────────────────────
Next.js API route                       Next.js API route
  └─ scraper/*.ts (fetch)                 └─ POST to Python service
     └─ Returns ScrapedJob[]                 └─ FastAPI / Flask
                                                └─ Botasaurus scrapers
                                                   └─ Returns ScrapedJob[]
```

### Component Layout

```
scraper-service/
  requirements.txt          # botasaurus, fastapi, uvicorn
  main.py                   # FastAPI entrypoint
  scrapers/
    __init__.py              # Registry (mirrors index.ts)
    types.py                 # ScrapeParams, ScrapeResult, JobInput
    anti_detect.py           # Shared Botasaurus config (re-exported decorators)
    linkedin.py              # @browser — full Chrome, Google Referrer
    indeed.py                # @browser — bypasses Indeed's bot detection
    remoteok.py              # @request — lightweight with stealth headers
    weworkremotely.py        # @request — RSS feed parsing
    remotive.py              # @request — JSON API
    himalayas.py             # @request — JSON API
    jobicy.py                # @request — JSON API
    devitjobs.py             # @request — JSON API
    lever.py                 # @request — JSON API (parallel per company)
    greenhouse.py            # @request — JSON API (parallel per company)
    adzuna.py                # @request — JSON API (keyed)
    jooble.py                # @request — JSON API (keyed, POST)
    careerjet.py             # @request — RSS feed
    talent.py                # @request — RSS feed
    indeed_rss.py            # @request — RSS feed (fallback if browser blocked)
    jobbank.py               # @request — Apify API (unchanged pattern)
    firecrawl.py             # @task — Firecrawl SDK + Gemini (unchanged)
```

---

## Scraper-by-Scraper Migration

### Tier 1: Browser-based (`@browser`) — Most impactful

These scrapers are actively blocked or rate-limited. Botasaurus `@browser` with
human cursor simulation and Cloudflare bypass will dramatically improve reliability.

| Scraper | Current Issue | Botasaurus Approach |
|---------|---------------|---------------------|
| **LinkedIn** | CAPTCHA/block detection, limited to 50 jobs | `@browser` + `google_get()` + human cursor + pagination |
| **Indeed** | Rate-limited, RSS may be blocked | `@browser` + `bypass_cloudflare=True` for HTML scraping |

```python
# Example: linkedin.py
from botasaurus.browser import browser, Driver

@browser(parallel=2, cache=True, max_retry=3)
def scrape_linkedin(driver: Driver, data: dict):
    query = data["keywords"]
    location = data["location"]
    
    url = f"https://www.linkedin.com/jobs/search/?keywords={query}&location={location}"
    driver.google_get(url)  # Google Referrer trick
    
    jobs = []
    cards = driver.select_all(".base-search-card")
    for card in cards:
        title = card.select(".base-search-card__title")
        company = card.select(".base-search-card__subtitle a")
        # ... extract fields
        jobs.append({...})
    
    return jobs
```

### Tier 2: Stealth HTTP (`@request`) — Better fingerprinting

These scrapers work via HTTP but benefit from Botasaurus's automatic browser-like
headers, retry logic, and cookie management.

| Scraper | Current Method | Botasaurus Approach |
|---------|----------------|---------------------|
| **RemoteOK** | fetchJson + custom UA | `@request` with auto-headers |
| **WeWorkRemotely** | fetch + RSS | `@request` with RSS parsing |
| **Remotive** | fetchJson | `@request` with JSON parsing |
| **Himalayas** | fetchJson + pagination | `@request` with pagination loop |
| **Jobicy** | fetchJson + fallback | `@request` with fallback |
| **DevITjobs** | fetchJson | `@request` single call |
| **CareerJet** | fetch + RSS | `@request` with RSS parsing |
| **Talent.com** | fetch + RSS | `@request` with RSS parsing |
| **Indeed RSS** | fetch + RSS | `@request` with stealth headers |

```python
# Example: remoteok.py
from botasaurus.request import request, Request
from botasaurus.soupify import soupify

@request(max_retry=5, cache=True)
def scrape_remoteok(req: Request, data: dict):
    query = ",".join(data["keywords"][:3])
    resp = req.get(f"https://remoteok.com/api?tags={query}")
    resp.raise_for_status()
    
    items = resp.json()[1:]  # Skip metadata
    return [parse_job(item) for item in items if matches(item, data)]
```

### Tier 3: API-authenticated (minimal change)

These use API keys and won't benefit much from anti-detection, but get
Botasaurus caching and retry for free.

| Scraper | Notes |
|---------|-------|
| **Adzuna** | API key auth — wrap in `@request` for retry/cache |
| **Jooble** | API key + POST — wrap in `@request` for retry/cache |
| **Lever** | Public API, parallel per company — `@request` + `parallel=4` |
| **Greenhouse** | Public API, parallel per company — `@request` + `parallel=4` |
| **JobBank** | Apify API — keep current pattern, wrap in `@task` |
| **Firecrawl** | Firecrawl SDK + Gemini — keep current pattern, wrap in `@task` |

---

## Integration with Next.js

### Option A: Sidecar Service (Recommended)

Run the Python service alongside Next.js. Next.js API routes call it via HTTP.

```typescript
// web/src/lib/scrapers/python-bridge.ts
async function callPythonScraper(source: string, params: ScrapeParams): Promise<ScrapeResult> {
  const resp = await fetch(`${PYTHON_SERVICE_URL}/scrape/${source}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return resp.json();
}
```

**Hosting options (free tier):**
- **Railway.app** — 500 hours/month free, supports Docker
- **Render.com** — Free web service tier (spins down after inactivity)
- **Fly.io** — 3 shared VMs free, supports Docker
- **Local** — Run alongside Next.js in dev, Docker Compose for prod

### Option B: Python Subprocess (Zero-infra)

Call Python scripts directly from Next.js API routes via `child_process.exec`.
No separate service needed, but requires Python installed on the Vercel build.

**Verdict:** Not viable on Vercel Hobby (no Python runtime).

### Option C: Hybrid (Pragmatic)

Keep TypeScript scrapers for API-friendly sources (Tier 2 + 3).
Only use Python/Botasaurus for blocked sources (Tier 1: LinkedIn, Indeed).

**Verdict:** Best balance of effort vs. impact. Only 2 scrapers need Python.

---

## Migration Phases

### Phase 1: Foundation (1 session)
- [ ] Set up `scraper-service/` directory with FastAPI
- [ ] Create `types.py` mirroring TypeScript types
- [ ] Create shared Botasaurus config (`anti_detect.py`)
- [ ] Dockerize the service
- [ ] Create `python-bridge.ts` in Next.js

### Phase 2: High-Impact Browser Scrapers (1-2 sessions)
- [ ] LinkedIn scraper with `@browser` + Google Referrer
- [ ] Indeed scraper with `@browser` + Cloudflare bypass
- [ ] Test both scrapers locally
- [ ] Verify integration via python-bridge

### Phase 3: HTTP Scrapers (2-3 sessions)
- [ ] Migrate all Tier 2 scrapers to `@request`
- [ ] Enable Botasaurus caching for all scrapers
- [ ] Enable parallel execution for Lever/Greenhouse
- [ ] Remove TypeScript equivalents as each Python scraper is verified

### Phase 4: API Scrapers + Cleanup (1 session)
- [ ] Migrate Tier 3 scrapers
- [ ] Remove old TypeScript scraper files
- [ ] Update `index.ts` to route through python-bridge
- [ ] Deploy Python service to free hosting

### Phase 5: Advanced Features (future)
- [ ] Profile persistence (cookies survive between scrape sessions)
- [ ] Captcha solving integration (if needed for LinkedIn)
- [ ] Kubernetes scaling for parallel browser instances
- [ ] PostgreSQL cache storage (replace SQLite default)

---

## Cost Analysis

| Component | Free Tier | Limit |
|-----------|-----------|-------|
| Railway | 500 hrs/month | Enough for on-demand scraping |
| Render | 750 hrs/month | Spins down after 15 min inactivity |
| Fly.io | 3 shared VMs | 256MB RAM each |
| Botasaurus | Open source | No licensing cost |
| Chrome | Bundled | ~400MB Docker image |

**Risk:** Free hosting tiers may spin down, adding cold-start latency (30-60s).
Mitigation: Use keep-alive pings or accept cold starts for batch scraping.

---

## Decision: Recommended Approach

**Option C (Hybrid)** is the pragmatic choice:

1. Keep the TypeScript scrapers (now with anti-detect module) for all 14 API/RSS scrapers
2. Build a small Python service with Botasaurus `@browser` for LinkedIn + Indeed only
3. Host on Railway or Render free tier
4. Call via python-bridge from Next.js

This gives you the biggest anti-detection upgrade (LinkedIn/Indeed are the most
blocked) with minimal infrastructure change. The other 14 scrapers already work
well with the new TypeScript anti-detection module.

**Total effort:** ~3 sessions to set up, test, and deploy.
