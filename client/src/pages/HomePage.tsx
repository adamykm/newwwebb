import './PageShell.css';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';

export default function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ tasks: 0, notes: 0, events: 0, servers: 0 });

  useEffect(() => {
    Promise.all([api.tasks.list(), api.notes.list(), api.events.list(), api.servers.list()]).then(
      ([t, n, e, s]) => setStats({
        tasks: t.tasks.filter((x) => x.status !== 'done').length,
        notes: n.notes.length,
        events: e.events.length,
        servers: s.servers.length,
      })
    );
  }, []);

  const cards = [
    { label: 'Active Tasks', value: stats.tasks, to: '/tasks', color: 'var(--cyan)' },
    { label: 'Notes', value: stats.notes, to: '/notes', color: 'var(--accent-bright)' },
    { label: 'Events', value: stats.events, to: '/events', color: 'var(--pink)' },
    { label: 'Servers', value: stats.servers, to: '/', color: 'var(--green)' },
  ];

  return (
    <div className="page-shell animate-in">
      <header className="page-header">
        <div>
          <h1>Welcome, {user?.username}</h1>
          <p className="page-subtitle">Your personal command center</p>
        </div>
      </header>

      <div className="stat-grid">
        {cards.map((c) => (
          <Link key={c.label} to={c.to} className="stat-card glass-panel">
            <span className="stat-value" style={{ color: c.color }}>{c.value}</span>
            <span className="stat-label">{c.label}</span>
          </Link>
        ))}
      </div>

      <div className="quick-actions glass-panel">
        <h2>Quick Actions</h2>
        <div className="action-grid">
          <Link to="/tasks" className="action-btn">+ New Task</Link>
          <Link to="/notes" className="action-btn">+ New Note</Link>
          <Link to="/events" className="action-btn">+ New Event</Link>
          <Link to="/members" className="action-btn">View Members</Link>
        </div>
      </div>
    </div>
  );
}
