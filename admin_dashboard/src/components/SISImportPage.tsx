import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

type SummaryError = {
  row: number;
  messages: string[];
};

type UploadSummary = {
  totalStudents: number;
  totalDebt: number;
  totalTuition: number;
  totalLiving: number;
  totalMedical: number;
  totalOther: number;
  errors: SummaryError[];
};

type PreviewRow = {
  studentNumber: string;
  fullName: string;
  email: string;
  phone: string;
  departmentName: string;
  faculty: string;
  batchYear: number | null;
  semesters: number;
  programCode: string | null;
  startYear: number | null;
  livingStipendChoice: boolean;
  tuitionBaseAmount: number | null;
  totals: {
    tuition: number;
    living: number;
    medical: number;
    other: number;
  };
};

type HistoryBatch = {
  batch_id: string;
  import_date: string;
  file_name: string;
  student_count: number;
  total_debt_imported: number;
  status: string;
  notes: string | null;
};

type BatchStudent = {
  student_id: number;
  student_number: string;
  full_name: string;
  email: string;
  department_name: string;
  batch_year: number | null;
  program_code: string | null;
  tuition_base_amount: number | null;
};

type SISImportPageProps = {
  adminEmail: string;
  adminPassword: string;
  onLogout: () => void;
  onBack: () => void;
  onNavigateAddUser: () => void;
  onNavigateUserList: () => void;
};

const money = new Intl.NumberFormat("en-ET", {
  style: "currency",
  currency: "ETB",
  maximumFractionDigits: 2,
});

export default function SISImportPage({
  adminEmail,
  adminPassword,
  onLogout,
  onBack,
  onNavigateAddUser,
  onNavigateUserList,
}: SISImportPageProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(
    null,
  );
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [fileId, setFileId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [history, setHistory] = useState<HistoryBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<HistoryBatch | null>(null);
  const [batchStudents, setBatchStudents] = useState<BatchStudent[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const canConfirm = useMemo(() => {
    if (!fileId || !uploadSummary) {
      return false;
    }
    return uploadSummary.errors.length === 0;
  }, [fileId, uploadSummary]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/admin/sis-import/history`, {
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load SIS history.");
      }

      const body = await response.json();
      setHistory(body.batches || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [adminEmail, adminPassword]);

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setError(null);

    if (!selectedFile) {
      setError("Please choose a CSV or Excel file.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE_URL}/admin/sis-import/upload`, {
        method: "POST",
        headers: {
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to parse SIS file.");
      }

      const body = await response.json();
      setUploadSummary(body.summary);
      setPreviewRows(body.previewRows || []);
      setFileId(body.fileId);
      setFileName(body.fileName);
      setStatus("File parsed successfully. Review and confirm import.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!fileId) {
      setError("Upload a file before confirming.");
      return;
    }

    setIsConfirming(true);
    setStatus(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/sis-import/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-email": adminEmail,
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ fileId, notes }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 422) {
          throw new Error("SIS file contains validation errors.");
        }
        throw new Error(body.error || "Failed to confirm SIS import.");
      }

      const body = await response.json();
      setStatus(
        `Import complete. ${body.studentCount} students, ${money.format(
          body.totalDebtImported || 0,
        )} total debt.`,
      );
      setSelectedFile(null);
      setUploadSummary(null);
      setPreviewRows([]);
      setFileId(null);
      setFileName(null);
      setNotes("");
      await fetchHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleViewBatch = async (batch: HistoryBatch) => {
    setSelectedBatch(batch);
    setBatchStudents([]);
    setBatchLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/sis-import/batch/${batch.batch_id}/students`,
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
        throw new Error(body.error || "Failed to load batch students.");
      }

      const body = await response.json();
      setBatchStudents(body.students || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setBatchLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = [
      "student_number",
      "full_name",
      "email",
      "phone",
      "department",
      "faculty",
      "batch_year",
      "semesters",
      "program_code",
      "start_year",
      "living_stipend_choice",
      "tuition_base_amount",
      "total_tuition",
      "total_living",
      "total_medical",
      "total_other",
    ];
    const sample = [
      "HU2026CS001",
      "Alemu Bekele",
      "alemu@hu.edu.et",
      "+251900000000",
      "Computer Science",
      "Computing",
      "2026",
      "8",
      "CS",
      "2026",
      "Yes",
      "50000",
      "120000",
      "60000",
      "800",
      "0",
    ];

    const csvContent = `${headers.join(",")}\n${sample.join(",")}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sis_import_template.csv";
    link.click();
    window.URL.revokeObjectURL(url);
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
            Manage Users
          </button>
          <button className="nav-item" onClick={onNavigateUserList}>
            User List
          </button>
          <button className="nav-item active">SIS Import</button>
          <button className="nav-item">Reports</button>
        </nav>

        <button className="sidebar-logout" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1>SIS Import Center</h1>
            <p>
              Upload CSV/Excel files, review summaries, and confirm registrar
              imports.
            </p>
          </div>
          <div className="admin-profile">
            <div className="profile-avatar">AD</div>
            <div>
              <p className="profile-name">{adminEmail}</p>
              <p className="profile-role">Registrar Admin</p>
            </div>
          </div>
        </header>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Upload SIS File</h2>
              <p className="muted">
                Use the template to ensure all required columns are present.
              </p>
            </div>
            <div className="panel-actions">
              <button
                className="action-btn"
                type="button"
                onClick={downloadTemplate}
              >
                Download Template
              </button>
            </div>
          </div>

          <form onSubmit={handleUpload} className="form">
            <label>
              SIS CSV/Excel file
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] || null)
                }
              />
            </label>

            <label>
              Import notes (optional)
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Registrar batch 2026/27"
                rows={3}
              />
            </label>

            {error && <div className="error">{error}</div>}
            {status && <div className="status">{status}</div>}

            <button type="submit" className="primary" disabled={isUploading}>
              {isUploading ? "Parsing..." : "Parse File"}
            </button>
          </form>
        </section>

        {uploadSummary && (
          <section className="panel" style={{ marginTop: 20 }}>
            <div className="panel-header">
              <div>
                <h2>Import Summary</h2>
                <p className="muted">{fileName || "Uploaded file"}</p>
              </div>
              <button
                className="action-btn"
                type="button"
                onClick={handleConfirm}
                disabled={!canConfirm || isConfirming}
              >
                {isConfirming ? "Importing..." : "Confirm Import"}
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div>
                  <p className="stat-label">Students</p>
                  <h3>{uploadSummary.totalStudents}</h3>
                </div>
                <div className="stat-icon">👥</div>
              </div>
              <div className="stat-card">
                <div>
                  <p className="stat-label">Total Debt</p>
                  <h3>{money.format(uploadSummary.totalDebt || 0)}</h3>
                </div>
                <div className="stat-icon">💰</div>
              </div>
              <div className="stat-card">
                <div>
                  <p className="stat-label">Tuition</p>
                  <h3>{money.format(uploadSummary.totalTuition || 0)}</h3>
                </div>
                <div className="stat-icon">🎓</div>
              </div>
              <div className="stat-card">
                <div>
                  <p className="stat-label">Living</p>
                  <h3>{money.format(uploadSummary.totalLiving || 0)}</h3>
                </div>
                <div className="stat-icon">🏠</div>
              </div>
              <div className="stat-card">
                <div>
                  <p className="stat-label">Medical</p>
                  <h3>{money.format(uploadSummary.totalMedical || 0)}</h3>
                </div>
                <div className="stat-icon">🏥</div>
              </div>
              <div className="stat-card">
                <div>
                  <p className="stat-label">Other</p>
                  <h3>{money.format(uploadSummary.totalOther || 0)}</h3>
                </div>
                <div className="stat-icon">📦</div>
              </div>
            </div>

            {uploadSummary.errors.length > 0 && (
              <div className="error">
                <strong>{uploadSummary.errors.length} rows need fixes:</strong>
                <ul>
                  {uploadSummary.errors.map((entry) => (
                    <li key={`err-${entry.row}`}>
                      Row {entry.row}: {entry.messages.join(" ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="table">
              <div
                className="table-header"
                style={{
                  gridTemplateColumns: "1fr 1.4fr 1.4fr 1.2fr 0.7fr 0.8fr",
                }}
              >
                <span>Student #</span>
                <span>Name</span>
                <span>Email</span>
                <span>Department</span>
                <span>Batch</span>
                <span>Semesters</span>
              </div>
              {previewRows.length === 0 && (
                <div className="empty">No preview rows available.</div>
              )}
              {previewRows.map((row) => (
                <div
                  className="table-row"
                  key={`${row.studentNumber}-${row.email}`}
                  style={{
                    gridTemplateColumns: "1fr 1.4fr 1.4fr 1.2fr 0.7fr 0.8fr",
                  }}
                >
                  <span>{row.studentNumber}</span>
                  <span>{row.fullName}</span>
                  <span>{row.email}</span>
                  <span>{row.departmentName}</span>
                  <span>{row.batchYear ?? "-"}</span>
                  <span>{row.semesters}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div>
              <h2>Import History</h2>
              <p className="muted">Latest SIS batches (50).</p>
            </div>
            <div className="panel-actions">
              <button
                className="action-btn"
                type="button"
                onClick={fetchHistory}
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="table">
            <div
              className="table-header"
              style={{
                gridTemplateColumns: "1.3fr 1.2fr 0.8fr 1fr 0.7fr 1fr",
              }}
            >
              <span>File</span>
              <span>Date</span>
              <span>Students</span>
              <span>Total Debt</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {historyLoading && <div className="empty">Loading history...</div>}
            {!historyLoading && history.length === 0 && (
              <div className="empty">No SIS imports yet.</div>
            )}
            {!historyLoading &&
              history.map((batch) => (
                <div
                  className="table-row"
                  key={batch.batch_id}
                  style={{
                    gridTemplateColumns: "1.3fr 1.2fr 0.8fr 1fr 0.7fr 1fr",
                  }}
                >
                  <span>{batch.file_name || "SIS File"}</span>
                  <span>{new Date(batch.import_date).toLocaleString()}</span>
                  <span>{batch.student_count}</span>
                  <span>{money.format(batch.total_debt_imported || 0)}</span>
                  <span>{batch.status}</span>
                  <span className="actions">
                    <button
                      className="action-button approve"
                      type="button"
                      onClick={() => handleViewBatch(batch)}
                    >
                      View Students
                    </button>
                  </span>
                </div>
              ))}
          </div>
        </section>

        {selectedBatch && (
          <section className="panel" style={{ marginTop: 20 }}>
            <div className="panel-header">
              <div>
                <h2>Batch Students</h2>
                <p className="muted">
                  {selectedBatch.file_name || "SIS Import"} ·{" "}
                  {selectedBatch.student_count} students
                </p>
              </div>
              <div className="panel-actions">
                <button
                  className="action-btn"
                  type="button"
                  onClick={() => setSelectedBatch(null)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="table">
              <div
                className="table-header"
                style={{
                  gridTemplateColumns: "0.9fr 1.4fr 1.3fr 1.2fr 0.8fr 0.8fr",
                }}
              >
                <span>Student #</span>
                <span>Name</span>
                <span>Email</span>
                <span>Department</span>
                <span>Batch</span>
                <span>Program</span>
              </div>
              {batchLoading && (
                <div className="empty">Loading batch students...</div>
              )}
              {!batchLoading && batchStudents.length === 0 && (
                <div className="empty">No students found for this batch.</div>
              )}
              {!batchLoading &&
                batchStudents.map((student) => (
                  <div
                    className="table-row"
                    key={`${student.student_id}-${student.student_number}`}
                    style={{
                      gridTemplateColumns:
                        "0.9fr 1.4fr 1.3fr 1.2fr 0.8fr 0.8fr",
                    }}
                  >
                    <span>{student.student_number}</span>
                    <span>{student.full_name}</span>
                    <span>{student.email}</span>
                    <span>{student.department_name || "-"}</span>
                    <span>{student.batch_year ?? "-"}</span>
                    <span>{student.program_code ?? "-"}</span>
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
