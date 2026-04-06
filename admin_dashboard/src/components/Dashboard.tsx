import { useMemo, useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";

export type Student = {
  id: string;
  fullName: string;
  email: string;
  studentNumber: string;
  department: string;
  createdAt: string;
};

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  created_at: string;
  is_read?: boolean;
  is_deleted?: boolean;
};

type DashboardNotification = NotificationItem & {
  isRead: boolean;
  isDeleted: boolean;
};

type DashboardProps = {
  adminEmail: string;
  adminPassword: string;
  onLogout: () => void;
  onNavigateAddUser: () => void;
  onNavigateUserList: () => void;
  onNavigateSisImport: () => void;
  onNavigateReports: () => void;
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
  onNavigateReports,
}: DashboardProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const [notifications, setNotifications] = useState<DashboardNotification[]>(
    [],
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const mapNotifications = (items: NotificationItem[]) => {
    return items.map((item) => ({
      id: String(item.id),
      type: item.type || "INFO",
      message: item.message || "Notification",
      created_at: item.created_at || new Date().toISOString(),
      isRead: Boolean(item.is_read),
      isDeleted: Boolean(item.is_deleted),
    }));
  };

  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/notifications`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const message = body.error || "Failed to load notifications.";
        throw new Error(message);
      }

      const body = await response.json();
      setNotifications(mapNotifications(body.notifications || []));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    }
  };

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

  useEffect(() => {
    fetchNotifications();
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
        if (payload.notifications) {
          setNotifications(
            mapNotifications(payload.notifications as NotificationItem[]),
          );
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

  const visibleNotifications = useMemo(
    () => notifications.filter((item) => !item.isDeleted),
    [notifications],
  );

  const unreadNotificationCount = useMemo(
    () => visibleNotifications.filter((item) => !item.isRead).length,
    [visibleNotifications],
  );

  const unreadNotificationBadge =
    unreadNotificationCount > 99
      ? "99+"
      : unreadNotificationCount > 0
        ? String(unreadNotificationCount)
        : null;

  const handleMarkNotificationRead = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item,
      ),
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/notifications/${notificationId}/read`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-email": adminEmail,
            "x-admin-password": adminPassword,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to mark notification as read.");
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to mark notification as read.";
      setError(message);
      fetchNotifications();
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notificationId
          ? { ...item, isDeleted: true, isRead: true }
          : item,
      ),
    );

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/notifications/${notificationId}/delete`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-admin-email": adminEmail,
            "x-admin-password": adminPassword,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete notification.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete notification.";
      setError(message);
      fetchNotifications();
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
      <AdminSidebar
        items={[
          { label: "Dashboard", active: true },
          { label: "Manage Users", onClick: onNavigateAddUser },
          { label: "User List", onClick: onNavigateUserList },
          { label: "SIS Import", onClick: onNavigateSisImport },
          { label: "Reports", onClick: onNavigateReports },
          { label: "Settings" },
        ]}
        onLogout={onLogout}
      />

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
                {unreadNotificationBadge && (
                  <span className="notification-badge">
                    {unreadNotificationBadge}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <div className="notification-header">Notifications</div>
                  {visibleNotifications.length === 0 && (
                    <div className="notification-empty">No updates yet.</div>
                  )}
                  {visibleNotifications.map((item) => (
                    <div
                      key={item.id}
                      className={`notification-item${item.isRead ? "" : " unread"}`}
                    >
                      <p className="notification-message">{item.message}</p>
                      <div className="notification-item-footer">
                        <span className="notification-time">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                        <div className="notification-actions">
                          {!item.isRead && (
                            <button
                              type="button"
                              className="notification-action"
                              onClick={() =>
                                handleMarkNotificationRead(item.id)
                              }
                            >
                              Mark as read
                            </button>
                          )}
                          <button
                            type="button"
                            className="notification-action danger"
                            onClick={() => handleDeleteNotification(item.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
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

        {error && <div className="error">{error}</div>}
        {status && <div className="status">{status}</div>}

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
            <button className="action-btn" onClick={onNavigateReports}>
              Generate Reports
            </button>
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
