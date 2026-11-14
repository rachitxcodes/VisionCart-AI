import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShoppingCart, LayoutDashboard, Package, LogOut, ShieldCheck, User as UserIcon, BookOpen } from 'lucide-react';

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
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                  VisionCart AI
                </span>
                <span className="block text-xs text-indigo-400 font-mono tracking-wider uppercase">
                  Smart Retail POS
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-3">
            <Link
              to="/cashier"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/cashier')
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Cashier POS</span>
            </Link>

            {isAdmin && (
              <>
                <Link
                  to="/admin/dashboard"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/dashboard')
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Analytics</span>
                </Link>

                <Link
                  to="/admin/products"
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive('/admin/products')
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>Products</span>
                </Link>
              </>
            )}

            <Link
              to="/guide"
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/guide')
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Guide Hub</span>
            </Link>
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-right">
              <div>
                <p className="text-xs font-semibold text-slate-200">{user?.full_name || user?.email}</p>
                <div className="flex items-center justify-end space-x-1">
                  {isAdmin ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <ShieldCheck className="w-3 h-3 mr-0.5" /> ADMIN
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <UserIcon className="w-3 h-3 mr-0.5" /> CASHIER
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-rose-400 px-3 py-2 rounded-md bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700/60 hover:border-rose-900/50 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
