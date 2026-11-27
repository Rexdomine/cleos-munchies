import { useEffect, useState } from 'react';
import { api } from './api.js';
import { MenuView } from './MenuView.jsx';
import { OrdersView } from './OrdersView.jsx';

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'menu', label: 'Menu' },
];

export function AdminApp() {
  const [tab, setTab] = useState('orders');
  const [session, setSession] = useState({ email: '', logoutUrl: null });
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    api.session().then(setSession).catch((error) => setSessionError(error.message));
  }, []);

  if (sessionError) {
    return (
      <main className="admin-shell">
        <h1>Admin sign-in needed</h1>
        <p className="muted">{sessionError}</p>
      </main>
    );
  }

  return (
    <>
      <header className="admin-top">
        <div className="brand">
          CLEO<span>’</span>S <i>MUNCHIES</i> <b>Admin</b>
        </div>
        <nav className="tabs" aria-label="Admin sections">
          {TABS.map((entry) => (
            <button key={entry.id} className={tab === entry.id ? 'selected' : ''} aria-current={tab === entry.id ? 'page' : undefined} onClick={() => setTab(entry.id)}>
              {entry.label}
            </button>
          ))}
        </nav>
        <div className="account">
          <span className="signed-in" title="Signed in">{session.email}</span>
          {session.logoutUrl && (
            <a className="logout" href={session.logoutUrl}>
              Log out
            </a>
          )}
        </div>
      </header>
      <main className="admin-shell">{tab === 'orders' ? <OrdersView /> : <MenuView />}</main>
    </>
  );
}
