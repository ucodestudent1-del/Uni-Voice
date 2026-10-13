import { cn } from "@/lib/utils";
import { formatDateLong } from "@/utils/format";
import { CreditCard, FileText, Send, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import type { ApiCreditNoteEvent } from "@/types/api";
import { Decimal } from "decimal.js";

interface CreditNoteActivityTimelineProps {
  events: ApiCreditNoteEvent[];
  className?: string;
}

const EVENT_CONFIG: Record<string, {
  label: string;
  color: string;
  icon: typeof FileText;
}> = {
  credit_note_created: {
    label: "Created",
    color: "text-tertiary",
    icon: FileText,
  },
  credit_note_finalized: {
    label: "Finalized",
    color: "text-info-text",
    icon: CheckCircle,
  },
  credit_note_sent: {
    label: "Sent",
    color: "text-info-text",
    icon: Send,
  },
  credit_note_applied: {
    label: "Applied",
    color: "text-success-text",
    icon: CreditCard,
  },
  credit_note_cancelled: {
    label: "Cancelled",
    color: "text-tertiary",
    icon: XCircle,
  },
  credit_note_voided: {
    label: "Voided",
    color: "text-error-text",
    icon: AlertCircle,
  },
};

type EventIcon = (props: { className?: string }) => JSX.Element | null;

const DEFAULT_ICON: EventIcon = (props) => <Clock className={props.className} />;

export default function CreditNoteActivityTimeline({
  events,
  className,
}: CreditNoteActivityTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <Clock className="h-8 w-8 mx-auto mb-3 text-tertiary opacity-30" />
        <p className="text-sm text-secondary">No activity recorded yet.</p>
      </div>
    );
  }

  const getEventDisplay = (event: ApiCreditNoteEvent): {
    label: string;
    color: string;
    Icon: EventIcon;
    details?: string;
  } => {
    const config = EVENT_CONFIG[event.event_type] ?? {
      label: event.event_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      color: "text-tertiary",
      icon: DEFAULT_ICON,
    };

    let details: string | undefined;
    const metadata = event.metadata ?? {};

    if (event.event_type === "credit_note_applied") {
      const amount = new Decimal(String(metadata.amount ?? "0"));
      const invoice = metadata.invoice_id
        ? ` to invoice ${metadata.invoice_number ?? metadata.invoice_id}`
        : "";
      details = `Applied $${amount.toFixed(2)}${invoice}`;
    } else if (event.event_type === "credit_note_finalized") {
      const num = metadata.credit_note_number;
      if (num) details = `Number: ${num}`;
    } else if (event.event_type === "credit_note_sent") {
      if (metadata.recipient) details = `To: ${metadata.recipient}`;
    } else if (event.event_type === "credit_note_cancelled") {
      if (metadata.reason) details = `Reason: ${metadata.reason}`;
    } else if (event.event_type === "credit_note_voided") {
      if (metadata.reason) details = `Reason: ${metadata.reason}`;
    }

    return {
      label: config.label,
      color: config.color,
      Icon: config.icon as unknown as EventIcon,
      details,
    };
  };

  return (
    <div className={cn("space-y-4", className)} aria-label="Credit note activity timeline">
      {events.map((event) => {
        const display = getEventDisplay(event);
        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
              <div className={cn("rounded-full bg-surface-alt border border-color p-1", display.color)}>
                <display.Icon className="h-3 w-3" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("text-sm font-medium", display.color)}>
                  {display.label}
                </span>
                <span className="text-xs text-tertiary">
                  {formatDateLong(event.created_at)}
                </span>
                {event.actor_type === "user" && event.actor_id && (
                  <span className="text-xs text-tertiary">
                    by user
                  </span>
                )}
              </div>
              {display.details && (
                <p className="text-xs text-secondary mt-0.5">
                  {display.details}
                </p>
              )}
              {event.metadata?.method ? (
                <p className="text-xs text-tertiary mt-0.5">
                  Method: {String(event.metadata.method)}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
