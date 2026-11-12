import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getJSON, PersonaSwitch, type Context } from './api';
import { monthLabel } from './format';
import { Cx, Home, Labor, Ops, Workforce } from './pages';
import { DefProvider, Icon, PageError, PageLoading, Sprite } from './ui';
import { FilterChips, MonthPicker, ViewProvider } from './view';

const PAGES = [
  { id: 'home', label: 'Home', icon: 'i-home', finance: false },
  { id: 'ops', label: 'Contact Operations', icon: 'i-ops', finance: false },
  { id: 'cx', label: 'Customer Experience', icon: 'i-cx', finance: false },
  { id: 'workforce', label: 'Workforce', icon: 'i-team', finance: true },
  { id: 'labor', label: 'Labor Cost', icon: 'i-cost', finance: true },
];

/** Tree rings in the rail: crisp vector rings from a center beyond the bottom-left corner, one in resin. */
function Rings() {
  const ref = useRef<SVGSVGElement>(null);
  const [h, setH] = useState(window.innerHeight);
  useLayoutEffect(() => { const on = () => setH(window.innerHeight); addEventListener('resize', on); return () => removeEventListener('resize', on); }, []);
  const W = 260, H = Math.max(400, h);
  let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const cx = -230, cy = H + 40, tilt = -20 * Math.PI / 180, aspect = .9;
  const waves = [1, 2, 3, 5].map(k => ({ k, p: r() * 6.28, a: .5 + r() * 1.2 }));
  const paths: { d: string; hot: boolean }[] = [];
  let rad = 190;
  for (let i = 0; i < 80; i++) {
    rad += 13 + r() * 15;
    const pts: string[] = []; let minY = Infinity;
    for (let t = 0; t <= 140; t++) {
      const a = t / 140 * Math.PI * 2, wob = waves.reduce((acc, w) => acc + Math.sin(a * w.k + w.p + i * .07) * w.a, 0) * (1 + i * .1);
      const ex = Math.cos(a) * (rad + wob), ey = Math.sin(a) * (rad + wob) * aspect;
      const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
      minY = Math.min(minY, y); pts.push(x.toFixed(1) + ',' + y.toFixed(1));
    }
    if (minY < 6) break;
    paths.push({ d: 'M' + pts.join('L') + 'Z', hot: i === 9 });
  }
  return (
    <svg className="deco" ref={ref} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      {paths.map((p, i) => <path key={i} d={p.d} fill="none" stroke={p.hot ? 'var(--resin)' : 'var(--pine)'} strokeWidth={p.hot ? 1.2 : .85} opacity={p.hot ? .5 : .22} />)}
    </svg>
  );
}

const PERSONA_NOTE = { Ops: 'Contact-center data', Finance: 'Adds labor cost and workforce', HR: 'All data, including people' };

export default function App() {
  const [ctx, setCtx] = useState<Context | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [page, setPage] = useState(() => PAGES.some(p => p.id === location.hash.slice(1)) ? location.hash.slice(1) : 'home');
  const [suppress, setSuppress] = useState(false);

  useEffect(() => { getJSON<Context>('context').then(setCtx, e => setCtxError(e.message)); }, []);
  useEffect(() => { history.replaceState(null, '', location.search + '#' + page); window.scrollTo({ top: 0 }); }, [page]);

  const go = (id: string) => setPage(id);
  const finance = ctx?.access.finance ?? false;
  const title = ctx ? monthLabel(ctx.window.cur) : '';
  const Page = { home: Home, ops: Ops, cx: Cx, workforce: Workforce, labor: Labor }[page] ?? Home;

  return (
    <DefProvider><ViewProvider>
      <Sprite />
      <aside className={"rail" + (suppress ? " suppress" : "")} aria-label="Main" onMouseLeave={() => setSuppress(false)}>
        <Rings />
        <div className="brand">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path className="mk-o" d="M25.95 9.29A12 12 0 1 0 25.95 22.71" fill="none" stroke="var(--pine)" strokeWidth="2.6" strokeLinecap="round" />
            <path className="mk-i" d="M21.52 11.69A7 7 0 1 0 21.52 20.31" fill="none" stroke="var(--pine)" strokeWidth="2.6" strokeLinecap="round" opacity=".72" />
            <circle cx="16" cy="16" r="2.6" fill="var(--resin)" />
          </svg>
          <b className="fade">Cedar Care</b>
        </div>
        <nav className="nav">
          {PAGES.map(p => (
            <button key={p.id} type="button" title={p.label} aria-current={p.id === page ? 'page' : undefined} onClick={e => { go(p.id); setSuppress(true); e.currentTarget.blur(); }}>
              <Icon id={p.icon} /><span className="fade">{p.label}</span>{p.finance && ctx && !finance && <Icon id="i-lock" className="icon lock-badge fade" />}
            </button>
          ))}
        </nav>
        {ctx && (
          <div className="plaque">
            <Icon id={finance ? 'i-key' : 'i-lock'} />
            <div className="fade"><b>Viewing as {ctx.persona}</b><span>{PERSONA_NOTE[ctx.persona]}</span></div>
          </div>
        )}
        <div className="rail-foot">
          <button className="theme-btn" type="button" onClick={() => {
            const root = document.documentElement;
            const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
            root.dataset.theme = dark ? 'light' : 'dark';
            try { localStorage.setItem('cc-theme', root.dataset.theme); } catch { /* storage unavailable */ }
          }}><Icon id="i-moon" /><span className="fade">Switch theme</span></button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {ctx?.window.months?.length ? <MonthPicker months={ctx.window.months} fallback={ctx.window.cur} /> : <span className="select" title="Reporting period"><Icon id="i-cal" />{title || 'Loading'}</span>}
          <FilterChips />
          <div className="tools">
            <PersonaSwitch />
          </div>
        </header>
        <main className="content" tabIndex={-1}>
          {ctxError ? <PageError title="Cedar Care" message={ctxError} /> : !ctx ? <PageLoading title={title} /> : <Page key={page} go={go} />}
        </main>
      </div>

    </ViewProvider></DefProvider>
  );
}
