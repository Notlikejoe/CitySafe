import { useLocation } from "react-router-dom";
import { useState } from "react";
import Sidebar from "../components/Sidebar";

/*
  Layout = App shell
  - Desktop: collapsible sidebar + content
  - Mobile: bottom nav
*/

export default function Layout({ children }) {
  const location = useLocation();
  const isMapPage = location.pathname === "/";

  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="h-screen w-full bg-white text-neutral-900">
      {/* ---------- DESKTOP ---------- */}
      <div className="hidden md:flex h-full w-full">
        <div
          className={[
            "shrink-0 border-r border-neutral-200 bg-white transition-[width] duration-200",
            collapsed ? "w-[76px]" : "w-[260px]",
          ].join(" ")}
        >
          <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((v) => !v)} />
        </div>

        <main className={["flex-1 min-w-0", isMapPage ? "h-full" : "p-6"].join(" ")}>
          {children}
        </main>
      </div>

      {/* ---------- MOBILE ---------- */}
<div className="md:hidden h-full w-full flex flex-col">
  <main className="flex-1 min-h-0">{children}</main>

  <div className="shrink-0 border-t border-neutral-200 bg-white">
    <Sidebar mobile />
  </div>
</div>


    </div>
  );
}
