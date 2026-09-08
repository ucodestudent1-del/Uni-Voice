import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSubscription } from "../contexts/SubscriptionContext";
import { getInvoices, getCustomers } from "../api/client";

export default function Dashboard() {
  const { plan } = useSubscription();
  const [stats, setStats] = useState({ invoices: 0, customers: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [invData, custData] = await Promise.all([
          getInvoices({ limit: 200 }),
          getCustomers({ limit: 200 }),
        ]);
        const total = invData.invoices.reduce((sum: number, inv: any) => sum + Number(inv.total || 0), 0);
        setStats({
          invoices: invData.invoices?.length ?? 0,
          customers: custData.customers?.length ?? 0,
          totalRevenue: total,
        });
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="md:flex md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Dashboard
          </h2>
        </div>
        {plan && (
          <div className="mt-4 flex md:mt-0 md:ml-4">
            <span className="inline-flex items-center px-3 py-2 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
              {plan.name} Plan
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-3xl">📄</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Invoices</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.invoices}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <Link to="/invoices" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              View all
            </Link>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-3xl">👥</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Customers</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats.customers}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <Link to="/customers" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              View all
            </Link>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-3xl">💰</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Revenue</dt>
                  <dd className="text-lg font-medium text-gray-900">${stats.totalRevenue.toFixed(2)}</dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <Link to="/invoices" className="text-sm font-medium text-blue-600 hover:text-blue-500">
              View invoices
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link to="/invoices" className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400">
            <div className="flex-shrink-0 text-2xl">📝</div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900">New Invoice</span>
            </div>
          </Link>
          <Link to="/customers" className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400">
            <div className="flex-shrink-0 text-2xl">👤</div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900">Add Customer</span>
            </div>
          </Link>
          <Link to="/products" className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400">
            <div className="flex-shrink-0 text-2xl">📦</div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900">Add Product</span>
            </div>
          </Link>
          <Link to="/plans" className="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex items-center space-x-3 hover:border-gray-400">
            <div className="flex-shrink-0 text-2xl">⭐</div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-medium text-gray-900">Upgrade Plan</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
