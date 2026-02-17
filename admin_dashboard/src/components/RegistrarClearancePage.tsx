import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

type EligibleStudent = {
  student_id: number;
  student_number: string;
  full_name: string;
  email: string;
  department_name: string;
  remaining_balance: number;
  clearances: {
    financial: string;
    departmental: string;
    library: string;
    laboratory: string;
  };
  status: string;
};

type RegistrarClearancePageProps = {
  adminEmail: string;
  adminPassword: string;
  onLogout: () => void;
};

export default function RegistrarClearancePage({
  adminEmail,
  adminPassword,
  onLogout,
}: RegistrarClearancePageProps) {
  const [students, setStudents] = useState<EligibleStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [localClearances, setLocalClearances] = useState<Record<number, boolean>>({});

  const fetchEligible = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/registrar/eligible`, {
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load clearance list.");
      }

      const body = await response.json();
      setStudents(body.students || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEligible();
  }, [adminEmail, adminPassword]);

  const handleIssue = async (studentId: number) => {
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/registrar/issue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ studentId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to issue clearance.");
      }

      setStatus(
        "Clearance letter issued (simulation). Please print physical copy.",
      );
      await fetchEligible();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    }
  };

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
          <button className="nav-item active">Registrar Clearance</button>
        </nav>
        <nav>
            <button className="nav-item">Settings</button>
        </nav>
        <button className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Registrar Clearance</h1>
            <p>Issue clearance letters for students with zero balance.</p>
          </div>
          <div className="admin-profile">
            <div className="profile-avatar">RA</div>
            <div>
              <p className="profile-name">{adminEmail}</p>
              <p className="profile-role">Registrar Admin</p>
            </div>
          </div>
        </header>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Eligible Students</h2>
              <p className="muted">
                Clearance is blocked automatically when balance &gt; 0.
              </p>
            </div>
            <div className="panel-actions">
              <button className="action-btn" onClick={fetchEligible}>
                Refresh
              </button>
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          {status && <div className="status">{status}</div>}

          <div className="table">
            <div
              className="table-header"
              style={{
                  gridTemplateColumns: "1.4fr 1.2fr 1.2fr 1.4fr 1fr",
              }}
            >
              <span>Student</span>
              <span>Email</span>
              <span>Department</span>
                <span>Clearances</span>
              <span>Actions</span>
            </div>
            {loading && <div className="empty">Loading students...</div>}
            {!loading && students.length === 0 && (
              <div className="empty">No eligible students yet.</div>
            )}
            {!loading &&
              students.map((student) => (
                <div
                  key={student.student_id}
                  className="table-row"
                  style={{
                      gridTemplateColumns: "1.4fr 1.2fr 1.2fr 1.4fr 1fr",
                  }}
                >
                  <span>
                    {student.full_name} ({student.student_number})
                  </span>
                  <span>{student.email}</span>
                  <span>{student.department_name || "-"}</span>
                  <span>
                    <div className="status-badge status-active">
                      Finance: {student.clearances.financial}
                    </div>
                    <label style={{ display: "block", marginTop: 6 }}>
                      <input
                        type="checkbox"
                        checked={localClearances[student.student_id] || false}
                        onChange={(event) =>
                          setLocalClearances((prev) => ({
                            ...prev,
                            [student.student_id]: event.target.checked,
                          }))
                        }
                      />
                      <span style={{ marginLeft: 6 }}>
                        Dept/Library/Lab verified (simulation)
                      </span>
                    </label>
                  </span>
                  <span className="actions">
                    <button
                      className="action-button approve"
                      onClick={() => handleIssue(student.student_id)}
                      disabled={!localClearances[student.student_id]}
                    >
                      Issue Clearance
                    </button>
                  </span>
                </div>
              ))}
          </div>
        </section>

        <section className="panel" style={{ marginTop: 20 }}>
          <h3>Important Notice</h3>
          <p className="muted">
            Clearance letters are simulated. Registrar can only issue after
            Finance verification (balance = 0) and all academic clearances are
            confirmed.
          </p>
        </section>
      </main>
    </div>
  );
}
