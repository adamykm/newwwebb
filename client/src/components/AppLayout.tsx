import './AppLayout.css';
import { Outlet, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useEffect, useState } from 'react';
import { api, type Server, getDisplayName } from '../lib/api';
import CreateServerModal from './CreateServerModal';
import JoinServerModal from './JoinServerModal';
import UserSettingsModal from './UserSettingsModal';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { serverId } = useParams();
  const [servers, setServers] = useState<Server[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const loadServers = () => api.servers.list().then((r) => setServers(r.servers)).catch(() => {});

  useEffect(() => { loadServers(); }, [serverId]);

  const navItems = [
    { to: '/', label: 'Home', icon: '⌂' },
    { to: '/tasks', label: 'Tasks', icon: '✓' },
    { to: '/notes', label: 'Notes', icon: '◈' },
    { to: '/events', label: 'Events', icon: '◷' },
    { to: '/members', label: 'Members', icon: '◎' },
  ];

  const displayedName = user ? getDisplayName(user) : '';

  return (
    <div className="app-layout">
      {/* Server rail */}
      <aside className="server-rail">
        <NavLink
          to="/"
          className={({ isActive }) => `server-icon home-icon ${isActive && !serverId ? 'active' : ''}`}
          title="Home"
        >
          ◈
        </NavLink>
        <div className="server-divider" />
        {servers.map((s) => (
          <button
            key={s.id}
            className={`server-icon ${serverId === s.id ? 'active' : ''}`}
            style={{ background: s.iconUrl ? undefined : s.iconColor }}
            title={s.name}
            onClick={() => navigate(`/servers/${s.id}`)}
          >
            {s.iconUrl ? (
              <img src={s.iconUrl} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
            ) : (
              s.name.slice(0, 2).toUpperCase()
            )}
          </button>
        ))}
        <div className="server-divider" />
        <button className="server-icon discover-icon" title="Discover Servers" onClick={() => navigate('/discovery')}>🔭</button>
        <button className="server-icon add-server" title="Create Server" onClick={() => setShowCreate(true)}>+</button>
        <button className="server-icon join-server" title="Join Server" onClick={() => setShowJoin(true)}>↗</button>
      </aside>

      {/* Channel / nav sidebar */}
      <aside className="nav-sidebar">
        <div className="nav-header">
          <span className="nav-brand">NEXUS HUB</span>
        </div>
        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          {user?.role === 'admin' && (
            <NavLink to="/admin" className={({ isActive }) => `nav-link admin-link ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">⚡</span>
              Admin Panel
            </NavLink>
          )}
        </nav>

        <div className="user-bar">
          <div className="user-avatar-wrap">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={displayedName} className="avatar avatar-sm avatar-img" />
            ) : (
              <div className="avatar" style={{ background: user?.avatarColor, width: 36, height: 36 }}>
                {displayedName?.[0]?.toUpperCase()}
              </div>
            )}
            <span className={`status-dot status-${user?.status || 'online'}`} />
          </div>
          <div className="user-info">
            <span className="user-name">{displayedName}</span>
            <div className="user-badges">
              {user?.role === 'admin' && <span className="badge badge-admin">Admin</span>}
              {user?.nexusRole === 'administrator' && (
                <span className="badge badge-nexus-admin" title="Nexus Administrator">
                  {user.nexusBadgeUrl ? <img src={user.nexusBadgeUrl} alt="" style={{ width: 10, height: 10, borderRadius: 2, marginRight: 2 }} /> : '🛡'}
                </span>
              )}
              {user?.nexusRole === 'moderator' && (
                <span className="badge badge-nexus-mod" title="Nexus Moderator">
                  {user.nexusBadgeUrl ? <img src={user.nexusBadgeUrl} alt="" style={{ width: 10, height: 10, borderRadius: 2, marginRight: 2 }} /> : '🔰'}
                </span>
              )}
              {user?.developerBadgeUrl && (
                <span className="badge badge-dev" title="Developer">
                  <img src={user.developerBadgeUrl} alt="" style={{ width: 10, height: 10, borderRadius: 2, marginRight: 2 }} />Dev
                </span>
              )}
            </div>
          </div>
          <button className="settings-icon-btn" onClick={() => setShowSettings(true)} title="User Settings">⚙</button>
          <button className="logout-btn" onClick={() => logout()} title="Logout">⏻</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet context={{ servers, reloadServers: loadServers }} />
      </main>

      {showCreate && (
        <CreateServerModal
          onClose={() => setShowCreate(false)}
          onCreated={(s) => { setShowCreate(false); loadServers(); navigate(`/servers/${s.id}`); }}
        />
      )}
      {showJoin && (
        <JoinServerModal
          onClose={() => setShowJoin(false)}
          onJoined={(id) => { setShowJoin(false); loadServers(); navigate(`/servers/${id}`); }}
        />
      )}
      {showSettings && <UserSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
