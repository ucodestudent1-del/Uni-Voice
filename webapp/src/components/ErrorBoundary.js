import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
function isChunkLoadError(error) {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (message.includes("failed to fetch dynamically imported module") ||
            message.includes("loading chunk") ||
            message.includes("chunk") && message.includes("not found"));
    }
    return false;
}
export class ChunkErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, isChunkError: false };
    }
    static getDerivedStateFromError(error) {
        const isChunkError = isChunkLoadError(error);
        return { hasError: true, isChunkError };
    }
    componentDidCatch(error, errorInfo) {
        if (isChunkLoadError(error)) {
            if (typeof window !== "undefined" && window.location) {
                window.location.reload();
            }
        }
    }
    handleRefresh = () => {
        this.setState({ hasError: false, isChunkError: false });
        window.location.reload();
    };
    render() {
        if (this.state.hasError && this.state.isChunkError) {
            return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm", children: _jsxs("div", { className: "mx-auto max-w-md rounded-xl border border-error-border bg-error-bg p-6 shadow-lg", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx(AlertCircle, { className: "mt-0.5 h-5 w-5 shrink-0 text-error-text" }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-medium text-error-text", children: "Update Required" }), _jsx("p", { className: "mt-2 text-sm text-secondary leading-relaxed", children: "A new version of the application is available. Please refresh the page to load the latest version." })] })] }), _jsxs("div", { className: "mt-4 flex justify-end gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: this.handleRefresh, children: "Later" }), _jsx(Button, { variant: "primary", size: "sm", icon: _jsx(RefreshCw, { className: "h-4 w-4" }), onClick: this.handleRefresh, children: "Refresh Now" })] })] }) }));
        }
        if (this.state.hasError) {
            return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm", children: _jsxs("div", { className: "mx-auto max-w-md rounded-xl border border-error-border bg-error-bg p-6 shadow-lg", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx(AlertCircle, { className: "mt-0.5 h-5 w-5 shrink-0 text-error-text" }), _jsxs("div", { className: "flex-1", children: [_jsx("h3", { className: "text-lg font-medium text-error-text", children: "Something went wrong" }), _jsx("p", { className: "mt-2 text-sm text-secondary leading-relaxed", children: "An unexpected error occurred. Please refresh the page or contact support if the problem persists." })] })] }), _jsx("div", { className: "mt-4 flex justify-end", children: _jsx(Button, { variant: "primary", size: "sm", icon: _jsx(RefreshCw, { className: "h-4 w-4" }), onClick: this.handleRefresh, children: "Refresh" }) })] }) }));
        }
        return this.props.children;
    }
}
export default ChunkErrorBoundary;
