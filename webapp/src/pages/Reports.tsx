import { useEffect, useState } from "react";
import { getRevenueReport, getTaxSummaryReport } from "../api/client";
import { formatCurrency } from "../utils/format";

export default function Reports() {
  const [activeTab, setActiveTab] = useState<"revenue" | "tax">("revenue");
  const [revenue, setRevenue] = useState<any[]>([]);
  const [taxSummary, setTaxSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [revData, taxData] = await Promise.all([
        getRevenueReport().catch(() => ({ report: [] })),
        getTaxSummaryReport().catch(() => ({ report: [] })),
      ]);
      setRevenue(revData.report ?? []);
      setTaxSummary(taxData.report ?? []);
    } catch {
      setRevenue([]);
      setTaxSummary([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-20 text-slate-500">Loading reports...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Reports</h1>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("revenue")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "revenue"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Revenue Dashboard
        </button>
        <button
          onClick={() => setActiveTab("tax")}
          className={`px-4 py-2 text-sm font-medium ${
            activeTab === "tax"
              ? "text-primary-600 border-b-2 border-primary-600"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Tax Summary
        </button>
      </div>

      {activeTab === "revenue" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Revenue by Status</h3>
          {revenue.length === 0 ? (
            <p className="text-sm text-slate-500">No data yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">Status</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Count</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Total</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Paid</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((r) => (
                  <tr key={r.status} className="border-t border-slate-100">
                    <td className="py-2 text-sm text-slate-900">{r.status}</td>
                    <td className="py-2 text-right text-sm text-slate-600">{r.count}</td>
                    <td className="py-2 text-right text-sm text-slate-900">{formatCurrency(r.total_amount ?? 0, "USD")}</td>
                    <td className="py-2 text-right text-sm text-slate-900">{formatCurrency(r.paid_amount ?? 0, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "tax" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Tax Summary (Last 12 Months)</h3>
          {taxSummary.length === 0 ? (
            <p className="text-sm text-slate-500">No tax data yet</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-slate-500 uppercase py-2">Month</th>
                  <th className="text-right text-xs font-medium text-slate-500 uppercase py-2">Tax Collected</th>
                </tr>
              </thead>
              <tbody>
                {taxSummary.map((r) => (
                  <tr key={r.month} className="border-t border-slate-100">
                    <td className="py-2 text-sm text-slate-900">{r.month}</td>
                    <td className="py-2 text-right text-sm text-slate-900">{formatCurrency(r.tax_total ?? 0, "USD")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
