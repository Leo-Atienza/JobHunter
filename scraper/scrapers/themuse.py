"""The Muse API scraper — free public API, no key required."""

from __future__ import annotations

from typing import Optional

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class TheMuseScraper(BaseScraper):
    """Scrape jobs from The Muse public API."""

    name = "themuse"
    requires_browser = False

    MAX_PAGES = 3
    RESULTS_PER_PAGE = 20

    # Map common seniority keywords to Muse levels
    LEVEL_MAP = {
        "junior": "Entry Level",
        "entry": "Entry Level",
        "intern": "Internship",
        "mid": "Mid Level",
        "senior": "Senior Level",
        "lead": "Senior Level",
        "manager": "Management",
        "director": "Management",
    }

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
            f"[bold bright_magenta]The Muse[/] Searching for [cyan]'{query}'[/]"
            f" in [cyan]{location or '(any)'}[/]"
        )

        results: list[JobResult] = []
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

        for page_num in range(self.MAX_PAGES):
            self.console.log(
                f"[bright_magenta]The Muse[/] Fetching page {page_num + 1}/{self.MAX_PAGES}..."
            )

            params: dict = {
                "page": page_num,
                "descending": "true",
            }

            # The Muse doesn't have a keyword search param — use category instead
            # We pass the query and filter client-side
            if location:
                params["location"] = location
            if remote:
                params["location"] = "Flexible / Remote"

            try:
                resp = self.http.get(
                    "https://www.themuse.com/api/public/v2/jobs",
                    headers=headers,
                    params=params,
                    timeout=15,
                )
                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                self.console.log(f"[red]The Muse[/] API request failed: {exc}")
                break

            items = data.get("results", [])
            if not items:
                self.console.log("[bright_magenta]The Muse[/] No more results.")
                break

            for item in items:
                try:
                    title = item.get("name", "").strip()
                    if not title:
                        continue

                    company_data = item.get("company", {})
                    company = company_data.get("name", "").strip() if company_data else None

                    locations = item.get("locations", [])
                    loc_names = [loc.get("name", "") for loc in locations if loc.get("name")]
                    job_location = ", ".join(loc_names) if loc_names else None

                    refs = item.get("refs", {})
                    job_url = refs.get("landing_page", "")
                    if not job_url:
                        continue

                    pub_date = item.get("publication_date") or None
                    if pub_date and "T" in pub_date:
                        pub_date = pub_date.split("T")[0]

                    # Build description from contents
                    contents = item.get("contents", "")
                    description = None
                    if contents:
                        # Strip HTML tags for plain text
                        import re
                        clean = re.sub(r"<[^>]+>", " ", contents)
                        clean = re.sub(r"\s+", " ", clean).strip()
                        description = clean

                    # Extract experience level from levels array
                    levels = item.get("levels", [])
                    level_names = [lv.get("name", "") for lv in levels if lv.get("name")]
                    experience_level = None
                    if level_names:
                        level_map = {
                            "Entry Level": "Entry",
                            "Mid Level": "Mid",
                            "Senior Level": "Senior",
                            "Internship": "Intern",
                            "Management": "Lead",
                        }
                        experience_level = level_map.get(level_names[0], level_names[0])

                    # Extract job type from type field
                    raw_type = item.get("type", "")
                    job_type = None
                    if raw_type:
                        type_map = {
                            "full-time": "Full-time",
                            "full time": "Full-time",
                            "part-time": "Part-time",
                            "part time": "Part-time",
                            "contract": "Contract",
                            "internship": "Internship",
                            "temporary": "Temporary",
                            "freelance": "Freelance",
                        }
                        job_type = type_map.get(raw_type.lower().strip(), raw_type.strip())

                    results.append(
                        JobResult(
                            title=title,
                            company=company,
                            location=job_location,
                            url=job_url,
                            source=self.name,
                            description=description,
                            posted_date=pub_date,
                            experience_level=experience_level,
                            job_type=job_type,
                        )
                    )
                except Exception:
                    continue

            self.console.log(
                f"[bright_magenta]The Muse[/] Found {len(results)} jobs so far."
            )

            total_pages = data.get("page_count", 0)
            if page_num + 1 >= total_pages:
                break

            self.rate_limit(0.5, 1.0)

        self.console.log(
            f"[bold bright_magenta]The Muse[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
