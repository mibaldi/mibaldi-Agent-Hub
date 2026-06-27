import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Hosts } from './pages/Hosts';
import { HostForm } from './pages/HostForm';
import { Projects } from './pages/Projects';
import { ProjectForm } from './pages/ProjectForm';
import { TerminalPage } from './pages/TerminalPage';
import { History } from './pages/History';

function Protected({ children }: { children: JSX.Element }) {
  const { authed } = useAuth();
  const loc = useLocation();
  if (!authed) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* La terminal es pantalla completa, fuera del Layout con nav inferior. */}
      <Route
        path="/terminal/:projectId"
        element={
          <Protected>
            <TerminalPage />
          </Protected>
        }
      />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/hosts" element={<Hosts />} />
        <Route path="/hosts/new" element={<HostForm />} />
        <Route path="/hosts/:id/edit" element={<HostForm />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/new" element={<ProjectForm />} />
        <Route path="/projects/:id/edit" element={<ProjectForm />} />
        <Route path="/history" element={<History />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
