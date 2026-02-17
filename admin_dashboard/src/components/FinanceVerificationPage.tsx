import { useEffect, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

type RequestItem = {
  requestId: number;
  studentId: number;
  fullName: string;
  studentNumber: string;
  departmentName: string;
  requestedAmount: number;
  paymentMethod: string;
  status: string;
  semester: string;
  academicYear: string;
  componentType: string;
  requestedAt: string;
  transactionRef?: string | null;
};

type FinanceVerificationPageProps = {
  adminEmail: string;
  adminPassword: string;
  onLogout: () => void;
};

const money = new Intl.NumberFormat("en-ET", {
  style: "currency",
  currency: "ETB",
});

export default function FinanceVerificationPage({
  adminEmail,
  adminPassword,
  onLogout,
}: FinanceVerificationPageProps) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/finance/requests?status=PENDING`,
        {
          headers: {
            "Content-Type": "application/json",
            "x-admin-email": adminEmail,
            "x-admin-password": adminPassword,
          },
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load payment requests.");
      }

      const body = await response.json();
      setRequests(body.requests || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [adminEmail, adminPassword]);

  const handleVerify = async (requestId: number) => {
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/finance/requests/${requestId}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-email": adminEmail,
            "x-admin-password": adminPassword,
          },
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to verify payment.");
      }

      setStatus("Payment verified and balance updated.");
      await fetchRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    }
  };

  const handleReject = async (requestId: number) => {
    const reason = window.prompt("Reason for rejection (optional)") || "";
    setStatus(null);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/finance/requests/${requestId}/reject`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-email": adminEmail,
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to reject payment.");
      }

      setStatus("Payment request rejected.");
      await fetchRequests();
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
          <button className="nav-item active">Finance Verification</button>
        </nav>

        <button className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>Finance Verification</h1>
            <p>Verify receipts and update balances in SIS.</p>
          </div>
          <div className="admin-profile">
            <div className="profile-avatar">FO</div>
            <div>
              <p className="profile-name">{adminEmail}</p>
              <p className="profile-role">Finance Officer</p>
            </div>
          </div>
        </header>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Pending Payment Requests</h2>
              <p className="muted">Manual verification required.</p>
            </div>
            <div className="panel-actions">
              <button className="action-btn" onClick={fetchRequests}>
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
                gridTemplateColumns: "1.1fr 1.3fr 1fr 0.8fr 1fr 1.2fr 1fr",
              }}
            >
              <span>Student</span>
              <span>Department</span>
              <span>Semester</span>
              <span>Type</span>
              <span>Method</span>
              <span>Amount</span>
              <span>Actions</span>
            </div>
            {loading && <div className="empty">Loading requests...</div>}
            {!loading && requests.length === 0 && (
              <div className="empty">No pending requests.</div>
            )}
            {!loading &&
              requests.map((req) => (
                <div
                  key={req.requestId}
                  className="table-row"
                  style={{
                    gridTemplateColumns: "1.1fr 1.3fr 1fr 0.8fr 1fr 1.2fr 1fr",
                  }}
                >
                  <span>
                    {req.fullName} ({req.studentNumber})
                  </span>
                  <span>{req.departmentName || "-"}</span>
                  <span>
                    {req.semester} {req.academicYear}
                  </span>
                  <span>{req.componentType}</span>
                  <span>{req.paymentMethod}</span>
                  <span>{money.format(req.requestedAmount)}</span>
                  <span className="actions">
                    <button
                      className="action-button approve"
                      onClick={() => handleVerify(req.requestId)}
                    >
                      Verify
                    </button>
                    <button
                      className="action-button reject"
                      onClick={() => handleReject(req.requestId)}
                    >
                      Reject
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
