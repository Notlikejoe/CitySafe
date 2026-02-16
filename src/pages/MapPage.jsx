import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from "react-leaflet";
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  ThermometerSun,
  Navigation,
  Plus,
  Siren,
  X,
} from "lucide-react";

const LENSES = [
  { id: "hazards", label: "Hazards", Icon: AlertTriangle },
  { id: "crowds", label: "Crowds", Icon: Users },
  { id: "heat", label: "Heat", Icon: ThermometerSun },
  { id: "access", label: "Accessibility", Icon: ShieldCheck },
];

export default function MapPage() {
  const [lens, setLens] = useState("hazards");
  const [sheet, setSheet] = useState({ open: false, type: null, payload: null });

  // Demo center
  const center = [25.2048, 55.2708];

  // Mock route polyline (replace with backend later)
  const route = useMemo(
    () => [
      [25.2048, 55.2708],
      [25.209, 55.2735],
      [25.212, 55.279],
    ],
    []
  );

  // Demo points (replace with API later)
  const hazardPoint = [25.2105, 55.2763];
  const crowdCenter = [25.1972, 55.2744];

  function openSheet(type, payload) {
    setSheet({ open: true, type, payload });
  }

  function closeSheet() {
    setSheet({ open: false, type: null, payload: null });
  }

  return (
    <div className="h-full w-full flex flex-col bg-white text-neutral-900">
      {/* Top bar */}
      <header className="h-14 shrink-0 border-b border-neutral-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-semibold tracking-tight">CitySafe</div>
            <div className="hidden md:block text-xs text-neutral-500">
              Safety-first navigation
            </div>
          </div>

          {/* Safety Lens */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center rounded-full border border-neutral-200 p-1 bg-white shadow-sm">
              {LENSES.map(({ id, label, Icon }) => {
                const active = lens === id;
                return (
                  <button
                    key={id}
                    onClick={() => setLens(id)}
                    className={[
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition",
                      active
                        ? "bg-neutral-900 text-white"
                        : "text-neutral-700 hover:bg-neutral-100",
                    ].join(" ")}
                    aria-pressed={active}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Compact lens button on mobile */}
            <button
              onClick={() => openSheet("lens", { lens })}
              className="sm:hidden inline-flex items-center gap-2 px-3 py-2 rounded-full border border-neutral-200 bg-white shadow-sm"
            >
              <Navigation className="h-4 w-4" />
              <span className="text-sm">Lens</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content: map */}
      <div className="relative flex-1 min-h-0">
        <MapContainer center={center} zoom={13} className="h-full w-full">
          {/* Tiles: often shows more English, not guaranteed everywhere */}
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          />

          {/* Hazard marker */}
          <Marker
            position={hazardPoint}
            eventHandlers={{
              click: () =>
                openSheet("hazard", {
                  title: "Construction blocking walkway",
                  status: "Unverified",
                  time: "Reported 12 min ago",
                }),
            }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">Hazard</div>
                <div className="text-neutral-600">Construction blocking walkway</div>
              </div>
            </Popup>
          </Marker>

          {/* Crowd zone — use dashed outline (shape style, not just color) */}
          <Circle
            center={crowdCenter}
            radius={250}
            pathOptions={{
              color: "#111",
              weight: 2,
              dashArray: "6 6",
              fillOpacity: 0.08,
            }}
            eventHandlers={{
              click: () =>
                openSheet("crowd", {
                  title: "High crowd density",
                  level: "High",
                  note: "Event nearby — expect delays",
                }),
            }}
          />

          {/* “Safer route” — thick solid line */}
          <Polyline
            positions={route}
            pathOptions={{ color: "#111", weight: 5, opacity: 0.9 }}
            eventHandlers={{
              click: () =>
                openSheet("route", {
                  title: "Safest route",
                  eta: "14 min",
                  notes: ["Avoids high crowd zone", "Avoids reported hazard"],
                }),
            }}
          />
        </MapContainer>

        {/* Floating controls (Apple-ish, minimal) */}
        <div className="absolute right-4 bottom-14 z-[1000] flex flex-col items-end gap-2">
          {/* Mini action stack */}
          <div className="flex flex-col gap-2">
            <ActionButton
              label="Report"
              onClick={() => openSheet("report", null)}
              Icon={Plus}
              subtle
            />
            <ActionButton
              label="Safer route"
              onClick={() => openSheet("route", { title: "Safest route", eta: "14 min", notes: [] })}
              Icon={ShieldCheck}
              subtle
            />
          </div>

          {/* SOS primary */}
          <button
            onClick={() => openSheet("sos", null)}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 text-white px-4 py-3 shadow-lg shadow-neutral-900/20 active:scale-[0.99] transition"
          >
            <Siren className="h-5 w-5" />
            <span className="font-semibold">SOS</span>
          </button>
        </div>

        {/* Legend (colorblind-friendly: icon + label + line style) */}
        <div className="absolute left-4 bottom-4 z-[1000] hidden md:block">
          <div className="rounded-2xl border border-neutral-200 bg-white/90 backdrop-blur p-3 shadow-sm">
            <div className="text-xs font-semibold text-neutral-700 mb-2">Legend</div>
            <div className="grid gap-2 text-xs text-neutral-700">
              <LegendRow
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Hazard report"
                detail="Triangle marker + label"
              />
              <LegendRow
                icon={<Users className="h-4 w-4" />}
                label="Crowd zone"
                detail="Dashed boundary"
                sample={<DashedSample />}
              />
              <LegendRow
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Safer route"
                detail="Thick solid line"
                sample={<SolidSample />}
              />
            </div>
          </div>
        </div>

        {/* Bottom Sheet */}
{sheet.open && (
  <BottomSheet open={sheet.open} onClose={closeSheet}>
    <SheetContent lens={lens} sheet={sheet} setLens={setLens} onClose={closeSheet} />
  </BottomSheet>
)}

      </div>
    </div>
  );
}

/* ---------- UI bits ---------- */

function ActionButton({ label, onClick, Icon, subtle }) {
  return (
    <button
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-2 border shadow-sm active:scale-[0.99] transition",
        subtle
          ? "bg-white border-neutral-200 text-neutral-900"
          : "bg-neutral-900 border-neutral-900 text-white",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function LegendRow({ icon, label, detail, sample }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span className="text-neutral-800">{icon}</span>
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-[11px] text-neutral-500">{detail}</div>
        </div>
      </div>
      {sample}
    </div>
  );
}

function DashedSample() {
  return (
    <div className="w-10 h-2 relative">
      <div className="absolute inset-x-0 top-1 border-t-2 border-neutral-900 border-dashed" />
    </div>
  );
}

function SolidSample() {
  return (
    <div className="w-10 h-2 relative">
      <div className="absolute inset-x-0 top-1 border-t-[4px] border-neutral-900" />
    </div>
  );
}

/* ---------- Bottom sheet (Apple-ish) ---------- */

function BottomSheet({ open, onClose, children }) {
  return (
    <div
      className={[
        "absolute inset-0 z-[1100] pointer-events-none",
        open ? "pointer-events-auto" : "",
      ].join(" ")}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={[
          "absolute inset-0 bg-black/25 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      {/* Sheet */}
      <div
        className={[
          "absolute left-0 right-0 bottom-0 mx-auto max-w-xl",
          "transition-transform duration-200",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="rounded-t-3xl border border-neutral-200 bg-white shadow-2xl">
          <div className="px-4 pt-3 pb-2 flex items-center justify-between">
            <div className="w-10 h-1.5 rounded-full bg-neutral-200 mx-auto" />
            <button
              onClick={onClose}
              className="absolute right-4 top-3 p-2 rounded-full hover:bg-neutral-100"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 pb-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SheetContent({ lens, sheet, setLens, onClose }) {
  // Lens picker (mobile)
  if (sheet.type === "lens") {
    return (
      <div>
        <div className="text-sm font-semibold mb-2">Safety Lens</div>
        <div className="grid gap-2">
          {LENSES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => {
                setLens(id);
                onClose();
              }}
              className={[
                "flex items-center gap-3 rounded-2xl border px-3 py-3 text-left",
                lens === id ? "border-neutral-900" : "border-neutral-200",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" />
              <div>
                <div className="font-medium">{label}</div>
                <div className="text-xs text-neutral-500">
                  Emphasize {label.toLowerCase()} on the map
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (sheet.type === "hazard") {
    return (
      <div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <div className="text-sm font-semibold">Hazard Details</div>
        </div>
        <div className="mt-3">
          <div className="text-base font-semibold">{sheet.payload?.title}</div>
          <div className="text-sm text-neutral-600 mt-1">{sheet.payload?.time}</div>
          <div className="mt-3 inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium">
            Status: {sheet.payload?.status}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-2xl bg-neutral-900 text-white px-4 py-3 font-semibold">
            Verify
          </button>
          <button className="rounded-2xl border border-neutral-200 px-4 py-3 font-semibold">
            Report update
          </button>
        </div>
      </div>
    );
  }

  if (sheet.type === "crowd") {
    return (
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <div className="text-sm font-semibold">Crowd Details</div>
        </div>
        <div className="mt-3">
          <div className="text-base font-semibold">{sheet.payload?.title}</div>
          <div className="text-sm text-neutral-600 mt-1">{sheet.payload?.note}</div>
          <div className="mt-3 inline-flex items-center rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium">
            Level: {sheet.payload?.level}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-2xl bg-neutral-900 text-white px-4 py-3 font-semibold">
            Suggest alternative
          </button>
          <button className="rounded-2xl border border-neutral-200 px-4 py-3 font-semibold">
            Ignore
          </button>
        </div>
      </div>
    );
  }

  if (sheet.type === "route") {
    const title = sheet.payload?.title ?? "Safest route";
    const eta = sheet.payload?.eta ?? "—";
    const notes = sheet.payload?.notes ?? [];
    return (
      <div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          <div className="text-sm font-semibold">Route</div>
        </div>

        <div className="mt-3">
          <div className="text-base font-semibold">{title}</div>
          <div className="text-sm text-neutral-600 mt-1">ETA: {eta}</div>
        </div>

        <div className="mt-3 grid gap-2">
          {(notes.length ? notes : ["Uses clearer walkways", "Avoids flagged areas"]).map((n) => (
            <div key={n} className="text-sm text-neutral-700 flex gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-neutral-900" />
              <span>{n}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-2xl bg-neutral-900 text-white px-4 py-3 font-semibold">
            Start navigation
          </button>
          <button className="rounded-2xl border border-neutral-200 px-4 py-3 font-semibold">
            Options
          </button>
        </div>
      </div>
    );
  }

  if (sheet.type === "report") {
    return (
      <div>
        <div className="text-sm font-semibold">Report a hazard</div>
        <div className="text-sm text-neutral-600 mt-1">
          Quick report — details can be edited later.
        </div>
        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-2xl bg-neutral-900 text-white px-4 py-3 font-semibold">
            Open report form
          </button>
          <button className="rounded-2xl border border-neutral-200 px-4 py-3 font-semibold">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (sheet.type === "sos") {
    return (
      <div>
        <div className="flex items-center gap-2">
          <Siren className="h-5 w-5" />
          <div className="text-sm font-semibold">Call for help</div>
        </div>
        <div className="text-sm text-neutral-600 mt-2">
          Send a nearby assistance request to CitySafe community helpers.
        </div>
        <div className="mt-4 flex gap-2">
          <button className="flex-1 rounded-2xl bg-neutral-900 text-white px-4 py-3 font-semibold">
            Send request
          </button>
          <button className="rounded-2xl border border-neutral-200 px-4 py-3 font-semibold">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}
