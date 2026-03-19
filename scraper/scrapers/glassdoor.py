"""Glassdoor job scraper using Playwright (headless Chromium)."""

from __future__ import annotations

from typing import Optional
from urllib.parse import quote_plus

from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class GlassdoorScraper(BaseScraper):
    """Scrape Glassdoor job search results (first page only due to heavy anti-bot)."""

    name = "glassdoor"
    requires_browser = True

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
            f"[bold magenta]Glassdoor[/] Searching for [cyan]'{query}'[/] in [cyan]{location}[/]"
        )

        results: list[JobResult] = []

        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1280, "height": 800},
                    locale="en-US",
                )
                page = context.new_page()

                url = (
                    f"https://www.glassdoor.com/Job/jobs.htm"
                    f"?sc.keyword={quote_plus(query)}"
                    f"&locT=C&locKeyword={quote_plus(location)}"
                )
                if remote:
                    url += "&remoteWorkType=1"

                self.console.log("[magenta]Glassdoor[/] Loading search page...")

                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    # Glassdoor uses React — wait a bit for hydration
                    page.wait_for_timeout(3000)
                except PwTimeout:
                    self.console.log(
                        "[yellow]Glassdoor[/] Page load timed out."
                    )
                    browser.close()
                    return results
                except Exception as exc:
                    self.console.log(
                        f"[yellow]Glassdoor[/] Could not load page: {exc}"
                    )
                    browser.close()
                    return results

                # Check for bot detection / CAPTCHA
                if "captcha" in page.url.lower() or page.query_selector(
                    "div.cf-browser-verification"
                ):
                    self.console.log(
                        "[yellow]Glassdoor[/] Bot detection triggered — skipping."
                    )
                    browser.close()
                    return results

                # Try multiple selector strategies (Glassdoor changes DOM often)
                card_selectors = [
                    "li.react-job-listing",
                    "li[data-test='jobListing']",
                    "ul.job-list li",
                    "div.JobsList_wrapper a[data-test='job-link']",
                ]

                cards = []
                for sel in card_selectors:
                    cards = page.query_selector_all(sel)
                    if cards:
                        break

                if not cards:
                    self.console.log(
                        "[yellow]Glassdoor[/] No job cards found (anti-bot or layout change)."
                    )
                    browser.close()
                    return results

                for card in cards:
                    try:
                        title_el = card.query_selector(
                            "a.job-title, a[data-test='job-link'], span.JobCard_jobTitle__GLyJ1"
                        )
                        company_el = card.query_selector(
                            "div.job-listing-company-name, span.EmployerProfile_companyName__0emMg, "
                            "div.employer-name"
                        )
                        location_el = card.query_selector(
                            "span.job-location, div.location, span.JobCard_location__N_iYE"
                        )
                        salary_el = card.query_selector(
                            "span.job-salary, div.salary-estimate, span.JobCard_salaryEstimate__arV5J"
                        )

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

                        href = title_el.get_attribute("href") if title_el else None
                        if href and not href.startswith("http"):
                            href = f"https://www.glassdoor.com{href}"
                        if not href:
                            href = page.url  # fallback

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

                browser.close()

        except Exception as exc:
            self.console.log(f"[red]Glassdoor[/] Scraper error: {exc}")

        self.console.log(
            f"[bold magenta]Glassdoor[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
