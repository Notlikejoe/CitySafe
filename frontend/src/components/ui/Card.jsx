export function Card({ children, className = "", hover = false, ...props }) {
    return (
        <div
            {...props}
            className={[
                "bg-white rounded-2xl border border-slate-200 shadow-sm",
                hover && "hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer",
                className,
            ].filter(Boolean).join(" ")}
        >
            {children}
        </div>
    );
}
