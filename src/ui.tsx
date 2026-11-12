import { DRILLS, useView } from './view';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFS } from './defs';
import { MONTHS } from './format';

export function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <symbol id="i-home" viewBox="0 0 20 20"><path d="M3.5 8.5 10 3.5l6.5 5V16a.5.5 0 0 1-.5.5h-3.5v-4.5h-5v4.5H4a.5.5 0 0 1-.5-.5Z" /></symbol>
      <symbol id="i-ops" viewBox="0 0 20 20"><path d="M4 11V9.5a6 6 0 0 1 12 0V11" /><rect x="3" y="11" width="3.5" height="5" rx="1" /><rect x="13.5" y="11" width="3.5" height="5" rx="1" /><path d="M15.25 16v.5a2 2 0 0 1-2 2H11" /></symbol>
      <symbol id="i-cx" viewBox="0 0 20 20"><path d="M4 4.5h12a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1H9l-3.5 2.5V14H4a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1Z" /><path d="M7.5 9.5c.7 1 1.5 1.5 2.5 1.5s1.8-.5 2.5-1.5" /></symbol>
      <symbol id="i-team" viewBox="0 0 20 20"><circle cx="7.5" cy="7" r="2.75" /><path d="M2.75 16c.5-2.6 2.3-4 4.75-4s4.25 1.4 4.75 4" /><circle cx="14" cy="7.5" r="2.25" /><path d="M13.5 12c2 0 3.4 1.2 3.8 3.5" /></symbol>
      <symbol id="i-cost" viewBox="0 0 20 20"><path d="M5 3.5h10v13l-2-1.25-1.5 1.25L10 15.25 8.5 16.5 7 15.25 5 16.5Z" /><path d="M7.75 7.5h4.5M7.75 10.5h4.5" /></symbol>
      <symbol id="i-lock" viewBox="0 0 20 20"><rect x="4.5" y="9" width="11" height="8" rx="2" /><path d="M7 9V6.75a3 3 0 0 1 6 0V9" /></symbol>
      <symbol id="i-key" viewBox="0 0 20 20"><circle cx="7" cy="12.5" r="3.5" /><path d="M9.5 10 15.5 4M13 6.5l2 2M14.5 5l1.5 1.5" /></symbol>
      <symbol id="i-info" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" /><path d="M10 9v4.5M10 6.6v.1" /></symbol>
      <symbol id="i-cal" viewBox="0 0 20 20"><rect x="3.5" y="4.5" width="13" height="12" rx="2" /><path d="M3.5 8.5h13M7 3v3M13 3v3" /></symbol>
      <symbol id="i-up" viewBox="0 0 12 12"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" /></symbol>
      <symbol id="i-down" viewBox="0 0 12 12"><path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" /></symbol>
      <symbol id="i-sort" viewBox="0 0 12 12"><path d="M4 4.5 6 2.5l2 2M4 7.5l2 2 2-2" /></symbol>
      <symbol id="i-close" viewBox="0 0 20 20"><path d="m5.5 5.5 9 9M14.5 5.5l-9 9" /></symbol>
      <symbol id="i-send" viewBox="0 0 20 20"><path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" /></symbol>
      <symbol id="i-arrow" viewBox="0 0 20 20"><path d="M4.5 10h11M11 5.5l4.5 4.5-4.5 4.5" /></symbol>
      <symbol id="i-moon" viewBox="0 0 20 20"><path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z" /></symbol>
      <symbol id="i-ask" viewBox="0 0 20 20"><path d="M10 3.5a6.5 6.5 0 1 0 5.6 9.8" /><path d="M10 6.5a3.5 3.5 0 1 0 3 5.3" /><circle cx="10" cy="10" r=".9" fill="currentColor" stroke="none" /></symbol>
      <symbol id="mark" viewBox="0 0 32 32">
        <path d="M25.95 9.29A12 12 0 1 0 25.95 22.71" fill="none" stroke="var(--pine)" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M21.52 11.69A7 7 0 1 0 21.52 20.31" fill="none" stroke="var(--pine)" strokeWidth="2.6" strokeLinecap="round" opacity=".72" />
        <circle cx="16" cy="16" r="2.6" fill="var(--resin)" />
      </symbol>
    </defs></svg>
  );
}

export const Icon = ({ id, className = 'icon' }: { id: string; className?: string }) => <svg className={className} aria-hidden="true"><use href={`#${id}`} /></svg>;

/** The only loading indicator: the mark's two arcs turn in opposite directions around the resin knot. */
export function Loader({ size = 64 }: { size?: number }) {
  return (
    <svg className="loader" style={{ ['--ld' as string]: `${size}px` }} viewBox="0 0 32 32" role="img" aria-label="Loading">
      <path className="ld-outer" d="M25.95 9.29A12 12 0 1 0 25.95 22.71" fill="none" stroke="var(--pine)" strokeWidth="2.6" strokeLinecap="round" />
      <path className="ld-inner" d="M21.52 11.69A7 7 0 1 0 21.52 20.31" fill="none" stroke="var(--pine)" strokeWidth="2.6" strokeLinecap="round" opacity=".72" />
      <circle className="ld-knot" cx="16" cy="16" r="2.6" fill="var(--resin)" />
    </svg>
  );
}

/* Definition popover, shared across the app. */
const DefCtx = createContext<(key: string, anchor: HTMLElement) => void>(() => {});
export function DefProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<{ key: string; x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest('.def-btn')) setOpen(null);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, []);
  const show = (key: string, a: HTMLElement) => { const r = a.getBoundingClientRect(); setOpen({ key, x: r.left - 12, y: r.bottom + 8 }); };
  const d = open && DEFS[open.key];
  return (
    <DefCtx.Provider value={show}>
      {children}
      {d && open && (
        <div className="pop" ref={ref} role="dialog" style={{ left: Math.min(window.innerWidth - 376, Math.max(16, open.x)), top: Math.min(open.y, window.innerHeight - 220) }}>
          <h3>{d.name}</h3><p>{d.def}</p><div className="calc">{d.calc}</div>
          <div className="meta"><span>Unity Catalog Page in Cedar Care, {d.domain}</span>{d.url ? <a href={d.url} target="_blank" rel="noreferrer">Open Page</a> : null}</div>
        </div>
      )}
    </DefCtx.Provider>
  );
}
export function DefButton({ k }: { k: string }) {
  const show = useContext(DefCtx);
  return <button className="def-btn" type="button" aria-label={`Definition of ${DEFS[k]?.name}`} onClick={e => show(k, e.currentTarget)}><Icon id="i-info" /></button>;
}

/** Change against the previous month: arrow plus value. Color says whether the change is good. */
export function Delta({ cur, prev, prevIso, kind = 'pct', goodWhen = 'up', unit = '', neutral = false }:
  { cur?: number; prev?: number; prevIso: string; kind?: 'pct' | 'pts' | 'abs' | 'int'; goodWhen?: 'up' | 'down'; unit?: string; neutral?: boolean }) {
  const vs = <span>vs {MONTHS[Number(prevIso.slice(5, 7)) - 1]}</span>;
  if (cur == null || prev == null) return <span className="delta flat">No {MONTHS[Number(prevIso.slice(5, 7)) - 1]} data</span>;
  let d: number, text: string;
  if (kind === 'pts') { d = (cur - prev) * 100; text = Math.abs(d).toFixed(1) + ' pts'; }
  else if (kind === 'abs') { d = cur - prev; text = Math.abs(d).toFixed(1) + unit; }
  else if (kind === 'int') { d = cur - prev; text = Math.abs(Math.round(d)) + unit; }
  else { d = (cur - prev) / prev; text = Math.abs(d * 100).toFixed(1) + '%'; }
  if (Math.abs(d) < 1e-9) return <span className="delta flat">No change{vs}</span>;
  const cls = neutral ? 'flat' : (d > 0) === (goodWhen === 'up') ? 'good' : 'bad';
  return <span className={'delta ' + cls}><Icon id={d > 0 ? 'i-up' : 'i-down'} />{text}{vs}</span>;
}

export function Fig({ k, label, value, unit, delta, locked }: { k: string; label: string; value?: ReactNode; unit?: string; delta?: ReactNode; locked?: boolean }) {
  if (locked) return <div className="fig locked"><div className="fig-label">{label}<DefButton k={k} /></div><div className="lockline"><Icon id="i-lock" />Finance and HR</div></div>;
  const { drill } = useView();
  const body = <><div className="fig-num">{value}{unit ? <small>{unit}</small> : null}</div>{delta}</>;
  return (
    <div className="fig"><div className="fig-label">{label}<DefButton k={k} /></div>
      {DRILLS[k] ? <button type="button" className="fig-open" title={`${label} by month and by site and queue`} onClick={() => drill(k, label)}>{body}</button> : body}
    </div>
  );
}

export function SecHead({ title, sub, id, actions, flag }: { title: ReactNode; sub?: ReactNode; id?: string; actions?: ReactNode; flag?: string }) {
  return (
    <div className="sec-head">
      <div>{flag && <span className="flag"><i />{flag}</span>}<h2 id={id}>{title}</h2>{sub && <p>{sub}</p>}</div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

export function LockedPage({ label, onHome }: { label: string; onHome: () => void }) {
  return (
    <>
      <div className="page-head"><h1>{label}</h1></div>
      <section className="panel"><div className="locked-page">
        <div className="seal"><Icon id="i-lock" /></div>
        <h2>Visible to Finance and HR</h2>
        <p>This page reads <code>dbrks_app_poc.finance</code>, and your account does not have access to it. Unity Catalog makes this decision, not the app.</p>
        <p>Ask your data admin to add you to <b>cedar_finance</b> if you need it.</p>
        <button className="btn" type="button" onClick={onHome}>Back to Home</button>
      </div></section>
    </>
  );
}

export function PageLoading({ title }: { title: string }) {
  return <><div className="page-head"><h1>{title}</h1></div><div className="page-loading"><Loader size={64} /></div></>;
}

export function PageError({ title, message }: { title: string; message: string }) {
  return <><div className="page-head"><h1>{title}</h1></div><div className="error-note">{message}</div></>;
}
