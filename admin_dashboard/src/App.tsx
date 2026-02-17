import { useEffect, useState } from "react";
import "./App.css";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import AddUserPage from "./components/AddUserPage";
import UserListPage from "./components/UserListPage";
import SISImportPage from "./components/SISImportPage";
import FinanceVerificationPage from "./components/FinanceVerificationPage";
import RegistrarClearancePage from "./components/RegistrarClearancePage";
import DepartmentHeadPage from "./components/DepartmentHeadPage";

function App() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [staffRole, setStaffRole] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<
    | "dashboard"
    | "add-user"
    | "list-users"
    | "sis-import"
    | "finance"
    | "registrar"
    | "department"
  >("dashboard");

  useEffect(() => {
    const savedEmail =
      localStorage.getItem("admin_email") ||
      sessionStorage.getItem("admin_email");
    const savedPassword =
      localStorage.getItem("admin_password") ||
      sessionStorage.getItem("admin_password");
    const savedRole =
      localStorage.getItem("admin_role") ||
      sessionStorage.getItem("admin_role");
    if (savedEmail && savedPassword) {
      setAdminEmail(savedEmail);
      setAdminPassword(savedPassword);
      if (savedRole) {
        setStaffRole(savedRole);
        if (savedRole === "Finance Officer") {
          setActiveView("finance");
        } else if (savedRole === "Registrar") {
          setActiveView("registrar");
        } else if (savedRole === "Department Head") {
          setActiveView("department");
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!staffRole) {
      return;
    }
    if (staffRole === "Finance Officer" && activeView === "dashboard") {
      setActiveView("finance");
    } else if (staffRole === "Registrar" && activeView === "dashboard") {
      setActiveView("registrar");
    } else if (staffRole === "Department Head" && activeView === "dashboard") {
      setActiveView("department");
    }
  }, [staffRole, activeView]);

  if (!adminEmail || !adminPassword) {
    return (
      <LoginPage
        onLogin={(email, password, remember, role) => {
          setAdminEmail(email);
          setAdminPassword(password);
          setStaffRole(role);
          if (remember) {
            localStorage.setItem("admin_email", email);
            localStorage.setItem("admin_password", password);
            localStorage.setItem("admin_role", role);
            sessionStorage.removeItem("admin_email");
            sessionStorage.removeItem("admin_password");
            sessionStorage.removeItem("admin_role");
          } else {
            sessionStorage.setItem("admin_email", email);
            sessionStorage.setItem("admin_password", password);
            sessionStorage.setItem("admin_role", role);
          }
          if (role === "Finance Officer") {
            setActiveView("finance");
          } else if (role === "Registrar") {
            setActiveView("registrar");
          } else if (role === "Department Head") {
            setActiveView("department");
          } else {
            setActiveView("dashboard");
          }
        }}
      />
    );
  }

  if (activeView === "add-user") {
    return (
      <AddUserPage
        adminEmail={adminEmail}
        adminPassword={adminPassword}
        onLogout={() => {
          setAdminEmail(null);
          setAdminPassword(null);
          setStaffRole(null);
          localStorage.removeItem("admin_email");
          localStorage.removeItem("admin_password");
          localStorage.removeItem("admin_role");
          sessionStorage.removeItem("admin_email");
          sessionStorage.removeItem("admin_password");
          sessionStorage.removeItem("admin_role");
          setActiveView("dashboard");
        }}
        onBack={() => setActiveView("dashboard")}
        onNavigateUserList={() => setActiveView("list-users")}
        onNavigateSisImport={() => setActiveView("sis-import")}
      />
    );
  }

  if (activeView === "list-users") {
    return (
      <UserListPage
        adminEmail={adminEmail}
        adminPassword={adminPassword}
        onLogout={() => {
          setAdminEmail(null);
          setAdminPassword(null);
          setStaffRole(null);
          localStorage.removeItem("admin_email");
          localStorage.removeItem("admin_password");
          localStorage.removeItem("admin_role");
          sessionStorage.removeItem("admin_email");
          sessionStorage.removeItem("admin_password");
          sessionStorage.removeItem("admin_role");
          setActiveView("dashboard");
        }}
        onBack={() => setActiveView("dashboard")}
        onNavigateAddUser={() => setActiveView("add-user")}
        onNavigateSisImport={() => setActiveView("sis-import")}
      />
    );
  }

  if (activeView === "sis-import") {
    return (
      <SISImportPage
        adminEmail={adminEmail}
        adminPassword={adminPassword}
        onLogout={() => {
          setAdminEmail(null);
          setAdminPassword(null);
          setStaffRole(null);
          localStorage.removeItem("admin_email");
          localStorage.removeItem("admin_password");
          localStorage.removeItem("admin_role");
          sessionStorage.removeItem("admin_email");
          sessionStorage.removeItem("admin_password");
          sessionStorage.removeItem("admin_role");
          setActiveView("dashboard");
        }}
        onBack={() => setActiveView("dashboard")}
        onNavigateAddUser={() => setActiveView("add-user")}
        onNavigateUserList={() => setActiveView("list-users")}
      />
    );
  }

  if (activeView === "finance") {
    return (
      <FinanceVerificationPage
        adminEmail={adminEmail}
        adminPassword={adminPassword}
        onLogout={() => {
          setAdminEmail(null);
          setAdminPassword(null);
          setStaffRole(null);
          localStorage.removeItem("admin_email");
          localStorage.removeItem("admin_password");
          localStorage.removeItem("admin_role");
          sessionStorage.removeItem("admin_email");
          sessionStorage.removeItem("admin_password");
          sessionStorage.removeItem("admin_role");
          setActiveView("dashboard");
        }}
      />
    );
  }

  if (activeView === "registrar") {
    return (
      <RegistrarClearancePage
        adminEmail={adminEmail}
        adminPassword={adminPassword}
        onLogout={() => {
          setAdminEmail(null);
          setAdminPassword(null);
          setStaffRole(null);
          localStorage.removeItem("admin_email");
          localStorage.removeItem("admin_password");
          localStorage.removeItem("admin_role");
          sessionStorage.removeItem("admin_email");
          sessionStorage.removeItem("admin_password");
          sessionStorage.removeItem("admin_role");
          setActiveView("dashboard");
        }}
      />
    );
  }

  if (activeView === "department") {
    return (
      <DepartmentHeadPage
        adminEmail={adminEmail}
        onLogout={() => {
          setAdminEmail(null);
          setAdminPassword(null);
          setStaffRole(null);
          localStorage.removeItem("admin_email");
          localStorage.removeItem("admin_password");
          localStorage.removeItem("admin_role");
          sessionStorage.removeItem("admin_email");
          sessionStorage.removeItem("admin_password");
          sessionStorage.removeItem("admin_role");
          setActiveView("dashboard");
        }}
      />
    );
  }

  return (
    <Dashboard
      adminEmail={adminEmail}
      adminPassword={adminPassword}
      onLogout={() => {
        setAdminEmail(null);
        setAdminPassword(null);
        setStaffRole(null);
        localStorage.removeItem("admin_email");
        localStorage.removeItem("admin_password");
        localStorage.removeItem("admin_role");
        sessionStorage.removeItem("admin_email");
        sessionStorage.removeItem("admin_password");
        sessionStorage.removeItem("admin_role");
      }}
      onNavigateAddUser={() => setActiveView("add-user")}
      onNavigateUserList={() => setActiveView("list-users")}
      onNavigateSisImport={() => setActiveView("sis-import")}
    />
  );
}

export default App;
