"""Jooble API scraper — aggregates from thousands of job boards worldwide."""

from __future__ import annotations

import os
import re
from typing import Optional

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class JoobleScraper(BaseScraper):
    """Scrape jobs via the Jooble REST API.

    Jooble aggregates from thousands of job boards across 71 countries.
    Requires a free API key from https://jooble.org/api/about
    """

    name = "jooble"
    requires_browser = False

    MAX_PAGES = 3

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
            f"[bold bright_blue]Jooble[/] Searching for [cyan]'{query}'[/]"
            f" in [cyan]{location or '(any)'}[/]"
        )

        api_keys = self.config.get("api_keys", {})
        api_key = api_keys.get("jooble_api_key", "") or os.environ.get("JOOBLE_API_KEY", "")

        if not api_key:
            self.console.log(
                "[yellow]Jooble[/] No API key configured — skipping. "
                "Get a free key at https://jooble.org/api/about"
            )
            self.jobs = []
            return []

        results: list[JobResult] = []
        headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
        }

        for page_num in range(1, self.MAX_PAGES + 1):
            self.console.log(
                f"[bright_blue]Jooble[/] Fetching page {page_num}/{self.MAX_PAGES}..."
            )

            body: dict = {
                "keywords": query,
                "location": location,
                "page": str(page_num),
            }

            try:
                resp = self.http.post(
                    f"https://jooble.org/api/{api_key}",
                    headers=headers,
                    json=body,
                    timeout=20,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                self.console.log(f"[red]Jooble[/] API request failed: {exc}")
                break

            items = data.get("jobs", [])
            if not items:
                self.console.log("[bright_blue]Jooble[/] No more results — stopping.")
                break

            for item in items:
                try:
                    title = item.get("title", "").strip()
                    if not title:
                        continue

                    company = item.get("company", "").strip() or None
                    job_location = item.get("location", "").strip() or None
                    job_url = item.get("link", "").strip()
                    if not job_url:
                        continue

                    snippet = item.get("snippet", "")
                    salary = item.get("salary", "").strip() or None
                    updated = item.get("updated", "")

                    # Parse date from ISO format
                    posted_date = None
                    if updated and "T" in updated:
                        posted_date = updated.split("T")[0]

                    # Map job type
                    raw_type = item.get("type", "").strip()
                    job_type = None
                    if raw_type:
                        type_map = {
                            "full-time": "Full-time",
                            "fulltime": "Full-time",
                            "part-time": "Part-time",
                            "parttime": "Part-time",
                            "contract": "Contract",
                            "temporary": "Temporary",
                            "internship": "Internship",
                            "freelance": "Freelance",
                        }
                        job_type = type_map.get(raw_type.lower(), raw_type)

                    # Clean HTML from snippet
                    description = snippet
                    if description:
                        description = re.sub(r"<[^>]+>", " ", description)
                        description = re.sub(r"\s+", " ", description).strip()

                    results.append(
                        JobResult(
                            title=title,
                            company=company,
                            location=job_location,
                            url=job_url,
                            source=self.name,
                            salary=salary,
                            description=description or None,
                            posted_date=posted_date,
                            job_type=job_type,
                        )
                    )
                except Exception:
                    continue

            self.console.log(
                f"[bright_blue]Jooble[/] Found {len(results)} jobs so far."
            )
            self.rate_limit(0.5, 1.5)

        self.console.log(
            f"[bold bright_blue]Jooble[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
