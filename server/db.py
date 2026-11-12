"""SQL access as the signed-in user.

Every query runs with the viewer's own token (Databricks Apps user
authorization), so Unity Catalog grants decide what each person can read.
The app never decides access itself.
"""

from __future__ import annotations

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from databricks import sql

HOST = os.environ.get("DATABRICKS_HOST", "").removeprefix("https://").rstrip("/")
WAREHOUSE_ID = os.environ.get("DATABRICKS_WAREHOUSE_ID", "")
CATALOG = "dbrks_app_poc"
CACHE_SECONDS = 300

POOL = ThreadPoolExecutor(max_workers=8)
_cache: dict[tuple, tuple[float, Any]] = {}
_lock = threading.Lock()


class AccessDenied(Exception):
    """The signed-in user cannot read an object the query needs."""


def _plain(v: Any) -> Any:
    if isinstance(v, Decimal):
        return float(v)
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return v


def _is_denied(exc: Exception) -> bool:
    msg = str(exc)
    return any(k in msg for k in ("PERMISSION_DENIED", "INSUFFICIENT_PERMISSIONS", "does not have", "TABLE_OR_VIEW_NOT_FOUND"))


def query(token: str, statement: str, params: dict | None = None) -> list[dict]:
    """Run one statement as the user and return rows as plain dicts."""
    try:
        with sql.connect(server_hostname=HOST, http_path=f"/sql/1.0/warehouses/{WAREHOUSE_ID}", access_token=token) as conn:
            with conn.cursor() as cur:
                cur.execute(statement, params or {})
                cols = [c[0] for c in cur.description]
                return [{c: _plain(v) for c, v in zip(cols, row)} for row in cur.fetchall()]
    except Exception as exc:
        if _is_denied(exc):
            raise AccessDenied(str(exc)[:300]) from exc
        raise


def cached(user: str, key: str, fn):
    """Cache a page payload per user for a few minutes. The data changes daily at most."""
    k = (user, key)
    with _lock:
        hit = _cache.get(k)
        if hit and time.time() - hit[0] < CACHE_SECONDS:
            return hit[1]
    value = fn()
    with _lock:
        _cache[k] = (time.time(), value)
    return value


def parallel(*calls):
    """Run several (fn, args...) tuples at once and return their results in order.

    An AccessDenied result is returned as the exception object, so a page can
    lock one section and still show the rest.
    """
    def run(call):
        fn, *args = call
        try:
            return fn(*args)
        except AccessDenied as exc:
            return exc
    return list(POOL.map(run, calls))
