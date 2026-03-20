"""Scraper registry — import every concrete scraper and expose SCRAPERS map."""

from .linkedin import LinkedInScraper
from .indeed import IndeedScraper
from .glassdoor import GlassdoorScraper
from .jobbank import JobBankScraper
from .remotive import RemotiveScraper
from .adzuna import AdzunaScraper
from .himalayas import HimalayasScraper
from .themuse import TheMuseScraper
from .arbeitnow import ArbeitnowScraper

SCRAPERS: dict[str, type] = {
    "linkedin": LinkedInScraper,
    "indeed": IndeedScraper,
    "glassdoor": GlassdoorScraper,
    "jobbank": JobBankScraper,
    "remotive": RemotiveScraper,
    "adzuna": AdzunaScraper,
    "himalayas": HimalayasScraper,
    "themuse": TheMuseScraper,
    "arbeitnow": ArbeitnowScraper,
}

__all__ = [
    "SCRAPERS",
    "LinkedInScraper",
    "IndeedScraper",
    "GlassdoorScraper",
    "JobBankScraper",
    "RemotiveScraper",
    "AdzunaScraper",
    "HimalayasScraper",
    "TheMuseScraper",
    "ArbeitnowScraper",
]
