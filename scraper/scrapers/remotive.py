"""Remotive API scraper — pure HTTP, no browser needed."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class RemotiveScraper(BaseScraper):
    """Scrape remote jobs from the Remotive public API."""

    name = "remotive"
    requires_browser = False

    # Remotive category slugs for filtering
    CATEGORY_MAP: dict[str, str] = {
        "software": "software-dev",
        "engineer": "software-dev",
        "developer": "software-dev",
        "frontend": "software-dev",
        "backend": "software-dev",
        "fullstack": "software-dev",
        "full stack": "software-dev",
        "devops": "devops-sysadmin",
        "sysadmin": "devops-sysadmin",
        "data": "data",
        "design": "design",
        "product": "product",
        "marketing": "marketing",
        "customer": "customer-support",
        "sales": "sales",
        "qa": "qa",
        "writing": "writing",
    }

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def _guess_category(self, keywords: list[str]) -> Optional[str]:
        """Try to map search keywords to a Remotive category slug."""
        combined = " ".join(keywords).lower()
        for token, slug in self.CATEGORY_MAP.items():
            if token in combined:
                return slug
        return None

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        query = " ".join(keywords)
        self.console.log(
            f"[bold cyan]Remotive[/] Searching for [cyan]'{query}'[/] (remote jobs)"
        )

        results: list[JobResult] = []

        base_url = f"https://remotive.com/api/remote-jobs?search={quote_plus(query)}"

        category = self._guess_category(keywords)
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

        jobs_list: list = []

        # Try with category filter first, fall back to without
        urls_to_try = []
        if category:
            urls_to_try.append((f"{base_url}&category={category}", category))
        urls_to_try.append((base_url, None))

        for api_url, cat in urls_to_try:
            if cat:
                self.console.log(f"[cyan]Remotive[/] Trying with category: {cat}")
            else:
                self.console.log("[cyan]Remotive[/] Searching without category filter")

            try:
                resp = self.http.get(api_url, headers=headers, timeout=20)
                self.console.log(f"[cyan]Remotive[/] Response status: {resp.status_code}")
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                self.console.log(f"[red]Remotive[/] API request failed: {exc}")
                continue

            jobs_list = data.get("jobs", [])
            self.console.log(f"[cyan]Remotive[/] API returned {len(jobs_list)} results.")

            if jobs_list:
                break
            elif cat:
                self.console.log("[cyan]Remotive[/] No results with category — retrying without filter")

        for item in jobs_list:
            try:
                title = item.get("title", "").strip()
                if not title:
                    continue

                company = item.get("company_name", "").strip() or None
                job_url = item.get("url", "").strip()
                if not job_url:
                    continue

                salary_text = item.get("salary", "").strip() or None
                description = item.get("description", "")

                pub_date = item.get("publication_date") or None
                candidate_location = item.get("candidate_required_location", "Remote")

                # Remotive provides job_type directly (e.g., "full_time")
                raw_job_type = item.get("job_type", "")
                job_type_map = {
                    "full_time": "Full-time",
                    "part_time": "Part-time",
                    "contract": "Contract",
                    "freelance": "Freelance",
                    "internship": "Internship",
                    "temporary": "Temporary",
                    "other": None,
                }
                job_type = job_type_map.get(raw_job_type, raw_job_type or None)

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=candidate_location,
                        url=job_url,
                        source=self.name,
                        salary=salary_text,
                        description=description,
                        posted_date=pub_date,
                        job_type=job_type,
                    )
                )
            except Exception:
                continue

        self.console.log(
            f"[bold cyan]Remotive[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
