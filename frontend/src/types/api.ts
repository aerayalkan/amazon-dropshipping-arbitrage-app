// API Request/Response Types
export interface ApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: any;
}

// Specific API Types
export interface ProductSearchRequest {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
}

export interface InventoryCreateRequest {
  asin: string;
  sku: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  reorderPoint: number;
  maxStock: number;
  supplierId?: string;
  location?: string;
}

export interface PricingCalculationRequest {
  asin: string;
  productCost: number;
  shippingCost: number;
  sellingPrice: number;
  marketplace: string;
  category: string;
}

export interface TrendPredictionRequest {
  asin: string;
  dataPoints: Array<{ date: string; value: number }>;
  timeframe: 'daily' | 'weekly' | 'monthly';
  forecastHorizon: number;
  modelType: 'lstm' | 'prophet' | 'arima' | 'ensemble';
}

export interface SentimentAnalysisRequest {
  asin: string;
  texts: Array<{
    id: string;
    text: string;
    rating?: number;
    verified?: boolean;
    date?: string;
  }>;
  analysisSource: 'product_reviews' | 'customer_feedback' | 'social_media';
  modelType: 'distilbert' | 'roberta';
  includeEmotions?: boolean;
  includeAspects?: boolean;
}