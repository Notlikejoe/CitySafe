import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function Modal({ open, onClose, title, children, size = "md" }) {
    const backdropRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e) => { if (e.key === "Escape") onClose?.(); };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    if (!open) return null;

    const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

    return (
        <div
            ref={backdropRef}
            className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center p-4 animate-fade-in"
            onClick={(e) => { if (e.target === backdropRef.current) onClose?.(); }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

            {/* Sheet */}
            <div className={`relative w-full ${widths[size]} bg-white rounded-3xl shadow-2xl animate-fade-up border border-slate-200`}>
                {/* Handle (mobile) */}
                <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />

                <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-slate-100 transition text-slate-500"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-5 pb-6 pt-2">{children}</div>
            </div>
        </div>
    );
}
