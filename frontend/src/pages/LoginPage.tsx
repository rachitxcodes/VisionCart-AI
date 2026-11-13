import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/auth';
import { AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const authData = await authApi.login(email, password);
      login(authData);
      if (authData.user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else {
        navigate('/cashier');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(
        err.response?.data?.detail || 'Invalid email or password. Please verify credentials.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-paper text-ink font-body flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side: Shop-counter identity & quiet receipt motif */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-6 p-6 sm:p-8 bg-surface border border-counter-grey rounded-panel shadow-xs">
          <div>
            <div className="w-10 h-10 rounded-control bg-primary text-white flex items-center justify-center font-heading font-bold text-base shadow-sm mb-4">
              VC
            </div>
            <h1 className="text-2xl font-heading font-bold text-ink tracking-tight">
              VisionCart
            </h1>
            <p className="text-sm text-ink-muted mt-2 leading-relaxed">
              Computer-vision checkout and inventory for the modern shop counter.
            </p>
          </div>

          {/* Quiet receipt motif */}
          <div className="receipt-paper border border-counter-grey receipt-torn-bottom rounded-t-control p-4 text-xs font-mono tabular-nums text-ink-muted space-y-2 bg-paper/50">
            <div className="flex justify-between border-b border-counter-grey pb-1.5 font-body font-medium text-ink">
              <span>Counter station</span>
              <span className="text-[11px] text-primary font-semibold">Active</span>
            </div>
            <div className="flex justify-between">
              <span>Automated camera scan</span>
              <span>Enabled</span>
            </div>
            <div className="flex justify-between">
              <span>GST invoice generation</span>
              <span>Instant</span>
            </div>
            <div className="flex justify-between">
              <span>Atomic stock update</span>
              <span>Protected</span>
            </div>
          </div>

          <div className="text-[11px] text-ink-muted">
            GLA University · B.Tech CSE (AIML)
          </div>
        </div>

        {/* Right Side: Sign-in Form */}
        <div className="lg:col-span-7 bg-surface border border-counter-grey rounded-panel p-6 sm:p-8 shadow-xs flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-lg font-heading font-semibold text-ink">Sign in to your counter</h2>
            <p className="text-xs text-ink-muted mt-1">Enter your store staff account credentials</p>
          </div>

          {error && (
            <div className="mb-5 p-3 bg-signal-tint border border-signal/20 rounded-control text-xs text-signal flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-signal flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4 text-xs" onSubmit={handleSubmit}>
            <div>
              <label className="block text-ink font-medium mb-1.5">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@visioncart.local"
                  className="w-full bg-paper border border-counter-grey rounded-control pl-9 pr-3 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-ink font-medium mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-muted">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-paper border border-counter-grey rounded-control pl-9 pr-3 py-2.5 text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 rounded-control font-semibold text-xs bg-primary hover:bg-primary-hover disabled:bg-counter-grey text-white flex items-center justify-center space-x-2 shadow-sm transition-colors"
            >
              <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Demo Logins */}
          <div className="mt-6 pt-5 border-t border-counter-grey">
            <span className="block text-[11px] font-medium text-ink-muted mb-2.5 text-center">
              Quick access demo credentials
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFillDemo('admin@visioncart.local', 'Admin@1234')}
                className="p-2.5 rounded-control border border-counter-grey bg-paper hover:bg-counter-light text-left text-xs transition-colors"
              >
                <span className="font-semibold text-ink block">Sign in as demo admin</span>
                <span className="text-[11px] text-ink-muted font-mono">admin@visioncart.local</span>
              </button>

              <button
                type="button"
                onClick={() => handleFillDemo('cashier@visioncart.local', 'Cashier@1234')}
                className="p-2.5 rounded-control border border-counter-grey bg-paper hover:bg-counter-light text-left text-xs transition-colors"
              >
                <span className="font-semibold text-ink block">Sign in as demo cashier</span>
                <span className="text-[11px] text-ink-muted font-mono">cashier@visioncart.local</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
