import { NavLink } from "react-router-dom";
import {
  Map,
  FileWarning,
  Siren,
  User,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";

const navItems = [
  { to: "/", label: "Map", Icon: Map, end: true },
  { to: "/report", label: "Report", Icon: FileWarning },
  { to: "/sos", label: "Help", Icon: Siren },
  { to: "/dashboard", label: "Dashboard", Icon: User },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export default function Sidebar({ mobile = false, collapsed = false, onToggleCollapsed }) {
  if (mobile) {
    return (
      <nav className="px-2 py-2">
        <div className="grid grid-cols-5 gap-1">
          {navItems.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                [
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-medium transition",
                  isActive ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100",
                ].join(" ")
              }
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
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={["border-b border-neutral-200", collapsed ? "p-3" : "px-4 pt-4 pb-3"].join(" ")}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {!collapsed ? (
              <>
                <div className="text-base font-semibold tracking-tight">CitySafe</div>
                <div className="text-xs text-neutral-500 mt-0.5">Safety-first navigation</div>
              </>
            ) : (
              <div className="text-sm font-semibold tracking-tight">CS</div>
            )}
          </div>

          <button
            onClick={onToggleCollapsed}
            className="p-2 rounded-xl hover:bg-neutral-100 transition"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand" : "Collapse"}
            type="button"
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>

        {/* Search placeholder */}
        {!collapsed ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
              <Search className="h-4 w-4" />
              <span>Search area…</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Nav */}
      <nav className={collapsed ? "p-2 flex flex-col gap-1" : "p-2 flex flex-col gap-1"}>
        {navItems.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              [
                "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition",
                isActive ? "bg-neutral-900 text-white" : "text-neutral-800 hover:bg-neutral-100",
                collapsed ? "justify-center px-2" : "",
              ].join(" ")
            }
            title={collapsed ? label : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed ? <span className="truncate">{label}</span> : null}
          </NavLink>
        ))}
      </nav>

      {/* Footer tip */}
      {!collapsed ? (
        <div className="mt-auto p-3 border-t border-neutral-200">
          <div className="rounded-2xl border border-neutral-200 bg-white p-3">
            <div className="text-xs font-semibold text-neutral-800">Tip</div>
            <div className="text-xs text-neutral-500 mt-1">
              Use the Safety Lens to focus hazards, crowds, heat, or accessibility.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-auto p-2 border-t border-neutral-200 text-[11px] text-neutral-500 text-center">
          v0.1
        </div>
      )}
    </div>
  );
}
