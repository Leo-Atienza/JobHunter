"""Glassdoor job scraper — Playwright-based with GraphQL fallback."""

from __future__ import annotations

import json
import re
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote_plus

import requests
from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


class GlassdoorScraper(BaseScraper):
    """Scrape Glassdoor job search results using Playwright.

    Glassdoor blocks most HTTP requests with anti-bot measures,
    so we use Playwright to render the page and extract job cards from the DOM.
    Falls back to GraphQL API if Playwright is unavailable.
    """

    name = "glassdoor"
    requires_browser = True  # Playwright needed for reliable results

    MAX_PAGES = 2

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
            f"[bold magenta]Glassdoor[/] Searching for [cyan]'{query}'[/]"
            f" in [cyan]{location or '(any)'}[/]"
        )

        # Try Playwright first
        results = self._scrape_with_playwright(query, location, remote)

        if not results:
            self.console.log(
                "[yellow]Glassdoor[/] Playwright returned no results — trying GraphQL fallback..."
            )
            results = self._scrape_with_graphql(query, location, remote)

        self.console.log(
            f"[bold magenta]Glassdoor[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results

    def _scrape_with_playwright(
        self, query: str, location: str, remote: bool
    ) -> list[JobResult]:
        """Use Playwright to render Glassdoor and extract job cards."""
        results: list[JobResult] = []

        try:
            from playwright.sync_api import sync_playwright, TimeoutError as PwTimeout
        except ImportError:
            self.console.log("[yellow]Glassdoor[/] Playwright not available.")
            return results

        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(headless=True)
                context = browser.new_context(
                    user_agent=USER_AGENT,
                    viewport={"width": 1280, "height": 800},
                )
                page = context.new_page()

                # Build search URL
                loc_param = f"&locT=C&locKeyword={quote_plus(location)}" if location else ""
                base_url = (
                    f"https://www.glassdoor.com/Job/jobs.htm"
                    f"?sc.keyword={quote_plus(query)}{loc_param}"
                )

                self.console.log("[magenta]Glassdoor[/] Loading search page...")

                try:
                    page.goto(base_url, wait_until="domcontentloaded", timeout=30000)
                    # Wait for job listings to appear
                    page.wait_for_selector(
                        "li[data-test='jobListing'], div.JobsList_jobListItem__wjTHv, "
                        "li.JobsList_jobListItem__wjTHv, ul.JobsList_jobsList__lqjTr li",
                        timeout=15000,
                    )
                except PwTimeout:
                    self.console.log(
                        "[yellow]Glassdoor[/] Page load timed out."
                    )
                    browser.close()
                    return results
                except Exception as exc:
                    self.console.log(f"[yellow]Glassdoor[/] Could not load page: {exc}")
                    browser.close()
                    return results

                # Extract job cards from the DOM
                for page_num in range(self.MAX_PAGES):
                    if page_num > 0:
                        # Try to click "Show more jobs" or navigate to next page
                        try:
                            next_btn = page.query_selector(
                                "button[data-test='load-more'], "
                                "button.JobsList_buttonContainer__FnrVR, "
                                "a[data-test='pagination-next']"
                            )
                            if next_btn:
                                next_btn.click()
                                page.wait_for_timeout(3000)
                            else:
                                break
                        except Exception:
                            break

                    cards = page.query_selector_all(
                        "li[data-test='jobListing'], "
                        "li.JobsList_jobListItem__wjTHv, "
                        "ul.JobsList_jobsList__lqjTr > li"
                    )

                    if not cards:
                        self.console.log("[yellow]Glassdoor[/] No job cards found.")
                        break

                    for card in cards:
                        try:
                            # Try multiple selector patterns (Glassdoor changes these)
                            title_el = card.query_selector(
                                "a.JobCard_jobTitle__GLyJ1, "
                                "a[data-test='job-title'], "
                                "a.jobTitle"
                            )
                            company_el = card.query_selector(
                                "span.EmployerProfile_compactEmployerName__9MGcV, "
                                "span[data-test='emp-name'], "
                                "div.EmployerProfile_employerName__Xemli a"
                            )
                            location_el = card.query_selector(
                                "div.JobCard_location__N_iYE, "
                                "span[data-test='emp-location'], "
                                "div.JobCard_location__rCz3x"
                            )
                            salary_el = card.query_selector(
                                "div.JobCard_salaryEstimate___m9kY, "
                                "span[data-test='detailSalary'], "
                                "div.SalaryEstimate"
                            )
                            # Extract job description/snippet from card
                            desc_el = card.query_selector(
                                "div.JobCard_jobDescriptionSnippet__yWW8q, "
                                "div[data-test='descSnippet'], "
                                "div.JobCard_jobCardDescription__szp2i, "
                                "div.jobDescriptionSnippet, "
                                "div.job-description"
                            )
                            # Also try extracting job type / metadata
                            type_el = card.query_selector(
                                "div.JobCard_jobType__Opc8k, "
                                "span[data-test='job-type']"
                            )

                            title_text = title_el.inner_text().strip() if title_el else None
                            if not title_text:
                                continue

                            company_text = company_el.inner_text().strip() if company_el else None
                            location_text = location_el.inner_text().strip() if location_el else None
                            salary_text = salary_el.inner_text().strip() if salary_el else None
                            description_text = desc_el.inner_text().strip() if desc_el else None
                            type_text = type_el.inner_text().strip() if type_el else None

                            href = title_el.get_attribute("href") if title_el else None
                            if not href:
                                continue
                            if not href.startswith("http"):
                                href = f"https://www.glassdoor.com{href}"

                            # Avoid duplicates
                            if any(r.url == href for r in results):
                                continue

                            results.append(
                                JobResult(
                                    title=title_text,
                                    company=company_text,
                                    location=location_text,
                                    url=href.split("?")[0],
                                    source=self.name,
                                    salary=salary_text,
                                    description=description_text,
                                    job_type=type_text,
                                )
                            )
                        except Exception:
                            continue

                    self.console.log(
                        f"[magenta]Glassdoor[/] {len(results)} jobs so far."
                    )

                browser.close()

        except Exception as exc:
            self.console.log(f"[red]Glassdoor[/] Playwright error: {exc}")

        return results

    def _scrape_with_graphql(
        self, query: str, location: str, remote: bool
    ) -> list[JobResult]:
        """Fallback: use Glassdoor's internal GraphQL API."""
        results: list[JobResult] = []

        session = requests.Session()

        # Get CSRF token
        try:
            resp = session.get(
                "https://www.glassdoor.com/",
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "text/html",
                },
                timeout=15,
            )
            csrf_token = None
            for pattern in [r'"token":\s*"([^"]+)"', r'"csrfToken":\s*"([^"]+)"']:
                match = re.search(pattern, resp.text)
                if match:
                    csrf_token = match.group(1)
                    break
        except Exception:
            return results

        if not csrf_token:
            return results

        # Resolve location
        location_id = None
        location_type = None
        if location:
            try:
                resp = session.get(
                    f"https://www.glassdoor.com/findPopularLocationAjax.htm"
                    f"?maxLocationsToReturn=5&term={quote_plus(location)}",
                    headers={"User-Agent": USER_AGENT},
                    timeout=10,
                )
                if resp.ok:
                    locations = resp.json()
                    if locations:
                        loc = locations[0]
                        location_id = loc.get("locationId")
                        type_map = {"C": "CITY", "S": "STATE", "N": "COUNTRY", "M": "METRO"}
                        location_type = type_map.get(loc.get("locationType", "C"), "CITY")
            except Exception:
                pass

        # GraphQL query
        gql_query = """
        query JobSearchResultsQuery(
            $keyword: String, $locationId: Int, $locationType: LocationTypeEnum,
            $numJobsToShow: Int!, $pageCursor: String, $pageNumber: Int
        ) {
            jobListings(contextHolder: {
                searchParams: {
                    keyword: $keyword, locationId: $locationId, locationType: $locationType,
                    numPerPage: $numJobsToShow, pageCursor: $pageCursor, pageNumber: $pageNumber,
                    searchType: SR
                }
            }) {
                jobListings {
                    jobview {
                        header {
                            jobTitleText employerNameFromSearch locationName
                            jobLink payCurrency payPeriodAdjustedPay { p10 p90 }
                            ageInDays
                        }
                        job { listingId description }
                    }
                }
            }
        }
        """

        headers = {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
            "gd-csrf-token": csrf_token,
            "Origin": "https://www.glassdoor.com",
            "Referer": "https://www.glassdoor.com/",
        }

        variables: dict = {"keyword": query, "numJobsToShow": 30, "pageNumber": 1}
        if location_id:
            variables["locationId"] = location_id
            if location_type:
                variables["locationType"] = location_type

        payload = [{"operationName": "JobSearchResultsQuery", "variables": variables, "query": gql_query}]

        try:
            resp = session.post(
                "https://www.glassdoor.com/graph",
                headers=headers,
                data=json.dumps(payload),
                timeout=20,
            )
            if not resp.ok:
                return results

            data = resp.json()
            if isinstance(data, list):
                data = data[0]

            listings = data.get("data", {}).get("jobListings", {}).get("jobListings", [])

            for listing in listings:
                try:
                    header = listing.get("jobview", {}).get("header", {})
                    job_data = listing.get("jobview", {}).get("job", {})

                    title = header.get("jobTitleText", "").strip()
                    if not title:
                        continue

                    company = header.get("employerNameFromSearch", "").strip() or None
                    loc_name = header.get("locationName", "").strip() or None
                    job_link = header.get("jobLink", "")
                    if job_link and not job_link.startswith("http"):
                        job_link = f"https://www.glassdoor.com{job_link}"
                    listing_id = job_data.get("listingId", "")
                    if not job_link and listing_id:
                        job_link = f"https://www.glassdoor.com/job-listing/j?jl={listing_id}"
                    if not job_link:
                        continue

                    salary_text = None
                    pay = header.get("payPeriodAdjustedPay")
                    if pay:
                        p10 = pay.get("p10")
                        p90 = pay.get("p90")
                        currency = header.get("payCurrency", "CAD")
                        if p10 and p90:
                            salary_text = f"{currency} {p10:,.0f} - {p90:,.0f}"

                    age = header.get("ageInDays")
                    posted_date = None
                    if age is not None:
                        posted_date = (datetime.now() - timedelta(days=age)).strftime("%Y-%m-%d")

                    description = job_data.get("description") or None

                    results.append(
                        JobResult(
                            title=title,
                            company=company,
                            location=loc_name,
                            url=job_link,
                            source=self.name,
                            salary=salary_text,
                            description=description,
                            posted_date=posted_date,
                        )
                    )
                except Exception:
                    continue
        except Exception as exc:
            self.console.log(f"[red]Glassdoor[/] GraphQL fallback failed: {exc}")

        return results
