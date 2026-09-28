import React, { useEffect, useState } from 'react';
import { Check, ImagePlus, Plus, Printer, Save, Trash2, WalletCards } from 'lucide-react';
import { type Customer, type Doc, type Letterhead, type LineItem, type Product, DOC_TYPES, api, fmtDate, money, printDocument, today } from './lib';
import { toast } from './bus';
import { ModalShell, Status } from './ui';
import { CustomerPicker, NewCustomerBox, emptyCustomer, type CustomerDraft } from './CustomerPicker';
import { modeIcon, typeMeta } from './pages/meta';

const emptyItem = (): LineItem => ({ product_id: null, description: '', qty: 1, rate: 0, gst: 18 });
const file64 = (file: File) => new Promise<string>((resolve) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.readAsDataURL(file); });
const MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card'];

function Upload({ label, hint, onFile, preview }: { label: string; hint: string; onFile: (f: File) => void; preview?: string }) {
  return (
    <label className={'dropzone' + (preview ? ' has' : '')}>
      <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      {preview ? <img src={preview} alt="" /> : <span className="dz-ico"><ImagePlus size={20} /></span>}
      <span className="dz-t"><b>{label}</b><small>{preview ? 'Click to replace' : hint}</small></span>
      {preview && <span className="dz-ok"><Check size={14} /></span>}
    </label>
  );
}

/* ───────────── Create / add forms ───────────── */
export function EntryModal({ type, customers, products, letters, letterMap, docs, onClose, onDone }: {
  type: string; customers: Customer[]; products: Product[]; letters: Letterhead[]; letterMap: Record<string, number | null>; docs: Doc[]; onClose: () => void; onDone: () => void;
}) {
  const [kind, arg] = type.split(':');
  const isDoc = kind === 'document';
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [form, setForm] = useState<any>({ type: isDoc ? (arg && DOC_TYPES.includes(arg) ? arg : 'GST INVOICE') : '', date: today(), notes: '', document_id: kind === 'payment' && arg ? arg : '', mode: '' });
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [letterheadTouched, setLetterheadTouched] = useState(false);
  const [files, setFiles] = useState<any>({});
  const [cust, setCust] = useState<CustomerDraft>(emptyCustomer());
  const [custOpen, setCustOpen] = useState(false);

  useEffect(() => {
    if (!isDoc || letterheadTouched) return;
    const mapped = letterMap[form.type];
    setForm((f: any) => ({ ...f, letterhead_id: mapped ? String(mapped) : '' }));
  }, [form.type, letterMap]);

  const setItem = (idx: number, patch: Partial<LineItem>) => setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const addItem = () => setItems((rows) => [...rows, emptyItem()]);
  const removeItem = (idx: number) => setItems((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== idx) : rows));
  const pickProduct = (idx: number, id: string) => {
    const p = products.find((x) => x.id === Number(id));
    if (!p) { setItem(idx, { product_id: null }); return; }
    setItem(idx, { product_id: p.id, description: p.name, rate: p.rate, gst: p.gst });
  };
  const totals = items.reduce((a, i) => { const amt = (Number(i.qty) || 0) * (Number(i.rate) || 0); return { subtotal: a.subtotal + amt, tax: a.tax + (amt * (Number(i.gst) || 0)) / 100 }; }, { subtotal: 0, tax: 0 });

  const dueInvoices = docs.filter((d) => d.type === 'GST INVOICE' && d.total > d.received);
  const selInv = docs.find((d) => String(d.id) === String(form.document_id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (kind === 'customer') await api('/customers', { method: 'POST', body: JSON.stringify({ name, phone: form.phone, email: form.email, gstin: form.gstin, address: form.address }) });
      else if (kind === 'product') await api('/products', { method: 'POST', body: JSON.stringify({ name, code: form.code, unit: form.unit || 'NOS', rate: Number(form.rate || 0), gst: Number(form.gst || 18), type: form.kind || 'Product', hsn: form.hsn || '', stock_qty: form.stock_qty === '' || form.stock_qty == null ? null : Number(form.stock_qty), low_stock_at: form.low_stock_at === '' || form.low_stock_at == null ? null : Number(form.low_stock_at) }) });
      else if (kind === 'letterhead') await api('/letterheads', { method: 'POST', body: JSON.stringify({ name, code: form.code, color: form.color || '#1c3a5e', header_data: files.header || '', stamp_data: files.stamp || '', footer_data: files.footer || '' }) });
      else if (kind === 'payment') await api('/payments', { method: 'POST', body: JSON.stringify({ document_id: Number(form.document_id), amount: Number(form.amount), date: form.date, mode: form.mode, reference: form.reference, notes: form.notes }) });
      else if (isDoc) {
        const clean = items.filter((i) => i.description.trim()).map((i) => ({ product_id: i.product_id ?? null, description: i.description, qty: Number(i.qty || 1), rate: Number(i.rate || 0), gst: Number(i.gst ?? 18) }));
        if (!clean.length) throw new Error('Add at least one item with a description.');
        // Customer: use the picked one, reuse a saved customer with the same name, or save the typed name as a new customer.
        let customerId: number | null = cust.id;
        const typed = cust.name.trim();
        if (!customerId && typed) {
          const existing = customers.find((c) => c.name.trim().toLowerCase() === typed.toLowerCase());
          if (existing) customerId = existing.id;
          else {
            const created = await api('/customers', { method: 'POST', body: JSON.stringify({ name: typed, phone: cust.phone.trim(), email: '', gstin: cust.gstin.trim().toUpperCase(), address: cust.address.trim() }) });
            customerId = Number(created.id);
            setCust({ ...cust, id: customerId });
          }
        }
        await api('/documents', { method: 'POST', body: JSON.stringify({ number: form.number || undefined, type: form.type, customer_id: customerId, letterhead_id: form.letterhead_id ? Number(form.letterhead_id) : null, date: form.date, due_date: form.due_date, status: form.type === 'GST INVOICE' ? 'Pending' : 'Draft', notes: form.notes, items: clean }) });
      }
      toast(kind === 'document' ? `${typeMeta(form.type).label} created` : kind === 'payment' ? 'Payment recorded' : kind === 'customer' ? 'Customer added' : kind === 'letterhead' ? 'Letterhead added' : 'Saved', 'success');
      await onDone();
    } catch (err: any) { toast('Could not save', 'error', err.message); } finally { setBusy(false); }
  };

  const titles: Record<string, [string, string]> = {
    document: ['Create business document', 'Quotations, invoices, repair bills and work orders.'],
    payment: ['Record payment', 'Log a receipt against a GST invoice.'],
    customer: ['Add customer', 'Store contact and GST details.'],
    product: ['Add product / service', 'Save a reusable line item.'],
    letterhead: ['Add letterhead', 'Upload branding artwork for printed documents.'],
  };
  const [title, sub] = titles[kind] || titles.customer;

  return (
    <ModalShell eyebrow={isDoc ? 'NEW DOCUMENT' : 'NEW ENTRY'} title={title} sub={sub} onClose={onClose} onSubmit={submit} wide={isDoc || kind === 'letterhead'} xwide={isDoc}
      footer={<>
        {isDoc && <div className="foot-total"><small>Grand total</small><b>{money(totals.subtotal + totals.tax)}</b></div>}
        <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? <span className="spinner" /> : <><Save size={17} /> Save</>}</button>
      </>}>
      {isDoc && (
        <>
          <div className="type-pick">
            {DOC_TYPES.map((t) => { const m = typeMeta(t); return (
              <button type="button" key={t} className={'tpk tone-' + m.tone + (form.type === t ? ' on' : '')} onClick={() => setForm({ ...form, type: t })}><m.icon size={17} />{m.label}</button>
            ); })}
          </div>
          <div className="two">
            <label className="field">Document number<input value={form.number || ''} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="Leave blank to auto-number (e.g. VIS/2026-27/94)" /></label>
            <label className="field">Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          </div>
          <div className="two">
                        <CustomerPicker customers={customers} value={cust} onChange={setCust} onOpenChange={setCustOpen} />
            <label className="field">Letterhead<select value={form.letterhead_id || ''} onChange={(e) => { setLetterheadTouched(true); setForm({ ...form, letterhead_id: e.target.value }); }}><option value="">Default / none</option>{letters.map((l) => <option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
          </div>
          <NewCustomerBox value={cust} onChange={setCust} hidden={custOpen} />
          <label className="field">Subject / Notes<input value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. Repair of 4 Door Refrigerator at Girls Hostel, FTII" /></label>

          <div className="section-label">Line items</div>
          <div className="items">
            <div className="item-row head"><span>Saved item</span><span>Description</span><span>Qty</span><span>Rate (₹)</span><span>GST %</span><span className="r">Amount</span><span /></div>
            {items.map((it, idx) => (
              <div className="item-row" key={idx}>
                <select value={it.product_id || ''} onChange={(e) => pickProduct(idx, e.target.value)}><option value="">Pick saved…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.stock_qty != null && p.low_stock_at != null && p.stock_qty <= p.low_stock_at ? ` (low stock: ${p.stock_qty})` : ''}</option>)}</select>
                <input placeholder="Description" required value={it.description} onChange={(e) => setItem(idx, { description: e.target.value })} />
                <input type="number" min="0.01" step="0.01" placeholder="Qty" value={it.qty} onFocus={(e) => e.target.select()} onChange={(e) => setItem(idx, { qty: Number(e.target.value) })} />
                <input type="number" min="0" step="0.01" placeholder="Rate" value={it.rate} onFocus={(e) => e.target.select()} onChange={(e) => setItem(idx, { rate: Number(e.target.value) })} />
                <input type="number" min="0" step="0.01" placeholder="GST %" value={it.gst} onFocus={(e) => e.target.select()} onChange={(e) => setItem(idx, { gst: Number(e.target.value) })} />
                <span className="amt r">{money((Number(it.qty) || 0) * (Number(it.rate) || 0) * (1 + (Number(it.gst) || 0) / 100))}</span>
                <button type="button" className="icon-btn danger" onClick={() => removeItem(idx)} aria-label="Remove item"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
          <div className="items-foot">
            <button type="button" className="btn ghost" onClick={addItem}><Plus size={15} /> Add item</button>
            <div className="totals-card">
              <span>Subtotal <b>{money(totals.subtotal)}</b></span>
              <span>CGST <b>{money(totals.tax / 2)}</b></span>
              <span>SGST <b>{money(totals.tax / 2)}</b></span>
              <span className="grand">Total <b>{money(totals.subtotal + totals.tax)}</b></span>
            </div>
          </div>
        </>
      )}

      {kind === 'payment' && (
        <>
          <label className="field">Invoice<select required value={form.document_id || ''} onChange={(e) => setForm({ ...form, document_id: e.target.value })}><option value="">Select invoice</option>{dueInvoices.map((d) => <option key={d.id} value={d.id}>{d.number} · {money(d.total - d.received)} due</option>)}</select></label>
          {selInv && (
            <div className="inv-summary">
              <div><small>Customer</small><b>{selInv.customer || 'Walk-in'}</b></div>
              <div><small>Invoice total</small><b>{money(selInv.total)}</b></div>
              <div><small>Received</small><b>{money(selInv.received)}</b></div>
              <div><small>Balance due</small><b className="due">{money(selInv.total - selInv.received)}</b></div>
              <button type="button" className="btn ghost sm" onClick={() => setForm({ ...form, amount: String(Math.round((selInv.total - selInv.received) * 100) / 100) })}>Pay full balance</button>
            </div>
          )}
          <div className="two">
            <label className="field">Amount (₹)<input type="number" min="0.01" step="0.01" required value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
            <label className="field">Date<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          </div>
          <div className="field">Payment mode
            <div className="mode-pick">{MODES.map((m) => { const M = modeIcon(m); return <button type="button" key={m} className={form.mode === m ? 'on' : ''} onClick={() => setForm({ ...form, mode: m })}><M size={16} />{m}</button>; })}</div>
          </div>
          <label className="field">Reference<input value={form.reference || ''} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="UTR / cheque no. / transaction id" /></label>
        </>
      )}

      {kind === 'customer' && (
        <>
          <label className="field">Customer name<input autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="two"><label className="field">Phone<input onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label><label className="field">GSTIN<input onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></label></div>
          <label className="field">Email<input type="email" onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="field">Address<textarea onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        </>
      )}

      {kind === 'product' && (
        <>
          <label className="field">Name<input autoFocus required value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="two"><label className="field">Code<input onChange={(e) => setForm({ ...form, code: e.target.value })} /></label><label className="field">Unit<input value={form.unit || 'NOS'} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label></div>
          <div className="two"><label className="field">Rate<input type="number" onChange={(e) => setForm({ ...form, rate: e.target.value })} /></label><label className="field">GST %<input type="number" value={form.gst ?? 18} onChange={(e) => setForm({ ...form, gst: e.target.value })} /></label></div>
          <label className="field">HSN / SAC code <em className="hint">shown on GST invoices</em><input value={form.hsn || ''} onChange={(e) => setForm({ ...form, hsn: e.target.value })} placeholder="e.g. 8544 or 9954" /></label>
          <div className="two">
            <label className="field">Stock on hand <em className="hint">leave blank for services</em><input type="number" value={form.stock_qty ?? ''} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} /></label>
            <label className="field">Low-stock alert below <em className="hint">optional</em><input type="number" value={form.low_stock_at ?? ''} onChange={(e) => setForm({ ...form, low_stock_at: e.target.value })} /></label>
          </div>
        </>
      )}

      {kind === 'letterhead' && (
        <>
          <label className="field">Letterhead name<input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vishwa Infra Invoice Letterhead" /></label>
          <div className="two">
            <label className="field">Short code <em className="hint">invoice number prefix</em><input value={form.code || ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g. VIS" maxLength={6} /></label>
            <div className="field">Brand colour <em className="hint">used on printed documents</em>
              <div className="color-row"><input type="color" value={form.color || '#1c3a5e'} onChange={(e) => setForm({ ...form, color: e.target.value })} /><span>{form.color || '#1c3a5e'}</span></div>
            </div>
          </div>
          <div className="three">
            <Upload label="Header image" hint="Top banner" onFile={async (f) => setFiles({ ...files, header: await file64(f) })} preview={files.header} />
            <Upload label="Stamp / signature" hint="PNG with transparency" onFile={async (f) => setFiles({ ...files, stamp: await file64(f) })} preview={files.stamp} />
            <Upload label="Footer image" hint="GSTIN / address strip" onFile={async (f) => setFiles({ ...files, footer: await file64(f) })} preview={files.footer} />
          </div>
        </>
      )}
    </ModalShell>
  );
}

/* ───────────── Document preview ───────────── */
export function ViewModal({ id, customers, letters, onClose, onPay }: { id: number; customers: Customer[]; letters: Letterhead[]; onClose: () => void; onPay: (id: number) => void }) {
  const [view, setView] = useState<any>(null);
  useEffect(() => { api('/documents/' + id).then(setView).catch((e) => toast('Could not load document', 'error', e.message)); }, [id]);
  const lh = letters.find((l) => l.id === view?.letterhead_id);
  const cust = customers.find((c) => c.id === view?.customer_id);
  const tax = view?.tax || 0;
  const meta = view ? typeMeta(view.type) : null;
  return (
    <ModalShell eyebrow={meta ? meta.label.toUpperCase() : 'DOCUMENT'} title={view?.number || 'Loading…'} sub={view ? `${fmtDate(view.date)} · ${view.type}` : undefined} onClose={onClose} wide xwide
      footer={<>
        <button className="btn ghost" onClick={onClose}>Close</button>
        {view?.type === 'GST INVOICE' && <button className="btn ghost" onClick={() => onPay(view.id)}><WalletCards size={16} /> Record payment</button>}
        <button className="btn primary" disabled={!view} onClick={() => view && printDocument(view.id)}><Printer size={16} /> Print / Save as PDF</button>
      </>}>
      {!view ? <div className="skel skel-sheet" /> : (
        <div className="sheet-stage">
          <div className="sheet">
            {lh?.header_data ? <img className="sheet-img" src={lh.header_data} alt="" /> : <div className="sheet-band" style={{ background: lh?.color || 'var(--brand)' }}><b>{lh?.name || 'No letterhead selected'}</b></div>}
            <div className="sheet-body">
              <div className="sheet-meta">
                <div><small>{view.type === 'QUOTATION' ? 'Quote to' : 'Bill to'}</small><b>{cust?.name || 'Walk-in customer'}</b>{cust?.address && <span>{cust.address}</span>}{cust?.gstin && <span>GSTIN {cust.gstin}</span>}</div>
                <div className="r"><small>Document no.</small><b>{view.number}</b><span>{fmtDate(view.date)}</span><Status s={view.status} /></div>
              </div>
              {view.notes && <div className="sheet-subject"><small>Subject</small>{view.notes}</div>}
              <table>
                <thead><tr><th>#</th><th>Description</th><th className="r">Qty</th><th className="r">Rate</th><th className="r">GST</th><th className="r">Amount</th></tr></thead>
                <tbody>{view.items?.map((i: any, n: number) => <tr key={i.id}><td>{n + 1}</td><td>{i.description}</td><td className="r">{i.qty}</td><td className="r">{money(i.rate)}</td><td className="r">{i.gst}%</td><td className="r"><b>{money(i.amount + (i.amount * i.gst) / 100)}</b></td></tr>)}</tbody>
              </table>
              <div className="totals-card sheet-totals">
                <span>Subtotal <b>{money(view.subtotal)}</b></span><span>CGST <b>{money(tax / 2)}</b></span><span>SGST <b>{money(tax / 2)}</b></span>
                <span className="grand">Grand total <b>{money(view.total)}</b></span>
              </div>
              {lh?.stamp_data && <img className="sheet-stamp" src={lh.stamp_data} alt="" />}
            </div>
            {lh?.footer_data && <img className="sheet-img foot" src={lh.footer_data} alt="" />}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
