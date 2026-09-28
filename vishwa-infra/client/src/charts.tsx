import React, { useId, useLayoutEffect, useRef, useState } from 'react';
import { moneyCompact, money } from './lib';

/* ───────────── helpers ───────────── */
function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => setW(Math.floor(entries[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}
const useUid = () => useId().replace(/[^a-zA-Z0-9]/g, '');

/** Rounds a max value up to a "nice" number that divides cleanly into 4 gridlines. */
function niceMax(v: number): number {
  if (v <= 0) return 4;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 4 ? 4 : n <= 8 ? 8 : 10;
  return m * p;
}

/** Monotone cubic interpolation — smooth curves that never overshoot below zero. */
function smoothPath(pts: [number, number][]): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0] || 1; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i]; }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export type Series = { name: string; color: string; values: number[] };

function Tip({ x, w, title, rows }: { x: number; w: number; title: string; rows: { name: string; color: string; value: number }[] }) {
  const left = Math.min(Math.max(x, 78), Math.max(78, w - 78));
  return (
    <div className="chart-tip" style={{ left }}>
      <b>{title}</b>
      {rows.map((r) => (<span key={r.name}><i style={{ background: r.color }} />{r.name}<strong>{money(r.value)}</strong></span>))}
    </div>
  );
}

/* ───────────── Chart skeleton (loading placeholder) ───────────── */
/** Shimmering placeholder shaped like an area/column chart, so a chart card
 *  reads as "loading" rather than briefly flashing its real empty state
 *  (e.g. "Your revenue trend will appear here…") while data is in flight. */
export function ChartSkeleton({ height = 290, bars = 12 }: { height?: number; bars?: number }) {
  const heights = React.useMemo(() => Array.from({ length: bars }, (_, i) => 28 + ((i * 37) % 60)), [bars]);
  return (
    <div className="chart chart-skel" style={{ height }} aria-hidden="true">
      <div className="chart-skel-axis" />
      <div className="chart-skel-bars">
        {heights.map((h, i) => (
          <div key={i} className="chart-skel-bar" style={{ height: `${h}%`, animationDelay: `${i * 45}ms` }} />
        ))}
      </div>
    </div>
  );
}

/* ───────────── Area chart ───────────── */
export function AreaChart({ labels, series, height = 290 }: { labels: string[]; series: Series[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const uid = useUid();
  const pad = { l: 56, r: 16, t: 14, b: 30 };
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b, n = labels.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const empty = series.every((s) => s.values.every((v) => !v));
  const skip = w < 520 && n > 8 ? 2 : 1;
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img">
          <defs>
            {series.map((s, k) => (
              <linearGradient key={k} id={`${uid}g${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 0.32 }} />
                <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0 }} />
              </linearGradient>
            ))}
          </defs>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + iw} y1={y((max * i) / 4)} y2={y((max * i) / 4)} className={i === 0 ? 'axis' : 'grid'} />
              <text x={pad.l - 10} y={y((max * i) / 4) + 4} textAnchor="end" className="tick">{moneyCompact((max * i) / 4)}</text>
            </g>
          ))}
          {labels.map((l, i) => (i % skip === 0 ? <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="tick">{l}</text> : null))}
          {series.map((s, k) => {
            const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number]);
            const line = smoothPath(pts);
            const area = `${line}L${x(n - 1)},${y(0)}L${x(0)},${y(0)}Z`;
            return (
              <g key={`${k}-${n}`}>
                <path d={area} fill={`url(#${uid}g${k})`} className="area-in" />
                <path d={line} fill="none" style={{ stroke: s.color }} strokeWidth={2.6} strokeLinecap="round" pathLength={1} className="line-draw" />
              </g>
            );
          })}
          {hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="cross" />
              {series.map((s, k) => (<circle key={k} cx={x(hover)} cy={y(s.values[hover])} r={5} style={{ stroke: s.color }} className="dot" />))}
            </g>
          )}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {empty && <div className="chart-empty">Your revenue trend will appear here once you create invoices.</div>}
      {hover !== null && w > 0 && <Tip x={x(hover)} w={w} title={labels[hover]} rows={series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover] }))} />}
    </div>
  );
}

/* ───────────── Grouped column chart ───────────── */
export function ColumnChart({ labels, series, height = 290 }: { labels: string[]; series: Series[]; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const uid = useUid();
  const pad = { l: 56, r: 12, t: 14, b: 30 };
  const max = niceMax(Math.max(0, ...series.flatMap((s) => s.values)));
  const iw = Math.max(10, w - pad.l - pad.r), ih = height - pad.t - pad.b, n = labels.length;
  const gw = iw / n, bw = Math.max(4, Math.min(20, (gw * 0.7) / series.length));
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const cx = (i: number) => pad.l + gw * i + gw / 2;
  const skip = w < 560 && n > 8 ? 2 : 1;
  const empty = series.every((s) => s.values.every((v) => !v));
  return (
    <div className="chart" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img">
          <defs>
            {series.map((s, k) => (
              <linearGradient key={k} id={`${uid}c${k}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: s.color, stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: s.color, stopOpacity: 0.55 }} />
              </linearGradient>
            ))}
          </defs>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line x1={pad.l} x2={pad.l + iw} y1={y((max * i) / 4)} y2={y((max * i) / 4)} className={i === 0 ? 'axis' : 'grid'} />
              <text x={pad.l - 10} y={y((max * i) / 4) + 4} textAnchor="end" className="tick">{moneyCompact((max * i) / 4)}</text>
            </g>
          ))}
          {hover !== null && <rect x={pad.l + gw * hover} y={pad.t} width={gw} height={ih} className="col-hover" rx={8} />}
          {labels.map((l, i) => (
            <g key={i}>
              {i % skip === 0 && <text x={cx(i)} y={height - 8} textAnchor="middle" className="tick">{l}</text>}
              {series.map((s, k) => {
                const v = s.values[i], bh = Math.max(v > 0 ? 3 : 0, (v / max) * ih);
                const bx = cx(i) - (bw * series.length + 3 * (series.length - 1)) / 2 + k * (bw + 3);
                return <rect key={k} x={bx} y={pad.t + ih - bh} width={bw} height={bh} rx={Math.min(5, bw / 2)} fill={`url(#${uid}c${k})`} className="bar-grow" style={{ animationDelay: `${i * 28}ms` }} />;
              })}
            </g>
          ))}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent"
            onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n)))); }}
            onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {empty && <div className="chart-empty">No invoices or payments in the last 12 months.</div>}
      {hover !== null && w > 0 && <Tip x={cx(hover)} w={w} title={labels[hover]} rows={series.map((s) => ({ name: s.name, color: s.color, value: s.values[hover] }))} />}
    </div>
  );
}

/* ───────────── Sparkline ───────────── */
export function Sparkline({ values, color = 'var(--c1)', height = 44 }: { values: number[]; color?: string; height?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const uid = useUid();
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const x = (i: number) => 2 + (i * Math.max(1, w - 8)) / Math.max(1, values.length - 1);
  const y = (v: number) => (max === min ? height / 2 : height - 6 - ((v - min) / span) * (height - 12));
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const line = smoothPath(pts);
  return (
    <div className="spark" ref={ref} style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height}>
          <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" style={{ stopColor: color, stopOpacity: 0.28 }} /><stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} /></linearGradient></defs>
          <path d={`${line}L${x(values.length - 1)},${height}L${x(0)},${height}Z`} fill={`url(#${uid})`} className="area-in" />
          <path d={line} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinecap="round" pathLength={1} className="line-draw" />
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={3.2} style={{ fill: color }} className="pulse-dot" />
        </svg>
      )}
    </div>
  );
}

/* ───────────── Donut ───────────── */
export type Slice = { label: string; value: number; color: string; sub?: string };
export function Donut({ data, size = 176, thickness = 20, centerLabel, centerValue, valueFormat = moneyCompact, showValue = true }: {
  data: Slice[]; size?: number; thickness?: number; centerLabel?: string; centerValue?: string; valueFormat?: (n: number) => string; showValue?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = (size - thickness) / 2, c = 2 * Math.PI * r, gap = data.filter((d) => d.value > 0).length > 1 ? 3 : 0;
  let acc = 0;
  const active = hover !== null ? data[hover] : null;
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size / 2} cy={size / 2} r={r} className="donut-track" strokeWidth={thickness} fill="none" />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {total > 0 && data.map((d, i) => {
              const len = (d.value / total) * c;
              const seg = (
                <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={hover === i ? thickness + 4 : thickness}
                  style={{ stroke: d.color, transition: 'stroke-width .2s' }} strokeLinecap="butt"
                  strokeDasharray={`${Math.max(0, len - gap)} ${c}`} strokeDashoffset={-acc}
                  onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="donut-seg" />
              );
              acc += len;
              return seg;
            })}
          </g>
        </svg>
        <div className="donut-center">
          <small>{active ? active.label : centerLabel}</small>
          <b>{active ? (showValue ? valueFormat(active.value) : String(active.value)) : centerValue}</b>
        </div>
      </div>
      <ul className="legend">
        {data.map((d, i) => (
          <li key={d.label} className={hover === i ? 'on' : ''} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i style={{ background: d.color }} />
            <span>{d.label}{d.sub ? <em>{d.sub}</em> : null}</span>
            <b>{total > 0 ? Math.round((d.value / total) * 100) : 0}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────────── Semi-circle gauge ───────────── */
export function Gauge({ value, label, sub }: { value: number; label: string; sub?: string }) {
  const v = Math.max(0, Math.min(100, value));
  const tone = v >= 75 ? 'var(--ok)' : v >= 40 ? 'var(--warn)' : 'var(--bad)';
  const d = 'M 16 104 A 84 84 0 0 1 184 104';
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 116">
        <path d={d} className="gauge-track" fill="none" strokeWidth={14} strokeLinecap="round" />
        <path d={d} fill="none" strokeWidth={14} strokeLinecap="round" pathLength={100} strokeDasharray={`${v} 100`} style={{ stroke: tone }} className="gauge-fill" />
      </svg>
      <div className="gauge-text"><b>{Math.round(v)}<small>%</small></b><span>{label}</span>{sub && <em>{sub}</em>}</div>
    </div>
  );
}

/* ───────────── Horizontal bar list ───────────── */
export function BarList({ items, format = moneyCompact }: { items: { label: string; value: number; sub?: string; color?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="barlist">
      {items.map((it, i) => (
        <li key={it.label + i}>
          <div className="bl-top"><span>{it.label}</span><b>{format(it.value)}</b></div>
          <div className="bl-track"><i style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: it.color || 'var(--brand-grad)', animationDelay: `${i * 70}ms` }} /></div>
          {it.sub && <small>{it.sub}</small>}
        </li>
      ))}
    </ul>
  );
}
