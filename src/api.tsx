export type Window = { last_day: string; cur: string; cur_end: string; prev: string; months?: string[] };
export type Filters = { site?: string; queue?: string; channel?: string };
export type Context = { window: Window; user: string; persona: 'Ops' | 'Finance' | 'HR'; access: { finance: boolean; people: boolean } };
export type Kpis = Record<string, number | undefined>;
export type Weekly = { week: string; forecast: number; offered: number; abandon_rate: number | null };
export type Attention = { site: string; queue: string; channel: string; prev: number; cur: number; offered: number; forecast: number; weekly: Weekly[]; reasons: [string, number][] };
export type LaborMonths = { cur: Kpis; prev: Kpis; cpc_months: [string, number][] } | { locked: true };

/*
 * Static GitHub Pages build: every response is a JSON snapshot under data/,
 * written by scripts/export_snapshot.py as an HR user. The Finance and Ops
 * views are derived here the same way Unity Catalog would restrict them.
 */

type Persona = 'hr' | 'finance' | 'ops';
const PERSONAS: Record<Persona, Context['persona']> = { hr: 'HR', finance: 'Finance', ops: 'Ops' };
const asParam = new URLSearchParams(location.search).get('as') as Persona | null;
const persona: Persona = asParam && asParam in PERSONAS ? asParam : 'hr';
const FINANCE_METRICS = new Set(['util', 'occ', 'cost', 'cpc']);

let latest: string | undefined;

/** Must match slug() in scripts/export_snapshot.py. */
const keyFor = (p: Record<string, string | undefined>) => ['site', 'queue', 'channel'].map(k => p[k] || '-').join('~');

async function load(path: string) {
  const res = await fetch(path);
  if (!res.ok) return null;
  return res.json();
}

/** Finance can read workforce figures but not people.employees, so names fall back to IDs. */
function hideNames(d: any) {
  if (!d.agents) return d;
  const byName: Record<string, string> = {};
  const agents = d.agents.map((a: any) => { byName[a.mgr] = a.mgr_id; return { ...a, name: a.id, mgr: a.mgr_id }; });
  const id = (n: string) => byName[n] ?? n;
  return {
    ...d, agents, names: false,
    under_by_team: d.under_by_team.map(([n, v]: [string, number]) => [id(n), v]),
    team_fte: { ...d.team_fte, manager: id(d.team_fte.manager) },
    teams: Object.fromEntries(Object.entries(d.teams).map(([n, v]) => [id(n), v])),
  };
}

function restrict(name: string, d: any) {
  if (persona === 'hr' || d.locked) return d;
  if (name === 'workforce') return persona === 'ops' ? { window: d.window, locked: true } : hideNames(d);
  if (persona === 'finance') return d;
  if (name === 'labor') return { window: d.window, locked: true };
  if (name === 'home') return { ...d, labor: { locked: true } };
  if (name.startsWith('kpi/') && FINANCE_METRICS.has(name.slice(4))) return { locked: true };
  return d;
}

export async function getJSON<T>(name: string, params: Record<string, string | undefined> = {}): Promise<T> {
  if (name === 'context') {
    const ctx = await load('data/context.json');
    if (!ctx) throw new Error('Snapshot data is missing. Run scripts/export_snapshot.py.');
    latest = ctx.window.months[0];
    return { ...ctx, persona: PERSONAS[persona], access: { finance: persona !== 'ops', people: persona === 'hr' } } as T;
  }
  const month = params.month || latest!;
  const data = await load(`data/${name}/${month}/${encodeURIComponent(keyFor(params))}.json`);
  if (!data) {
    const filtered = keyFor(params) !== '-~-~-';
    throw new Error(filtered
      ? 'Site, queue and channel filters are not included in this static copy. Clear the filters to see the page.'
      : 'This view is not included in the static snapshot.');
  }
  return restrict(name, data) as T;
}

/** Stands in for real sign-in: pick whose access the static copy should show. */
export function PersonaSwitch() {
  return (
    <label className="select" title="Access level shown in this static copy">
      <span>Viewing as</span>
      <select value={persona} aria-label="Access level" onChange={e => {
        const q = new URLSearchParams(location.search); q.set('as', e.target.value);
        location.search = q.toString();
      }}>
        <option value="hr">HR</option><option value="finance">Finance</option><option value="ops">Ops</option>
      </select>
    </label>
  );
}
