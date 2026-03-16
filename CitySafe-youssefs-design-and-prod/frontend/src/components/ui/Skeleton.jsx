export function Skeleton({ className = "", ...props }) {
    return <div className={`skeleton ${className}`} {...props} />;
}

export function CardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div className="flex gap-3 items-center">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
        </div>
    );
}

export function ListSkeleton({ count = 3 }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: count }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
    );
}
