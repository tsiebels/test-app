"""Page payloads built from the Unity Catalog metric views.

Every month, period, team and highlight is derived from the data. Nothing on
a page is typed in by hand. Pages accept a reporting month and optional
site, queue and channel filters chosen by clicking in the app.
"""

from __future__ import annotations

from datetime import date, timedelta

from .db import CATALOG, AccessDenied, parallel, query

CC = f"{CATALOG}.contacts.mv_contact_center"
DF = f"{CATALOG}.contacts.mv_demand_forecast"
WF = f"{CATALOG}.finance.mv_workforce_cost"
LP = f"{CATALOG}.finance.mv_labor_plan"
WF_FACT = f"{CATALOG}.finance.workforce_period_fact"
MIN_OFFERED_FOR_HIGHLIGHT = 200
FILTER_KEYS = ("site", "queue", "channel")

# Metrics a KPI can drill into: name -> (metric view, measure, month dimension)
DRILL = {
    "offered": (CC, "offered_contacts"), "abandon_rate": (CC, "abandon_rate"), "aht": (CC, "aht_seconds"),
    "hold": (CC, "avg_hold_seconds"), "transfer_rate": (CC, "transfer_rate"), "repeat_rate": (CC, "repeat_contact_rate"),
    "tnps": (CC, "tnps"), "promoter": (CC, "promoter_pct"), "detractor": (CC, "detractor_pct"), "response_rate": (CC, "survey_response_rate"),
    "util": (WF, "utilization"), "occ": (WF, "occupancy"), "cost": (WF, "total_labor_cost"), "cpc": (WF, "cost_per_handled_contact"),
}


# ---------------------------------------------------------------- periods and filters

def month_start(d: date) -> date:
    return d.replace(day=1)


def month_end(d: date) -> date:
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)


def _bounds(token: str) -> tuple[date, date]:
    r = query(token, f"SELECT MIN(CAST(started_at AS DATE)) AS a, MAX(CAST(started_at AS DATE)) AS b FROM {CATALOG}.contacts.contacts")[0]
    return date.fromisoformat(r["a"]), date.fromisoformat(r["b"])


def reporting_window(token: str, month: str | None = None) -> dict:
    """The requested month if it is complete in the data, otherwise the latest complete month."""
    first, last = _bounds(token)
    latest = month_start(last) if last == month_end(last) else month_start(month_start(last) - timedelta(days=1))
    earliest = month_start(first) if first.day == 1 else month_start(month_end(first) + timedelta(days=1))
    cur = latest
    if month:
        try:
            m = month_start(date.fromisoformat(month[:7] + "-01"))
            if earliest <= m <= latest:
                cur = m
        except ValueError:
            pass
    prev = month_start(cur - timedelta(days=1))
    months, m = [], latest
    while m >= earliest:
        months.append(m.isoformat())
        m = month_start(m - timedelta(days=1))
    return {"last_day": last.isoformat(), "cur": cur.isoformat(), "cur_end": month_end(cur).isoformat(), "prev": prev.isoformat(), "months": months}


def where(f: dict, skip: tuple = ()) -> tuple[str, dict]:
    """SQL fragment and parameters for the active site, queue and channel filters."""
    sql, params = "", {}
    for k in FILTER_KEYS:
        if f.get(k) and k not in skip:
            sql += f" AND {k} = :f_{k}"
            params[f"f_{k}"] = f[k]
    return sql, params


# ---------------------------------------------------------------- shared queries

def contact_kpis(token: str, w: dict, f: dict) -> dict:
    fs, fp = where(f)
    rows = query(token, f"""
        SELECT contact_month AS m,
               MEASURE(offered_contacts) AS offered, MEASURE(abandon_rate) AS abandon_rate,
               MEASURE(aht_seconds) AS aht, MEASURE(avg_hold_seconds) AS hold,
               MEASURE(transfer_rate) AS transfer_rate, MEASURE(repeat_contact_rate) AS repeat_rate,
               MEASURE(tnps) AS tnps, MEASURE(promoter_pct) AS promoter, MEASURE(detractor_pct) AS detractor,
               MEASURE(survey_response_rate) AS response_rate
        FROM {CC}
        WHERE contact_date BETWEEN :prev AND :cur_end{fs}
        GROUP BY ALL""", {"prev": w["prev"], "cur_end": w["cur_end"], **fp})
    by = {r["m"][:7]: r for r in rows}
    return {"cur": by.get(w["cur"][:7], {}), "prev": by.get(w["prev"][:7], {})}


def labor_months(token: str, w: dict, f: dict | None = None) -> dict:
    fs, fp = where(f or {}, skip=("channel",))
    start = month_start(date.fromisoformat(w["cur"]) - timedelta(days=170)).isoformat()
    rows = query(token, f"""
        SELECT pay_month AS m,
               MEASURE(utilization) AS util, MEASURE(occupancy) AS occ,
               MEASURE(total_labor_cost) AS cost, MEASURE(planned_pay) AS planned,
               MEASURE(ot_pay) AS ot, MEASURE(cost_per_handled_contact) AS cpc
        FROM {WF}
        WHERE pay_period_start BETWEEN :start AND :cur_end{fs}
        GROUP BY ALL ORDER BY m""", {"start": start, "cur_end": w["cur_end"], **fp})
    by = {r["m"][:7]: r for r in rows}
    return {"cur": by.get(w["cur"][:7], {}), "prev": by.get(w["prev"][:7], {}), "cpc_months": [[r["m"][:7], r["cpc"]] for r in rows]}


def can_read_people(token: str) -> bool:
    try:
        query(token, f"SELECT 1 AS ok FROM {CATALOG}.people.employees LIMIT 1")
        return True
    except AccessDenied:
        return False


def attention(token: str, w: dict, weeks: int, f: dict) -> dict | None:
    """Within the active filters, the site, queue and channel whose abandon rate rose most against last month."""
    fs, fp = where(f)
    rows = query(token, f"""
        SELECT site, queue, channel, contact_month AS m,
               MEASURE(offered_contacts) AS offered, MEASURE(abandon_rate) AS ar
        FROM {CC}
        WHERE contact_date BETWEEN :prev AND :cur_end{fs}
        GROUP BY ALL""", {"prev": w["prev"], "cur_end": w["cur_end"], **fp})
    cur, prev = {}, {}
    for r in rows:
        (cur if r["m"][:7] == w["cur"][:7] else prev)[(r["site"], r["queue"], r["channel"])] = r
    cands = [(cur[k]["ar"] - prev[k]["ar"], k) for k in cur
             if k in prev and cur[k]["ar"] is not None and prev[k]["ar"] is not None and (cur[k]["offered"] or 0) >= MIN_OFFERED_FOR_HIGHLIGHT]
    if not cands:
        return None
    _, (site, queue, channel) = max(cands)
    p = {"site": site, "queue": queue, "channel": channel}

    end = min(date.fromisoformat(w["last_day"]), date.fromisoformat(w["cur_end"]))
    start = (date.fromisoformat(w["cur_end"]) - timedelta(weeks=weeks)).isoformat()
    fc, ab, rs, fm = parallel(
        (query, token, f"""
            SELECT forecast_week AS week, MEASURE(forecast_contacts) AS forecast, MEASURE(actual_offered_contacts) AS offered
            FROM {DF}
            WHERE site = :site AND queue = :queue AND channel = :channel AND forecast_date BETWEEN :start AND :cur_end
            GROUP BY ALL ORDER BY week""", {**p, "start": start, "cur_end": w["cur_end"]}),
        (query, token, f"""
            SELECT contact_week AS week, MEASURE(abandon_rate) AS abandon_rate
            FROM {CC}
            WHERE site = :site AND queue = :queue AND channel = :channel AND contact_date BETWEEN :start AND :cur_end
            GROUP BY ALL""", {**p, "start": start, "cur_end": w["cur_end"]}),
        (query, token, f"""
            SELECT abandon_reason AS reason, MEASURE(abandoned_contacts) AS n
            FROM {CC}
            WHERE site = :site AND queue = :queue AND channel = :channel AND contact_date BETWEEN :cur AND :cur_end
              AND abandon_reason IS NOT NULL
            GROUP BY ALL ORDER BY n DESC""", {**p, "cur": w["cur"], "cur_end": w["cur_end"]}),
        (query, token, f"""
            SELECT MEASURE(forecast_contacts) AS forecast, MEASURE(actual_offered_contacts) AS offered
            FROM {DF}
            WHERE site = :site AND queue = :queue AND channel = :channel AND forecast_date BETWEEN :cur AND :cur_end""",
         {**p, "cur": w["cur"], "cur_end": w["cur_end"]}),
    )
    abr = {r["week"][:10]: r["abandon_rate"] for r in ab}
    weekly = [{"week": r["week"][:10], "forecast": r["forecast"], "offered": r["offered"], "abandon_rate": abr.get(r["week"][:10])}
              for r in fc if date.fromisoformat(r["week"][:10]) + timedelta(days=6) <= end]
    return {**p, "prev": prev[(site, queue, channel)]["ar"], "cur": cur[(site, queue, channel)]["ar"],
            "offered": fm[0]["offered"], "forecast": fm[0]["forecast"],
            "weekly": weekly, "reasons": [[r["reason"], r["n"]] for r in rs]}


def must(*results):
    """Contact data is open to every Cedar group, so a denial here is a setup problem worth showing, not a locked card."""
    for r in results:
        if isinstance(r, AccessDenied):
            raise r


def locked(x):
    return {"locked": True} if isinstance(x, AccessDenied) else x


# ---------------------------------------------------------------- pages

def context(token: str, user: str) -> dict:
    w = reporting_window(token)
    lab, people = parallel((labor_months, token, w), (can_read_people, token))
    finance = not isinstance(lab, AccessDenied)
    persona = "HR" if finance and people is True else "Finance" if finance else "Ops"
    return {"window": w, "user": user, "access": {"finance": finance, "people": people is True}, "persona": persona}


def home(token: str, month: str | None, f: dict) -> dict:
    w = reporting_window(token, month)
    fs, fp = where(f, skip=("site", "queue"))
    kpis, lab, att, sites = parallel(
        (contact_kpis, token, w, f),
        (labor_months, token, w, f),
        (attention, token, w, 9, f),
        (query, token, f"""
            SELECT site, queue, contact_month AS m,
                   MEASURE(offered_contacts) AS offered, MEASURE(abandon_rate) AS abandon_rate,
                   MEASURE(aht_seconds) AS aht, MEASURE(tnps) AS tnps
            FROM {CC}
            WHERE contact_date BETWEEN :prev AND :cur_end{fs}
            GROUP BY ALL""", {"prev": w["prev"], "cur_end": w["cur_end"], **fp}),
    )
    must(kpis, att, sites)
    cur = {(r["site"], r["queue"]): r for r in sites if r["m"][:7] == w["cur"][:7]}
    prev = {(r["site"], r["queue"]): r for r in sites if r["m"][:7] == w["prev"][:7]}
    table = [{**cur[k], "prev_abandon_rate": prev.get(k, {}).get("abandon_rate"), "prev_tnps": prev.get(k, {}).get("tnps")} for k in cur]
    return {"window": w, "kpis": kpis, "labor": locked(lab), "attention": att, "sites": table}


def ops(token: str, month: str | None, f: dict) -> dict:
    w = reporting_window(token, month)
    fs, fp = where(f, skip=("channel",))
    kpis, att, ch = parallel(
        (contact_kpis, token, w, f),
        (attention, token, w, 16, f),
        (query, token, f"""
            SELECT channel, MEASURE(abandon_rate) AS abandon_rate
            FROM {CC} WHERE contact_date BETWEEN :cur AND :cur_end{fs} GROUP BY ALL""", {"cur": w["cur"], "cur_end": w["cur_end"], **fp}),
    )
    must(kpis, att, ch)
    return {"window": w, "kpis": kpis, "attention": att, "channels": {r["channel"]: r["abandon_rate"] for r in ch}}


def cx(token: str, month: str | None, f: dict) -> dict:
    w = reporting_window(token, month)
    year_start = w["cur"][:4] + "-01-01"
    fs, fp = where(f)
    kpis, monthly, themes = parallel(
        (contact_kpis, token, w, f),
        (query, token, f"""
            SELECT site, queue, contact_month AS m, MEASURE(tnps) AS tnps
            FROM {CC} WHERE contact_date BETWEEN :start AND :cur_end{where(f, skip=('site', 'queue'))[0]} GROUP BY ALL""",
         {"start": year_start, "cur_end": w["cur_end"], **where(f, skip=("site", "queue"))[1]}),
        (query, token, f"""
            SELECT survey_theme AS theme, MEASURE(survey_responses) AS n
            FROM {CC} WHERE nps_category = 'Detractor' AND contact_date BETWEEN :cur AND :cur_end{fs}
            GROUP BY ALL ORDER BY n DESC""", {"cur": w["cur"], "cur_end": w["cur_end"], **fp}),
    )
    must(kpis, monthly, themes)
    series: dict[str, dict] = {}
    for r in monthly:
        series.setdefault(f"{r['site']}|{r['queue']}", {})[r["m"][:10]] = r["tnps"]
    return {"window": w, "kpis": kpis, "tnps_monthly": series, "detractor_themes": [[r["theme"], r["n"]] for r in themes]}


def workforce(token: str, month: str | None, f: dict) -> dict:
    w = reporting_window(token, month)
    try:
        periods = query(token, f"SELECT period_start AS s, period_end AS e FROM {WF_FACT} GROUP BY ALL ORDER BY s")
    except AccessDenied:
        return {"window": w, "locked": True}
    last = w["last_day"]
    full = [p for p in periods if (date.fromisoformat(p["e"]) - date.fromisoformat(p["s"])).days == 13 and p["e"] <= last]
    in_month = [p for p in full if w["cur"] <= p["s"] <= w["cur_end"]]
    before = [p for p in full if p["s"] <= w["cur_end"]]
    period = (in_month or before or full)[-1]
    lab, agents, teams, names = parallel(
        (labor_months, token, w),
        (query, token, f"""
            SELECT employee_id AS id, manager_id AS mgr_id, site, queue, proficiency AS prof,
                   paid_hours AS paid, handle_hours AS handle, training_hours AS train, ot_hours AS ot_h
            FROM {WF_FACT} WHERE period_start = :ps""", {"ps": period["s"]}),
        (query, token, f"""
            SELECT manager_id AS mgr_id, MEASURE(under_utilized_agents) AS n
            FROM {WF} WHERE pay_period_start = :ps GROUP BY ALL ORDER BY n DESC""", {"ps": period["s"]}),
        # Names live only in people.employees, so Unity Catalog shows them to HR and no one else.
        (query, token, f"SELECT employee_id AS id, name FROM {CATALOG}.people.employees"),
    )
    named = not isinstance(names, AccessDenied)
    who = {r["id"]: r["name"] for r in names} if named else {}
    for a in agents:
        a["util"] = a["handle"] / a["paid"] if a["paid"] else None
        a["name"] = who.get(a["id"], a["id"])
        a["mgr"] = who.get(a["mgr_id"], a["mgr_id"])
    under_by_team = [[who.get(t["mgr_id"], t["mgr_id"]), t["n"]] for t in teams if t["n"]]
    top = under_by_team[0][0] if under_by_team else agents[0]["mgr"]
    team = next(a for a in agents if a["mgr"] == top)
    fte = query(token, f"""
        SELECT week_start AS week, MEASURE(forecast_fte) AS plan, MEASURE(scheduled_fte) AS sched, MEASURE(scheduled_headcount) AS hc
        FROM {LP} WHERE site = :site AND queue = :queue AND week_start BETWEEN :start AND :end
        GROUP BY ALL ORDER BY week""",
        {"site": team["site"], "queue": team["queue"], "start": (date.fromisoformat(period["e"]) - timedelta(weeks=10)).isoformat(), "end": period["e"]})
    teams_fte = {}
    for a in agents:
        teams_fte.setdefault(a["mgr"], {"site": a["site"], "queue": a["queue"]})
    return {"window": w, "period": {"start": period["s"], "end": period["e"]}, "labor": lab, "agents": agents,
            "under": sum(1 for a in agents if a["util"] is not None and a["util"] < 0.5), "under_by_team": under_by_team,
            "team_fte": {"manager": top, "site": team["site"], "queue": team["queue"], "weeks": fte[-10:]}, "teams": teams_fte, "names": named}


def team_fte(token: str, site: str, queue: str, end: str) -> list:
    return query(token, f"""
        SELECT week_start AS week, MEASURE(forecast_fte) AS plan, MEASURE(scheduled_fte) AS sched, MEASURE(scheduled_headcount) AS hc
        FROM {LP} WHERE site = :site AND queue = :queue AND week_start BETWEEN :start AND :end
        GROUP BY ALL ORDER BY week""", {"site": site, "queue": queue, "start": (date.fromisoformat(end) - timedelta(weeks=10)).isoformat(), "end": end})[-10:]


def labor(token: str, month: str | None, f: dict) -> dict:
    w = reporting_window(token, month)
    try:
        lab = labor_months(token, w)
    except AccessDenied:
        return {"window": w, "locked": True}
    periods = query(token, f"""
        SELECT pay_period_start AS ps, MEASURE(total_labor_cost) AS cost, MEASURE(planned_pay) AS planned, MEASURE(ot_pay) AS ot
        FROM {WF} WHERE pay_period_start <= :cur_end GROUP BY ALL ORDER BY ps""", {"cur_end": w["cur_end"]})
    full = [p for p in periods if date.fromisoformat(p["ps"]) + timedelta(days=13) <= date.fromisoformat(w["last_day"])]
    return {"window": w, "labor": lab, "periods": full[-14:]}


def kpi_drill(token: str, metric: str, month: str | None, f: dict) -> dict:
    """12-month trend and the site-by-queue breakdown for one KPI, inside the active filters."""
    view, measure = DRILL[metric]
    w = reporting_window(token, month)
    start = month_start(date.fromisoformat(w["cur"]) - timedelta(days=335)).isoformat()
    month_dim, date_dim = ("contact_month", "contact_date") if view == CC else ("pay_month", "pay_period_start")
    fs, fp = where(f, skip=() if view == CC else ("channel",))
    trend, split = parallel(
        (query, token, f"""
            SELECT {month_dim} AS m, MEASURE({measure}) AS v FROM {view}
            WHERE {date_dim} BETWEEN :start AND :cur_end{fs} GROUP BY ALL ORDER BY m""", {"start": start, "cur_end": w["cur_end"], **fp}),
        (query, token, f"""
            SELECT site, queue, MEASURE({measure}) AS v FROM {view}
            WHERE {date_dim} BETWEEN :cur AND :cur_end{fs} GROUP BY ALL ORDER BY v DESC""", {"cur": w["cur"], "cur_end": w["cur_end"], **fp}),
    )
    if isinstance(trend, AccessDenied):
        return {"locked": True}
    return {"window": w, "metric": metric, "trend": [[r["m"][:7], r["v"]] for r in trend], "split": [[r["site"], r["queue"], r["v"]] for r in split]}
