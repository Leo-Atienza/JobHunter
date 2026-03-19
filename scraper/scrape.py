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
          S C R A P E R  v1.0
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
@click.option("--dry-run", is_flag=True, help="Scrape but don't upload results.")
@click.option("--api-url", default=None, help="Override API URL.")
def main(
    session: Optional[str],
    keywords: Optional[str],
    location: Optional[str],
    config_path: str,
    sources: Optional[str],
    dry_run: bool,
    api_url: Optional[str],
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
        api_url=api_url,
    )

    session_code: str = cfg.get("session_code", "")
    api_base: str = cfg.get("api_url", "https://jobhunter.vercel.app")
    search_keywords: list[str] = cfg.get("search", {}).get("keywords", [])
    search_location: str = cfg.get("search", {}).get("location", "")
    search_remote: bool = cfg.get("search", {}).get("remote", False)
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
    console.print()

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
            jobs: list[JobResult] = scraper.scrape(
                keywords=search_keywords,
                location=search_location,
                remote=search_remote,
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
