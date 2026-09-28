import { rupeesInWords } from './utils.js';

type Item = { description: string; qty: number; rate: number; gst: number; amount: number };
type PrintInput = {
  doc: { number: string; type: string; date: string; due_date?: string; notes?: string; subtotal: number; tax: number; total: number; status: string };
  items: Item[];
  customer?: { name: string; address?: string; gstin?: string } | null;
  letterhead?: { name: string; header_data?: string; footer_data?: string; stamp_data?: string; color?: string } | null;
  company: { name: string; gstin?: string; upi_id?: string };
  /** Pre-generated "scan & pay" QR code (data: URL), rendered by the caller via the `qrcode`
   *  package since QR generation isn't something this template should have to know how to do. */
  upiQrDataUrl?: string;
};

/** Mixes a hex color toward white by `amount` (0-1) to make a soft tint for subtotal rows. */
function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#eaf1fb';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
const money = (n: number) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const fmtDate = (s?: string) => {
  if (!s) return '';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
};

function baseCss(accent: string): string {
  const tintColorSoft = tint(accent, 0.96);
  const lineColor = tint(accent, 0.65);
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { font-family: 'Georgia', 'Times New Roman', serif; color: #1f2733; margin: 0; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; position: relative; padding-bottom: 40mm; overflow: hidden; }
  .header-img, .footer-img { width: 100%; display: block; }
  .footer-img { position: absolute; left: 0; bottom: 0; }
  .accent-rule { height: 2px; background: ${accent}; width: 100%; }
  .body-pad { padding: 10mm 14mm 6mm; position: relative; z-index: 1; }
  .watermark { position: absolute; top: 40mm; left: 0; right: 0; text-align: center; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 74px; letter-spacing: 6px; color: ${accent}; opacity: .035; transform: rotate(-18deg); z-index: 0; pointer-events: none; user-select: none; }
  .row-flex { display: flex; justify-content: space-between; gap: 14px; align-items: stretch; }
  .info-card { flex: 1; background: ${tintColorSoft}; border: 1px solid ${lineColor}; border-top: 3px solid ${accent}; border-radius: 4px; padding: 10px 14px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; }
  .info-card + .info-card { text-align: right; }
  .label { font-weight: 700; color: ${accent}; text-transform: uppercase; letter-spacing: .6px; font-size: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6mm; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11.5px; }
  th { background: ${tintColorSoft}; color: ${accent}; border-top: 2px solid ${accent}; border-bottom: 2px solid ${accent}; padding: 9px 10px; text-align: left; font-size: 10px; letter-spacing: .4px; text-transform: uppercase; font-weight: 700; }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e9f0; vertical-align: top; font-size: 11.5px; }
  tbody tr:nth-child(even):not(.subtotal-row):not(.grand-row) td { background: ${tintColorSoft}; }
  tr.subtotal-row td { background: #fafbfc; border-bottom: 1px solid #eef1f5; font-weight: 700; color: #45505f; font-size: 11px; }
  tr.grand-row td { background: ${tintColorSoft}; color: ${accent}; font-weight: 800; font-size: 15px; padding: 12px 10px; border-top: 2px solid ${accent}; border-bottom: 3px double ${accent}; }
  .right { text-align: right; }
  .center { text-align: center; }
  .words { margin-top: 8mm; font-style: italic; border-top: 1px solid ${lineColor}; border-bottom: 1px solid ${lineColor}; padding: 8px 2px; font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; }
  .words b { color: ${accent}; font-style: normal; }
  .sign-block { margin-top: 14mm; display: flex; justify-content: flex-end; }
  .sign-block img { height: 26mm; }
  .status-pill { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 10px; font-weight: 700; background: #fff; color: ${accent}; letter-spacing: .5px; border: 1.5px solid ${accent}; }
  .doc-title { color: ${accent}; letter-spacing: 1px; border-bottom: 2px solid ${accent}; display: inline-block; padding-bottom: 4px; }
  .doc-ribbon { position: absolute; top: 8mm; right: 14mm; background: #fff; color: ${accent}; font-family: 'Segoe UI', Arial, sans-serif; font-weight: 800; font-size: 10.5px; letter-spacing: 1.6px; padding: 5px 16px; border: 1.5px solid ${accent}; border-radius: 20px; z-index: 2; }
  .print-bar { position: sticky; top: 0; background: #101827; color: #fff; padding: 10px 16px; display: flex; gap: 10px; align-items: center; font-family: Arial, sans-serif; z-index: 10; }
  .print-bar button { background: ${accent}; color: #fff; border: 0; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 13px; }
  .print-bar span { font-size: 12px; opacity: .8; }
  @media print { .print-bar { display: none; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;
}

function invoiceBody(input: PrintInput): string {
  const { doc, items, customer, letterhead, company } = input;
  const cgst = doc.tax / 2, sgst = doc.tax / 2;
  const rows = items.map((i, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${esc(i.description).replace(/\n/g, '<br/>')}</td>
      <td class="center">${i.qty}</td>
      <td class="right">${money(i.rate)}</td>
      <td class="right">${money(i.amount)}</td>
      <td class="center">${i.gst}%</td>
      <td class="right">${money(i.amount * i.gst / 100)}</td>
      <td class="right">${money(i.amount + i.amount * i.gst / 100)}</td>
    </tr>`).join('');
  return `
    <div class="watermark">${esc(doc.type)}</div>
    <div class="doc-ribbon">${esc(doc.type)}</div>
    <div class="body-pad">
      <div class="row-flex">
        <div class="info-card">
          <div class="label">To</div>
          <div style="font-weight:700;font-size:13px;margin-top:2px">${esc(customer?.name || 'Walk-in Customer')}</div>
          <div style="margin-top:2px">${esc(customer?.address || '')}</div>
          ${customer?.gstin ? `<div style="margin-top:2px">GSTIN: ${esc(customer.gstin)}</div>` : ''}
        </div>
        <div class="info-card">
          <div class="label">${esc(doc.type)} Details</div>
          <div style="margin-top:2px">No: <b>${esc(doc.number)}</b></div>
          <div>Date: ${fmtDate(doc.date)}</div>
          ${doc.due_date ? `<div>Due: ${fmtDate(doc.due_date)}</div>` : ''}
          <div style="margin-top:6px"><span class="status-pill">${esc(doc.status)}</span></div>
        </div>
      </div>
      ${doc.notes ? `<p style="margin-top:8mm"><span class="label" style="font-style:normal">Subject :- </span>${esc(doc.notes)}</p>` : ''}
      <table>
        <thead><tr><th>Sr.</th><th>Item / Description</th><th>Qty</th><th>Unit Price</th><th>Base Amount</th><th>GST %</th><th>GST Amount</th><th>Total</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="subtotal-row"><td colspan="6" class="right">CGST</td><td class="right">${money(cgst)}</td><td></td></tr>
          <tr class="subtotal-row"><td colspan="6" class="right">SGST</td><td class="right">${money(sgst)}</td><td></td></tr>
          <tr class="subtotal-row"><td colspan="6" class="right">Sub Total (Before GST)</td><td class="right">${money(doc.subtotal)}</td><td></td></tr>
          <tr class="grand-row"><td colspan="7" class="right">GRAND TOTAL (Incl. GST)</td><td class="right">${money(doc.total)}</td></tr>
        </tbody>
      </table>
      <div class="words">In Words :- <b>${esc(rupeesInWords(doc.total))}</b></div>
      <div class="bottom-flex" style="display:flex;align-items:flex-end;justify-content:space-between;gap:10mm;margin-top:4mm;">
        ${input.upiQrDataUrl && company.upi_id && doc.type !== 'QUOTATION' ? `
        <div class="pay-box" style="display:flex;align-items:center;gap:3mm;">
          <img src="${input.upiQrDataUrl}" alt="UPI QR code" style="width:24mm;height:24mm;border:1px solid #d8dee6;border-radius:2mm;" />
          <div style="font-size:9.5px;line-height:1.5;">
            <div style="font-weight:700;font-size:10.5px;">Scan &amp; Pay via UPI</div>
            <div>${esc(company.upi_id)}</div>
            <div>Amount: ${money(doc.total)}</div>
          </div>
        </div>` : '<div></div>'}
        <div class="sign-block" style="margin-top:0;">
          ${letterhead?.stamp_data ? `<img src="${letterhead.stamp_data}" />` : ''}
        </div>
      </div>
    </div>`;
}

function letterBody(input: PrintInput): string {
  const { doc, items, customer, letterhead } = input;
  const scope = items.map((i) => `<li>${esc(i.description)}</li>`).join('');
  return `
    <div class="watermark">${esc(doc.type)}</div>
    <div class="body-pad" style="font-family:'Segoe UI',Arial,sans-serif">
      <p class="right">Date: ${fmtDate(doc.date)}</p>
      <h2 class="center"><span class="doc-title">${esc(doc.type)}</span></h2>
      <p><b>To,</b><br/>${esc(customer?.name || 'Recipient')}${customer?.address ? '<br/>' + esc(customer.address) : ''}</p>
      ${doc.notes ? `<p><b>SUBJECT: ${esc(doc.notes)}</b></p>` : ''}
      ${items.length ? `<p>Scope of work:</p><ul>${scope}</ul>` : ''}
      <p style="margin-top:10mm">Thanking you.</p>
      <div style="margin-top:14mm">
        ${letterhead?.stamp_data ? `<img src="${letterhead.stamp_data}" style="height:26mm"/>` : ''}
      </div>
    </div>`;
}

export function renderDocumentPrintPage(input: PrintInput, forPrintOnly = false): string {
  const { doc, letterhead } = input;
  const accent = letterhead?.color || '#1c3a5e';
  const isLetter = doc.type === 'WORK ORDER';
  const body = isLetter ? letterBody(input) : invoiceBody(input);
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(doc.number)} — ${esc(doc.type)}</title>
  <style>${baseCss(accent)}</style></head><body>
  ${forPrintOnly ? '' : `<div class="print-bar"><button onclick="window.print()">Print / Save as PDF</button><span>${esc(doc.number)} &middot; ${esc(doc.type)}</span></div>`}
  <div class="sheet">
    ${letterhead?.header_data ? `<img class="header-img" src="${letterhead.header_data}"/>` : `<div class="body-pad"><h2>${esc(input.company.name)}</h2></div>`}
    <div class="accent-rule"></div>
    ${body}
    ${letterhead?.footer_data ? `<img class="footer-img" src="${letterhead.footer_data}"/>` : ''}
  </div>
  </body></html>`;
}
