"""DevITjobs API scraper — free job board with no auth required."""

from __future__ import annotations

from typing import Optional

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class DevITjobsScraper(BaseScraper):
    """Scrape jobs from DevITjobs (devitjobs.com) public API.

    Free API with no authentication required. Returns IT/tech jobs
    across US and Canada.
    """

    name = "devitjobs"
    requires_browser = False

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
            f"[bold dark_orange]DevITjobs[/] Searching for [cyan]'{query}'[/]"
            f" in [cyan]{location or '(any)'}[/]"
        )

        results: list[JobResult] = []
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        }

        self.console.log("[dark_orange]DevITjobs[/] Fetching job listings...")

        try:
            resp = self.http.get(
                "https://devitjobs.com/api/jobslight",
                headers=headers,
                timeout=20,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            self.console.log(f"[red]DevITjobs[/] API request failed: {exc}")
            self.jobs = []
            return []

        if not isinstance(data, list):
            self.console.log("[red]DevITjobs[/] Unexpected API response format.")
            self.jobs = []
            return []

        self.console.log(
            f"[dark_orange]DevITjobs[/] API returned {len(data)} total listings. Filtering..."
        )

        # Client-side keyword filtering since the API returns all jobs
        query_lower = query.lower()
        query_tokens = [t for t in query_lower.split() if len(t) > 2]

        for item in data:
            try:
                title = item.get("name", "").strip()
                if not title:
                    continue

                # Quick relevance check — skip if no keyword tokens match
                title_lower = title.lower()
                techs = " ".join(item.get("technologies", []) or []).lower()
                combined_text = f"{title_lower} {techs}"

                matched_tokens = sum(1 for t in query_tokens if t in combined_text)
                if matched_tokens == 0:
                    continue

                company = item.get("company", "").strip() or None
                city = item.get("cityCategory", "").strip()
                state = item.get("stateCategory", "").strip()
                loc_parts = [p for p in (city, state) if p]
                job_location = ", ".join(loc_parts) or None

                # Build full URL
                job_slug = item.get("jobUrl", "")
                if not job_slug:
                    continue
                job_url = f"https://devitjobs.com/jobs/{job_slug}"

                # Redirect URL if available (direct to company)
                redirect = item.get("redirectJobUrl", "")
                if redirect:
                    job_url = redirect

                # Remote type
                remote_type = item.get("remoteType", "")
                workplace = item.get("workplace", "")
                if remote_type or workplace:
                    remote_info = remote_type or workplace
                    if job_location:
                        job_location = f"{job_location} ({remote_info})"
                    else:
                        job_location = remote_info

                # Salary
                salary_text = None
                sal_min = item.get("annualSalaryFrom")
                sal_max = item.get("annualSalaryTo")
                if sal_min and sal_max:
                    try:
                        salary_text = f"${int(sal_min):,} - ${int(sal_max):,}/yr"
                    except (ValueError, TypeError):
                        pass

                # Job type
                raw_type = item.get("jobType", "")
                job_type = None
                if raw_type:
                    type_map = {
                        "full-time": "Full-time",
                        "fulltime": "Full-time",
                        "part-time": "Part-time",
                        "contract": "Contract",
                        "internship": "Internship",
                        "freelance": "Freelance",
                    }
                    job_type = type_map.get(raw_type.lower().strip(), raw_type.strip())

                # Experience level
                experience_level = item.get("expLevel", "").strip() or None

                # Posted date
                posted_date = item.get("activeFrom", "")
                if posted_date and "T" in posted_date:
                    posted_date = posted_date.split("T")[0]
                else:
                    posted_date = posted_date or None

                # Skills/technologies
                skills = item.get("technologies", []) or []

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=job_location,
                        url=job_url,
                        source=self.name,
                        salary=salary_text,
                        posted_date=posted_date,
                        job_type=job_type,
                        experience_level=experience_level,
                        skills=", ".join(skills) if skills else None,
                    )
                )
            except Exception:
                continue

        self.console.log(
            f"[bold dark_orange]DevITjobs[/] Finished — {len(results)} matching jobs found."
        )
        self.jobs = results
        return results
