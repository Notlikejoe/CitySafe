import { NavLink, useNavigate } from "react-router-dom";
import {
  Map, FileWarning, Siren, LayoutDashboard,
  Settings, PanelLeftClose, PanelLeftOpen, Search, LogOut,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";

const navItems = [
  { to: "/", label: "Map", Icon: Map, end: true, desc: "Safety map" },
  { to: "/report", label: "Report", Icon: FileWarning, desc: "Report an issue" },
  { to: "/sos", label: "Get Help", Icon: Siren, desc: "Send SOS" },
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, desc: "My history & points" },
  { to: "/settings", label: "Settings", Icon: Settings, desc: "Preferences" },
];

export default function Sidebar({ mobile = false, collapsed = false, onToggleCollapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    toast.success("You have been signed out.");
    navigate("/auth");
  };

  if (mobile) {
    return (
      <nav className="px-2 py-2 pb-safe">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to} to={to} end={end}
              className={({ isActive }) => [
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition-all",
                isActive
                  ? "bg-teal-600 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className={["border-b border-slate-100", collapsed ? "p-3" : "px-4 pt-5 pb-3"].join(" ")}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {!collapsed ? (
              <>
                <div className="text-base font-bold tracking-tight text-slate-900">
                  🛡️ CitySafe
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Community safety, together</div>
              </>
            ) : (
              <div className="text-sm font-bold text-teal-600">CS</div>
            )}
          </div>
          <button
            onClick={onToggleCollapsed}
            className="p-2 rounded-xl hover:bg-slate-100 transition text-slate-400"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed
              ? <PanelLeftOpen className="h-4 w-4" />
              : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {!collapsed && (
          <div className="mt-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400">
              <Search className="h-3.5 w-3.5" />
              <span>Search area…</span>
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={collapsed ? "p-2 flex flex-col gap-1" : "p-3 flex flex-col gap-1"}>
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to} to={to} end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) => [
              "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all",
              isActive
                ? "bg-teal-600 text-white shadow-sm shadow-teal-600/20"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-800",
              collapsed ? "justify-center px-2.5" : "",
            ].join(" ")}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto border-t border-slate-100">
        {/* User info + logout */}
        {!collapsed ? (
          <div className="p-3 space-y-2">
            {/* User badge */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-8 w-8 rounded-xl bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-700 shrink-0">
                {user?.userId?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700 truncate">{user?.userId ?? "User"}</div>
                <div className="text-[10px] text-slate-400 capitalize">{user?.role ?? "member"}</div>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-2xl transition-all"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign Out</span>
            </button>

            {/* CTA */}
            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-3">
              <div className="text-xs font-bold text-teal-700">🌟 You're making a difference</div>
              <div className="text-xs text-teal-600 mt-1">
                Every report helps keep your community safer. Thank you!
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="w-full flex items-center justify-center p-2.5 text-red-500 hover:bg-red-50 rounded-2xl transition-all"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <div className="text-[11px] text-slate-300 text-center">v2</div>
          </div>
        )}
      </div>
    </div>
  );
}
