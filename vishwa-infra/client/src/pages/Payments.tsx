import React from 'react';
import { CalendarDays, DownloadCloud, FileText, Plus, Trash2, WalletCards } from 'lucide-react';
import { type Payment, type User, api, downloadFile, fmtDate, money, moneyCompact } from '../lib';
import { confirmDialog, toast } from '../bus';
import { Card, Empty, Kpi, Page, SkeletonRows } from '../ui';
import { Donut } from '../charts';
import { modeIcon } from './meta';

const MODE_COLORS = ['var(--c1)', 'var(--ok)', 'var(--c3)', 'var(--c5)', 'var(--c2)', 'var(--c6)'];

export function Payments({ data, user, loading, onAdd, onRefresh }: { data: Payment[]; user: User | null; loading: boolean; onAdd: () => void; onRefresh: () => void }) {
  const canDelete = user?.role === 'Admin';
  const remove = async (p: Payment) => {
    if (!(await confirmDialog({ title: 'Delete this payment?', message: `${money(p.amount)} against ${p.number} will be removed and the invoice balance restored.`, confirmLabel: 'Delete payment', danger: true }))) return;
    try { await api(`/payments/${p.id}`, { method: 'DELETE' }); toast('Payment deleted', 'success'); onRefresh(); } catch (e: any) { toast('Could not delete', 'error', e.message); }
  };
  const total = data.reduce((a, p) => a + p.amount, 0);
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = data.filter((p) => (p.date || '').startsWith(month)).reduce((a, p) => a + p.amount, 0);
  const byMode = new Map<string, number>();
  data.forEach((p) => byMode.set(p.mode || 'Other', (byMode.get(p.mode || 'Other') || 0) + p.amount));
  const slices = [...byMode.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: MODE_COLORS[i % MODE_COLORS.length] }));
  return (
    <Page title="Payments" sub="Record receipts and keep invoice balances accurate." actions={<div style={{ display: 'flex', gap: 10 }}><button className="btn ghost" onClick={() => downloadFile('/payments/export', 'payments.csv')}><DownloadCloud size={15} /> Export CSV</button><button className="btn primary" onClick={onAdd}><Plus size={17} /> Record payment</button></div>}>
      <div className="pay-top">
        <div className="kpis two">
          <Kpi i={0} loading={loading} title="Total received" value={total} format={money} icon={<WalletCards />} tone="green" meta="All receipts" />
          <Kpi i={1} loading={loading} title="This month" value={thisMonth} format={money} icon={<CalendarDays />} tone="blue" meta="Collected so far" />
          <Kpi i={2} loading={loading} title="Transactions" value={data.length} format={(n) => String(Math.round(n))} icon={<FileText />} tone="violet" meta="Payment records" />
          <Kpi i={3} loading={loading} title="Average payment" value={data.length ? total / data.length : 0} format={money} icon={<WalletCards />} tone="amber" meta="Per transaction" />
        </div>
        <Card i={4} title="Payment modes" sub="Share of money received">
          {slices.length ? <Donut data={slices} centerLabel="Received" centerValue={moneyCompact(total)} size={150} /> : <div className="soft-note">No payments to analyse yet.</div>}
        </Card>
      </div>
      <div className="card table-card rise">
        {loading ? <div className="pad"><SkeletonRows rows={6} /></div> : (
          <table>
            <thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Mode</th><th>Reference</th><th className="r">Amount</th><th></th></tr></thead>
            <tbody>
              {data.map((p) => {
                const M = modeIcon(p.mode);
                return (
                  <tr key={p.id}>
                    <td className="nw">{fmtDate(p.date)}</td><td><b>{p.number}</b></td><td>{p.customer || '—'}</td>
                    <td><span className="mode"><M size={14} />{p.mode || '—'}</span></td>
                    <td className="muted">{p.reference || '—'}</td>
                    <td className="r num"><strong className="pos">+{money(p.amount)}</strong></td>
                    <td><div className="row-actions">{canDelete && <button className="icon-btn danger" data-tip="Delete" onClick={() => remove(p)}><Trash2 size={16} /></button>}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !data.length && <Empty title="No payments yet" text="Record a receipt against an invoice to update its balance." onClick={onAdd} cta="Record payment" icon={<WalletCards size={26} />} />}
      </div>
    </Page>
  );
}
