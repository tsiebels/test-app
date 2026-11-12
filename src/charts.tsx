import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { esc, fmt } from './format';

/** Measures its own width so charts are drawn at real pixel size and text stays at its set size. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceMax(v: number) { const p = Math.pow(10, Math.floor(Math.log10(v || 1))); return Math.ceil(v / p * 2) / 2 * p; }

export type PlanPoint = { a: number; p: number; label: string; tip: [string, string][] };

/** Signature chart: plan dashed, actual solid and drawn on mount, resin where actual breaks above plan. Lines labeled at their end. */
export function ForecastChart({ points, labels, height = 230, yFmt = fmt.int, yMin = 0, gap = 'resin' }:
  { points: PlanPoint[]; labels: [string, string]; height?: number; yFmt?: (v: number) => string; yMin?: number; gap?: 'resin' | 'wash' }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const drawn = useRef(false);
  useEffect(() => { if (W) drawn.current = true; }, [W]);
  const id = useRef('c' + Math.random().toString(36).slice(2)).current;
  if (points.length < 2) return <div ref={ref} className="empty">Not enough data to draw this chart.</div>;
  const H = height, L = 44, R = 92, T = 12, B = 26;
  const max = niceMax(Math.max(...points.map(p => Math.max(p.a, p.p))) * 1.08);
  const x = (i: number) => L + (W - L - R) * i / (points.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - (v - yMin) / (max - yMin));
  const line = (k: 'a' | 'p') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
  const gapPath = line('a') + points.slice().reverse().map((p, j) => `L${x(points.length - 1 - j).toFixed(1)},${y(p.p).toFixed(1)}`).join('') + 'Z';
  const above = `M${x(0)},${T - 30}` + points.map((p, i) => `L${x(i).toFixed(1)},${y(p.p).toFixed(1)}`).join('') + `L${x(points.length - 1)},${T - 30}Z`;
  const ticks = [0, .5, 1].map(f => yMin + (max - yMin) * f);
  const every = Math.ceil(points.length / Math.max(2, Math.floor((W - L - R) / 100)));
  const last = points.length - 1, la = y(points[last].a), lp = y(points[last].p);
  const sep = Math.abs(la - lp) < 16 ? (la < lp ? [-8, 8] : [8, -8]) : [0, 0];
  const animate = !drawn.current;
  const op = gap === 'resin' ? .32 : 1;
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * W;
    setHover(Math.max(0, Math.min(last, Math.round((px - L) / (W - L - R) * last))));
  };
  return (
    <div className="chart-wrap" ref={ref}>
      {W > 0 && (
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${labels[0]} against ${labels[1]}`}>
          <defs><clipPath id={id}><path d={above} /></clipPath></defs>
          <g className="grid">{ticks.map(t => <line key={t} x1={L} x2={W - R + 8} y1={y(t)} y2={y(t)} />)}</g>
          {ticks.map(t => <text key={'t' + t} x={L - 8} y={y(t) + 4} textAnchor="end">{yFmt(t)}</text>)}
          {points.map((p, i) => ((i % every === 0 && last - i >= every * 0.6) || i === last) &&
            <text key={'x' + i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'}>{p.label}</text>)}
          <path className={'gapfill' + (animate ? ' draw-in' : '')} style={{ ['--o' as string]: op }} d={gapPath}
            fill={gap === 'resin' ? 'var(--resin)' : 'var(--pine-wash)'} opacity={op} clipPath={`url(#${id})`} />
          <path d={line('p')} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeDasharray="5 4" />
          <path className={animate ? 'draw' : ''} pathLength={1} d={line('a')} fill="none" stroke="var(--pine)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last)} cy={la} r={4} fill="var(--pine)" />
          <text className="lbl" x={x(last) + 10} y={la + 4 + sep[0]} style={{ fill: 'var(--pine)' }}>{labels[0]}</text>
          <text className="lbl" x={x(last) + 10} y={lp + 4 + sep[1]} style={{ fill: 'var(--ink-3)' }}>{labels[1]}</text>
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--ink)" strokeWidth={1} />}
          <rect x={L} y={T} width={Math.max(0, W - L - R)} height={H - T - B} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hover !== null && W > 0 && (
        <div className="tip" style={{ left: x(hover), top: 0 }}>
          <b>{points[hover].label}</b>
          {points[hover].tip.map(([k, v]) => <div key={k}><span>{k}</span>{v}</div>)}
        </div>
      )}
    </div>
  );
}

export type Series = { name: string; color?: string; emph: boolean; values: number[] };

export function MultiLine({ series, months, height = 250, valueFmt = fmt.nps, tickFmt = (v: number) => String(Math.round(v)), label = 'Monthly tNPS by queue' }:
  { series: Series[]; months: string[]; height?: number; valueFmt?: (v: number) => string; tickFmt?: (v: number) => string; label?: string }) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const all = series.flatMap(s => s.values).filter(v => v != null);
  if (!all.length || months.length < 2) return <div ref={ref} className="empty">No survey data for this period.</div>;
  const lo = Math.min(...all), hi = Math.max(...all), step = Math.pow(10, Math.floor(Math.log10((hi - lo) || Math.abs(hi) || 1)));
  const yMin = Math.floor(lo / step) * step, yMax = Math.ceil(hi / step) * step;
  const H = height, L = 52, R = 176, T = 10, B = 26;
  const x = (i: number) => L + (W - L - R) * i / (months.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - (v - yMin) / (yMax - yMin || 1));
  const ticks = [yMin, (yMin + yMax) / 2, yMax];
  const ordered = series.slice().sort((a, b) => Number(a.emph) - Number(b.emph));
  const labels = series.filter(s => s.emph).map(s => ({ s, ly: y(s.values[s.values.length - 1]) })).sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < labels.length; i++) if (labels[i].ly - labels[i - 1].ly < 16) labels[i].ly = labels[i - 1].ly + 16;
  const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return (
    <div ref={ref}>
      {W > 0 && (
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
          <g className="grid">{ticks.map(t => <line key={t} x1={L} x2={W - R} y1={y(t)} y2={y(t)} />)}</g>
          {ticks.map(t => <text key={'t' + t} x={L - 8} y={y(t) + 4} textAnchor="end">{tickFmt(t)}</text>)}
          {months.map((m, i) => <text key={m} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : 'middle'}>{MONTH[Number(m.slice(5, 7)) - 1]}</text>)}
          {ordered.map(s => <path key={s.name} className={s.emph ? 'draw' : ''} pathLength={1}
            d={s.values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')}
            fill="none" stroke={s.emph ? s.color : 'var(--line-2)'} strokeWidth={s.emph ? 2.5 : 1.2} strokeLinejoin="round" strokeLinecap="round" />)}
          {labels.map(({ s, ly }) => (
            <g key={'l' + s.name}>
              <circle cx={x(s.values.length - 1)} cy={y(s.values[s.values.length - 1])} r={3.5} fill={s.color} />
              <text className="lbl" x={x(s.values.length - 1) + 10} y={ly + 4} style={{ fill: s.color }}>{s.name} {valueFmt(s.values[s.values.length - 1])}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

export function Bars({ rows, valueFmt, max, hot = () => false, onPick, active }:
  { rows: [string, number][]; valueFmt: (v: number) => string; max?: number; hot?: (r: [string, number]) => boolean; onPick?: (label: string) => void; active?: string }) {
  if (!rows.length) return <div className="empty">No data for this period.</div>;
  const m = max || Math.max(...rows.map(r => r[1])) || 1;
  return (
    <div className="bars">
      {rows.map(r => (
        <div className={'bar-row' + (onPick ? ' pick' : '') + (active === r[0] ? ' on' : '')} key={r[0]}
          {...(onPick ? { role: 'button', tabIndex: 0, 'aria-pressed': active === r[0], title: `Filter to ${r[0]}`, onClick: () => onPick(r[0]),
            onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r[0]); } } } : {})}>
          <span>{r[0]}</span>
          <div className="track"><div className={'fill' + (hot(r) ? ' hot' : '')} style={{ width: `${Math.min(100, r[1] / m * 100).toFixed(1)}%` }} /></div>
          <span className="v">{valueFmt(r[1])}</span>
        </div>
      ))}
    </div>
  );
}

export { esc };
