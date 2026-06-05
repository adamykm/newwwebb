import './PageShell.css';
import { useEffect, useState } from 'react';
import { api, type Task, formatDate } from '../lib/api';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');

  const load = () => api.tasks.list().then((r) => setTasks(r.tasks));

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await api.tasks.create({ title, priority, status: 'todo' });
    setTitle('');
    load();
  };

  const cycleStatus = async (task: Task) => {
    const next = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'done' : 'todo';
    await api.tasks.update(task.id, { status: next });
    load();
  };

  const remove = async (id: string) => {
    await api.tasks.delete(id);
    load();
  };

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="page-shell animate-in">
      <header className="page-header">
        <div>
          <h1>Tasks</h1>
          <p className="page-subtitle">Your personal task board — only you can see these</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">All</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </header>

      <form className="form-inline glass-panel" onSubmit={create}>
        <div className="form-row">
          <input placeholder="New task title..." value={title} onChange={(e) => setTitle(e.target.value)} />
          <select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button type="submit" className="btn btn-primary">Add Task</button>
        </div>
      </form>

      <div className="item-list">
        {filtered.length === 0 ? (
          <div className="empty-state glass-panel"><h3>No tasks yet</h3><p>Create your first task above</p></div>
        ) : filtered.map((task) => (
          <div key={task.id} className="item-card">
            <div className="item-card-header">
              <h3>{task.title}</h3>
              <div className="item-actions">
                <span className={`badge badge-${task.status === 'in_progress' ? 'progress' : task.status === 'done' ? 'done' : 'todo'}`}>{task.status.replace('_', ' ')}</span>
                <span className={`badge badge-${task.priority}`}>{task.priority}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => cycleStatus(task)}>Cycle</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(task.id)}>Delete</button>
              </div>
            </div>
            {task.dueAt && <p className="item-meta">Due {formatDate(task.dueAt)}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
