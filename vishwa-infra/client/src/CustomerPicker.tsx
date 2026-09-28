import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, UserPlus, Users } from 'lucide-react';
import type { Customer } from './lib';
import { Avatar } from './ui';

/** What the user has entered for the customer on a document: a saved customer (id) or a brand-new name. */
export type CustomerDraft = { id: number | null; name: string; gstin: string; phone: string; address: string };
export const emptyCustomer = (): CustomerDraft => ({ id: null, name: '', gstin: '', phone: '', address: '' });

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Type-or-pick customer field. Pick a saved customer, or just type a new name. */
export function CustomerPicker({ customers, value, onChange, onOpenChange }: { customers: Customer[]; value: CustomerDraft; onChange: (v: CustomerDraft) => void; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const q = value.name.trim();
  const exact = customers.find((c) => same(c.name, q));
  const matches = customers.filter((c) => !q || `${c.name} ${c.gstin || ''}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  const showNew = !!q && !exact;
  const total = matches.length + (showNew ? 1 : 0);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, []);
  useEffect(() => { setActive(0); }, [value.name]);
  useEffect(() => { if (onOpenChange) onOpenChange(open && total > 0); }, [open, total]);

  const type = (text: string) => {
    const hit = customers.find((c) => same(c.name, text));
    onChange({ ...value, name: text, id: hit ? hit.id : null });
    setOpen(true);
  };
  const pick = (c: Customer) => { onChange({ id: c.id, name: c.name, gstin: '', phone: '', address: '' }); setOpen(false); };
  const useNew = () => { setOpen(false); };
  const choose = (i: number) => { if (i < matches.length) pick(matches[i]); else useNew(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(total - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && total > 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
  };

  return (
    <div className="field">
      <span className="fl">Customer <em className="hint">pick a saved one or type a new name</em></span>
      <div className="combo" ref={wrap}>
        <Users size={17} className="combo-ico" />
        <input value={value.name} placeholder="Type customer / company name…" autoComplete="off" role="combobox" aria-expanded={open}
          onChange={(e) => type(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey} />
        <ChevronDown size={16} className="combo-chev" />
        {open && total > 0 && (
          <div className="combo-list" role="listbox">
            {matches.map((c, i) => (
              <button type="button" key={c.id} role="option" className={'combo-opt' + (i === active ? ' on' : '')} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c)}>
                <Avatar name={c.name} size={30} />
                <span><b>{c.name}</b><small>{c.gstin || c.address || 'No details saved'}</small></span>
              </button>
            ))}
            {showNew && (
              <button type="button" className={'combo-opt add' + (active === matches.length ? ' on' : '')} onMouseEnter={() => setActive(matches.length)} onMouseDown={(e) => e.preventDefault()} onClick={useNew}>
                <span className="combo-plus"><Plus size={16} /></span>
                <span><b>Use “{q}” as a new customer</b><small>It will be added to your Customers list</small></span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Optional extra details for a customer typed in by hand (prints on the document). */
export function NewCustomerBox({ value, onChange, hidden }: { value: CustomerDraft; onChange: (v: CustomerDraft) => void; hidden?: boolean }) {
  if (hidden || value.id || !value.name.trim()) return null;
  return (
    <div className="newcust">
      <div className="newcust-head"><span><UserPlus size={16} /></span><div><b>New customer: {value.name.trim()}</b><small>Saved to your Customers list when you save this document. The details below are optional and print on the document.</small></div></div>
      <div className="newcust-grid">
        <label className="field">GSTIN<input value={value.gstin} maxLength={15} onChange={(e) => onChange({ ...value, gstin: e.target.value.toUpperCase() })} placeholder="15-character GST number" /></label>
        <label className="field">Phone<input value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} placeholder="Contact number" /></label>
        <label className="field wide-2">Address<input value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value })} placeholder="Billing address" /></label>
      </div>
    </div>
  );
}
