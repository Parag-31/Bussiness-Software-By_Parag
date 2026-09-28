import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import {
  LayoutDashboard, Users, PanelsTopLeft, BarChart3, Settings, Plus, Search, Bell, Menu, Clock3, Receipt, WalletCards,
  Wrench, HardHat, Sun, Moon, LogOut, Sparkles, X, AlertCircle, FileText, ChevronRight, History,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import './styles.css';

import { type Customer, type Doc, type Letterhead, type Payment, type Product, type Summary, type User, api, CREDIT } from './lib';
import { overdueInvoices, analyze, INVOICE } from './analytics';
import { toast } from './bus';
import { useTheme } from './theme';
import { Overlays, Avatar } from './ui';
import { LogoMark } from './illustrations';
import { CommandPalette, type Cmd } from './CommandPalette';
import { EntryModal, ViewModal } from './forms';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { Customers } from './pages/Customers';
import { Payments } from './pages/Payments';
import { Letterheads } from './pages/Letterheads';
import { Reports } from './pages/Reports';
import { ActivityLog } from './pages/ActivityLog';
import { SettingsPage } from './pages/Settings';
import { PasswordGate } from './pages/PasswordGate';

type NavItem = { id: string; label: string; icon: LucideIcon; docType?: string; adminOnly?: boolean };
const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'Overview', items: [{ id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'Reports', label: 'Reports', icon: BarChart3 }] },
  {
    group: 'Sales', items: [
      { id: 'Quotations', label: 'Quotations', icon: Clock3, docType: 'QUOTATION' },
      { id: 'GST Invoices', label: 'GST Invoices', icon: Receipt, docType: 'GST INVOICE' },
      { id: 'Repair Bills', label: 'Repair Bills', icon: Wrench, docType: 'REPAIR BILL' },
      { id: 'Work Orders', label: 'Work Orders', icon: HardHat, docType: 'WORK ORDER' },
      { id: 'Payments', label: 'Payments', icon: WalletCards },
    ],
  },
  { group: 'Manage', items: [{ id: 'Customers', label: 'Customers', icon: Users }, { id: 'Letterheads', label: 'Letterheads', icon: PanelsTopLeft }, { id: 'Activity Log', label: 'Activity Log', icon: History, adminOnly: true }, { id: 'Company Settings', label: 'Settings', icon: Settings }] },
];
const ALL_PAGES = NAV.flatMap((g) => g.items);

function App() {
  const [logged, setLogged] = useState(!!localStorage.getItem('vishwa_token'));
  const [user, setUser] = useState<User | null>(null);
  const [page, setPageState] = useState<string>(() => { const p = localStorage.getItem('vishwa_page') || 'Dashboard'; return ALL_PAGES.some((x) => x.id === p) ? p : 'Dashboard'; });
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [letters, setLetters] = useState<Letterhead[]>([]);
  const [letterMap, setLetterMap] = useState<Record<string, number | null>>({});
  const [summary, setSummary] = useState<Summary>({ sales: 0, received: 0, documents: 0, customers: 0, quotations: 0, invoices: 0 });
  const [modal, setModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [palette, setPalette] = useState(false);
  const [bell, setBell] = useState(false);
  const [themePref, themeResolved, setTheme] = useTheme();

  const setPage = (p: string) => { setPageState(p); localStorage.setItem('vishwa_page', p); setDrawer(false); window.scrollTo({ top: 0 }); };

  const refresh = async () => {
    try {
      const [c, p, d, l, pay, r, maps] = await Promise.all([
        api('/customers'), api('/products'), api('/documents'), api('/letterheads'),
        api('/payments'), api('/reports/summary'), api('/letterheads/mappings'),
      ]);
      setCustomers(c); setProducts(p); setDocs(d); setLetters(l); setPayments(pay);
      setSummary(r.summary);
      const m: Record<string, number | null> = {};
      for (const row of maps) m[row.doc_type] = row.letterhead_id;
      setLetterMap(m);
    } catch (e: any) {
      if (e.message === 'AUTH_REQUIRED') setLogged(false); else toast('Could not load data', 'error', e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { if (logged) { api('/auth/me').then(setUser).catch(() => setLogged(false)); refresh(); } }, [logged]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      const el = e.target as HTMLElement | null;
      const typing = !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); setModal((m) => m ?? 'document'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const an = useMemo(() => analyze(docs, payments), [docs, payments]);
  const overdue = useMemo(() => overdueInvoices(docs), [docs]);
  const badges: Record<string, number> = {
    Quotations: docs.filter((d) => d.type === 'QUOTATION' && d.status === 'Draft').length,
    'GST Invoices': docs.filter((d) => d.type === INVOICE && d.status === 'Pending').length,
  };

  const logout = async () => { try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ } localStorage.removeItem('vishwa_token'); setLogged(false); };
  const toggleTheme = () => setTheme(themeResolved === 'dark' ? 'light' : 'dark');

  const base: Cmd[] = [
    ...ALL_PAGES.filter((p) => !p.adminOnly || user?.role === 'Admin').map((p) => ({ id: 'p' + p.id, group: 'Go to', label: p.label, icon: p.icon, run: () => setPage(p.id) })),
    { id: 'n1', group: 'Create', label: 'New GST invoice', icon: Receipt, run: () => setModal('document:GST INVOICE') },
    { id: 'n2', group: 'Create', label: 'New quotation', icon: Clock3, run: () => setModal('document:QUOTATION') },
    { id: 'n3', group: 'Create', label: 'New repair bill', icon: Wrench, run: () => setModal('document:REPAIR BILL') },
    { id: 'n4', group: 'Create', label: 'New work order', icon: HardHat, run: () => setModal('document:WORK ORDER') },
    { id: 'n5', group: 'Create', label: 'Record payment', icon: WalletCards, run: () => setModal('payment') },
    { id: 'n6', group: 'Create', label: 'Add customer', icon: Users, run: () => setModal('customer') },
    { id: 'n7', group: 'Create', label: 'Add letterhead', icon: PanelsTopLeft, run: () => setModal('letterhead') },
    { id: 't1', group: 'Preferences', label: themeResolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme', icon: themeResolved === 'dark' ? Sun : Moon, run: toggleTheme },
  ];

  if (!logged) return <><Login onSuccess={(u) => { setUser(u); setLoading(true); setLogged(true); }} /><Overlays /></>;

  const docProps = { docs, customers, user, loading, onNew: (t: string) => setModal('document:' + t), onView: (d: Doc) => setModal(`view:${d.id}`), onPay: (d: Doc) => setModal(`payment:${d.id}`), onRefresh: refresh };
  const view = (() => {
    const nav = ALL_PAGES.find((p) => p.id === page);
    if (nav?.docType) return <Documents key={page} title={nav.label} type={nav.docType} {...docProps} />;
    switch (page) {
      case 'Customers': return <Customers data={customers} docs={docs} user={user} loading={loading} onAdd={() => setModal('customer')} onRefresh={refresh} />;
      case 'Payments': return <Payments data={payments} user={user} loading={loading} onAdd={() => setModal('payment')} onRefresh={refresh} />;
      case 'Letterheads': return <Letterheads data={letters} letterMap={letterMap} user={user} onAdd={() => setModal('letterhead')} onRefresh={refresh} />;
      case 'Reports': return <Reports summary={summary} an={an} loading={loading} />;
      case 'Activity Log': return <ActivityLog />;
      case 'Company Settings': return user ? <SettingsPage user={user} theme={themePref} setTheme={setTheme} onLogout={logout} /> : <div className="card pad"><div className="skel skel-sheet" /></div>;
      default: return <Dashboard user={user} docs={docs} an={an} customers={customers.length} loading={loading} onNew={(t) => setModal(t ? 'document:' + t : 'document')} onPay={() => setModal('payment')} onView={(d) => setModal(`view:${d.id}`)} go={setPage} />;
    }
  })();
  const current = ALL_PAGES.find((p) => p.id === page);

  return (
    <div className={'app' + (collapsed ? ' compact' : '') + (drawer ? ' drawer-open' : '')}>
      <div className="scrim" onClick={() => setDrawer(false)} />
      <aside>
        <div className="side-glow" />
        <div className="brand"><LogoMark size={40} /><div className="brand-t"><b>Vishwa Infra</b><span>{CREDIT}</span></div></div>
        <button className="new" onClick={() => setModal('document')}><Plus size={17} /><span>New document</span><kbd>N</kbd></button>
        <nav>
          {NAV.map((g) => (
            <div className="nav-group" key={g.group}>
              <p>{g.group}</p>
              {g.items.filter((it) => !it.adminOnly || user?.role === 'Admin').map((it) => (
                <button key={it.id} className={page === it.id ? 'active' : ''} onClick={() => setPage(it.id)} title={it.label}>
                  <it.icon size={18} /><span>{it.label}</span>{badges[it.id] ? <em className="badge">{badges[it.id]}</em> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className="me"><Avatar name={user?.name} size={34} /><div className="me-t"><b>{user?.name || '—'}</b><span><i className="status-dot" /> {user?.designation || 'Local · secure'}</span></div>
            <button className="icon-btn dark" onClick={logout} data-tip="Sign out" aria-label="Sign out"><LogOut size={16} /></button></div>
        </div>
      </aside>
      <main>
        <header>
          <button className="icon-btn" onClick={() => (window.matchMedia('(max-width: 900px)').matches ? setDrawer(!drawer) : setCollapsed(!collapsed))} aria-label="Toggle menu"><Menu size={20} /></button>
          <div className="crumbs"><span>Vishwa Infra</span><ChevronRight size={14} /><b>{current?.label}</b></div>
          <button className="search-trigger" onClick={() => setPalette(true)}><Search size={16} /><span>Search or jump to…</span><kbd>{navigator.platform.includes('Mac') ? '⌘ K' : 'Ctrl K'}</kbd></button>
          <div className="head-right">
            <button className="icon-btn" onClick={toggleTheme} data-tip={themeResolved === 'dark' ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">{themeResolved === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
            <div className="bell-wrap">
              <button className="icon-btn" onClick={() => setBell(!bell)} aria-label="Notifications"><Bell size={19} />{(overdue.length > 0) && <i className="ping" />}</button>
              {bell && (
                <>
                  <div className="click-away" onClick={() => setBell(false)} />
                  <div className="popover">
                    <div className="pop-head"><b>Notifications</b><button className="icon-btn sm" onClick={() => setBell(false)}><X size={14} /></button></div>
                    {overdue.length === 0 && <div className="pop-empty"><Sparkles size={18} />You’re all caught up.</div>}
                    {overdue.slice(0, 5).map(({ doc, age, due }) => (
                      <button className="pop-item" key={doc.id} onClick={() => { setBell(false); setModal(`view:${doc.id}`); }}>
                        <span className="pop-ico"><AlertCircle size={16} /></span>
                        <span><b>{doc.number} is {age} days old</b><small>{doc.customer || 'Walk-in'} · ₹{Math.round(due).toLocaleString('en-IN')} due</small></span>
                      </button>
                    ))}
                    {badges.Quotations > 0 && (
                      <button className="pop-item" onClick={() => { setBell(false); setPage('Quotations'); }}>
                        <span className="pop-ico info"><FileText size={16} /></span>
                        <span><b>{badges.Quotations} draft quotation{badges.Quotations > 1 ? 's' : ''}</b><small>Ready to review and send</small></span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <button className="user-chip" onClick={() => setPage('Company Settings')}><Avatar name={user?.name} size={34} /><span className="uc-t"><b>{user?.name}</b><small>{user?.designation || user?.role}</small></span></button>
          </div>
        </header>
        <section className="content">{view}</section>
      </main>

      {modal?.startsWith('view:')
        ? <ViewModal id={Number(modal.split(':')[1])} customers={customers} letters={letters} onClose={() => setModal(null)} onPay={(id) => setModal(`payment:${id}`)} />
        : modal && <EntryModal key={modal} type={modal} customers={customers} products={products} letters={letters} letterMap={letterMap} docs={docs} onClose={() => setModal(null)} onDone={async () => { setModal(null); await refresh(); }} />}
      <CommandPalette open={palette} onClose={() => setPalette(false)} base={base} docs={docs} customers={customers}
        onDoc={(d) => setModal(`view:${d.id}`)} onCustomer={() => setPage('Customers')} />
      {user?.must_change && <PasswordGate user={user} onDone={() => api('/auth/me').then(setUser).catch(() => setLogged(false))} onLogout={logout} />}
      <Overlays />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

// Registering the service worker (see public/sw.js) is what lets the browser
// offer "Install app" on desktop and "Add to Home Screen" on mobile, and
// gives the app shell a fallback if the network briefly drops.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { /* PWA install just won't be offered; the app still works */ }); });
}
