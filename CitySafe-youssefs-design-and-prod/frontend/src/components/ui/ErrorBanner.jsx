import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./Button";

export function ErrorBanner({ message, onRetry }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 animate-fade-up">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800">Something went wrong</p>
                <p className="text-xs text-red-600 mt-0.5">{message ?? "Please try again or check your connection."}</p>
            </div>
            {onRetry && (
                <Button variant="ghost" size="sm" icon={RefreshCw} onClick={onRetry} className="text-red-700 hover:bg-red-100">
                    Retry
                </Button>
            )}
        </div>
    );
}
