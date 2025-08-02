import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, ApiError } from '@/types/api';

// API Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_TIMEOUT = 30000; // 30 seconds

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken } = response.data.data;
          setAuthToken(accessToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        removeAuthTokens();
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Token management functions
function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
}

function getRefreshToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('refreshToken');
  }
  return null;
}

function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', token);
  }
}

function removeAuthTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}

// API wrapper functions
export const api = {
  // Generic API methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.get(url, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.post(url, data, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.put(url, data, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.patch(url, data, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.delete(url, config);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // File upload
  async upload<T = any>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await apiClient.post(url, formData, {
        ...config,
        headers: {
          'Content-Type': 'multipart/form-data',
          ...config?.headers,
        },
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Authentication
  auth: {
    async login(credentials: { email: string; password: string; rememberMe?: boolean }) {
      const response = await api.post('/auth/login', credentials);
      if (response.data?.accessToken) {
        setAuthToken(response.data.accessToken);
        if (typeof window !== 'undefined') {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
      }
      return response;
    },

    async register(userData: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) {
      return api.post('/auth/register', userData);
    },

    async logout() {
      try {
        await api.post('/auth/logout');
      } finally {
        removeAuthTokens();
      }
    },

    async refreshToken() {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await api.post('/auth/refresh', { refreshToken });
      if (response.data?.accessToken) {
        setAuthToken(response.data.accessToken);
      }
      return response;
    },

    async forgotPassword(email: string) {
      return api.post('/auth/forgot-password', { email });
    },

    async resetPassword(token: string, password: string) {
      return api.post('/auth/reset-password', { token, password });
    },

    async verifyEmail(token: string) {
      return api.post('/auth/verify-email', { token });
    },

    async enableTwoFactor() {
      return api.post('/auth/2fa/enable');
    },

    async disableTwoFactor(code: string) {
      return api.post('/auth/2fa/disable', { code });
    },

    async verifyTwoFactor(code: string) {
      return api.post('/auth/2fa/verify', { code });
    },
  },

  // Products
  products: {
    async search(params: any) {
      return api.get('/products/search', { params });
    },

    async getById(id: string) {
      return api.get(`/products/${id}`);
    },

    async getByASIN(asin: string) {
      return api.get(`/products/asin/${asin}`);
    },

    async analyze(asin: string) {
      return api.post(`/products/${asin}/analyze`);
    },

    async getHistory(asin: string, period?: string) {
      return api.get(`/products/${asin}/history`, { params: { period } });
    },
  },

  // Inventory
  inventory: {
    async getAll(params?: any) {
      return api.get('/inventory', { params });
    },

    async create(data: any) {
      return api.post('/inventory', data);
    },

    async update(id: string, data: any) {
      return api.put(`/inventory/${id}`, data);
    },

    async delete(id: string) {
      return api.delete(`/inventory/${id}`);
    },

    async bulkUpdate(data: any[]) {
      return api.post('/inventory/bulk-update', data);
    },

    async getAlerts() {
      return api.get('/inventory/alerts');
    },

    async sync() {
      return api.post('/inventory/sync');
    },
  },

  // Pricing
  pricing: {
    async calculate(data: any) {
      return api.post('/pricing/calculate', data);
    },

    async getHistory(asin: string) {
      return api.get(`/pricing/${asin}/history`);
    },

    async optimize(asin: string, data: any) {
      return api.post(`/pricing/${asin}/optimize`, data);
    },

    async bulkCalculate(asins: string[]) {
      return api.post('/pricing/bulk-calculate', { asins });
    },
  },

  // Repricing
  repricing: {
    async getRules() {
      return api.get('/repricing/rules');
    },

    async createRule(data: any) {
      return api.post('/repricing/rules', data);
    },

    async updateRule(id: string, data: any) {
      return api.put(`/repricing/rules/${id}`, data);
    },

    async deleteRule(id: string) {
      return api.delete(`/repricing/rules/${id}`);
    },

    async getSession(id: string) {
      return api.get(`/repricing/sessions/${id}`);
    },

    async startSession(data: any) {
      return api.post('/repricing/sessions', data);
    },

    async stopSession(id: string) {
      return api.post(`/repricing/sessions/${id}/stop`);
    },

    async getCompetitors(asin: string) {
      return api.get(`/repricing/competitors/${asin}`);
    },
  },

  // AI
  ai: {
    async predictTrend(data: any) {
      return api.post('/ai/trend-prediction', data);
    },

    async analyzeSentiment(data: any) {
      return api.post('/ai/sentiment-analysis', data);
    },

    async forecastSales(data: any) {
      return api.post('/ai/sales-forecast', data);
    },

    async detectAnomalies(data: any) {
      return api.post('/ai/anomaly-detection', data);
    },

    async getModels() {
      return api.get('/ai/models');
    },

    async trainModel(data: any) {
      return api.post('/ai/models/train', data);
    },

    async getModelDetails(id: string) {
      return api.get(`/ai/models/${id}`);
    },

    async uploadData(formData: FormData) {
      return api.upload('/ai/data/upload', formData);
    },

    async getHealthCheck() {
      return api.get('/ai/health');
    },

    async getUsageAnalytics(params?: any) {
      return api.get('/ai/analytics/usage', { params });
    },
  },

  // Dashboard
  dashboard: {
    async getStats() {
      return api.get('/dashboard/stats');
    },

    async getChartData(type: string, period?: string) {
      return api.get(`/dashboard/charts/${type}`, { params: { period } });
    },

    async getRecentActivity() {
      return api.get('/dashboard/activity');
    },

    async getAlerts() {
      return api.get('/dashboard/alerts');
    },
  },

  // User
  user: {
    async getProfile() {
      return api.get('/user/profile');
    },

    async updateProfile(data: any) {
      return api.put('/user/profile', data);
    },

    async changePassword(data: { currentPassword: string; newPassword: string }) {
      return api.post('/user/change-password', data);
    },

    async updateSettings(data: any) {
      return api.put('/user/settings', data);
    },

    async uploadAvatar(formData: FormData) {
      return api.upload('/user/avatar', formData);
    },

    async deleteAccount() {
      return api.delete('/user/account');
    },
  },

  // Notifications
  notifications: {
    async getAll() {
      return api.get('/notifications');
    },

    async markAsRead(id: string) {
      return api.put(`/notifications/${id}/read`);
    },

    async markAllAsRead() {
      return api.put('/notifications/read-all');
    },

    async delete(id: string) {
      return api.delete(`/notifications/${id}`);
    },

    async updateSettings(data: any) {
      return api.put('/notifications/settings', data);
    },
  },
};

// Error handling helper
function handleApiError(error: any): ApiError {
  if (error.response) {
    // Server responded with error status
    return {
      message: error.response.data?.message || 'An error occurred',
      code: error.response.data?.code || 'UNKNOWN_ERROR',
      status: error.response.status,
      details: error.response.data?.details,
    };
  } else if (error.request) {
    // Request was made but no response received
    return {
      message: 'Network error - please check your connection',
      code: 'NETWORK_ERROR',
      status: 0,
    };
  } else {
    // Something else happened
    return {
      message: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
      status: 0,
    };
  }
}

// Export the configured axios instance for custom usage
export { apiClient };

// Export token management functions
export { setAuthToken, removeAuthTokens, getAuthToken, getRefreshToken };