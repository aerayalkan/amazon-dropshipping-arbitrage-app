import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';

import { CompetitorProduct } from './competitor-product.entity';

export enum PriceChangeReason {
  COMPETITOR_RESPONSE = 'competitor_response',
  AUTOMATED_REPRICING = 'automated_repricing',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  INVENTORY_LEVEL = 'inventory_level',
  DEMAND_CHANGE = 'demand_change',
  PROMOTION_START = 'promotion_start',
  PROMOTION_END = 'promotion_end',
  SEASONAL_ADJUSTMENT = 'seasonal_adjustment',
  MARGIN_OPTIMIZATION = 'margin_optimization',
  BUY_BOX_RECOVERY = 'buy_box_recovery',
  UNKNOWN = 'unknown',
}

export enum MarketCondition {
  NORMAL = 'normal',
  HIGH_COMPETITION = 'high_competition',
  LOW_COMPETITION = 'low_competition',
  PRICE_WAR = 'price_war',
  STABLE_MARKET = 'stable_market',
  VOLATILE_MARKET = 'volatile_market',
  HOLIDAY_SEASON = 'holiday_season',
  NEW_PRODUCT_LAUNCH = 'new_product_launch',
}

@Entity('price_history')
@Index(['asin', 'timestamp'])
@Index(['competitorProductId', 'timestamp'])
@Index(['sellerName', 'timestamp'])
@Index(['buyBoxWinner', 'timestamp'])
@Index(['priceChangeReason'])
export class PriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'asin', length: 10 })
  asin: string;

  @Column({ name: 'seller_name' })
  sellerName: string;

  @Column({ name: 'seller_id', nullable: true })
  sellerId?: string;

  @Column({ name: 'competitor_product_id', nullable: true })
  competitorProductId?: string;

  @ManyToOne(() => CompetitorProduct, { nullable: true })
  @JoinColumn({ name: 'competitor_product_id' })
  competitorProduct?: CompetitorProduct;

  // Price Information
  @Column({ name: 'price', type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'previous_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  previousPrice?: number;

  @Column({ name: 'price_change', type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceChange?: number; // Absolute change

  @Column({ name: 'price_change_percent', type: 'decimal', precision: 8, scale: 4, nullable: true })
  priceChangePercent?: number;

  @Column({ name: 'currency', length: 3, default: 'USD' })
  currency: string;

  // Shipping and Total Cost
  @Column({ name: 'shipping_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  shippingCost?: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  totalCost?: number; // Price + shipping

  @Column({ name: 'is_prime_eligible', default: false })
  isPrimeEligible: boolean;

  @Column({ name: 'fulfillment_type', nullable: true })
  fulfillmentType?: string; // 'FBA', 'FBM', 'Prime'

  // Market Position
  @Column({ name: 'buy_box_winner', default: false })
  buyBoxWinner: boolean;

  @Column({ name: 'market_position', nullable: true })
  marketPosition?: number; // 1 = lowest, 2 = second lowest, etc.

  @Column({ name: 'total_competitors', nullable: true })
  totalCompetitors?: number;

  @Column({ name: 'price_rank', nullable: true })
  priceRank?: number; // Rank among all sellers

  // Context Information
  @Column({
    type: 'enum',
    enum: PriceChangeReason,
    name: 'price_change_reason',
    default: PriceChangeReason.UNKNOWN,
  })
  priceChangeReason: PriceChangeReason;

  @Column({
    type: 'enum',
    enum: MarketCondition,
    name: 'market_condition',
    default: MarketCondition.NORMAL,
  })
  marketCondition: MarketCondition;

  @Column({ name: 'inventory_level', nullable: true })
  inventoryLevel?: number;

  @Column({ name: 'availability_message', nullable: true })
  availabilityMessage?: string;

  // Competitive Analysis
  @Column({ type: 'json', nullable: true })
  competitiveSnapshot?: {
    lowestPrice: number;
    highestPrice: number;
    averagePrice: number;
    medianPrice: number;
    buyBoxPrice: number;
    priceSpread: number; // highest - lowest
    competitorDistribution: {
      fba: number;
      fbm: number;
      prime: number;
    };
  };

  // Performance Metrics
  @Column({ type: 'json', nullable: true })
  performanceMetrics?: {
    salesRankBefore?: number;
    salesRankAfter?: number;
    estimatedSalesVelocity?: number;
    pageViews?: number;
    conversionRate?: number;
    buyBoxPercentage?: number; // For the time period
  };

  // External Factors
  @Column({ type: 'json', nullable: true })
  externalFactors?: {
    promotions?: Array<{
      type: string;
      discount: number;
      startDate: Date;
      endDate?: Date;
    }>;
    events?: Array<{
      type: 'holiday' | 'sale_event' | 'competitor_promotion' | 'stock_out';
      description: string;
      impact: 'positive' | 'negative' | 'neutral';
    }>;
    marketTrends?: {
      demand: 'increasing' | 'decreasing' | 'stable';
      competition: 'increasing' | 'decreasing' | 'stable';
      seasonality: number; // 0-100 seasonal impact
    };
  };

  // Data Quality and Source
  @Column({ name: 'data_source', default: 'web_scraping' })
  dataSource: string; // 'amazon_api', 'web_scraping', 'manual', 'third_party'

  @Column({ name: 'data_confidence', type: 'decimal', precision: 5, scale: 2, default: 100 })
  dataConfidence: number; // 0-100% confidence in data accuracy

  @Column({ name: 'scrape_session_id', nullable: true })
  scrapeSessionId?: string;

  @Column({ name: 'response_time_ms', nullable: true })
  responseTimeMs?: number; // Time to detect/respond to this price

  // Validation and Anomaly Detection
  @Column({ name: 'is_anomaly', default: false })
  isAnomaly: boolean;

  @Column({ name: 'anomaly_score', type: 'decimal', precision: 5, 2, nullable: true })
  anomalyScore?: number; // 0-100, higher = more unusual

  @Column({ name: 'anomaly_reasons', type: 'json', nullable: true })
  anomalyReasons?: string[]; // Why this price point is considered anomalous

  @Column({ name: 'validation_status', default: 'pending' })
  validationStatus: 'pending' | 'validated' | 'flagged' | 'corrected';

  // Time and Frequency
  @Column({ name: 'timestamp', type: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'day_of_week' })
  dayOfWeek: number; // 0-6, Sunday = 0

  @Column({ name: 'hour_of_day' })
  hourOfDay: number; // 0-23

  @Column({ name: 'is_business_hours', default: true })
  isBusinessHours: boolean;

  @Column({ name: 'timezone', default: 'UTC' })
  timezone: string;

  // Aggregation helpers
  @Column({ name: 'date_key', type: 'date' })
  dateKey: Date; // For daily aggregations

  @Column({ name: 'week_key' })
  weekKey: string; // YYYY-WW format

  @Column({ name: 'month_key' })
  monthKey: string; // YYYY-MM format

  // Additional metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    sessionData?: any;
    customAttributes?: { [key: string]: any };
  };

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Business Logic Methods
  isSignificantChange(): boolean {
    if (!this.priceChangePercent) return false;
    return Math.abs(this.priceChangePercent) >= 1; // 1% or more
  }

  isPriceIncrease(): boolean {
    return (this.priceChange || 0) > 0;
  }

  isPriceDecrease(): boolean {
    return (this.priceChange || 0) < 0;
  }

  getChangeDirection(): 'increase' | 'decrease' | 'no_change' {
    const change = this.priceChange || 0;
    if (change > 0) return 'increase';
    if (change < 0) return 'decrease';
    return 'no_change';
  }

  getCompetitiveAdvantage(): string | null {
    if (!this.competitiveSnapshot) return null;

    const { lowestPrice, buyBoxPrice } = this.competitiveSnapshot;
    
    if (this.price === lowestPrice) {
      return 'lowest_price';
    }
    
    if (this.buyBoxWinner) {
      return 'buy_box_winner';
    }
    
    if (this.price <= buyBoxPrice && this.isPrimeEligible) {
      return 'prime_competitive';
    }
    
    if (this.price <= this.competitiveSnapshot.averagePrice) {
      return 'below_average';
    }
    
    return null;
  }

  calculateMarketShare(): number {
    if (!this.totalCompetitors || this.totalCompetitors === 0) return 0;
    
    // Simplified market share calculation based on price position
    if (this.buyBoxWinner) return 60; // Buy Box typically gets 60-80% of sales
    if (this.priceRank === 1) return 25; // Lowest price gets significant share
    if (this.priceRank && this.priceRank <= 3) return 10; // Top 3 prices get some share
    
    return Math.max(1, 5 / this.totalCompetitors); // Others share remaining
  }

  isOptimalPricing(): boolean {
    if (!this.competitiveSnapshot) return false;
    
    const isCompetitive = this.price <= this.competitiveSnapshot.averagePrice;
    const hasBuyBox = this.buyBoxWinner;
    const isProfitable = this.priceChangeReason !== PriceChangeReason.MARGIN_OPTIMIZATION; // Simplified check
    
    return isCompetitive && (hasBuyBox || this.priceRank === 1) && isProfitable;
  }

  detectAnomalies(): string[] {
    const anomalies: string[] = [];
    
    if (!this.previousPrice) return anomalies;
    
    const changePercent = Math.abs(this.priceChangePercent || 0);
    
    // Large price changes
    if (changePercent > 50) {
      anomalies.push('extreme_price_change');
    } else if (changePercent > 20) {
      anomalies.push('large_price_change');
    }
    
    // Price vs competition
    if (this.competitiveSnapshot) {
      const { lowestPrice, highestPrice } = this.competitiveSnapshot;
      
      if (this.price < lowestPrice * 0.8) {
        anomalies.push('unusually_low_price');
      }
      
      if (this.price > highestPrice * 1.2) {
        anomalies.push('unusually_high_price');
      }
    }
    
    // Time-based anomalies
    if (this.hourOfDay < 6 || this.hourOfDay > 22) {
      anomalies.push('unusual_time');
    }
    
    return anomalies;
  }

  getTimeContext(): {
    period: 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';
    businessDay: boolean;
    season: 'spring' | 'summer' | 'fall' | 'winter';
  } {
    const hour = this.hourOfDay;
    const day = this.dayOfWeek;
    const month = this.timestamp.getMonth() + 1;
    
    let period: 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';
    if (hour >= 5 && hour < 9) period = 'early_morning';
    else if (hour >= 9 && hour < 12) period = 'morning';
    else if (hour >= 12 && hour < 17) period = 'afternoon';
    else if (hour >= 17 && hour < 22) period = 'evening';
    else period = 'night';
    
    const businessDay = day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
    
    let season: 'spring' | 'summer' | 'fall' | 'winter';
    if (month >= 3 && month <= 5) season = 'spring';
    else if (month >= 6 && month <= 8) season = 'summer';
    else if (month >= 9 && month <= 11) season = 'fall';
    else season = 'winter';
    
    return { period, businessDay, season };
  }

  // Static helper methods
  static calculatePriceVolatility(history: PriceHistory[]): number {
    if (history.length < 2) return 0;
    
    const prices = history.map(h => h.price);
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    const standardDeviation = Math.sqrt(variance);
    
    return (standardDeviation / mean) * 100; // Coefficient of variation as percentage
  }

  static findPriceTrend(history: PriceHistory[]): 'upward' | 'downward' | 'stable' | 'volatile' {
    if (history.length < 3) return 'stable';
    
    // Sort by timestamp
    const sorted = [...history].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const recent = sorted.slice(-5); // Last 5 data points
    const increases = recent.filter((h, i) => i > 0 && h.price > recent[i - 1].price).length;
    const decreases = recent.filter((h, i) => i > 0 && h.price < recent[i - 1].price).length;
    
    const volatility = this.calculatePriceVolatility(recent);
    
    if (volatility > 10) return 'volatile';
    if (increases > decreases + 1) return 'upward';
    if (decreases > increases + 1) return 'downward';
    return 'stable';
  }

  static createPriceEntry(data: {
    userId: string;
    asin: string;
    sellerName: string;
    price: number;
    previousPrice?: number;
    buyBoxWinner?: boolean;
    competitiveSnapshot?: any;
    reason?: PriceChangeReason;
    source?: string;
  }): Partial<PriceHistory> {
    const now = new Date();
    const priceChange = data.previousPrice ? data.price - data.previousPrice : null;
    const priceChangePercent = data.previousPrice && data.previousPrice > 0 
      ? ((data.price - data.previousPrice) / data.previousPrice) * 100 
      : null;

    return {
      userId: data.userId,
      asin: data.asin,
      sellerName: data.sellerName,
      price: data.price,
      previousPrice: data.previousPrice,
      priceChange,
      priceChangePercent,
      buyBoxWinner: data.buyBoxWinner || false,
      competitiveSnapshot: data.competitiveSnapshot,
      priceChangeReason: data.reason || PriceChangeReason.UNKNOWN,
      dataSource: data.source || 'web_scraping',
      timestamp: now,
      dayOfWeek: now.getDay(),
      hourOfDay: now.getHours(),
      isBusinessHours: now.getDay() >= 1 && now.getDay() <= 5 && now.getHours() >= 9 && now.getHours() <= 17,
      dateKey: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      weekKey: `${now.getFullYear()}-${Math.ceil(now.getDate() / 7).toString().padStart(2, '0')}`,
      monthKey: `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`,
      dataConfidence: 100,
      validationStatus: 'pending',
    };
  }
}