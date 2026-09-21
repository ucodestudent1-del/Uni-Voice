import { useState, useEffect } from "react";
import type { ValidationIssue } from "../hooks/useInvoiceValidation";

export interface ValidationPanelProps {
  issues: ValidationIssue[];
  hasErrors: boolean;
  hasWarnings: boolean;
  className?: string;
  onFix?: (issue: ValidationIssue) => void;
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
        className={`flex items-center gap-2 rounded-lg status-success-bg border status-success-border px-3 py-2 text-sm status-success-text ${className ?? ""}`}
        role="status"
        aria-live="polite"
      >
        <span className="status-success-text">✓</span>
        <span>All checks passed</span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-color-subtle bg-surface ${className ?? ""}`}
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
            <span className="status-error-text">✕</span>
          ) : (
            <span className="status-warning-text">⚠</span>
          )}
          <span className="text-sm font-medium text-primary">
            {hasErrors ? "Issues require attention" : "Suggestions to improve your invoice"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {errorCount > 0 && (
            <span className="inline-flex items-center rounded-full status-error-bg px-2 py-0.5 text-xs font-medium status-error-text">
              {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center rounded-full status-warning-bg px-2 py-0.5 text-xs font-medium status-warning-text">
              {warningCount} warning{warningCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className={`text-sm text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </button>

      {expanded && (
        <ul className="space-y-1 px-3 pb-2" role="list">
          {issues.map((issue, i) => (
            <li
              key={`${issue.code}-${i}`}
              className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-sm ${
                issue.severity === "error"
                  ? "status-error-border status-error-bg"
                  : "status-warning-border status-warning-bg"
              }`}
            >
              <span className="mt-0.25 flex-shrink-0 text-base" aria-hidden="true">
                {issue.severity === "error" ? (
                  <span className="status-error-text">✕</span>
                ) : (
                  <span className="status-warning-text">⚠</span>
                )}
              </span>
              <div className="flex-1">
                <p className="text-primary">{issue.message}</p>
                {issue.field && (
                  <p className="text-xs text-secondary">Field: {issue.field}</p>
                )}
                {issue.fix && onFix && (
                  <button
                    type="button"
                    onClick={() => onFix(issue)}
                    className="mt-1 text-xs font-medium text-secondary underline hover:text-primary"
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





