import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search, FileWarning, Siren, Bell, MapPin, ExternalLink,
  AlertCircle, Loader2, ChevronRight,
} from "lucide-react";
import apiClient from "../lib/apiClient";

// ── Kind metadata ─────────────────────────────────────────────────────────────
const KIND_META = {
  report: { label: "Report",  Icon: FileWarning, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  sos:    { label: "SOS",     Icon: Siren,       color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200"    },
  alert:  { label: "Alert",   Icon: Bell,        color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-200" },
};

const STATUS_COLORS = {
  under_review: "text-orange-600 bg-orange-50 border-orange-200",
  verified:     "text-teal-600  bg-teal-50   border-teal-200",
  resolved:     "text-indigo-600 bg-indigo-50 border-indigo-200",
  cancelled:    "text-slate-500 bg-slate-100 border-slate-200",
  rejected:     "text-red-500   bg-red-50    border-red-200",
  pending:      "text-yellow-600 bg-yellow-50 border-yellow-200",
  high:         "text-red-600   bg-red-50    border-red-200",
  medium:       "text-orange-600 bg-orange-50 border-orange-200",
  low:          "text-slate-500 bg-slate-100 border-slate-200",
};

// ── Single result card ────────────────────────────────────────────────────────
function ResultCard({ item }) {
  const meta = KIND_META[item.kind] ?? KIND_META.report;
  const { Icon } = meta;

  const mapsUrl = item.location?.lat
    ? `https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lon ?? item.location.lng}`
    : null;

  const timeAgo = (() => {
    const diff = Date.now() - new Date(item.createdAt).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  })();

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 hover:border-slate-300 hover:shadow-sm transition-all">
      {/* Kind icon */}
      <div className={`mt-0.5 h-9 w-9 rounded-xl border ${meta.border} ${meta.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`h-4.5 w-4.5 ${meta.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-bold uppercase tracking-widest ${meta.color}`}>{meta.label}</span>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-[11px] text-slate-400 capitalize">{item.subTitle}</span>
        </div>
        <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{item.title || "—"}</p>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {/* Status badge */}
          <span className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wide border px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] ?? "text-slate-500 bg-slate-50 border-slate-200"}`}>
            {(item.status ?? "unknown").replace(/_/g, " ")}
          </span>
          {/* Time  */}
          <span className="text-xs text-slate-400">{timeAgo}</span>
          {/* Maps link */}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-semibold transition-colors"
            >
              <MapPin className="h-3 w-3" />
              Navigate
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Search input (controlled, query-param driven) ─────────────────────────────
function SearchInput({ value, onChange }) {
  return (
    <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-100 transition-all">
      <Search className="h-4 w-4 text-slate-400 shrink-0" />
      <input
        autoFocus
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search reports, SOS requests, alerts…"
        className="flex-1 bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
      />
    </label>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialQ = searchParams.get("q") ?? "";
  const [inputVal, setInputVal] = useState(initialQ);

  // Debounce: update URL params 400ms after user stops typing
  const handleChange = (val) => {
    setInputVal(val);
    const id = setTimeout(() => {
      if (val.trim().length >= 2) {
        setSearchParams({ q: val.trim() }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }, 400);
    return () => clearTimeout(id);
  };

  const q = searchParams.get("q") ?? "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["search", q],
    queryFn: () => apiClient.get("/search", { params: { q } }).then((r) => r.data ?? r),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-3 transition-colors"
        >
          <ChevronRight className="h-3 w-3 rotate-180" /> Back
        </button>
        <h1 className="text-2xl font-extrabold text-slate-900">Search</h1>
        <p className="text-sm text-slate-500 mt-1">Search across reports, SOS requests, and alerts</p>
      </div>

      {/* Search input */}
      <SearchInput value={inputVal} onChange={handleChange} />

      {/* Results area */}
      <div className="mt-5">
        {/* Loading */}
        {isLoading && q.length >= 2 && (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Searching…</span>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Search failed. Please try again.
          </div>
        )}

        {/* Empty states */}
        {!isLoading && q.length >= 2 && items.length === 0 && !isError && (
          <div className="text-center py-12">
            <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">No results for "{q}"</p>
            <p className="text-slate-400 text-sm mt-1">Try a different keyword or broaden your search.</p>
          </div>
        )}

        {q.length < 2 && !isLoading && (
          <div className="text-center py-12">
            <Search className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Type at least 2 characters to search.</p>
          </div>
        )}

        {/* Results */}
        {items.length > 0 && (
          <>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-widest mb-3">
              {total} result{total !== 1 ? "s" : ""} for "{q}"
            </p>
            <div className="space-y-2">
              {items.map((item) => <ResultCard key={`${item.kind}-${item.id}`} item={item} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
