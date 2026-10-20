import api from './client';
import { Invoice } from '../types';

export interface CheckoutPayload {
  session_id?: string;
  idempotency_key?: string;
  items: Array<{
    product_id: number;
    quantity: number;
  }>;
}

export const checkoutApi = {
  processCheckout: async (payload: CheckoutPayload): Promise<Invoice> => {
    const response = await api.post<Invoice>('/api/checkout', payload);
    return response.data;
  },

  getInvoice: async (invoiceId: number): Promise<Invoice> => {
    const response = await api.get<Invoice>(`/api/checkout/${invoiceId}`);
    return response.data;
  },

  downloadInvoicePdf: async (invoiceId: number, invoiceNumber: string) => {
    const response = await api.get(`/api/checkout/${invoiceId}/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${invoiceNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

