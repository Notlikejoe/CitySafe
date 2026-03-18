
const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 shadow-sm shadow-teal-600/20",
    secondary: "bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 active:bg-slate-100",
    ghost: "text-slate-700 hover:bg-slate-100 active:bg-slate-200",
    danger: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm shadow-red-600/20",
    emergency: "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/30",
};

const sizes = {
    sm: "px-3 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2.5 text-sm gap-2",
    lg: "px-6 py-3.5 text-base gap-2.5",
};

export function Button({
    children, variant = "primary", size = "md",
    className, disabled, loading, icon: Icon, ...props
}) {
    return (
        <button
            {...props}
            disabled={disabled || loading}
            className={[
                "inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                variants[variant],
                sizes[size],
                className,
            ].filter(Boolean).join(" ")}
        >
            {loading ? (
                <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
            ) : Icon ? (
                <Icon className="h-4 w-4 shrink-0" />
            ) : null}
            {children}
        </button>
    );
}
