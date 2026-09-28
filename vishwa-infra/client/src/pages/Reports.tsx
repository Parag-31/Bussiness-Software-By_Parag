import React from 'react';
import { AlertCircle, BarChart3, CheckCircle2, Percent } from 'lucide-react';
import type { Analytics } from '../analytics';
import { type Summary, money, moneyCompact } from '../lib';
import { BarList, ChartSkeleton, ColumnChart, Donut, Gauge } from '../charts';
import { Avatar, Card, Kpi, Page } from '../ui';

export function Reports({ summary, an, loading }: { summary: Summary; an: Analytics; loading: boolean }) {
  const t = an.totals;
  const open = an.topCustomers.filter((c) => c.billed > 0);
  return (
    <Page title="Reports" sub="Understand sales, receipts, outstanding balances and document mix.">
      <div className="kpis">
        <Kpi i={0} loading={loading} title="Total invoiced" value={t.invoiced} format={money} icon={<BarChart3 />} tone="blue" delta={an.delta.invoiced} meta={`${t.invoices} invoices`} />
        <Kpi i={1} loading={loading} title="Collected" value={t.collected} format={money} icon={<CheckCircle2 />} tone="green" delta={an.delta.collected} meta="vs last month" />
        <Kpi i={2} loading={loading} title="Outstanding" value={t.outstanding} format={money} icon={<AlertCircle />} tone="rose" meta="Receivable" />
        <Kpi i={3} loading={loading} title="Collection rate" value={t.collectionRate} format={(n) => `${n.toFixed(0)}%`} icon={<Percent />} tone="amber" meta={`All documents: ${moneyCompact(summary.sales)}`} />
      </div>
      <Card i={4} title="Monthly performance" sub="Invoiced vs collected — last 12 months"
        right={<div className="legend-inline"><span><i style={{ background: 'var(--c1)' }} />Invoiced</span><span><i style={{ background: 'var(--ok)' }} />Collected</span></div>}>
        {loading ? <ChartSkeleton height={310} /> : (
          <ColumnChart labels={an.months.map((m) => m.label)} series={[
            { name: 'Invoiced', color: 'var(--c1)', values: an.invoiced },
            { name: 'Collected', color: 'var(--ok)', values: an.collected },
          ]} height={310} />
        )}
      </Card>
      <div className="grid3">
        <Card i={5} title="Document mix" sub="Value by document type">
          <Donut data={an.typeMix.map((m) => ({ label: m.label, value: m.value, color: m.color, sub: `${m.count}` }))} centerLabel="All documents" centerValue={moneyCompact(an.typeMix.reduce((a, m) => a + m.value, 0))} size={164} />
        </Card>
        <Card i={6} title="Receivables ageing" sub="Outstanding invoices by age">
          <BarList items={an.aging.map((a, i) => ({ label: a.label, value: a.value, sub: a.count ? `${a.count} invoice${a.count > 1 ? 's' : ''}` : 'None', color: ['var(--ok)', 'var(--c3)', 'var(--c6)', 'var(--bad)'][i] }))} />
        </Card>
        <Card i={7} title="Collection health" sub="Share of invoiced value received">
          <Gauge value={t.collectionRate} label="collected" sub={`${moneyCompact(t.collected)} of ${moneyCompact(t.invoiced)}`} />
        </Card>
      </div>
      <Card i={8} title="Customer balances" sub="Highest outstanding first" flush>
        <div className="balances">
          {open.length === 0 && <div className="soft-note pad">No invoices yet.</div>}
          {open.map((c) => {
            const pct = c.billed > 0 ? (c.received / c.billed) * 100 : 0;
            return (
              <div className="bal-row" key={c.name}>
                <Avatar name={c.name} size={36} />
                <div className="grow"><b>{c.name}</b><span>Billed {money(c.billed)} · Received {money(c.received)}</span><div className="bar thin"><i style={{ width: pct + '%' }} className={pct >= 100 ? 'done' : ''} /></div></div>
                <strong className={c.outstanding > 0 ? 'due' : 'pos'}>{c.outstanding > 0 ? money(c.outstanding) : 'Settled'}</strong>
              </div>
            );
          })}
        </div>
      </Card>
    </Page>
  );
}
