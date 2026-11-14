import api from './client';
import { CartSummary, DetectionItem } from '../types';

export const cartApi = {
  detectBase64: async (base64Image: string) => {
    const response = await api.post<{ detections: DetectionItem[]; count: number }>(
      '/api/detection/detect-base64',
      { image: base64Image, image_base64: base64Image }
    );
    return response.data;
  },

  syncDetections: async (sessionId: string, detections: DetectionItem[]): Promise<CartSummary> => {
    const response = await api.post<CartSummary>('/api/cart/sync', {
      session_id: sessionId,
      detections,
      detected_classes: detections.map((d) => d.class_name),
    });
    return response.data;
  },

  getCart: async (sessionId: string): Promise<CartSummary> => {
    const response = await api.get<CartSummary>('/api/cart', {
      params: { session_id: sessionId },
    });
    return response.data;
  },

  updateItem: async (
    sessionId: string,
    productId: number,
    quantity: number
  ): Promise<CartSummary> => {
    const response = await api.post<CartSummary>('/api/cart/items', {
      session_id: sessionId,
      product_id: productId,
      quantity,
    });
    return response.data;
  },

  removeItem: async (sessionId: string, productId: number): Promise<CartSummary> => {
    const response = await api.delete<CartSummary>(`/api/cart/items/${productId}`, {
      params: { session_id: sessionId },
    });
    return response.data;
  },

  clearCart: async (sessionId: string) => {
    const response = await api.delete('/api/cart', {
      params: { session_id: sessionId },
    });
    return response.data;
  },
};
