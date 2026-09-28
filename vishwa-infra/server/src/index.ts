import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import QRCode from 'qrcode';
import { financialYear } from './utils.js';
import { generateTotpSecret, verifyTotp, otpAuthUrl } from './totp.js';
import { renderDocumentPrintPage } from './print.js';
import { SEED_LETTERHEADS } from './seed-letterheads.js';
import { applyLetterheadPack } from './letterhead-pack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, 'vishwa.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const DOC_TYPES = ['QUOTATION', 'GST INVOICE', 'REPAIR BILL', 'WORK ORDER'] as const;

db.exec(`
CREATE TABLE IF NOT EXISTS company_settings(id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, gstin TEXT, phone TEXT, email TEXT, address TEXT, proprietor TEXT, currency TEXT DEFAULT 'INR');
INSERT OR IGNORE INTO company_settings(id,name) VALUES(1,'VISHWA INFRA SOLUTIONS INDIA PRIVATE LIMITED');
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT DEFAULT 'Admin', active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS customers(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT, email TEXT, gstin TEXT, address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, code TEXT, unit TEXT DEFAULT 'NOS', rate REAL DEFAULT 0, gst REAL DEFAULT 18, type TEXT DEFAULT 'Product');
CREATE TABLE IF NOT EXISTS letterheads(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, header_data TEXT, stamp_data TEXT, footer_data TEXT, active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS letterhead_mappings(doc_type TEXT PRIMARY KEY, letterhead_id INTEGER, FOREIGN KEY(letterhead_id) REFERENCES letterheads(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY AUTOINCREMENT, number TEXT NOT NULL UNIQUE, type TEXT NOT NULL, customer_id INTEGER, letterhead_id INTEGER, date TEXT NOT NULL, due_date TEXT, status TEXT DEFAULT 'Draft', subtotal REAL DEFAULT 0, tax REAL DEFAULT 0, total REAL DEFAULT 0, notes TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL, FOREIGN KEY(letterhead_id) REFERENCES letterheads(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS document_items(id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL, product_id INTEGER, description TEXT NOT NULL, qty REAL DEFAULT 1, rate REAL DEFAULT 0, gst REAL DEFAULT 18, amount REAL DEFAULT 0, FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE, FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT, document_id INTEGER NOT NULL, amount REAL NOT NULL, date TEXT NOT NULL, mode TEXT, reference TEXT, notes TEXT, FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS activity_log(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, user_name TEXT, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER, detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

// Idempotent migrations: a short "code" column (used as the prefix in
// auto-generated document numbers, e.g. VIS/2026-27/93) and a brand "color"
// column (hex) used to theme each letterhead's printed documents.
try { db.exec(`ALTER TABLE letterheads ADD COLUMN code TEXT`); } catch { /* already exists */ }
try { db.exec(`ALTER TABLE letterheads ADD COLUMN color TEXT DEFAULT '#1c3a5e'`); } catch { /* already exists */ }
// Older databases may have a company_settings table without some columns; add any that are missing.
for (const col of ["gstin TEXT", "phone TEXT", "email TEXT", "address TEXT", "proprietor TEXT", "currency TEXT DEFAULT 'INR'"]) {
  try { db.exec(`ALTER TABLE company_settings ADD COLUMN ${col}`); } catch { /* already exists */ }
}
// Product catalogue additions: HSN/SAC code (for GST invoices) and basic stock tracking.
for (const col of ["hsn TEXT", "stock_qty REAL", "low_stock_at REAL"]) {
  try { db.exec(`ALTER TABLE products ADD COLUMN ${col}`); } catch { /* already exists */ }
}
// "Who did this" columns, added without disturbing existing data (NULL on old rows).
for (const col of ["created_by INTEGER", "updated_by INTEGER"]) {
  try { db.exec(`ALTER TABLE documents ADD COLUMN ${col}`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE payments ADD COLUMN ${col}`); } catch { /* already exists */ }
  try { db.exec(`ALTER TABLE customers ADD COLUMN ${col}`); } catch { /* already exists */ }
}

// Seed the three real letterheads (with your actual header/footer artwork and
// signature+stamp) on first run only, and wire up sensible default mappings
// per document type so new documents pick the right branding automatically.
if ((db.prepare('SELECT COUNT(*) c FROM letterheads').get() as any).c === 0) {
  const insert = db.prepare('INSERT INTO letterheads(name,code,color,header_data,stamp_data,footer_data) VALUES(?,?,?,?,?,?)');
  const mapUpsert = db.prepare(`INSERT INTO letterhead_mappings(doc_type,letterhead_id) VALUES(?,?) ON CONFLICT(doc_type) DO UPDATE SET letterhead_id=excluded.letterhead_id`);
  for (const lh of SEED_LETTERHEADS) {
    const r = insert.run(lh.name, lh.code, lh.color, lh.header_data, lh.stamp_data, lh.footer_data);
    for (const docType of lh.default_for) mapUpsert.run(docType, r.lastInsertRowid);
  }
}

// Apply the supplied letterhead artwork (header/footer/stamp) once per database.
try {
  const packResult = applyLetterheadPack(db);
  if (packResult.updated.length || packResult.created.length) console.log('Letterheads updated:', packResult.updated.join(', ') || '-', '| created:', packResult.created.join(', ') || '-');
} catch (e) { console.error('Letterhead pack could not be applied:', e); }

/** Uploads a file to Dropbox via a long-lived access token (no OAuth dance —
 *  the user pastes one generated token from their Dropbox App Console into
 *  server/.env). Does nothing if DROPBOX_ACCESS_TOKEN isn't set. Throws on
 *  failure so callers can log/report it; never called in a way that blocks
 *  the request or server startup on a slow/failed upload. */
async function uploadToDropbox(filePath: string, remoteName: string): Promise<void> {
  const token = process.env.DROPBOX_ACCESS_TOKEN;
  if (!token) return;
  const folder = (process.env.DROPBOX_FOLDER || '/Vishwa Infra Backups').replace(/\/+$/, '');
  const dest = `${folder}/${remoteName}`;
  const data = fs.readFileSync(filePath);
  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path: dest, mode: 'overwrite', autorename: false, mute: true }),
    },
    body: data,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Dropbox rejected the upload (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
}

// Automatic daily backup: on every startup, copy the database into backups/
// if the most recent backup there is missing or more than 24 hours old.
// Keeps the last 30 backups so this never grows unbounded. This is on top
// of, not instead of, the manual "Download database backup" button and
// Backup-Database.bat — it just means a backup exists even if nobody
// remembers to make one.
try {
  const backupsDir = path.resolve(__dirname, '../../backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const existing = fs.readdirSync(backupsDir).filter((f) => f.startsWith('vishwa-backup-') && f.endsWith('.db')).sort();
  const last = existing[existing.length - 1];
  const lastTime = last ? fs.statSync(path.join(backupsDir, last)).mtimeMs : 0;
  if (Date.now() - lastTime > 24 * 60 * 60 * 1000) {
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const backupName = `vishwa-backup-${stamp}.db`;
    fs.copyFileSync(path.join(dataDir, 'vishwa.db'), path.join(backupsDir, backupName));
    const all = fs.readdirSync(backupsDir).filter((f) => f.startsWith('vishwa-backup-') && f.endsWith('.db')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 30))) fs.unlinkSync(path.join(backupsDir, old));
    console.log('Automatic daily backup created.');
    // Fire-and-forget: a slow or failed cloud upload should never delay
    // startup or take down the app. If DROPBOX_ACCESS_TOKEN isn't set this
    // resolves immediately and does nothing.
    uploadToDropbox(path.join(backupsDir, backupName), backupName)
      .then(() => console.log('Backup also uploaded to Dropbox.'))
      .catch((e) => console.error('Dropbox backup upload failed (local backup is still safe):', e.message));
  }
} catch (e) { console.error('Automatic backup could not be created:', e); }

function hashPassword(password: string) { const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.scryptSync(password, salt, 64).toString('hex'); return `${salt}:${hash}`; }
function verifyPassword(password: string, stored: string) { const [salt, hash] = stored.split(':'); if (!salt || !hash) return false; const a = Buffer.from(hash, 'hex'); const b = crypto.scryptSync(password, salt, 64); return a.length === b.length && crypto.timingSafeEqual(a, b); }
// Temp passwords come from server/.env (see .env.example) when present, so
// they don't have to live in this file or in version control. If no .env
// is set up, the same defaults as before are used — nothing breaks for
// existing installs.
if (!(db.prepare('SELECT id FROM users LIMIT 1').get())) db.prepare('INSERT INTO users(name,username,password_hash,role) VALUES(?,?,?,?)').run('Administrator', 'admin', hashPassword(process.env.ADMIN_TEMP_PASSWORD || 'admin123'), 'Admin');
// Extra user columns: a job title shown in the app, and a flag that forces a new password on first login.
try { db.exec(`ALTER TABLE users ADD COLUMN designation TEXT`); } catch { /* already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN must_change INTEGER DEFAULT 0`); } catch { /* already exists */ }
// Optional two-factor login (TOTP, e.g. Google/Microsoft Authenticator).
// totp_secret is only ever sent to the client once, during setup.
try { db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT`); } catch { /* already exists */ }
try { db.exec(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER DEFAULT 0`); } catch { /* already exists */ }
// UPI ID (VPA) for the "scan to pay" QR code on printed invoices. Optional —
// documents print exactly as before if this is left blank.
try { db.exec(`ALTER TABLE company_settings ADD COLUMN upi_id TEXT`); } catch { /* already exists */ }
db.prepare("UPDATE users SET designation='Administrator' WHERE username='admin' AND (designation IS NULL OR designation='')").run();
// Team logins. Created once; each must choose a new password at first sign-in.
// Parag (builder of the app, Project Manager) gets Full Access ('Admin').
// Vishwas (Managing Director) gets the same day-to-day business access but a
// 'Manager' role, shown in the app as "Access (No Build)". The role itself
// isn't checked by any in-app route (both logins reach every business
// feature) — Repair-And-Rebuild.bat and Start-Developer-Mode.bat separately
// ask for a developer PIN, which is the actual gate on rebuilding the app.
const TEAM_USERS = [
  { name: 'Parag Udgirkar', username: 'parag', designation: 'Project Manager', role: 'Admin', temp: process.env.PARAG_TEMP_PASSWORD || 'Parag@2026' },
  { name: 'Vishwas Chorge', username: 'vishwas', designation: 'Managing Director', role: 'Manager', temp: process.env.VISHWAS_TEMP_PASSWORD || 'Vishwas@2026' },
];
for (const t of TEAM_USERS) {
  if (!db.prepare('SELECT id FROM users WHERE username=?').get(t.username)) {
    db.prepare('INSERT INTO users(name,username,password_hash,role,designation,must_change) VALUES(?,?,?,?,?,1)').run(t.name, t.username, hashPassword(t.temp), t.role, t.designation);
  } else {
    // Keep an already-created account's role in sync with the table above
    // (covers installs where this seed ran before the role split existed).
    db.prepare('UPDATE users SET role=? WHERE username=? AND role<>?').run(t.role, t.username, t.role);
  }
}
// end team seed
const userPayload = (u: any) => ({ id: u.id, name: u.name, username: u.username, role: u.role, access: u.role === 'Admin' ? 'Full Access' : 'Access (No Build)', designation: u.designation || null, must_change: !!u.must_change, totp_enabled: !!u.totp_enabled });

/** Generates the next document number for a type/letterhead/date, e.g. VIS/2026-27/94.
 *  Based on the highest existing sequence number for that prefix+year, not a
 *  count of rows — so deleting an old document can never cause the next
 *  number issued to collide with one still on file. Retries on the rare race
 *  where two documents are created in the same instant. */
function nextDocumentNumber(type: string, letterheadCode: string | null, date: string): string {
  const fy = financialYear(date);
  const prefix = (letterheadCode || type.split(' ').map(w => w[0]).join('')).toUpperCase();
  const pattern = `${prefix}/${fy}/%`;
  const rows = db.prepare(`SELECT number FROM documents WHERE number LIKE ?`).all(pattern) as any[];
  let maxSeq = 0;
  for (const row of rows) {
    const tail = row.number.slice(row.number.lastIndexOf('/') + 1);
    const n = parseInt(tail, 10);
    if (!isNaN(n) && n > maxSeq) maxSeq = n;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = `${prefix}/${fy}/${maxSeq + 1 + attempt}`;
    const exists = db.prepare('SELECT 1 FROM documents WHERE number=?').get(candidate);
    if (!exists) return candidate;
  }
  return `${prefix}/${fy}/${Date.now().toString().slice(-6)}`;
}

/** Records one line in the activity log. Never throws — a logging failure should never block the action it's logging. */
function logActivity(user: any, action: string, entityType: string, entityId: number | null, detail?: string) {
  try { db.prepare('INSERT INTO activity_log(user_id,user_name,action,entity_type,entity_id,detail) VALUES(?,?,?,?,?,?)').run(user?.user_id ?? null, user?.name ?? null, action, entityType, entityId ?? null, detail || ''); } catch { /* logging must never break the request */ }
}

/** CSV cell escaping: wraps in quotes and doubles internal quotes whenever the value contains a comma, quote or newline. */
function csvCell(v: any): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: any[], columns: string[]): string {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvCell(r[c])).join(','));
  return lines.join('\r\n');
}
function sendCsv(res: any, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv); // BOM so Excel opens UTF-8 (₹ etc.) correctly
}

// Failed-login lockout: 5 wrong passwords for a username locks it for 15
// minutes. Kept in memory (resets if the app restarts) — enough to stop
// casual password guessing on a desktop app without adding a persistent
// table for it.
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const LOCK_AFTER = 5, LOCK_MINUTES = 15;

// CORS_ORIGIN defaults to "*" (any origin) for normal local desktop use.
// Set it in server/.env only if this server is ever reachable beyond
// localhost and you want to restrict who can call the API.
const corsOrigin = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*' ? process.env.CORS_ORIGIN : true;
const app = express(); app.use(cors({ origin: corsOrigin })); app.use(express.json({ limit: '20mb' }));

// General API rate limit: generous for normal use, just there to blunt
// scripted abuse. Login has its own tighter, account-based lockout below.
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
app.use('/api', apiLimiter);
const loginLimiter = rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { ok: false, error: 'Too many attempts. Please wait a moment and try again.' } });

const ok = (res: any, data: any) => res.json({ ok: true, data });
const fail = (res: any, status: number, error: string) => res.status(status).json({ ok: false, error });
function auth(req: any, res: any, next: any) { const token = (req.headers.authorization || '').replace(/^Bearer\s+/, ''); if (!token) return fail(res, 401, 'Please log in.'); const s = db.prepare('SELECT s.*,u.name,u.username,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>? AND u.active=1').get(token, Date.now()) as any; if (!s) return fail(res, 401, 'Session expired. Please log in again.'); req.user = s; next(); }
// Blocks non-Admin logins from destructive or company-wide actions (deleting
// records, editing company profile, viewing the activity log). Every login
// still reaches every everyday business feature — this only narrows what a
// "Manager" account (e.g. Vishwas) can do, matching the Full Access / Access
// (No Build) split shown in Settings.
function requireAdmin(req: any, res: any, next: any) { if (req.user?.role !== 'Admin') return fail(res, 403, 'Only a Full Access account can do this.'); next(); }
const companySchema = z.object({ name: z.string().min(1), gstin: z.string().nullish(), phone: z.string().nullish(), email: z.string().nullish(), address: z.string().nullish(), proprietor: z.string().nullish(), currency: z.string().nullish().transform((v) => v || 'INR'), upi_id: z.string().nullish() });
app.get('/api/health', (_, res) => ok(res, { status: 'healthy', database: 'SQLite' }));
app.post('/api/auth/login', loginLimiter, (req, res) => {
  const p = z.object({ username: z.string().min(1), password: z.string().min(1), code: z.string().optional() }).parse(req.body);
  const key = p.username.toLowerCase();
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.lockedUntil > Date.now()) {
    const mins = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
    return fail(res, 429, `Too many failed attempts. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`);
  }
  const u = db.prepare('SELECT * FROM users WHERE username=? AND active=1').get(p.username) as any;
  if (!u || !verifyPassword(p.password, u.password_hash)) {
    const next = { count: (attempt?.count || 0) + 1, lockedUntil: 0 };
    if (next.count >= LOCK_AFTER) { next.lockedUntil = Date.now() + LOCK_MINUTES * 60000; next.count = 0; }
    loginAttempts.set(key, next);
    return fail(res, 401, 'Invalid username or password');
  }
  if (u.totp_enabled) {
    if (!p.code) return ok(res, { totpRequired: true }); // password is right; ask the client for a 6-digit code next
    if (!verifyTotp(u.totp_secret, p.code)) {
      const next = { count: (attempt?.count || 0) + 1, lockedUntil: 0 };
      if (next.count >= LOCK_AFTER) { next.lockedUntil = Date.now() + LOCK_MINUTES * 60000; next.count = 0; }
      loginAttempts.set(key, next);
      return fail(res, 401, 'Incorrect authentication code');
    }
  }
  loginAttempts.delete(key);
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)').run(token, u.id, Date.now() + 1000 * 60 * 60 * 12);
  logActivity({ user_id: u.id, name: u.name }, 'login', 'user', u.id);
  ok(res, { token, user: userPayload(u) });
});
app.post('/api/auth/logout', auth, (req: any, res) => { const token = (req.headers.authorization || '').replace(/^Bearer\s+/, ''); db.prepare('DELETE FROM sessions WHERE token=?').run(token); ok(res, { loggedOut: true }); });
app.post('/api/auth/logout-all', auth, (req: any, res) => { db.prepare('DELETE FROM sessions WHERE user_id=?').run(req.user.user_id); ok(res, { loggedOut: true }); });
app.get('/api/auth/me', auth, (req: any, res) => ok(res, userPayload(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.user_id))));
app.put('/api/auth/password', auth, (req: any, res) => { const p = z.object({ current: z.string(), next: z.string().min(6) }).parse(req.body); const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.user_id) as any; if (!verifyPassword(p.current, u.password_hash)) return fail(res, 400, 'Current password is incorrect'); if (p.next === p.current) return fail(res, 400, 'Please choose a different password from the current one.'); db.prepare('UPDATE users SET password_hash=?, must_change=0 WHERE id=?').run(hashPassword(p.next), u.id); ok(res, { changed: true }); });

// Two-factor login (TOTP), self-service — any logged-in account can turn this
// on or off for itself. Setup is two steps so a typo'd/unscanned code never
// locks someone out: /setup stores a *pending* secret (totp_enabled stays 0)
// and returns a QR code; /confirm only flips totp_enabled on once the user
// proves they can actually generate a matching code from it.
app.post('/api/auth/2fa/setup', auth, async (req: any, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.user_id) as any;
  const secret = generateTotpSecret();
  db.prepare('UPDATE users SET totp_secret=?, totp_enabled=0 WHERE id=?').run(secret, u.id);
  const url = otpAuthUrl(secret, u.username);
  const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 220 });
  ok(res, { secret, otpauthUrl: url, qrDataUrl });
});
app.post('/api/auth/2fa/confirm', auth, (req: any, res) => {
  const p = z.object({ code: z.string().min(6) }).parse(req.body);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.user_id) as any;
  if (!u.totp_secret) return fail(res, 400, 'Start setup again — no code is pending confirmation.');
  if (!verifyTotp(u.totp_secret, p.code)) return fail(res, 400, 'That code is incorrect. Check the time on your phone and try again.');
  db.prepare('UPDATE users SET totp_enabled=1 WHERE id=?').run(u.id);
  logActivity(req.user, 'update', 'user', u.id, 'Enabled two-factor login');
  ok(res, { enabled: true });
});
app.post('/api/auth/2fa/disable', auth, (req: any, res) => {
  const p = z.object({ password: z.string().min(1) }).parse(req.body);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.user_id) as any;
  if (!verifyPassword(p.password, u.password_hash)) return fail(res, 400, 'Password is incorrect.');
  db.prepare('UPDATE users SET totp_enabled=0, totp_secret=NULL WHERE id=?').run(u.id);
  logActivity(req.user, 'update', 'user', u.id, 'Disabled two-factor login');
  ok(res, { enabled: false });
});

app.use('/api', auth);
app.get('/api/company', (_, res) => ok(res, db.prepare('SELECT * FROM company_settings WHERE id=1').get()));
app.put('/api/company', requireAdmin, (req: any, res) => { const p = companySchema.parse(req.body); db.prepare('UPDATE company_settings SET name=?,gstin=?,phone=?,email=?,address=?,proprietor=?,currency=?,upi_id=? WHERE id=1').run(p.name, p.gstin || '', p.phone || '', p.email || '', p.address || '', p.proprietor || '', p.currency, p.upi_id || ''); logActivity(req.user, 'update', 'company', 1); ok(res, p); });
app.get('/api/activity', requireAdmin, (req: any, res) => ok(res, db.prepare('SELECT * FROM activity_log ORDER BY id DESC LIMIT 200').all()));

app.get('/api/customers', (_, res) => ok(res, db.prepare('SELECT * FROM customers ORDER BY name').all()));
app.get('/api/customers/export', (_, res) => sendCsv(res, `customers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(db.prepare('SELECT * FROM customers ORDER BY name').all(), ['id', 'name', 'phone', 'email', 'gstin', 'address', 'created_at'])));
app.post('/api/customers', (req: any, res) => { const p = z.object({ name: z.string().min(1), phone: z.string().optional(), email: z.string().optional(), gstin: z.string().optional(), address: z.string().optional() }).parse(req.body); const r = db.prepare('INSERT INTO customers(name,phone,email,gstin,address,created_by,updated_by) VALUES(?,?,?,?,?,?,?)').run(p.name, p.phone || '', p.email || '', p.gstin || '', p.address || '', req.user.user_id, req.user.user_id); logActivity(req.user, 'create', 'customer', Number(r.lastInsertRowid), p.name); ok(res, { id: r.lastInsertRowid, ...p }); });
app.put('/api/customers/:id', (req: any, res) => { const p = z.object({ name: z.string().min(1), phone: z.string().optional(), email: z.string().optional(), gstin: z.string().optional(), address: z.string().optional() }).parse(req.body); db.prepare('UPDATE customers SET name=?,phone=?,email=?,gstin=?,address=?,updated_by=? WHERE id=?').run(p.name, p.phone || '', p.email || '', p.gstin || '', p.address || '', req.user.user_id, req.params.id); logActivity(req.user, 'update', 'customer', Number(req.params.id), p.name); ok(res, { id: Number(req.params.id), ...p }); });
app.delete('/api/customers/:id', requireAdmin, (req: any, res) => { db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id); logActivity(req.user, 'delete', 'customer', Number(req.params.id)); ok(res, { deleted: true }); });

const productSchema = z.object({ name: z.string().min(1), code: z.string().optional(), unit: z.string().default('NOS'), rate: z.number().default(0), gst: z.number().default(18), type: z.string().default('Product'), hsn: z.string().optional(), stock_qty: z.number().nullable().optional(), low_stock_at: z.number().nullable().optional() });
app.get('/api/products', (_, res) => ok(res, db.prepare('SELECT * FROM products ORDER BY name').all()));
app.post('/api/products', (req: any, res) => { const p = productSchema.parse(req.body); const r = db.prepare('INSERT INTO products(name,code,unit,rate,gst,type,hsn,stock_qty,low_stock_at) VALUES(?,?,?,?,?,?,?,?,?)').run(p.name, p.code || '', p.unit, p.rate, p.gst, p.type, p.hsn || '', p.stock_qty ?? null, p.low_stock_at ?? null); logActivity(req.user, 'create', 'product', Number(r.lastInsertRowid), p.name); ok(res, { id: r.lastInsertRowid, ...p }); });
app.put('/api/products/:id', (req: any, res) => { const p = productSchema.parse(req.body); db.prepare('UPDATE products SET name=?,code=?,unit=?,rate=?,gst=?,type=?,hsn=?,stock_qty=?,low_stock_at=? WHERE id=?').run(p.name, p.code || '', p.unit, p.rate, p.gst, p.type, p.hsn || '', p.stock_qty ?? null, p.low_stock_at ?? null, req.params.id); logActivity(req.user, 'update', 'product', Number(req.params.id), p.name); ok(res, { id: Number(req.params.id), ...p }); });
app.delete('/api/products/:id', requireAdmin, (req: any, res) => { db.prepare('DELETE FROM products WHERE id=?').run(req.params.id); logActivity(req.user, 'delete', 'product', Number(req.params.id)); ok(res, { deleted: true }); });

app.get('/api/letterheads', (_, res) => ok(res, db.prepare('SELECT * FROM letterheads ORDER BY name').all()));
app.post('/api/letterheads', (req: any, res) => { const p = z.object({ name: z.string().min(1), code: z.string().optional(), color: z.string().optional(), header_data: z.string().optional(), stamp_data: z.string().optional(), footer_data: z.string().optional() }).parse(req.body); const r = db.prepare('INSERT INTO letterheads(name,code,color,header_data,stamp_data,footer_data) VALUES(?,?,?,?,?,?)').run(p.name, (p.code || p.name.slice(0, 3)).toUpperCase(), p.color || '#1c3a5e', p.header_data || '', p.stamp_data || '', p.footer_data || ''); logActivity(req.user, 'create', 'letterhead', Number(r.lastInsertRowid), p.name); ok(res, { id: r.lastInsertRowid, ...p }); });
app.delete('/api/letterheads/:id', requireAdmin, (req: any, res) => { db.prepare('DELETE FROM letterheads WHERE id=?').run(req.params.id); logActivity(req.user, 'delete', 'letterhead', Number(req.params.id)); ok(res, { deleted: true }); });
app.get('/api/letterheads/mappings', (_, res) => ok(res, db.prepare('SELECT * FROM letterhead_mappings').all()));
app.put('/api/letterheads/mappings', (req, res) => { const p = z.object({ doc_type: z.enum(DOC_TYPES), letterhead_id: z.number().nullable() }).parse(req.body); db.prepare('INSERT INTO letterhead_mappings(doc_type,letterhead_id) VALUES(?,?) ON CONFLICT(doc_type) DO UPDATE SET letterhead_id=excluded.letterhead_id').run(p.doc_type, p.letterhead_id); ok(res, p); });

app.get('/api/documents', (_, res) => ok(res, db.prepare(`SELECT d.*,c.name customer,l.name letterhead,COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.document_id=d.id),0) received FROM documents d LEFT JOIN customers c ON c.id=d.customer_id LEFT JOIN letterheads l ON l.id=d.letterhead_id ORDER BY d.date DESC,d.id DESC`).all()));
app.get('/api/documents/export', (req, res) => {
  const type = req.query.type ? String(req.query.type) : null;
  const rows = db.prepare(`SELECT d.number,d.type,d.date,d.due_date,d.status,c.name customer,d.subtotal,d.tax,d.total,COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.document_id=d.id),0) received,d.notes FROM documents d LEFT JOIN customers c ON c.id=d.customer_id WHERE (? IS NULL OR d.type=?) ORDER BY d.date DESC,d.id DESC`).all(type, type);
  sendCsv(res, `${(type || 'documents').toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, ['number', 'type', 'date', 'due_date', 'status', 'customer', 'subtotal', 'tax', 'total', 'received', 'notes']));
});
app.get('/api/documents/next-number', (req, res) => {
  const type = String(req.query.type || 'GST INVOICE');
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const letterheadId = req.query.letterhead_id ? Number(req.query.letterhead_id) : null;
  const lh = letterheadId ? (db.prepare('SELECT code FROM letterheads WHERE id=?').get(letterheadId) as any) : null;
  ok(res, { number: nextDocumentNumber(type, lh?.code || null, date) });
});
app.get('/api/documents/:id', (req, res) => { const d = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id) as any; if (!d) return fail(res, 404, 'Document not found'); const items = db.prepare('SELECT * FROM document_items WHERE document_id=? ORDER BY id').all(req.params.id); ok(res, { ...d, items }); });
app.get('/api/documents/:id/print', async (req, res) => {
  const d = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id) as any;
  if (!d) return fail(res, 404, 'Document not found');
  const items = db.prepare('SELECT * FROM document_items WHERE document_id=? ORDER BY id').all(req.params.id) as any[];
  const customer = d.customer_id ? db.prepare('SELECT * FROM customers WHERE id=?').get(d.customer_id) as any : null;
  const letterhead = d.letterhead_id ? db.prepare('SELECT * FROM letterheads WHERE id=?').get(d.letterhead_id) as any : null;
  const company = db.prepare('SELECT * FROM company_settings WHERE id=1').get() as any;
  let upiQrDataUrl: string | undefined;
  if (company.upi_id && d.type !== 'QUOTATION') {
    // Standard UPI deep-link format; any UPI app (GPay, PhonePe, Paytm...) can scan this.
    const upiUrl = `upi://pay?pa=${encodeURIComponent(company.upi_id)}&pn=${encodeURIComponent(company.name || 'Payee')}&am=${encodeURIComponent(String(d.total))}&cu=INR&tn=${encodeURIComponent(d.number)}`;
    try { upiQrDataUrl = await QRCode.toDataURL(upiUrl, { margin: 1, width: 240 }); }
    catch (e) { console.error('UPI QR generation failed (invoice will print without it):', e); }
  }
  const html = renderDocumentPrintPage({ doc: d, items, customer, letterhead, company, upiQrDataUrl });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});
const itemSchema = z.object({ product_id: z.number().nullable().optional(), description: z.string().min(1), qty: z.number().positive(), rate: z.number().nonnegative(), gst: z.number().nonnegative() });
app.post('/api/documents', (req: any, res) => {
  const s = z.object({ number: z.string().optional(), type: z.enum(DOC_TYPES), customer_id: z.number().nullable().optional(), letterhead_id: z.number().nullable().optional(), date: z.string(), due_date: z.string().optional(), status: z.string().default('Draft'), notes: z.string().optional(), items: z.array(itemSchema).min(1) }).parse(req.body);
  const calc = s.items.reduce((a, i) => { const amount = i.qty * i.rate; return { subtotal: a.subtotal + amount, tax: a.tax + amount * i.gst / 100 }; }, { subtotal: 0, tax: 0 });
  const lh = s.letterhead_id ? (db.prepare('SELECT code FROM letterheads WHERE id=?').get(s.letterhead_id) as any) : null;
  const number = s.number?.trim() || nextDocumentNumber(s.type, lh?.code || null, s.date);
  const tx = db.transaction(() => {
    const r = db.prepare('INSERT INTO documents(number,type,customer_id,letterhead_id,date,due_date,status,subtotal,tax,total,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(number, s.type, s.customer_id ?? null, s.letterhead_id ?? null, s.date, s.due_date || '', s.status, calc.subtotal, calc.tax, calc.subtotal + calc.tax, s.notes || '', req.user.user_id, req.user.user_id);
    const ins = db.prepare('INSERT INTO document_items(document_id,product_id,description,qty,rate,gst,amount) VALUES(?,?,?,?,?,?,?)');
    for (const i of s.items) ins.run(r.lastInsertRowid, i.product_id ?? null, i.description, i.qty, i.rate, i.gst, i.qty * i.rate);
    return r.lastInsertRowid;
  });
  try { const id = tx(); logActivity(req.user, 'create', 'document', Number(id), number); ok(res, { id }); } catch (e: any) { fail(res, 400, e.message?.includes('UNIQUE') ? 'A document with this number already exists.' : e.message); }
});
app.put('/api/documents/:id/status', (req: any, res) => { const p = z.object({ status: z.string().min(1) }).parse(req.body); db.prepare('UPDATE documents SET status=?,updated_by=? WHERE id=?').run(p.status, req.user.user_id, req.params.id); logActivity(req.user, 'update-status', 'document', Number(req.params.id), p.status); ok(res, { updated: true }); });
// "Repeat this document" — duplicates a document (and its items) as a new
// Draft dated today, with a freshly generated number. This is the practical
// stand-in for recurring invoices: one click regenerates last month's bill
// instead of re-typing it, without needing a background scheduler.
app.post('/api/documents/:id/duplicate', (req: any, res) => {
  const d = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id) as any;
  if (!d) return fail(res, 404, 'Document not found');
  const items = db.prepare('SELECT * FROM document_items WHERE document_id=? ORDER BY id').all(req.params.id) as any[];
  const today = new Date().toISOString().slice(0, 10);
  const lh = d.letterhead_id ? (db.prepare('SELECT code FROM letterheads WHERE id=?').get(d.letterhead_id) as any) : null;
  const number = nextDocumentNumber(d.type, lh?.code || null, today);
  const tx = db.transaction(() => {
    const r = db.prepare('INSERT INTO documents(number,type,customer_id,letterhead_id,date,due_date,status,subtotal,tax,total,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(number, d.type, d.customer_id, d.letterhead_id, today, '', 'Draft', d.subtotal, d.tax, d.total, d.notes, req.user.user_id, req.user.user_id);
    const ins = db.prepare('INSERT INTO document_items(document_id,product_id,description,qty,rate,gst,amount) VALUES(?,?,?,?,?,?,?)');
    for (const i of items) ins.run(r.lastInsertRowid, i.product_id, i.description, i.qty, i.rate, i.gst, i.amount);
    return r.lastInsertRowid;
  });
  const id = tx();
  logActivity(req.user, 'duplicate', 'document', Number(id), `from ${d.number} as ${number}`);
  ok(res, { id, number });
});
app.delete('/api/documents/:id', requireAdmin, (req: any, res) => { const d = db.prepare('SELECT number FROM documents WHERE id=?').get(req.params.id) as any; db.prepare('DELETE FROM documents WHERE id=?').run(req.params.id); logActivity(req.user, 'delete', 'document', Number(req.params.id), d?.number); ok(res, { deleted: true }); });

app.get('/api/payments', (_, res) => ok(res, db.prepare(`SELECT p.*,d.number,c.name customer,d.total document_total FROM payments p JOIN documents d ON d.id=p.document_id LEFT JOIN customers c ON c.id=d.customer_id ORDER BY p.date DESC,p.id DESC`).all()));
app.get('/api/payments/export', (_, res) => {
  const rows = db.prepare(`SELECT p.date,d.number,c.name customer,p.amount,p.mode,p.reference,p.notes FROM payments p JOIN documents d ON d.id=p.document_id LEFT JOIN customers c ON c.id=d.customer_id ORDER BY p.date DESC,p.id DESC`).all();
  sendCsv(res, `payments-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, ['date', 'number', 'customer', 'amount', 'mode', 'reference', 'notes']));
});
app.post('/api/payments', (req: any, res) => { const p = z.object({ document_id: z.number(), amount: z.number().positive(), date: z.string(), mode: z.string().optional(), reference: z.string().optional(), notes: z.string().optional() }).parse(req.body); const doc = db.prepare('SELECT total FROM documents WHERE id=?').get(p.document_id) as any; if (!doc) return fail(res, 404, 'Document not found'); const received = (db.prepare('SELECT COALESCE(SUM(amount),0) amount FROM payments WHERE document_id=?').get(p.document_id) as any).amount; if (received + p.amount > doc.total + 0.01) return fail(res, 400, 'Payment exceeds document balance'); const r = db.prepare('INSERT INTO payments(document_id,amount,date,mode,reference,notes,created_by,updated_by) VALUES(?,?,?,?,?,?,?,?)').run(p.document_id, p.amount, p.date, p.mode || '', p.reference || '', p.notes || '', req.user.user_id, req.user.user_id); const newReceived = received + p.amount; db.prepare('UPDATE documents SET status=? WHERE id=?').run(newReceived >= doc.total - 0.01 ? 'Paid' : 'Pending', p.document_id); logActivity(req.user, 'create', 'payment', Number(r.lastInsertRowid), `₹${p.amount} on ${doc.number || ''}`); ok(res, { id: r.lastInsertRowid, ...p }); });
app.delete('/api/payments/:id', requireAdmin, (req: any, res) => { db.prepare('DELETE FROM payments WHERE id=?').run(req.params.id); logActivity(req.user, 'delete', 'payment', Number(req.params.id)); ok(res, { deleted: true }); });

app.get('/api/reports/summary', (_, res) => { const summary = db.prepare(`SELECT COALESCE(SUM(total),0) sales, COALESCE(SUM((SELECT SUM(p.amount) FROM payments p WHERE p.document_id=d.id)),0) received, COUNT(*) documents, COUNT(DISTINCT customer_id) customers, COALESCE(SUM(CASE WHEN type='QUOTATION' THEN total ELSE 0 END),0) quotations, COALESCE(SUM(CASE WHEN type='GST INVOICE' THEN total ELSE 0 END),0) invoices FROM documents d`).get(); const balances = db.prepare(`SELECT c.id,c.name,COALESCE(SUM(d.total),0) billed,COALESCE((SELECT SUM(p.amount) FROM payments p JOIN documents pd ON pd.id=p.document_id WHERE pd.customer_id=c.id),0) received FROM customers c LEFT JOIN documents d ON d.customer_id=c.id GROUP BY c.id ORDER BY billed DESC`).all(); ok(res, { summary, balances }); });
// GST summary export (CSV) for a date range — one row per GST invoice, with
// taxable value, tax and total, plus the customer's GSTIN, for handing to
// your CA when filing GSTR-1/3B. CGST/SGST vs IGST isn't split out here
// (the app doesn't currently track place-of-supply), so `tax` is the total
// GST collected on that invoice.
app.get('/api/reports/gst-export', (req, res) => {
  const from = req.query.from ? String(req.query.from) : '0000-01-01';
  const to = req.query.to ? String(req.query.to) : '9999-12-31';
  const rows = db.prepare(`SELECT d.number,d.date,c.name customer,c.gstin,d.subtotal taxable_value,d.tax gst_amount,d.total FROM documents d LEFT JOIN customers c ON c.id=d.customer_id WHERE d.type='GST INVOICE' AND d.date BETWEEN ? AND ? ORDER BY d.date`).all(from, to);
  sendCsv(res, `gst-report-${from}_to_${to}.csv`, toCsv(rows, ['number', 'date', 'customer', 'gstin', 'taxable_value', 'gst_amount', 'total']));
});

app.get('/api/backup', (_, res) => {
  const file = path.join(dataDir, 'vishwa.db');
  res.download(file, `vishwa-backup-${new Date().toISOString().slice(0, 10)}.db`);
});

app.get('/api/backup/cloud-status', auth, (_, res) => ok(res, { configured: !!process.env.DROPBOX_ACCESS_TOKEN, provider: process.env.DROPBOX_ACCESS_TOKEN ? 'dropbox' : null }));

app.post('/api/backup/cloud', auth, requireAdmin, async (req: any, res) => {
  if (!process.env.DROPBOX_ACCESS_TOKEN) return fail(res, 400, "Cloud backup isn't set up yet. Add DROPBOX_ACCESS_TOKEN to server/.env, then restart the app.");
  try {
    const remoteName = `vishwa-backup-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.db`;
    await uploadToDropbox(path.join(dataDir, 'vishwa.db'), remoteName);
    logActivity(req.user, 'Backed up', 'Database', null, 'Uploaded to Dropbox');
    ok(res, { uploaded: true, name: remoteName });
  } catch (e: any) {
    fail(res, 502, e.message || 'Cloud backup failed. Check your internet connection and the token in server/.env.');
  }
});

// Lets Settings show "open this on your phone": the LAN IP(s) this
// computer is reachable at on the local network, plus a scan-to-open QR
// code for the first one. The server already listens on all interfaces
// (app.listen(PORT) with no host), so nothing here changes what's
// reachable — this just surfaces the address for people to find easily.
app.get('/api/network-info', auth, async (_, res) => {
  const port = Number(process.env.PORT) || 4000;
  const addresses: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface || []) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
    }
  }
  let qrDataUrl: string | undefined;
  if (addresses[0]) {
    try { qrDataUrl = await QRCode.toDataURL(`http://${addresses[0]}:${port}`, { margin: 1, width: 200 }); }
    catch (e) { console.error('Network QR generation failed:', e); }
  }
  ok(res, { port, addresses, qrDataUrl });
});

const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => { if (req.path.startsWith('/api/')) return fail(res, 404, 'API route not found'); const index = path.join(clientDist, 'index.html'); if (fs.existsSync(index)) res.sendFile(index); else res.status(404).send('Frontend build not found. Run "npm run build" first, or "npm run dev" for development.'); });

const PORT = Number(process.env.PORT) || 4000;
// Any error thrown by a route (validation, oversized upload, bad JSON) is returned as JSON so the app can show a clear message.
app.use((err: any, _req: any, res: any, _next: any) => {
  if (err?.name === 'ZodError') {
    const first = err.issues?.[0];
    return fail(res, 400, first ? `Please check "${(first.path || []).join('.') || 'input'}": ${first.message}` : 'Please check the entered details.');
  }
  if (err?.type === 'entity.too.large') return fail(res, 413, 'The uploaded image is too large. Please use a smaller file.');
  if (err?.type === 'entity.parse.failed') return fail(res, 400, 'The request could not be read.');
  console.error(err);
  return fail(res, 500, err?.message || 'Unexpected server error.');
});

app.listen(PORT, () => {
  console.log(`Vishwa Infra Business Suite running at http://localhost:${PORT}`);
  const lan: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const net of iface || []) if (net.family === 'IPv4' && !net.internal) lan.push(net.address);
  }
  if (lan.length) console.log(`On your phone/tablet (same Wi-Fi): ${lan.map((ip) => `http://${ip}:${PORT}`).join('  or  ')}`);
});
