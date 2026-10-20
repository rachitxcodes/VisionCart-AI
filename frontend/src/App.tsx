import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { CashierPage } from './pages/CashierPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AdminProductsPage } from './pages/AdminProductsPage';
import { GuideHubPage } from './pages/GuideHubPage';
import { NotFoundPage } from './pages/NotFoundPage';

const RootRedirect: React.FC = () => {
  const { user, token } = useAuth();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/cashier" replace />;
};

export const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Cashier Station (Accessible to Cashier and Admin) */}
      <Route
        path="/cashier"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'CASHIER']}>
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
              <Navbar />
              <main className="flex-1">
                <CashierPage />
              </main>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Admin Analytics Dashboard */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
              <Navbar />
              <main className="flex-1">
                <AdminDashboardPage />
              </main>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Admin Product Management */}
      <Route
        path="/admin/products"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
              <Navbar />
              <main className="flex-1">
                <AdminProductsPage />
              </main>
            </div>
          </ProtectedRoute>
        }
      />

      {/* Guide Hub (Accessible to both Cashier and Admin) */}
      <Route
        path="/guide"
        element={
          <ProtectedRoute allowedRoles={['ADMIN', 'CASHIER']}>
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
              <Navbar />
              <main className="flex-1">
                <GuideHubPage />
              </main>
            </div>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
