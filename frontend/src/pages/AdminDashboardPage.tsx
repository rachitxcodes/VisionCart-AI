import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import { productsApi } from '../api/products';
import { DailyRevenueEntry, TopProductEntry, SummaryKPIs, LowStockAlert } from '../types';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
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
    date: d.day.slice(5),
    revenue: Math.round(d.revenue_paise / 100),
    invoices: d.invoice_count,
  }));

  const summarySentence = kpis
    ? `Last ${days} days: ${formatRupees(kpis.total_revenue_paise)} gross revenue from ${kpis.invoice_count.toLocaleString()} customer invoices`
    : `Loading performance for the last ${days} days...`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 font-body text-ink">
      {/* Header and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-3 border-b border-counter-grey pb-4">
        <div>
          <h1 className="text-xl font-heading font-semibold text-ink">Business analytics</h1>
          <p className="text-sm text-ink-muted mt-1">{summarySentence}</p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Days selector */}
          <div className="bg-surface border border-counter-grey rounded-control p-0.5 flex">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-control text-xs font-medium transition-colors ${
                  days === d
                    ? 'bg-paper text-ink font-semibold border border-counter-grey'
                    : 'text-ink-muted hover:text-ink'
                }`}
              >
                {d} days
              </button>
            ))}
          </div>

          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="p-1.5 bg-surface hover:bg-counter-light border border-counter-grey rounded-control text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            to="/guide#guide-9"
            className="p-1.5 bg-surface hover:bg-counter-light border border-counter-grey rounded-control text-ink-muted hover:text-ink transition-colors"
            title="Analytics guide"
            aria-label="Analytics guide"
          >
            <HelpCircle className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* KPI Simple Row (sentence case labels, tabular numbers, no gradient cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-counter-grey rounded-panel p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-muted block">Total revenue</span>
          <span className="text-2xl font-mono tabular-nums font-bold text-ink mt-1 block">
            {kpis ? formatRupees(kpis.total_revenue_paise) : '...'}
          </span>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Past {days} days</span>
        </div>

        <div className="bg-surface border border-counter-grey rounded-panel p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-muted block">Invoices issued</span>
          <span className="text-2xl font-mono tabular-nums font-bold text-ink mt-1 block">
            {kpis ? kpis.invoice_count.toLocaleString() : '...'}
          </span>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Completed sales</span>
        </div>

        <div className="bg-surface border border-counter-grey rounded-panel p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-muted block">Average basket</span>
          <span className="text-2xl font-mono tabular-nums font-bold text-ink mt-1 block">
            {kpis ? formatRupees(kpis.avg_basket_value_paise) : '...'}
          </span>
          <span className="text-[11px] text-ink-muted mt-0.5 block">Per customer receipt</span>
        </div>

        <div className="bg-surface border border-counter-grey rounded-panel p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-muted block">Low-stock alerts</span>
          <span className={`text-2xl font-mono tabular-nums font-bold mt-1 block ${lowStockAlerts.length > 0 ? 'text-signal' : 'text-primary'}`}>
            {lowStockAlerts.length}
          </span>
          <span className="text-[11px] text-ink-muted mt-0.5 block">
            {lowStockAlerts.length > 0 ? 'Items need reordering' : 'All stock healthy'}
          </span>
        </div>
      </div>

      {/* Main Visualizations: Revenue Trend & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily Revenue Trend (AreaChart: bottle green line, grey gridlines) */}
        <div className="lg:col-span-7 bg-surface border border-counter-grey rounded-panel p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-heading font-semibold text-ink">Daily revenue</h2>
            <p className="text-xs text-ink-muted">Gross daily sales in rupees</p>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#146C54" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#146C54" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E3DB" vertical={false} />
                <XAxis dataKey="date" stroke="#5B6561" fontSize={11} tickLine={false} />
                <YAxis stroke="#5B6561" fontSize={11} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E5E3DB',
                    borderRadius: '8px',
                    fontSize: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                  formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, 'Revenue']}
                  labelFormatter={(label) => `Date: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#146C54"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueGreen)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products: Horizontal bar list */}
        <div className="lg:col-span-5 bg-surface border border-counter-grey rounded-panel p-5 shadow-sm flex flex-col">
          <div className="mb-4">
            <h2 className="text-base font-heading font-semibold text-ink">Top products</h2>
            <p className="text-xs text-ink-muted">Highest units sold</p>
          </div>

          {topProducts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center p-6 text-ink-muted text-xs">
              No product sales recorded in this period.
            </div>
          ) : (
            <div className="space-y-3 flex-1 flex flex-col justify-center">
              {(() => {
                const maxQty = Math.max(...topProducts.map((p) => p.total_qty), 1);
                return topProducts.map((prod) => {
                  const percent = Math.round((prod.total_qty / maxQty) * 100);
                  return (
                    <div key={prod.product_id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-medium text-ink truncate pr-2">{prod.product_name}</span>
                        <span className="font-mono tabular-nums text-ink-muted">
                          {prod.total_qty} units ({formatRupees(prod.total_revenue_paise)})
                        </span>
                      </div>
                      <div className="w-full bg-paper rounded-full h-2 overflow-hidden border border-counter-grey/60">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Low-Stock Section (clear red-tagged list with Restock shortcut) */}
      <div className="bg-surface border border-counter-grey rounded-panel p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 border-b border-counter-grey pb-3">
          <div>
            <h2 className="text-base font-heading font-semibold text-ink">Low-stock alerts</h2>
            <p className="text-xs text-ink-muted">Products currently at or below minimum threshold</p>
          </div>
          <span className="text-xs text-ink-muted font-mono tabular-nums">
            {lowStockAlerts.length} items flagged
          </span>
        </div>

        {lowStockAlerts.length === 0 ? (
          <div className="p-6 text-center text-ink-muted bg-paper rounded-control border border-counter-grey text-xs">
            <span className="font-medium text-primary block">All inventory levels healthy</span>
            <span className="mt-0.5 block">No items currently require warehouse restocking.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockAlerts.map((prod) => (
              <div
                key={prod.id}
                className="bg-paper border border-signal/20 rounded-control p-3.5 flex items-center justify-between gap-3 shadow-xs"
              >
                <div>
                  <div className="flex items-center space-x-1.5">
                    <span className="font-medium text-ink text-xs">{prod.name}</span>
                    <span className="text-[10px] text-ink-muted font-mono">({prod.sku})</span>
                  </div>
                  <div className="mt-1 flex items-center space-x-2 text-[11px] font-mono tabular-nums">
                    <span className="text-signal font-semibold">Stock: {prod.stock}</span>
                    <span className="text-ink-muted">· Reorder: {prod.reorder_level}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleQuickRestock(prod.id)}
                  disabled={restockingId === prod.id}
                  className="px-2.5 py-1.5 bg-surface hover:bg-counter-light border border-counter-grey text-ink rounded-control text-xs font-medium flex items-center space-x-1 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <Plus className="w-3 h-3 text-primary" />
                  <span>{restockingId === prod.id ? 'Adding...' : '+10'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
