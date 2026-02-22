import { NavLink } from "react-router-dom";
import {
  Map, FileWarning, Siren, LayoutDashboard,
  Settings, PanelLeftClose, PanelLeftOpen, Search,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Map", Icon: Map, end: true, desc: "Safety map" },
  { to: "/report", label: "Report", Icon: FileWarning, desc: "Report an issue" },
  { to: "/sos", label: "Get Help", Icon: Siren, desc: "Send SOS" },
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard, desc: "My history & points" },
  { to: "/settings", label: "Settings", Icon: Settings, desc: "Preferences" },
];

export default function Sidebar({ mobile = false, collapsed = false, onToggleCollapsed }) {
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
        {navItems.map(({ to, label, Icon, end, desc }) => (
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
      {!collapsed ? (
        <div className="mt-auto p-3 border-t border-slate-100">
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-3">
            <div className="text-xs font-bold text-teal-700">🌟 You're making a difference</div>
            <div className="text-xs text-teal-600 mt-1">
              Every report helps keep your community safer. Thank you!
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-auto p-2 border-t border-slate-100 text-[11px] text-slate-300 text-center">v1</div>
      )}
    </div>
  );
}
