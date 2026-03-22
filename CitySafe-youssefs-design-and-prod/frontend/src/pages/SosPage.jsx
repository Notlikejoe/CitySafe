import { useState, useEffect, useRef, useCallback } from "react";
import {
  Siren, HeartPulse, Car, Zap, HelpCircle,
  MapPin, CheckCircle, AlertTriangle, ChevronRight, Send, Loader2, RefreshCw, Trash2,
} from "lucide-react";
import { useCreateSos, useCancelSos } from "../hooks/useSos";
import { Button } from "../components/ui/Button";
import { useOfflineQueue } from "../hooks/useOfflineQueue";

// ─── Constants ────────────────────────────────────────────────────────────────
const SOS_TYPES = [
  {
    id: "medical",
    label: "Medical Emergency",
    Icon: HeartPulse,
    desc: "Injury, illness, or life-threatening situation",
    tint: "border-red-200 bg-red-50 hover:border-red-400",
    activeTint: "border-red-500 bg-red-50 shadow-md shadow-red-100",
    iconBg: "bg-red-100",
    iconColor: "text-red-500",
    textColor: "text-red-700",
    isCritical: true,
  },
  {
    id: "car_trouble",
    label: "Car Trouble",
    Icon: Car,
    desc: "Breakdown, flat tyre, or accident",
    tint: "border-orange-200 bg-orange-50 hover:border-orange-400",
    activeTint: "border-orange-500 bg-orange-50 shadow-sm",
    iconBg: "bg-orange-100",
    iconColor: "text-orange-500",
    textColor: "text-orange-700",
    isCritical: false,
  },
  {
    id: "electrician",
    label: "Electrical Fault",
    Icon: Zap,
    desc: "Power or wiring issue",
    tint: "border-violet-200 bg-violet-50 hover:border-violet-400",
    activeTint: "border-violet-500 bg-violet-50 shadow-sm",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-500",
    textColor: "text-violet-700",
    isCritical: false,
  },
  {
    id: "other",
    label: "Other",
    Icon: HelpCircle,
    desc: "Describe your situation below",
    tint: "border-slate-200 bg-white hover:border-slate-400",
    activeTint: "border-slate-500 bg-slate-50 shadow-sm",
    iconBg: "bg-slate-100",
    iconColor: "text-slate-500",
    textColor: "text-slate-700",
    isCritical: false,
  },
];

const URGENCY_STOPS = ["low", "medium", "high"];
const URGENCY_META = {
  low: { label: "Low", note: "Non-urgent — I can wait", text: "text-slate-600", track: "bg-slate-300", ring: "ring-slate-300" },
  medium: { label: "Medium", note: "I need help within the hour", text: "text-orange-600", track: "bg-orange-400", ring: "ring-orange-400" },
  high: { label: "High", note: "Urgent — please respond fast", text: "text-red-600", track: "bg-red-500", ring: "ring-red-400" },
};

// ─── Urgency selector ─────────────────────────────────────────────────────────
function UrgencyPicker({ value, onChange }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-2">Urgency level</p>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Urgency level">
        {URGENCY_STOPS.map((level) => {
          const m = URGENCY_META[level];
          const active = value === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(level)}
              className={[
                "flex flex-col items-center gap-1 rounded-xl border-2 py-3 px-2 transition-all text-center",
                active
                  ? `border-current ${m.text} bg-white shadow-sm ring-2 ring-offset-1 ${m.ring}`
                  : "border-slate-200 text-slate-500 hover:border-slate-300 bg-white",
              ].join(" ")}
            >
              <span className={`text-xs font-bold ${active ? m.text : ""}`}>{m.label}</span>
              <span className="text-[11px] text-slate-400 leading-tight">{m.note}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Location pill ─────────────────────────────────────────────────────────────
/**
 * Displays current GPS location. Fetches on mount and on request (via refresh).
 */
function LocationPill({ location, geoState, onRefresh }) {
  const statusText = () => {
    if (geoState === "loading") return "Detecting your location…";
    if (geoState === "denied") return "Location permission denied";
    if (geoState === "error") return "Could not get location";
    if (location) return `${location.lat.toFixed(5)}, ${location.lon.toFixed(5)}`;
    return "Location not yet detected";
  };

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
          {geoState === "loading"
            ? <Loader2 className="h-4 w-4 text-teal-500 animate-spin" />
            : <MapPin className="h-4 w-4 text-teal-500" />}
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800">
            {geoState === "ready" && location ? "Live GPS Location" : "Device GPS"}
          </div>
          <div className={`text-xs mt-0.5 ${geoState === "denied" || geoState === "error" ? "text-red-500" : "text-slate-500"}`}>
            {statusText()}
          </div>
        </div>
      </div>
      {geoState !== "loading" && (
        <button
          aria-label="Refresh location"
          onClick={onRefresh}
          className="text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors px-2 py-1 rounded-lg hover:bg-teal-50 flex items-center gap-1"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      )}
    </div>
  );
}

// ─── Geolocation hook ─────────────────────────────────────────────────────────
function useGeolocation() {
  const [location, setLocation] = useState(null);
  // "idle" | "loading" | "ready" | "denied" | "error"
  const [geoState, setGeoState] = useState("idle");

  const fetch = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState("error");
      return;
    }
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoState("ready");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoState("denied");
        } else {
          setGeoState("error");
        }
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetch();
  }, [fetch]);

  return { location, geoState, refresh: fetch };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SosPage() {
  const { mutate: createSos, isPending } = useCreateSos();
  const { mutate: cancelSos, isPending: cancelling } = useCancelSos();
  const { location, geoState, refresh: refreshLocation } = useGeolocation();
  const { submitOrQueue } = useOfflineQueue();

  const [sosType, setSosType] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [description, setDesc] = useState("");
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");

  // Hold-to-confirm for HIGH urgency medical
  const holdTimer = useRef(null);
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);

  const isMedicalHigh = sosType === "medical" && urgency === "high";
  const canSend = !!sosType && (geoState === "ready" || geoState === "denied" || geoState === "error");

  const doSend = async () => {
    setError("");
    const coords = location ?? { lat: 25.2048, lon: 55.2708 };
    const payload = { type: sosType, urgency, description, location: coords };

    // If offline, queue and bail out — will retry when connection resumes
    const queued = await submitOrQueue("sos", payload);
    if (queued) return;

    createSos(
      payload,
      {
        onSuccess: (data) => {
          setSent(data);
          setDesc("");
        },
        onError: (e) => setError(e.message ?? "Failed to send request. Please try again."),
      }
    );
  };

  const startHold = () => {
    if (!canSend || isPending) return;
    setHolding(true);
    let progress = 0;
    const TOTAL = 1200;
    const INTERVAL = 30;
    holdTimer.current = setInterval(() => {
      progress += (INTERVAL / TOTAL) * 100;
      setHoldProgress(Math.min(progress, 100));
      if (progress >= 100) {
        clearInterval(holdTimer.current);
        setHolding(false);
        setHoldProgress(0);
        doSend();
      }
    }, INTERVAL);
  };

  const cancelHold = () => {
    clearInterval(holdTimer.current);
    setHolding(false);
    setHoldProgress(0);
  };

  // ── Success state ──
  if (sent) {
    const canCancel = ["pending", "under_review"].includes(sent.status);

    const handleCancel = () => {
      if (!window.confirm("Cancel this SOS request? Only do this if you no longer need help.")) return;
      cancelSos(sent.id, {
        onSuccess: () => setSent(null),
      });
    };

    return (
      <div className="max-w-lg mx-auto py-10 px-4 animate-fade-up">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div className="h-24 w-24 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center shadow-lg shadow-teal-500/10">
              <CheckCircle className="h-12 w-12 text-teal-500" />
            </div>
            <div className="absolute inset-0 rounded-full border-2 border-teal-300 animate-ping opacity-30" />
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900">Help is on the way</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-xs leading-relaxed">
            Your request has been sent. Nearby community helpers have been notified. Stay calm — you're not alone.
          </p>

          <div className="mt-6 w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left space-y-2">
            <div className="text-xs uppercase tracking-widest font-bold text-slate-400 mb-3">Your Request</div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Type</span>
              <span className="text-sm font-semibold text-slate-800 capitalize">{sent.type?.replace(/_/g, " ")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Urgency</span>
              <span className={`text-sm font-bold capitalize ${URGENCY_META[sent.urgency]?.text ?? "text-slate-700"}`}>
                {URGENCY_META[sent.urgency]?.label ?? sent.urgency}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-sm text-slate-500">Status</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-ping" />
                {sent.status}
              </span>
            </div>
          </div>

          <Button variant="secondary" className="mt-5 w-full" onClick={() => setSent(null)}>
            Send another request
          </Button>

          {/* Cancel button — only if the request hasn't been responded to yet */}
          {canCancel && (
            <Button
              variant="ghost"
              className="mt-2 w-full text-red-500 hover:bg-red-50 hover:text-red-600"
              loading={cancelling}
              onClick={handleCancel}
            >
              <Trash2 className="h-4 w-4" />
              Cancel this request
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <div className="mb-7">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
            <Siren className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">Request Help</h1>
            <p className="text-slate-500 text-sm mt-0.5">Your community will respond as quickly as possible.</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-5">

        {/* Step 1: Location */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">1 · Your location</p>
          <LocationPill location={location} geoState={geoState} onRefresh={refreshLocation} />
          {(geoState === "denied" || geoState === "error") && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Using approximate location — your request may still be sent.
            </p>
          )}
        </div>

        {/* Step 2: Type */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">2 · What do you need help with?</p>
          <div className="space-y-2">
            {/* Medical — full width */}
            {(() => {
              const t = SOS_TYPES[0];
              const active = sosType === t.id;
              return (
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSosType(t.id)}
                  className={[
                    "w-full flex items-center gap-4 rounded-2xl border-2 p-4 text-left transition-all",
                    active ? t.activeTint : t.tint,
                  ].join(" ")}
                >
                  <div className={`h-12 w-12 rounded-xl ${t.iconBg} flex items-center justify-center shrink-0`}>
                    <t.Icon className={`h-6 w-6 ${t.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-bold text-base ${active ? t.textColor : "text-slate-800"}`}>{t.label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{t.desc}</div>
                  </div>
                  {active && <div className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0 ring-2 ring-red-200" />}
                </button>
              );
            })()}

            {/* Other 3 types */}
            <div className="grid grid-cols-2 gap-2">
              {SOS_TYPES.slice(1).map((t) => {
                const active = sosType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSosType(t.id)}
                    className={[
                      "flex flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all",
                      active ? t.activeTint : t.tint,
                    ].join(" ")}
                  >
                    <div className={`h-9 w-9 rounded-xl ${t.iconBg} flex items-center justify-center`}>
                      <t.Icon className={`h-5 w-5 ${t.iconColor}`} />
                    </div>
                    <div>
                      <div className={`font-semibold text-sm ${active ? t.textColor : "text-slate-700"}`}>{t.label}</div>
                      <div className="text-xs text-slate-400 mt-0.5 leading-tight">{t.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Step 3: Urgency */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">3 · Urgency</p>
          <UrgencyPicker value={urgency} onChange={setUrgency} />
        </div>

        {/* Step 4: Description */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            4 · Additional details <span className="font-normal text-slate-400 normal-case tracking-normal text-xs">(optional)</span>
          </p>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Any context that will help the community helper assist you…"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition resize-none"
          />
        </div>

        {/* Send button */}
        <div className="pt-1 space-y-2">
          {isMedicalHigh ? (
            <div className="relative w-full overflow-hidden rounded-2xl">
              <div
                className="absolute inset-0 bg-red-700 transition-none origin-left rounded-2xl"
                style={{ transform: `scaleX(${holdProgress / 100})`, transitionDuration: "0ms" }}
              />
              <button
                type="button"
                disabled={!canSend || isPending}
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                className={[
                  "relative z-10 w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-bold text-white transition-all",
                  "bg-red-600 hover:bg-red-700 active:bg-red-800 shadow-lg shadow-red-600/30",
                  "disabled:opacity-50 disabled:cursor-not-allowed animate-sos-pulse select-none",
                ].join(" ")}
              >
                <Siren className="h-5 w-5" />
                {holding ? `Hold… ${Math.round(holdProgress)}%` : "Hold to Send Emergency Request"}
              </button>
            </div>
          ) : (
            <Button
              size="lg"
              variant={urgency === "high" ? "emergency" : "primary"}
              className="w-full"
              disabled={!canSend}
              loading={isPending}
              onClick={doSend}
            >
              <Send className="h-5 w-5" />
              {urgency === "high" ? "Send Urgent Request" : "Request Help"}
            </Button>
          )}

          {!sosType && (
            <p className="text-center text-xs text-slate-400">Select the type of help you need above to continue</p>
          )}

          {isMedicalHigh && (
            <p className="text-center text-xs text-red-500 font-medium">
              Press and hold the button to send — prevents accidental triggers
            </p>
          )}
        </div>
      </div>
    </div>
  );
}