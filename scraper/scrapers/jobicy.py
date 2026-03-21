"""Jobicy API scraper — free remote jobs API, no authentication required."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class JobicyScraper(BaseScraper):
    """Scrape remote jobs from the Jobicy public API.

    Free API with no authentication required.
    Docs: https://github.com/Jobicy/remote-jobs-api
    """

    name = "jobicy"
    requires_browser = False

    # Map common keywords to Jobicy industry slugs
    INDUSTRY_MAP: dict[str, str] = {
        "software": "dev-engineering",
        "developer": "dev-engineering",
        "engineer": "dev-engineering",
        "devops": "dev-engineering",
        "data": "data-science",
        "analytics": "data-science",
        "design": "design-multimedia",
        "marketing": "marketing",
        "product": "product-management",
        "finance": "finance-legal",
        "hr": "hr",
        "sales": "sales",
        "customer": "customer-success",
        "writing": "copywriting",
        "qa": "testing-qa",
    }

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def _guess_industry(self, keywords: list[str]) -> Optional[str]:
        """Map search keywords to a Jobicy industry slug."""
        combined = " ".join(keywords).lower()
        for token, slug in self.INDUSTRY_MAP.items():
            if token in combined:
                return slug
        return None

    def _get_geo(self) -> Optional[str]:
        """Map config country to Jobicy geo parameter."""
        country = self.config.get("country", "").lower()
        geo_map = {
            "ca": "canada",
            "us": "usa",
            "uk": "uk",
            "au": "australia",
            "de": "germany",
            "fr": "france",
        }
        return geo_map.get(country)

    # Shared job type mapping
    JOB_TYPE_MAP = {
        "full-time": "Full-time",
        "full_time": "Full-time",
        "part-time": "Part-time",
        "contract": "Contract",
        "internship": "Internship",
        "freelance": "Freelance",
        "temporary": "Temporary",
    }

    def _parse_jobs(self, items: list[dict]) -> list[JobResult]:
        """Parse a list of Jobicy API job objects into JobResult instances."""
        results: list[JobResult] = []
        for item in items:
            try:
                title = item.get("jobTitle", "").strip()
                if not title:
                    continue

                company = item.get("companyName", "").strip() or None
                job_geo = item.get("jobGeo", "").strip() or "Remote"
                job_url = item.get("url", "").strip()
                if not job_url:
                    continue

                # Salary
                salary_text = None
                sal_min = item.get("annualSalaryMin")
                sal_max = item.get("annualSalaryMax")
                sal_currency = item.get("salaryCurrency", "USD")
                if sal_min and sal_max:
                    symbol = "$" if sal_currency in ("USD", "CAD") else sal_currency + " "
                    try:
                        salary_text = f"{symbol}{int(sal_min):,} - {symbol}{int(sal_max):,}/yr"
                    except (ValueError, TypeError):
                        pass

                # Job type
                raw_type = item.get("jobType", "")
                job_type = self.JOB_TYPE_MAP.get(raw_type.lower().strip(), raw_type.strip()) if raw_type else None

                # Experience level
                experience_level = item.get("jobLevel", "").strip() or None

                # Description
                description = item.get("jobExcerpt", "").strip() or None

                # Published date
                pub_date = item.get("pubDate", "")
                posted_date = None
                if pub_date and "T" in pub_date:
                    posted_date = pub_date.split("T")[0]
                elif pub_date:
                    posted_date = pub_date

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=job_geo,
                        url=job_url,
                        source=self.name,
                        salary=salary_text,
                        description=description,
                        posted_date=posted_date,
                        job_type=job_type,
                        experience_level=experience_level,
                    )
                )
            except Exception:
                continue
        return results

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        query = " ".join(keywords)
        self.console.log(
            f"[bold bright_green]Jobicy[/] Searching for [cyan]'{query}'[/] (remote jobs)"
        )

        results: list[JobResult] = []
        headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

        # Build API URL with filters
        params: dict[str, str] = {
            "count": "50",
            "tag": quote_plus(query),
        }

        geo = self._get_geo()
        if geo:
            params["geo"] = geo

        industry = self._guess_industry(keywords)
        if industry:
            params["industry"] = industry

        param_str = "&".join(f"{k}={v}" for k, v in params.items())
        api_url = f"https://jobicy.com/api/v2/remote-jobs?{param_str}"

        self.console.log(f"[bright_green]Jobicy[/] Fetching jobs...")

        try:
            resp = self.http.get(api_url, headers=headers, timeout=20)
            resp.raise_for_status()
            # Check for bot protection (returns HTML instead of JSON)
            content_type = resp.headers.get("Content-Type", "")
            if "text/html" in content_type:
                self.console.log(
                    "[yellow]Jobicy[/] Bot protection detected — API returned HTML instead of JSON. "
                    "Try again later."
                )
                self.jobs = []
                return []
            data = resp.json()
        except Exception as exc:
            self.console.log(f"[red]Jobicy[/] API request failed: {exc}")
            self.jobs = []
            return []

        items = data.get("jobs", [])
        self.console.log(f"[bright_green]Jobicy[/] API returned {len(items)} results.")

        results = self._parse_jobs(items)

        # If no results with industry filter, retry without it
        if not results and industry:
            self.console.log(
                "[bright_green]Jobicy[/] No results with industry filter — retrying without..."
            )
            params.pop("industry", None)
            param_str = "&".join(f"{k}={v}" for k, v in params.items())
            fallback_url = f"https://jobicy.com/api/v2/remote-jobs?{param_str}"

            try:
                resp = self.http.get(fallback_url, headers=headers, timeout=20)
                resp.raise_for_status()
                content_type = resp.headers.get("Content-Type", "")
                if "text/html" in content_type:
                    self.console.log(
                        "[yellow]Jobicy[/] Bot protection on fallback too — skipping."
                    )
                else:
                    data = resp.json()
                    items = data.get("jobs", [])
                    results = self._parse_jobs(items)
            except Exception as exc:
                self.console.log(
                    f"[red]Jobicy[/] Fallback request also failed: {exc}"
                )

        self.console.log(
            f"[bold bright_green]Jobicy[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
