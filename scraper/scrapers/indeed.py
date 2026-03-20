"""Indeed job scraper using direct HTTP + embedded JSON extraction."""

from __future__ import annotations

import json
import re
from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class IndeedScraper(BaseScraper):
    """Scrape Indeed by extracting embedded JSON data from page source.

    Indeed embeds job card data as JSON in a <script> tag via
    window.mosaic.providerData, so no browser rendering is needed.
    """

    name = "indeed"
    requires_browser = False  # No longer needs Playwright

    MAX_PAGES = 3

    # Indeed country domains
    COUNTRY_DOMAINS = {
        "ca": "ca.indeed.com",
        "us": "www.indeed.com",
        "uk": "uk.indeed.com",
        "au": "au.indeed.com",
    }

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def _get_domain(self) -> str:
        """Get the Indeed domain based on config country setting."""
        country = self.config.get("indeed_country", "ca").lower()
        return self.COUNTRY_DOMAINS.get(country, "www.indeed.com")

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        query = " ".join(keywords)
        domain = self._get_domain()
        self.console.log(
            f"[bold green]Indeed[/] Searching for [cyan]'{query}'[/] in [cyan]{location}[/]"
        )

        results: list[JobResult] = []

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

        for page_num in range(self.MAX_PAGES):
            start = page_num * 10
            url = (
                f"https://{domain}/jobs"
                f"?q={quote_plus(query)}"
                f"&l={quote_plus(location)}"
                f"&start={start}"
            )
            if remote:
                url += "&remotejob=032b3046-06a3-4876-8dfd-474eb5e7ed11"

            self.console.log(
                f"[green]Indeed[/] Loading page {page_num + 1}/{self.MAX_PAGES}..."
            )

            try:
                resp = self.http.get(url, headers=headers, timeout=20)
                if resp.status_code == 403:
                    self.console.log(
                        "[yellow]Indeed[/] Access denied (403) — may need proxy."
                    )
                    break
                resp.raise_for_status()
            except Exception as exc:
                self.console.log(f"[yellow]Indeed[/] Request failed: {exc}")
                break

            html = resp.text
            page_jobs = self._extract_jobs_from_html(html, domain)

            if not page_jobs:
                # Fallback: try the mosaic data pattern
                page_jobs = self._extract_from_mosaic(html, domain)

            if not page_jobs:
                self.console.log("[yellow]Indeed[/] No jobs found on this page — stopping.")
                break

            results.extend(page_jobs)
            self.console.log(
                f"[green]Indeed[/] Found {len(results)} jobs so far."
            )
            self.rate_limit(2.0, 4.0)

        self.console.log(
            f"[bold green]Indeed[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results

    def _extract_from_mosaic(self, html: str, domain: str) -> list[JobResult]:
        """Extract jobs from window.mosaic.providerData JSON blob."""
        results: list[JobResult] = []

        pattern = r'window\.mosaic\.providerData\["mosaic-provider-jobcards"\]\s*=\s*(\{.+?\});\s*</script>'
        match = re.search(pattern, html, re.DOTALL)
        if not match:
            return results

        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            return results

        # Navigate to the results array
        meta = data.get("metaData", {})
        model = meta.get("mosaicProviderJobCardsModel", {})
        items = model.get("results", [])

        if not items:
            # Alternative path
            items = data.get("results", [])

        for item in items:
            try:
                title = item.get("title", "").strip()
                if not title:
                    continue

                company = item.get("company", "").strip() or None
                loc = item.get("formattedLocation", "").strip() or None
                salary = item.get("salarySnippet", {})
                salary_text = salary.get("text") if salary else None

                # Build URL from job key
                job_key = item.get("jobkey", "")
                if job_key:
                    job_url = f"https://{domain}/viewjob?jk={job_key}"
                else:
                    continue

                date_text = item.get("formattedRelativeDate") or None

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=loc,
                        url=job_url,
                        source=self.name,
                        salary=salary_text,
                        posted_date=date_text,
                    )
                )
            except Exception:
                continue

        return results

    def _extract_jobs_from_html(self, html: str, domain: str) -> list[JobResult]:
        """Extract jobs from script tags containing job data JSON."""
        results: list[JobResult] = []

        # Try to find JSON-LD structured data
        ld_pattern = r'<script[^>]*type="application/ld\+json"[^>]*>(\{.*?"@type"\s*:\s*"JobPosting".*?\})</script>'
        for match in re.finditer(ld_pattern, html, re.DOTALL):
            try:
                data = json.loads(match.group(1))
                if data.get("@type") != "JobPosting":
                    continue

                title = data.get("title", "").strip()
                if not title:
                    continue

                org = data.get("hiringOrganization", {})
                company = org.get("name", "").strip() if isinstance(org, dict) else None
                loc_data = data.get("jobLocation", {})
                if isinstance(loc_data, dict):
                    address = loc_data.get("address", {})
                    loc = address.get("addressLocality", "") if isinstance(address, dict) else ""
                elif isinstance(loc_data, list) and loc_data:
                    address = loc_data[0].get("address", {})
                    loc = address.get("addressLocality", "") if isinstance(address, dict) else ""
                else:
                    loc = None

                salary_data = data.get("baseSalary", {})
                salary_text = None
                if isinstance(salary_data, dict):
                    value = salary_data.get("value", {})
                    if isinstance(value, dict):
                        min_val = value.get("minValue")
                        max_val = value.get("maxValue")
                        if min_val and max_val:
                            salary_text = f"${min_val:,.0f} - ${max_val:,.0f}"

                job_url = data.get("url", "")
                if not job_url:
                    continue
                if not job_url.startswith("http"):
                    job_url = f"https://{domain}{job_url}"

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=loc,
                        url=job_url,
                        source=self.name,
                        salary=salary_text,
                    )
                )
            except (json.JSONDecodeError, Exception):
                continue

        return results
