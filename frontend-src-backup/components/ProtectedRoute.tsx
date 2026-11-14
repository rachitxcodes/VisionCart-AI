import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white">
        <div className="bg-slate-900 border border-rose-500/30 rounded-xl p-8 max-w-md text-center shadow-xl">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold">403</span>
          </div>
          <h2 className="text-xl font-bold mb-2 text-rose-300">Access Denied</h2>
          <p className="text-slate-400 text-sm mb-6">
            Your role (<span className="text-rose-400 font-mono font-semibold">{user.role}</span>) does not have permission to view this page.
          </p>
          <a
            href="/cashier"
            className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            Go to Cashier POS
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

