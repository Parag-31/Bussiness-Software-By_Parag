import React, { useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { api, type User } from '../lib';
import { toast } from '../bus';

/** Shown right after the first sign-in with a temporary password. Cannot be dismissed until a new password is set. */
export function PasswordGate({ user, onDone, onLogout }: { user: User; onDone: () => void; onLogout: () => void }) {
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (next.length < 6) { setError('Your new password must be at least 6 characters.'); return; }
    if (next !== again) { setError('The two new passwords do not match.'); return; }
    setBusy(true);
    try {
      await api('/auth/password', { method: 'PUT', body: JSON.stringify({ current, next }) });
      toast('Password updated', 'success', 'Use your new password next time you sign in.');
      onDone();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="overlay front">
      <form className="confirm gate" onSubmit={submit} role="dialog" aria-modal="true">
        <div className="confirm-ico"><KeyRound size={24} /></div>
        <h3>Welcome, {user.name.split(' ')[0]}. Set your own password</h3>
        <p>You signed in with a temporary password. Choose a new one to continue. Only you should know it.</p>
        <label className="field">Temporary password<input type="password" autoComplete="current-password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} required /></label>
        <label className="field">New password <em className="hint">min. 6 characters</em><input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required /></label>
        <label className="field">Repeat new password<input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required /></label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary lg block" disabled={busy}>{busy ? <span className="spinner" /> : <><ShieldCheck size={17} /> Save and continue</>}</button>
        <button type="button" className="link gate-out" onClick={onLogout}><LogOut size={14} /> Sign out instead</button>
      </form>
    </div>
  );
}
