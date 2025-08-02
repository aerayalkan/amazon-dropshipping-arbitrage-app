// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

// User Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  profile?: UserProfile;
}

export interface UserProfile {
  avatar?: string;
  phone?: string;
  timezone: string;
  language: string;
  currency: string;
  notifications: NotificationSettings;
  subscription?: Subscription;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  marketing: boolean;
  updates: boolean;
}

export interface Subscription {
  plan: 'free' | 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'inactive' | 'cancelled' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export type UserRole = 'admin' | 'user' | 'moderator';

// Authentication Types
export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  agreeToTerms: boolean;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Product Types
export interface Product {
  id: string;
  asin: string;
  title: string;
  brand?: string;
  category: string;
  subcategory?: string;
  price: number;
  currency: string;
  availability: ProductAvailability;
  rating: number;
  reviewCount: number;
  images: ProductImage[];
  dimensions?: ProductDimensions;
  weight?: number;
  features: string[];
  description?: string;
  buyBoxWinner?: BuyBoxWinner;
  salesRank?: number;
  variations?: ProductVariation[];
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  url: string;
  width: number;
  height: number;
  variant: 'MAIN' | 'PT01' | 'PT02' | 'PT03' | 'PT04' | 'PT05' | 'PT06' | 'PT07' | 'PT08';
}

export interface ProductDimensions {
  length: number;
  width: number;
  height: number;
  unit: 'cm' | 'inches';
}

export interface ProductVariation {
  asin: string;
  title: string;
  price: number;
  availability: ProductAvailability;
  attributes: Record<string, string>;
}

export interface BuyBoxWinner {
  seller: string;
  price: number;
  shipping: number;
  condition: 'new' | 'used' | 'refurbished';
  fulfillment: 'FBA' | 'FBM';
}

export type ProductAvailability = 'in_stock' | 'out_of_stock' | 'limited' | 'preorder';

// Search and Filter Types
export interface ProductSearchParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  availability?: ProductAvailability;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'review_count';
  page?: number;
  limit?: number;
}

export interface ProductSearchResult {
  products: Product[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  categories: FacetItem[];
  brands: FacetItem[];
  priceRanges: PriceRangeFacet[];
  ratings: FacetItem[];
}

export interface FacetItem {
  value: string;
  count: number;
  selected?: boolean;
}

export interface PriceRangeFacet {
  min: number;
  max: number;
  count: number;
  selected?: boolean;
}

// Inventory Types
export interface InventoryItem {
  id: string;
  asin: string;
  product: Product;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  reorderPoint: number;
  maxStock: number;
  costPrice: number;
  sellingPrice: number;
  status: InventoryStatus;
  supplier?: Supplier;
  location?: string;
  lastRestocked?: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryStatus = 'active' | 'inactive' | 'low_stock' | 'out_of_stock' | 'discontinued';

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone?: string;
  address?: Address;
  rating: number;
  isActive: boolean;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Pricing Types
export interface PricingCalculation {
  id: string;
  asin: string;
  productCost: number;
  amazonFees: AmazonFees;
  shippingCost: number;
  taxes: number;
  totalCost: number;
  sellingPrice: number;
  profit: number;
  profitMargin: number;
  roi: number;
  createdAt: string;
}

export interface AmazonFees {
  referralFee: number;
  fulfillmentFee: number;
  storageFee: number;
  advertisingFee?: number;
  otherFees: number;
  total: number;
}

// AI/ML Types
export interface TrendPrediction {
  id: string;
  asin: string;
  predictionType: 'price' | 'sales' | 'demand';
  timeframe: 'daily' | 'weekly' | 'monthly';
  predictions: DataPoint[];
  confidence: number;
  model: string;
  accuracy?: number;
  createdAt: string;
}

export interface DataPoint {
  date: string;
  value: number;
  prediction?: number;
  confidence?: number;
}

export interface SentimentAnalysis {
  id: string;
  asin: string;
  overallSentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
  sentimentScore: number;
  confidence: number;
  totalReviews: number;
  sentimentDistribution: SentimentDistribution;
  aspectSentiments: AspectSentiment[];
  insights: string[];
  createdAt: string;
}

export interface SentimentDistribution {
  veryPositive: number;
  positive: number;
  neutral: number;
  negative: number;
  veryNegative: number;
}

export interface AspectSentiment {
  aspect: string;
  sentiment: number;
  mentions: number;
  keywords: string[];
}

// Analytics Types
export interface DashboardStats {
  totalProducts: number;
  totalRevenue: number;
  totalProfit: number;
  averageROI: number;
  activeInventory: number;
  lowStockItems: number;
  profitMargin: number;
  growthRate: number;
}

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
}

// Notification Types
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export type NotificationType = 
  | 'info' 
  | 'success' 
  | 'warning' 
  | 'error'
  | 'price_change'
  | 'stock_alert'
  | 'new_opportunity'
  | 'system_update';

// Form Types
export interface FormField {
  name: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: SelectOption[];
  validation?: ValidationRule[];
}

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface ValidationRule {
  type: 'required' | 'email' | 'min' | 'max' | 'pattern';
  value?: any;
  message: string;
}

// Table Types
export interface TableColumn<T = any> {
  key: keyof T | string;
  title: string;
  dataIndex?: keyof T;
  render?: (value: any, record: T) => React.ReactNode;
  sorter?: boolean | ((a: T, b: T) => number);
  filters?: TableFilter[];
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
}

export interface TableFilter {
  text: string;
  value: any;
}

export interface TablePagination {
  current: number;
  pageSize: number;
  total: number;
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: (total: number, range: [number, number]) => string;
}

// Utility Types
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  key: string;
  direction: SortOrder;
}

export interface FilterConfig {
  [key: string]: any;
}

export interface PaginationConfig {
  page: number;
  limit: number;
}

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

// Theme Types
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  borderRadius: number;
  compactMode: boolean;
}

// Export all types
export type * from './api';
export type * from './components';