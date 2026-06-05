import './PageShell.css';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface MemberView {
  userId: string;
  username: string;
  avatarColor: string;
  servers: string[];
}

export default function MembersPage() {
  const [members, setMembers] = useState<MemberView[]>([]);

  useEffect(() => {
    api.servers.list().then(async (r) => {
      const map = new Map<string, MemberView>();
      for (const server of r.servers) {
        const detail = await api.servers.get(server.id);
        for (const m of detail.members) {
          const existing = map.get(m.userId);
          if (existing) existing.servers.push(server.name);
          else map.set(m.userId, { ...m, servers: [server.name] });
        }
      }
      setMembers([...map.values()]);
    });
  }, []);

  return (
    <div className="page-shell animate-in">
      <header className="page-header">
        <div>
          <h1>Members</h1>
          <p className="page-subtitle">People in your shared servers</p>
        </div>
      </header>

      <div className="item-list">
        {members.length === 0 ? (
          <div className="empty-state glass-panel">
            <h3>No members yet</h3>
            <p>Create or join a server to see members here</p>
          </div>
        ) : members.map((m) => (
          <div key={m.userId} className="item-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="avatar" style={{ background: m.avatarColor }}>{m.username[0].toUpperCase()}</div>
            <div style={{ flex: 1 }}>
              <h3>{m.username}</h3>
              <p className="item-meta">Servers: {m.servers.join(', ')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
