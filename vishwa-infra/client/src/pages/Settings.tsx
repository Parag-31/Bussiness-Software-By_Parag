import React, { useEffect, useState } from 'react';
import { DownloadCloud, LockKeyhole, LogOut, Monitor, Moon, Save, ShieldOff, Sun, Database, ShieldCheck, CloudUpload, KeyRound, QrCode, Smartphone, Download } from 'lucide-react';
import { type User, api, downloadBackup, cloudBackupStatus, backupToCloud, start2faSetup, confirm2fa, disable2fa, networkInfo } from '../lib';
import { toast, confirmDialog } from '../bus';
import { Avatar, Card, Page } from '../ui';
import type { ThemePref } from '../theme';
import { isInstallAvailable, isStandalone, onInstallAvailabilityChange, promptInstall } from '../pwa';

export function SettingsPage({ user, theme, setTheme, onLogout }: { user: User; theme: ThemePref; setTheme: (t: ThemePref) => void; onLogout: () => void }) {
  const [company, setCompany] = useState<any>({ name: 'VISHWA INFRA SOLUTIONS INDIA PRIVATE LIMITED' });
  const [pass, setPass] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  const [cloud, setCloud] = useState<{ configured: boolean; provider: string | null } | null>(null);
  const [cloudBusy, setCloudBusy] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(!!user.totp_enabled);
  const [twofaStage, setTwofaStage] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [twofaQr, setTwofaQr] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [twofaCode, setTwofaCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [twofaBusy, setTwofaBusy] = useState(false);
  const [net, setNet] = useState<{ port: number; addresses: string[]; qrDataUrl?: string } | null>(null);
  const [canInstall, setCanInstall] = useState(isInstallAvailable());
  const isThisComputer = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const isAdmin = user.role === 'Admin';
  useEffect(() => { api('/company').then(setCompany).catch(() => { }); }, []);
  useEffect(() => { cloudBackupStatus().then(setCloud).catch(() => setCloud({ configured: false, provider: null })); }, []);
  useEffect(() => { networkInfo().then(setNet).catch(() => { }); }, []);
  useEffect(() => onInstallAvailabilityChange(() => setCanInstall(isInstallAvailable())), []);
  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') toast('App installed', 'success');
    else if (outcome === 'unavailable') toast('Already installed, or not supported by this browser', 'info');
  };
  const runCloudBackup = async () => { setCloudBusy(true); try { await backupToCloud(); } finally { setCloudBusy(false); } };
  const set = (k: string, v: string) => setCompany({ ...company, [k]: v });
  const save = async () => {
    setBusy(true);
    try { await api('/company', { method: 'PUT', body: JSON.stringify({ name: company.name || '', gstin: company.gstin || '', phone: company.phone || '', email: company.email || '', address: company.address || '', proprietor: company.proprietor || '', currency: company.currency || 'INR', upi_id: company.upi_id || '' }) }); toast('Company profile saved', 'success'); } catch (e: any) { toast('Could not save', 'error', e.message); } finally { setBusy(false); }
  };
  const change = async () => {
    try { await api('/auth/password', { method: 'PUT', body: JSON.stringify(pass) }); setPass({ current: '', next: '' }); toast('Password changed', 'success'); } catch (e: any) { toast('Could not change password', 'error', e.message); }
  };
  const signOutEverywhere = async () => {
    if (!(await confirmDialog({ title: 'Sign out of all devices?', message: 'Every device currently signed in as you will be logged out, including this one.', confirmLabel: 'Sign out everywhere', danger: true }))) return;
    try { await api('/auth/logout-all', { method: 'POST' }); } catch { /* proceed to local logout regardless */ }
    onLogout();
  };
  const begin2faSetup = async () => {
    setTwofaBusy(true);
    try { const r = await start2faSetup(); setTwofaQr({ qrDataUrl: r.qrDataUrl, secret: r.secret }); setTwofaStage('setup'); }
    catch (e: any) { toast('Could not start setup', 'error', e.message); }
    finally { setTwofaBusy(false); }
  };
  const confirmSetup = async () => {
    setTwofaBusy(true);
    try { await confirm2fa(twofaCode); setTotpEnabled(true); setTwofaStage('idle'); setTwofaQr(null); setTwofaCode(''); toast('Two-factor login enabled', 'success'); }
    catch (e: any) { toast('Incorrect code', 'error', e.message); }
    finally { setTwofaBusy(false); }
  };
  const cancelTwofa = () => { setTwofaStage('idle'); setTwofaQr(null); setTwofaCode(''); setDisablePassword(''); };
  const confirmDisableTwofa = async () => {
    setTwofaBusy(true);
    try { await disable2fa(disablePassword); setTotpEnabled(false); setTwofaStage('idle'); setDisablePassword(''); toast('Two-factor login disabled', 'success'); }
    catch (e: any) { toast('Could not disable', 'error', e.message); }
    finally { setTwofaBusy(false); }
  };
  const themes: { v: ThemePref; label: string; icon: React.ReactNode }[] = [
    { v: 'light', label: 'Light', icon: <Sun size={16} /> }, { v: 'dark', label: 'Dark', icon: <Moon size={16} /> }, { v: 'system', label: 'System', icon: <Monitor size={16} /> },
  ];
  return (
    <Page title="Company Settings" sub="Control company details, security and appearance.">
      <div className="settings-grid">
        <Card i={0} title="Company profile" sub={isAdmin ? 'Shown on printed documents and reports' : 'Shown on printed documents and reports · Full Access only can edit'}>
          <div className="form">
            <label className="field">Company name<input value={company.name || ''} onChange={(e) => set('name', e.target.value)} disabled={!isAdmin} /></label>
            <div className="two">
              <label className="field">GSTIN<input value={company.gstin || ''} onChange={(e) => set('gstin', e.target.value)} disabled={!isAdmin} /></label>
              <label className="field">Phone<input value={company.phone || ''} onChange={(e) => set('phone', e.target.value)} disabled={!isAdmin} /></label>
            </div>
            <label className="field">Email<input value={company.email || ''} onChange={(e) => set('email', e.target.value)} disabled={!isAdmin} /></label>
            <label className="field">Address<textarea value={company.address || ''} onChange={(e) => set('address', e.target.value)} disabled={!isAdmin} /></label>
            <label className="field">UPI ID <em className="hint">for the "scan &amp; pay" QR on printed invoices — optional</em><input placeholder="yourbusiness@okhdfcbank" value={company.upi_id || ''} onChange={(e) => set('upi_id', e.target.value)} disabled={!isAdmin} /></label>
            {isAdmin && <button className="btn primary" onClick={save} disabled={busy}><Save size={17} /> {busy ? 'Saving…' : 'Save company profile'}</button>}
          </div>
        </Card>
        <div className="stack">
          <Card i={1} title="Account">
            <div className="account"><Avatar name={user.name} size={46} /><div><b>{user.name}</b><span>@{user.username} · {user.designation || user.role}</span><span className={'access-pill' + (user.role === 'Admin' ? ' full' : '')}>{user.access || (user.role === 'Admin' ? 'Full Access' : 'Access (No Build)')}</span></div></div>
            <div className="two" style={{ marginTop: 12 }}>
              <button className="btn danger-soft" onClick={onLogout}><LogOut size={16} /> Sign out</button>
              <button className="btn ghost" onClick={signOutEverywhere}><ShieldOff size={16} /> Sign out everywhere</button>
            </div>
          </Card>
          <Card i={2} title="Appearance" sub="Choose how the workspace looks">
            <div className="theme-pick">
              {themes.map((t) => (
                <button key={t.v} className={'tp tp-' + t.v + (theme === t.v ? ' on' : '')} onClick={() => setTheme(t.v)}>
                  <span className="tp-prev"><i /><i /><i /></span>
                  <span className="tp-l">{t.icon}{t.label}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card i={3} title="Data & backup">
            <p className="note"><Database size={15} /> Your data lives entirely on this computer in a local SQLite file, with an automatic daily backup kept alongside it. Download a copy regularly too — especially before reinstalling Windows or moving to a new PC.</p>
            <button className="btn ghost" onClick={downloadBackup}><DownloadCloud size={16} /> Download database backup</button>
            {cloud?.configured ? (
              <button className="btn ghost" style={{ marginTop: 8 }} onClick={runCloudBackup} disabled={cloudBusy}><CloudUpload size={16} /> {cloudBusy ? 'Backing up…' : 'Back up to Dropbox now'}</button>
            ) : isAdmin && cloud && (
              <p className="note" style={{ marginTop: 8 }}><CloudUpload size={15} /> Cloud backup isn't set up. Add a Dropbox access token to <code>server/.env</code> (see <code>server/.env.example</code>) for automatic off-site copies.</p>
            )}
          </Card>
          <Card i={4} title="Change password">
            <div className="form">
              <label className="field">Current password<input type="password" value={pass.current} onChange={(e) => setPass({ ...pass, current: e.target.value })} /></label>
              <label className="field">New password <em className="hint">min. 6 characters</em><input type="password" value={pass.next} onChange={(e) => setPass({ ...pass, next: e.target.value })} /></label>
              <button className="btn primary" onClick={change} disabled={!pass.current || pass.next.length < 6}><ShieldCheck size={16} /> Update password</button>
            </div>
          </Card>
          <Card i={5} title="Two-factor login" sub="An authenticator app code, on top of your password">
            {twofaStage === 'idle' && (
              totpEnabled ? (
                <>
                  <p className="note"><KeyRound size={15} /> Two-factor login is on for your account. You'll be asked for a 6-digit code from your authenticator app each time you sign in.</p>
                  <button className="btn ghost" onClick={() => setTwofaStage('disable')}><ShieldOff size={16} /> Turn off two-factor login</button>
                </>
              ) : (
                <>
                  <p className="note"><QrCode size={15} /> Add a second step to sign-in using any authenticator app (Google Authenticator, Microsoft Authenticator, Authy…).</p>
                  <button className="btn primary" onClick={begin2faSetup} disabled={twofaBusy}><KeyRound size={16} /> {twofaBusy ? 'Starting…' : 'Set up two-factor login'}</button>
                </>
              )
            )}
            {twofaStage === 'setup' && twofaQr && (
              <div className="form">
                <p className="note">Scan this with your authenticator app, then enter the 6-digit code it shows to confirm.</p>
                <img src={twofaQr.qrDataUrl} alt="Two-factor setup QR code" style={{ width: 176, height: 176, borderRadius: 12, border: '1px solid var(--line)', background: '#fff', padding: 8 }} />
                <p className="note" style={{ fontSize: 12 }}>Can't scan? Enter this key manually: <code>{twofaQr.secret}</code></p>
                <label className="field">6-digit code<input autoFocus inputMode="numeric" maxLength={6} placeholder="000000" value={twofaCode} onChange={(e) => setTwofaCode(e.target.value.replace(/\D/g, ''))} onFocus={(e) => e.target.select()} /></label>
                <div className="two">
                  <button className="btn primary" onClick={confirmSetup} disabled={twofaBusy || twofaCode.length < 6}><ShieldCheck size={16} /> {twofaBusy ? 'Confirming…' : 'Confirm & enable'}</button>
                  <button className="btn ghost" onClick={cancelTwofa}>Cancel</button>
                </div>
              </div>
            )}
            {twofaStage === 'disable' && (
              <div className="form">
                <p className="note">Enter your password to confirm turning off two-factor login.</p>
                <label className="field">Password<input type="password" autoFocus value={disablePassword} onChange={(e) => setDisablePassword(e.target.value)} /></label>
                <div className="two">
                  <button className="btn danger-soft" onClick={confirmDisableTwofa} disabled={twofaBusy || !disablePassword}><ShieldOff size={16} /> {twofaBusy ? 'Turning off…' : 'Turn off'}</button>
                  <button className="btn ghost" onClick={cancelTwofa}>Cancel</button>
                </div>
              </div>
            )}
          </Card>
          <Card i={6} title="Mobile & install" sub="Use this on your phone, or install it like a native app">
            <p className="note"><Smartphone size={15} /> On the same Wi-Fi as this computer, open one of these addresses on your phone or tablet — no app store, no separate install needed to just view it in a browser.</p>
            {net?.addresses.length ? (
              <div className="two" style={{ alignItems: 'center' }}>
                <div>
                  {net.addresses.map((ip) => <div key={ip} style={{ fontFamily: 'monospace', fontSize: 13, marginTop: 4 }}>http://{ip}:{net.port}</div>)}
                  <p className="note" style={{ marginTop: 8, fontSize: 12 }}>If it doesn't load, Windows Firewall may be asking to allow the connection — click Allow.</p>
                </div>
                {net.qrDataUrl && <img src={net.qrDataUrl} alt="Scan to open on your phone" style={{ width: 120, height: 120, borderRadius: 10, border: '1px solid var(--line)', background: '#fff', padding: 6 }} />}
              </div>
            ) : (
              <p className="note" style={{ fontSize: 12 }}>Couldn't detect a network address — make sure this computer is connected to Wi-Fi or a network.</p>
            )}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
              {isStandalone() ? (
                <p className="note"><Download size={15} /> You're already using the installed app.</p>
              ) : canInstall ? (
                <>
                  <button className="btn ghost" onClick={install}><Download size={16} /> Install as an app</button>
                  {isThisComputer && <p className="note" style={{ marginTop: 8, fontSize: 12 }}>On this computer, prefer the Desktop shortcut from <code>Create-Desktop-Shortcut.bat</code> instead — it looks the same but also starts the server for you. An installed icon made here can only open the app, not start it, so you'd need to run <code>Start-Vishwa-Infra.bat</code> first every time.</p>}
                </>
              ) : (
                <p className="note" style={{ fontSize: 12 }}><Download size={15} /> On Android/desktop Chrome or Edge, look for an install icon in the address bar. On iPhone/iPad, use Share → Add to Home Screen in Safari.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Page>
  );
}
