import { useState } from "react";

interface Expense {
  id: string;
  description: string;
  amount: string;
  category: string;
  date: string;
  receipt?: string;
}

const MOCK_EXPENSES: Expense[] = [
  { id: "1", description: "Office supplies", amount: "45.99", category: "Supplies", date: "2026-09-01" },
  { id: "2", description: "Software subscription", amount: "29.00", category: "Software", date: "2026-09-03" },
  { id: "3", description: "Business lunch", amount: "67.50", category: "Meals", date: "2026-09-05" },
];

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>(MOCK_EXPENSES);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Expense>>({});

  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount || "0"), 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newExpense: Expense = {
      id: Math.random().toString(36).slice(2),
      description: formData.description || "",
      amount: formData.amount || "0.00",
      category: formData.category || "Other",
      date: formData.date || new Date().toISOString().split("T")[0],
    };
    setExpenses([...expenses, newExpense]);
    setShowForm(false);
    setFormData({});
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + Add Expense
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">${total.toFixed(2)}</p>
          <p className="text-sm text-slate-600">Total Expenses</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{expenses.length}</p>
          <p className="text-sm text-slate-600">Expenses</p>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add Expense</h3>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description ?? ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount ?? ""}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category ?? "Other"}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option>Supplies</option>
                  <option>Software</option>
                  <option>Meals</option>
                  <option>Travel</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date ?? ""}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </form>
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={(e) => handleSubmit(e)}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Description</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase py-3 px-4">Category</th>
              <th className="text-right text-xs font-medium text-slate-500 uppercase py-3 px-4">Amount</th>
              <th className="text-center text-xs font-medium text-slate-500 uppercase py-3 px-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((exp) => (
              <tr key={exp.id} className="border-b border-slate-100 last:border-b-0">
                <td className="py-3 px-4 text-sm text-slate-900">{exp.description}</td>
                <td className="py-3 px-4 text-sm text-slate-600">{exp.category}</td>
                <td className="py-3 px-4 text-right text-sm font-medium text-slate-900">${parseFloat(exp.amount || "0").toFixed(2)}</td>
                <td className="py-3 px-4 text-center text-sm text-slate-600">{exp.date}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-slate-400">No expenses yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
