import { useState } from "react";
import {
  Siren, AlertTriangle, MapPin, Clock, ExternalLink,
  RefreshCw, CheckCircle, Hand, X, Star, Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useCommunityFeed, useRespondMutation } from "../hooks/useCommunity";
import { useDeleteReport, useRateResponder, useResolveReport } from "../hooks/useReports";
import { useResolveSos } from "../hooks/useSos";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../contexts/AuthContext";
import { resolveApiUrl } from "../lib/apiClient";

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const TABS = [
  { id: "all",     label: "All" },
  { id: "sos",     label: "SOS" },
  { id: "report",  label: "Hazards" },
];

const SOS_TYPE_META = {
  medical:     { emoji: "🚑", label: "Medical" },
  car_trouble: { emoji: "🚗", label: "Car Trouble" },
  electrician: { emoji: "⚡", label: "Electrician" },
  other:       { emoji: "🆘", label: "Other" },
};

const REPORT_TYPE_META = {
  pothole:      { emoji: "🕳️",  label: "Pothole" },
  flooding:     { emoji: "🌊",  label: "Flooding" },
  construction: { emoji: "🚧",  label: "Construction" },
  fire:         { emoji: "🔥",  label: "Fire" },
  crime:        { emoji: "🚨",  label: "Crime" },
  other:        { emoji: "📍",  label: "Other" },
};

const URGENCY_COLORS = {
  high:   { bg: "bg-red-50",    border: "border-red-300",   text: "text-red-700",   dot: "bg-red-500" },
  medium: { bg: "bg-amber-50",  border: "border-amber-300", text: "text-amber-700", dot: "bg-amber-500" },
  low:    { bg: "bg-slate-50",  border: "border-slate-200", text: "text-slate-600", dot: "bg-slate-400" },
};

/* ─── formatTime helper ──────────────────────────────────────────────────────── */
function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatCoordinates(location) {
  if (!location) return "Coordinates unavailable";
  return `${Number(location.lat).toFixed(4)}, ${Number(location.lon).toFixed(4)}`;
}

/* ─── SOSCard component ──────────────────────────────────────────────────────── */
function SOSCard({ item, onClick }) {
  const meta = SOS_TYPE_META[item.type] ?? SOS_TYPE_META.other;
  const urgency = URGENCY_COLORS[item.urgency] ?? URGENCY_COLORS.low;
  const imageUrl = resolveApiUrl(item.imageUrl);

  return (
    <button
      onClick={() => onClick(item)}
      className={[
        "w-full text-left rounded-2xl border-2 p-4 transition-all hover:shadow-md active:scale-[0.98]",
        urgency.bg, urgency.border,
        item.urgency === "high" ? "animate-sos-pulse" : "",
      ].join(" ")}
      aria-label={`SOS: ${item.description}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={[
            "h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0",
            item.urgency === "high" ? "bg-red-600" : item.urgency === "medium" ? "bg-amber-500" : "bg-slate-400",
          ].join(" ")}>
            <Siren className="h-4 w-4" />
          </div>
          <div>
            <div className={`text-xs font-bold uppercase tracking-wider ${urgency.text}`}>
              SOS · {meta.label}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${urgency.dot}`} />
              <span className={`text-xs font-semibold ${urgency.text} capitalize`}>
                {item.urgency} urgency
              </span>
            </div>
          </div>
        </div>
        <Badge status={item.status} />
      </div>

      {/* Description */}
      <p className="text-sm text-slate-800 font-medium line-clamp-2 mb-3">
        {meta.emoji} {item.description}
      </p>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={item.description}
          className="mb-3 h-32 w-full rounded-xl object-cover border border-red-100"
        />
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {formatCoordinates(item.location)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTime(item.createdAt)}
        </span>
      </div>
    </button>
  );
}

/* ─── HazardCard component ───────────────────────────────────────────────────── */
function HazardCard({ item, onClick }) {
  const meta = REPORT_TYPE_META[item.type] ?? REPORT_TYPE_META.other;
  const imageUrl = resolveApiUrl(item.imageUrl);

  return (
    <button
      onClick={() => onClick(item)}
      className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md active:scale-[0.98]"
      aria-label={`Hazard report: ${item.description}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4 text-slate-500" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Hazard Report
            </div>
            <div className="text-xs font-semibold text-slate-600 capitalize mt-0.5">
              {meta.emoji} {meta.label}
            </div>
          </div>
        </div>
        <Badge status={item.status} />
      </div>

      <p className="text-sm text-slate-700 line-clamp-2 mb-3">
        {item.description}
      </p>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={item.description}
          className="mb-3 h-32 w-full rounded-xl object-cover border border-slate-200"
        />
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {formatCoordinates(item.location)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTime(item.createdAt)}
        </span>
      </div>
    </button>
  );
}

/* ─── Detail Modal content ───────────────────────────────────────────────────── */
function DetailContent({ item, onClose }) {
  const { user } = useAuth();
  const [responded, setResponded] = useState(false);
  const [helpful, setHelpful] = useState(false);
  const [resolved, setResolved] = useState(item.status === "resolved");
  const [selectedRating, setSelectedRating] = useState(0);
  const [rated, setRated] = useState(false);
  const isSos = item._type === "sos";
  const isOwner = user?.userId === item.userId;

  const { mutate, isPending } = useRespondMutation();
  const { mutate: resolveReport, isPending: resolvingReport } = useResolveReport();
  const { mutate: resolveSos, isPending: resolvingSos } = useResolveSos();
  const { mutate: deleteReport, isPending: deletingReport } = useDeleteReport();
  const { mutate: rateResponder, isPending: ratingResponder } = useRateResponder();

  const sosTypeMeta = SOS_TYPE_META[item.type] ?? SOS_TYPE_META.other;
  const reportTypeMeta = REPORT_TYPE_META[item.type] ?? REPORT_TYPE_META.other;
  const meta = isSos ? sosTypeMeta : reportTypeMeta;
  const displayStatus = resolved ? "resolved" : item.status;
  const imageUrl = resolveApiUrl(item.imageUrl);
  
  // Real Google Maps navigation link
  const mapsUrl = Number.isFinite(item.location?.lat) && Number.isFinite(item.location?.lon)
    ? `https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lon}`
    : null;

  const handleAssist = () => {
    mutate({ requestId: item.id, type: item._type }, {
      onSuccess: () => {
        setResponded(true);
        toast.success("You are now responding to this request", { duration: 4000 });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to respond. Please try again.");
      }
    });
  };

  const handleHelpful = () => {
    mutate({ requestId: item.id, type: item._type }, {
      onSuccess: () => {
        setHelpful(true);
        toast.success("You are now responding to this request", { duration: 3000 });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to respond. Please try again.");
      }
    });
  };

  const handleResolve = () => {
    const resolver = isSos ? resolveSos : resolveReport;
    resolver(item.id, {
      onSuccess: () => {
        setResolved(true);
      },
    });
  };

  const handleDelete = () => {
    if (!window.confirm("Delete this report permanently?")) return;
    deleteReport(item.id, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const handleRate = (rating) => {
    setSelectedRating(rating);
    rateResponder({ reportId: item.id, rating }, {
      onSuccess: () => {
        setRated(true);
      },
    });
  };

  return (
    <div>
      {/* Type badge */}
      <div className={[
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4",
        isSos ? "bg-red-50 text-red-700 border border-red-200" : "bg-slate-100 text-slate-600 border border-slate-200",
      ].join(" ")}>
        {isSos ? <Siren className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        {isSos ? `SOS · ${meta.label}` : `Hazard · ${meta.label}`}
      </div>

      {/* Description */}
      <p className="text-base font-semibold text-slate-900 mb-1">
        {meta.emoji} {item.description}
      </p>
      {imageUrl && (
        <img
          src={imageUrl}
          alt={item.description}
          className="mt-4 h-48 w-full rounded-2xl object-cover border border-slate-200"
        />
      )}

      {/* Metadata row */}
      <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 mb-4">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatTime(item.createdAt)}
        </span>
        <span>·</span>
        <Badge status={displayStatus} />
        {item.responderCount > 0 && (
          <>
            <span>·</span>
            <span className="font-semibold text-teal-600">
              {item.responderCount} responding
            </span>
          </>
        )}
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 mb-5">
        <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
        <div className="text-sm text-slate-600">
          <span className="font-medium">Approximate location</span>
          <div className="text-xs text-slate-400 mt-0.5">
            {formatCoordinates(item.location)}
          </div>
        </div>
      </div>

      {/* SOS action: confirmation state */}
      {isSos && responded && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <div>
            <div className="text-sm font-bold text-green-800">You are responding to this SOS</div>
            <div className="text-xs text-green-600 mt-0.5">The person in need has been notified. Please head to the location.</div>
          </div>
        </div>
      )}

      {/* Hazard action: helpful state */}
      {!isSos && helpful && (
        <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3 mb-4">
          <CheckCircle className="h-5 w-5 text-teal-600 shrink-0" />
          <div className="text-sm font-bold text-teal-800">Thanks for confirming this hazard!</div>
        </div>
      )}

      {resolved && !isSos && item.responderId && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-sm font-bold text-amber-800">Rate the responder</div>
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleRate(rating)}
                disabled={ratingResponder || rated}
                className="rounded-full p-1 text-amber-500 disabled:opacity-60"
                aria-label={`Rate ${rating} star${rating > 1 ? "s" : ""}`}
              >
                <Star
                  className="h-5 w-5"
                  fill={rating <= selectedRating ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>
          {rated && (
            <div className="mt-2 text-xs font-semibold text-amber-700">
              Thanks. Your rating has been saved.
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-2">
        {isSos ? (
          <>
            {!responded && (
              <Button
                className="w-full"
                variant="emergency"
                onClick={handleAssist}
                disabled={isPending}
              >
                <Hand className="h-4 w-4 mr-1.5" /> 
                {isPending ? "Connecting..." : "I Can Help"}
              </Button>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-teal-300 bg-teal-50 text-teal-700 text-sm font-semibold py-2.5 hover:bg-teal-100 transition"
              >
                <ExternalLink className="h-4 w-4" /> Navigate
              </a>
            )}
            {isOwner && !resolved && (
              <Button
                className="w-full"
                variant="secondary"
                onClick={handleResolve}
                disabled={resolvingSos}
              >
                {resolvingSos ? "Resolving..." : "Resolve"}
              </Button>
            )}
          </>
        ) : (
          <>
            {!helpful && (
              <Button
                className="w-full"
                onClick={handleHelpful}
                disabled={isPending || resolved}
              >
                👍 {isPending ? "Saving..." : "Acknowledge"}
              </Button>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 text-slate-600 text-sm font-semibold py-2.5 hover:bg-slate-100 transition"
              >
                <ExternalLink className="h-4 w-4" /> Navigate
              </a>
            )}
            {isOwner && !resolved && (
              <>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={handleResolve}
                  disabled={resolvingReport}
                >
                  {resolvingReport ? "Resolving..." : "Resolve"}
                </Button>
                <Button
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  variant="secondary"
                  onClick={handleDelete}
                  disabled={deletingReport}
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  {deletingReport ? "Deleting..." : "Delete"}
                </Button>
              </>
            )}
          </>
        )}
        <Button variant="ghost" className="w-full" onClick={onClose}>
          <X className="h-4 w-4 mr-1.5" /> Close
        </Button>
      </div>
    </div>
  );
}

/* ─── Main CommunityPage ─────────────────────────────────────────────────────── */
export default function CommunityPage() {
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState(null);
  const { data = [], isLoading, isError, error, refetch, isFetching } = useCommunityFeed();

  const filtered = data.filter((item) => {
    if (tab === "all") return true;
    return item._type === tab;
  });

  const sosCnt = data.filter((d) => d._type === "sos").length;
  const reportCnt = data.filter((d) => d._type === "report").length;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4">
      {/* ── Page header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Community Response</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live feed of active SOS requests and hazard reports near you.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs font-semibold text-teal-600 hover:text-teal-700 transition mt-1 disabled:opacity-50"
          aria-label="Refresh feed"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── Summary pills ── */}
      <div className="flex gap-2 mb-4">
        {sosCnt > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-xs font-bold text-red-700">
            <Siren className="h-3 w-3" /> {sosCnt} SOS active
          </div>
        )}
        {reportCnt > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
            <AlertTriangle className="h-3 w-3" /> {reportCnt} Hazards
          </div>
        )}
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm mb-5 w-fit">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            className={[
              "px-4 py-1.5 rounded-full text-xs font-semibold transition-all",
              tab === id ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── States ── */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl skeleton" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <Card className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">Failed to load feed</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">{error?.message ?? "Check your connection or backend status."}</p>
          <Button variant="secondary" onClick={() => refetch()}>Try again</Button>
        </Card>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-base font-bold text-slate-800">All clear!</p>
          <p className="text-sm text-slate-400 mt-1">
            No active {tab === "sos" ? "SOS requests" : tab === "report" ? "hazard reports" : "items"} right now.
          </p>
        </Card>
      )}

      {/* ── Feed cards ── */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className="space-y-3 animate-fade-up">
          {filtered.map((item) =>
            item._type === "sos" ? (
              <SOSCard key={item.id} item={item} onClick={setSelected} />
            ) : (
              <HazardCard key={item.id} item={item} onClick={setSelected} />
            )
          )}
        </div>
      )}

      {/* ── Detail Modal ── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected?._type === "sos"
            ? `SOS · ${(SOS_TYPE_META[selected?.type] ?? SOS_TYPE_META.other).label}`
            : `Hazard · ${(REPORT_TYPE_META[selected?.type] ?? REPORT_TYPE_META.other).label}`
        }
      >
        {selected && (
          <DetailContent item={selected} onClose={() => setSelected(null)} />
        )}
      </Modal>
    </div>
  );
}
