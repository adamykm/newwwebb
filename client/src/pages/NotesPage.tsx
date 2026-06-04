import './PageShell.css';
import { useEffect, useState } from 'react';
import { api, type Note, formatDate } from '../lib/api';

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const load = () => api.notes.list().then((r) => setNotes(r.notes));
  useEffect(() => { load(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (editing) {
      await api.notes.update(editing, { title, body });
      setEditing(null);
    } else {
      await api.notes.create({ title, body });
    }
    setTitle('');
    setBody('');
    load();
  };

  const edit = (note: Note) => {
    setEditing(note.id);
    setTitle(note.title);
    setBody(note.body);
  };

  const remove = async (id: string) => {
    await api.notes.delete(id);
    if (editing === id) { setEditing(null); setTitle(''); setBody(''); }
    load();
  };

  return (
    <div className="page-shell animate-in">
      <header className="page-header">
        <div>
          <h1>Notes</h1>
          <p className="page-subtitle">Private notes — yours alone</p>
        </div>
      </header>

      <form className="form-inline glass-panel" onSubmit={save}>
        <input placeholder="Note title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea placeholder="Write your note..." value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        <div className="form-row">
          <button type="submit" className="btn btn-primary">{editing ? 'Update Note' : 'Add Note'}</button>
          {editing && <button type="button" className="btn btn-ghost" onClick={() => { setEditing(null); setTitle(''); setBody(''); }}>Cancel</button>}
        </div>
      </form>

      <div className="item-list">
        {notes.length === 0 ? (
          <div className="empty-state glass-panel"><h3>No notes</h3><p>Start writing above</p></div>
        ) : notes.map((note) => (
          <div key={note.id} className="item-card">
            <div className="item-card-header">
              <h3>{note.title}</h3>
              <div className="item-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => edit(note)}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(note.id)}>Delete</button>
              </div>
            </div>
            <p className="item-meta">Updated {formatDate(note.updatedAt)}</p>
            {note.body && <p style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 14, whiteSpace: 'pre-wrap' }}>{note.body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
