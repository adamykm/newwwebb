import './AdminPage.css';
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api, type AdminStats, type AdminUser } from '../lib/api';

type Tab = 'overview' | 'users' | 'tasks' | 'notes' | 'events' | 'servers';

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Per-user expanded UI state
  const [expandedBadge, setExpandedBadge] = useState<string | null>(null);
  const [expandedTimeout, setExpandedTimeout] = useState<string | null>(null);
  const [badgeForm, setBadgeForm] = useState<Record<string, Record<string, string>>>({});
  const [timeoutMinutes, setTimeoutMinutes] = useState<Record<string, string>>({});
  const [confirmTerminate, setConfirmTerminate] = useState<string | null>(null);
  const [disableReason, setDisableReason] = useState('');
  const [confirmDisable, setConfirmDisable] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    if (tab === 'overview') {
      api.admin.stats().then((r) => setStats(r.stats));
      return;
    }
    if (tab === 'users') {
      api.admin.users().then((r) => setUsers(r.users));
      return;
    }
    const fetchers: Record<Exclude<Tab, 'overview' | 'users'>, () => Promise<void>> = {
      tasks: () => api.admin.tasks().then((r) => setData(r.tasks)),
      notes: () => api.admin.notes().then((r) => setData(r.notes)),
      events: () => api.admin.events().then((r) => setData(r.events)),
      servers: () => api.admin.servers().then((r) => setData(r.servers)),
    };
    fetchers[tab as Exclude<Tab, 'overview' | 'users'>]?.();
  }, [tab, user?.role]);

  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  const flash = (msg: string, isError = false) => {
    if (isError) { setActionError(msg); setTimeout(() => setActionError(''), 4000); }
    else { setActionSuccess(msg); setTimeout(() => setActionSuccess(''), 3000); }
  };

  const reloadUsers = () => api.admin.users().then((r) => setUsers(r.users));

  const handleDisable = async (u: AdminUser) => {
    try {
      await api.admin.disableUser(u.id, disableReason || undefined);
      flash(`${u.username} has been disabled.`);
      setConfirmDisable(null);
      setDisableReason('');
      reloadUsers();
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const handleEnable = async (u: AdminUser) => {
    try {
      await api.admin.enableUser(u.id);
      flash(`${u.username} has been re-enabled.`);
      reloadUsers();
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const handleTerminate = async (u: AdminUser) => {
    try {
      await api.admin.terminateUser(u.id);
      flash(`${u.username}'s account has been permanently terminated.`);
      setConfirmTerminate(null);
      reloadUsers();
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const handleSaveBadge = async (u: AdminUser) => {
    const form = badgeForm[u.id] || { nexusRole: u.nexusRole || '', nexusBadgeUrl: u.nexusBadgeUrl || '', developerBadgeUrl: u.developerBadgeUrl || '' };
    try {
      await api.admin.setBadge(u.id, {
        nexusRole: form.nexusRole || null,
        nexusBadgeUrl: form.nexusBadgeUrl || null,
        developerBadgeUrl: form.developerBadgeUrl || null,
      });
      flash(`Badges updated for ${u.username}.`);
      setExpandedBadge(null);
      reloadUsers();
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const handleApplyTimeout = async (u: AdminUser) => {
    const mins = parseInt(timeoutMinutes[u.id] || '0', 10);
    if (!mins || mins < 1) { flash('Enter a valid duration in minutes', true); return; }
    try {
      await api.admin.timeoutUser(u.id, mins);
      flash(`${u.username} has been timed out for ${mins} minute(s).`);
      setExpandedTimeout(null);
      reloadUsers();
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const handleClearTimeout = async (u: AdminUser) => {
    try {
      await api.admin.clearTimeout(u.id);
      flash(`Timeout removed from ${u.username}.`);
      reloadUsers();
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed', true); }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Members' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'notes', label: 'Notes' },
    { id: 'events', label: 'Events' },
    { id: 'servers', label: 'Servers' },
  ];

  const filteredUsers = users.filter((u) =>
    !search || u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusChip = (u: AdminUser) => {
    if (u.isTerminated) return <span className="status-chip chip-terminated">Terminated</span>;
    if (u.isDisabled) return <span className="status-chip chip-disabled">Disabled</span>;
    if (u.globalTimeoutUntil && u.globalTimeoutUntil > Date.now()) {
      const mins = Math.ceil((u.globalTimeoutUntil - Date.now()) / 60000);
      return <span className="status-chip chip-timeout">Timeout {mins}m</span>;
    }
    return <span className="status-chip chip-active">Active</span>;
  };

  return (
    <div className="page-shell admin-page animate-in">
      <header className="page-header">
        <div>
          <h1>Admin Panel</h1>
          <p className="page-subtitle">Global view across all users and servers</p>
        </div>
      </header>

      {actionError && <div className="admin-flash admin-flash-error">{actionError}</div>}
      {actionSuccess && <div className="admin-flash admin-flash-success">{actionSuccess}</div>}

      <div className="admin-tabs">
        {tabs.map((t) => (
          <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ──────────────────────────────────────────── */}
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

      {/* ── Users / Members ───────────────────────────────────── */}
      {tab === 'users' && (
        <div className="admin-users">
          <div className="admin-users-toolbar">
            <input
              className="admin-search"
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="admin-user-count">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="admin-user-list">
            {filteredUsers.map((u) => {
              const isOwner = u.id === user?.id;
              const form = badgeForm[u.id] || { nexusRole: u.nexusRole || '', nexusBadgeUrl: u.nexusBadgeUrl || '', developerBadgeUrl: u.developerBadgeUrl || '' };
              const setBadgeField = (field: string, val: string) =>
                setBadgeForm((prev) => ({ ...prev, [u.id]: { ...form, [field]: val } }));

              return (
                <div key={u.id} className={`admin-user-card glass-panel ${u.isTerminated ? 'card-terminated' : u.isDisabled ? 'card-disabled' : ''}`}>
                  <div className="auc-top">
                    <div className="auc-avatar" style={{ background: u.avatarColor }}>
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} alt={u.username} />
                        : (u.displayName || u.username)[0].toUpperCase()
                      }
                    </div>
                    <div className="auc-info">
                      <div className="auc-name">
                        {u.displayName || u.username}
                        {u.role === 'admin' && <span className="role-chip chip-admin">Owner</span>}
                        {u.nexusRole === 'administrator' && <span className="role-chip chip-nexus-admin">Nexus Admin</span>}
                        {u.nexusRole === 'moderator' && <span className="role-chip chip-nexus-mod">Mod</span>}
                        {u.developerBadgeUrl && <span className="role-chip chip-dev">Dev</span>}
                      </div>
                      <div className="auc-sub">@{u.username} · {u.email}</div>
                      {u.disabledReason && <div className="auc-reason">Reason: {u.disabledReason}</div>}
                    </div>
                    <div className="auc-status">{getStatusChip(u)}</div>
                  </div>

                  {!isOwner && (
                    <div className="auc-actions">
                      {/* Badge */}
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() => setExpandedBadge(expandedBadge === u.id ? null : u.id)}
                      >
                        🏅 Badge
                      </button>

                      {/* Timeout */}
                      {!u.isTerminated && (
                        u.globalTimeoutUntil && u.globalTimeoutUntil > Date.now()
                          ? <button className="btn btn-ghost btn-xs" onClick={() => handleClearTimeout(u)}>⏱ Clear Timeout</button>
                          : <button className="btn btn-ghost btn-xs" onClick={() => setExpandedTimeout(expandedTimeout === u.id ? null : u.id)}>⏱ Timeout</button>
                      )}

                      {/* Disable / Enable */}
                      {!u.isTerminated && (
                        u.isDisabled
                          ? <button className="btn btn-ghost btn-xs chip-active-btn" onClick={() => handleEnable(u)}>✓ Enable</button>
                          : <button className="btn btn-ghost btn-xs chip-disable-btn" onClick={() => setConfirmDisable(confirmDisable === u.id ? null : u.id)}>🚫 Disable</button>
                      )}

                      {/* Terminate */}
                      {!u.isTerminated && (
                        <button
                          className="btn btn-ghost btn-xs chip-terminate-btn"
                          onClick={() => setConfirmTerminate(confirmTerminate === u.id ? null : u.id)}
                        >
                          💀 Terminate
                        </button>
                      )}
                    </div>
                  )}

                  {/* Badge form */}
                  {expandedBadge === u.id && (
                    <div className="auc-expanded">
                      <div className="auc-form-row">
                        <label>Nexus Role</label>
                        <select value={form.nexusRole} onChange={(e) => setBadgeField('nexusRole', e.target.value)}>
                          <option value="">None</option>
                          <option value="moderator">Moderator</option>
                          <option value="administrator">Administrator</option>
                        </select>
                      </div>
                      <div className="auc-form-row">
                        <label>Nexus Badge URL</label>
                        <input
                          placeholder="https://... (optional)"
                          value={form.nexusBadgeUrl}
                          onChange={(e) => setBadgeField('nexusBadgeUrl', e.target.value)}
                        />
                      </div>
                      <div className="auc-form-row">
                        <label>Developer Badge URL</label>
                        <input
                          placeholder="https://... (leave blank to remove)"
                          value={form.developerBadgeUrl}
                          onChange={(e) => setBadgeField('developerBadgeUrl', e.target.value)}
                        />
                      </div>
                      <div className="auc-form-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveBadge(u)}>Save Badges</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setExpandedBadge(null)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Timeout form */}
                  {expandedTimeout === u.id && (
                    <div className="auc-expanded">
                      <div className="auc-form-row">
                        <label>Duration (minutes)</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="e.g. 60"
                          value={timeoutMinutes[u.id] || ''}
                          onChange={(e) => setTimeoutMinutes((prev) => ({ ...prev, [u.id]: e.target.value }))}
                        />
                      </div>
                      <div className="auc-form-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => handleApplyTimeout(u)}>Apply Timeout</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setExpandedTimeout(null)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Disable confirm */}
                  {confirmDisable === u.id && (
                    <div className="auc-expanded auc-confirm">
                      <p>Disable <strong>{u.username}</strong>? They won't be able to log in.</p>
                      <div className="auc-form-row">
                        <label>Reason (optional)</label>
                        <input
                          placeholder="Reason for disabling..."
                          value={disableReason}
                          onChange={(e) => setDisableReason(e.target.value)}
                        />
                      </div>
                      <div className="auc-form-actions">
                        <button className="btn btn-danger btn-sm" onClick={() => handleDisable(u)}>Confirm Disable</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDisable(null)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* Terminate confirm */}
                  {confirmTerminate === u.id && (
                    <div className="auc-expanded auc-confirm">
                      <p>Permanently terminate <strong>{u.username}</strong>? This cannot be undone.</p>
                      <div className="auc-form-actions">
                        <button className="btn btn-danger btn-sm" onClick={() => handleTerminate(u)}>Confirm Terminate</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setConfirmTerminate(null)}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filteredUsers.length === 0 && (
              <div className="admin-empty">No users found.</div>
            )}
          </div>
        </div>
      )}

      {/* ── Other data tabs ───────────────────────────────────── */}
      {tab !== 'overview' && tab !== 'users' && (
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
