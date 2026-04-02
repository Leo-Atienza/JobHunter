"""Scraper registry — import every concrete scraper and expose SCRAPERS map."""

from .linkedin import LinkedInScraper
from .indeed import IndeedScraper
from .glassdoor import GlassdoorScraper
from .jobbank import JobBankScraper
from .remotive import RemotiveScraper
from .adzuna import AdzunaScraper
from .himalayas import HimalayasScraper
from .themuse import TheMuseScraper
from .lever import LeverScraper
from .greenhouse import GreenhouseScraper
from .workday import WorkdayScraper
from .rapidapi import RapidAPIScraper
from .jooble import JoobleScraper
from .jobicy import JobicyScraper
from .devitjobs import DevITjobsScraper

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
    "lever": LeverScraper,
    "greenhouse": GreenhouseScraper,
    "workday": WorkdayScraper,
    "jooble": JoobleScraper,
    "jobicy": JobicyScraper,
    "devitjobs": DevITjobsScraper,
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
    "LeverScraper",
    "GreenhouseScraper",
    "WorkdayScraper",
    "JoobleScraper",
    "JobicyScraper",
    "DevITjobsScraper",
]
