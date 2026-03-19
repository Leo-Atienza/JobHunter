# JobHunter

Your job search, supercharged. A hybrid web application where you run a local scraper on your machine and view aggregated results on a live dashboard.

## How It Works

1. **Get a session code** — Visit the website and generate a unique code (e.g. `JH-7X2K`)
2. **Run the scraper** — Execute the Python scraper on your machine with your session code
3. **View results** — Watch jobs appear in real-time on your personal dashboard

## Architecture

```
Browser → Vercel (Next.js) → Neon Postgres
                ↑
    Local Scraper (Python/Docker)
```

- **Website** (`web/`): Next.js 15 app deployed to Vercel — landing page + job dashboard
- **Scraper** (`scraper/`): Python package that scrapes job boards and pushes results to the API
- **Database**: Neon Serverless Postgres (free tier)

The scraper runs on YOUR machine, using YOUR IP — no anti-bot issues for the hosted service.

## Supported Job Sources

| Source | Method | Notes |
|--------|--------|-------|
| LinkedIn | Playwright | Public job search (no login required) |
| Indeed | Playwright | Job search results |
| Glassdoor | Playwright | Job listings |
| JobBank Canada | HTTP + BeautifulSoup | Government job board |
| Remotive | REST API | Remote jobs, no API key needed |
| Adzuna | REST API | Optional free API key for higher limits |

## Quick Start

### 1. Deploy the Website

```bash
cd web
npm install
# Set DATABASE_URL in .env (see .env.example)
npm run dev
```

Or deploy to Vercel — set `web/` as the root directory and add `DATABASE_URL` env var.

### 2. Set Up the Database

Run the SQL in `web/src/lib/schema.sql` against your Neon Postgres database.

### 3. Run the Scraper

**Python:**
```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
cp config.example.yaml config.yaml
# Edit config.yaml with your session code and preferences
python scrape.py
```

**Docker:**
```bash
cd scraper
cp config.example.yaml config.yaml
# Edit config.yaml
docker compose run scraper
```

**CLI only (no config file):**
```bash
python scrape.py --session JH-XXXX --keywords "Software Engineer" --location "Toronto, ON"
```

## Project Structure

```
jobhunter/
├── web/                    # Next.js app (Vercel)
│   ├── src/
│   │   ├── app/            # Pages and API routes
│   │   ├── components/     # React components
│   │   ├── lib/            # Database, utils, types
│   │   └── styles/         # Tailwind CSS
│   └── ...
├── scraper/                # Python scraper
│   ├── scrapers/           # Individual source scrapers
│   ├── scrape.py           # CLI entry point
│   └── ...
└── README.md
```

## Environment Variables

### Vercel (web/.env)
```
DATABASE_URL=postgresql://...@...neon.tech/jobhunter?sslmode=require
CRON_SECRET=<random-secret-for-cleanup-cron>
```

### Scraper (scraper/config.yaml)
See `scraper/config.example.yaml` for all options.

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/session` | Generate a new session code |
| POST | `/api/jobs` | Submit scraped jobs |
| GET | `/api/jobs?session=XX` | Fetch jobs for a session |
| PATCH | `/api/jobs/[id]` | Update job status/notes |
| GET | `/api/jobs/stats?session=XX` | Get session statistics |
| GET | `/api/jobs/export?session=XX` | Export jobs as CSV |
| GET | `/api/cleanup` | Cron: delete expired sessions |

## Security

- Session codes expire after 48 hours
- Rate limiting on session creation and job submission
- Input sanitization on all API endpoints
- No authentication required — session codes are the only identity
- Only job listing data is stored (no personal information)

## License

MIT
