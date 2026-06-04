import '../styles/modal.css';
import { useState } from 'react';
import { api, type Server } from '../lib/api';

export default function CreateServerModal({ onClose, onCreated }: { onClose: () => void; onCreated: (s: Server) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { server } = await api.servers.create(name, description);
      onCreated(server);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass-panel animate-in" onClick={(e) => e.stopPropagation()}>
        <h2>Create Server</h2>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={submit}>
          <label>Server Name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} /></label>
          <label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
