import { Button } from "./Button";

export function EmptyState({ icon: Icon, heading, body, actionLabel, onAction }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 animate-fade-up">
            {Icon && (
                <div className="mb-4 h-14 w-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-500">
                    <Icon className="h-7 w-7" />
                </div>
            )}
            <h3 className="text-base font-semibold text-slate-800">{heading}</h3>
            {body && <p className="mt-1 text-sm text-slate-500 max-w-xs">{body}</p>}
            {actionLabel && onAction && (
                <Button className="mt-5" onClick={onAction}>{actionLabel}</Button>
            )}
        </div>
    );
}
