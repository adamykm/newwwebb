import '../styles/modal.css';
import { useState } from 'react';
import { api } from '../lib/api';

export default function JoinServerModal({ onClose, onJoined }: { onClose: () => void; onJoined: (serverId: string) => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { serverId } = await api.servers.join(code);
      onJoined(serverId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-panel animate-in" onClick={(e) => e.stopPropagation()}>
        <h2>Join Server</h2>
        <p className="modal-desc">Enter an invite code to join a community server.</p>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={submit}>
          <label>Invite Code<input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="abc12345" /></label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Joining...' : 'Join'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
