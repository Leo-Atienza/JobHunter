"""Indeed job scraper — Playwright-based with HTTP fallback."""

from __future__ import annotations

import json
import random
import re
from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class IndeedScraper(BaseScraper):
    """Scrape Indeed using Playwright to bypass anti-bot protections.

    Indeed aggressively blocks plain HTTP requests, so we use a real browser
    as the primary approach, with HTTP+JSON extraction as a fallback.
    """

    name = "indeed"
    requires_browser = True  # Playwright needed to bypass anti-bot

    MAX_PAGES = 3

    # Indeed country domains
    COUNTRY_DOMAINS = {
        "ca": "ca.indeed.com",
        "us": "www.indeed.com",
        "uk": "uk.indeed.com",
        "au": "au.indeed.com",
    }

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def _get_domain(self) -> str:
        """Get the Indeed domain based on config country setting."""
        country = self.config.get("indeed_country", "ca").lower()
        return self.COUNTRY_DOMAINS.get(country, "ca.indeed.com")

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        query = " ".join(keywords)
        domain = self._get_domain()
        self.console.log(
            f"[bold green]Indeed[/] Searching for [cyan]'{query}'[/] in [cyan]{location}[/]"
        )

        # Try Playwright first, fall back to HTTP
        results = self._scrape_with_playwright(query, location, domain, remote)

        if not results:
            self.console.log(
                "[yellow]Indeed[/] Playwright returned no results — trying HTTP fallback..."
            )
            results = self._scrape_with_http(query, location, domain, remote)

        self.console.log(
            f"[bold green]Indeed[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results

    def _scrape_with_playwright(
        self, query: str, location: str, domain: str, remote: bool
    ) -> list[JobResult]:
        """Use Playwright to render Indeed pages and extract job data."""
        results: list[JobResult] = []

        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout
        except ImportError:
            self.console.log("[yellow]Indeed[/] Playwright not available.")
            return results

        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--disable-features=IsolateOrigins,site-per-process",
                        "--disable-dev-shm-usage",
                        "--no-first-run",
                        "--no-default-browser-check",
                    ],
                )
                # Randomize viewport to avoid fingerprinting
                width = random.choice([1366, 1440, 1536, 1920])
                height = random.choice([768, 900, 864, 1080])
                context = browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": width, "height": height},
                    locale="en-US",
                    timezone_id="America/Toronto",
                    extra_http_headers={
                        "Accept-Language": "en-US,en;q=0.9",
                        "Sec-CH-UA": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                        "Sec-CH-UA-Mobile": "?0",
                        "Sec-CH-UA-Platform": '"Windows"',
                    },
                )
                page = context.new_page()
                # Hide automation indicators
                page.add_init_script("""
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
                    Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
                    window.chrome = {runtime: {}};
                """)

                # Visit homepage first to get cookies (more realistic browsing)
                try:
                    page.goto(f"https://{domain}/", wait_until="domcontentloaded", timeout=15000)
                    page.wait_for_timeout(2000)
                    # Dismiss cookie consent / popups if present
                    for btn_sel in [
                        "button#onetrust-accept-btn-handler",
                        "button[data-gnav-element-name='Cookie-accept']",
                        "button.icl-Button--primary",
                    ]:
                        try:
                            btn = page.query_selector(btn_sel)
                            if btn:
                                btn.click()
                                page.wait_for_timeout(500)
                                break
                        except Exception:
                            continue
                except Exception:
                    pass  # Homepage visit is best-effort

                for page_num in range(self.MAX_PAGES):
                    start = page_num * 10
                    url = (
                        f"https://{domain}/jobs"
                        f"?q={quote_plus(query)}"
                        f"&l={quote_plus(location)}"
                        f"&start={start}"
                    )
                    if remote:
                        url += "&remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11"

                    self.console.log(
                        f"[green]Indeed[/] Loading page {page_num + 1}/{self.MAX_PAGES}..."
                    )

                    try:
                        page.goto(url, wait_until="commit", timeout=30000)
                        # Longer wait for page to stabilize
                        page.wait_for_timeout(4000)

                        # Detect Cloudflare/anti-bot blocks early
                        page_title = page.title().lower()
                        if any(t in page_title for t in ("blocked", "just a moment", "captcha", "verify")):
                            self.console.log(
                                "[yellow]Indeed[/] Blocked by Cloudflare anti-bot protection — "
                                "cannot scrape with headless browser."
                            )
                            break

                        try:
                            page.wait_for_selector(
                                "div.job_seen_beacon, div.jobsearch-ResultsList, "
                                "td.resultContent, div[data-testid='jobListing'], "
                                "div.mosaic-zone, ul.css-zu9cdh",
                                timeout=10000,
                            )
                        except PwTimeout:
                            # Selectors may have changed — wait for network idle instead
                            page.wait_for_load_state("networkidle", timeout=10000)
                    except PwTimeout:
                        self.console.log(
                            "[yellow]Indeed[/] Page load timed out — moving on."
                        )
                        break
                    except Exception as exc:
                        self.console.log(f"[yellow]Indeed[/] Could not load page: {exc}")
                        break

                    # Extract from rendered page HTML — try multiple strategies
                    html = page.content()
                    page_jobs = self._extract_from_mosaic(html, domain)
                    if not page_jobs:
                        page_jobs = self._extract_from_next_data(html, domain)
                    if not page_jobs:
                        page_jobs = self._extract_jobs_from_html(html, domain)

                    # Also try extracting from visible job cards via DOM
                    if not page_jobs:
                        page_jobs = self._extract_from_dom(page, domain)

                    if not page_jobs:
                        self.console.log(
                            "[yellow]Indeed[/] No jobs found on this page — stopping."
                        )
                        break

                    results.extend(page_jobs)
                    self.console.log(
                        f"[green]Indeed[/] Found {len(results)} jobs so far."
                    )
                    self.rate_limit(2.0, 4.0)

                browser.close()

        except Exception as exc:
            self.console.log(f"[red]Indeed[/] Playwright scraper error: {exc}")

        return results

    def _extract_from_dom(self, page, domain: str) -> list[JobResult]:
        """Extract jobs directly from DOM elements via Playwright."""
        results: list[JobResult] = []

        try:
            cards = page.query_selector_all(
                "div.job_seen_beacon, div.cardOutline, li div.result, "
                "div[data-testid='jobListing'], div.slider_item, div.resultContent"
            )

            for card in cards:
                try:
                    title_el = card.query_selector(
                        "h2.jobTitle a span, h2.jobTitle span[title], a.jcs-JobTitle span, "
                        "h2 a span[id^='jobTitle'], a[data-jk] span"
                    )
                    company_el = card.query_selector(
                        "[data-testid='company-name'], span.companyName, span.company, "
                        "span.css-92r8pb"
                    )
                    location_el = card.query_selector(
                        "[data-testid='text-location'], div.companyLocation, div.location, "
                        "div.css-1p0sjhy"
                    )
                    link_el = card.query_selector(
                        "h2.jobTitle a, a.jcs-JobTitle, a[data-jk]"
                    )
                    salary_el = card.query_selector(
                        "div.salary-snippet-container, div.metadata.salary-snippet-container"
                    )

                    title_text = title_el.inner_text().strip() if title_el else None
                    if not title_text:
                        continue

                    company_text = company_el.inner_text().strip() if company_el else None
                    location_text = location_el.inner_text().strip() if location_el else None
                    salary_text = salary_el.inner_text().strip() if salary_el else None

                    href = link_el.get_attribute("href") if link_el else None
                    if not href:
                        continue

                    # Build full URL
                    if href.startswith("/"):
                        href = f"https://{domain}{href}"

                    # Extract job key for clean URL
                    jk_match = re.search(r'jk=([a-f0-9]+)', href)
                    if jk_match:
                        job_url = f"https://{domain}/viewjob?jk={jk_match.group(1)}"
                    else:
                        job_url = href.split("&")[0] if "&" in href else href

                    results.append(
                        JobResult(
                            title=title_text,
                            company=company_text,
                            location=location_text,
                            url=job_url,
                            source=self.name,
                            salary=salary_text,
                        )
                    )
                except Exception:
                    continue
        except Exception:
            pass

        return results

    def _scrape_with_http(
        self, query: str, location: str, domain: str, remote: bool
    ) -> list[JobResult]:
        """Fallback: try HTTP requests with embedded JSON extraction."""
        results: list[JobResult] = []

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Sec-CH-UA": '"Chromium";v="123", "Google Chrome";v="123"',
            "Sec-CH-UA-Mobile": "?0",
            "Sec-CH-UA-Platform": '"Windows"',
        }

        for page_num in range(self.MAX_PAGES):
            start = page_num * 10
            url = (
                f"https://{domain}/jobs"
                f"?q={quote_plus(query)}"
                f"&l={quote_plus(location)}"
                f"&start={start}"
            )
            if remote:
                url += "&remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11"

            self.console.log(
                f"[green]Indeed[/] HTTP fallback — page {page_num + 1}/{self.MAX_PAGES}..."
            )

            try:
                resp = self.http.get(url, headers=headers, timeout=20)
                if resp.status_code in (401, 403):
                    self.console.log(
                        f"[yellow]Indeed[/] Access denied ({resp.status_code}) — anti-bot block."
                    )
                    break
                resp.raise_for_status()
            except Exception as exc:
                self.console.log(f"[yellow]Indeed[/] Request failed: {exc}")
                break

            html = resp.text
            page_jobs = self._extract_jobs_from_html(html, domain)

            if not page_jobs:
                page_jobs = self._extract_from_mosaic(html, domain)

            if not page_jobs:
                self.console.log("[yellow]Indeed[/] No jobs found — stopping.")
                break

            results.extend(page_jobs)
            self.console.log(f"[green]Indeed[/] Found {len(results)} jobs so far.")
            self.rate_limit(2.0, 4.0)

        return results

    def _extract_from_mosaic(self, html: str, domain: str) -> list[JobResult]:
        """Extract jobs from window.mosaic.providerData JSON blob."""
        results: list[JobResult] = []

        pattern = r'window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{.+?\});\s*</script>'
        match = re.search(pattern, html, re.DOTALL)
        if not match:
            return results

        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            return results

        meta = data.get("metaData", {})
        model = meta.get("mosaicProviderJobCardsModel", {})
        items = model.get("results", [])

        if not items:
            items = data.get("results", [])

        for item in items:
            try:
                title = item.get("title", "").strip()
                if not title:
                    continue

                company = item.get("company", "").strip() or None
                loc = item.get("formattedLocation", "").strip() or None
                salary = item.get("salarySnippet", {})
                salary_text = salary.get("text") if salary else None

                job_key = item.get("jobkey", "")
                if job_key:
                    job_url = f"https://{domain}/viewjob?jk={job_key}"
                else:
                    continue

                date_text = item.get("formattedRelativeDate") or None

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=loc,
                        url=job_url,
                        source=self.name,
                        salary=salary_text,
                        posted_date=date_text,
                    )
                )
            except Exception:
                continue

        return results

    def _extract_from_next_data(self, html: str, domain: str) -> list[JobResult]:
        """Extract jobs from __NEXT_DATA__ JSON (Indeed's Next.js migration)."""
        results: list[JobResult] = []

        pattern = r'<script[^>]*id="__NEXT_DATA__"[^>]*>(\{.+?\})</script>'
        match = re.search(pattern, html, re.DOTALL)
        if not match:
            return results

        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            return results

        # Navigate the Next.js data structure to find job results
        # The structure varies, so try multiple paths
        props = data.get("props", {}).get("pageProps", {})

        # Try common paths for job results in Next.js data
        for key in ("searchResults", "results", "jobResults", "initialResults"):
            items = props.get(key)
            if isinstance(items, dict):
                items = items.get("results", items.get("jobs", []))
            if isinstance(items, list) and items:
                for item in items:
                    try:
                        title = item.get("title", "").strip()
                        if not title:
                            continue
                        company = item.get("company", item.get("companyName", ""))
                        if isinstance(company, dict):
                            company = company.get("name", "")
                        company = company.strip() or None
                        loc = item.get("formattedLocation", item.get("location", ""))
                        if isinstance(loc, dict):
                            loc = loc.get("name", loc.get("city", ""))
                        loc = str(loc).strip() or None
                        job_key = item.get("jobkey", item.get("jobKey", ""))
                        if job_key:
                            job_url = f"https://{domain}/viewjob?jk={job_key}"
                        else:
                            continue
                        salary = item.get("salarySnippet", {})
                        salary_text = salary.get("text") if isinstance(salary, dict) else None
                        results.append(
                            JobResult(
                                title=title,
                                company=company,
                                location=loc,
                                url=job_url,
                                source=self.name,
                                salary=salary_text,
                            )
                        )
                    except Exception:
                        continue
                if results:
                    break

        return results

    def _extract_jobs_from_html(self, html: str, domain: str) -> list[JobResult]:
        """Extract jobs from script tags containing job data JSON."""
        results: list[JobResult] = []

        ld_pattern = r'<script[^>]*type="application/ld\+json"[^>]*>(\{.*?"@type"\s*:\s*"JobPosting".*?\})</script>'
        for match in re.finditer(ld_pattern, html, re.DOTALL):
            try:
                data = json.loads(match.group(1))
                if data.get("@type") != "JobPosting":
                    continue

                title = data.get("title", "").strip()
                if not title:
                    continue

                org = data.get("hiringOrganization", {})
                company = org.get("name", "").strip() if isinstance(org, dict) else None
                loc_data = data.get("jobLocation", {})
                if isinstance(loc_data, dict):
                    address = loc_data.get("address", {})
                    loc = address.get("addressLocality", "") if isinstance(address, dict) else ""
                elif isinstance(loc_data, list) and loc_data:
                    address = loc_data[0].get("address", {})
                    loc = address.get("addressLocality", "") if isinstance(address, dict) else ""
                else:
                    loc = None

                salary_data = data.get("baseSalary", {})
                salary_text = None
                if isinstance(salary_data, dict):
                    value = salary_data.get("value", {})
                    if isinstance(value, dict):
                        min_val = value.get("minValue")
                        max_val = value.get("maxValue")
                        if min_val and max_val:
                            salary_text = f"${min_val:,.0f} - ${max_val:,.0f}"

                job_url = data.get("url", "")
                if not job_url:
                    continue
                if not job_url.startswith("http"):
                    job_url = f"https://{domain}{job_url}"

                # Extract job type from employmentType in LD+JSON
                job_type = None
                employment_type = data.get("employmentType", "")
                if employment_type:
                    emp_type_map = {
                        "FULL_TIME": "Full-time",
                        "PART_TIME": "Part-time",
                        "CONTRACT": "Contract",
                        "TEMPORARY": "Temporary",
                        "INTERN": "Internship",
                        "INTERNSHIP": "Internship",
                        "FREELANCE": "Freelance",
                    }
                    if isinstance(employment_type, list):
                        employment_type = employment_type[0] if employment_type else ""
                    job_type = emp_type_map.get(
                        employment_type.upper().strip(), employment_type.strip()
                    )

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=loc,
                        url=job_url,
                        source=self.name,
                        salary=salary_text,
                        job_type=job_type,
                    )
                )
            except (json.JSONDecodeError, Exception):
                continue

        return results
