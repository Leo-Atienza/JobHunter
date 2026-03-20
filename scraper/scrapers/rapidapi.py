"""RapidAPI job search — intelligent fallback across JSearch, LinkedIn, and Active Jobs DB."""

from __future__ import annotations

import os
from typing import Optional

from rich.console import Console

from .base import BaseScraper, JobResult


class RapidAPIScraper(BaseScraper):
    """Search jobs via RapidAPI with automatic fallback across providers.

    Provider priority:
    1. JSearch — aggregates Indeed, Google Jobs, etc. (richest data)
    2. LinkedIn Job Search API — LinkedIn-only postings
    3. Active Jobs DB — ATS boards (Workday, Lever, Greenhouse, etc.)
    4. JOBS SEARCH API — last resort (5 req/month free, 100 jobs/call)

    If a provider returns 429 (rate limit) or 403 (quota exceeded),
    the scraper falls through to the next provider automatically.
    """

    name = "rapidapi"
    requires_browser = False

    MAX_PAGES = 3  # JSearch pages (10 results each)

    # Provider priority — tried in order; rate-limited providers fall through.
    # jobs_search_api is last because it only has 5 req/month on the free tier.
    PROVIDERS = [
        "jsearch",
        "linkedin_jobs",
        "active_jobs_db",
        "jobs_search_api",
    ]

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        super().__init__(console, config)
        # Providers flagged as near-quota this session (prevents repeated requests)
        self._exhausted: set[str] = set()

    def _get_api_key(self) -> str:
        """Get the RapidAPI key from config or environment."""
        api_keys = self.config.get("api_keys", {})
        return (
            api_keys.get("rapidapi_key", "")
            or os.environ.get("RAPIDAPI_KEY", "")
        )

    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        query = " ".join(keywords)
        self.console.log(
            f"[bold blue]RapidAPI[/] Searching for [cyan]'{query}'[/] in [cyan]{location}[/]"
        )

        api_key = self._get_api_key()
        if not api_key:
            self.console.log(
                "[yellow]RapidAPI[/] No API key configured — skipping. "
                "Set RAPIDAPI_KEY env var or add rapidapi_key to config api_keys."
            )
            self.jobs = []
            return []

        results: list[JobResult] = []

        for provider in self.PROVIDERS:
            try:
                func = getattr(self, f"_search_{provider}")
                provider_results = func(query, location, remote, api_key)

                if provider_results is None:
                    # None = rate limited, try next provider
                    continue

                results = provider_results
                break  # Success — don't try other providers

            except Exception as exc:
                self.console.log(
                    f"[yellow]RapidAPI[/] {provider} error: {exc}"
                )
                continue

        self.console.log(
            f"[bold blue]RapidAPI[/] Finished — {len(results)} jobs collected."
        )
        self.jobs = results
        return results

    # Safety threshold — fall back before hitting 100% to avoid overage charges.
    QUOTA_THRESHOLD = 0.85  # 85%

    def _check_quota(self, resp, host: str) -> bool:
        """Check RapidAPI rate-limit headers. Returns True if quota is OK."""
        # RapidAPI returns multiple rate-limit dimensions in headers:
        #   X-RateLimit-Requests-Limit / Remaining  (monthly request cap)
        #   X-RateLimit-Jobs-Limit / Remaining       (monthly job-row cap)
        # We check ALL of them and bail if ANY is above the threshold.
        h = resp.headers

        checks = [
            ("Requests", h.get("X-RateLimit-Requests-Limit"), h.get("X-RateLimit-Requests-Remaining")),
            ("Jobs", h.get("X-RateLimit-Jobs-Limit"), h.get("X-RateLimit-Jobs-Remaining")),
        ]

        for name, limit_str, remaining_str in checks:
            if not limit_str or not remaining_str:
                continue
            try:
                limit = int(limit_str)
                remaining = int(remaining_str)
            except (ValueError, TypeError):
                continue

            if limit <= 0:
                continue

            used_pct = (limit - remaining) / limit
            if used_pct >= self.QUOTA_THRESHOLD:
                self.console.log(
                    f"[yellow]RapidAPI[/] {host} {name} quota at "
                    f"{used_pct:.0%} ({remaining}/{limit} remaining) — "
                    f"stopping to avoid overage charges."
                )
                self._exhausted.add(host)
                return False

        return True

    def _make_request(
        self, url: str, host: str, api_key: str, params: dict,
        method: str = "GET", json_body: dict | None = None,
    ) -> dict | list | None:
        """Make a RapidAPI request. Returns None on rate limit (triggers fallback).

        Checks quota headers after each response and stops at 85% usage
        to avoid overage charges on free-tier plans.
        """
        # Skip providers already flagged as near-quota this session
        if host in self._exhausted:
            self.console.log(
                f"[yellow]RapidAPI[/] {host} already near quota — skipping."
            )
            return None

        headers = {
            "x-rapidapi-key": api_key,
            "x-rapidapi-host": host,
        }

        if method == "POST":
            headers["Content-Type"] = "application/json"
            resp = self.http.post(url, headers=headers, json=json_body, timeout=20)
        else:
            resp = self.http.get(url, headers=headers, params=params, timeout=20)

        if resp.status_code in (429, 403):
            self.console.log(
                f"[yellow]RapidAPI[/] {host} rate limited ({resp.status_code}) — "
                "trying next provider..."
            )
            self._exhausted.add(host)
            return None

        resp.raise_for_status()

        # Check quota AFTER successful request — bail before the next one if close
        if not self._check_quota(resp, host):
            # Still return THIS response's data (already paid for it),
            # but the provider will be skipped on subsequent calls.
            pass

        return resp.json()

    # ------------------------------------------------------------------
    # Provider 1: JSearch (aggregates Indeed, Google Jobs, etc.)
    # ------------------------------------------------------------------

    def _search_jsearch(
        self, query: str, location: str, remote: bool, api_key: str
    ) -> list[JobResult] | None:
        """Search via JSearch API — 10 results per page, up to MAX_PAGES."""
        self.console.log("[blue]RapidAPI[/] Trying JSearch...")

        host = "jsearch.p.rapidapi.com"
        results: list[JobResult] = []

        # Build location-aware query
        search_query = f"{query} in {location}" if location else query

        # Detect country code from config
        country = self.config.get("country", "").lower() or None

        for page_num in range(1, self.MAX_PAGES + 1):
            params: dict = {
                "query": search_query,
                "page": str(page_num),
                "num_pages": "1",
            }
            if country:
                params["country"] = country
            if remote:
                params["remote_jobs_only"] = "true"

            data = self._make_request(
                f"https://{host}/search", host, api_key, params
            )
            if data is None:
                return None  # Rate limited — signal fallback

            items = data.get("data", []) if isinstance(data, dict) else []
            if not items:
                break

            for item in items:
                try:
                    title = item.get("job_title", "").strip()
                    if not title:
                        continue

                    company = item.get("employer_name", "").strip() or None
                    city = item.get("job_city", "")
                    state = item.get("job_state", "")
                    job_country = item.get("job_country", "")
                    loc_parts = [p for p in (city, state, job_country) if p]
                    job_location = ", ".join(loc_parts) or None

                    job_url = item.get("job_apply_link", "")
                    if not job_url:
                        job_url = item.get("job_google_link", "")
                    if not job_url:
                        continue

                    # Salary
                    salary_text = None
                    min_sal = item.get("job_min_salary")
                    max_sal = item.get("job_max_salary")
                    period = item.get("job_salary_period", "")
                    if min_sal and max_sal:
                        salary_text = f"${min_sal:,.0f} - ${max_sal:,.0f}"
                        if period:
                            salary_text += f" ({period})"
                    elif item.get("job_salary"):
                        salary_text = str(item["job_salary"])

                    # Employment type
                    job_type = None
                    emp_types = item.get("job_employment_types", [])
                    if emp_types:
                        type_map = {
                            "FULLTIME": "Full-time",
                            "PARTTIME": "Part-time",
                            "CONTRACT": "Contract",
                            "INTERN": "Internship",
                            "TEMPORARY": "Temporary",
                        }
                        job_type = type_map.get(emp_types[0], emp_types[0])
                    elif item.get("job_employment_type"):
                        job_type = item["job_employment_type"]

                    # Description (truncate for storage)
                    description = item.get("job_description", "")
                    if description and len(description) > 500:
                        description = description[:500].rsplit(" ", 1)[0] + "..."

                    # Posted date
                    posted = item.get("job_posted_at_datetime_utc", "")
                    if posted and "T" in posted:
                        posted = posted.split("T")[0]
                    else:
                        posted = None

                    results.append(
                        JobResult(
                            title=title,
                            company=company,
                            location=job_location,
                            url=job_url,
                            source="jsearch",
                            salary=salary_text,
                            description=description or None,
                            posted_date=posted,
                            job_type=job_type,
                        )
                    )
                except Exception:
                    continue

            self.console.log(
                f"[blue]RapidAPI[/] JSearch page {page_num} — {len(results)} jobs so far."
            )

            if len(items) < 10:
                break  # Last page

            # Stop paginating if quota is getting close
            if host in self._exhausted:
                self.console.log(
                    f"[blue]RapidAPI[/] JSearch quota near limit — stopping pagination."
                )
                break

            self.rate_limit(0.5, 1.0)

        return results

    # ------------------------------------------------------------------
    # Provider 2: LinkedIn Job Search API
    # ------------------------------------------------------------------

    def _search_linkedin_jobs(
        self, query: str, location: str, remote: bool, api_key: str
    ) -> list[JobResult] | None:
        """Search via LinkedIn Job Search API — returns up to ~100 results."""
        self.console.log("[blue]RapidAPI[/] Trying LinkedIn Job Search...")

        host = "linkedin-job-search-api.p.rapidapi.com"

        # Extract city from location for the filter
        city = location.split(",")[0].strip() if location else ""

        params: dict = {}
        if query:
            params["title_filter"] = f'"{query}"'
        if city:
            params["location_filter"] = f'"{city}"'

        data = self._make_request(
            f"https://{host}/active-jb-7d", host, api_key, params
        )
        if data is None:
            return None  # Rate limited

        items = data if isinstance(data, list) else []
        results: list[JobResult] = []

        for item in items:
            try:
                title = item.get("title", "").strip()
                if not title:
                    continue

                company = item.get("organization", "").strip() or None

                locs = item.get("locations_derived", [])
                job_location = ", ".join(locs) if locs else None

                job_url = item.get("url", "")
                if not job_url:
                    continue

                # Employment type
                job_type = None
                emp_types = item.get("employment_type", [])
                if emp_types:
                    type_map = {
                        "FULL_TIME": "Full-time",
                        "PART_TIME": "Part-time",
                        "CONTRACT": "Contract",
                        "INTERNSHIP": "Internship",
                        "TEMPORARY": "Temporary",
                    }
                    if isinstance(emp_types, list) and emp_types:
                        job_type = type_map.get(emp_types[0], emp_types[0])
                    elif isinstance(emp_types, str):
                        job_type = type_map.get(emp_types, emp_types)

                # Seniority as experience level
                experience_level = item.get("seniority") or None

                # Posted date
                posted = item.get("date_posted", "")
                if posted and "T" in posted:
                    posted = posted.split("T")[0]
                else:
                    posted = None

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=job_location,
                        url=job_url,
                        source="linkedin_api",
                        posted_date=posted,
                        job_type=job_type,
                        experience_level=experience_level,
                    )
                )
            except Exception:
                continue

        self.console.log(
            f"[blue]RapidAPI[/] LinkedIn Job Search — {len(results)} jobs found."
        )
        return results

    # ------------------------------------------------------------------
    # Provider 3: Active Jobs DB (ATS boards)
    # ------------------------------------------------------------------

    def _search_active_jobs_db(
        self, query: str, location: str, remote: bool, api_key: str
    ) -> list[JobResult] | None:
        """Search via Active Jobs DB — ATS-sourced jobs (Workday, Lever, etc.)."""
        self.console.log("[blue]RapidAPI[/] Trying Active Jobs DB...")

        host = "active-jobs-db.p.rapidapi.com"

        city = location.split(",")[0].strip() if location else ""

        params: dict = {"page": "0"}
        if query:
            params["title_filter"] = f'"{query}"'
        if city:
            params["location_filter"] = f'"{city}"'

        data = self._make_request(
            f"https://{host}/active-ats-7d", host, api_key, params
        )
        if data is None:
            return None  # Rate limited

        items = data if isinstance(data, list) else []
        results: list[JobResult] = []

        for item in items:
            try:
                title = item.get("title", "").strip()
                if not title:
                    continue

                company = item.get("organization", "").strip() or None

                locs = item.get("locations_derived", [])
                job_location = ", ".join(locs) if locs else None

                job_url = item.get("url", "")
                if not job_url:
                    continue

                # Salary extraction
                salary_text = None
                salary_raw = item.get("salary_raw")
                if isinstance(salary_raw, dict):
                    value = salary_raw.get("value", {})
                    if isinstance(value, dict):
                        min_val = value.get("minValue")
                        max_val = value.get("maxValue")
                        currency = salary_raw.get("currency", "")
                        if min_val and max_val:
                            symbol = "$" if currency in ("USD", "CAD") else currency + " "
                            salary_text = f"{symbol}{min_val:,.0f} - {symbol}{max_val:,.0f}"

                # Employment type
                job_type = None
                emp_type = item.get("employment_type")
                if emp_type:
                    if isinstance(emp_type, list) and emp_type:
                        emp_type = emp_type[0]
                    type_map = {
                        "FULL_TIME": "Full-time",
                        "PART_TIME": "Part-time",
                        "CONTRACT": "Contract",
                    }
                    if isinstance(emp_type, str):
                        job_type = type_map.get(emp_type, emp_type)

                # Posted date
                posted = item.get("date_posted", "")
                if posted and "T" in posted:
                    posted = posted.split("T")[0]
                else:
                    posted = None

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=job_location,
                        url=job_url,
                        source="active_jobs_db",
                        salary=salary_text,
                        posted_date=posted,
                        job_type=job_type,
                    )
                )
            except Exception:
                continue

        self.console.log(
            f"[blue]RapidAPI[/] Active Jobs DB — {len(results)} jobs found."
        )
        return results

    # ------------------------------------------------------------------
    # Provider 4: JOBS SEARCH API (last resort — 5 req/month free tier)
    # ------------------------------------------------------------------

    def _search_jobs_search_api(
        self, query: str, location: str, remote: bool, api_key: str
    ) -> list[JobResult] | None:
        """Search via JOBS SEARCH API — POST-based, 100 jobs/call, 5 req/month free."""
        self.console.log(
            "[blue]RapidAPI[/] Trying JOBS SEARCH API (last resort — limited free tier)..."
        )

        host = "jobs-search-api.p.rapidapi.com"

        # Build location string: "City, Country" format
        search_location = location or ""

        body = {
            "search_term": query,
            "location": search_location,
            "results_wanted": 100,
        }
        if remote:
            body["is_remote"] = True

        data = self._make_request(
            f"https://{host}/getjobs", host, api_key,
            params={}, method="POST", json_body=body,
        )
        if data is None:
            return None

        if not data.get("status"):
            msg = data.get("message", "unknown error")
            self.console.log(f"[yellow]RapidAPI[/] JOBS SEARCH API: {msg}")
            return None

        items = data.get("jobs", [])
        results: list[JobResult] = []

        for item in items:
            try:
                title = item.get("title", "").strip()
                if not title:
                    continue

                company = item.get("company", "").strip() or None
                job_location = item.get("location", "").strip() or None
                job_url = item.get("job_url", "")
                if not job_url:
                    continue

                # Salary
                salary_text = None
                min_amt = item.get("min_amount", "")
                max_amt = item.get("max_amount", "")
                currency = item.get("currency", "")
                if min_amt and max_amt:
                    symbol = "$" if currency in ("USD", "CAD", "") else currency + " "
                    try:
                        salary_text = f"{symbol}{float(min_amt):,.0f} - {symbol}{float(max_amt):,.0f}"
                        interval = item.get("interval", "")
                        if interval:
                            salary_text += f" ({interval})"
                    except ValueError:
                        pass

                job_type = item.get("job_type", "").strip() or None
                posted = item.get("date_posted", "").strip() or None
                is_remote = str(item.get("is_remote", "")).lower() == "true"

                if is_remote and job_location:
                    job_location += " (Remote)"

                results.append(
                    JobResult(
                        title=title,
                        company=company,
                        location=job_location,
                        url=job_url,
                        source="jobs_search_api",
                        salary=salary_text,
                        posted_date=posted,
                        job_type=job_type,
                    )
                )
            except Exception:
                continue

        self.console.log(
            f"[blue]RapidAPI[/] JOBS SEARCH API — {len(results)} jobs found."
        )
        return results
