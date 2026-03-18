import { useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function Layout({ children }) {
  const location = useLocation();
  const isMapPage = location.pathname === "/";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-slate-50 text-slate-900 overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={[
          "hidden md:flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200",
          collapsed ? "w-[72px]" : "w-[240px]",
        ].join(" ")}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
      </aside>

      {/* Main content */}
      <main
        className={[
          "flex-1 min-w-0 min-h-0",
          isMapPage ? "h-full overflow-hidden" : "overflow-y-auto",
          "md:block hidden",  // Hidden on mobile, shown on desktop
        ].join(" ")}
      >
        {children}
      </main>

      {/* Mobile layout */}
      <div className="md:hidden flex-1 flex flex-col min-h-0">
        <main className={["flex-1 min-h-0", isMapPage ? "overflow-hidden" : "overflow-y-auto"].join(" ")}>
          {children}
        </main>
        <div className="shrink-0 border-t border-slate-200 bg-white">
          <Sidebar mobile />
        </div>
      </div>
    </div>
  );
}
