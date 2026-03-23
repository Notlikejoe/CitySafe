import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import MarkerClusterGroup from "react-leaflet-markercluster";
import {
  MapContainer, TileLayer, Marker, Popup,
  Circle, useMap, useMapEvents,
} from "react-leaflet";
import {
  AlertTriangle, Users, ThermometerSun, ShieldCheck,
  Plus, Siren, X, RefreshCw, ExternalLink, MapPin,
} from "lucide-react";
import { useVerifyReport } from "../hooks/useReports";
import { useAlertsFeed } from "../hooks/useAlerts";
import { useCommunityFeed } from "../hooks/useCommunity";
import { useGeolocation } from "../hooks/useGeolocation";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import apiClient, { resolveApiUrl } from "../lib/apiClient";

const INCIDENT_COLORS = {
  pothole: { bg: "#94a3b8", border: "#64748b", emoji: "🕳️" },
  flooding: { bg: "#3b82f6", border: "#2563eb", emoji: "🌊" },
  construction: { bg: "#eab308", border: "#ca8a04", emoji: "🚧" },
  fire: { bg: "#ef4444", border: "#dc2626", emoji: "🔥" },
  crime: { bg: "#111827", border: "#000000", emoji: "🚨" },
  other: { bg: "#64748b", border: "#475569", emoji: "📍" },
};

const ACCESSIBILITY_COLORS = {
  environmental: { bg: "#16a34a", border: "#15803d", emoji: "🌿" },
  accessibility: { bg: "#0ea5e9", border: "#0284c7", emoji: "♿" },
  safety: { bg: "#f59e0b", border: "#d97706", emoji: "🛡️" },
  medical: { bg: "#dc2626", border: "#b91c1c", emoji: "🏥" },
};

const SOS_COLORS = { bg: "#dc2626", border: "#991b1b", emoji: "🆘" };
const USER_COLORS = { bg: "#0f766e", border: "#115e59", emoji: "📍" };
const WORLD_VIEW = { center: [0, 0], zoom: 2 };
const USER_FOCUS_ZOOM = 13;
const ACCESSIBILITY_RADIUS_KM = 8;
const REQUEST_DEBOUNCE_MS = 400;
const ACCESSIBILITY_FILTERS = [
  { id: "environmental", label: "Environmental" },
  { id: "accessibility", label: "Accessibility" },
  { id: "safety", label: "Safety" },
  { id: "medical", label: "Medical" },
];

const LENSES = [
  { id: "hazards", label: "Hazards", Icon: AlertTriangle, desc: "Active hazards and SOS requests" },
  { id: "crowds", label: "Crowds", Icon: Users, desc: "Incident-density zones from live backend data" },
  { id: "heat", label: "Heat", Icon: ThermometerSun, desc: "Heat-style density overlay from incidents" },
  { id: "accessibility", label: "Accessibility", Icon: ShieldCheck, desc: "Nearby relief, mobility, safety, and medical resources" },
];

const LENS_LEGEND = {
  hazards: [
    { color: "#ef4444", label: "Fire" },
    { color: "#111827", label: "Crime" },
    { color: "#eab308", label: "Construction" },
    { color: "#3b82f6", label: "Flooding" },
    { color: "#94a3b8", label: "Pothole" },
    { color: "#dc2626", label: "SOS" },
  ],
  crowds: [
    { color: "#ef4444", label: "High incident density" },
    { color: "#f97316", label: "Medium incident density" },
    { color: "#facc15", label: "Low incident density" },
  ],
  heat: [
    { color: "#ef4444", label: "High intensity" },
    { color: "#f97316", label: "Medium intensity" },
    { color: "#facc15", label: "Low intensity" },
  ],
  accessibility: [
    { color: "#16a34a", label: "Environmental relief" },
    { color: "#0ea5e9", label: "Mobility & accessibility" },
    { color: "#f59e0b", label: "Safety & protection" },
    { color: "#dc2626", label: "Medical emergency" },
  ],
};

const isRenderableLocation = (location) =>
  Number.isFinite(Number(location?.lat)) &&
  Number.isFinite(Number(location?.lon)) &&
  Math.abs(Number(location.lat)) <= 90 &&
  Math.abs(Number(location.lon)) <= 180;

const isRenderableLatLng = (lat, lng) =>
  Number.isFinite(Number(lat)) &&
  Number.isFinite(Number(lng)) &&
  Math.abs(Number(lat)) <= 90 &&
  Math.abs(Number(lng)) <= 180;

const formatIncidentTime = (createdAt) =>
  new Date(createdAt).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function makePin(colors, pulse = false) {
  const svg = `
    <div style="position:relative;width:32px;height:38px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
      ${pulse ? `
        <div style="
          position:absolute;top:2px;left:2px;width:28px;height:28px;border-radius:999px;
          background:rgba(220,38,38,0.18);animation:sos-pulse 1.8s ease-in-out infinite;
        "></div>
      ` : ""}
      <div style="
        width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
        background:${colors.bg};border:3px solid ${colors.border};position:absolute;top:0;left:2px;
      "></div>
      <div style="position:absolute;top:4px;left:6px;font-size:13px;line-height:1;">${colors.emoji}</div>
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

const makeIncidentPin = (item) =>
  item._type === "sos"
    ? makePin(SOS_COLORS, true)
    : makePin(INCIDENT_COLORS[item.type] ?? INCIDENT_COLORS.other);

const makeAccessibilityPin = (resource) =>
  makePin(ACCESSIBILITY_COLORS[resource.category] ?? ACCESSIBILITY_COLORS.accessibility);

const userPin = makePin(USER_COLORS);

function MapController({ flyTo }) {
  const map = useMap();

  useEffect(() => {
    if (!flyTo) return;
    map.flyTo(flyTo.center, flyTo.zoom ?? USER_FOCUS_ZOOM, { duration: 0.8 });
  }, [flyTo, map]);

  return null;
}

function PanListener({ onPan }) {
  useMapEvents({
    moveend: (event) => {
      const center = event.target.getCenter();
      onPan(center.lat, center.lng);
    },
  });

  return null;
}

function CommunityLayer({ items, onSelect }) {
  return (
    <MarkerClusterGroup chunkedLoading>
      {items.filter((item) => isRenderableLocation(item.location)).map((item) => {
        const imageUrl = resolveApiUrl(item.imageUrl);
        return (
        <Marker
          key={item.id}
          position={[Number(item.location.lat), Number(item.location.lon)]}
          icon={makeIncidentPin(item)}
          eventHandlers={{
            click: () => onSelect("incident", {
              incidentId: item.id,
              itemType: item._type,
              title: item.description,
              status: item.status,
              type: item.type,
              urgency: item.urgency,
              imageUrl: item.imageUrl,
              location: item.location,
              time: formatIncidentTime(item.createdAt),
            }),
          }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-bold capitalize">
                {item._type === "sos" ? "SOS" : "Hazard"} · {item.type.replace(/_/g, " ")}
              </div>
              <div className="text-slate-500 text-xs mt-0.5">{item.description}</div>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={item.description}
                  className="mt-2 h-24 w-full rounded-lg object-cover border border-slate-200"
                />
              )}
              <div className="text-slate-500 text-xs mt-1">{formatIncidentTime(item.createdAt)}</div>
            </div>
          </Popup>
        </Marker>
        );
      })}
    </MarkerClusterGroup>
  );
}

function CrowdLayer({ zones, onSelect }) {
  return (
    <>
      {zones.map((zone) => (
        <Circle
          key={zone.id}
          center={zone.center}
          radius={zone.radius}
          pathOptions={{
            color: zone.color,
            weight: 2.5,
            fillColor: zone.color,
            fillOpacity: Math.max(zone.fillOpacity ?? 0.18, 0.16),
          }}
          eventHandlers={{
            click: () => onSelect("crowd", zone),
          }}
        />
      ))}
    </>
  );
}

function HeatLayer({ zones }) {
  return (
    <>
      {zones.map((zone) => (
        <Circle
          key={`heat_${zone.id}`}
          center={zone.center}
          radius={Math.round(zone.radius * 1.25)}
          pathOptions={{
            color: "transparent",
            weight: 0,
            fillColor: zone.color,
            fillOpacity: zone.fillOpacity ?? 0.16,
          }}
        />
      ))}
    </>
  );
}

function AccessibilityLayer({ resources }) {
  return (
    <MarkerClusterGroup chunkedLoading>
      {resources.filter((resource) => isRenderableLatLng(resource.lat, resource.lng)).map((resource) => {
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${resource.lat},${resource.lng}`;
        return (
        <Marker
          key={resource.id}
          position={[Number(resource.lat), Number(resource.lng)]}
          icon={makeAccessibilityPin(resource)}
          zIndexOffset={1000}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-bold">{resource.name}</div>
              <div className="text-slate-500 text-xs mt-0.5 capitalize">{resource.category}</div>
              <div className="text-slate-500 text-xs mt-1">{resource.description}</div>
              <div className="text-slate-500 text-xs mt-1">
                {resource.category} · {resource.distanceKm} km away
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                <ExternalLink className="h-3 w-3" />
                Navigate
              </a>
            </div>
          </Popup>
        </Marker>
      )})}
    </MarkerClusterGroup>
  );
}

function LegRow({ color, label }) {
  return (
    <div className="flex items-center gap-2">
      <div style={{ height: 10, width: 20, borderRadius: 99, background: color, opacity: 0.85 }} />
      <span className="text-xs text-slate-600">{label}</span>
    </div>
  );
}

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

function IncidentSheet({ payload, onClose }) {
  const { user } = useAuth();
  const { mutate: verify, isPending: verifying } = useVerifyReport();
  const isReport = payload?.itemType === "report";
  const isAdmin = user?.role === "admin";
  const mapsUrl = isRenderableLocation(payload?.location)
    ? `https://www.google.com/maps/dir/?api=1&destination=${payload.location.lat},${payload.location.lon}`
    : null;
  const imageUrl = resolveApiUrl(payload?.imageUrl);

  return (
    <div>
      <div className="text-sm font-semibold text-slate-800 capitalize">
        {payload?.itemType === "sos" ? "SOS" : "Hazard"} · {payload?.type?.replace(/_/g, " ")}
      </div>
      <p className="text-base font-bold text-slate-900 mt-2">{payload?.title}</p>
      <p className="text-xs text-slate-400 mt-1">{payload?.time}</p>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={payload.title}
          className="mt-4 h-44 w-full rounded-2xl object-cover border border-slate-200"
        />
      )}
      <div className="mt-3"><Badge status={payload?.status} /></div>
      {payload?.urgency && (
        <div className="mt-2 text-xs font-semibold text-red-600 capitalize">
          Urgency: {payload.urgency}
        </div>
      )}

      {mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-semibold"
        >
          <ExternalLink className="h-4 w-4" />
          Navigate to location
        </a>
      )}

      <div className="mt-5 flex gap-2">
        {isAdmin && isReport && payload?.incidentId && (
          <Button
            className="flex-1"
            disabled={verifying || payload?.status !== "under_review"}
            onClick={() => { verify(payload.incidentId); onClose(); }}
          >
            {verifying ? "Verifying…" : "Verify report"}
          </Button>
        )}
        <Button variant="secondary" className="flex-1" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

function CrowdSheet({ payload, onClose }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-800">Incident density</div>
      <p className="text-base font-bold text-slate-900 mt-2">{payload?.level} density zone</p>
      <p className="text-sm text-slate-500 mt-1">{payload?.note}</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="text-xs uppercase tracking-widest text-slate-400">Incidents</div>
          <div className="text-lg font-bold text-slate-900 mt-1">{payload?.count ?? 0}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="text-xs uppercase tracking-widest text-slate-400">Weighted intensity</div>
          <div className="text-lg font-bold text-slate-900 mt-1">{payload?.weight ?? 0}</div>
        </div>
      </div>
      <div className="mt-5">
        <Button variant="secondary" className="w-full" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

function AlertsSheet({ alerts }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-3 text-slate-800">Active Alerts</p>
      <div className="space-y-3">
        {alerts?.map((alert) => (
          <div key={alert.id} className="rounded-2xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-semibold capitalize text-slate-800">
                {alert.type.replace(/_/g, " ")}
              </span>
              <Badge status={alert.priority} />
            </div>
            <p className="text-xs text-slate-500">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SheetContent({ sheet, onClose }) {
  if (sheet.type === "incident") return <IncidentSheet payload={sheet.payload} onClose={onClose} />;
  if (sheet.type === "crowd") return <CrowdSheet payload={sheet.payload} onClose={onClose} />;
  if (sheet.type === "alerts") return <AlertsSheet alerts={sheet.payload?.alerts} />;
  return null;
}

export default function MapPage() {
  const [lens, setLens] = useState("hazards");
  const [sheet, setSheet] = useState({ open: false, type: null, payload: null });
  const [flyTo, setFlyTo] = useState(null);
  const [initialView, setInitialView] = useState(WORLD_VIEW);
  const [hasCenteredOnUser, setHasCenteredOnUser] = useState(false);
  const [viewport, setViewport] = useState({
    lat: WORLD_VIEW.center[0],
    lon: WORLD_VIEW.center[1],
    radius: ACCESSIBILITY_RADIUS_KM,
  });
  const [debouncedViewport, setDebouncedViewport] = useState(viewport);
  const [accessibilityFilters, setAccessibilityFilters] = useState({
    environmental: true,
    accessibility: true,
    safety: true,
    medical: true,
  });
  const navigate = useNavigate();

  const { location: userLocation, geoState, error: geoError, loading: geoLoading, refresh: refreshLocation } = useGeolocation();
  const {
    data: communityFeed = [],
    isLoading: feedLoading,
    isFetching: feedFetching,
    isError: feedError,
    error: feedLoadError,
    refetch: refetchFeed,
  } = useCommunityFeed();
  const { data: alerts = [], isLoading: alertsLoading } = useAlertsFeed();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedViewport(viewport);
    }, REQUEST_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [viewport]);

  const {
    data: densityZones = [],
    isLoading: densityLoading,
    isFetching: densityFetching,
  } = useQuery({
    queryKey: ["crowd-density", debouncedViewport.lat, debouncedViewport.lon, debouncedViewport.radius],
    queryFn: () =>
      apiClient.get("/crowd-density", {
        lat: debouncedViewport.lat,
        lon: debouncedViewport.lon,
        radius: debouncedViewport.radius,
      }).then((response) => response.data ?? response),
    enabled: (lens === "crowds" || lens === "heat") && Number.isFinite(debouncedViewport.lat) && Number.isFinite(debouncedViewport.lon),
    placeholderData: (previous) => previous,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const {
    data: accessibilityResources = [],
    isLoading: accessibilityLoading,
    isFetching: accessibilityFetching,
    isError: accessibilityError,
    error: accessibilityLoadError,
    refetch: refetchAccessibility,
  } = useQuery({
    queryKey: ["accessibility", debouncedViewport.lat, debouncedViewport.lon, debouncedViewport.radius],
    queryFn: async () => {
      const response = await apiClient.get("/accessibility/resources", {
        lat: debouncedViewport.lat,
        lon: debouncedViewport.lon,
        radius: debouncedViewport.radius,
      });

      const resources = (response.data ?? response)
        .map((resource) => ({
          ...resource,
          lat: Number(resource.lat),
          lng: Number(resource.lng),
          name: resource.name ?? resource.label ?? "Nearby resource",
        }))
        .filter((resource) => isRenderableLatLng(resource.lat, resource.lng));

      // Explicit debug output for the broken visibility path.
      console.debug("[MapPage] accessibility resources", resources);

      return resources;
    },
    enabled: lens === "accessibility" && Number.isFinite(debouncedViewport.lat) && Number.isFinite(debouncedViewport.lon),
    placeholderData: (previous) => previous,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const priorityAlerts = alerts.filter((alert) => alert.active);
  const mapIncidents = communityFeed.filter((item) => isRenderableLocation(item.location));
  const filteredAccessibilityResources = accessibilityResources.filter(
    (resource) => accessibilityFilters[resource.category]
  );
  const openSheet = useCallback((type, payload) => setSheet({ open: true, type, payload }), []);
  const closeSheet = useCallback(() => setSheet({ open: false, type: null, payload: null }), []);

  useEffect(() => {
    if (!userLocation || hasCenteredOnUser) return;

    const centeredView = {
      center: [userLocation.lat, userLocation.lon],
      zoom: USER_FOCUS_ZOOM,
    };

    // Neutral first render, then jump to the user's actual coordinates once available.
    setInitialView(centeredView);
    setViewport((prev) => ({ ...prev, lat: userLocation.lat, lon: userLocation.lon }));
    setFlyTo(centeredView);
    setHasCenteredOnUser(true);
  }, [userLocation, hasCenteredOnUser]);

  const handleLensChange = (lensId) => {
    setLens(lensId);
    if (userLocation) {
      setFlyTo({ center: [userLocation.lat, userLocation.lon], zoom: USER_FOCUS_ZOOM });
    }
    closeSheet();
  };

  const toggleAccessibilityFilter = (category) => {
    setAccessibilityFilters((current) => ({
      ...current,
      [category]: !current[category],
    }));
  };

  const isUpdating = feedLoading || feedFetching || alertsLoading || densityLoading || densityFetching
    || (lens === "accessibility" && (accessibilityLoading || accessibilityFetching));

  return (
    <div className="h-full w-full flex flex-col">
      <header className="h-14 shrink-0 border-b border-slate-200 bg-white/95 backdrop-blur z-10">
        <div className="h-full px-3 flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <div className="hidden md:block font-bold text-slate-900 tracking-tight shrink-0 mr-2">
            CitySafe
          </div>

          {priorityAlerts.length > 0 && (
            <button
              onClick={() => openSheet("alerts", { alerts: priorityAlerts })}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {priorityAlerts.length} alert{priorityAlerts.length !== 1 ? "s" : ""}
            </button>
          )}

          <div className="flex items-center rounded-full border border-slate-200 p-1 bg-white shadow-sm shrink-0">
            {LENSES.map(({ id, label, Icon, desc }) => {
              const active = lens === id;
              return (
                <button
                  key={id}
                  onClick={() => handleLensChange(id)}
                  title={desc}
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

      {lens === "accessibility" && (
        <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap gap-2">
            {ACCESSIBILITY_FILTERS.map((filter) => {
              const active = accessibilityFilters[filter.id];
              return (
                <button
                  key={filter.id}
                  onClick={() => toggleAccessibilityFilter(filter.id)}
                  aria-pressed={active}
                  className={[
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                    active
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <MapContainer center={initialView.center} zoom={initialView.zoom} className="h-full w-full" zoomControl>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          />

          <MapController flyTo={flyTo} />
          <PanListener onPan={(lat, lon) => setViewport((prev) => ({ ...prev, lat, lon }))} />

          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lon]} icon={userPin}>
              <Popup>
                <div className="text-sm font-semibold text-slate-800">You are here</div>
              </Popup>
            </Marker>
          )}

          {lens === "hazards" && (
            <CommunityLayer items={mapIncidents} onSelect={openSheet} />
          )}
          {lens === "crowds" && (
            <CrowdLayer zones={densityZones} onSelect={openSheet} />
          )}
          {lens === "heat" && (
            <HeatLayer zones={densityZones} />
          )}
          {lens === "accessibility" && (
            <AccessibilityLayer resources={filteredAccessibilityResources} />
          )}
        </MapContainer>

        <div className="absolute right-4 bottom-16 z-[1000] flex flex-col items-end gap-2">
          <button
            onClick={() => navigate("/report")}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 border border-slate-200 bg-white shadow-md text-sm font-semibold text-slate-800 hover:bg-slate-50 hover:shadow-lg transition-all active:scale-[0.97]"
          >
            <Plus className="h-4 w-4 text-teal-600" /> Report
          </button>
          <button
            onClick={() => navigate("/sos")}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 text-white px-5 py-3 shadow-lg shadow-red-600/30 hover:bg-red-700 active:scale-[0.97] transition-all font-bold text-sm"
          >
            <Siren className="h-5 w-5" /> SOS
          </button>
        </div>

        <div className="absolute left-3 bottom-4 z-[1000] hidden md:block">
          <Card className="p-3 min-w-[170px]">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              {LENSES.find((item) => item.id === lens)?.label}
            </div>
            <div className="flex flex-col gap-1.5">
              {(LENS_LEGEND[lens] ?? []).map(({ color, label }) => (
                <LegRow key={label} color={color} label={label} />
              ))}
            </div>
          </Card>
        </div>

        {(geoLoading || geoState === "denied" || geoState === "error") && (
          <div className="absolute top-3 left-3 z-[1000] max-w-xs rounded-2xl border border-slate-200 bg-white/95 px-3 py-2 shadow text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-0.5 text-teal-600 shrink-0" />
              <div>
                <div className="font-semibold text-slate-800">
                  {geoLoading ? "Finding your location…" : "Using neutral world view"}
                </div>
                {!geoLoading && (
                  <div className="mt-0.5">
                    {geoError ?? "Location permission was not granted, so the map stayed neutral."}
                  </div>
                )}
                {!geoLoading && (
                  <button
                    onClick={refreshLocation}
                    className="mt-2 text-teal-600 font-semibold hover:text-teal-700"
                  >
                    Retry location
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {feedError && (
          <div className="absolute top-3 right-3 z-[1000] max-w-xs rounded-2xl border border-red-200 bg-white px-3 py-2 shadow text-xs text-red-700">
            <div className="font-semibold">Failed to load map markers.</div>
            <div className="mt-1">{feedLoadError?.message ?? "The community feed is unavailable."}</div>
            <button onClick={() => refetchFeed()} className="mt-2 text-red-600 font-semibold hover:text-red-700">
              Retry
            </button>
          </div>
        )}

        {lens === "accessibility" && accessibilityError && (
          <div className="absolute top-24 right-3 z-[1000] max-w-xs rounded-2xl border border-red-200 bg-white px-3 py-2 shadow text-xs text-red-700">
            <div className="font-semibold">Failed to load accessibility resources.</div>
            <div className="mt-1">{accessibilityLoadError?.message ?? "Try another area or retry the request."}</div>
            <button onClick={() => refetchAccessibility()} className="mt-2 text-red-600 font-semibold hover:text-red-700">
              Retry
            </button>
          </div>
        )}

        {lens === "accessibility" && !accessibilityLoading && !accessibilityFetching && filteredAccessibilityResources.length === 0 && (
          <div className="absolute top-24 left-3 z-[1000] max-w-xs rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow text-xs text-slate-600">
            {accessibilityResources.length === 0
              ? "No accessibility resources were found for this area yet."
              : "All accessibility categories are currently filtered out."}
          </div>
        )}

        {isUpdating && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow text-xs text-slate-600">
            <RefreshCw className="h-3 w-3 animate-spin text-teal-500" /> Updating…
          </div>
        )}

        {sheet.open && (
          <BottomSheet open={sheet.open} onClose={closeSheet}>
            <SheetContent sheet={sheet} onClose={closeSheet} />
          </BottomSheet>
        )}
      </div>
    </div>
  );
}
