"""Workday ATS scraper — pulls jobs from enterprise career pages via Workday's internal API."""

from __future__ import annotations

import json
from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


# Canadian enterprises known to use Workday for their career pages.
# Format: (display_name, base_url, site_path)
# Users can extend this via config.yaml under workday_companies.
DEFAULT_COMPANIES: list[tuple[str, str, str]] = [
    ("RBC", "https://rbc.wd3.myworkdayjobs.com", "rbc/RBC"),
    ("TD Bank", "https://td.wd3.myworkdayjobs.com", "TD/tdcareers"),
    ("Telus", "https://telus.wd3.myworkdayjobs.com", "telus/careers"),
    ("Rogers", "https://rogers.wd3.myworkdayjobs.com", "rogerscommunications/RogersCommunicationsCareers"),
    ("Bell", "https://bell.wd3.myworkdayjobs.com", "bell/Careers"),
    ("Loblaws", "https://loblaw.wd3.myworkdayjobs.com", "loblaw/Loblaw_Careers"),
    ("Manulife", "https://manulife.wd3.myworkdayjobs.com", "manulife_Careers/Manulife_Careers"),
    ("Sun Life", "https://sunlife.wd3.myworkdayjobs.com", "sunlife/SunLifeFinancial"),
    ("Scotiabank", "https://scotiabank.wd3.myworkdayjobs.com", "scotiabank/scotiabankcareers"),
    ("CIBC", "https://cibc.wd3.myworkdayjobs.com", "cibc/searchCIBC"),
    ("Deloitte Canada", "https://deloitte.wd5.myworkdayjobs.com", "deloitte/Deloitte_Canada"),
    ("Canada Post", "https://canadapost.wd3.myworkdayjobs.com", "canadapost/Canada_Post_Careers"),
    ("CGI", "https://cgi.wd3.myworkdayjobs.com", "cgi/CGICareers"),
]


class WorkdayScraper(BaseScraper):
    """Scrape jobs from enterprise career pages hosted on Workday.

    Workday career pages expose an internal JSON API at:
        POST https://{company}.{wd_instance}.myworkdayjobs.com/wday/cxs/{company}/{site}/jobs

    This is the same API that the career page JavaScript calls.
    No authentication is needed — it's a public-facing API.
    """

    name = "workday"
    requires_browser = False

    RESULTS_PER_PAGE = 20

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def _get_companies(self) -> list[tuple[str, str, str]]:
        """Get the list of Workday company configs to scrape."""
        custom = self.config.get("workday_companies", [])
        if custom:
            # Custom format: list of [display_name, base_url, site_path]
            return [tuple(c) for c in custom]
        return list(DEFAULT_COMPANIES)

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        query = " ".join(keywords)
        self.console.log(
            f"[bold yellow]Workday[/] Searching for [cyan]'{query}'[/]"
            f" across enterprise career pages"
        )

        results: list[JobResult] = []
        companies = self._get_companies()

        for display_name, base_url, site_path in companies:
            api_url = f"{base_url}/wday/cxs/{site_path}/jobs"

            headers = {
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Origin": base_url,
                "Referer": f"{base_url}/{site_path.split('/')[-1]}/",
            }

            # Build search payload
            search_text = query
            if location:
                search_text = f"{query} {location}"

            payload = {
                "appliedFacets": {},
                "limit": self.RESULTS_PER_PAGE,
                "offset": 0,
                "searchText": search_text,
            }

            try:
                resp = self.http.post(
                    api_url,
                    headers=headers,
                    data=json.dumps(payload),
                    timeout=20,
                )

                if resp.status_code in (404, 403):
                    continue  # Company endpoint not working
                resp.raise_for_status()

                data = resp.json()
            except Exception:
                continue

            job_postings = data.get("jobPostings", [])
            total = data.get("total", 0)

            if not job_postings:
                continue

            matched = 0
            for posting in job_postings:
                try:
                    title = posting.get("title", "").strip()
                    if not title:
                        continue

                    # Filter by keyword relevance
                    title_lower = title.lower()
                    query_lower = query.lower()
                    query_tokens = query_lower.split()
                    if not any(token in title_lower for token in query_tokens):
                        # Check bullet fields too
                        bullets = " ".join(
                            b.get("value", "").lower()
                            for b in posting.get("bulletFields", [])
                        )
                        if not any(token in f"{title_lower} {bullets}" for token in query_tokens):
                            continue

                    # Extract location from bullet fields
                    job_location = posting.get("locationsText", "")
                    if not job_location:
                        for bullet in posting.get("bulletFields", []):
                            if bullet.get("type") == "location":
                                job_location = bullet.get("value", "")
                                break

                    # Build job URL
                    external_path = posting.get("externalPath", "")
                    if external_path:
                        job_url = f"{base_url}/{site_path.split('/')[-1]}{external_path}"
                    else:
                        continue

                    # Extract posted date
                    posted_on = posting.get("postedOn") or None

                    results.append(
                        JobResult(
                            title=title,
                            company=display_name,
                            location=job_location or None,
                            url=job_url,
                            source=self.name,
                            posted_date=posted_on,
                        )
                    )
                    matched += 1
                except Exception:
                    continue

            if matched > 0:
                self.console.log(
                    f"[yellow]Workday[/] {display_name}: {matched} matching jobs"
                    f" (of {total} total)"
                )

            self.rate_limit(0.5, 1.5)

        self.console.log(
            f"[bold yellow]Workday[/] Finished — {len(results)} jobs collected "
            f"from {len(companies)} companies."
        )
        self.jobs = results
        return results
