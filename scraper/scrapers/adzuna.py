"""Adzuna API scraper — requires free API keys from https://developer.adzuna.com."""

from __future__ import annotations

import os
from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class AdzunaScraper(BaseScraper):
    """Scrape jobs via the Adzuna REST API."""

    name = "adzuna"
    requires_browser = False

    MAX_PAGES = 2
    RESULTS_PER_PAGE = 20

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        query = " ".join(keywords)
        self.console.log(
            f"[bold yellow]Adzuna[/] Searching for [cyan]'{query}'[/] in [cyan]{location}[/]"
        )

        # Extract API keys from config or environment variables
        api_keys = self.config.get("api_keys", {})
        app_id = api_keys.get("adzuna_app_id", "") or os.environ.get("ADZUNA_APP_ID", "")
        app_key = api_keys.get("adzuna_api_key", "") or os.environ.get("ADZUNA_API_KEY", "")

        if not app_id or not app_key:
            self.console.log(
                "[yellow]Adzuna[/] No API keys configured — skipping. "
                "Get free keys at https://developer.adzuna.com"
            )
            self.jobs = []
            return []

        results: list[JobResult] = []
        country = self.config.get("adzuna_country", "ca")

        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

        for page_num in range(1, self.MAX_PAGES + 1):
            api_url = (
                f"https://api.adzuna.com/v1/api/jobs/{country}/search/{page_num}"
                f"?app_id={app_id}"
                f"&app_key={app_key}"
                f"&what={quote_plus(query)}"
                f"&where={quote_plus(location)}"
                f"&results_per_page={self.RESULTS_PER_PAGE}"
                f"&content-type=application/json"
            )

            self.console.log(
                f"[yellow]Adzuna[/] Fetching page {page_num}/{self.MAX_PAGES}..."
            )

            try:
                resp = self.http.get(api_url, headers=headers, timeout=20)
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                self.console.log(f"[red]Adzuna[/] API request failed: {exc}")
                break

            items = data.get("results", [])
            if not items:
                self.console.log("[yellow]Adzuna[/] No more results — stopping.")
                break

            for item in items:
                try:
                    title = item.get("title", "").strip()
                    if not title:
                        continue

                    company_info = item.get("company", {})
                    company_name = company_info.get("display_name", "").strip() or None

                    location_info = item.get("location", {})
                    display_name = location_info.get("display_name", "").strip() or None

                    redirect_url = item.get("redirect_url", "")
                    if not redirect_url:
                        continue

                    # Salary
                    salary_min = item.get("salary_min")
                    salary_max = item.get("salary_max")
                    salary_text: Optional[str] = None
                    if salary_min and salary_max:
                        salary_text = f"${salary_min:,.0f} - ${salary_max:,.0f}"
                    elif salary_min:
                        salary_text = f"From ${salary_min:,.0f}"
                    elif salary_max:
                        salary_text = f"Up to ${salary_max:,.0f}"

                    description = item.get("description", "")

                    created = item.get("created") or None

                    # Map contract_type to normalized job_type
                    raw_contract = item.get("contract_type", "")
                    contract_type_map = {
                        "full_time": "Full-time",
                        "part_time": "Part-time",
                        "contract": "Contract",
                        "permanent": "Full-time",
                        "temporary": "Temporary",
                        "internship": "Internship",
                        "freelance": "Freelance",
                    }
                    job_type = contract_type_map.get(raw_contract, None)

                    results.append(
                        JobResult(
                            title=title,
                            company=company_name,
                            location=display_name,
                            url=redirect_url,
                            source=self.name,
                            salary=salary_text,
                            description=description or None,
                            posted_date=created,
                            job_type=job_type,
                        )
                    )
                except Exception:
                    continue

            self.console.log(
                f"[yellow]Adzuna[/] Found {len(results)} jobs so far."
            )
            self.rate_limit(0.5, 1.5)

        self.console.log(
            f"[bold yellow]Adzuna[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
