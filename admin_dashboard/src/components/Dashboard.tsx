import { useMemo, useState, useEffect } from "react";

export type Student = {
  id: string;
  fullName: string;
  email: string;
  studentNumber: string;
  department: string;
  createdAt: string;
};

type DebtRow = {
  studentId: string;
  studentNumber: string;
  fullName: string;
  department: string;
  batch: string | null;
  totalDebt: number;
  currentBalance: number;
};

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  created_at: string;
};

type DashboardProps = {
  adminEmail: string;
  adminPassword: string;
  onLogout: () => void;
  onNavigateAddUser: () => void;
  onNavigateUserList: () => void;
  onNavigateSisImport: () => void;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function Dashboard({
  adminEmail,
  adminPassword,
  onLogout,
  onNavigateAddUser,
  onNavigateUserList,
  onNavigateSisImport,
}: DashboardProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [department, setDepartment] = useState("Computer Science");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalCollections: 0,
    outstandingDebt: 0,
    pendingApprovals: 0,
    pendingVerifications: 0,
  });
  const [statsLoading, setStatsLoading] = useState(false);
  const [debtRows, setDebtRows] = useState<DebtRow[]>([]);
  const [isLoadingDebtRows, setIsLoadingDebtRows] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const fetchStudents = async () => {
    setIsLoadingStudents(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/students`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to load students.";
        throw new Error(message);
      }

      const body = await response.json();
      const studentsFromApi = (body.students || []).map((student: any) => ({
        id: String(student.student_id),
        fullName: student.full_name,
        email: student.email,
        studentNumber: student.student_number,
        department: student.department_name || "Unknown",
        createdAt: student.created_at,
      }));

      setStudents(studentsFromApi);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [adminEmail, adminPassword]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/stats`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to load stats.";
        throw new Error(message);
      }

      const body = await response.json();
      setStats(body.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [adminEmail, adminPassword]);

  const fetchDebtDetails = async () => {
    setIsLoadingDebtRows(true);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/debt-details`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to load debt details.";
        throw new Error(message);
      }

      const body = await response.json();
      const mapped = (body.students || []).map((student: any) => ({
        studentId: String(student.student_id),
        studentNumber: student.student_number || String(student.student_id),
        fullName: student.full_name,
        department: student.department_name || "Unknown",
        batch: student.batch || null,
        totalDebt: Number(student.total_debt) || 0,
        currentBalance: Number(student.current_balance) || 0,
      }));

      setDebtRows(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoadingDebtRows(false);
    }
  };

  useEffect(() => {
    fetchDebtDetails();
  }, [adminEmail, adminPassword]);

  useEffect(() => {
    if (!adminEmail || !adminPassword) {
      return;
    }

    const url = `${API_BASE_URL}/admin/stream?email=${encodeURIComponent(
      adminEmail,
    )}&password=${encodeURIComponent(adminPassword)}`;

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.stats) {
          setStats(payload.stats);
        }
        if (payload.students) {
          const mapped = payload.students.map((student: any) => ({
            studentId: String(student.student_id),
            studentNumber: student.student_number || String(student.student_id),
            fullName: student.full_name,
            department: student.department_name || "Unknown",
            batch: student.batch || null,
            totalDebt: Number(student.total_debt) || 0,
            currentBalance: Number(student.current_balance) || 0,
          }));
          setDebtRows(mapped);
        }
        if (payload.notifications) {
          setNotifications(payload.notifications);
        }
      } catch (_) {
        // Ignore parse errors for stream payloads
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [adminEmail, adminPassword]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }),
    [],
  );

  const canSubmit = useMemo(() => {
    return (
      fullName.trim() &&
      email.trim() &&
      studentNumber.trim() &&
      department.trim() &&
      password.trim()
    );
  }, [fullName, email, studentNumber, department, password]);

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setStudentNumber("");
    setDepartment("Computer Science");
    setPassword("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (!canSubmit) {
      setError("Please fill in all fields.");
      return;
    }

    setIsSubmitting(true);

    const payload = {
      fullName: fullName.trim(),
      email: email.trim(),
      studentNumber: studentNumber.trim(),
      department: department.trim(),
      password: password,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/admin/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to create student in backend.";
        throw new Error(message);
      }

      const created = await response.json();
      const createdStudent = created.student;
      setStudents((prev) => [
        {
          id: String(createdStudent.studentId),
          fullName: createdStudent.fullName,
          email: createdStudent.email,
          studentNumber: createdStudent.studentNumber,
          department: createdStudent.departmentName || payload.department,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      setStatus("Student created successfully (backend synced).");
      resetForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);

      setStatus("Student creation failed. Please try again.");
      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (student: Student) => {
    const newPassword = window.prompt(
      `Enter new password for ${student.fullName} (${student.email})`,
    );

    if (!newPassword) {
      return;
    }

    setResettingId(student.id);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/students/${student.id}/password`,
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

      setStatus(`Password reset for ${student.fullName}.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setResettingId(null);
    }
  };

  const handleDeleteStudent = async (student: Student) => {
    const confirmed = window.confirm(
      `Delete ${student.fullName} (${student.email})? This will remove Firebase and DB records.`,
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(student.id);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/students/${student.id}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-admin-email": adminEmail,
            "x-admin-password": adminPassword,
          },
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to delete student.";
        throw new Error(message);
      }

      setStudents((prev) => prev.filter((s) => s.id !== student.id));
      setStatus(`${student.fullName} deleted.`);
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
          <button className="nav-item active">Dashboard</button>
          <button className="nav-item" onClick={onNavigateAddUser}>
            Manage Users
          </button>
          <button className="nav-item" onClick={onNavigateUserList}>
            User List
          </button>
          <button className="nav-item" onClick={onNavigateSisImport}>
            SIS Import
          </button>
          <button className="nav-item">Reports</button>
          <button className="nav-item">Settings</button>
        </nav>

        <button className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Welcome, {adminEmail.split("@")[0]}.</h1>
            <p>
              Admin dashboard · Track student payments and total remaining cost
            </p>
          </div>
          <div className="admin-header-actions">
            <div className="notifications">
              <button
                className="notification-button"
                onClick={() => setNotificationsOpen((prev) => !prev)}
                type="button"
              >
                <span className="notification-icon">🔔</span>
                {notifications.length > 0 && (
                  <span className="notification-badge">
                    {notifications.length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <div className="notification-header">Notifications</div>
                  {notifications.length === 0 && (
                    <div className="notification-empty">No updates yet.</div>
                  )}
                  {notifications.map((item) => (
                    <div key={item.id} className="notification-item">
                      <p className="notification-message">{item.message}</p>
                      <span className="notification-time">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="admin-profile">
              <div className="profile-avatar">AD</div>
              <div>
                <p className="profile-name">{adminEmail}</p>
                <p className="profile-role">System Administrator</p>
              </div>
            </div>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <div>
              <p className="stat-label">Total Collections</p>
              <h3>{money.format(stats.totalCollections || 0)}</h3>
              <span className="stat-muted">
                {statsLoading
                  ? "Loading..."
                  : "All successful student payments"}
              </span>
            </div>
            <div className="stat-icon">💰</div>
          </div>
          <div className="stat-card">
            <div>
              <p className="stat-label">Outstanding Debt</p>
              <h3>{money.format(stats.outstandingDebt || 0)}</h3>
              <span className="stat-muted">
                Total remaining debt across all students
              </span>
            </div>
            <div className="stat-icon">📉</div>
          </div>
        </section>

        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="quick-actions-grid">
            <button className="action-btn">Generate Reports</button>
            <button className="action-btn" onClick={onNavigateAddUser}>
              Add User
            </button>
            <button className="action-btn" onClick={onNavigateUserList}>
              User List
            </button>
            <button className="action-btn" onClick={onNavigateSisImport}>
              SIS Import
            </button>
          </div>
        </section>

        <section className="manage-users">
          {/* <div className="panel">
            <h2>Create Student</h2>
            <p className="muted">
              Create Firebase + DB record through the API.
            </p>

            <form onSubmit={handleSubmit} className="form">
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
                  placeholder="student2@hu.edu.et"
                  required
                />
              </label>
              <label>
                Student Number
                <input
                  value={studentNumber}
                  onChange={(event) => setStudentNumber(event.target.value)}
                  placeholder="HU2026CS001"
                  required
                />
              </label>
              <label>
                Department
                <input
                  value={department}
                  onChange={(event) => setDepartment(event.target.value)}
                  placeholder="Computer Science"
                  required
                />
              </label>
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
                {isSubmitting ? "Creating..." : "Create Student"}
              </button>
            </form>
          </div> */}

          <div className="panel">
            <h2>Recent Students</h2>
            <p className="muted">Synced from the backend.</p>
            <div className="table">
              <div className="table-header">
                <span>Name</span>
                <span>Email</span>
                <span>Student #</span>
                <span>Department</span>
                <span>Created</span>
                <span>Actions</span>
              </div>
              {isLoadingStudents && (
                <div className="empty">Loading students...</div>
              )}
              {!isLoadingStudents && students.length === 0 && (
                <div className="empty">No students created yet.</div>
              )}
              {!isLoadingStudents &&
                students.slice(0, 5).map((student) => (
                  <div className="table-row" key={student.id}>
                    <span>{student.fullName}</span>
                    <span>{student.email}</span>
                    <span>{student.studentNumber}</span>
                    <span>{student.department}</span>
                    <span>{new Date(student.createdAt).toLocaleString()}</span>
                    <span className="actions">
                      <button
                        className="ghost"
                        onClick={() => handleResetPassword(student)}
                        disabled={resettingId === student.id}
                      >
                        {resettingId === student.id
                          ? "Resetting..."
                          : "Reset Password"}
                      </button>
                      <button
                        className="danger"
                        onClick={() => handleDeleteStudent(student)}
                        disabled={deletingId === student.id}
                      >
                        {deletingId === student.id ? "Deleting..." : "Delete"}
                      </button>
                      <button
                        className="ghost"
                        onClick={() => alert("Edit not implemented")}
                      >
                        Edit
                      </button>
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
