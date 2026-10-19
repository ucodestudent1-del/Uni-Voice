export async function initSentry(): Promise<void> {
	const dsn = import.meta.env.VITE_SENTRY_DSN;

	if (!dsn) {
		if (import.meta.env.MODE === "development") {
			console.debug("Sentry DSN not configured — error tracking disabled");
		}
		return;
	}

	const Sentry = await import("@sentry/react");

	Sentry.init({
		dsn,
		integrations: [
			Sentry.browserTracingIntegration(),
			Sentry.replayIntegration({
				maskAllText: true,
				blockAllMedia: true,
			}),
		],
		tracesSampleRate: import.meta.env.MODE === "production" ? 0.1 : 1.0,
		replaysSessionSampleRate: 0.1,
		replaysOnErrorSampleRate: 0.5,
		environment: import.meta.env.MODE,
		beforeSend(event, hint) {
			const originalException = hint?.originalException;
			if (originalException && originalException instanceof Error) {
				const msg = originalException.message;
				if (
					msg.includes("cancelled") ||
					msg.includes("aborted") ||
					msg.includes("NetworkError")
				) {
					return null;
				}
			}
			return event;
		},
	});
}
