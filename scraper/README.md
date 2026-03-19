# JobHunter Scraper

Local Python scraper that searches multiple job boards and uploads results to your [JobHunter](https://jobhunter.vercel.app) dashboard.

## Supported Sources

| Source | Method | Notes |
|---|---|---|
| LinkedIn | Playwright (headless) | Public search, no login required |
| Indeed | Playwright (headless) | Parses search results pages |
| Glassdoor | Playwright (headless) | First page only (heavy anti-bot) |
| Job Bank Canada | requests + BeautifulSoup | Government site, reliable |
| Remotive | REST API | Free, no keys needed |
| Adzuna | REST API | Free tier, requires API keys |

## Before You Start

1. **Get a session code** from [jobhunter.vercel.app](https://jobhunter.vercel.app) — click "Generate Session Code"
2. Choose your setup method below: **pip install** (recommended) or **Docker** (no Python needed)

---

## Option A: pip install (Recommended)

### Step 1: Install Python (if you don't have it)

- **Windows**: Download from [python.org/downloads](https://python.org/downloads). During install, **check "Add Python to PATH"**.
- **Mac**: Run `brew install python` or download from [python.org](https://python.org/downloads).
- **Linux**: Run `sudo apt install python3 python3-pip` (Ubuntu/Debian) or `sudo dnf install python3` (Fedora).

Verify it works by opening a terminal and running:
```bash
python --version
```
You need Python 3.9 or newer.

### Step 2: Install the scraper

```bash
pip install jobhunter-scraper
```

That's it — no cloning, no downloading. This installs the `jobhunter-scrape` command.

### Step 3: Install the browser engine

This downloads a small browser needed to scrape LinkedIn, Indeed, and Glassdoor:
```bash
playwright install chromium
```

### Step 4: Run the scraper

```bash
jobhunter-scrape --session JH-XXXX --keywords "Software Engineer" --location "Toronto, ON"
```

Replace `JH-XXXX` with the session code you got from the website. Results will appear on your dashboard automatically.

---

## Option B: Docker Setup (no Python needed)

### Step 1: Install Docker Desktop

Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/) for your operating system. Start Docker Desktop after installing.

### Step 2: Download the scraper

**With Git:**
```bash
git clone https://github.com/Leo-Atienza/JobHunter.git
cd jobhunter/scraper
```

**Without Git:** Go to the GitHub repo, click the green "Code" button → "Download ZIP". Extract and open the `scraper` folder.

### Step 3: Create your config file

```bash
cp config.example.yaml config.yaml
```

Open `config.yaml` in any text editor (Notepad, VS Code, etc.) and:
- Replace `JH-XXXX` with your session code
- Update the keywords and location to match your job search

### Step 4: Run

```bash
docker compose run scraper
```

That's it! Docker handles all the dependencies automatically.

---

## CLI Options

```
jobhunter-scrape [OPTIONS]

Options:
  --session TEXT    Session code (JH-XXXX). Overrides config.
  --keywords TEXT   Comma-separated search keywords. Overrides config.
  --location TEXT   Job location. Overrides config.
  --config TEXT     Path to config file (default: config.yaml).
  --sources TEXT    Comma-separated sources to run (e.g. "linkedin,remotive").
  --dry-run        Scrape but don't upload results (test mode).
  --api-url TEXT    Override API URL (for self-hosted deployments).
  --help           Show this message and exit.
```

> **Note:** If you're running from the cloned repo instead of pip install, use `python scrape.py` instead of `jobhunter-scrape`.

### Examples

```bash
# Quick start — just pass your session code and what you're looking for
jobhunter-scrape --session JH-A1B2 --keywords "Software Engineer" --location "Toronto, ON"

# Search for multiple roles
jobhunter-scrape --session JH-A1B2 --keywords "Python Developer,Backend Engineer" --location "Vancouver, BC"

# Only run specific sources (faster)
jobhunter-scrape --session JH-A1B2 --sources "remotive,jobbank" --keywords "Developer"

# Test without uploading (see what the scraper finds)
jobhunter-scrape --session JH-A1B2 --keywords "Data Scientist" --dry-run

# Use a config file instead of CLI flags
jobhunter-scrape --config config.yaml
```

## Config File Reference

```yaml
session_code: "JH-XXXX"          # Your session code from the web app
api_url: "https://jobhunter.vercel.app"

search:
  keywords:                       # List of job titles or search terms
    - "Software Engineer"
    - "Full Stack Developer"
  location: "Toronto, ON"        # City, state/province
  remote: true                   # Also include remote positions

sources:                          # Turn each source on/off
  linkedin: true
  indeed: true
  glassdoor: true
  jobbank: true
  remotive: true
  adzuna: true

api_keys:                         # Optional — only needed for Adzuna
  adzuna_app_id: ""
  adzuna_api_key: ""
```

## Troubleshooting

### "python is not recognized" / "command not found"
Python isn't installed or isn't in your PATH. Reinstall Python and make sure to check "Add Python to PATH" during installation (Windows). On Mac/Linux, try `python3` instead of `python`.

### "No session code specified"
Either add `session_code` to `config.yaml` or pass `--session JH-XXXX` on the command line.

### "Invalid session code"
The code must match the format `JH-` followed by four characters (e.g. `JH-A1B2`). Copy it exactly from the website.

### "Session expired or not found"
Session codes expire after 48 hours. Generate a new one from the website.

### Playwright browser not found
Run `playwright install chromium` after installing dependencies.

### LinkedIn / Indeed / Glassdoor returning 0 results
These sites actively block scrapers. Results may vary depending on your location and timing. The API-based sources (Remotive, Adzuna, Job Bank) are more reliable.

### Adzuna "No API keys configured"
Sign up for free API keys at [developer.adzuna.com](https://developer.adzuna.com) and add them to your config file. This is optional — the other sources work without API keys.

### Docker: "permission denied" or "config.yaml not found"
Make sure `config.yaml` exists in the scraper directory. On Linux, you may need to run `chmod 644 config.yaml`.
