import api from './client';
import { Product, ProductCreate, ProductUpdate, StockAdjustmentRequest } from '../types';

export const productsApi = {
  list: async (params?: { category?: string; search?: string; skip?: number; limit?: number }) => {
    const response = await api.get<Product[]>('/api/products', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get<Product>(`/api/products/${id}`);
    return response.data;
  },

  create: async (data: ProductCreate) => {
    const response = await api.post<Product>('/api/products', data);
    return response.data;
  },

  update: async (id: number, data: ProductUpdate) => {
    const response = await api.put<Product>(`/api/products/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/api/products/${id}`);
    return response.data;
  },

  adjustStock: async (id: number, adjustment: StockAdjustmentRequest) => {
    const response = await api.post<Product>(`/api/products/${id}/adjust-stock`, adjustment);
    return response.data;
  },

  getLowStock: async () => {
    const response = await api.get<Product[]>('/api/products/low-stock');
    return response.data;
  },
};

