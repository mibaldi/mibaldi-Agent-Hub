import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Inicio', icon: '🏠', end: true },
  { to: '/hosts', label: 'Hosts', icon: '🖥️' },
  { to: '/projects', label: 'Proyectos', icon: '📁' },
  { to: '/history', label: 'Historial', icon: '🕑' },
];

export function Layout() {
  return (
    <div className="app">
      <main className="content">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>
            <span className="icon">{l.icon}</span>
            <span>{l.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
