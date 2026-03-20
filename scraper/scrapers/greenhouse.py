"""Greenhouse ATS scraper — pulls jobs from company career pages via Greenhouse's public API."""

from __future__ import annotations

from typing import Optional

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


# Canadian companies known to use Greenhouse for their career pages.
# Users can extend this via config.yaml under greenhouse_companies.
DEFAULT_COMPANIES = [
    "hootsuite",
    "lightspeedcommerce",
    "nuvei",
    "coveo",
    "unity3d",
    "dapperlabs",
    "dialoginsight",
    "applydigital",
    "eventbase",
    "thinkific",
    "trulioo",
    "achievers",
    "d2l",
    "gapingvoid",
    "procurify",
    "opentext",
    "sap",
    "shoppersentertainment",
    "benchsci",
    "fingerprint",
    "ritual",
    "clearbanc",
    "kira",
    "willowbiosciences",
    "ceridian",
]


class GreenhouseScraper(BaseScraper):
    """Scrape jobs from company career pages hosted on Greenhouse.

    Greenhouse exposes a free, unauthenticated JSON API at:
        GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs

    The API is explicitly "cached and not rate limited" per their docs.
    """

    name = "greenhouse"
    requires_browser = False

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def _get_companies(self) -> list[str]:
        """Get the list of Greenhouse board tokens to scrape."""
        custom = self.config.get("greenhouse_companies", [])
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
            f"[bold green]Greenhouse[/] Searching for [cyan]'{query}'[/]"
            f" across company career pages"
        )

        results: list[JobResult] = []
        companies = self._get_companies()
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

        for board_token in companies:
            api_url = (
                f"https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs"
                f"?content=true"
            )

            try:
                resp = self.http.get(api_url, headers=headers, timeout=15)

                if resp.status_code == 404:
                    continue  # Board not found
                resp.raise_for_status()

                data = resp.json()
                jobs_list = data.get("jobs", [])
                if not jobs_list:
                    continue

            except Exception:
                continue

            matched = 0
            for job in jobs_list:
                try:
                    title = job.get("title", "").strip()
                    if not title:
                        continue

                    # Filter by keyword relevance
                    title_lower = title.lower()
                    query_tokens = query.split()
                    if not any(token in title_lower for token in query_tokens):
                        # Also check departments
                        departments = job.get("departments", [])
                        dept_names = " ".join(
                            d.get("name", "").lower() for d in departments
                        )
                        combined = f"{title_lower} {dept_names}"
                        if not any(token in combined for token in query_tokens):
                            continue

                    # Filter by location
                    job_location = job.get("location", {}).get("name", "")

                    if location and job_location:
                        loc_lower = location.lower()
                        job_loc_lower = job_location.lower()
                        if (
                            loc_lower not in job_loc_lower
                            and "remote" not in job_loc_lower
                            and "canada" not in job_loc_lower
                        ):
                            continue

                    job_url = job.get("absolute_url", "")
                    if not job_url:
                        continue

                    # Extract description (HTML) — strip tags for plain text
                    content = job.get("content", "")
                    if content:
                        import re
                        description = re.sub(r"<[^>]+>", " ", content)
                        description = re.sub(r"\s+", " ", description).strip()
                        if len(description) > 500:
                            description = description[:500] + "..."
                    else:
                        description = None

                    # Parse date
                    updated_at = job.get("updated_at") or job.get("created_at")
                    posted_date = None
                    if updated_at:
                        try:
                            posted_date = updated_at[:10]  # "2026-03-15T..."
                        except Exception:
                            pass

                    results.append(
                        JobResult(
                            title=title,
                            company=board_token.replace("-", " ").title(),
                            location=job_location or None,
                            url=job_url,
                            source=self.name,
                            description=description,
                            posted_date=posted_date,
                        )
                    )
                    matched += 1
                except Exception:
                    continue

            if matched > 0:
                self.console.log(
                    f"[green]Greenhouse[/] {board_token}: {matched} matching jobs"
                )

            self.rate_limit(0.2, 0.5)

        self.console.log(
            f"[bold green]Greenhouse[/] Finished — {len(results)} jobs collected "
            f"from {len(companies)} companies."
        )
        self.jobs = results
        return results
