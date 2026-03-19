"""Job Bank Canada scraper using requests + BeautifulSoup."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from bs4 import BeautifulSoup
from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class JobBankScraper(BaseScraper):
    """Scrape Job Bank Canada (government site, lighter anti-bot measures)."""

    name = "jobbank"
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
            f"[bold red]JobBank[/] Searching for [cyan]'{query}'[/] in [cyan]{location}[/]"
        )

        results: list[JobResult] = []
        headers = {"User-Agent": USER_AGENT, "Accept-Language": "en-CA,en;q=0.9"}

        for page_num in range(1, self.MAX_PAGES + 1):
            url = (
                f"https://www.jobbank.gc.ca/jobsearch/jobsearch"
                f"?searchstring={quote_plus(query)}"
                f"&locationstring={quote_plus(location)}"
                f"&page={page_num}"
            )
            if remote:
                url += "&action=s41"  # remote filter on Job Bank

            self.console.log(
                f"[red]JobBank[/] Loading page {page_num}/{self.MAX_PAGES}..."
            )

            try:
                resp = self.http.get(url, headers=headers, timeout=20)
                resp.raise_for_status()
            except Exception as exc:
                self.console.log(f"[yellow]JobBank[/] Request failed: {exc}")
                break

            soup = BeautifulSoup(resp.text, "html.parser")

            # Job Bank uses <article> elements for job cards
            articles = soup.select("article.action-card, div.results-jobs article")

            if not articles:
                # Fallback: try alternate selectors
                articles = soup.select("a.resultJobItem, div.resultJobItem")

            if not articles:
                self.console.log("[yellow]JobBank[/] No results found on this page — stopping.")
                break

            for article in articles:
                try:
                    title_el = article.select_one(
                        "span.noctitle, h3.jbTitle a, a.resultJobItem span.noctitle"
                    )
                    link_el = article.select_one("a[href*='/jobsearch/jobposting']")
                    company_el = article.select_one(
                        "li.organization span, span.business, div.employer-name"
                    )
                    location_el = article.select_one(
                        "li.location span, span.location, div.job-location"
                    )
                    date_el = article.select_one(
                        "li.date span, span.date, time"
                    )

                    title_text = title_el.get_text(strip=True) if title_el else None
                    if not title_text:
                        # Try the link text itself
                        if link_el:
                            title_text = link_el.get_text(strip=True)
                    if not title_text:
                        continue

                    href = link_el.get("href") if link_el else None
                    if href and not href.startswith("http"):
                        href = f"https://www.jobbank.gc.ca{href}"
                    if not href:
                        continue

                    company_text = (
                        company_el.get_text(strip=True) if company_el else None
                    )
                    location_text = (
                        location_el.get_text(strip=True) if location_el else None
                    )
                    posted = date_el.get_text(strip=True) if date_el else None

                    results.append(
                        JobResult(
                            title=title_text,
                            company=company_text,
                            location=location_text,
                            url=href,
                            source=self.name,
                            posted_date=posted,
                        )
                    )
                except Exception:
                    continue

            self.console.log(f"[red]JobBank[/] Found {len(results)} jobs so far.")
            self.rate_limit(1.0, 2.0)

        self.console.log(
            f"[bold red]JobBank[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
