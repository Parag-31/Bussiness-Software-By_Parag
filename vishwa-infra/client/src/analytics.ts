import type { Doc, Payment } from './lib';

export const INVOICE = 'GST INVOICE';
const pad = (n: number) => String(n).padStart(2, '0');

export type Month = { key: string; label: string; short: string };
export function monthsBack(n: number, from = new Date()): Month[] {
  const out: Month[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: d.toLocaleString('en-IN', { month: 'short', year: '2-digit' }),
      short: d.toLocaleString('en-IN', { month: 'short' }),
    });
  }
  return out;
}

export type Analytics = {
  months: Month[];
  invoiced: number[]; collected: number[]; quoted: number[];
  totals: { invoiced: number; collected: number; outstanding: number; pipeline: number; quotations: number; invoices: number; collectionRate: number };
  delta: { invoiced: number | null; collected: number | null };
  thisMonth: { invoiced: number; collected: number; docs: number };
  typeMix: { label: string; value: number; count: number; color: string }[];
  status: { label: string; count: number; color: string }[];
  topCustomers: { name: string; billed: number; received: number; outstanding: number }[];
  aging: { label: string; value: number; count: number }[];
};

const pct = (cur: number, prev: number): number | null => (prev > 0 ? ((cur - prev) / prev) * 100 : null);
const daysSince = (s: string, now: Date) => Math.floor((now.getTime() - new Date(s + 'T00:00:00').getTime()) / 86400000);

export function overdueInvoices(docs: Doc[], now = new Date(), minDays = 30) {
  return docs
    .filter((d) => d.type === INVOICE && d.total - d.received > 0.5)
    .map((d) => ({ doc: d, age: daysSince(d.date, now), due: d.total - d.received }))
    .filter((x) => x.age > minDays)
    .sort((a, b) => b.age - a.age);
}

export function analyze(docs: Doc[], payments: Payment[], now = new Date()): Analytics {
  const months = monthsBack(12, now);
  const idx: Record<string, number> = {};
  months.forEach((m, i) => { idx[m.key] = i; });
  const invoiced = months.map(() => 0), collected = months.map(() => 0), quoted = months.map(() => 0);

  const invoices = docs.filter((d) => d.type === INVOICE);
  const quotes = docs.filter((d) => d.type === 'QUOTATION');
  for (const d of docs) {
    const i = idx[(d.date || '').slice(0, 7)];
    if (i === undefined) continue;
    if (d.type === INVOICE) invoiced[i] += d.total;
    if (d.type === 'QUOTATION') quoted[i] += d.total;
  }
  for (const p of payments) { const i = idx[(p.date || '').slice(0, 7)]; if (i !== undefined) collected[i] += p.amount; }

  const invTotal = invoices.reduce((a, d) => a + d.total, 0);
  const colTotal = invoices.reduce((a, d) => a + Math.min(d.received, d.total), 0);
  const outstanding = invoices.reduce((a, d) => a + Math.max(0, d.total - d.received), 0);
  const last = months.length - 1;

  const typeColors: Record<string, string> = { 'GST INVOICE': 'var(--c1)', QUOTATION: 'var(--c3)', 'REPAIR BILL': 'var(--c5)', 'WORK ORDER': 'var(--c2)' };
  const typeLabels: Record<string, string> = { 'GST INVOICE': 'GST Invoices', QUOTATION: 'Quotations', 'REPAIR BILL': 'Repair Bills', 'WORK ORDER': 'Work Orders' };
  const typeMix = Object.keys(typeLabels).map((t) => {
    const list = docs.filter((d) => d.type === t);
    return { label: typeLabels[t], value: list.reduce((a, d) => a + d.total, 0), count: list.length, color: typeColors[t] };
  });

  const stat = (name: string) => docs.filter((d) => d.status === name).length;
  const known = ['Paid', 'Pending', 'Draft'];
  const status = [
    { label: 'Paid', count: stat('Paid'), color: 'var(--ok)' },
    { label: 'Pending', count: stat('Pending'), color: 'var(--warn)' },
    { label: 'Draft', count: stat('Draft'), color: 'var(--c1)' },
    { label: 'Other', count: docs.filter((d) => !known.includes(d.status)).length, color: 'var(--muted)' },
  ].filter((s) => s.count > 0);

  const byCustomer = new Map<string, { name: string; billed: number; received: number; outstanding: number }>();
  for (const d of invoices) {
    const name = d.customer || 'Walk-in';
    const row = byCustomer.get(name) || { name, billed: 0, received: 0, outstanding: 0 };
    row.billed += d.total; row.received += Math.min(d.received, d.total); row.outstanding += Math.max(0, d.total - d.received);
    byCustomer.set(name, row);
  }
  const topCustomers = [...byCustomer.values()].sort((a, b) => b.outstanding - a.outstanding || b.billed - a.billed).slice(0, 6);

  const buckets = [
    { label: '0–30 days', min: 0, max: 30, value: 0, count: 0 },
    { label: '31–60 days', min: 31, max: 60, value: 0, count: 0 },
    { label: '61–90 days', min: 61, max: 90, value: 0, count: 0 },
    { label: '90+ days', min: 91, max: 99999, value: 0, count: 0 },
  ];
  for (const d of invoices) {
    const due = d.total - d.received;
    if (due <= 0.5) continue;
    const age = Math.max(0, daysSince(d.date, now));
    const b = buckets.find((x) => age >= x.min && age <= x.max);
    if (b) { b.value += due; b.count += 1; }
  }

  const monthKey = months[last].key;
  return {
    months, invoiced, collected, quoted,
    totals: {
      invoiced: invTotal, collected: colTotal, outstanding,
      pipeline: quotes.reduce((a, d) => a + d.total, 0), quotations: quotes.length, invoices: invoices.length,
      collectionRate: invTotal > 0 ? Math.min(100, (colTotal / invTotal) * 100) : 0,
    },
    delta: { invoiced: pct(invoiced[last], invoiced[last - 1]), collected: pct(collected[last], collected[last - 1]) },
    thisMonth: { invoiced: invoiced[last], collected: collected[last], docs: docs.filter((d) => (d.date || '').startsWith(monthKey)).length },
    typeMix, status, topCustomers,
    aging: buckets.map(({ label, value, count }) => ({ label, value, count })),
  };
}
