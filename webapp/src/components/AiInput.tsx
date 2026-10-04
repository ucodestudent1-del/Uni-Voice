import { useState, useCallback } from "react";
import { Sparkles, X, Check, AlertCircle } from "lucide-react";
import { parseDocument, type ApiParsedDocumentResult } from "../api/client";
import { useAnalytics } from "../hooks/useAnalytics";

export interface AiInputProps {
  onParsed: (result: ApiParsedDocumentResult) => void;
  onClear?: () => void;
  hasParsedData?: boolean;
}

export function AiInput({ onParsed, onClear, hasParsedData }: AiInputProps) {
  const [text, setText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [result, setResult] = useState<ApiParsedDocumentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { trackAiParseAttempted, trackAiParseSuccess, trackAiParseFailed } = useAnalytics();

  const handleParse = useCallback(async () => {
    if (!text.trim()) return;

    setIsParsing(true);
    setError(null);
    trackAiParseAttempted({ textLength: text.length });

    try {
      const parsed = await parseDocument(text.trim(), "invoice");
      setResult(parsed);
      onParsed(parsed);
      trackAiParseSuccess({
        confidence: parsed.confidence,
        itemsCount: parsed.fields.items.length,
        feesCount: parsed.fields.fees.length,
        matchedCustomer: !!parsed.matchedCustomer,
        matchedProducts: parsed.matchedProducts.length,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error || (err as Error)?.message || "Failed to parse text";
      setError(msg);
      trackAiParseFailed({ error: msg });
    } finally {
      setIsParsing(false);
    }
  }, [text, onParsed, trackAiParseAttempted, trackAiParseSuccess, trackAiParseFailed]);

  const handleClear = useCallback(() => {
    setText("");
    setResult(null);
    setError(null);
    onClear?.();
  }, [onClear]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (error) setError(null);
    if (isParsing) return;
    if (result && e.target.value.trim() !== text.trim()) {
      setResult(null);
    }
  };

  const showSuccess = result && !isParsing;
  const displayClass = showSuccess
    ? "border-success-border bg-success-bg/30"
    : error
      ? "border-error-border bg-error-bg/30"
      : "border-input-border focus-within:border-primary-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary-brand" />
        <h3 className="font-semibold text-primary">AI Quick Entry</h3>
        {hasParsedData && onClear && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-auto rounded p-1 text-secondary hover:bg-hover hover:text-primary"
            aria-label="Clear AI input"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <p className="text-sm text-secondary">
        Describe the work in plain English, e.g. "5 hours consulting at $100/hr for Acme Corp"
      </p>

      <div className={`relative rounded-lg border ${displayClass} transition-colors`}>
        <textarea
          value={text}
          onChange={handleTextareaChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !isParsing && text.trim()) {
              e.preventDefault();
              void handleParse();
            }
          }}
          placeholder="Type what you did, who for, and the price..."
          rows={3}
          className="w-full resize-none border-0 bg-transparent px-4 py-3 text-sm text-primary placeholder-secondary focus:outline-none"
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-secondary">
          {isParsing && <span className="animate-pulse">Thinking...</span>}
          {result && (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="h-4 w-4" />
              Parsed
            </span>
          )}
          {error && (
            <span className="inline-flex items-center gap-1 text-error-text">
              <AlertCircle className="h-4 w-4" />
              Failed
            </span>
          )}
        </div>
      </div>

      {!result && !error && (
        <button
          type="button"
          onClick={() => void handleParse()}
          disabled={isParsing || !text.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-action px-4 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isParsing ? (
            <>
              <Sparkles className="h-4 w-4 animate-spin" />
              Parsing...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Parse with AI (Ctrl+Enter)
            </>
          )}
        </button>
      )}

      {error && (
        <div className="rounded-lg border border-error-border bg-error-bg/30 px-3 py-2 text-sm text-error-text">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {result.matchedCustomer && (
              <div>
                <span className="text-secondary">Customer</span>
                <div className="font-medium text-primary">{result.matchedCustomer.name}</div>
                {result.matchedCustomer.email && <div className="text-secondary">{result.matchedCustomer.email}</div>}
              </div>
            )}
            <div>
              <span className="text-secondary">Confidence</span>
              <div className="font-medium text-primary">{Math.round(result.confidence * 100)}%</div>
            </div>
            <div>
              <span className="text-secondary">Items parsed</span>
              <div className="font-medium text-primary">{result.fields.items.length}</div>
            </div>
            <div>
              <span className="text-secondary">Fees parsed</span>
              <div className="font-medium text-primary">{result.fields.fees.length}</div>
            </div>
          </div>

          {result.fields.items.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-medium text-secondary">Line items:</span>
              {result.fields.items.map((item, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-primary">{item.quantity}x</span>
                  {" "}
                  <span className="text-secondary">{item.description}</span>
                  {" "}
                  <span className="text-secondary">at ${item.unitPrice.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {result.suggestions.length > 0 && (
            <div className="space-y-1">
              {result.suggestions.map((suggestion, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-secondary">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                  <span>{suggestion}</span>
                </div>
              ))}
            </div>
          )}

          {!result.fields.customerId && (
            <div className="rounded-lg border border-warning-border bg-warning-bg/30 px-3 py-2 text-sm text-warning">
              No customer matched — please select one manually.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
