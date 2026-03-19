"""Indeed job scraper using Playwright (headless Chromium)."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class IndeedScraper(BaseScraper):
    """Scrape Indeed job search results."""

    name = "indeed"
    requires_browser = True

    MAX_PAGES = 3

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout

        query = " ".join(keywords)
        self.console.log(
            f"[bold green]Indeed[/] Searching for [cyan]'{query}'[/] in [cyan]{location}[/]"
        )

        results: list[JobResult] = []

        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1280, "height": 800},
                )
                page = context.new_page()

                for page_num in range(self.MAX_PAGES):
                    start = page_num * 10
                    url = (
                        f"https://www.indeed.com/jobs"
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
                        page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        page.wait_for_selector(
                            "div.job_seen_beacon, div.jobsearch-ResultsList",
                            timeout=10000,
                        )
                    except PwTimeout:
                        self.console.log(
                            "[yellow]Indeed[/] Page load timed out — moving on."
                        )
                        break
                    except Exception as exc:
                        self.console.log(
                            f"[yellow]Indeed[/] Could not load page: {exc}"
                        )
                        break

                    cards = page.query_selector_all("div.job_seen_beacon")

                    if not cards:
                        self.console.log("[yellow]Indeed[/] No job cards found — stopping.")
                        break

                    for card in cards:
                        try:
                            title_el = card.query_selector(
                                "h2.jobTitle a span, h2.jobTitle span"
                            )
                            company_el = card.query_selector(
                                "span[data-testid='company-name'], span.companyName"
                            )
                            location_el = card.query_selector(
                                "div[data-testid='text-location'], div.companyLocation"
                            )
                            salary_el = card.query_selector(
                                "div.salary-snippet-container, div.metadata.salary-snippet-container"
                            )
                            link_el = card.query_selector("h2.jobTitle a")

                            title_text = (
                                title_el.inner_text().strip() if title_el else None
                            )
                            if not title_text:
                                continue

                            company_text = (
                                company_el.inner_text().strip() if company_el else None
                            )
                            location_text = (
                                location_el.inner_text().strip() if location_el else None
                            )
                            salary_text = (
                                salary_el.inner_text().strip() if salary_el else None
                            )

                            href = link_el.get_attribute("href") if link_el else None
                            if href and not href.startswith("http"):
                                href = f"https://www.indeed.com{href}"
                            if not href:
                                continue

                            results.append(
                                JobResult(
                                    title=title_text,
                                    company=company_text,
                                    location=location_text,
                                    url=href,
                                    source=self.name,
                                    salary=salary_text,
                                )
                            )
                        except Exception:
                            continue

                    self.console.log(
                        f"[green]Indeed[/] Found {len(results)} jobs so far."
                    )
                    self.rate_limit(2.0, 5.0)

                browser.close()

        except Exception as exc:
            self.console.log(f"[red]Indeed[/] Scraper error: {exc}")

        self.console.log(
            f"[bold green]Indeed[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
