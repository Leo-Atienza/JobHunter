"""Lever ATS scraper — pulls jobs from company career pages via Lever's public API."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


# Canadian companies known to use Lever for their career pages.
# Users can extend this via config.yaml under lever_companies.
DEFAULT_COMPANIES = [
    "shopify",
    "wealthsimple",
    "clio",
    "1password",
    "hopper",
    "benevity",
    "vidyard",
    "ada-support",
    "koho",
    "clearco",
    "tophat",
    "ecobee",
    "freshbooks",
    "tulip",
    "dnaspaces",
    "properly",
    "vena-solutions",
    "designthinkers",
    "certn",
    "jobber",
    "neo-financial",
    "faire",
    "snapcommerce",
    "league",
    "paytm-labs",
]


class LeverScraper(BaseScraper):
    """Scrape jobs from company career pages hosted on Lever.

    Lever exposes a free, unauthenticated JSON API at:
        GET https://api.lever.co/v0/postings/{company}?mode=json

    This scraper iterates over a list of known Canadian companies,
    fetches their open positions, and filters by keyword/location.
    """

    name = "lever"
    requires_browser = False

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def _get_companies(self) -> list[str]:
        """Get the list of Lever company slugs to scrape."""
        custom = self.config.get("lever_companies", [])
        if custom:
            return custom
        return list(DEFAULT_COMPANIES)

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        query = " ".join(keywords).lower()
        self.console.log(
            f"[bold bright_green]Lever[/] Searching for [cyan]'{query}'[/]"
            f" across company career pages"
        )

        results: list[JobResult] = []
        companies = self._get_companies()
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

        for company_slug in companies:
            api_url = (
                f"https://api.lever.co/v0/postings/{company_slug}"
                f"?mode=json"
            )
            if location:
                api_url += f"&location={quote_plus(location)}"

            try:
                resp = self.http.get(api_url, headers=headers, timeout=15)

                if resp.status_code == 404:
                    continue  # Company not found or no jobs
                if resp.status_code == 429:
                    self.console.log("[yellow]Lever[/] Rate limited — pausing.")
                    self.rate_limit(5.0, 10.0)
                    continue
                resp.raise_for_status()

                postings = resp.json()
                if not isinstance(postings, list):
                    continue

            except Exception:
                continue

            matched = 0
            for posting in postings:
                try:
                    title = posting.get("text", "").strip()
                    if not title:
                        continue

                    # Filter by keyword relevance
                    title_lower = title.lower()
                    query_tokens = query.split()
                    if not any(token in title_lower for token in query_tokens):
                        # Also check categories
                        categories = posting.get("categories", {})
                        team = (categories.get("team") or "").lower()
                        dept = (categories.get("department") or "").lower()
                        combined = f"{title_lower} {team} {dept}"
                        if not any(token in combined for token in query_tokens):
                            continue

                    # Filter by location if specified
                    posting_location = (
                        categories.get("location", "") if "categories" in dir() else
                        posting.get("categories", {}).get("location", "")
                    )
                    categories = posting.get("categories", {})
                    posting_location = categories.get("location", "")

                    if location and posting_location:
                        loc_lower = location.lower()
                        posting_loc_lower = posting_location.lower()
                        # Accept if location matches or if remote
                        if (
                            loc_lower not in posting_loc_lower
                            and "remote" not in posting_loc_lower
                            and "canada" not in posting_loc_lower
                        ):
                            continue

                    hosted_url = posting.get("hostedUrl", "")
                    apply_url = posting.get("applyUrl", "")
                    job_url = hosted_url or apply_url
                    if not job_url:
                        continue

                    commitment = categories.get("commitment", "")  # Full-time, etc.
                    description_plain = posting.get("descriptionPlain", "")
                    if description_plain and len(description_plain) > 500:
                        description_plain = description_plain[:500] + "..."

                    # Parse date
                    created_at = posting.get("createdAt")
                    posted_date = None
                    if created_at:
                        try:
                            from datetime import datetime
                            posted_date = datetime.fromtimestamp(
                                created_at / 1000
                            ).strftime("%Y-%m-%d")
                        except Exception:
                            pass

                    results.append(
                        JobResult(
                            title=title,
                            company=company_slug.replace("-", " ").title(),
                            location=posting_location or None,
                            url=job_url,
                            source=self.name,
                            description=description_plain or None,
                            posted_date=posted_date,
                        )
                    )
                    matched += 1
                except Exception:
                    continue

            if matched > 0:
                self.console.log(
                    f"[bright_green]Lever[/] {company_slug}: {matched} matching jobs"
                )

            self.rate_limit(0.3, 0.8)

        self.console.log(
            f"[bold bright_green]Lever[/] Finished — {len(results)} jobs collected "
            f"from {len(companies)} companies."
        )
        self.jobs = results
        return results
