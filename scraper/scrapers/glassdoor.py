"""Glassdoor job scraper using internal GraphQL API."""

from __future__ import annotations

import json
import re
from typing import Optional
from urllib.parse import quote_plus

import requests
from rich.console import Console

from .base import BaseScraper, JobResult, USER_AGENT


# GraphQL query for job search
JOB_SEARCH_QUERY = """
query JobSearchResultsQuery(
    $keyword: String,
    $locationId: Int,
    $locationType: LocationTypeEnum,
    $numJobsToShow: Int!,
    $pageCursor: String,
    $pageNumber: Int,
    $filterParams: [FilterParams],
    $parameterUrlInput: String
) {
    jobListings(
        contextHolder: {
            searchParams: {
                keyword: $keyword,
                locationId: $locationId,
                locationType: $locationType,
                numPerPage: $numJobsToShow,
                pageCursor: $pageCursor,
                pageNumber: $pageNumber,
                filterParams: $filterParams,
                parameterUrlInput: $parameterUrlInput,
                searchType: SR
            }
        }
    ) {
        totalJobsCount
        jobListings {
            jobview {
                header {
                    jobTitleText
                    employerNameFromSearch
                    locationName
                    locationType
                    ageInDays
                    easyApply
                    payCurrency
                    payPeriod
                    payPeriodAdjustedPay { p10 p50 p90 }
                    jobLink
                }
                job {
                    listingId
                    jobTitleText
                    description
                }
            }
        }
        paginationCursors {
            cursor
            pageNumber
        }
    }
}
"""

# Fallback CSRF token (from JobSpy project) for when extraction fails
FALLBACK_CSRF = (
    "Ft6oHEWlRZrxDww95Cpazw:0pGUrkb2y3TyOpAIqF2vbPmUXoXVkD3oEGDVkvfeCerceQ5"
    "-n8mBg3BovySUIjmCPHCaW0H2nQVdqzbtsYqf4Q:wcqRqeegRUa9MVLJGyujVXB7vWFPjdaS1CtrrzJq-ok"
)


class GlassdoorScraper(BaseScraper):
    """Scrape Glassdoor job search results via internal GraphQL API."""

    name = "glassdoor"
    requires_browser = False

    MAX_PAGES = 2
    RESULTS_PER_PAGE = 30

    REMOTE_LOCATION_ID = 11047

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)
        self._csrf_token: Optional[str] = None
        # Use a dedicated session for Glassdoor to persist cookies
        self._session = requests.Session()

    def _init_session(self) -> bool:
        """Visit Glassdoor homepage to extract CSRF token and set cookies."""
        self.console.log("[magenta]Glassdoor[/] Initializing session...")

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
        }

        try:
            # Use homepage — /Job/jobs.htm now returns 404 or redirects
            resp = self._session.get(
                "https://www.glassdoor.com/",
                headers=headers,
                timeout=15,
            )
            if resp.status_code != 200:
                self.console.log(
                    f"[yellow]Glassdoor[/] Initial page returned status {resp.status_code}"
                )

            # Extract CSRF token from page HTML
            token_patterns = [
                r'"token":\s*"([^"]+)"',
                r"gdToken['\"]:\s*['\"]([^'\"]+)",
                r'"csrfToken":\s*"([^"]+)"',
            ]

            for pattern in token_patterns:
                match = re.search(pattern, resp.text)
                if match:
                    self._csrf_token = match.group(1)
                    break

            if not self._csrf_token:
                self.console.log(
                    "[yellow]Glassdoor[/] Could not extract CSRF token — using fallback."
                )
                self._csrf_token = FALLBACK_CSRF

            self.console.log("[magenta]Glassdoor[/] Session initialized successfully.")
            return True

        except Exception as exc:
            self.console.log(f"[red]Glassdoor[/] Session init failed: {exc}")
            # Still try with fallback token
            self._csrf_token = FALLBACK_CSRF
            return True

    def _resolve_location(self, location: str) -> tuple[Optional[int], Optional[str]]:
        """Resolve a location string to Glassdoor's locationId and locationType."""
        if not location:
            return None, None

        try:
            resp = self._session.get(
                f"https://www.glassdoor.com/findPopularLocationAjax.htm"
                f"?maxLocationsToReturn=5&term={quote_plus(location)}",
                headers={"User-Agent": USER_AGENT},
                timeout=10,
            )
            if resp.ok:
                locations = resp.json()
                if locations and len(locations) > 0:
                    loc = locations[0]
                    loc_id = loc.get("locationId")
                    loc_type_raw = loc.get("locationType", "C")
                    type_map = {"C": "CITY", "S": "STATE", "N": "COUNTRY", "M": "METRO"}
                    loc_type = type_map.get(loc_type_raw, "CITY")
                    self.console.log(
                        f"[magenta]Glassdoor[/] Resolved location: "
                        f"{loc.get('label', location)} (ID: {loc_id})"
                    )
                    return loc_id, loc_type
        except Exception as exc:
            self.console.log(f"[yellow]Glassdoor[/] Location lookup failed: {exc}")

        return None, None

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

        results: list[JobResult] = []

        if not self._init_session():
            self.console.log(
                "[yellow]Glassdoor[/] Could not initialize session — skipping."
            )
            return results

        # Resolve location
        location_id: Optional[int] = None
        location_type: Optional[str] = None

        if remote:
            location_id = self.REMOTE_LOCATION_ID
            location_type = "STATE"
        elif location:
            location_id, location_type = self._resolve_location(location)

        # Build GraphQL request headers with browser fingerprint headers
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/json",
            "apollographql-client-name": "job-search-next",
            "apollographql-client-version": "4.65.5",
            "gd-csrf-token": self._csrf_token,
            "Origin": "https://www.glassdoor.com",
            "Referer": "https://www.glassdoor.com/",
            # Browser fingerprint headers to avoid 403
            "sec-ch-ua": '"Chromium";v="123", "Google Chrome";v="123", "Not;A=Brand";v="99"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"Windows"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin",
        }

        page_cursor: Optional[str] = None

        for page_num in range(1, self.MAX_PAGES + 1):
            self.console.log(
                f"[magenta]Glassdoor[/] Fetching page {page_num}/{self.MAX_PAGES}..."
            )

            variables: dict = {
                "keyword": query,
                "numJobsToShow": self.RESULTS_PER_PAGE,
                "pageNumber": page_num,
                "pageCursor": page_cursor,
                "filterParams": [],
            }

            if location_id is not None:
                variables["locationId"] = location_id
                if location_type:
                    variables["locationType"] = location_type
                    variables["parameterUrlInput"] = (
                        f"IL.0,12_I{location_type[0]}{location_id}"
                    )

            payload = [
                {
                    "operationName": "JobSearchResultsQuery",
                    "variables": variables,
                    "query": JOB_SEARCH_QUERY,
                }
            ]

            try:
                resp = self._session.post(
                    "https://www.glassdoor.com/graph",
                    headers=headers,
                    data=json.dumps(payload),
                    timeout=20,
                )

                if resp.status_code == 403:
                    self.console.log(
                        "[yellow]Glassdoor[/] Access denied (403) — "
                        "likely blocked by anti-bot measures."
                    )
                    break
                elif resp.status_code == 429:
                    self.console.log(
                        "[yellow]Glassdoor[/] Rate limited (429) — stopping."
                    )
                    break

                resp.raise_for_status()
                data = resp.json()
            except Exception as exc:
                self.console.log(f"[red]Glassdoor[/] GraphQL request failed: {exc}")
                break

            # Parse response (wrapped in array)
            try:
                if isinstance(data, list):
                    data = data[0]

                # Handle non-fatal errors — only abort if jobListings itself errored
                if "errors" in data and "data" not in data:
                    self.console.log(
                        f"[yellow]Glassdoor[/] GraphQL errors: {data['errors'][0].get('message', 'unknown')}"
                    )
                    break

                job_listings_data = data.get("data", {}).get("jobListings", {})

                if not job_listings_data:
                    self.console.log("[yellow]Glassdoor[/] No jobListings in response.")
                    break

                listings = job_listings_data.get("jobListings", [])

                if not listings:
                    self.console.log("[magenta]Glassdoor[/] No more results.")
                    break

                # Extract pagination cursor for next page
                cursors = job_listings_data.get("paginationCursors", [])
                page_cursor = None
                for c in cursors:
                    if c.get("pageNumber") == page_num + 1:
                        page_cursor = c.get("cursor")
                        break

                for listing in listings:
                    try:
                        jobview = listing.get("jobview", {})
                        header = jobview.get("header", {})
                        job_data = jobview.get("job", {})

                        title = header.get("jobTitleText", "").strip()
                        if not title:
                            continue

                        company = header.get("employerNameFromSearch", "").strip() or None
                        loc_name = header.get("locationName", "").strip() or None

                        # Build job URL
                        job_link = header.get("jobLink", "")
                        if job_link and not job_link.startswith("http"):
                            job_link = f"https://www.glassdoor.com{job_link}"
                        listing_id = job_data.get("listingId", "")
                        if not job_link and listing_id:
                            job_link = (
                                f"https://www.glassdoor.com/job-listing/"
                                f"j?jl={listing_id}"
                            )
                        if not job_link:
                            continue

                        # Build salary string from pay data
                        salary_text: Optional[str] = None
                        pay = header.get("payPeriodAdjustedPay")
                        currency = header.get("payCurrency", "USD")
                        if pay:
                            p10 = pay.get("p10")
                            p90 = pay.get("p90")
                            if p10 and p90:
                                salary_text = f"{currency} {p10:,.0f} - {p90:,.0f}"
                            elif pay.get("p50"):
                                salary_text = f"{currency} ~{pay['p50']:,.0f}"

                        # Age in days for posted_date approximation
                        age = header.get("ageInDays")
                        posted_date: Optional[str] = None
                        if age is not None:
                            from datetime import datetime, timedelta

                            posted_date = (
                                datetime.now() - timedelta(days=age)
                            ).strftime("%Y-%m-%d")

                        description = job_data.get("description") or None
                        if description and len(description) > 500:
                            description = description[:500] + "..."

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

                self.console.log(
                    f"[magenta]Glassdoor[/] {len(results)} jobs so far."
                )

            except Exception as exc:
                self.console.log(f"[red]Glassdoor[/] Response parsing failed: {exc}")
                break

            self.rate_limit(1.0, 2.5)

        self.console.log(
            f"[bold magenta]Glassdoor[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results
