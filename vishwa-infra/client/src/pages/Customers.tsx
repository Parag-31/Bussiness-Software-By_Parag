import React, { useMemo, useState } from 'react';
import { DownloadCloud, Mail, MapPin, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import { type Customer, type Doc, type User, api, downloadFile, money } from '../lib';
import { confirmDialog, toast } from '../bus';
import { Avatar, Empty, Kpi, Page, SkeletonRows } from '../ui';
import { INVOICE } from '../analytics';

export function Customers({ data, docs, user, loading, onAdd, onRefresh }: { data: Customer[]; docs: Doc[]; user: User | null; loading: boolean; onAdd: () => void; onRefresh: () => void }) {
  const [q, setQ] = useState('');
  const canDelete = user?.role === 'Admin';
  const stats = useMemo(() => {
    const m = new Map<number, { billed: number; due: number; n: number }>();
    for (const d of docs) {
      if (d.customer_id == null) continue;
      const s = m.get(d.customer_id) || { billed: 0, due: 0, n: 0 };
      s.n += 1;
      if (d.type === INVOICE) { s.billed += d.total; s.due += Math.max(0, d.total - d.received); }
      m.set(d.customer_id, s);
    }
    return m;
  }, [docs]);
  const shown = data.filter((c) => !q || `${c.name} ${c.gstin} ${c.phone} ${c.email} ${c.address}`.toLowerCase().includes(q.toLowerCase()));
  const remove = async (c: Customer) => {
    if (!(await confirmDialog({ title: `Delete ${c.name}?`, message: 'The customer record will be removed. Existing documents are kept.', confirmLabel: 'Delete customer', danger: true }))) return;
    try { await api(`/customers/${c.id}`, { method: 'DELETE' }); toast('Customer deleted', 'success'); onRefresh(); } catch (e: any) { toast('Could not delete', 'error', e.message); }
  };
  return (
    <Page title="Customers" sub="Keep customer contacts, GST details and addresses organized." actions={<button className="btn primary" onClick={onAdd}><Plus size={17} /> Add customer</button>}>
      <div className="kpis mini3">
        <Kpi i={0} loading={loading} title="Customers" value={data.length} format={(n) => String(Math.round(n))} icon={<Users />} tone="blue" meta="In your directory" />
        <Kpi i={1} loading={loading} title="With GSTIN" value={data.filter((c) => c.gstin).length} format={(n) => String(Math.round(n))} icon={<Users />} tone="green" meta="Business customers" />
        <Kpi i={2} loading={loading} title="Total outstanding" value={[...stats.values()].reduce((a, s) => a + s.due, 0)} format={money} icon={<Users />} tone="rose" meta="Across all customers" />
      </div>
      <div className="toolbar rise">
        <div className="search-in"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, GSTIN, phone…" /></div>
        <button className="btn ghost" onClick={() => downloadFile('/customers/export', 'customers.csv')}><DownloadCloud size={15} /> Export CSV</button>
      </div>
      <div className="card table-card rise">
        {loading ? <div className="pad"><SkeletonRows rows={6} /></div> : (
          <table>
            <thead><tr><th>Customer</th><th>Contact</th><th>GSTIN</th><th className="r">Billed</th><th className="r">Outstanding</th><th></th></tr></thead>
            <tbody>
              {shown.map((c) => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id}>
                    <td><div className="cust-cell"><Avatar name={c.name} size={38} /><div><b>{c.name}</b><small className="ell"><MapPin size={11} /> {c.address || 'No address'}</small></div></div></td>
                    <td><div className="contact"><span><Phone size={12} />{c.phone || '—'}</span><span><Mail size={12} />{c.email || '—'}</span></div></td>
                    <td>{c.gstin ? <code className="gstin">{c.gstin}</code> : '—'}</td>
                    <td className="r num">{s ? money(s.billed) : '—'}</td>
                    <td className="r num">{s && s.due > 0 ? <strong className="due">{money(s.due)}</strong> : <span className="muted">—</span>}</td>
                    <td><div className="row-actions">{canDelete && <button className="icon-btn danger" data-tip="Delete" onClick={() => remove(c)}><Trash2 size={16} /></button>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !shown.length && <Empty title={data.length ? 'No customers match' : 'No customers yet'} text={data.length ? 'Try a different search.' : 'Add your first customer to start creating documents.'} onClick={data.length ? undefined : onAdd} cta="Add customer" icon={<Users size={26} />} />}
      </div>
    </Page>
  );
}
