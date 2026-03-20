"""Himalayas API scraper — free, no API key needed. Remote jobs only."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class HimalayasScraper(BaseScraper):
    """Scrape remote jobs from the Himalayas public API."""

    name = "himalayas"
    requires_browser = False

    MAX_PAGES = 3
    RESULTS_PER_PAGE = 20  # API returns max 20 per request

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
            f"[bold blue]Himalayas[/] Searching for [cyan]'{query}'[/] (remote jobs)"
        )

        results: list[JobResult] = []
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

        for page_num in range(1, self.MAX_PAGES + 1):
            offset = (page_num - 1) * self.RESULTS_PER_PAGE

            self.console.log(
                f"[blue]Himalayas[/] Fetching page {page_num}/{self.MAX_PAGES}..."
            )

            params: dict = {
                "q": query,
                "offset": offset,
                "limit": self.RESULTS_PER_PAGE,
                "sort": "recent",
            }

            try:
                resp = self.http.get(
                    "https://himalayas.app/jobs/api",
                    headers=headers,
                    params=params,
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                self.console.log(f"[red]Himalayas[/] API request failed: {exc}")
                break

            jobs_list = data.get("jobs", [])
            if not jobs_list:
                self.console.log("[blue]Himalayas[/] No more results.")
                break

            for item in jobs_list:
                try:
                    title = item.get("title", "").strip()
                    if not title:
                        continue

                    company = item.get("companyName", "").strip() or None
                    job_location = item.get("locationRestrictions") or "Remote"
                    if isinstance(job_location, list):
                        job_location = ", ".join(job_location) if job_location else "Remote"

                    slug = item.get("slug", "")
                    company_slug = item.get("companySlug", "")
                    if slug and company_slug:
                        job_url = f"https://himalayas.app/companies/{company_slug}/jobs/{slug}"
                    elif item.get("applicationLink"):
                        job_url = item["applicationLink"]
                    else:
                        continue

                    # Salary
                    salary_text: Optional[str] = None
                    min_salary = item.get("minSalary")
                    max_salary = item.get("maxSalary")
                    if min_salary and max_salary:
                        salary_text = f"${min_salary:,} - ${max_salary:,}"
                    elif min_salary:
                        salary_text = f"From ${min_salary:,}"
                    elif max_salary:
                        salary_text = f"Up to ${max_salary:,}"

                    pub_date = item.get("pubDate") or item.get("publishedDate") or None

                    # Truncate description
                    description = item.get("excerpt") or item.get("description") or None
                    if description and len(description) > 500:
                        description = description[:500] + "..."

                    results.append(
                        JobResult(
                            title=title,
                            company=company,
                            location=job_location,
                            url=job_url,
                            source=self.name,
                            salary=salary_text,
                            description=description,
                            posted_date=pub_date,
                        )
                    )
                except Exception:
                    continue

            self.console.log(
                f"[blue]Himalayas[/] Found {len(results)} jobs so far."
            )

            if len(jobs_list) < self.RESULTS_PER_PAGE:
                break  # No more pages

            self.rate_limit(0.5, 1.5)

        self.console.log(
            f"[bold blue]Himalayas[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
