import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import { productsApi } from '../api/products';
import { DailyRevenueEntry, TopProductEntry, SummaryKPIs, LowStockAlert } from '../types';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  IndianRupee,
  Receipt,
  ShoppingBag,
  AlertTriangle,
  RefreshCw,
  Plus,
  HelpCircle,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [kpis, setKpis] = useState<SummaryKPIs | null>(null);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenueEntry[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductEntry[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [restockingId, setRestockingId] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [kpiRes, revRes, topRes, lowRes] = await Promise.all([
        analyticsApi.getKPIs(days),
        analyticsApi.getDailyRevenue(days),
        analyticsApi.getTopProducts(6),
        analyticsApi.getLowStockAlerts(),
      ]);

      setKpis(kpiRes);
      setDailyRevenue(revRes);
      setTopProducts(topRes);
      setLowStockAlerts(lowRes);
    } catch (err) {
      console.error('Failed to load analytics dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [days]);

  const handleQuickRestock = async (productId: number) => {
    try {
      setRestockingId(productId);
      await productsApi.adjustStock(productId, {
        action: 'ADD',
        quantity: 10,
        reason: 'QUICK_RESTOCK_DASHBOARD',
      });
      // Refresh low stock
      const updatedLow = await analyticsApi.getLowStockAlerts();
      setLowStockAlerts(updatedLow);
    } catch (err) {
      console.error('Failed to quick restock:', err);
      alert('Failed to restock item.');
    } finally {
      setRestockingId(null);
    }
  };

  const formatRupees = (paise: number) => {
    return (paise / 100).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  };

  const chartData = dailyRevenue.map((d) => ({
    date: d.day.slice(5), // MM-DD
    revenue: Math.round(d.revenue_paise / 100),
    invoices: d.invoice_count,
  }));

  const topProductsChartData = topProducts.map((p) => ({
    name: p.product_name.length > 14 ? p.product_name.substring(0, 14) + '...' : p.product_name,
    qty: p.total_qty,
    revenue: Math.round(p.total_revenue_paise / 100),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Analytics & Performance</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time financial performance, product velocity, and automated stock alerts
          </p>
        </div>

        {/* Date Filter & Refresh */}
        <div className="flex items-center space-x-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  days === d
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Last {d}d
              </button>
            ))}
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/guide#guide-9"
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-indigo-400 transition-colors"
            title="Analytics Dashboard Help Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Revenue
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <IndianRupee className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">
              {kpis ? formatRupees(kpis.total_revenue_paise) : '...'}
            </span>
            <span className="block text-[11px] text-slate-400 mt-1">
              Over the last {days} days
            </span>
          </div>
        </div>

        {/* Invoices Count */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Invoices Issued
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">
              {kpis ? kpis.invoice_count.toLocaleString() : '...'}
            </span>
            <span className="block text-[11px] text-slate-400 mt-1">
              Completed checkouts
            </span>
          </div>
        </div>

        {/* Average Basket Value */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Average Basket Value
            </span>
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-white">
              {kpis ? formatRupees(kpis.avg_basket_value_paise) : '...'}
            </span>
            <span className="block text-[11px] text-slate-400 mt-1">
              Per customer receipt
            </span>
          </div>
        </div>

        {/* Low-Stock Alert Count */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Low-Stock Alerts
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-rose-400">
              {lowStockAlerts.length}
            </span>
            <span className="block text-[11px] text-slate-400 mt-1">
              Items at/below reorder limit
            </span>
          </div>
        </div>
      </div>

      {/* Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Revenue Trend (AreaChart) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Daily Revenue Trend</h3>
              <p className="text-xs text-slate-400">Gross revenue in ₹ over time</p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revenueGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products (BarChart) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Top Selling Products</h3>
              <p className="text-xs text-slate-400">Highest quantity sold</p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProductsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                  formatter={(val: any, name: any) => [name === 'qty' ? `${val} units` : `₹${val}`, name === 'qty' ? 'Units Sold' : 'Revenue']}
                />
                <Bar dataKey="qty" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Low-Stock Alerts Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Critical Low-Stock Alerts</h3>
              <p className="text-xs text-slate-400">Products requiring immediate warehouse reorder</p>
            </div>
          </div>
          <span className="text-xs text-slate-400">
            {lowStockAlerts.length} items flagged
          </span>
        </div>

        {lowStockAlerts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-950/40 rounded-xl border border-slate-800">
            <p className="text-sm font-semibold text-emerald-400">All inventory levels healthy</p>
            <p className="text-xs mt-1">No products are currently at or below reorder limits.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockAlerts.map((prod) => (
              <div
                key={prod.id}
                className="bg-slate-950/80 border border-rose-900/30 rounded-xl p-4 flex items-center justify-between gap-3 hover:border-rose-700/50 transition-colors"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-white text-xs">{prod.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">({prod.sku})</span>
                  </div>
                  <div className="mt-1 flex items-center space-x-2 text-[11px]">
                    <span className="text-rose-400 font-bold">Stock: {prod.stock}</span>
                    <span className="text-slate-500">/ Limit: {prod.reorder_level}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleQuickRestock(prod.id)}
                  disabled={restockingId === prod.id}
                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{restockingId === prod.id ? 'Adding...' : '+10 Restock'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
