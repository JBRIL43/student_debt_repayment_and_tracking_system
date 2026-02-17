type DepartmentHeadPageProps = {
  adminEmail: string;
  onLogout: () => void;
};

export default function DepartmentHeadPage({
  adminEmail,
  onLogout,
}: DepartmentHeadPageProps) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">HU</div>
          <div>
            <p className="brand-title">Admin Panel</p>
            <p className="brand-subtitle">Hawassa University</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className="nav-item active">Department Dashboard</button>
        </nav>

        <button className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Department Head Dashboard</h1>
            <p>Academic clearance and special payment plan requests.</p>
          </div>
          <div className="admin-profile">
            <div className="profile-avatar">DH</div>
            <div>
              <p className="profile-name">{adminEmail}</p>
              <p className="profile-role">Department Head</p>
            </div>
          </div>
        </header>

        <section className="panel">
          <h2>Pending Requests</h2>
          <p className="muted">
            Department head approvals are only required for academic clearance
            and exceptional payment plan requests. (Simulation)
          </p>
          <div className="empty">No requests assigned.</div>
        </section>
      </main>
    </div>
  );
}
