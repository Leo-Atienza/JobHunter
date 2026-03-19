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
