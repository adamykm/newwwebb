import './AdminPage.css';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, type AdminStats } from '../lib/api';

type Tab = 'overview' | 'users' | 'tasks' | 'notes' | 'events' | 'servers';

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    if (tab === 'overview') {
      api.admin.stats().then((r) => setStats(r.stats));
      return;
    }
    const fetchers: Record<Exclude<Tab, 'overview'>, () => Promise<void>> = {
      users: () => api.admin.users().then((r) => setData(r.users as unknown as Record<string, unknown>[])),
      tasks: () => api.admin.tasks().then((r) => setData(r.tasks)),
      notes: () => api.admin.notes().then((r) => setData(r.notes)),
      events: () => api.admin.events().then((r) => setData(r.events)),
      servers: () => api.admin.servers().then((r) => setData(r.servers)),
    };
    fetchers[tab]?.();
  }, [tab, user?.role]);

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Members' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'notes', label: 'Notes' },
    { id: 'events', label: 'Events' },
    { id: 'servers', label: 'Servers' },
  ];

  return (
    <div className="page-shell admin-page animate-in">
      <header className="page-header">
        <div>
          <h1>⚡ Admin Panel</h1>
          <p className="page-subtitle">Global view across all users and servers</p>
        </div>
      </header>

      <div className="admin-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && stats && (
        <div className="stat-grid">
          {Object.entries(stats).map(([key, val]) => (
            <div key={key} className="stat-card glass-panel">
              <span className="stat-value" style={{ color: 'var(--pink)' }}>{val}</span>
              <span className="stat-label">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
            </div>
          ))}
        </div>
      )}

      {tab !== 'overview' && (
        <div className="admin-table glass-panel">
          <table>
            <thead>
              <tr>
                {data[0] && Object.keys(data[0]).filter((k) => !k.includes('hash')).slice(0, 8).map((k) => (
                  <th key={k}>{k.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr><td colSpan={8} className="empty-cell">No data</td></tr>
              ) : data.map((row, i) => (
                <tr key={i}>
                  {Object.entries(row).filter(([k]) => !k.includes('hash')).slice(0, 8).map(([k, v]) => (
                    <td key={k}>{typeof v === 'number' && k.includes('at') ? new Date(v).toLocaleString() : String(v ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
