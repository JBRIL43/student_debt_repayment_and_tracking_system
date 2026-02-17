import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

type UserListPageProps = {
  adminEmail: string;
  adminPassword: string;
  onLogout: () => void;
  onBack: () => void;
  onNavigateAddUser: () => void;
  onNavigateSisImport: () => void;
};

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  studentNumber: string | null;
  createdAt: string;
};

export default function UserListPage({
  adminEmail,
  adminPassword,
  onLogout,
  onBack,
  onNavigateAddUser,
  onNavigateSisImport,
}: UserListPageProps) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to load users.";
        throw new Error(message);
      }

      const body = await response.json();
      const mapped = (body.users || []).map((user: any) => ({
        id: String(user.user_id),
        fullName: user.full_name,
        email: user.email,
        role: user.role,
        department: user.department_name || "-",
        studentNumber: user.student_number || null,
        createdAt: user.created_at,
      }));

      setUsers(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [adminEmail, adminPassword]);

  const filteredUsers = users.filter((user) => {
    if (roleFilter === "ALL") {
      return true;
    }
    return user.role === roleFilter;
  });

  const handleResetPassword = async (user: UserRow) => {
    const newPassword = window.prompt(
      `Enter new password for ${user.fullName} (${user.email})`,
    );

    if (!newPassword) {
      return;
    }

    setResettingId(user.id);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/users/${user.id}/password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-email": adminEmail,
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({ newPassword }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to reset password.";
        throw new Error(message);
      }

      setStatus(`Password reset for ${user.fullName}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setResettingId(null);
    }
  };

  const handleEditUser = async (user: UserRow) => {
    const fullName = window.prompt("Full name", user.fullName);
    if (!fullName) return;

    const email = window.prompt("Email", user.email);
    if (!email) return;

    const department = window.prompt(
      "Department",
      user.department === "-" ? "" : user.department,
    );
    if (department === null) return;

    const studentNumber = window.prompt(
      "Student number",
      user.studentNumber ?? "",
    );
    if (studentNumber === null) return;

    setStatus(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          department: department.trim(),
          studentNumber: studentNumber.trim(),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to update user.";
        throw new Error(message);
      }

      setStatus(`Updated ${fullName}.`);
      fetchUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    }
  };

  const handleDeleteUser = async (user: UserRow) => {
    const confirmed = window.confirm(
      `Delete ${user.fullName} (${user.email})? This will remove Firebase and DB records.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(user.id);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to delete user.";
        throw new Error(message);
      }

      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setStatus(`${user.fullName} deleted.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setDeletingId(null);
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
          <button className="nav-item" onClick={onNavigateAddUser}>
            Add User
          </button>
          <button className="nav-item active">User List</button>
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
            <h1>User List</h1>
            <p>Review, reset passwords, or delete any system user.</p>
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
          <div className="panel-header">
            <div>
              <h2>User List</h2>
              <p className="muted">Manage users across all roles.</p>
            </div>
            <div className="panel-actions">
              <select
                className="filter-select"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="ALL">All Roles</option>
                <option value="STUDENT">Student</option>
                <option value="DEPT_HEAD">Department Head</option>
                <option value="FINANCE_OFFICER">Finance Officer</option>
                <option value="REGISTRAR_ADMIN">Registrar Admin</option>
              </select>
            </div>
          </div>

          {error && <div className="error">{error}</div>}
          {status && <div className="status">{status}</div>}
          <div className="table">
            <div className="table-header">
              <span>User ID</span>
              <span>Name</span>
              <span>Role</span>
              <span>Department</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {isLoading && <div className="empty">Loading users...</div>}
            {!isLoading && filteredUsers.length === 0 && (
              <div className="empty">No users found.</div>
            )}
            {!isLoading &&
              filteredUsers.map((user) => (
                <div className="table-row" key={user.id}>
                  <span>{user.studentNumber ?? user.id}</span>
                  <span>{user.fullName}</span>
                  <span>{user.role.replace("_", " ")}</span>
                  <span>{user.department}</span>
                  <span>
                    <span className="status-badge status-active">Active</span>
                  </span>
                  <span className="actions">
                    <button
                      className="action-button"
                      onClick={() => handleEditUser(user)}
                    >
                      Edit
                    </button>
                    <button
                      className="action-button approve"
                      onClick={() => handleResetPassword(user)}
                      disabled={resettingId === user.id}
                    >
                      {resettingId === user.id
                        ? "Resetting..."
                        : "Reset Password"}
                    </button>
                    <button
                      className="action-button reject"
                      onClick={() => handleDeleteUser(user)}
                      disabled={deletingId === user.id}
                    >
                      {deletingId === user.id ? "Deleting..." : "Delete"}
                    </button>
                  </span>
                </div>
              ))}
          </div>
        </section>
      </main>
    </div>
  );
}
