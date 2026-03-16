import { Component } from "react";
import { Siren, RefreshCw } from "lucide-react";

/**
 * Global React Error Boundary.
 *
 * Catches any render-phase crash in child components and displays a
 * graceful degradation screen. The SOS button is always visible even
 * when the rest of the app has crashed, guaranteeing emergency access.
 */
export class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
    }

    handleReload = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
                <div className="bg-white border border-slate-200 rounded-3xl shadow-xl p-10 max-w-md w-full">
                    {/* Icon */}
                    <div className="h-16 w-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
                        <span className="text-3xl">⚠️</span>
                    </div>

                    <h1 className="text-xl font-bold text-slate-900 mb-2">
                        Something went wrong
                    </h1>
                    <p className="text-sm text-slate-500 mb-6">
                        Part of the app crashed unexpectedly. Your data is safe.
                        You can still use the SOS button below in an emergency.
                    </p>

                    {/* Error detail (dev only) */}
                    {import.meta.env.DEV && this.state.error && (
                        <pre className="text-left text-xs bg-slate-100 rounded-xl p-3 mb-6 overflow-auto text-red-600 max-h-32">
                            {this.state.error.message}
                        </pre>
                    )}

                    <div className="flex flex-col gap-3">
                        {/* Reload */}
                        <button
                            onClick={this.handleReload}
                            className="inline-flex items-center justify-center gap-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Reload app
                        </button>

                        {/* SOS — always accessible */}
                        <a
                            href="/sos"
                            className="inline-flex items-center justify-center gap-2 w-full rounded-2xl bg-red-600 text-white px-4 py-3 text-sm font-bold shadow-lg shadow-red-600/25 hover:bg-red-700 transition"
                        >
                            <Siren className="h-5 w-5" />
                            Emergency SOS
                        </a>
                    </div>
                </div>
            </div>
        );
    }
}
