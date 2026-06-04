import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthPage from './pages/AuthPage';
import AppLayout from './components/AppLayout';
import HomePage from './pages/HomePage';
import TasksPage from './pages/TasksPage';
import NotesPage from './pages/NotesPage';
import EventsPage from './pages/EventsPage';
import MembersPage from './pages/MembersPage';
import ServerPage from './pages/ServerPage';
import AdminPage from './pages/AdminPage';
import DiscoveryPage from './pages/DiscoveryPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">Loading Nexus Hub...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="notes" element={<NotesPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="servers/:serverId" element={<ServerPage />} />
        <Route path="discovery" element={<DiscoveryPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
