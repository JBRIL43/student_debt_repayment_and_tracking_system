import { useState } from "react";

const ADMIN_EMAIL = "adminstudent@hu.edu.et";
const ADMIN_PASSWORD = "admin123";
const ROLE_CREDENTIALS: Record<string, { email: string; password: string }> = {
  Admin: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  "Department Head": { email: "cshead@hu.edu.et", password: "Dept@2026" },
  "Finance Officer": { email: "finance@hu.edu.et", password: "Finance@2026" },
  Registrar: { email: "registrar@hu.edu.et", password: "Registrar@2026" },
};

type LoginPageProps = {
  onLogin: (
    email: string,
    password: string,
    remember: boolean,
    role: string,
  ) => void;
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState(ROLE_CREDENTIALS.Admin.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Admin");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const expected = ROLE_CREDENTIALS[role];
    if (!expected) {
      setError("Invalid role selected.");
      return;
    }

    if (
      email.trim() === expected.email &&
      password === expected.password
    ) {
      onLogin(email.trim(), password, rememberMe, role);
      return;
    }

    setError("Invalid credentials for selected role.");
  };

  return (
    <div className="login-page">
      <div className="login-layout">
        <section className="login-panel">
          <div className="brand">
            <div className="brand-mark">HU</div>
            <div>
              <p className="brand-title">Hawassa University</p>
              <p className="brand-subtitle">Unified Staff Login</p>
            </div>
          </div>

          <p className="login-intro">
            Welcome. Please enter your credentials to access the student debt
            payment &amp; tracking system.
          </p>

          <form onSubmit={handleSubmit} className="login-form">
            <label className="field">
              <span>Select Your Role</span>
              <select
                value={role}
                onChange={(event) => {
                  const nextRole = event.target.value;
                  setRole(nextRole);
                  const preset = ROLE_CREDENTIALS[nextRole];
                  if (preset) {
                    setEmail(preset.email);
                  }
                }}
              >
                <option>Department Head</option>
                <option>Registrar</option>
                <option>Admin</option>
                <option>Finance Officer</option>
              </select>
            </label>

            <label className="field">
              <span>Username / Staff ID</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="adminstudent@hu.edu.et"
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            <div className="login-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                Remember me
              </label>
              <button className="link" type="button">
                Forgot your password?
              </button>
            </div>

            {error && <div className="error">{error}</div>}

            <button type="submit" className="primary full-width">
              Login
            </button>
          </form>

          <div className="helper">
            Demo credentials:
            <ul>
              <li>
                Admin: <strong>{ADMIN_EMAIL}</strong> /{" "}
                <strong>{ADMIN_PASSWORD}</strong>
              </li>
              <li>
                Department Head: <strong>cshead@hu.edu.et</strong> /{" "}
                <strong>Dept@2026</strong>
              </li>
              <li>
                Finance Officer: <strong>finance@hu.edu.et</strong> /{" "}
                <strong>Finance@2026</strong>
              </li>
              <li>
                Registrar: <strong>registrar@hu.edu.et</strong> /{" "}
                <strong>Registrar@2026</strong>
              </li>
            </ul>
          </div>
        </section>

        <aside className="login-preview">
          <div className="preview-card">
            <h2>Welcome to Your Staff Hub</h2>
            <p>
              A preview of the tools available to you once you're logged in
              based on your selected role.
            </p>
            <div className="preview-list">
              <button type="button" className="preview-item active">
                Dashboard
              </button>
              <button type="button" className="preview-item">
                Manage Users
              </button>
              <button type="button" className="preview-item">
                View Analytics
              </button>
              <button type="button" className="preview-item">
                System Settings
              </button>
              <button type="button" className="preview-item">
                Support
              </button>
            </div>
            <div className="preview-cta" />
          </div>
        </aside>
      </div>
    </div>
  );
}
