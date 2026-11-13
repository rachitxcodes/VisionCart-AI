import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShoppingBag, BarChart3, Package2, BookOpen, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="bg-paper border-b border-counter-grey sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo / Shop brand */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2.5">
              <span className="w-8 h-8 rounded-control bg-primary text-white flex items-center justify-center font-heading font-bold text-sm shadow-sm">
                VC
              </span>
              <span className="font-heading font-bold text-lg text-ink tracking-tight">
                VisionCart
              </span>
            </Link>
          </div>

          {/* Navigation Links with underline on active */}
          <nav className="flex items-center space-x-6 sm:space-x-8">
            <Link
              to="/cashier"
              className={`flex items-center space-x-1.5 py-4 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                isActive('/cashier')
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Cashier POS</span>
            </Link>

            {isAdmin && (
              <>
                <Link
                  to="/admin/dashboard"
                  className={`flex items-center space-x-1.5 py-4 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                    isActive('/admin/dashboard')
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Analytics</span>
                </Link>

                <Link
                  to="/admin/products"
                  className={`flex items-center space-x-1.5 py-4 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                    isActive('/admin/products')
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-ink-muted hover:text-ink'
                  }`}
                >
                  <Package2 className="w-4 h-4" />
                  <span>Products</span>
                </Link>
              </>
            )}

            <Link
              to="/guide"
              className={`flex items-center space-x-1.5 py-4 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
                isActive('/guide')
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Guide Hub</span>
            </Link>
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-right">
              <span className="text-xs font-medium text-ink">
                {user?.full_name || user?.email}
              </span>
              <span className="text-[11px] font-medium text-ink-muted bg-surface border border-counter-grey px-2 py-0.5 rounded-control">
                {isAdmin ? 'Admin' : 'Cashier'}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs text-ink-muted hover:text-signal font-medium transition-colors flex items-center space-x-1 px-2 py-1 rounded-control hover:bg-counter-light"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
