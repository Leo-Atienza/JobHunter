"""Arbeitnow API scraper — free, no API key needed. European + remote jobs."""

from __future__ import annotations

from typing import Optional

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class ArbeitnowScraper(BaseScraper):
    """Scrape jobs from the Arbeitnow public API."""

    name = "arbeitnow"
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
            f"[bold bright_yellow]Arbeitnow[/] Searching for [cyan]'{query}'[/]"
            f" in [cyan]{location or '(any)'}[/]"
        )

        results: list[JobResult] = []
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

        for page_num in range(1, self.MAX_PAGES + 1):
            self.console.log(
                f"[bright_yellow]Arbeitnow[/] Fetching page {page_num}/{self.MAX_PAGES}..."
            )

            try:
                resp = self.http.get(
                    f"https://arbeitnow.com/api/job-board-api?page={page_num}",
                    headers=headers,
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                self.console.log(f"[red]Arbeitnow[/] API request failed: {exc}")
                break

            items = data.get("data", [])
            if not items:
                self.console.log("[bright_yellow]Arbeitnow[/] No more results.")
                break

            query_lower = query.lower()
            query_tokens = set(query_lower.split())

            for item in items:
                try:
                    title = item.get("title", "").strip()
                    if not title:
                        continue

                    # Client-side keyword filtering since API doesn't support search
                    title_lower = title.lower()
                    tags_str = " ".join(item.get("tags", [])).lower()
                    desc_lower = (item.get("description", "") or "").lower()
                    searchable = f"{title_lower} {tags_str} {desc_lower}"

                    # Check if any keyword token appears in title, tags, or description
                    if not any(token in searchable for token in query_tokens):
                        continue

                    company = item.get("company_name", "").strip() or None
                    job_location = item.get("location", "").strip() or None
                    is_remote = item.get("remote", False)
                    if is_remote and job_location:
                        job_location = f"{job_location} (Remote)"
                    elif is_remote:
                        job_location = "Remote"

                    job_url = item.get("url", "")
                    if not job_url:
                        slug = item.get("slug", "")
                        if slug:
                            job_url = f"https://arbeitnow.com/view/{slug}"
                        else:
                            continue

                    # Description — strip HTML
                    description = item.get("description", "")
                    if description:
                        import re
                        description = re.sub(r"<[^>]+>", " ", description)
                        description = re.sub(r"\s+", " ", description).strip()
                        if len(description) > 500:
                            description = description[:500] + "..."

                    created = item.get("created_at") or None
                    if created and isinstance(created, (int, float)):
                        from datetime import datetime
                        created = datetime.fromtimestamp(created).strftime("%Y-%m-%d")

                    tags = item.get("tags", [])

                    results.append(
                        JobResult(
                            title=title,
                            company=company,
                            location=job_location,
                            url=job_url,
                            source=self.name,
                            description=description or None,
                            posted_date=created,
                        )
                    )
                except Exception:
                    continue

            self.console.log(
                f"[bright_yellow]Arbeitnow[/] Found {len(results)} jobs so far."
            )

            # Check if there are more pages
            links = data.get("links", {})
            if not links.get("next"):
                break

            self.rate_limit(0.5, 1.5)

        self.console.log(
            f"[bold bright_yellow]Arbeitnow[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
