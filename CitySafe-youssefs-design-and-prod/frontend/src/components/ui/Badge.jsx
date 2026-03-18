const STATUS_CONFIG = {
    // Report statuses
    submitted: { label: "Submitted", cls: "bg-sky-100 text-sky-700 border-sky-200" },
    under_review: { label: "Under Review", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    verified: { label: "Verified", cls: "bg-teal-100 text-teal-700 border-teal-200" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" },
    resolved: { label: "Resolved", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    // SOS statuses
    pending: { label: "Pending", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    accepted: { label: "Accepted", cls: "bg-sky-100 text-sky-700 border-sky-200" },
    in_progress: { label: "In Progress", cls: "bg-teal-100 text-teal-700 border-teal-200" },
    cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500 border-slate-200" },
    // Alert priorities
    low: { label: "Low", cls: "bg-slate-100 text-slate-600 border-slate-200" },
    medium: { label: "Medium", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    high: { label: "High", cls: "bg-orange-100 text-orange-700 border-orange-200" },
    emergency: { label: "Emergency", cls: "bg-red-100 text-red-700 border-red-200" },
};

export function Badge({ status, label, className = "" }) {
    const cfg = STATUS_CONFIG[status] ?? { label: label ?? status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls} ${className}`}>
            {label ?? cfg.label}
        </span>
    );
}
