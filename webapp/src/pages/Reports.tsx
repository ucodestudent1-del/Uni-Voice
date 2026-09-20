import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { getRevenueReport, getTaxSummaryReport } from "../api/client";
import { formatCurrency } from "../utils/format";
import { Button } from "../components/ui/Button";

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reports</h1>
        <Button
          variant="primary"
          size="md"
          icon={<Download className="w-4 h-4" />}
          onClick={() => {
            const csvContent = "Report data export coming soon";
            const blob = new Blob([csvContent], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "reports-export.csv";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export Report
        </Button>
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <Button
          variant={activeTab === "revenue" ? "primary" : "ghost"}
          size="sm"
          className="pb-2 border-b-2 border-transparent"
          style={{
            borderBottomColor: activeTab === "revenue" ? "#0284c7" : "transparent",
          }}
          onClick={() => setActiveTab("revenue")}
        >
          Revenue Dashboard
        </Button>
        <Button
          variant={activeTab === "tax" ? "primary" : "ghost"}
          size="sm"
          className="pb-2 border-b-2 border-transparent"
          style={{
            borderBottomColor: activeTab === "tax" ? "#0284c7" : "transparent",
          }}
          onClick={() => setActiveTab("tax")}
        >
          Tax Summary
        </Button>
      </div>

      {activeTab === "revenue" && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Revenue by Status</h3>
          {revenue.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No revenue data yet</p>
              <Button
                variant="primary"
                size="md"
                icon={<Download className="w-4 h-4" />}
                onClick={() => {}}
                className="mt-4"
              >
                Generate First Report
              </Button>
            </div>
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
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Tax Summary (Last 12 Months)</h3>
          {taxSummary.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No tax data yet</p>
              <Button
                variant="primary"
                size="md"
                icon={<Download className="w-4 h-4" />}
                onClick={() => {}}
                className="mt-4"
              >
                Export Tax Summary
              </Button>
            </div>
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
