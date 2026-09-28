import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, Plus, X, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import { Sparkline } from './charts';
import { EmptyMark } from './illustrations';
import { hash, initials, reducedMotion } from './lib';
import { onConfirm, onToast, type ConfirmReq, type ToastItem } from './bus';

export const stagger = (i: number) => ({ ['--i' as string]: i } as React.CSSProperties);

/* ───────── Avatar / Status / Segmented ───────── */
export function Avatar({ name, size = 34 }: { name?: string; size?: number }) {
  return <span className={'avatar-i av-' + (hash(name || '?') % 6)} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>{initials(name)}</span>;
}

export function Status({ s }: { s: string }) {
  return <span className={'pill ' + s.toLowerCase().replace(/\s+/g, '-')}><i />{s}</span>;
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: React.ReactNode; count?: number }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}

/* ───────── Numbers ───────── */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [v, setV] = useState(reducedMotion() ? value : 0);
  const cur = useRef(reducedMotion() ? value : 0);
  useEffect(() => {
    if (reducedMotion()) { setV(value); cur.current = value; return; }
    const from = cur.current, start = performance.now(), dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
      cur.current = from + (value - from) * e; setV(cur.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(v)}</>;
}

export function Delta({ value, invert = false }: { value: number | null; invert?: boolean }) {
  if (value === null) return <span className="delta flat">New</span>;
  const up = value >= 0, good = invert ? !up : up;
  return <span className={'delta ' + (good ? 'good' : 'bad')}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(value).toFixed(0)}%</span>;
}

export function Kpi({ title, value, format, icon, tone = 'blue', meta, delta, invert, spark, sparkColor, loading, i = 0, children }: {
  title: string; value: number; format: (n: number) => string; icon: React.ReactNode; tone?: 'blue' | 'green' | 'amber' | 'violet' | 'cyan' | 'rose';
  meta?: string; delta?: number | null; invert?: boolean; spark?: number[]; sparkColor?: string; loading?: boolean; i?: number; children?: React.ReactNode;
}) {
  return (
    <div className={'kpi rise tone-' + tone} style={stagger(i)}>
      <div className="kpi-top"><span>{title}</span><div className="kicon">{icon}</div></div>
      {loading ? <div className="skel skel-h" /> : <h2><CountUp value={value} format={format} /></h2>}
      <div className="kpi-meta">
        {delta !== undefined && !loading && <Delta value={delta} invert={invert} />}
        <small>{meta}</small>
      </div>
      {children}
      {spark && !loading && <div className="kpi-spark"><Sparkline values={spark} color={sparkColor || 'currentColor'} /></div>}
    </div>
  );
}

/* ───────── Layout helpers ───────── */
export function Page({ title, sub, actions, children }: { title: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="page">
      <div className="page-title rise">
        <div><p className="eyebrow">VISHWA INFRA</p><h1>{title}</h1>{sub && <p className="sub">{sub}</p>}</div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function Card({ title, sub, right, children, className = '', i = 0, flush = false }: { title?: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string; i?: number; flush?: boolean }) {
  return (
    <div className={'card rise ' + className} style={stagger(i)}>
      {(title || right) && <div className="card-head"><div><h3>{title}</h3>{sub && <span>{sub}</span>}</div>{right}</div>}
      <div className={flush ? '' : 'card-body'}>{children}</div>
    </div>
  );
}

export function Empty({ title, text, onClick, cta = 'Add record', icon }: { title: string; text: string; onClick?: () => void; cta?: string; icon?: React.ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-ico">{icon || <EmptyMark size={30} />}</div>
      <h3>{title}</h3><p>{text}</p>
      {onClick && <button className="btn primary" onClick={onClick}><Plus size={16} /> {cta}</button>}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return <div className="skel-rows">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skel skel-row" style={{ opacity: 1 - i * 0.14 }} />)}</div>;
}

/* ───────── Modal shell ───────── */
export function ModalShell({ eyebrow, title, sub, onClose, wide, xwide, onSubmit, children, footer }: {
  eyebrow: string; title: string; sub?: string; onClose: () => void; wide?: boolean; xwide?: boolean; onSubmit?: (e: React.FormEvent) => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev; };
  }, []);
  const head = (
    <div className="modal-head">
      <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{sub && <span>{sub}</span>}</div>
      <button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
    </div>
  );
  const inner = (<>{head}<div className="modal-body">{children}</div><div className="modal-actions">{footer}</div></>);
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal' + (wide ? ' wide' : '') + (xwide ? ' xwide' : '')} role="dialog" aria-modal="true">
        {onSubmit ? <form className="modal-form" onSubmit={onSubmit}>{inner}</form> : <div className="modal-form">{inner}</div>}
      </div>
    </div>
  );
}

/* ───────── Toasts + confirm dialog hosts ───────── */
export function Overlays() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [req, setReq] = useState<ConfirmReq | null>(null);

  useEffect(() => onToast((t) => {
    setToasts((a) => [...a.filter((x) => !(x.title === t.title && x.text === t.text)).slice(-3), t]);
    window.setTimeout(() => setToasts((a) => a.filter((x) => x.id !== t.id)), t.kind === 'error' ? 6500 : 4200);
  }), []);
  useEffect(() => onConfirm((r) => setReq(r)), []);
  useEffect(() => {
    if (!req) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); req.resolve(false); setReq(null); }
      if (e.key === 'Enter') { e.stopImmediatePropagation(); req.resolve(true); setReq(null); }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, [req]);

  const icon = (k: ToastItem['kind']) => (k === 'success' ? <CheckCircle2 size={19} /> : k === 'error' ? <AlertCircle size={19} /> : <Info size={19} />);
  return (
    <>
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.kind}>
            <span className="t-ico">{icon(t.kind)}</span>
            <div><b>{t.title}</b>{t.text && <p>{t.text}</p>}</div>
            <button className="icon-btn sm" onClick={() => setToasts((a) => a.filter((x) => x.id !== t.id))} aria-label="Dismiss"><X size={14} /></button>
          </div>
        ))}
      </div>
      {req && (
        <div className="overlay front" onMouseDown={(e) => { if (e.target === e.currentTarget) { req.resolve(false); setReq(null); } }}>
          <div className="confirm" role="alertdialog" aria-modal="true">
            <div className={'confirm-ico' + (req.danger ? ' danger' : '')}><AlertTriangle size={24} /></div>
            <h3>{req.title}</h3>
            {req.message && <p>{req.message}</p>}
            <div className="confirm-actions">
              <button className="btn ghost" onClick={() => { req.resolve(false); setReq(null); }}>Cancel</button>
              <button className={'btn ' + (req.danger ? 'danger' : 'primary')} autoFocus onClick={() => { req.resolve(true); setReq(null); }}>{req.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
