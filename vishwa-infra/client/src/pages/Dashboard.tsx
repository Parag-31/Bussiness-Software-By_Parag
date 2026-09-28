import React, { useState } from 'react';
import { AlertCircle, ArrowRight, BarChart3, CheckCircle2, Clock3, FileText, HardHat, IndianRupee, Plus, Printer, Receipt, Users, WalletCards, Wrench } from 'lucide-react';
import type { Analytics } from '../analytics';
import { overdueInvoices } from '../analytics';
import { type Doc, type User, fmtDate, money, moneyCompact, printDocument } from '../lib';
import { AreaChart, BarList, ChartSkeleton, Donut, Gauge } from '../charts';
import { Avatar, Card, CountUp, Empty, Kpi, Segmented, SkeletonRows, Status, stagger } from '../ui';
import { InfraScene } from '../illustrations';
import { typeMeta } from './meta';

export function Dashboard({ user, docs, an, customers, loading, onNew, onPay, onView, go }: {
  user: User | null; docs: Doc[]; an: Analytics; customers: number; loading: boolean;
  onNew: (type?: string) => void; onPay: () => void; onView: (d: Doc) => void; go: (page: string) => void;
}) {
  const [range, setRange] = useState<'6' | '12'>('6');
  const n = Number(range);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = (user?.name || 'there').split(' ')[0];
  const overdue = overdueInvoices(docs);
  const t = an.totals;

  const quick = [
    { label: 'GST Invoice', sub: 'Tax invoice with CGST/SGST', icon: Receipt, tone: 'blue', run: () => onNew('GST INVOICE') },
    { label: 'Quotation', sub: 'Send a professional quote', icon: Clock3, tone: 'amber', run: () => onNew('QUOTATION') },
    { label: 'Repair Bill', sub: 'Service & maintenance', icon: Wrench, tone: 'violet', run: () => onNew('REPAIR BILL') },
    { label: 'Work Order', sub: 'Assign & track a job', icon: HardHat, tone: 'cyan', run: () => onNew('WORK ORDER') },
    { label: 'Record payment', sub: 'Update invoice balance', icon: WalletCards, tone: 'green', run: onPay },
  ];

  return (
    <>
      <section className="hero rise">
        <div className="hero-glow" />
        <div className="hero-copy">
          <p className="eyebrow">BUSINESS CONTROL CENTER · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}</p>
          <h1>{greet}, {first}.</h1>
          <p className="hero-sub">
            {loading ? 'Loading your workspace…' : t.outstanding > 0
              ? <>You have <b>{money(t.outstanding)}</b> outstanding across your invoices{overdue.length ? <> — <b>{overdue.length}</b> {overdue.length === 1 ? 'is' : 'are'} older than 30 days.</> : '.'}</>
              : 'Everything is collected and up to date. Nice work.'}
          </p>
          <div className="hero-actions">
            <button className="btn amber" onClick={() => onNew()}><Plus size={17} /> Create document</button>
            <button className="btn glass" onClick={() => go('Reports')}><BarChart3 size={16} /> View reports</button>
          </div>
          <div className="hero-chips">
            <div><small>This month invoiced</small><b><CountUp value={an.thisMonth.invoiced} format={moneyCompact} /></b></div>
            <div><small>Collected</small><b><CountUp value={an.thisMonth.collected} format={moneyCompact} /></b></div>
            <div><small>Customers</small><b>{customers}</b></div>
          </div>
        </div>
        <InfraScene className="hero-scene" />
      </section>

      <div className="kpis">
        <Kpi i={1} loading={loading} title="Total invoiced" value={t.invoiced} format={money} icon={<IndianRupee />} tone="blue" delta={an.delta.invoiced} meta={`${t.invoices} GST invoices`} spark={an.invoiced.slice(-8)} sparkColor="var(--c1)" />
        <Kpi i={2} loading={loading} title="Collected" value={t.collected} format={money} icon={<CheckCircle2 />} tone="green" delta={an.delta.collected} meta="vs last month" spark={an.collected.slice(-8)} sparkColor="var(--ok)" />
        <Kpi i={3} loading={loading} title="Outstanding" value={t.outstanding} format={money} icon={<AlertCircle />} tone="rose" meta={`${Math.round(100 - t.collectionRate)}% of invoiced value`}>
          <div className="mini-progress"><i style={{ width: `${Math.min(100, 100 - t.collectionRate)}%` }} /></div>
        </Kpi>
        <Kpi i={4} loading={loading} title="Quotation pipeline" value={t.pipeline} format={money} icon={<Clock3 />} tone="amber" meta={`${t.quotations} quotations`} spark={an.quoted.slice(-8)} sparkColor="var(--c3)" />
      </div>

      <div className="quick rise" style={stagger(5)}>
        {quick.map((q) => (
          <button key={q.label} className={'qtile tone-' + q.tone} onClick={q.run}>
            <span className="qico"><q.icon size={19} /></span>
            <span><b>{q.label}</b><small>{q.sub}</small></span>
            <ArrowRight size={16} className="qarrow" />
          </button>
        ))}
      </div>

      <div className="grid-main">
        <Card i={6} title="Revenue overview" sub="Invoiced vs collected"
          right={<Segmented value={range} onChange={setRange} options={[{ value: '6', label: '6 months' }, { value: '12', label: '12 months' }]} />}>
          <div className="legend-inline"><span><i style={{ background: 'var(--c1)' }} />Invoiced</span><span><i style={{ background: 'var(--ok)' }} />Collected</span></div>
          {loading ? <ChartSkeleton height={385} /> : (
            <AreaChart height={385} labels={an.months.slice(-n).map((m) => m.label)} series={[
              { name: 'Invoiced', color: 'var(--c1)', values: an.invoiced.slice(-n) },
              { name: 'Collected', color: 'var(--ok)', values: an.collected.slice(-n) },
            ]} />
          )}
        </Card>
        <Card i={7} title="Collection health" sub="How much of your billing is paid">
          <Gauge value={t.collectionRate} label="collected" sub={`${moneyCompact(t.collected)} of ${moneyCompact(t.invoiced)}`} />
          <div className="aging-head">Outstanding by age</div>
          <BarList items={an.aging.map((a, i) => ({ label: a.label, value: a.value, sub: a.count ? `${a.count} invoice${a.count > 1 ? 's' : ''}` : undefined, color: ['var(--ok)', 'var(--c3)', 'var(--c6)', 'var(--bad)'][i] }))} />
        </Card>
      </div>

      <div className="grid-main second">
        <Card i={8} title="Recent documents" sub="Latest activity" flush right={<button className="link" onClick={() => go('GST Invoices')}>View invoices <ArrowRight size={14} /></button>}>
          {loading ? <div className="pad"><SkeletonRows rows={5} /></div> : (
            <div className="rows">
              {docs.slice(0, 8).map((d) => {
                const m = typeMeta(d.type);
                return (
                  <div className="row hoverable" key={d.id} onClick={() => onView(d)}>
                    <div className={'dtype tone-' + m.tone}><m.icon size={17} /></div>
                    <div className="grow"><b>{d.number}</b><span>{d.customer || 'Walk-in'} · {m.short} · {fmtDate(d.date)}</span></div>
                    <strong className="num">{money(d.total)}</strong>
                    <Status s={d.status} />
                    <button className="icon-btn" title="Print" onClick={(e) => { e.stopPropagation(); printDocument(d.id); }}><Printer size={16} /></button>
                  </div>
                );
              })}
              {!docs.length && <Empty title="No documents yet" text="Create your first quotation or GST invoice." onClick={() => onNew()} cta="Create document" icon={<FileText size={26} />} />}
            </div>
          )}
        </Card>
        <div className="stack">
          <Card i={9} title="Document mix" sub="Value by document type">
            <Donut data={an.typeMix.map((m) => ({ label: m.label, value: m.value, color: m.color, sub: `${m.count}` }))} centerLabel="Total value" centerValue={moneyCompact(an.typeMix.reduce((a, m) => a + m.value, 0))} />
          </Card>
          <Card i={10} title="Top balances" sub="Customers with the most outstanding">
            {an.topCustomers.filter((c) => c.outstanding > 0).length
              ? <BarList items={an.topCustomers.filter((c) => c.outstanding > 0).slice(0, 4).map((c) => ({ label: c.name, value: c.outstanding, sub: `Billed ${moneyCompact(c.billed)}` }))} />
              : <div className="soft-note"><Users size={16} /> No pending balances.</div>}
          </Card>
        </div>
      </div>
    </>
  );
}
