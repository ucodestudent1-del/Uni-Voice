import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSubscription } from "../contexts/SubscriptionContext";

export default function Layout() {
  const { logout, user } = useAuth();
  const { plan } = useSubscription();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-md text-sm font-medium ${isActive ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold">InvoiceGen</h1>
              </div>
              <div className="hidden md:block ml-10">
                <div className="flex items-baseline space-x-4">
                  <NavLink to="/" end className={navClass}>Dashboard</NavLink>
                  <NavLink to="/invoices" className={navClass}>Invoices</NavLink>
                  <NavLink to="/customers" className={navClass}>Customers</NavLink>
                  <NavLink to="/products" className={navClass}>Products</NavLink>
                  <NavLink to="/plans" className={navClass}>Plans</NavLink>
                  <NavLink to="/settings" className={navClass}>Settings</NavLink>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {plan && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {plan.name}
                </span>
              )}
              <span className="text-sm text-gray-300">{user?.email}</span>
              <button onClick={handleLogout} className="text-gray-300 hover:text-white text-sm">
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
