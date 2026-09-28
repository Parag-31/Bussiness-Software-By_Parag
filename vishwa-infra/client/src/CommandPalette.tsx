import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, FileText, Users, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Customer, Doc } from './lib';
import { money } from './lib';

export type Cmd = { id: string; group: string; label: string; hint?: string; icon: LucideIcon | null; run: () => void; kbd?: string };

export function CommandPalette({ open, onClose, base, docs, customers, onDoc, onCustomer }: {
  open: boolean; onClose: () => void; base: Cmd[]; docs: Doc[]; customers: Customer[]; onDoc: (d: Doc) => void; onCustomer: (c: Customer) => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) { setQ(''); setActive(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  const items = useMemo<Cmd[]>(() => {
    const s = q.trim().toLowerCase();
    const has = (t: string) => t.toLowerCase().includes(s);
    const out: Cmd[] = base.filter((c) => !s || has(c.label + ' ' + c.group + ' ' + (c.hint || '')));
    if (s) {
      docs.filter((d) => has(`${d.number} ${d.customer || ''} ${d.type} ${d.status}`)).slice(0, 6)
        .forEach((d) => out.push({ id: 'd' + d.id, group: 'Documents', label: d.number, hint: `${d.customer || 'Walk-in'} · ${d.type} · ${money(d.total)}`, icon: FileText, run: () => onDoc(d) }));
      customers.filter((c) => has(`${c.name} ${c.gstin} ${c.phone} ${c.email}`)).slice(0, 5)
        .forEach((c) => out.push({ id: 'c' + c.id, group: 'Customers', label: c.name, hint: c.gstin || c.phone || c.email || '', icon: Users, run: () => onCustomer(c) }));
    }
    return out;
  }, [q, base, docs, customers]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('.cmd.on')?.scrollIntoView({ block: 'nearest' }); }, [active]);

  if (!open) return null;
  const run = (c?: Cmd) => { if (!c) return; onClose(); c.run(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(items[active]); }
    else if (e.key === 'Escape') { onClose(); }
  };
  let last = '';
  return (
    <div className="overlay top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette" role="dialog" aria-modal="true" onKeyDown={onKey}>
        <div className="palette-input"><Search size={18} /><input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents, customers, or jump to a page…" /><kbd>ESC</kbd></div>
        <div className="palette-list" ref={listRef}>
          {items.length === 0 && <div className="palette-empty">No results for “{q}”</div>}
          {items.map((c, i) => {
            const head = c.group !== last ? <div className="palette-group">{c.group}</div> : null;
            last = c.group;
            const Ico = c.icon || ArrowRight;
            return (
              <React.Fragment key={c.id}>
                {head}
                <button className={'cmd' + (i === active ? ' on' : '')} onMouseMove={() => setActive(i)} onClick={() => run(c)}>
                  <span className="cmd-ico"><Ico size={16} /></span>
                  <span className="cmd-l"><b>{c.label}</b>{c.hint && <small>{c.hint}</small>}</span>
                  {i === active && <CornerDownLeft size={14} className="cmd-enter" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="palette-foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span></div>
      </div>
    </div>
  );
}
