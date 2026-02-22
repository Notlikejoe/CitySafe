import { useState } from "react";
import { Bell, Moon, Shield, ChevronRight, ExternalLink } from "lucide-react";
import { Card } from "../components/ui/Card";

const SETTINGS = [
  {
    group: "Notifications",
    icon: Bell,
    items: [
      { label: "Nearby alerts", desc: "Get notified of alerts within 5km", defaultOn: true },
      { label: "Report status updates", desc: "Status changes on your submitted reports", defaultOn: true },
      { label: "Community updates", desc: "News and tips from CitySafe", defaultOn: false },
    ],
  },
  {
    group: "Privacy & Safety",
    icon: Shield,
    items: [
      { label: "Share location", desc: "Required for map features and SOS", defaultOn: true },
      { label: "Anonymous reports", desc: "Don't show your profile on submitted reports", defaultOn: false },
    ],
  },
];

function Toggle({ defaultOn }) {
  const [enabled, setEnabled] = useState(defaultOn);
  return (
    <button
      onClick={() => setEnabled((v) => !v)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200",
        enabled ? "bg-teal-500" : "bg-slate-200",
      ].join(" ")}
      role="switch"
      aria-checked={enabled}
    >
      <span
        className={[
          "inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200",
          enabled ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-xl mx-auto py-6 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your preferences and account.</p>
      </div>

      {/* Profile card */}
      <Card className="p-4 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl bg-teal-100 flex items-center justify-center text-2xl font-bold text-teal-700 shrink-0">
          Y
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800">Demo User</div>
          <div className="text-sm text-slate-400">user_demo · Member since Feb 2026</div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300" />
      </Card>

      {/* Setting groups */}
      {SETTINGS.map(({ group, icon: GroupIcon, items }) => (
        <div key={group}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2 px-1">
            <GroupIcon className="h-3.5 w-3.5" />
            {group}
          </div>
          <Card className="divide-y divide-slate-100">
            {items.map(({ label, desc, defaultOn }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-800">{label}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{desc}</div>
                </div>
                <Toggle defaultOn={defaultOn} />
              </div>
            ))}
          </Card>
        </div>
      ))}

      {/* App info */}
      <Card className="p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-400">About</div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Version</span>
          <span className="font-mono text-slate-800 text-xs">1.0.0-beta</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Environment</span>
          <span className="font-mono text-slate-800 text-xs">
            {import.meta.env.VITE_USE_MOCK === "true" ? "Mock" : "Production"}
          </span>
        </div>
        <a
          href="https://github.com/Notlikejoe/CitySafe"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-teal-600 font-medium hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" /> View on GitHub
        </a>
      </Card>
    </div>
  );
}