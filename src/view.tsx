import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getJSON, type Filters, type Window } from './api';
import { Bars, MultiLine } from './charts';
import { fmt, monthLabel, monthName } from './format';
import { Icon, Loader } from './ui';

/** The month and the site, queue and channel filters chosen by clicking, shared by every page. */
type View = {
  month?: string; filters: Filters;
  setMonth: (m: string) => void; toggle: (f: Filters) => void; clear: (k?: keyof Filters) => void;
  drill: (k: string, label: string) => void;
};
const Ctx = createContext<View>({ filters: {}, setMonth: () => {}, toggle: () => {}, clear: () => {}, drill: () => {} });
export const useView = () => useContext(Ctx);

/** Figure keys that open a drill-down, with the API metric and how its values read. */
export const DRILLS: Record<string, [string, (v: number) => string, ((v: number) => string)?]> = {
  offered: ['offered', fmt.int], abandon: ['abandon_rate', v => fmt.pct(v), v => fmt.pct(v, 0)], aht: ['aht', v => Math.round(v) + ' sec'],
  hold: ['hold', v => Math.round(v) + ' sec'], transfer: ['transfer_rate', v => fmt.pct(v), v => fmt.pct(v, 0)], repeat: ['repeat_rate', v => fmt.pct(v), v => fmt.pct(v, 0)],
  tnps: ['tnps', fmt.nps], promoter: ['promoter', v => fmt.pct(v), v => fmt.pct(v, 0)], detractor: ['detractor', v => fmt.pct(v), v => fmt.pct(v, 0)],
  rrate: ['response_rate', v => fmt.pct(v), v => fmt.pct(v, 0)], util: ['util', v => fmt.pct(v), v => fmt.pct(v, 0)], occ: ['occ', v => fmt.pct(v), v => fmt.pct(v, 0)],
  cost: ['cost', fmt.usd, v => '$' + Math.round(v / 1000) + 'k'], cpc: ['cpc', fmt.usd2],
};

export function ViewProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<string | undefined>();
  const [filters, setFilters] = useState<Filters>({});
  const [open, setOpen] = useState<{ k: string; label: string } | null>(null);
  const toggle = (f: Filters) => setFilters(cur => {
    const same = Object.entries(f).every(([k, v]) => cur[k as keyof Filters] === v);
    if (same) { const next = { ...cur }; Object.keys(f).forEach(k => delete next[k as keyof Filters]); return next; }
    return { ...cur, ...f };
  });
  const clear = (k?: keyof Filters) => setFilters(cur => { if (!k) return {}; const next = { ...cur }; delete next[k]; return next; });
  return (
    <Ctx.Provider value={{ month, filters, setMonth, toggle, clear, drill: (k, label) => setOpen({ k, label }) }}>
      {children}
      {open && <DrillPanel {...open} onClose={() => setOpen(null)} />}
    </Ctx.Provider>
  );
}

export const filterText = (f: Filters) => [f.site, f.queue, f.channel].filter(Boolean).join(' ');

/** Chips for the active filters. Select one to remove it. */
export function FilterChips() {
  const { filters, clear } = useView();
  const keys = (['site', 'queue', 'channel'] as const).filter(k => filters[k]);
  if (!keys.length) return null;
  return (
    <div className="chips" aria-label="Active filters">
      {keys.map(k => <button key={k} type="button" className="chip" onClick={() => clear(k)} aria-label={`Remove ${filters[k]} filter`}>{filters[k]}<Icon id="i-close" /></button>)}
      {keys.length > 1 && <button type="button" className="chip-clear" onClick={() => clear()}>Clear all</button>}
    </div>
  );
}

/** Reporting month select, from the complete months in the data. */
export function MonthPicker({ months, fallback }: { months: string[]; fallback: string }) {
  const { month, setMonth } = useView();
  const cur = month || fallback;
  return (
    <label className="select" title="Reporting period">
      <Icon id="i-cal" />
      <select value={cur} onChange={e => setMonth(e.target.value)} aria-label="Reporting month">
        {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
      </select>
    </label>
  );
}

type Drill = { window: Window; trend: [string, number][]; split: [string, string, number][]; locked?: true };

function DrillPanel({ k, label, onClose }: { k: string; label: string; onClose: () => void }) {
  const { month, filters, toggle } = useView();
  const [state, setState] = useState<{ data?: Drill; error?: string }>({});
  const [metric, vf, tf] = DRILLS[k];
  useEffect(() => {
    let live = true; setState({});
    getJSON<Drill>('kpi/' + metric, { month, ...filters }).then(data => live && setState({ data }), e => live && setState({ error: e.message }));
    return () => { live = false; };
  }, [metric, month, filters]);
  useEffect(() => { const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', on); return () => removeEventListener('keydown', on); }, [onClose]);
  const d = state.data;
  const scope = filterText(filters) || 'All sites and queues';
  return (
    <div className="sheet-back" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div><h2>{label}</h2><p>{scope}{d ? `, ${monthName(d.trend[0]?.[0] + '-01')} ${d.trend[0]?.[0].slice(0, 4)} to ${monthLabel(d.window.cur)}` : ''}</p></div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}><Icon id="i-close" /></button>
        </div>
        {state.error ? <div className="error-note">{state.error}</div> : !d ? <div className="page-loading"><Loader size={40} /></div> : d.locked ? <div className="empty">This figure needs Finance access.</div> : (
          <>
            <MultiLine series={[{ name: '', color: 'var(--pine)', emph: true, values: d.trend.map(t => t[1]) }]} months={d.trend.map(t => t[0] + '-01')} height={220} valueFmt={vf} tickFmt={tf || vf} label={`${label} by month`} />
            <div className="sec-head"><div><h2>By site and queue in {monthName(d.window.cur)}</h2><p>Select one to filter the app to it.</p></div></div>
            <Bars rows={d.split.map(r => [`${r[0]} ${r[1]}`, r[2]])} valueFmt={vf} active={filters.site ? `${filters.site} ${filters.queue}` : undefined}
              onPick={name => { const r = d.split.find(x => `${x[0]} ${x[1]}` === name)!; toggle({ site: r[0], queue: r[1] }); }} />
          </>
        )}
      </section>
    </div>
  );
}
