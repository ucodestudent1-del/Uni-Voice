import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getInvoiceEvents } from "../../api/client";
import { formatDate } from "../../utils/format";
import SectionCard from "../SectionCard";
import type { ApiInvoiceEvent } from "../../types/api";

interface RecentActivityProps {
  eventLimit?: number;
}

const eventColors: Record<string, string> = {
  payment_received: "bg-green-500",
  invoice_sent: "bg-blue-500",
  invoice_viewed: "bg-indigo-500",
  reminder_sent: "bg-amber-500",
  invoice_created: "bg-primary-500",
  invoice_overdue: "bg-red-500",
};

const eventLabels: Record<string, string> = {
  payment_received: "Payment received",
  invoice_sent: "Invoice sent",
  invoice_viewed: "Invoice viewed",
  reminder_sent: "Reminder sent",
  invoice_created: "Invoice created",
  invoice_overdue: "Invoice overdue",
};

const eventIcons: Record<string, string> = {
  payment_received: "$",
  invoice_sent: "→",
  invoice_viewed: "◉",
  reminder_sent: "!",
  invoice_created: "+",
  invoice_overdue: "⚠",
};

type ParsedEvent = ApiInvoiceEvent & { _relativeTime: string };

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(dateStr);
}

export default function RecentActivity({ eventLimit = 8 }: RecentActivityProps) {
  const [events, setEvents] = useState<ParsedEvent[]>([]);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const res = await getInvoiceEvents("recent");
      const data = (res.data as any).events ?? (res.data as any).data ?? [];
      setEvents(data.slice(0, eventLimit).map((e: ApiInvoiceEvent) => ({ ...e, _relativeTime: relativeTime(e.created_at) })));
    } catch {
      setEvents([]);
    }
  }

  if (events.length === 0) {
    return (
      <SectionCard title="Recent Activity">
        <div className="py-8 text-center text-sm text-slate-400">
          <p>No recent activity</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Recent Activity">
      <div className="relative">
        <div className="absolute left-[5px] top-4 w-px h-full bg-slate-200" aria-hidden="true" />
        <div className="space-y-0">
          {events.map((evt) => {
            const metadata = evt.metadata as Record<string, string | undefined | null>;
            const color = eventColors[evt.event_type] || "bg-primary-500";
            const label = eventLabels[evt.event_type] || evt.event_type;
            const icon = eventIcons[evt.event_type] || "•";
            return (
              <div key={evt.id} className="relative flex items-start gap-3 py-3 border-b border-slate-100 last:border-b-0">
                <div
                  className={`relative z-10 w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${color}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-slate-700 truncate">
                      <span className="inline-flex items-center gap-1.5 mr-1">
                        <span className="text-xs font-mono opacity-60">{icon}</span>
                        {label}
                      </span>
                      {metadata.invoice_number ? (
                        <Link
                          to={`/app/invoices/${metadata.invoice_id ?? ""}`}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {metadata.invoice_number}
                        </Link>
                      ) : (
                        <span className="text-slate-500"> — {evt.event_type}</span>
                      )}
                    </p>
                    <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">{evt._relativeTime}</span>
                  </div>
                  {metadata.amount && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {metadata.currency ? `${metadata.currency} ` : ""}{metadata.amount}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
