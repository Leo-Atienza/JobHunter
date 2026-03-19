"""LinkedIn job scraper using Playwright (headless Chromium)."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class LinkedInScraper(BaseScraper):
    """Scrape public LinkedIn job search results (no login required)."""

    name = "linkedin"
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
            f"[bold blue]LinkedIn[/] Searching for [cyan]'{query}'[/] in [cyan]{location}[/]"
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
                    start = page_num * 25
                    url = (
                        f"https://www.linkedin.com/jobs/search/"
                        f"?keywords={quote_plus(query)}"
                        f"&location={quote_plus(location)}"
                        f"&start={start}"
                    )
                    if remote:
                        url += "&f_WT=2"

                    self.console.log(
                        f"[blue]LinkedIn[/] Loading page {page_num + 1}/{self.MAX_PAGES}..."
                    )

                    try:
                        page.goto(url, wait_until="domcontentloaded", timeout=30000)
                        # Wait for job cards to render
                        page.wait_for_selector(
                            "div.base-card, div.job-search-card", timeout=10000
                        )
                    except PwTimeout:
                        self.console.log(
                            "[yellow]LinkedIn[/] Page load timed out — moving on."
                        )
                        break
                    except Exception as exc:
                        self.console.log(
                            f"[yellow]LinkedIn[/] Could not load page: {exc}"
                        )
                        break

                    cards = page.query_selector_all(
                        "div.base-card.base-card--link, div.job-search-card"
                    )

                    if not cards:
                        self.console.log("[yellow]LinkedIn[/] No job cards found — stopping.")
                        break

                    for card in cards:
                        try:
                            title_el = card.query_selector(
                                "h3.base-search-card__title, span.sr-only"
                            )
                            company_el = card.query_selector(
                                "h4.base-search-card__subtitle a, h4.base-search-card__subtitle"
                            )
                            location_el = card.query_selector(
                                "span.job-search-card__location"
                            )
                            link_el = card.query_selector("a.base-card__full-link")
                            date_el = card.query_selector("time")

                            title_text = title_el.inner_text().strip() if title_el else None
                            if not title_text:
                                continue

                            company_text = (
                                company_el.inner_text().strip() if company_el else None
                            )
                            location_text = (
                                location_el.inner_text().strip() if location_el else None
                            )
                            href = link_el.get_attribute("href") if link_el else None
                            posted = (
                                date_el.get_attribute("datetime") if date_el else None
                            )

                            if not href:
                                continue

                            results.append(
                                JobResult(
                                    title=title_text,
                                    company=company_text,
                                    location=location_text,
                                    url=href.split("?")[0],  # strip tracking params
                                    source=self.name,
                                    posted_date=posted,
                                )
                            )
                        except Exception:
                            continue

                    self.console.log(
                        f"[blue]LinkedIn[/] Found {len(results)} jobs so far."
                    )
                    self.rate_limit(2.0, 4.0)

                browser.close()

        except Exception as exc:
            self.console.log(f"[red]LinkedIn[/] Scraper error: {exc}")

        self.console.log(
            f"[bold blue]LinkedIn[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
