import { useState, useEffect } from "react";
import type { ValidationIssue } from "../hooks/useInvoiceValidation";

export interface ValidationPanelProps {
  issues: ValidationIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  className?: string;
  onFix?: (issue: ValidationIssue) => void;
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z"
      />
    </svg>
  );
}

function WarningTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75A9 9 0 111.5 12a9 9 0 0115-7.5zM12 7.5v3.75m0 0H12m0 0l-.75.75v3l.75.75h.75l.75-.75V11.25L12 10.5m0 0V7.5z"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

export function ValidationPanel({ issues, hasErrors, hasWarnings, className, onFix }: ValidationPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  useEffect(() => {
    if (errorCount > 0) {
      setExpanded(true);
    }
  }, [errorCount, issues]);

  if (issues.length === 0) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700 ${className ?? ""}`}
        role="status"
        aria-live="polite"
      >
        <CheckCircleIcon className="h-4 w-4 text-green-600" />
        <span>All checks passed</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white ${className ?? ""}`}
      role="alert"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          {hasErrors ? (
            <XCircleIcon className="h-4 w-4 text-red-600" />
          ) : (
            <WarningTriangleIcon className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm font-medium text-slate-900">
            {hasErrors ? "Issues require attention" : "Suggestions to improve your invoice"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          <ChevronDownIcon
            className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {expanded && (
        <ul className="space-y-1 px-3 pb-2" role="list">
          {issues.map((issue, i) => (
            <li
              key={`${issue.code}-${i}`}
              className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm ${
                issue.severity === "error"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50"
              }`}
            >
              <span className="mt-0.25 flex-shrink-0 text-base" aria-hidden="true">
                {issue.severity === "error" ? (
                  <XCircleIcon className="h-4 w-4 text-red-600" />
                ) : (
                  <WarningTriangleIcon className="h-4 w-4 text-amber-500" />
                )}
              </span>
              <div className="flex-1">
                <p className="text-slate-900">{issue.message}</p>
                {issue.field && (
                  <p className="text-xs text-slate-500">Field: {issue.field}</p>
                )}
                {issue.fix && onFix && (
                  <button
                    type="button"
                    onClick={() => onFix(issue)}
                    className="mt-1 text-xs font-medium text-slate-600 underline hover:text-slate-800"
                  >
                    Fix: {issue.fix}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ValidationPanel;
