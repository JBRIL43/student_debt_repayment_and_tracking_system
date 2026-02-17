import { useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

type AddUserPageProps = {
  adminEmail: string;
  adminPassword: string;
  onLogout: () => void;
  onBack: () => void;
  onNavigateUserList: () => void;
  onNavigateSisImport: () => void;
};

type RoleOption =
  | "STUDENT"
  | "DEPT_HEAD"
  | "FINANCE_OFFICER"
  | "REGISTRAR_ADMIN";

const ROLE_LABELS: Record<RoleOption, string> = {
  STUDENT: "Student",
  DEPT_HEAD: "Department Head",
  FINANCE_OFFICER: "Finance Officer",
  REGISTRAR_ADMIN: "Registrar Admin",
};

export default function AddUserPage({
  adminEmail,
  adminPassword,
  onLogout,
  onBack,
  onNavigateUserList,
  onNavigateSisImport,
}: AddUserPageProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RoleOption>("STUDENT");
  const [department, setDepartment] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiresDepartment = role === "STUDENT" || role === "DEPT_HEAD";
  const requiresStudentNumber = role === "STUDENT";

  const canSubmit = useMemo(() => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      return false;
    }
    if (!role) {
      return false;
    }
    if (requiresDepartment && !department.trim()) {
      return false;
    }
    if (requiresStudentNumber && !studentNumber.trim()) {
      return false;
    }
    return true;
  }, [
    fullName,
    email,
    password,
    role,
    department,
    studentNumber,
    requiresDepartment,
    requiresStudentNumber,
  ]);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setRole("STUDENT");
    setDepartment("");
    setStudentNumber("");
    setPassword("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (!canSubmit) {
      setError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          role,
          department: department.trim(),
          studentNumber: studentNumber.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to create user.";
        throw new Error(message);
      }

      setStatus(
        body.warning
          ? `User created. ${body.warning}`
          : "User created successfully.",
      );
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsSubmitting(false);
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
          <button className="nav-item" onClick={onBack}>
            Dashboard
          </button>
          <button className="nav-item active">Manage Users</button>
          <button className="nav-item" onClick={onNavigateUserList}>
            User List
          </button>
          <button className="nav-item" onClick={onNavigateSisImport}>
            SIS Import
          </button>
          <button className="nav-item">Reports</button>
        </nav>

        <button className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Add New User</h1>
            <p>
              Create student, staff, department head, or registrar accounts.
            </p>
          </div>
          <div className="admin-profile">
            <div className="profile-avatar">AD</div>
            <div>
              <p className="profile-name">{adminEmail}</p>
              <p className="profile-role">System Administrator</p>
            </div>
          </div>
        </header>

        <section className="panel">
          <form onSubmit={handleSubmit} className="form">
            <div className="role-selector">
              <p className="role-label">Role</p>
              <div className="role-options">
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`role-option${role === value ? " active" : ""}`}
                    onClick={() => setRole(value as RoleOption)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label>
              Full Name
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Alemu Bekele"
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="staff@hu.edu.et"
                required
              />
            </label>

            {requiresDepartment && (
              <label>
                Department
                <input
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Computer Science"
                  required
                />
              </label>
            )}

            {requiresStudentNumber && (
              <label>
                Student Number
                <input
                  value={studentNumber}
                  onChange={(event) => setStudentNumber(event.target.value)}
                  placeholder="HU2026CS002"
                  required
                />
              </label>
            )}

            <label>
              Temporary Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Temp password"
                required
              />
            </label>

            {error && <div className="error">{error}</div>}
            {status && <div className="status">{status}</div>}

            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create User"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
