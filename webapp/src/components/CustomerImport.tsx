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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 my-8">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Import Customers</h3>
          <p className="text-sm text-slate-600 mt-1">
            Upload a CSV file or paste CSV data below. Required: a "name" column.
          </p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!result ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Upload CSV File</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                />
              </div>

              <div className="text-center text-sm text-slate-500 my-3">— or —</div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Paste CSV Data</label>
                <textarea
                  rows={10}
                  value={csv}
                  onChange={(e) => { setCsv(e.target.value); setError(null); }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  placeholder="Paste CSV data here..."
                />
              </div>

              <details className="bg-slate-50 rounded-lg p-3">
                <summary className="text-sm text-slate-600 cursor-pointer">Show CSV format</summary>
                <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap overflow-x-auto">
                  {SAMPLE_CSV_HEADER}
                </pre>
              </details>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-sm text-slate-900">
                  <span className="font-medium">{result.imported}</span> customers imported successfully
                </p>
                {result.skipped > 0 && (
                  <p className="text-sm text-slate-600 mt-1">
                    <span className="font-medium">{result.skipped}</span> rows skipped
                  </p>
                )}
              </div>
              {result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700">Errors:</p>
                  <ul className="mt-1 space-y-1">
                    {result.errors.map((e, idx) => (
                      <li key={idx} className="text-xs text-red-600">{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
          {!result && (
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading || !csv.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import Customers"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
