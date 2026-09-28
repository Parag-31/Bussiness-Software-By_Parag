import React, { useMemo, useState } from 'react';
import { Copy, DownloadCloud, Eye, Mail, MessageCircle, Plus, Printer, RefreshCw, Search, Trash2, WalletCards } from 'lucide-react';
import { type Customer, type Doc, type User, api, downloadFile, emailShare, fmtDate, money, moneyCompact, printDocument, whatsappShare } from '../lib';
import { confirmDialog, toast } from '../bus';
import { Avatar, Card, Empty, Kpi, Page, Segmented, SkeletonRows, Status } from '../ui';
import { INVOICE } from '../analytics';
import { typeMeta } from './meta';

const SUBS: Record<string, string> = {
  QUOTATION: 'Create, track and present professional quotations.',
  'GST INVOICE': 'Manage GST tax invoices and payment status.',
  'REPAIR BILL': 'Service and repair bills with itemised GST.',
  'WORK ORDER': 'Work orders issued to and from your clients.',
};

export function Documents({ title, type, docs, customers, user, loading, onNew, onView, onPay, onRefresh }: {
  title: string; type: string; docs: Doc[]; customers: Customer[]; user: User | null; loading: boolean;
  onNew: (type: string) => void; onView: (d: Doc) => void; onPay: (d: Doc) => void; onRefresh: () => void;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const meta = typeMeta(type);
  const list = useMemo(() => docs.filter((d) => d.type === type), [docs, type]);
  const shown = list.filter((d) => (status === 'all' || d.status.toLowerCase() === status) && (!q || `${d.number} ${d.customer || ''} ${d.notes || ''}`.toLowerCase().includes(q.toLowerCase())));
  const count = (s: string) => list.filter((d) => d.status.toLowerCase() === s).length;
  const isInv = type === INVOICE;
  const due = list.reduce((a, d) => a + Math.max(0, d.total - d.received), 0);
  const canDelete = user?.role === 'Admin';
  const customerOf = (d: Doc) => customers.find((c) => c.id === d.customer_id);

  const remove = async (d: Doc) => {
    if (!(await confirmDialog({ title: `Delete ${d.number}?`, message: 'This permanently removes the document and its payments. This cannot be undone.', confirmLabel: 'Delete document', danger: true }))) return;
    try { await api(`/documents/${d.id}`, { method: 'DELETE' }); toast('Document deleted', 'success'); onRefresh(); } catch (e: any) { toast('Could not delete', 'error', e.message); }
  };
  const duplicate = async (d: Doc) => {
    try { const r = await api(`/documents/${d.id}/duplicate`, { method: 'POST' }); toast('Repeated as ' + r.number, 'success', 'Opened as a new draft — review and save.'); onRefresh(); onView({ ...d, id: r.id, number: r.number, status: 'Draft' }); } catch (e: any) { toast('Could not repeat document', 'error', e.message); }
  };
  const share = (d: Doc, kind: 'whatsapp' | 'email') => {
    const c = customerOf(d);
    const link = `${window.location.origin}/api/documents/${d.id}/print`;
    const text = `${meta.label} ${d.number}${c ? ' for ' + c.name : ''} — ${money(d.total)}. View: ${link}`;
    if (kind === 'whatsapp') whatsappShare(c?.phone || '', text);
    else emailShare(c?.email || '', `${meta.label} ${d.number}`, text);
  };

  return (
    <Page title={title} sub={SUBS[type]} actions={<button className="btn primary" onClick={() => onNew(type)}><Plus size={17} /> New {meta.label}</button>}>
      <div className="kpis mini3">
        <Kpi i={0} loading={loading} title="Records" value={list.length} format={(n) => String(Math.round(n))} icon={<meta.icon />} tone={meta.tone as any} meta={isInv ? `${count('paid')} fully paid` : `${count('draft')} drafts`} />
        <Kpi i={1} loading={loading} title="Total value" value={list.reduce((a, d) => a + d.total, 0)} format={money} icon={<WalletCards />} tone="blue" meta="Incl. GST" />
        {isInv
          ? <Kpi i={2} loading={loading} title="Outstanding" value={due} format={money} icon={<WalletCards />} tone="rose" meta={`${count('pending')} pending invoices`} />
          : <Kpi i={2} loading={loading} title="Average value" value={list.length ? list.reduce((a, d) => a + d.total, 0) / list.length : 0} format={money} icon={<WalletCards />} tone="violet" meta="Per document" />}
      </div>

      <div className="toolbar rise">
        <div className="search-in"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${title}…`} /></div>
        <Segmented value={status} onChange={setStatus} options={[
          { value: 'all', label: 'All', count: list.length },
          { value: 'draft', label: 'Draft', count: count('draft') },
          { value: 'pending', label: 'Pending', count: count('pending') },
          { value: 'paid', label: 'Paid', count: count('paid') },
        ]} />
        <button className="btn ghost" onClick={() => downloadFile(`/documents/export?type=${encodeURIComponent(type)}`, `${title.toLowerCase().replace(/\s+/g, '-')}.csv`)}><DownloadCloud size={15} /> Export CSV</button>
        <button className="btn ghost" onClick={onRefresh}><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="card table-card rise">
        {loading ? <div className="pad"><SkeletonRows rows={6} /></div> : (
          <table>
            <thead><tr><th>Document</th><th>Customer</th><th>Date</th><th>Status</th><th className="r">Total</th>{isInv && <th>Collected</th>}<th></th></tr></thead>
            <tbody>
              {shown.map((d) => {
                const pct = d.total > 0 ? Math.min(100, (d.received / d.total) * 100) : 0;
                return (
                  <tr key={d.id} className="clickable" onClick={() => onView(d)}>
                    <td><div className="doc-cell"><div className={'dtype tone-' + meta.tone}><meta.icon size={17} /></div><div><b>{d.number}</b><small>{d.letterhead || 'Default letterhead'}</small></div></div></td>
                    <td><div className="cust-cell"><Avatar name={d.customer || 'Walk-in'} size={28} /><span>{d.customer || '—'}</span></div></td>
                    <td className="nw">{fmtDate(d.date)}</td>
                    <td><Status s={d.status} /></td>
                    <td className="r num"><strong>{money(d.total)}</strong></td>
                    {isInv && <td><div className="pay-prog"><div className="bar"><i style={{ width: pct + '%' }} className={pct >= 100 ? 'done' : ''} /></div><small>{moneyCompact(d.received)} · {Math.round(pct)}%</small></div></td>}
                    <td>
                      <div className="row-actions" onClick={(e) => e.stopPropagation()}>
                        {isInv && d.total - d.received > 0.5 && <button className="icon-btn accent" data-tip="Record payment" onClick={() => onPay(d)}><WalletCards size={16} /></button>}
                        <button className="icon-btn" data-tip="View" onClick={() => onView(d)}><Eye size={16} /></button>
                        <button className="icon-btn" data-tip="Print / PDF" onClick={() => printDocument(d.id)}><Printer size={16} /></button>
                        <button className="icon-btn" data-tip="Repeat as new draft" onClick={() => duplicate(d)}><Copy size={16} /></button>
                        <button className="icon-btn" data-tip="Share on WhatsApp" onClick={() => share(d, 'whatsapp')}><MessageCircle size={16} /></button>
                        <button className="icon-btn" data-tip="Share by email" onClick={() => share(d, 'email')}><Mail size={16} /></button>
                        {canDelete && <button className="icon-btn danger" data-tip="Delete" onClick={() => remove(d)}><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !shown.length && (list.length
          ? <Empty title="Nothing matches" text="Try a different search or status filter." />
          : <Empty title={`No ${title} yet`} text="Create a record to start building your business history." onClick={() => onNew(type)} cta={`New ${meta.label}`} icon={<meta.icon size={26} />} />)}
      </div>
    </Page>
  );
}
