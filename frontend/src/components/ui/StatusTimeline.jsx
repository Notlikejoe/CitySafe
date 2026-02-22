import { Check, Clock, AlertTriangle, XCircle, ShieldCheck } from "lucide-react";

const STATUS_META = {
    submitted: { Icon: Clock, color: "text-sky-500", bg: "bg-sky-50", border: "border-sky-200", label: "Submitted" },
    under_review: { Icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200", label: "Under Review" },
    verified: { Icon: ShieldCheck, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", label: "Verified" },
    rejected: { Icon: XCircle, color: "text-red-500", bg: "bg-red-50", border: "border-red-200", label: "Rejected" },
    resolved: { Icon: Check, color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200", label: "Resolved" },
    pending: { Icon: Clock, color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-200", label: "Pending" },
    accepted: { Icon: Check, color: "text-sky-500", bg: "bg-sky-50", border: "border-sky-200", label: "Accepted" },
    in_progress: { Icon: ShieldCheck, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-200", label: "In Progress" },
    cancelled: { Icon: XCircle, color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-200", label: "Cancelled" },
};

export function StatusTimeline({ history = [] }) {
    if (!history.length) return null;
    return (
        <div className="space-y-0">
            {history.map((entry, i) => {
                const meta = STATUS_META[entry.to] ?? { Icon: Clock, color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200", label: entry.to };
                const { Icon } = meta;
                const isLast = i === history.length - 1;
                return (
                    <div key={i} className="flex gap-3">
                        {/* Dot + line */}
                        <div className="flex flex-col items-center">
                            <div className={`h-7 w-7 rounded-full border ${meta.border} ${meta.bg} flex items-center justify-center shrink-0`}>
                                <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                            </div>
                            {!isLast && <div className="w-px flex-1 bg-slate-200 my-1" />}
                        </div>
                        {/* Content */}
                        <div className={`pb-4 min-w-0 ${isLast ? "" : ""}`}>
                            <div className="text-sm font-medium text-slate-800">{meta.label}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                                {new Date(entry.at).toLocaleString()} · by {entry.by}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
