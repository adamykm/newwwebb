import './DiscoveryPage.css';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type DiscoverableServer } from '../lib/api';

export default function DiscoveryPage() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<DiscoverableServer[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [selectedCat, setSelectedCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, cRes] = await Promise.all([
        api.discovery.list(q, selectedCat),
        api.discovery.categories(),
      ]);
      setServers(sRes.servers);
      setCategories(cRes.categories);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, [q, selectedCat]);

  const join = async (server: DiscoverableServer) => {
    setJoining(server.id);
    setError('');
    try {
      const code = server.customInvite || server.inviteCode;
      const { serverId } = await api.servers.join(code);
      await api.servers.list();
      navigate(`/servers/${serverId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join');
      setJoining(null);
    }
  };

  return (
    <div className="discovery-page">
      <div className="discovery-header">
        <h1 className="discovery-title">Server Discovery</h1>
        <p className="discovery-sub">Find communities that interest you</p>
        <div className="discovery-search">
          <input
            placeholder="🔍 Search servers..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="discovery-search-input"
          />
        </div>
      </div>

      <div className="discovery-body">
        <div className="discovery-filters">
          <button
            className={`filter-chip ${selectedCat === '' ? 'active' : ''}`}
            onClick={() => setSelectedCat('')}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-chip ${selectedCat === cat ? 'active' : ''}`}
              onClick={() => setSelectedCat(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {error && <div className="discovery-error">{error}</div>}

        {loading ? (
          <div className="discovery-loading">Loading servers...</div>
        ) : servers.length === 0 ? (
          <div className="discovery-empty">
            <div className="discovery-empty-icon">🔭</div>
            <h3>No servers found</h3>
            <p>Try a different search or category.</p>
          </div>
        ) : (
          <div className="discovery-grid">
            {servers.map((server) => (
              <div key={server.id} className="server-card">
                <div className="sc-icon" style={{ background: server.iconColor }}>
                  {server.iconUrl
                    ? <img src={server.iconUrl} alt={server.name} />
                    : server.name.slice(0, 2).toUpperCase()
                  }
                </div>
                <div className="sc-body">
                  <div className="sc-name">{server.name}</div>
                  {server.discoveryCategory && (
                    <span className="sc-cat">{server.discoveryCategory}</span>
                  )}
                  <p className="sc-desc">{server.description || 'No description provided.'}</p>
                  <div className="sc-footer">
                    <span className="sc-members">👥 {server.memberCount.toLocaleString()} members</span>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => join(server)}
                      disabled={joining === server.id}
                    >
                      {joining === server.id ? 'Joining...' : 'Join'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
