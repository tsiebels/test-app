import { useEffect, useState, type ReactNode } from 'react';
import { getJSON, type Attention, type Kpis, type Window } from './api';
import { Bars, ForecastChart, MultiLine, type Series } from './charts';
import { dayLabel, fmt, MONTHS, monthLabel, monthName } from './format';
import { DefButton, Delta, Fig, Icon, LockedPage, PageError, PageLoading, SecHead } from './ui';
import { filterText, useView } from './view';

type Nav = { go: (page: string) => void };

function usePage<T>(name: string): { data?: T; error?: string } {
  const { month, filters } = useView();
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    let live = true;
    setState(s => s.data ? { data: s.data } : {});
    getJSON<T>(name, { month, ...filters }).then(data => live && setState({ data }), e => live && setState({ error: e.message }));
    return () => { live = false; };
  }, [name, month, filters]);
  return state;
}

/* Sortable table */
type Col<R> = { key: keyof R & string; label: string; text?: boolean; render?: (r: R) => ReactNode };
function Table<R extends Record<string, any>>({ cols, rows, sortKey, desc = true, rowClass, onRow }: { cols: Col<R>[]; rows: R[]; sortKey: string; desc?: boolean; rowClass?: (r: R) => string; onRow?: (r: R) => void }) {
  const [sort, setSort] = useState({ key: sortKey, desc });
  const sorted = rows.slice().sort((a, b) => {
    const va = a[sort.key], vb = b[sort.key];
    const c = typeof va === 'string' ? va.localeCompare(vb) : (va ?? -Infinity) - (vb ?? -Infinity);
    return sort.desc ? -c : c;
  });
  return (
    <div className="table-wrap"><table>
      <thead><tr>{cols.map(c => (
        <th key={c.key} className={c.text ? 't' : ''} aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
          <button type="button" onClick={() => setSort(s => ({ key: c.key, desc: s.key === c.key ? !s.desc : true }))}>{c.label}<Icon id="i-sort" /></button>
        </th>))}</tr></thead>
      <tbody>{sorted.map((r, i) => <tr key={i} className={(rowClass?.(r) || '') + (onRow ? ' pick' : '')} onClick={onRow && (() => onRow(r))}>{cols.map((c, j) => <td key={c.key} className={c.text ? 't' : ''}>
        {onRow && j === 0 ? <button type="button" className="row-btn" onClick={e => { e.stopPropagation(); onRow(r); }}>{c.render ? c.render(r) : r[c.key]}</button> : c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}</tbody>
    </table></div>
  );
}

const wkPoints = (w: Attention['weekly']) => w.map(x => ({
  a: x.offered, p: x.forecast, label: dayLabel(x.week),
  tip: [['Offered', fmt.int(x.offered)], ['Forecast', fmt.int(x.forecast)], ['Abandon rate', x.abandon_rate == null ? 'n/a' : fmt.pct(x.abandon_rate)]] as [string, string][],
}));
const abPoints = (w: Attention['weekly'], prev: number, prevName: string) => w.filter(x => x.abandon_rate != null).map(x => ({
  a: x.abandon_rate!, p: prev, label: dayLabel(x.week),
  tip: [['Abandon rate', fmt.pct(x.abandon_rate!)], [`${prevName} rate`, fmt.pct(prev)], ['Offered', fmt.int(x.offered)]] as [string, string][],
}));
const attName = (a: Attention) => `${a.site} ${a.queue} ${a.channel}`;

/* ---------------------------------------------------------------- Home */
type HomeData = { window: Window; kpis: { cur: Kpis; prev: Kpis }; labor: { cur: Kpis; prev: Kpis } | { locked: true }; attention: Attention; sites: any[] };

export function Home({ go }: Nav) {
  const { data, error } = usePage<HomeData>('home');
  const { filters, toggle } = useView();
  if (error) return <PageError title="Home" message={error} />;
  if (!data) return <PageLoading title="" />;
  const { window: w, kpis: { cur: c, prev: p }, attention: att } = data;
  const lab = 'locked' in data.labor ? null : data.labor;
  const reasonsTotal = att.reasons.reduce((s, r) => s + r[1], 0);
  const sites = data.sites.map(r => ({ ...r, name: `${r.site} ${r.queue}`, dAb: r.abandon_rate - (r.prev_abandon_rate ?? r.abandon_rate), dN: r.tnps - (r.prev_tnps ?? r.tnps) }));
  const top = sites.slice().sort((a, b) => b.dAb - a.dAb)[0];
  return (
    <>
      <div className="page-head"><h1>Cedar Care Contact Center</h1><p>{monthLabel(w.cur)} · {filterText(filters) || 'All sites and queues'} · vs {monthName(w.prev)}</p></div>
      <section className="figures" aria-label="Figures for the month">
        <Fig k="offered" label="Contacts offered" value={fmt.int(c.offered!)} delta={<Delta cur={c.offered} prev={p.offered} prevIso={w.prev} neutral />} />
        <Fig k="abandon" label="Abandon rate" value={fmt.pct(c.abandon_rate!)} delta={<Delta cur={c.abandon_rate} prev={p.abandon_rate} prevIso={w.prev} kind="pts" goodWhen="down" />} />
        <Fig k="aht" label="Avg handle time" value={Math.round(c.aht!)} unit="sec" delta={<Delta cur={c.aht} prev={p.aht} prevIso={w.prev} kind="int" unit=" sec" goodWhen="down" />} />
        <Fig k="tnps" label="tNPS" value={fmt.nps(c.tnps!)} delta={<Delta cur={c.tnps} prev={p.tnps} prevIso={w.prev} kind="abs" />} />
        <Fig k="util" label="Utilization" locked={!lab} value={lab && fmt.pct(lab.cur.util!)} delta={lab && <Delta cur={lab.cur.util} prev={lab.prev.util} prevIso={w.prev} kind="pts" />} />
        <Fig k="cost" label="Labor cost" locked={!lab} value={lab && fmt.usd(lab.cur.cost!)} delta={lab && <Delta cur={lab.cur.cost} prev={lab.prev.cost} prevIso={w.prev} goodWhen="down" />} />
        <Fig k="cpc" label="Cost per contact" locked={!lab} value={lab && fmt.usd2(lab.cur.cpc!)} delta={lab && <Delta cur={lab.cur.cpc} prev={lab.prev.cpc} prevIso={w.prev} goodWhen="down" />} />
      </section>

      <section className="panel attention" aria-labelledby="att-h">
        <SecHead id="att-h" flag="Largest change this month" title={`Abandon rate in ${attName(att)} ${att.cur >= att.prev ? 'rose' : 'fell'} from ${fmt.pct(att.prev)} to ${fmt.pct(att.cur)}`}
          sub={`Weekly abandon rate against the ${monthName(w.prev)} rate.`}
          actions={<button className="btn" type="button" onClick={() => go('ops')}>Open Contact Operations</button>} />
        <ForecastChart points={abPoints(att.weekly, att.prev, monthName(w.prev))} labels={['Abandon rate', `${monthName(w.prev)} rate`]} yFmt={v => fmt.pct(v, 0)} />
        <div className="facts">
          <div className="fact"><b>{fmt.int(att.offered)} vs {fmt.int(att.forecast)}</b><span>Offered against forecast in {monthName(w.cur)}</span></div>
          <div className="fact"><b>{fmt.pct(Math.max(...att.weekly.map(x => x.abandon_rate ?? 0)))}</b><span>Highest weekly abandon rate</span></div>
          {att.reasons.length > 0 && <div className="fact"><b>{fmt.pct(att.reasons[0][1] / reasonsTotal, 0)} {att.reasons[0][0].toLowerCase()}</b><span>Most common abandon reason</span></div>}
        </div>
      </section>

      <section className="panel" aria-labelledby="sq-h">
        <SecHead id="sq-h" title="Sites and queues" sub={`${monthName(w.cur)}, inbound. Select a row to filter the app to it.`} />
        <Table sortKey="abandon_rate" rows={sites} onRow={r => toggle({ site: r.site, queue: r.queue })}
          rowClass={r => (r === top ? 'hot' : '') + (filters.site === r.site && filters.queue === r.queue ? ' on' : '')} cols={[
          { key: 'name', label: 'Site and queue', text: true, render: r => r.name },
          { key: 'offered', label: 'Offered', render: r => fmt.int(r.offered) },
          { key: 'abandon_rate', label: 'Abandon rate', render: r => <>{fmt.pct(r.abandon_rate)}<span className={'sub' + (r.dAb > 0.005 ? ' up' : '')}>{r.dAb >= 0 ? '+' : '−'}{Math.abs(r.dAb * 100).toFixed(1)}</span></> },
          { key: 'aht', label: 'AHT (sec)', render: r => Math.round(r.aht) },
          { key: 'tnps', label: 'tNPS', render: r => <>{fmt.nps(r.tnps)}<span className="sub">{r.dN >= 0 ? '+' : '−'}{Math.abs(r.dN).toFixed(1)}</span></> },
        ]} />
      </section>

    </>
  );
}

/* ---------------------------------------------------------------- Contact Operations */
type OpsData = { window: Window; kpis: { cur: Kpis; prev: Kpis }; attention: Attention; channels: Record<string, number> };

export function Ops(_: Nav) {
  const { data, error } = usePage<OpsData>('ops');
  const { filters, toggle } = useView();
  if (error) return <PageError title="Contact Operations" message={error} />;
  if (!data) return <PageLoading title="Contact Operations" />;
  const { window: w, kpis: { cur: c, prev: p }, attention: att, channels } = data;
  const recent = att.weekly.slice(-9);
  return (
    <>
      <div className="page-head"><h1>Contact Operations</h1><p>Volume, abandonment and handling for {monthLabel(w.cur)}.</p></div>
      <section className="figures six" aria-label="Operations figures">
        <Fig k="offered" label="Contacts offered" value={fmt.int(c.offered!)} delta={<Delta cur={c.offered} prev={p.offered} prevIso={w.prev} neutral />} />
        <Fig k="abandon" label="Abandon rate" value={fmt.pct(c.abandon_rate!)} delta={<Delta cur={c.abandon_rate} prev={p.abandon_rate} prevIso={w.prev} kind="pts" goodWhen="down" />} />
        <Fig k="aht" label="Avg handle time" value={Math.round(c.aht!)} unit="sec" delta={<Delta cur={c.aht} prev={p.aht} prevIso={w.prev} kind="int" unit=" sec" goodWhen="down" />} />
        <Fig k="hold" label="Avg hold" value={Math.round(c.hold!)} unit="sec" delta={<Delta cur={c.hold} prev={p.hold} prevIso={w.prev} kind="int" unit=" sec" goodWhen="down" />} />
        <Fig k="transfer" label="Transfer rate" value={fmt.pct(c.transfer_rate!)} delta={<Delta cur={c.transfer_rate} prev={p.transfer_rate} prevIso={w.prev} kind="pts" goodWhen="down" />} />
        <Fig k="repeat" label="Repeat contacts" value={fmt.pct(c.repeat_rate!)} delta={<Delta cur={c.repeat_rate} prev={p.repeat_rate} prevIso={w.prev} kind="pts" goodWhen="down" />} />
      </section>
      <section className="panel" aria-labelledby="vol-h">
        <SecHead id="vol-h" title={`${attName(att)} weekly volume against forecast`} sub="The queue with the largest abandon-rate rise this month." actions={<DefButton k="fcvar" />} />
        <ForecastChart points={wkPoints(att.weekly)} labels={['Offered', 'Forecast']} />
      </section>
      <div className="cols">
        <section className="panel" aria-labelledby="wk-h">
          <SecHead id="wk-h" title={`Weekly abandon rate in ${attName(att)}`} sub={`Last ${recent.length} weeks.`} />
          <Bars rows={recent.map(x => ['Week of ' + dayLabel(x.week), x.abandon_rate ?? 0])} valueFmt={v => fmt.pct(v)} hot={r => r[1] > 0.08} />
        </section>
        <section className="panel" aria-labelledby="ar-h">
          <SecHead id="ar-h" title="Abandon reasons" sub={`${attName(att)} in ${monthName(w.cur)}.`} />
          <Bars rows={att.reasons} valueFmt={v => String(v)} />
          <SecHead title="Abandon rate by channel" sub={`${filterText({ ...filters, channel: undefined }) || 'All sites'} in ${monthName(w.cur)}. Select one to filter.`} />
          <Bars rows={['Voice', 'Chat', 'Email'].filter(ch => ch in channels).map(ch => [ch, channels[ch]])} valueFmt={v => fmt.pct(v)}
            onPick={channel => toggle({ channel })} active={filters.channel} />
        </section>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Customer Experience */
type CxData = { window: Window; kpis: { cur: Kpis; prev: Kpis }; tnps_monthly: Record<string, Record<string, number>>; detractor_themes: [string, number][] };

export function Cx(_: Nav) {
  const { data, error } = usePage<CxData>('cx');
  if (error) return <PageError title="Customer Experience" message={error} />;
  if (!data) return <PageLoading title="Customer Experience" />;
  const { window: w, kpis: { cur: c, prev: p }, tnps_monthly, detractor_themes: det } = data;
  const months = [...new Set(Object.values(tnps_monthly).flatMap(o => Object.keys(o)))].filter(m => m <= w.cur).sort();
  const entries = Object.entries(tnps_monthly).map(([k, v]) => ({ k, first: v[months[0]], last: v[months[months.length - 1]], prev: v[months[months.length - 2]] }));
  const best = entries.slice().sort((a, b) => (b.last - b.first) - (a.last - a.first))[0]?.k;
  const drop = entries.slice().sort((a, b) => (a.last - a.prev) - (b.last - b.prev))[0]?.k;
  const colors: Record<string, string> = { [best]: 'var(--pine)', [drop]: 'var(--resin)' };
  const series: Series[] = Object.entries(tnps_monthly).map(([k, v]) => ({ name: k.replace('|', ' '), color: colors[k], emph: !!colors[k], values: months.map(m => v[m]) }));
  const detTotal = det.reduce((s, r) => s + r[1], 0);
  return (
    <>
      <div className="page-head"><h1>Customer Experience</h1><p>Post-contact surveys for {monthLabel(w.cur)}. tNPS runs from −100 to +100.</p></div>
      <section className="figures four" aria-label="Survey figures">
        <Fig k="tnps" label="tNPS" value={fmt.nps(c.tnps!)} delta={<Delta cur={c.tnps} prev={p.tnps} prevIso={w.prev} kind="abs" />} />
        <Fig k="promoter" label="Promoters" value={fmt.pct(c.promoter!)} delta={<Delta cur={c.promoter} prev={p.promoter} prevIso={w.prev} kind="pts" />} />
        <Fig k="detractor" label="Detractors" value={fmt.pct(c.detractor!)} delta={<Delta cur={c.detractor} prev={p.detractor} prevIso={w.prev} kind="pts" goodWhen="down" />} />
        <Fig k="rrate" label="Response rate" value={fmt.pct(c.response_rate!)} delta={<Delta cur={c.response_rate} prev={p.response_rate} prevIso={w.prev} kind="pts" />} />
      </section>
      <div className="cols">
        <section className="panel" aria-labelledby="tn-h">
          <SecHead id="tn-h" title={`tNPS by queue, January to ${monthName(w.cur)}`} sub={`Highlighted: the strongest trend this year and the largest drop since ${monthName(w.prev)}.`} />
          <MultiLine series={series} months={months} />
        </section>
        <section className="panel" aria-labelledby="th-h">
          <SecHead id="th-h" title="What detractors mention" sub={`Survey themes on scores of 0 to 6 in ${monthName(w.cur)}.`} />
          <Bars rows={det} valueFmt={v => fmt.pct(v / detTotal, 0)} hot={r => r === det[0]} />
        </section>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Workforce */
type WfData = { window: Window; locked?: true; period: { start: string; end: string }; labor: { cur: Kpis; prev: Kpis }; agents: any[]; under: number;
  under_by_team: [string, number][]; names?: boolean; team_fte: { manager: string; site: string; queue: string; weeks: { week: string; plan: number; sched: number; hc: number }[] } };

export function Workforce({ go }: Nav) {
  const { data, error } = usePage<WfData>('workforce');
  if (error) return <PageError title="Workforce" message={error} />;
  if (!data) return <PageLoading title="Workforce" />;
  if (data.locked) return <LockedPage label="Workforce" onHome={() => go('home')} />;
  const { window: w, period, labor: lab, agents, team_fte: tf } = data;
  return (
    <>
      <div className="page-head"><h1>Workforce</h1><p>Pay period {dayLabel(period.start)} to {dayLabel(period.end)}, {period.end.slice(0, 4)}. Utilization is handle hours over paid hours, and below 0.50 is under-utilized.</p></div>
      <section className="figures three" aria-label="Workforce figures">
        <Fig k="util" label="Utilization" value={fmt.pct(lab.cur.util!)} delta={<Delta cur={lab.cur.util} prev={lab.prev.util} prevIso={w.prev} kind="pts" />} />
        <Fig k="under" label="Under-utilized agents" value={data.under} unit={`of ${agents.length}`} delta={<span className="delta flat">This pay period</span>} />
        <Fig k="occ" label="Occupancy" value={fmt.pct(lab.cur.occ!)} delta={<Delta cur={lab.cur.occ} prev={lab.prev.occ} prevIso={w.prev} kind="pts" />} />
      </section>
      <div className="cols">
        <section className="panel" aria-labelledby="fte-h">
          <SecHead id="fte-h" title={`${tf.site} ${tf.queue} staffing against plan`} sub={`Weekly FTE scheduled on Production for ${data.names ? `${tf.manager}'s team` : `team ${tf.manager}`}, the team with the most under-utilized agents.`} />
          <ForecastChart height={220} gap="wash" yFmt={v => v.toFixed(1)} labels={['Scheduled', 'Plan']}
            points={tf.weeks.map(x => ({ a: x.sched, p: x.plan, label: dayLabel(x.week), tip: [['Scheduled FTE', x.sched.toFixed(2)], ['Plan FTE', x.plan.toFixed(2)], ['Agents', String(x.hc)]] }))} />
        </section>
        <section className="panel" aria-labelledby="um-h">
          <SecHead id="um-h" title="Under-utilized agents by team" sub="Teams with at least one agent below 0.50." />
          <Bars rows={data.under_by_team} valueFmt={v => String(v)} hot={r => r === data.under_by_team[0]} />
        </section>
      </div>
      <section className="panel" aria-labelledby="ag-h">
        <SecHead id="ag-h" title="Agents this pay period"
          sub={data.names ? undefined : <span className="lockline-inline"><Icon id="i-lock" />Agent and manager names are HR only. Showing employee IDs.</span>} />
        <Table sortKey="util" desc={false} rows={agents} cols={[
          { key: 'name', label: data.names ? 'Agent' : 'Agent ID', text: true },
          { key: 'mgr', label: data.names ? 'Team' : 'Manager ID', text: true },
          { key: 'prof', label: 'Proficiency', text: true },
          { key: 'util', label: 'Utilization', render: r => <span className={'pill ' + (r.util < 0.5 ? 'low' : 'ok')}>{fmt.pct(r.util)}</span> },
          { key: 'paid', label: 'Paid hours', render: r => r.paid.toFixed(1) },
          { key: 'handle', label: 'Handle hours', render: r => r.handle.toFixed(1) },
          { key: 'train', label: 'Training hours', render: r => Math.round(r.train) },
          { key: 'ot_h', label: 'Overtime hours', render: r => Math.round(r.ot_h) },
        ]} />
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- Labor Cost */
type LaborData = { window: Window; locked?: true; labor: { cur: Kpis; prev: Kpis; cpc_months: [string, number][] }; periods: { ps: string; cost: number; planned: number; ot: number }[] };

export function Labor({ go }: Nav) {
  const { data, error } = usePage<LaborData>('labor');
  if (error) return <PageError title="Labor Cost" message={error} />;
  if (!data) return <PageLoading title="Labor Cost" />;
  if (data.locked) return <LockedPage label="Labor Cost" onHome={() => go('home')} />;
  const { window: w, labor: { cur: c, prev: p, cpc_months }, periods } = data;
  const curM = w.cur.slice(0, 7);
  return (
    <>
      <div className="page-head"><h1>Labor Cost</h1><p>Agent pay for pay periods starting in {monthLabel(w.cur)}. Planned pay is scheduled Production hours times the hourly rate.</p></div>
      <section className="figures four" aria-label="Labor figures">
        <Fig k="cost" label="Labor cost" value={fmt.usd(c.cost!)} delta={<Delta cur={c.cost} prev={p.cost} prevIso={w.prev} goodWhen="down" />} />
        <Fig k="planpay" label="Against wage plan" value={(c.cost! >= c.planned! ? '+' : '−') + fmt.pct(Math.abs(c.cost! - c.planned!) / c.planned!)} delta={<span className="delta flat">{fmt.usd(c.planned!)} planned</span>} />
        <Fig k="ot" label="Overtime pay" value={fmt.usd(c.ot!)} delta={<span className="delta flat">{fmt.pct(c.ot! / c.cost!)} of pay<span>{fmt.usd(p.ot ?? 0)} in {MONTHS[Number(w.prev.slice(5, 7)) - 1]}</span></span>} />
        <Fig k="cpc" label="Cost per contact" value={fmt.usd2(c.cpc!)} delta={<Delta cur={c.cpc} prev={p.cpc} prevIso={w.prev} goodWhen="down" />} />
      </section>
      <section className="panel" aria-labelledby="pay-h">
        <SecHead id="pay-h" title="Pay against the wage plan by pay period" sub={`Last ${periods.length} pay periods.`} />
        <ForecastChart labels={['Actual', 'Plan']} yFmt={v => '$' + Math.round(v / 1000) + 'k'} yMin={Math.floor(Math.min(...periods.map(x => Math.min(x.cost, x.planned))) * 0.8 / 5000) * 5000}
          points={periods.map(x => ({ a: x.cost, p: x.planned, label: dayLabel(x.ps), tip: [['Actual', fmt.usd(x.cost)], ['Plan', fmt.usd(x.planned)], ['Overtime', fmt.usd(x.ot)]] }))} />
      </section>
      <section className="panel" aria-labelledby="cpc-h">
        <SecHead id="cpc-h" title="Cost per handled contact" sub={`Last ${Math.min(6, cpc_months.length)} months.`} />
        <Bars rows={cpc_months.slice(-6).map(([m, v]) => [MONTHS[Number(m.slice(5, 7)) - 1] + ' ' + m.slice(0, 4), v])} valueFmt={v => fmt.usd2(v)}
          max={Math.max(...cpc_months.map(x => x[1])) * 1.1} hot={r => r[0] === MONTHS[Number(curM.slice(5, 7)) - 1] + ' ' + curM.slice(0, 4)} />
      </section>
    </>
  );
}
