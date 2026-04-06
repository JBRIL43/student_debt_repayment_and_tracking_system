import { useState } from "react";
import type { IconType } from "react-icons";
import {
  FiAward,
  FiBarChart2,
  FiBookOpen,
  FiCreditCard,
  FiDownload,
  FiFolder,
  FiHome,
  FiLogOut,
  FiSettings,
  FiUserPlus,
  FiUsers,
} from "react-icons/fi";

type SidebarItem = {
  label: string;
  active?: boolean;
  onClick?: () => void;
};

type AdminSidebarProps = {
  items: SidebarItem[];
  onLogout: () => void;
};

const SIDEBAR_COLLAPSE_STORAGE_KEY = "admin_dashboard_sidebar_collapsed";

const getNavIcon = (label: string): IconType => {
  const normalized = label.toLowerCase();

  if (normalized.includes("dashboard")) return FiHome;
  if (normalized.includes("add user")) return FiUserPlus;
  if (normalized.includes("manage users") || normalized.includes("user list")) {
    return FiUsers;
  }
  if (normalized.includes("sis import")) return FiDownload;
  if (normalized.includes("report")) return FiBarChart2;
  if (normalized.includes("finance")) return FiCreditCard;
  if (normalized.includes("registrar") || normalized.includes("clearance")) {
    return FiAward;
  }
  if (normalized.includes("department")) return FiBookOpen;
  if (normalized.includes("setting")) return FiSettings;

  return FiFolder;
};

export default function AdminSidebar({ items, onLogout }: AdminSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "1";
  });

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, next ? "1" : "0");
  };

  const brandContent = (
    <>
      <div className="brand-mark">HU</div>
      <div>
        <p className="brand-title">Admin Panel</p>
        <p className="brand-subtitle">Hawassa University</p>
      </div>
    </>
  );

  return (
    <aside className={`sidebar${isCollapsed ? " collapsed" : ""}`}>
      <div className="sidebar-top">
        {isCollapsed ? (
          <button
            type="button"
            className="sidebar-brand sidebar-brand-trigger"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            {brandContent}
          </button>
        ) : (
          <div className="sidebar-brand">{brandContent}</div>
        )}

        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleCollapsed}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? "→" : "←"}
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map((item) => {
          const Icon = getNavIcon(item.label);

          return (
            <button
              key={item.label}
              type="button"
              className={`nav-item${item.active ? " active" : ""}`}
              onClick={item.onClick}
              aria-current={item.active ? "page" : undefined}
              title={item.label}
            >
              <span className="nav-item-icon" aria-hidden="true">
                <Icon />
              </span>
              <span className="nav-item-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button type="button" className="sidebar-logout" onClick={onLogout}>
        <span className="sidebar-logout-icon" aria-hidden="true">
          <FiLogOut />
        </span>
        <span className="sidebar-logout-label">Logout</span>
      </button>
    </aside>
  );
}
