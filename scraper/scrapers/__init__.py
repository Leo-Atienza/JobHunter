"""Scraper registry — import every concrete scraper and expose SCRAPERS map."""

from .linkedin import LinkedInScraper
from .indeed import IndeedScraper
from .glassdoor import GlassdoorScraper
from .jobbank import JobBankScraper
from .remotive import RemotiveScraper
from .adzuna import AdzunaScraper

SCRAPERS: dict[str, type] = {
    "linkedin": LinkedInScraper,
    "indeed": IndeedScraper,
    "glassdoor": GlassdoorScraper,
    "jobbank": JobBankScraper,
    "remotive": RemotiveScraper,
    "adzuna": AdzunaScraper,
}

__all__ = [
    "SCRAPERS",
    "LinkedInScraper",
    "IndeedScraper",
    "GlassdoorScraper",
    "JobBankScraper",
    "RemotiveScraper",
    "AdzunaScraper",
]
