import './PageShell.css';
import { useEffect, useState } from 'react';
import { api, type Event, formatDateTime } from '../lib/api';

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState('');
  const [startAt, setStartAt] = useState('');
  const [location, setLocation] = useState('');

  const load = () => api.events.list().then((r) => setEvents(r.events));
  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startAt) return;
    await api.events.create({ title, startAt: new Date(startAt).getTime(), location });
    setTitle('');
    setStartAt('');
    setLocation('');
    load();
  };

  const remove = async (id: string) => {
    await api.events.delete(id);
    load();
  };

  return (
    <div className="page-shell animate-in">
      <header className="page-header">
        <div>
          <h1>Events</h1>
          <p className="page-subtitle">Your personal event calendar</p>
        </div>
      </header>

      <form className="form-inline glass-panel" onSubmit={create}>
        <div className="form-row">
          <input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
          <input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
          <button type="submit" className="btn btn-primary">Add Event</button>
        </div>
      </form>

      <div className="item-list">
        {events.length === 0 ? (
          <div className="empty-state glass-panel"><h3>No events</h3><p>Schedule something above</p></div>
        ) : events.map((ev) => (
          <div key={ev.id} className="item-card">
            <div className="item-card-header">
              <h3>{ev.title}</h3>
              <button className="btn btn-danger btn-sm" onClick={() => remove(ev.id)}>Delete</button>
            </div>
            <p className="item-meta">{formatDateTime(ev.startAt)}{ev.location && ` · ${ev.location}`}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
