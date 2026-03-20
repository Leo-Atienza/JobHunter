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
from .lever import LeverScraper
from .greenhouse import GreenhouseScraper
from .workday import WorkdayScraper
from .rapidapi import RapidAPIScraper

SCRAPERS: dict[str, type] = {
    "linkedin": LinkedInScraper,
    "indeed": IndeedScraper,
    "glassdoor": GlassdoorScraper,
    "rapidapi": RapidAPIScraper,
    "jobbank": JobBankScraper,
    "remotive": RemotiveScraper,
    "adzuna": AdzunaScraper,
    "himalayas": HimalayasScraper,
    "themuse": TheMuseScraper,
    "arbeitnow": ArbeitnowScraper,
    "lever": LeverScraper,
    "greenhouse": GreenhouseScraper,
    "workday": WorkdayScraper,
}

__all__ = [
    "SCRAPERS",
    "LinkedInScraper",
    "IndeedScraper",
    "GlassdoorScraper",
    "RapidAPIScraper",
    "JobBankScraper",
    "RemotiveScraper",
    "AdzunaScraper",
    "HimalayasScraper",
    "TheMuseScraper",
    "ArbeitnowScraper",
    "LeverScraper",
    "GreenhouseScraper",
    "WorkdayScraper",
]
