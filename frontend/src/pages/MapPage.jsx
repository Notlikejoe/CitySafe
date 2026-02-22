import { useMemo, useState, useEffect, useCallback } from "react";
import L from "leaflet";
import {
  MapContainer, TileLayer, Marker, Popup,
  Circle, Polyline, useMap,
} from "react-leaflet";
import {
  ShieldCheck, AlertTriangle, Users, ThermometerSun,
  Navigation, Plus, Siren, X, RefreshCw, Flame,
} from "lucide-react";
import { useNearbyReports } from "../hooks/useReports";
import { useAlertsFeed } from "../hooks/useAlerts";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useNavigate } from "react-router-dom";
import { renderToStaticMarkup } from "react-dom/server";

/* ─────────────────────────────────────────────────────────────────────────────
   DivIcon factory — colored pins that always render (no broken image URLs)
───────────────────────────────────────────────────────────────────────────── */
const TYPE_COLORS = {
  pothole: { bg: "#f97316", border: "#ea580c", emoji: "🕳️" },
  flooding: { bg: "#3b82f6", border: "#2563eb", emoji: "🌊" },
  construction: { bg: "#eab308", border: "#ca8a04", emoji: "🚧" },
  fire: { bg: "#ef4444", border: "#dc2626", emoji: "🔥" },
  crime: { bg: "#8b5cf6", border: "#7c3aed", emoji: "🚨" },
  other: { bg: "#64748b", border: "#475569", emoji: "📍" },
};

function makePin(type) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.other;
  const svg = `
    <div style="
      width:32px; height:38px; position:relative;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    ">
      <div style="
        width:28px; height:28px; border-radius:50% 50% 50% 0;
        transform:rotate(-45deg); background:${c.bg};
        border:3px solid ${c.border};
        position:absolute; top:0; left:2px;
      "></div>
      <div style="
        position:absolute; top:4px; left:6px;
        font-size:13px; line-height:1;
      ">${c.emoji}</div>
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [32, 38],
    iconAnchor: [16, 38],
    popupAnchor: [0, -40],
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   Static overlay data
───────────────────────────────────────────────────────────────────────────── */
const CENTER = [25.2048, 55.2708];

// Safer route corridor
const SAFE_ROUTE = [
  [25.2048, 55.2708],
  [25.2058, 55.2718],
  [25.2072, 55.2726],
  [25.2088, 55.2742],
  [25.2105, 55.2763],
];
const ROUTE_BOUNDS = [[25.2035, 55.2695], [25.2120, 55.2780]];

// Crowd density zones (Crowds lens)
const CROWD_ZONES = [
  { id: "c1", center: [25.1972, 55.2744], radius: 300, level: "High", color: "#ef4444", note: "Major event underway — expect heavy foot traffic" },
  { id: "c2", center: [25.2090, 55.2680], radius: 200, level: "Medium", color: "#f97316", note: "Moderate pedestrian activity near the market" },
  { id: "c3", center: [25.2140, 55.2800], radius: 150, level: "Low", color: "#22c55e", note: "Light traffic, good for walking" },
  { id: "c4", center: [25.2055, 55.2770], radius: 180, level: "Medium", color: "#f97316", note: "Afternoon rush near transit hub" },
  { id: "c5", center: [25.1995, 55.2690], radius: 120, level: "Low", color: "#22c55e", note: "Residential area, quiet" },
];

// Heat/activity zones (Heat lens)
const HEAT_ZONES = [
  { id: "h1", center: [25.2060, 55.2720], radius: 350, color: "#ef4444", opacity: 0.20 },
  { id: "h2", center: [25.1980, 55.2760], radius: 220, color: "#f97316", opacity: 0.17 },
  { id: "h3", center: [25.2120, 55.2660], radius: 180, color: "#facc15", opacity: 0.15 },
  { id: "h4", center: [25.2100, 55.2790], radius: 150, color: "#ef4444", opacity: 0.13 },
  { id: "h5", center: [25.2030, 55.2700], radius: 250, color: "#f97316", opacity: 0.11 },
];

// Accessibility routes + facilities (Accessibility lens)
const ACCESS_ROUTES = [
  [[25.2048, 55.2708], [25.2058, 55.2720], [25.2075, 55.2738], [25.2092, 55.2755]],
  [[25.2048, 55.2708], [25.2035, 55.2695], [25.2018, 55.2680], [25.2005, 55.2668]],
  [[25.2048, 55.2708], [25.2060, 55.2695], [25.2072, 55.2685], [25.2088, 55.2672]],
];
const ACCESS_ZONES = [
  { id: "az1", center: [25.2092, 55.2755], radius: 70, label: "Ramp + elevator" },
  { id: "az2", center: [25.2018, 55.2680], radius: 60, label: "Accessible plaza" },
  { id: "az3", center: [25.2088, 55.2672], radius: 55, label: "Tactile paving" },
  { id: "az4", center: [25.2048, 55.2708], radius: 80, label: "Accessible transit hub" },
];

const LENSES = [
  { id: "hazards", label: "Hazards", Icon: AlertTriangle, desc: "Active hazards and community reports" },
  { id: "crowds", label: "Crowds", Icon: Users, desc: "Real-time crowd density zones" },
  { id: "heat", label: "Heat", Icon: ThermometerSun, desc: "Activity and heat spot overlay" },
  { id: "access", label: "Accessibility", Icon: ShieldCheck, desc: "Accessible routes and facilities" },
];

const LENS_LEGEND = {
  hazards: [
    { color: "#ef4444", label: "Fire / Crime" },
    { color: "#f97316", label: "Pothole / Construction" },
    { color: "#3b82f6", label: "Flooding" },
    { color: "#8b5cf6", label: "Crime" },
  ],
  crowds: [
    { color: "#ef4444", label: "High density" },
    { color: "#f97316", label: "Medium density" },
    { color: "#22c55e", label: "Low density" },
  ],
  heat: [
    { color: "#ef4444", label: "Hot spot" },
    { color: "#f97316", label: "High activity" },
    { color: "#facc15", label: "Moderate" },
  ],
  access: [
    { color: "#0ea5e9", label: "Step-free route", dashed: true },
    { color: "#0ea5e9", label: "Accessible facility" },
  ],
};

/* ─────────────────────────────────────────────────────────────────────────────
   MapController — programmatic pan/zoom inside MapContainer
───────────────────────────────────────────────────────────────────────────── */
function MapController({ flyTo }) {
  const map = useMap();
  useEffect(() => {
    if (!flyTo) return;
    if (flyTo.bounds) {
      map.fitBounds(flyTo.bounds, { padding: [60, 60], duration: 0.8 });
    } else if (flyTo.center) {
      map.flyTo(flyTo.center, flyTo.zoom ?? 14, { duration: 0.8 });
    }
  }, [flyTo, map]);
  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Lens overlay components
───────────────────────────────────────────────────────────────────────────── */
function HazardsLayer({ reports, onMarkerClick }) {
  return (
    <>
      {reports.map((r) => (
        <Marker
          key={r.id}
          position={[r.location.lat, r.location.lon]}
          icon={makePin(r.type)}
          eventHandlers={{
            click: () => onMarkerClick("hazard", {
              title: r.description,
              status: r.status,
              type: r.type,
              time: new Date(r.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
            }),
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-bold capitalize">{r.type.replace(/_/g, " ")}</div>
              <div className="text-slate-500 text-xs mt-0.5">{r.description}</div>
              <div className="mt-1 text-xs font-semibold capitalize" style={{
                color: r.status === "verified" ? "#0d9488" : r.status === "resolved" ? "#6366f1" : "#f97316"
              }}>{r.status.replace(/_/g, " ")}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

function CrowdsLayer({ onZoneClick }) {
  return (
    <>
      {CROWD_ZONES.map((z) => (
        <Circle
          key={z.id}
          center={z.center}
          radius={z.radius}
          pathOptions={{
            color: z.color, weight: 2.5,
            fillColor: z.color, fillOpacity: 0.18,
            dashArray: z.level === "Low" ? "8 8" : undefined,
          }}
          eventHandlers={{
            click: () => onZoneClick("crowd", { title: `${z.level} crowd density`, level: z.level, note: z.note }),
          }}
        />
      ))}
    </>
  );
}

function HeatLayer() {
  return (
    <>
      {HEAT_ZONES.map((z) => (
        <Circle
          key={z.id}
          center={z.center}
          radius={z.radius}
          pathOptions={{ color: "transparent", weight: 0, fillColor: z.color, fillOpacity: z.opacity }}
        />
      ))}
    </>
  );
}

function AccessibilityLayer({ onRouteClick }) {
  return (
    <>
      {ACCESS_ROUTES.map((pts, i) => (
        <Polyline
          key={i}
          positions={pts}
          pathOptions={{ color: "#0ea5e9", weight: 6, opacity: 0.85, dashArray: "1 10", lineCap: "round" }}
          eventHandlers={{
            click: () => onRouteClick("route", {
              title: "Accessible route",
              eta: `${7 + i * 3} min`,
              notes: ["Step-free throughout", "Elevators at all junctions", "Wide pavements"],
            }),
          }}
        />
      ))}
      {ACCESS_ZONES.map((z) => (
        <Circle
          key={z.id}
          center={z.center}
          radius={z.radius}
          pathOptions={{ color: "#0ea5e9", weight: 2.5, fillColor: "#0ea5e9", fillOpacity: 0.15 }}
        >
          <Popup><div className="text-sm font-semibold text-sky-700">{z.label}</div></Popup>
        </Circle>
      ))}
    </>
  );
}

function SaferRouteLayer({ visible, onRouteClick }) {
  if (!visible) return null;
  return (
    <>
      {/* Route glow underlay */}
      <Polyline
        positions={SAFE_ROUTE}
        pathOptions={{ color: "#0d9488", weight: 18, opacity: 0.12, lineCap: "round" }}
      />
      {/* Main route line */}
      <Polyline
        positions={SAFE_ROUTE}
        pathOptions={{ color: "#0d9488", weight: 5, opacity: 0.95, lineCap: "round", lineJoin: "round" }}
        eventHandlers={{
          click: () => onRouteClick("route", {
            title: "Safest route",
            eta: "14 min",
            notes: ["Avoids high crowd zone", "Avoids reported hazard", "Well-lit path at night"],
          }),
        }}
      />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Legend helper
───────────────────────────────────────────────────────────────────────────── */
function LegRow({ color, label, dashed }) {
  return (
    <div className="flex items-center gap-2">
      <div style={{
        height: 10, width: 20, borderRadius: 99, flexShrink: 0,
        background: dashed ? "transparent" : color,
        border: dashed ? `2px dashed ${color}` : "none",
        opacity: 0.85,
      }} />
      <span className="text-xs text-slate-600">{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Bottom sheet
───────────────────────────────────────────────────────────────────────────── */
function BottomSheet({ open, onClose, children }) {
  return (
    <div className={`absolute inset-0 z-[1100] ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div className={`absolute left-0 right-0 bottom-0 mx-auto max-w-xl transition-transform duration-300 ${open ? "translate-y-0" : "translate-y-full"}`}>
        <div className="rounded-t-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="px-4 pt-3 pb-1 relative flex items-center justify-center">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
            <button onClick={onClose} className="absolute right-4 p-2 rounded-full hover:bg-slate-100 text-slate-400" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-5 pb-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sheet content
───────────────────────────────────────────────────────────────────────────── */
function SheetContent({ lens, sheet, setLens, onClose, navigate }) {
  if (sheet.type === "lens") {
    return (
      <div>
        <p className="text-sm font-semibold mb-3 text-slate-800">Safety Lens</p>
        <div className="grid gap-2">
          {LENSES.map(({ id, label, Icon, desc }) => (
            <button
              key={id}
              onClick={() => { setLens(id); onClose(); }}
              className={[
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all",
                lens === id ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-slate-300",
              ].join(" ")}
            >
              <Icon className={`h-5 w-5 ${lens === id ? "text-teal-600" : "text-slate-400"}`} />
              <div>
                <div className="font-semibold text-sm text-slate-800">{label}</div>
                <div className="text-xs text-slate-500">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (sheet.type === "hazard") {
    const colors = TYPE_COLORS[sheet.payload?.type] ?? { bg: "#64748b", border: "#475569", emoji: "📍" };
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">{colors.emoji}</span>
          <div className="text-sm font-semibold text-slate-800 capitalize">{(sheet.payload?.type ?? "hazard").replace(/_/g, " ")}</div>
        </div>
        <p className="text-base font-bold text-slate-900">{sheet.payload?.title}</p>
        <p className="text-xs text-slate-400 mt-1">{sheet.payload?.time}</p>
        <div className="mt-3"><Badge status={sheet.payload?.status} /></div>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1">Verify report</Button>
          <Button variant="secondary">Report update</Button>
        </div>
      </div>
    );
  }

  if (sheet.type === "crowd") {
    const levelColor = { High: "#dc2626", Medium: "#ea580c", Low: "#16a34a" }[sheet.payload?.level] ?? "#64748b";
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-5 w-5 text-teal-600" />
          <p className="text-sm font-semibold text-slate-800">Crowd Zone</p>
        </div>
        <p className="text-base font-bold text-slate-900">{sheet.payload?.title}</p>
        <p className="text-sm text-slate-500 mt-1">{sheet.payload?.note}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
          style={{ background: `${levelColor}18`, color: levelColor, border: `1px solid ${levelColor}44` }}>
          {sheet.payload?.level} density
        </div>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={() => { setLens("access"); onClose(); }}>
            See accessible route
          </Button>
          <Button variant="secondary" onClick={onClose}>Dismiss</Button>
        </div>
      </div>
    );
  }

  if (sheet.type === "route") {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-teal-600" />
          <p className="text-sm font-semibold text-slate-800">{sheet.payload?.title ?? "Safer Route"}</p>
        </div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-extrabold text-slate-900">{sheet.payload?.eta ?? "—"}</div>
            <div className="text-xs text-slate-400">estimated walk</div>
          </div>
          <div className="h-10 w-10 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
            <Navigation className="h-5 w-5 text-teal-600" />
          </div>
        </div>
        <div className="space-y-2 mb-5">
          {(sheet.payload?.notes ?? ["Uses clearer walkways", "Avoids flagged areas"]).map((n) => (
            <div key={n} className="flex gap-2.5 text-sm text-slate-600 items-start">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-teal-500 shrink-0" />
              <span>{n}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1">Start navigation</Button>
          <Button variant="secondary">Options</Button>
        </div>
      </div>
    );
  }

  if (sheet.type === "alerts") {
    return (
      <div>
        <p className="text-sm font-semibold mb-3 text-slate-800">⚠️ Active Alerts</p>
        <div className="space-y-3">
          {sheet.payload?.alerts?.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-semibold capitalize text-slate-800">
                  {a.type.replace(/_/g, " ")}
                </span>
                <Badge status={a.priority} />
              </div>
              <p className="text-xs text-slate-500">{a.message}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main MapPage
───────────────────────────────────────────────────────────────────────────── */
export default function MapPage() {
  const [lens, setLens] = useState("hazards");
  const [showRoute, setShowRoute] = useState(false);
  const [sheet, setSheet] = useState({ open: false, type: null, payload: null });
  const [flyTo, setFlyTo] = useState(null);
  const navigate = useNavigate();

  const { data: reports = [], isLoading: reportsLoading } =
    useNearbyReports(25.2048, 55.2708, 10);
  const { data: alerts = [], isLoading: alertsLoading } =
    useAlertsFeed();

  const priorityAlerts = alerts.filter((a) => a.active);

  const openSheet = useCallback((type, payload) => setSheet({ open: true, type, payload }), []);
  const closeSheet = useCallback(() => setSheet({ open: false, type: null, payload: null }), []);

  const handleLensChange = (id) => {
    setLens(id);
    setShowRoute(false);
    setFlyTo({ center: CENTER, zoom: 13 });
    closeSheet();
  };

  const handleSaferRoute = () => {
    const next = !showRoute;
    setShowRoute(next);
    if (next) {
      setFlyTo({ bounds: ROUTE_BOUNDS });
      openSheet("route", {
        title: "Safest route",
        eta: "14 min",
        notes: ["Avoids high crowd zone", "Avoids reported hazard", "Well-lit path at night"],
      });
    } else {
      setFlyTo({ center: CENTER, zoom: 13 });
      closeSheet();
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* ── Top bar ── */}
      <header className="h-14 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur z-10">
        <div className="h-full px-3 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>

          {/* Brand (desktop only) */}
          <div className="hidden md:block font-bold text-slate-900 tracking-tight shrink-0 mr-2">
            CitySafe
          </div>

          {/* Active alert pill */}
          {priorityAlerts.length > 0 && (
            <button
              onClick={() => openSheet("alerts", { alerts: priorityAlerts })}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {priorityAlerts.length} alert{priorityAlerts.length !== 1 ? "s" : ""}
            </button>
          )}

          {/* Lens switcher — scrollable on mobile, all visible on desktop */}
          <div className="flex items-center rounded-full border border-slate-200 p-1 bg-white shadow-sm shrink-0">
            {LENSES.map(({ id, label, Icon }) => {
              const active = lens === id;
              return (
                <button
                  key={id}
                  onClick={() => handleLensChange(id)}
                  title={LENSES.find((l) => l.id === id)?.desc}
                  aria-pressed={active}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap",
                    active ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── Map ── */}
      <div className="relative flex-1 min-h-0">
        <MapContainer center={CENTER} zoom={14} className="h-full w-full" zoomControl>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          />

          <MapController flyTo={flyTo} />

          {/* Lens overlays */}
          {lens === "hazards" && <HazardsLayer reports={reports} onMarkerClick={openSheet} />}
          {lens === "crowds" && <CrowdsLayer onZoneClick={openSheet} />}
          {lens === "heat" && <HeatLayer />}
          {lens === "access" && <AccessibilityLayer onRouteClick={openSheet} />}

          {/* Safer route — independent of lens */}
          <SaferRouteLayer visible={showRoute} onRouteClick={openSheet} />
        </MapContainer>

        {/* Floating buttons */}
        <div className="absolute right-4 bottom-16 z-[1000] flex flex-col items-end gap-2">
          <button
            onClick={() => navigate("/report")}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 border border-slate-200 bg-white shadow-md text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:shadow-lg transition-all active:scale-[0.97]"
          >
            <Plus className="h-4 w-4 text-teal-600" /> Report
          </button>
          <button
            onClick={handleSaferRoute}
            aria-pressed={showRoute}
            className={[
              "inline-flex items-center gap-2 rounded-full px-4 py-2.5 border shadow-md text-sm font-semibold transition-all active:scale-[0.97]",
              showRoute
                ? "bg-teal-600 border-teal-500 text-white shadow-teal-600/25"
                : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50 hover:shadow-lg",
            ].join(" ")}
          >
            <ShieldCheck className={`h-4 w-4 ${showRoute ? "text-white" : "text-teal-600"}`} />
            Safer route
          </button>
          <button
            onClick={() => navigate("/sos")}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-5 py-3 shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-[0.97] transition-all font-bold text-sm"
          >
            <Siren className="h-5 w-5" /> SOS
          </button>
        </div>

        {/* Dynamic legend */}
        <div className="absolute left-3 bottom-4 z-[1000] hidden md:block">
          <Card className="p-3 min-w-[150px]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              {LENSES.find((l) => l.id === lens)?.label}
            </div>
            <div className="flex flex-col gap-1.5">
              {(LENS_LEGEND[lens] ?? []).map(({ color, label, dashed }) => (
                <LegRow key={label} color={color} label={label} dashed={dashed} />
              ))}
              {showRoute && <LegRow color="#0d9488" label="Safer route" />}
            </div>
          </Card>
        </div>

        {/* Loading */}
        {(reportsLoading || alertsLoading) && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow text-xs text-slate-600">
            <RefreshCw className="h-3 w-3 animate-spin text-teal-500" /> Updating…
          </div>
        )}

        {/* Bottom sheet */}
        {sheet.open && (
          <BottomSheet open={sheet.open} onClose={closeSheet}>
            <SheetContent lens={lens} sheet={sheet} setLens={handleLensChange} onClose={closeSheet} navigate={navigate} />
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
