"""Base scraper class and shared data structures."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, asdict
from typing import Optional
import time
import random

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from rich.console import Console


@dataclass
class JobResult:
    """A single job listing result."""

    title: str
    company: Optional[str]
    location: Optional[str]
    url: str
    source: str
    salary: Optional[str] = None
    description: Optional[str] = None
    posted_date: Optional[str] = None
    job_type: Optional[str] = None
    experience_level: Optional[str] = None
    skills: Optional[str] = None
    benefits: Optional[str] = None
    relevance_score: int = 0
    country: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to a plain dictionary for JSON serialization."""
        return asdict(self)


def _build_session(retries: int = 3, backoff_factor: float = 0.5) -> requests.Session:
    """Build a requests.Session with retry + exponential backoff."""
    session = requests.Session()
    retry_strategy = Retry(
        total=retries,
        backoff_factor=backoff_factor,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST"],
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


# Module-level reusable session
http_session = _build_session()

# Realistic user-agent shared across scrapers
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/123.0.0.0 Safari/537.36"
)


class BaseScraper(ABC):
    """Base class for all job scrapers."""

    name: str = "base"
    requires_browser: bool = False

    def __init__(self, console: Console, config: Optional[dict] = None) -> None:
        self.console = console
        self.jobs: list[JobResult] = []
        self.config = config or {}
        self.http = http_session

    @abstractmethod
    def scrape(
        self,
        keywords: list[str],
        location: str,
        remote: bool = False,
    ) -> list[JobResult]:
        """Scrape jobs and return results."""
        ...

    def rate_limit(
        self, min_seconds: float = 1.0, max_seconds: float = 3.0
    ) -> None:
        """Sleep for a random interval to avoid rate limiting."""
        time.sleep(random.uniform(min_seconds, max_seconds))

    @staticmethod
    def filter_by_relevance(
        jobs: list[JobResult],
        keywords: list[str],
        min_match: float = 0.5,
    ) -> list[JobResult]:
        """Filter jobs by title relevance to keywords.

        Keeps a job if:
        - The full keyword phrase appears as a substring in the title, OR
        - At least `min_match` fraction of keyword tokens appear in the title.
        """
        if not keywords:
            return jobs

        filtered: list[JobResult] = []
        for job in jobs:
            title_lower = job.title.lower()
            keep = False

            for kw in keywords:
                kw_lower = kw.lower().strip()
                # Exact phrase match — always keep
                if kw_lower in title_lower:
                    keep = True
                    break

                # Token overlap check
                tokens = kw_lower.split()
                if tokens:
                    matched = sum(1 for t in tokens if t in title_lower)
                    if matched / len(tokens) >= min_match:
                        keep = True
                        break

            if keep:
                filtered.append(job)

        return filtered

    @staticmethod
    def score_relevance(
        jobs: list["JobResult"],
        keywords: list[str],
        min_score: int = 20,
    ) -> list["JobResult"]:
        """Score each job's relevance 0-100 and filter out below min_score."""
        if not keywords:
            for job in jobs:
                job.relevance_score = 50
            return jobs

        scored: list["JobResult"] = []
        for job in jobs:
            title_lower = job.title.lower()
            best_score = 0

            for kw in keywords:
                kw_lower = kw.lower().strip()
                if not kw_lower:
                    continue
                score = 0
                tokens = kw_lower.split()

                # Exact phrase match in title: +40
                if kw_lower in title_lower:
                    score += 40
                    # Exact title match: +20 bonus
                    if title_lower.strip() == kw_lower:
                        score += 20
                    # Keyword at start of title: +10 bonus
                    elif title_lower.startswith(kw_lower):
                        score += 10

                # Token overlap ratio: up to +40 (main signal for partial matches)
                if tokens:
                    matched = sum(1 for t in tokens if t in title_lower)
                    overlap = matched / len(tokens)
                    score += int(overlap * 40)

                # Individual important token matches in title: +5 each (max +15)
                # Rewards titles containing key domain words even without full overlap
                if tokens:
                    important_bonus = 0
                    for t in tokens:
                        if len(t) > 2 and t in title_lower:
                            important_bonus += 5
                    score += min(important_bonus, 15)

                # Company match: +10
                if job.company and kw_lower in job.company.lower():
                    score += 10

                # Description contains full keyword phrase: +10
                if job.description and kw_lower in job.description.lower():
                    score += 10

                # Description contains individual tokens: +5
                if job.description and tokens:
                    desc_lower = job.description.lower()
                    desc_matched = sum(1 for t in tokens if len(t) > 2 and t in desc_lower)
                    if desc_matched >= len([t for t in tokens if len(t) > 2]) * 0.5:
                        score += 5

                best_score = max(best_score, score)

            job.relevance_score = min(best_score, 100)
            if job.relevance_score >= min_score:
                scored.append(job)

        return scored

    @staticmethod
    def filter_by_location(
        jobs: list["JobResult"],
        target_location: str,
        target_country: str,
    ) -> list["JobResult"]:
        """Filter jobs whose location doesn't match target location/country."""
        if not target_location and not target_country:
            return jobs

        COUNTRY_NAMES = {
            "ca": ["canada", "ca", "canadian"],
            "us": ["united states", "usa", "us", "u.s."],
            "uk": ["united kingdom", "uk", "gb", "england", "scotland", "wales"],
            "au": ["australia", "au", "australian"],
            "de": ["germany", "de", "deutschland"],
            "fr": ["france", "fr"],
            "in": ["india", "in"],
        }

        country_terms = COUNTRY_NAMES.get(target_country.lower(), []) if target_country else []
        loc_lower = target_location.lower().strip() if target_location else ""
        # Extract city name for flexible matching (e.g. "Toronto" from "Toronto, Canada")
        loc_city = loc_lower.split(",")[0].strip() if loc_lower else ""

        filtered: list["JobResult"] = []
        for job in jobs:
            job_loc = (job.location or "").lower()

            # Remote jobs always pass
            if not job_loc or any(
                term in job_loc for term in ("remote", "anywhere", "work from home")
            ):
                filtered.append(job)
                continue

            # Full location string match
            if loc_lower and loc_lower in job_loc:
                filtered.append(job)
                continue

            # City-level match (e.g. "toronto" matches "Toronto, ON")
            if loc_city and len(loc_city) > 2 and loc_city in job_loc:
                filtered.append(job)
                continue

            # Country match
            if country_terms and any(term in job_loc for term in country_terms):
                filtered.append(job)
                continue

        return filtered

    def upload_results(
        self,
        api_url: str,
        session_code: str,
        jobs: list[JobResult],
    ) -> dict:
        """Upload results to the JobHunter API."""
        if not jobs:
            return {"inserted": 0, "duplicates": 0}

        payload = {
            "session_code": session_code,
            "jobs": [j.to_dict() for j in jobs],
        }

        resp = self.http.post(
            f"{api_url}/api/jobs",
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
