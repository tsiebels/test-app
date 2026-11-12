# Cedar Care Command: GitHub Pages copy

A static copy of the Cedar Care Command Databricks App, for sharing without workspace access. Published from https://github.com/tsiebels/test-app. All data is synthetic POC data.

## How it differs from the Databricks App

- **Snapshot, not live.** Every API response is a JSON file in `public/data/`, taken by `scripts/export_snapshot.py`.
- **Filters.** Every month is available, unfiltered. Site, queue and channel filters are not included; clicking one shows a note to clear it. Run the export with `--filters` to add them for the latest month.
- **Access levels.** "Viewing as" (HR, Finance, Ops) replaces real sign-in. The snapshot is taken as HR. Finance hides employee names and Ops locks the labor figures, the same way Unity Catalog does in the real app.
- **Removed.** Ask Cedar (Genie One) and change notes need a live backend, so they are not included.

## Refresh the snapshot

Needs HR access in Unity Catalog (`cedar_finance` plus `people.employees`).

```bash
python -m venv .venv && .venv/bin/pip install "databricks-sql-connector>=3.4"
databricks auth login --profile concord
DATABRICKS_HOST=https://<workspace> DATABRICKS_WAREHOUSE_ID=<warehouse id> .venv/bin/python scripts/export_snapshot.py --profile concord
```

Then push to `main`. The workflow in `.github/workflows/pages.yml` builds the site and redeploys it.

## Run locally

```bash
npm install && npm run build && npx vite preview
```

`server/` holds the app's own query code, used only by the export script.
