import { Component, type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ChunkErrorBoundaryProps {
	children: ReactNode;
}

interface ChunkErrorBoundaryState {
	hasError: boolean;
	isChunkError: boolean;
}

function isChunkLoadError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("failed to fetch dynamically imported module") ||
			message.includes("loading chunk") ||
			message.includes("chunk") && message.includes("not found")
		);
	}
	return false;
}

export class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, ChunkErrorBoundaryState> {
	constructor(props: ChunkErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, isChunkError: false };
	}

	static getDerivedStateFromError(error: unknown): Partial<ChunkErrorBoundaryState> | null {
		const isChunkError = isChunkLoadError(error);
		return { hasError: true, isChunkError };
	}

	componentDidCatch(error: unknown, errorInfo: { componentStack?: string }) {
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
			return (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
					<div className="mx-auto max-w-md rounded-xl border border-error-border bg-error-bg p-6 shadow-lg">
						<div className="flex items-start gap-4">
							<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error-text" />
							<div className="flex-1">
								<h3 className="text-lg font-medium text-error-text">Update Required</h3>
								<p className="mt-2 text-sm text-secondary leading-relaxed">
									A new version of the application is available. Please refresh the page to load the latest version.
								</p>
							</div>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<Button variant="ghost" size="sm" onClick={this.handleRefresh}>
								Later
							</Button>
							<Button variant="primary" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={this.handleRefresh}>
								Refresh Now
							</Button>
						</div>
					</div>
				</div>
			);
		}

		if (this.state.hasError) {
			return (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm">
					<div className="mx-auto max-w-md rounded-xl border border-error-border bg-error-bg p-6 shadow-lg">
						<div className="flex items-start gap-4">
							<AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-error-text" />
							<div className="flex-1">
								<h3 className="text-lg font-medium text-error-text">Something went wrong</h3>
								<p className="mt-2 text-sm text-secondary leading-relaxed">
									An unexpected error occurred. Please refresh the page or contact support if the problem persists.
								</p>
							</div>
						</div>
						<div className="mt-4 flex justify-end">
							<Button variant="primary" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={this.handleRefresh}>
								Refresh
							</Button>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ChunkErrorBoundary;
