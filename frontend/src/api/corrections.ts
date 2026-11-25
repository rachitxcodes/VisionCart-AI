import api from './client';
import { Correction, CorrectionCreateMeta, CorrectionStats } from '../types';

export const correctionsApi = {
  createCorrection: async (
    frameBlob: Blob,
    meta: CorrectionCreateMeta
  ): Promise<{ id: number; message: string }> => {
    const formData = new FormData();
    formData.append('frame', frameBlob, 'frame.jpg');
    formData.append('meta', JSON.stringify(meta));

    const response = await api.post<{ id: number; message: string }>(
      '/api/corrections',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  listCorrections: async (params?: {
    skip?: number;
    limit?: number;
    type?: string;
    label?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ items: Correction[]; total: number; skip: number; limit: number }> => {
    const response = await api.get<{
      items: Correction[];
      total: number;
      skip: number;
      limit: number;
    }>('/api/corrections', { params });
    return response.data;
  },

  getStats: async (): Promise<CorrectionStats> => {
    const response = await api.get<CorrectionStats>('/api/corrections/stats');
    return response.data;
  },

  deleteCorrection: async (id: number): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>(`/api/corrections/${id}`);
    return response.data;
  },

  exportDataset: async (): Promise<Blob> => {
    const response = await api.get('/api/corrections/export', {
      responseType: 'blob',
    });
    return response.data;
  },
};
