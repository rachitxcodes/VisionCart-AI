import api from './client';
import { DailyRevenueEntry, TopProductEntry, SummaryKPIs, LowStockAlert } from '../types';

export const analyticsApi = {
  getDailyRevenue: async (days: number = 30): Promise<DailyRevenueEntry[]> => {
    const response = await api.get<DailyRevenueEntry[]>('/api/analytics/daily-revenue', {
      params: { days },
    });
    return response.data;
  },

  getTopProducts: async (limit: number = 10): Promise<TopProductEntry[]> => {
    const response = await api.get<TopProductEntry[]>('/api/analytics/top-products', {
      params: { limit },
    });
    return response.data;
  },

  getKPIs: async (days: number = 30): Promise<SummaryKPIs> => {
    const response = await api.get<SummaryKPIs>('/api/analytics/kpis', {
      params: { days },
    });
    return response.data;
  },

  getLowStockAlerts: async (): Promise<LowStockAlert[]> => {
    const response = await api.get<LowStockAlert[]>('/api/analytics/low-stock');
    return response.data;
  },
};

