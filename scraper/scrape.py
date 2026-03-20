#!/usr/bin/env python3
"""JobHunter Scraper — scrape job boards and upload results to the JobHunter API."""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Optional

import click
import yaml
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from scrapers import SCRAPERS
from scrapers.base import BaseScraper, JobResult

console = Console()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BANNER = r"""
     ╦╔═╗╔╗  ╦ ╦╦ ╦╔╗╔╔╦╗╔═╗╦═╗
     ║║ ║╠╩╗ ╠═╣║ ║║║║ ║ ║╣ ╠╦╝
    ╚╝╚═╝╚═╝ ╩ ╩╚═╝╝╚╝ ╩ ╚═╝╩╚═
          S C R A P E R  v1.4
"""

SESSION_PATTERN = re.compile(r"^JH-[A-Z0-9]{4,}$")


def load_config(path: str) -> dict:
    """Load YAML config, returning empty dict if not found."""
    config_path = Path(path)
    if not config_path.exists():
        return {}
    with open(config_path, "r", encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def merge_config(cfg: dict, **cli_overrides: Optional[str]) -> dict:
    """Merge CLI flags into the loaded config (CLI wins)."""
    if cli_overrides.get("session"):
        cfg["session_code"] = cli_overrides["session"]
    if cli_overrides.get("api_url"):
        cfg["api_url"] = cli_overrides["api_url"]

    search = cfg.setdefault("search", {})
    if cli_overrides.get("keywords"):
        search["keywords"] = [k.strip() for k in cli_overrides["keywords"].split(",")]
    if cli_overrides.get("location"):
        search["location"] = cli_overrides["location"]
    if cli_overrides.get("companies"):
        search["companies"] = [c.strip() for c in cli_overrides["companies"].split(",")]
    if cli_overrides.get("country"):
        search["country"] = cli_overrides["country"]

    if cli_overrides.get("sources"):
        enabled = {s.strip().lower() for s in cli_overrides["sources"].split(",")}
        sources = {}
        for name in SCRAPERS:
            sources[name] = name in enabled
        cfg["sources"] = sources

    return cfg


def validate_session(code: str) -> bool:
    """Check that the session code matches JH-XXXX pattern."""
    return bool(SESSION_PATTERN.match(code))


def fetch_session_config(api_base: str, session_code: str) -> dict | None:
    """Fetch search preferences from the JobHunter API for this session."""
    import requests as _req

    try:
        resp = _req.get(f"{api_base}/api/session/{session_code}", timeout=10)
        if resp.ok:
            return resp.json()
    except Exception as exc:
        console.print(f"  [yellow]Could not fetch session config:[/] {exc}")
    return None


def show_banner() -> None:
    """Display the startup banner."""
    console.print(
        Panel(
            Text(BANNER, style="bold cyan", justify="center"),
            border_style="bright_blue",
            expand=False,
        )
    )


def show_summary(results: list[dict]) -> None:
    """Print a summary table at the end of the run."""
    table = Table(
        title="Scraping Summary",
        title_style="bold white",
        show_lines=True,
    )
    table.add_column("Source", style="bold")
    table.add_column("Jobs Found", justify="right")
    table.add_column("Uploaded", justify="right")
    table.add_column("Status")

    total_found = 0
    total_uploaded = 0

    for entry in results:
        found = entry["found"]
        uploaded = entry["uploaded"]
        total_found += found
        total_uploaded += uploaded

        if entry["error"]:
            status = f"[red]Error: {entry['error']}[/]"
        elif entry["skipped"]:
            status = "[dim]Skipped[/]"
        elif found == 0:
            status = "[yellow]No results[/]"
        else:
            status = "[green]OK[/]"

        table.add_row(
            entry["source"],
            str(found),
            str(uploaded),
            status,
        )

    table.add_row(
        "[bold]TOTAL[/]",
        f"[bold]{total_found}[/]",
        f"[bold]{total_uploaded}[/]",
        "",
    )

    console.print()
    console.print(table)
    console.print()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


@click.command()
@click.option("--session", default=None, help="Session code (JH-XXXX). Overrides config.")
@click.option("--keywords", default=None, help="Comma-separated search keywords. Overrides config.")
@click.option("--location", default=None, help="Job location. Overrides config.")
@click.option("--config", "config_path", default="config.yaml", help="Path to config file.")
@click.option("--sources", default=None, help="Comma-separated list of sources to run.")
@click.option("--companies", default=None, help="Comma-separated list of target companies.")
@click.option("--dry-run", is_flag=True, help="Scrape but don't upload results.")
@click.option("--no-filter", is_flag=True, help="Disable post-scrape relevance filtering.")
@click.option("--api-url", default=None, help="Override API URL.")
@click.option("--country", default=None, help="Country code (ca, us, uk, au, etc.).")
def main(
    session: Optional[str],
    keywords: Optional[str],
    location: Optional[str],
    config_path: str,
    sources: Optional[str],
    companies: Optional[str],
    dry_run: bool,
    no_filter: bool,
    api_url: Optional[str],
    country: Optional[str],
) -> None:
    """JobHunter Scraper — find jobs across multiple boards."""

    show_banner()

    # ---- Load & merge config ------------------------------------------------
    cfg = load_config(config_path)
    cfg = merge_config(
        cfg,
        session=session,
        keywords=keywords,
        location=location,
        sources=sources,
        companies=companies,
        api_url=api_url,
        country=country,
    )

    session_code: str = cfg.get("session_code", "")
    api_base: str = cfg.get("api_url", "https://jobhunter.vercel.app")
    search_keywords: list[str] = cfg.get("search", {}).get("keywords", [])
    search_location: str = cfg.get("search", {}).get("location", "")
    search_remote: bool = cfg.get("search", {}).get("remote", False)
    search_companies: list[str] = cfg.get("search", {}).get("companies", [])
    search_country: str = cfg.get("search", {}).get("country", "")
    source_flags: dict[str, bool] = cfg.get("sources", {})

    # ---- Validate session first (needed for config fetch) -------------------
    if not dry_run:
        if not session_code:
            console.print(
                "[red]No session code specified.[/] Use --session or config.yaml."
            )
            sys.exit(1)
        if not validate_session(session_code):
            console.print(
                f"[red]Invalid session code:[/] '{session_code}'. "
                "Must match pattern JH-XXXX (uppercase alphanumeric)."
            )
            sys.exit(1)

    # ---- Fetch session config from API (fills in missing fields) ------------
    if session_code and not dry_run:
        remote_cfg = fetch_session_config(api_base, session_code)
        if remote_cfg:
            if not search_keywords and remote_cfg.get("keywords"):
                search_keywords = remote_cfg["keywords"]
                console.print(
                    f"  [dim]Loaded keywords from session:[/] {', '.join(search_keywords)}"
                )
            if not search_location and remote_cfg.get("location"):
                search_location = remote_cfg["location"]
                console.print(
                    f"  [dim]Loaded location from session:[/] {search_location}"
                )
            if not source_flags and remote_cfg.get("sources"):
                for name in SCRAPERS:
                    source_flags[name] = name in remote_cfg["sources"]
                console.print(
                    f"  [dim]Loaded sources from session:[/] {', '.join(remote_cfg['sources'])}"
                )
            if not search_remote and remote_cfg.get("remote"):
                search_remote = True
                console.print("  [dim]Loaded remote preference from session[/]")
            if not search_companies and remote_cfg.get("companies"):
                search_companies = remote_cfg["companies"]
                console.print(
                    f"  [dim]Loaded companies from session:[/] {', '.join(search_companies)}"
                )
            if not search_country and remote_cfg.get("country"):
                search_country = remote_cfg["country"]
                console.print(
                    f"  [dim]Loaded country from session:[/] {search_country}"
                )
            # Load API keys from session config (server provides them)
            if remote_cfg.get("api_keys"):
                existing_keys = cfg.setdefault("api_keys", {})
                for key, value in remote_cfg["api_keys"].items():
                    if not existing_keys.get(key):
                        existing_keys[key] = value
                console.print("  [dim]Loaded API keys from session[/]")
            console.print()

    # ---- Validate keywords --------------------------------------------------
    if not search_keywords:
        console.print("[red]No search keywords specified.[/] Use --keywords or config.yaml.")
        sys.exit(1)

    # ---- Info banner --------------------------------------------------------
    mode_label = "[yellow]DRY RUN[/]" if dry_run else "[green]LIVE[/]"
    console.print(f"  Mode:     {mode_label}")
    if not dry_run:
        console.print(f"  Session:  [bold]{session_code}[/]")
        console.print(f"  API:      {api_base}")
    console.print(f"  Keywords: {', '.join(search_keywords)}")
    console.print(f"  Location: {search_location or '(any)'}")
    console.print(f"  Remote:   {'Yes' if search_remote else 'No'}")
    if search_companies:
        console.print(f"  Companies: {', '.join(search_companies)}")
    if search_country:
        console.print(f"  Country:  {search_country}")
    console.print()

    # Store country in config for scrapers to use
    cfg["country"] = search_country

    # ---- Determine which sources to run ------------------------------------
    enabled_sources: list[str] = []
    for name in SCRAPERS:
        if source_flags.get(name, False):
            enabled_sources.append(name)

    if not enabled_sources:
        # If no sources configured, run all
        enabled_sources = list(SCRAPERS.keys())

    console.print(
        f"  Sources:  {', '.join(enabled_sources)}\n",
        style="dim",
    )

    # Pre-flight checks for sources that need configuration
    import os as _os

    if "adzuna" in enabled_sources:
        api_keys = cfg.get("api_keys", {})
        has_adzuna_keys = (
            (api_keys.get("adzuna_app_id") and api_keys.get("adzuna_api_key"))
            or (_os.environ.get("ADZUNA_APP_ID") and _os.environ.get("ADZUNA_API_KEY"))
        )
        if not has_adzuna_keys:
            console.print(
                "[yellow]Warning:[/] Adzuna requires API keys. "
                "Get free keys at https://developer.adzuna.com\n"
                "  Set ADZUNA_APP_ID and ADZUNA_API_KEY env vars, "
                "or add them to config.yaml under api_keys.\n"
            )

    # ---- Run scrapers -------------------------------------------------------
    run_results: list[dict] = []

    for source_name in SCRAPERS:
        entry: dict = {
            "source": source_name,
            "found": 0,
            "uploaded": 0,
            "error": None,
            "skipped": False,
        }

        if source_name not in enabled_sources:
            entry["skipped"] = True
            run_results.append(entry)
            continue

        console.rule(f"[bold]{source_name.upper()}[/]")

        scraper_cls = SCRAPERS[source_name]
        scraper: BaseScraper = scraper_cls(console=console, config=cfg)

        try:
            # Search each role separately and combine results
            # If companies are specified, search "{role} {company}" for each combo
            all_jobs: list[JobResult] = []
            seen_urls: set[str] = set()

            search_combos: list[str] = []
            if search_companies:
                for role in search_keywords:
                    for company in search_companies:
                        search_combos.append(f"{role} {company}")
            else:
                search_combos = list(search_keywords)

            for search_term in search_combos:
                console.print(f"  [dim]Searching:[/] {search_term}")
                term_jobs: list[JobResult] = scraper.scrape(
                    keywords=[search_term],
                    location=search_location,
                    remote=search_remote,
                )
                for job in term_jobs:
                    if job.url not in seen_urls:
                        seen_urls.add(job.url)
                        all_jobs.append(job)

                # Brief pause between searches to avoid rate limiting
                if len(search_combos) > 1:
                    scraper.rate_limit(1.0, 2.0)

            jobs = all_jobs

            # Apply relevance scoring (replaces binary filter)
            if not no_filter and jobs:
                before_count = len(jobs)
                jobs = BaseScraper.score_relevance(jobs, search_keywords)
                filtered_out = before_count - len(jobs)
                if filtered_out > 0:
                    console.print(
                        f"  [dim]Relevance scoring: {before_count} → {len(jobs)} jobs "
                        f"({filtered_out} below threshold)[/]"
                    )

            # Apply location filtering
            if jobs and (search_location or search_country):
                before_count = len(jobs)
                jobs = BaseScraper.filter_by_location(
                    jobs, search_location, search_country
                )
                filtered_out = before_count - len(jobs)
                if filtered_out > 0:
                    console.print(
                        f"  [dim]Location filter: {before_count} → {len(jobs)} jobs "
                        f"({filtered_out} outside target location)[/]"
                    )

            entry["found"] = len(jobs)

            if jobs and not dry_run:
                try:
                    upload_resp = scraper.upload_results(api_base, session_code, jobs)
                    inserted = upload_resp.get("inserted", 0)
                    entry["uploaded"] = inserted
                    console.print(
                        f"  [green]Uploaded {inserted} jobs[/] "
                        f"({upload_resp.get('duplicates', 0)} duplicates skipped)"
                    )
                except Exception as upload_exc:
                    entry["error"] = f"Upload failed: {upload_exc}"
                    console.print(f"  [red]Upload failed:[/] {upload_exc}")
            elif jobs and dry_run:
                console.print(f"  [yellow]Dry run — {len(jobs)} jobs NOT uploaded.[/]")
        except Exception as exc:
            entry["error"] = str(exc)
            console.print(f"  [red]Scraper failed:[/] {exc}")

        run_results.append(entry)
        console.print()

    # ---- Summary ------------------------------------------------------------
    show_summary(run_results)

    total_found = sum(r["found"] for r in run_results)
    if total_found == 0:
        console.print("[yellow]No jobs found across any source.[/]")
    elif dry_run:
        console.print(
            f"[bold cyan]Found {total_found} jobs total (dry run — nothing uploaded).[/]"
        )
    else:
        total_uploaded = sum(r["uploaded"] for r in run_results)
        console.print(
            f"[bold green]Done! {total_uploaded}/{total_found} jobs uploaded to JobHunter.[/]"
        )


if __name__ == "__main__":
    main()
