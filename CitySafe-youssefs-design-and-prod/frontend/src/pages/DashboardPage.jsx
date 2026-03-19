import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileWarning, Siren, Ticket, ChevronRight,
  Clock, Shield, BadgeCheck, TrendingUp, Star,
  AlertCircle, X, MapPin, Calendar, Tag,
} from "lucide-react";
import { useHistory } from "../hooks/useHistory";
import { usePoints } from "../hooks/usePoints";
import { useVouchers, useRedeemVoucher } from "../hooks/useVouchers";
import { Button } from "../components/ui/Button";
import { ListSkeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { useSocket } from "../hooks/useSocket";
import { useAuth } from "../contexts/AuthContext";
import toast from "react-hot-toast";


const FILTER_TABS = [
  { id: "", label: "All" },
  { id: "report", label: "Reports" },
  { id: "sos", label: "SOS" },
  { id: "point", label: "Points" },
  { id: "voucher", label: "Vouchers" },
];

// Semantic colour map — safety actions (blue family), rewards (amber/teal family)
// This separates "what happened to your community" from "what you earned"
const TYPE_META = {
  report: {
    dot: "bg-sky-500",
    badge: "bg-sky-50 border-sky-200 text-sky-700",
    label: (e) => e.type ? e.type.charAt(0).toUpperCase() + e.type.slice(1) + " Report" : "Community Report",
  },
  sos: {
    dot: "bg-red-500",
    badge: "bg-red-50 border-red-200 text-red-700",
    label: () => "SOS Request",
  },
  point: {
    dot: "bg-amber-400",
    badge: "bg-amber-50 border-amber-200 text-amber-700",
    label: (e) => `+${e.points} CityPoints earned`,
  },
  voucher: {
    dot: "bg-teal-500",
    badge: "bg-teal-50 border-teal-200 text-teal-700",
    label: () => "Reward voucher issued",
  },
};

// Safety status badge — distinct from TYPE colours; uses neutral-to-green scale
const STATUS_BADGE = {
  verified: "bg-green-50 border-green-200 text-green-700",
  resolved: "bg-green-50 border-green-200 text-green-700",
  submitted: "bg-sky-50 border-sky-200 text-sky-700",
  under_review: "bg-yellow-50 border-yellow-200 text-yellow-700",
  pending: "bg-yellow-50 border-yellow-200 text-yellow-700",
  rejected: "bg-red-50 border-red-200 text-red-700",
  cancelled: "bg-slate-100 border-slate-200 text-slate-500",
};

// Time-aware greeting — more relaxed, human copy
function useGreeting(name) {
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return `Morning, ${name} 👋`;
    if (h < 18) return `Hey ${name} 👋`;
    return `Good evening, ${name} 👋`;
  }, [name]);
}

// ─── Event Detail Modal ────────────────────────────────────────────────────────
function EventDetailModal({ event, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!event) return null;

  const meta = TYPE_META[event._type] ?? TYPE_META.report;
  const label = meta.label(event);
  const statusClass = STATUS_BADGE[event.status] ?? "bg-slate-100 border-slate-200 text-slate-500";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl animate-fade-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
            <div className="font-bold text-slate-900 text-sm">{label}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Status badge */}
          {event.status && (
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${statusClass}`}>
                {event.status.replace(/_/g, " ")}
              </span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Description</div>
              <div className="text-sm text-slate-700 leading-relaxed">{event.description}</div>
            </div>
          )}

          {/* Coordinates */}
          {event.location?.lat && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="font-mono text-xs">
                {event.location.lat.toFixed(5)}, {event.location.lon?.toFixed(5) ?? event.location.lng?.toFixed(5)}
              </span>
            </div>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{new Date(event._timestamp ?? event.createdAt).toLocaleString([], {
              weekday: "short", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}</span>
          </div>

          {/* Points row if applicable */}
          {event._type === "point" && (
            <div className="flex items-center gap-2 text-sm font-bold text-amber-600">
              <Star className="h-4 w-4" />
              +{event.points} CityPoints earned
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-slate-900 text-white text-sm font-bold py-3 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Points Summary Card ──────────────────────────────────────────────────────
// Replaced the oversized ring — simpler horizontal card, not the hero
function PointsSummary({ balance, maxPoints = 200 }) {
  const pct = Math.min((balance / maxPoints) * 100, 100);
  const remaining = maxPoints - balance;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-bold text-slate-800">CityPoints</span>
        </div>
        <span className="text-xl font-extrabold text-slate-900">{balance}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-sky-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{balance} pts earned</span>
          {remaining > 0
            ? <span>{remaining} pts to next reward</span>
            : <span className="text-teal-600 font-semibold">Ready to redeem! 🎉</span>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Voucher Ticket ───────────────────────────────────────────────────────────
// Toned down — clean card, no excessive glassmorphism shimmer
function VoucherCard({ voucher, onRedeem, redeeming }) {
  const expired = new Date(voucher.expiresAt) < new Date();
  const daysLeft = Math.max(0, Math.round((new Date(voucher.expiresAt) - new Date()) / 86400000));

  return (
    <div className={`rounded-2xl border bg-white flex shrink-0 w-64 overflow-hidden transition-opacity
      ${expired || voucher.redeemed ? "opacity-50 grayscale border-slate-200" : "border-teal-200 shadow-sm"}`}
    >
      {/* Left accent strip */}
      <div className="w-2 bg-gradient-to-b from-teal-500 to-teal-600 shrink-0" />

      {/* Content */}
      <div className="flex-1 px-4 py-4 border-l-2 border-dashed border-teal-100">
        <div className="flex items-center gap-1.5 mb-1">
          <Ticket className="h-3 w-3 text-teal-600" />
          <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Reward</span>
        </div>
        <div className="font-mono font-bold text-slate-800 text-sm tracking-wide">{voucher.code}</div>

        {voucher.redeemed ? (
          <div className="mt-2 flex items-center gap-1 text-xs text-slate-400 font-medium">
            <BadgeCheck className="h-3.5 w-3.5" /> Redeemed
          </div>
        ) : expired ? (
          <div className="mt-2 text-xs text-red-500 font-medium">Expired</div>
        ) : (
          <>
            <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
              <Clock className="h-3 w-3" /> {daysLeft}d remaining
            </div>
            <button
              disabled={redeeming}
              onClick={() => onRedeem(voucher.id)}
              className="mt-3 text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              Use Reward <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Timeline Event ───────────────────────────────────────────────────────────
function TimelineEvent({ event, idx, isLast, onSelect }) {
  const meta = TYPE_META[event._type] ?? TYPE_META.report;
  const label = meta.label(event);
  const statusClass = STATUS_BADGE[event.status] ?? "bg-slate-100 border-slate-200 text-slate-500";
  const isClickable = event._type === "report" || event._type === "sos";

  // Fix alarm fatigue: don't make inactive/resolved SOS bright red
  const isInactive = event.status === "resolved" || event.status === "cancelled" || event.status === "rejected";
  const dotClass = (event._type === "sos" && isInactive) ? "bg-slate-400" : meta.dot;

  return (
    <div
      className={[
        "flex gap-3 group rounded-xl px-3 py-2.5 -mx-3 transition-all duration-150",
        isClickable ? "cursor-pointer hover:bg-slate-50 active:bg-slate-100" : "",
      ].join(" ")}
      style={{ animationDelay: `${idx * 35}ms` }}
      onClick={isClickable ? () => onSelect(event) : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => e.key === "Enter" && onSelect(event) : undefined}
      aria-label={isClickable ? `View details for ${label}` : undefined}
    >
      {/* Left rail */}
      <div className="flex flex-col items-center pt-1 shrink-0">
        <div className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        {!isLast && <div className="w-px flex-1 bg-slate-100 mt-1.5" />}
      </div>

      {/* Content */}
      <div className={`pb-5 min-w-0 flex-1 flex items-start justify-between gap-3 ${!isLast ? "" : ""}`}>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800 truncate">{label}</div>
          {event.description && (
            <div className="text-xs text-slate-500 mt-0.5 truncate">{event.description}</div>
          )}
          <div className="text-xs text-slate-400 mt-0.5">
            {new Date(event._timestamp).toLocaleString([], {
              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
            })}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {event.status && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusClass} capitalize`}>
              {event.status.replace(/_/g, " ")}
            </span>
          )}
          {event._type === "point" && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              +{event.points}
            </span>
          )}
          {/* Explicit arrow for clickable events */}
          {isClickable && (
            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.userId ?? "";
  const displayName = user?.displayName ?? user?.userId ?? "there";
  const greeting = useGreeting(displayName);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const handleCloseModal = useCallback(() => setSelectedEvent(null), []);

  const { data: history, isLoading, isError, error, refetch } =
    useHistory(userId, { type: filter || undefined, page, limit: 20 });
  const { data: points } = usePoints(userId);
  const { data: vouchers = [] } = useVouchers(userId);
  const { mutate: redeem, isPending: redeeming } = useRedeemVoucher();
  const { on, off } = useSocket();
  const queryClient = useQueryClient();

  // Real-time: refresh history when new SOS or report lands via WebSocket
  useEffect(() => {
    const handleSosNew = (data) => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
      if (data?.userId !== userId) {
        toast("🚨 New SOS nearby!", { duration: 4000 });
      }
    };
    const handleReportNew = () => {
      queryClient.invalidateQueries({ queryKey: ["history"] });
    };
    on("sos:new", handleSosNew);
    on("report:new", handleReportNew);
    return () => {
      off("sos:new", handleSosNew);
      off("report:new", handleReportNew);
    };
  }, [on, off, queryClient]);

  const balance = points?.balance ?? 0;
  const totalReports = history?.summary?.totalReports ?? 0;
  const totalSos = history?.summary?.totalSos ?? 0;
  const activeVouchers = vouchers.filter((v) => !v.redeemed && new Date(v.expiresAt) > new Date());

  return (
    <>
      <div className="max-w-2xl mx-auto py-6 px-4 space-y-6">

      {/* ── A. Greeting ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 animate-fade-up">
        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-teal-500/20 shrink-0">
          {displayName[0]?.toUpperCase() ?? "U"}
        </div>
        <div>
          {/* Warm, human greeting */}
          <div className="text-lg font-extrabold text-slate-900 leading-tight">{greeting}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {totalReports > 0
              ? `You've filed ${totalReports} report${totalReports !== 1 ? "s" : ""} — your area is safer for it.`
              : "Start a report to help keep your community safe."}
          </div>
        </div>
      </div>

      {/* ── B. Safety Stats — PRIORITY ONE (above rewards) ──────────────────── */}
      <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Community Activity</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Reports stat */}
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-4 space-y-1">
            <div className="flex items-center gap-2">
              <FileWarning className="h-4 w-4 text-sky-600" />
              <span className="text-xs font-semibold text-sky-700">Reports filed</span>
            </div>
            <div className="text-3xl font-extrabold text-sky-800 leading-none">{totalReports}</div>
            <div className="text-xs text-sky-600">issues flagged</div>
          </div>
          {/* SOS stat */}
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 space-y-1">
            <div className="flex items-center gap-2">
              <Siren className="h-4 w-4 text-red-600" />
              <span className="text-xs font-semibold text-red-700">SOS requests</span>
            </div>
            <div className="text-3xl font-extrabold text-red-800 leading-none">{totalSos}</div>
            <div className="text-xs text-red-600">help requests sent</div>
          </div>
        </div>
      </div>

      {/* ── C. Points (secondary — reward BELOW safety) ─────────────────────── */}
      <div className="animate-fade-up" style={{ animationDelay: "90ms" }}>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Your Rewards</p>
        <PointsSummary balance={balance} maxPoints={200} />
      </div>

      {/* ── D. Vouchers ─────────────────────────────────────────────────────── */}
      {vouchers.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vouchers</p>
            <span className="text-xs text-slate-400">{activeVouchers.length} active</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
            {vouchers.map((v) => (
              <VoucherCard key={v.id} voucher={v} onRedeem={redeem} redeeming={redeeming} />
            ))}
            {/* Locked next reward slot */}
            {activeVouchers.length === 0 && (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 w-52 shrink-0 flex flex-col items-center justify-center gap-2 py-6 px-4 text-center">
                <Star className="h-5 w-5 text-slate-300" />
                <div className="text-xs text-slate-400 font-medium leading-tight">
                  Earn {Math.max(0, 200 - balance)} more pts to unlock a reward
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── E. Activity Timeline ─────────────────────────────────────────────── */}
      <div className="animate-fade-up" style={{ animationDelay: "150ms" }}>
        {/* Filter tabs */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Activity</p>
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {FILTER_TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setFilter(id); setPage(1); }}
                className={[
                  "px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all",
                  filter === id
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* States */}
        {isLoading && <ListSkeleton count={4} />}
        {isError && <ErrorBanner message={error?.message} onRetry={refetch} />}
        {!isLoading && !isError && history?.items?.length === 0 && (
          <EmptyState
            icon={AlertCircle}
            heading="No activity yet"
            body="Your reports, SOS requests, and points will all appear here once you start contributing."
            actionLabel="File your first report"
            onAction={() => navigate("/report")}
          />
        )}

        {/* Timeline */}
        {!isLoading && !isError && history?.items?.length > 0 && (
          <div className="pl-1">
            {history.items.map((event, i) => (
              <TimelineEvent
                key={`${event._type}-${event.id ?? i}-${i}`}
                event={event}
                idx={i}
                isLast={i === history.items.length - 1}
                onSelect={setSelectedEvent}
              />
            ))}
          </div>
        )}

        {/* Interaction hint for first-time users */}
        {!isLoading && !isError && (history?.items?.length ?? 0) > 0 && (
          <p className="text-xs text-slate-400 mt-3 text-center">
            Tap a report or SOS entry to see full details
          </p>
        )}

        {/* Pagination */}
        {(history?.totalPages ?? 0) > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Older</Button>
            <span className="text-xs text-slate-400">{page} / {history.totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= history.totalPages} onClick={() => setPage((p) => p + 1)}>Newer →</Button>
          </div>
        )}
      </div>

      {/* ── F. CTA ───────────────────────────────────────────────────────────── */}
      <div className="animate-fade-up pb-4" style={{ animationDelay: "180ms" }}>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-teal-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-800">Keep contributing</div>
            <div className="text-xs text-slate-500 mt-0.5">Each verified report earns 50 CityPoints toward your next reward.</div>
          </div>
          <Button size="sm" onClick={() => navigate("/report")} className="shrink-0">
            Report
          </Button>
        </div>
      </div>
    </div>

    {/* Event detail modal */}
    <EventDetailModal event={selectedEvent} onClose={handleCloseModal} />
  </>);
}