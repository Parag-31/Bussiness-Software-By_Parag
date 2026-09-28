import { toast } from './bus';

export type Customer = { id: number; name: string; phone: string; email: string; gstin: string; address: string };
export type Product = { id: number; name: string; code: string; unit: string; rate: number; gst: number; type: string; hsn?: string; stock_qty?: number | null; low_stock_at?: number | null };
export type Doc = { id: number; number: string; type: string; customer?: string; customer_id?: number; letterhead_id?: number; date: string; due_date?: string; status: string; total: number; received: number; letterhead?: string; notes?: string };
export type Payment = { id: number; document_id: number; amount: number; date: string; mode: string; reference: string; customer?: string; number: string; document_total: number };
export type Letterhead = { id: number; name: string; code: string; color?: string; header_data?: string; stamp_data?: string; footer_data?: string; active: number };
export type User = { id: number; name: string; username: string; role: string; access?: string; designation?: string | null; must_change?: boolean; totp_enabled?: boolean };
export type LineItem = { product_id?: number | null; description: string; qty: number; rate: number; gst: number };
export type Summary = { sales: number; received: number; documents: number; customers: number; quotations: number; invoices: number };
export type ActivityEntry = { id: number; user_id: number | null; user_name: string | null; action: string; entity_type: string; entity_id: number | null; detail: string; created_at: string };

/** Credit line shown under the logo (sidebar and login screen). */
export const CREDIT = 'Neurava AI by Parag';

export const DOC_TYPES = ['QUOTATION', 'GST INVOICE', 'REPAIR BILL', 'WORK ORDER'];

export const api = async (path: string, opts: RequestInit = {}) => {
  const token = localStorage.getItem('vishwa_token');
  const r = await fetch('/api' + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) } });
  const raw = await r.text();
  let j: any;
  try { j = JSON.parse(raw); } catch {
    // The server sent a web page instead of data — surface what it actually said so the cause is visible.
    const detail = raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
    throw new Error(`Server error ${r.status}${detail ? ': ' + detail : ''}. If you just updated the app, close its window and start it again with Start-Vishwa-Infra.bat.`);
  }
  if (r.status === 401) { localStorage.removeItem('vishwa_token'); throw new Error('AUTH_REQUIRED'); }
  if (!j.ok) throw new Error(j.error || 'Request failed');
  return j.data;
};

export const money = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const trim = (x: number) => {
  const s = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
};
/** Indian-style compact currency: ₹4.2L, ₹1.8Cr. */
export function moneyCompact(n: number): string {
  const v = Math.abs(n || 0), s = n < 0 ? '-' : '';
  if (v >= 1e7) return `${s}₹${trim(v / 1e7)}Cr`;
  if (v >= 1e5) return `${s}₹${trim(v / 1e5)}L`;
  if (v >= 1e3) return `${s}₹${trim(v / 1e3)}K`;
  return `${s}₹${Math.round(v)}`;
}

export const today = () => new Date().toISOString().slice(0, 10);

export function fmtDate(s?: string): string {
  if (!s) return '—';
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function initials(name?: string): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '?') + (parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || '')).toUpperCase();
}

export function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }

/** Mixes a hex color toward white for soft background tints in letterhead previews. */
export function tintHex(hex?: string, amount = 0.85): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#eef2f6';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Opens a document's print-ready page (header/footer letterhead, CGST/SGST, amount in words) in a new tab. */
export async function printDocument(id: number) {
  const token = localStorage.getItem('vishwa_token');
  const r = await fetch(`/api/documents/${id}/print`, { headers: { Authorization: `Bearer ${token}` } });
  const html = await r.text();
  const w = window.open('', '_blank');
  if (!w) { toast('Pop-up blocked', 'error', 'Please allow pop-ups for this site to print documents.'); return; }
  w.document.write(html);
  w.document.close();
}

/** Downloads a full copy of the SQLite database file as a timestamped backup. */
export async function downloadBackup() {
  const token = localStorage.getItem('vishwa_token');
  const r = await fetch('/api/backup', { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { toast('Backup failed', 'error'); return; }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `vishwa-backup-${today()}.db`; a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded', 'success', 'Keep a copy somewhere other than this computer.');
}

/** Whether the server has DROPBOX_ACCESS_TOKEN configured (server/.env). */
export const cloudBackupStatus = () => api('/backup/cloud-status') as Promise<{ configured: boolean; provider: string | null }>;

/** Uploads the current database straight to Dropbox via the server. */
export async function backupToCloud() {
  try {
    const r = await api('/backup/cloud', { method: 'POST' });
    toast('Backed up to Dropbox', 'success', r.name);
  } catch (e: any) {
    toast('Cloud backup failed', 'error', e.message);
  }
}

/** Starts two-factor setup: server generates (but doesn't yet enable) a secret and returns a QR code. */
export const start2faSetup = () => api('/auth/2fa/setup', { method: 'POST' }) as Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }>;
/** Confirms setup with one code from the authenticator app; only this turns 2FA on. */
export const confirm2fa = (code: string) => api('/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ code }) }) as Promise<{ enabled: boolean }>;
/** Turns 2FA off — requires the current password as a safety check. */
export const disable2fa = (password: string) => api('/auth/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) }) as Promise<{ enabled: boolean }>;

/** LAN address(es) this computer is reachable at, for "open on your phone" in Settings. */
export const networkInfo = () => api('/network-info') as Promise<{ port: number; addresses: string[]; qrDataUrl?: string }>;

/** Downloads any authenticated GET endpoint's response as a file (used for CSV exports). */
export async function downloadFile(path: string, filename: string) {
  const token = localStorage.getItem('vishwa_token');
  const r = await fetch('/api' + path, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) { toast('Export failed', 'error'); return; }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Opens WhatsApp (web or app) with a chat to the given phone number and a prefilled message. Strips everything but digits and assumes India (+91) if no country code was entered. */
export function whatsappShare(phone: string, message: string) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) { toast('No phone number on file', 'error', 'Add one to this customer first.'); return; }
  const withCountry = digits.length === 10 ? '91' + digits : digits;
  window.open(`https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`, '_blank');
}

/** Opens the user's email client with a prefilled recipient, subject and body. */
export function emailShare(to: string, subject: string, body: string) {
  if (!to) { toast('No email on file', 'error', 'Add one to this customer first.'); return; }
  window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
