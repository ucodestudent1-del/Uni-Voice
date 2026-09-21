import { useState, useRef } from "react";
import { importCustomers } from "../api/client";

interface CustomerImportProps {
  onClose: () => void;
  onImported: () => void;
}

const SAMPLE_CSV_HEADER = `name,email,company,phone,tax_id,address_line_1,city,state_or_region,postal_code,country_code`;

export default function CustomerImport({ onClose, onImported }: CustomerImportProps) {
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsv((ev.target?.result as string) || "");
      setError(null);
      setResult(null);
    };
    reader.readAsText(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!csv.trim()) {
      setError("Please paste CSV data or upload a file");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await importCustomers(csv);
      setResult({
        imported: res.imported ?? 0,
        skipped: res.skipped ?? 0,
        errors: res.errors ?? [],
      });
      onImported();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to import customers");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 overflow-y-auto py-8">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-3xl mx-4 my-8">
        <div className="p-6 border-b border-color-subtle">
          <h3 className="text-lg font-semibold text-primary">Import Customers</h3>
          <p className="text-sm text-secondary mt-1">
            Upload a CSV file or paste CSV data below. Required: a "name" column.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 status-error-bg border status-error-border rounded-lg">
              <p className="text-sm status-error-text">{error}</p>
            </div>
          )}

          {!result ? (
            <>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Upload CSV File</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="w-full text-sm text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-action file:text-on-primary hover:file:bg-primary-hover"
                />
              </div>

              <div className="text-center text-sm text-secondary my-3">— or —</div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Paste CSV Data</label>
                <textarea
                  rows={10}
                  value={csv}
                  onChange={(e) => { setCsv(e.target.value); setError(null); }}
                  className="w-full rounded-lg border border-input-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                  placeholder="Paste CSV data here..."
                />
              </div>

              <details className="bg-surface-alt rounded-lg p-3">
                <summary className="text-sm text-secondary cursor-pointer">Show CSV format</summary>
                <pre className="mt-2 text-xs text-secondary whitespace-pre-wrap overflow-x-auto">
                  {SAMPLE_CSV_HEADER}
                </pre>
              </details>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-surface-alt p-4">
                <p className="text-sm text-primary">
                  <span className="font-medium">{result.imported}</span> customers imported successfully
                </p>
                {result.skipped > 0 && (
                  <p className="text-sm text-secondary mt-1">
                    <span className="font-medium">{result.skipped}</span> rows skipped
                  </p>
                )}
              </div>
              {result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-secondary">Errors:</p>
                  <ul className="mt-1 space-y-1">
                    {result.errors.map((e, idx) => (
                      <li key={idx} className="text-xs status-error-text">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-color-subtle flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-input-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-alt"
          >
            Close
          </button>
          {!result && (
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || !csv.trim()}
              className="rounded-lg bg-primary-action px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import Customers"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}




