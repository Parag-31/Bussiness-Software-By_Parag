import React, { useState } from 'react';
import { ArrowUpRight, BarChart3, Eye, EyeOff, KeyRound, Lock, LockKeyhole, Receipt, ShieldCheck, User as UserIcon, WalletCards } from 'lucide-react';
import { api, CREDIT, type User } from '../lib';
import { InfraScene, LogoMark } from '../illustrations';

export function Login({ onSuccess }: { onSuccess: (u: User) => void }) {
  const [username, setUsername] = useState('admin'), [password, setPassword] = useState('admin123');
  const [step, setStep] = useState<'credentials' | 'code'>('credentials');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [show, setShow] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, ...(step === 'code' ? { code } : {}) }) });
      if (r.totpRequired) { setStep('code'); return; }
      localStorage.setItem('vishwa_token', r.token);
      onSuccess(r.user);
    } catch (err: any) { setError(err.message === 'AUTH_REQUIRED' ? 'Invalid username or password.' : err.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="login-shell">
      <div className="login-art">
        <div className="blob b1" /><div className="blob b2" />
        <div className="brand big"><LogoMark size={44} /><div><b>Vishwa Infra</b><span>{CREDIT}</span></div></div>
        <div className="login-copy">
          <span className="chip-glass"><i /> All systems running locally</span>
          <h1>Quotes to cash,<br />on <em>one</em> command center.</h1>
          <p>Professional quotations, GST invoices, payments and letterheads — backed by a private database that never leaves this computer.</p>
          <div className="login-points">
            <span><Receipt size={17} /> GST-ready documents</span>
            <span><WalletCards size={17} /> Payment tracking</span>
            <span><BarChart3 size={17} /> Live business reports</span>
            <span><ShieldCheck size={17} /> Secure sign-in</span>
          </div>
        </div>
        <InfraScene className="login-scene" align="xMidYMax" />
      </div>
      <div className="login-side">
        <div className="login-card">
          <div className="mobile-logo"><LogoMark size={36} /><b>Vishwa Infra</b></div>
          {step === 'credentials' ? (
            <>
              <p className="eyebrow">WELCOME BACK</p>
              <h2>Sign in</h2>
              <p className="login-muted">Access your business workspace.</p>
              <form onSubmit={submit}>
                <label className="field">Username
                  <span className="input-ico"><UserIcon size={17} /><input autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} /></span>
                </label>
                <label className="field">Password
                  <span className="input-ico"><Lock size={17} /><input type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="eye" onClick={() => setShow(!show)} aria-label="Toggle password visibility">{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
                </label>
                {error && <div className="error">{error}</div>}
                <button className="btn primary lg block" disabled={busy}>{busy ? <span className="spinner" /> : <>Sign in <ArrowUpRight size={17} /></>}</button>
              </form>
              <div className="demo"><LockKeyhole size={15} /><span>First login: <b>admin</b> / <b>admin123</b> — change it in Company Settings.</span></div>
            </>
          ) : (
            <>
              <p className="eyebrow">TWO-FACTOR LOGIN</p>
              <h2>Enter your code</h2>
              <p className="login-muted">Open your authenticator app and enter the current 6-digit code for {username}.</p>
              <form onSubmit={submit}>
                <label className="field">Authentication code
                  <span className="input-ico"><KeyRound size={17} /><input autoFocus inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onFocus={(e) => e.target.select()} /></span>
                </label>
                {error && <div className="error">{error}</div>}
                <button className="btn primary lg block" disabled={busy || code.length < 6}>{busy ? <span className="spinner" /> : <>Verify <ArrowUpRight size={17} /></>}</button>
                <button type="button" className="btn ghost block" style={{ marginTop: 8 }} onClick={() => { setStep('credentials'); setCode(''); setError(''); }}>Back</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
