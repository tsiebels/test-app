"""Snapshot every API response the static site needs into public/data/.

Runs the app's own page builders (server/pages.py) with your Databricks token,
so the numbers match the Databricks App exactly. Run it as someone with HR
access; the site derives the Finance and Ops views from that snapshot.

Usage:
  export DATABRICKS_HOST=https://<workspace> DATABRICKS_WAREHOUSE_ID=<id>
  python scripts/export_snapshot.py --profile concord [--filters]

What gets saved:
  - every complete month, unfiltered: all five pages and every KPI drill-down
  - with --filters, also every site / queue / channel combination for the
    latest month (~1,350 more snapshots, about an hour)
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
OUT = ROOT / "public" / "data"


def token(profile: str) -> str:
    out = subprocess.run(["databricks", "auth", "token", "--profile", profile], check=True, capture_output=True, text=True).stdout
    return json.loads(out)["access_token"]


def slug(f: dict) -> str:
    """Must match keyFor() in src/api.ts."""
    return "~".join(f.get(k) or "-" for k in ("site", "queue", "channel"))


def main() -> None:
    profile = sys.argv[sys.argv.index("--profile") + 1] if "--profile" in sys.argv else "concord"
    from server import pages
    from server.db import query

    tok = token(profile)
    ctx = pages.context(tok, "snapshot")
    if ctx["persona"] != "HR":
        sys.exit(f"Run this with HR access (people.employees). You are viewing as {ctx['persona']}.")
    months = ctx["window"]["months"]
    latest = months[0]

    combos = query(tok, f"SELECT DISTINCT site, queue FROM {pages.CATALOG}.contacts.contacts")
    sites = sorted({r["site"] for r in combos})
    queues = sorted({r["queue"] for r in combos})
    channels = [r["channel"] for r in query(tok, f"SELECT DISTINCT channel FROM {pages.CATALOG}.contacts.contacts ORDER BY 1")]
    base = [{}] + [{"site": s} for s in sites] + [{"queue": q} for q in queues] + [{"site": r["site"], "queue": r["queue"]} for r in combos]
    filtered = [{**b, **({"channel": c} if c else {})} for b in base for c in [None, *channels]]

    jobs = []
    for m in months:
        for name in ("home", "ops", "cx", "workforce", "labor"):
            jobs.append((name, m, {}))
        for metric in pages.DRILL:
            jobs.append((f"kpi/{metric}", m, {}))
    for f in (filtered[1:] if "--filters" in sys.argv else []):
        for name in ("home", "ops", "cx"):
            jobs.append((name, latest, f))
        for metric in pages.DRILL:
            jobs.append((f"kpi/{metric}", latest, f))

    builders = {"home": pages.home, "ops": pages.ops, "cx": pages.cx, "workforce": pages.workforce, "labor": pages.labor}

    def run(job):
        name, m, f = job
        if name.startswith("kpi/"):
            data = pages.kpi_drill(tok, name[4:], m, f)
        else:
            data = builders[name](tok, m, f)
        path = OUT / name / m / f"{slug(f)}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, separators=(",", ":")))

    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    (OUT / "context.json").write_text(json.dumps({**ctx, "user": "snapshot"}))

    failed = 0
    print(f"{len(jobs)} snapshots to take", flush=True)
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(run, j): j for j in jobs}
        for i, fut in enumerate(as_completed(futures), 1):
            try:
                fut.result()
            except Exception as exc:  # e.g. a filter with no rows: the site shows "not in snapshot"
                failed += 1
                print(f"skip {futures[fut][0]} {futures[fut][1]} {slug(futures[fut][2])}: {type(exc).__name__} {str(exc)[:120]}", flush=True)
            if i % 100 == 0:
                print(f"{i}/{len(jobs)}", flush=True)
    print(f"done, {failed} skipped", flush=True)


if __name__ == "__main__":
    main()
