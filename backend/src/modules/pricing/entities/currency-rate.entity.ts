import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum CurrencyPair {
  USD_TRY = 'USD_TRY',
  USD_EUR = 'USD_EUR',
  USD_GBP = 'USD_GBP',
  EUR_TRY = 'EUR_TRY',
  EUR_USD = 'EUR_USD',
  GBP_TRY = 'GBP_TRY',
  GBP_USD = 'GBP_USD',
  TRY_USD = 'TRY_USD',
  TRY_EUR = 'TRY_EUR',
}

export enum RateSource {
  CENTRAL_BANK = 'central_bank',
  COMMERCIAL_BANK = 'commercial_bank',
  FOREX_API = 'forex_api',
  MANUAL_ENTRY = 'manual_entry',
  CALCULATED = 'calculated',
}

@Entity('currency_rates')
@Index(['currencyPair', 'effectiveDate'])
@Index(['source'])
@Index(['isActive'])
export class CurrencyRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: CurrencyPair,
    name: 'currency_pair',
  })
  currencyPair: CurrencyPair;

  @Column({ name: 'base_currency', length: 3 })
  baseCurrency: string; // e.g., 'USD'

  @Column({ name: 'quote_currency', length: 3 })
  quoteCurrency: string; // e.g., 'TRY'

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 12, scale: 6 })
  exchangeRate: number;

  @Column({ name: 'bid_rate', type: 'decimal', precision: 12, scale: 6, nullable: true })
  bidRate?: number; // Buy rate

  @Column({ name: 'ask_rate', type: 'decimal', precision: 12, scale: 6, nullable: true })
  askRate?: number; // Sell rate

  @Column({ name: 'mid_rate', type: 'decimal', precision: 12, scale: 6, nullable: true })
  midRate?: number; // (bid + ask) / 2

  @Column({
    type: 'enum',
    enum: RateSource,
  })
  source: RateSource;

  @Column({ name: 'source_name', nullable: true })
  sourceName?: string; // e.g., 'Central Bank of Turkey', 'XE.com'

  @Column({ name: 'effective_date', type: 'timestamp' })
  effectiveDate: Date;

  @Column({ name: 'expiry_date', type: 'timestamp', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Rate change tracking
  @Column({ name: 'previous_rate', type: 'decimal', precision: 12, scale: 6, nullable: true })
  previousRate?: number;

  @Column({ name: 'change_amount', type: 'decimal', precision: 12, scale: 6, nullable: true })
  changeAmount?: number;

  @Column({ name: 'change_percentage', type: 'decimal', precision: 8, scale: 4, nullable: true })
  changePercentage?: number;

  // Volatility and trend data
  @Column({ type: 'json', nullable: true })
  historicalData?: {
    daily?: Array<{
      date: Date;
      rate: number;
      high: number;
      low: number;
      volume?: number;
    }>;
    weekly?: Array<{
      startDate: Date;
      endDate: Date;
      openRate: number;
      closeRate: number;
      highRate: number;
      lowRate: number;
      avgRate: number;
    }>;
    monthly?: Array<{
      month: number;
      year: number;
      avgRate: number;
      volatility: number;
    }>;
  };

  @Column({ name: 'volatility_index', type: 'decimal', precision: 8, scale: 4, nullable: true })
  volatilityIndex?: number; // 0-100, higher = more volatile

  @Column({ name: 'trend_direction', nullable: true })
  trendDirection?: 'up' | 'down' | 'stable' | 'volatile';

  // Confidence and reliability
  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  confidenceScore?: number; // 0-100, higher = more reliable

  @Column({ name: 'last_updated_by', nullable: true })
  lastUpdatedBy?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: {
    apiResponse?: any;
    updateFrequency?: string;
    nextUpdateTime?: Date;
    dataQuality?: 'excellent' | 'good' | 'fair' | 'poor';
    anomalyDetected?: boolean;
    anomalyReason?: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isRateFresh(maxAgeMinutes: number = 60): boolean {
    const ageMinutes = (Date.now() - this.effectiveDate.getTime()) / (1000 * 60);
    return ageMinutes <= maxAgeMinutes;
  }

  isRateExpired(): boolean {
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
  }

  getSpread(): number | null {
    if (!this.bidRate || !this.askRate) return null;
    return this.askRate - this.bidRate;
  }

  getSpreadPercentage(): number | null {
    const spread = this.getSpread();
    if (!spread || !this.midRate) return null;
    return (spread / this.midRate) * 100;
  }

  convert(amount: number, direction: 'base_to_quote' | 'quote_to_base' = 'base_to_quote'): number {
    if (direction === 'base_to_quote') {
      return amount * this.exchangeRate;
    } else {
      return amount / this.exchangeRate;
    }
  }

  convertWithFees(
    amount: number,
    direction: 'base_to_quote' | 'quote_to_base' = 'base_to_quote',
    feePercentage: number = 0
  ): {
    convertedAmount: number;
    fees: number;
    totalAmount: number;
    effectiveRate: number;
  } {
    const convertedAmount = this.convert(amount, direction);
    const fees = convertedAmount * (feePercentage / 100);
    const totalAmount = convertedAmount + fees;
    const effectiveRate = direction === 'base_to_quote' 
      ? totalAmount / amount 
      : amount / totalAmount;

    return {
      convertedAmount: Math.round(convertedAmount * 100) / 100,
      fees: Math.round(fees * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      effectiveRate: Math.round(effectiveRate * 1000000) / 1000000, // 6 decimal places
    };
  }

  calculateRateQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    let score = 100;

    // Age factor
    const ageMinutes = (Date.now() - this.effectiveDate.getTime()) / (1000 * 60);
    if (ageMinutes > 60) score -= 20;
    if (ageMinutes > 180) score -= 20;
    if (ageMinutes > 1440) score -= 30; // > 24 hours

    // Source reliability
    if (this.source === RateSource.MANUAL_ENTRY) score -= 15;
    if (this.source === RateSource.CALCULATED) score -= 10;

    // Volatility factor
    if (this.volatilityIndex && this.volatilityIndex > 70) score -= 15;
    if (this.volatilityIndex && this.volatilityIndex > 85) score -= 15;

    // Confidence score
    if (this.confidenceScore && this.confidenceScore < 80) score -= 10;
    if (this.confidenceScore && this.confidenceScore < 60) score -= 20;

    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  updateTrendDirection(): void {
    if (!this.previousRate) {
      this.trendDirection = 'stable';
      return;
    }

    const changePercent = Math.abs(this.changePercentage || 0);
    
    if (changePercent < 0.1) {
      this.trendDirection = 'stable';
    } else if (changePercent > 2.0) {
      this.trendDirection = 'volatile';
    } else if ((this.changeAmount || 0) > 0) {
      this.trendDirection = 'up';
    } else {
      this.trendDirection = 'down';
    }
  }

  addHistoricalDataPoint(data: {
    rate: number;
    high?: number;
    low?: number;
    volume?: number;
  }): void {
    if (!this.historicalData) {
      this.historicalData = { daily: [] };
    }

    if (!this.historicalData.daily) {
      this.historicalData.daily = [];
    }

    this.historicalData.daily.push({
      date: new Date(),
      rate: data.rate,
      high: data.high || data.rate,
      low: data.low || data.rate,
      volume: data.volume,
    });

    // Keep only last 30 days
    if (this.historicalData.daily.length > 30) {
      this.historicalData.daily = this.historicalData.daily.slice(-30);
    }

    // Calculate volatility
    this.updateVolatilityIndex();
  }

  private updateVolatilityIndex(): void {
    if (!this.historicalData?.daily || this.historicalData.daily.length < 7) {
      return;
    }

    const rates = this.historicalData.daily.slice(-7).map(d => d.rate);
    const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Normalize to 0-100 scale (simplified)
    this.volatilityIndex = Math.min(100, (standardDeviation / mean) * 1000);
  }

  getRecommendedAction(): {
    action: 'buy' | 'sell' | 'hold' | 'wait';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
  } {
    const quality = this.calculateRateQuality();
    const changePercent = Math.abs(this.changePercentage || 0);

    if (quality === 'poor') {
      return {
        action: 'wait',
        confidence: 'low',
        reason: 'Rate data quality is poor, wait for better data',
      };
    }

    if (this.trendDirection === 'volatile') {
      return {
        action: 'wait',
        confidence: 'medium',
        reason: 'High volatility detected, wait for stability',
      };
    }

    if (changePercent > 1.5 && this.trendDirection === 'down') {
      return {
        action: 'buy',
        confidence: quality === 'excellent' ? 'high' : 'medium',
        reason: 'Significant drop detected, good buying opportunity',
      };
    }

    if (changePercent > 1.5 && this.trendDirection === 'up') {
      return {
        action: 'sell',
        confidence: quality === 'excellent' ? 'high' : 'medium',
        reason: 'Significant rise detected, consider selling',
      };
    }

    return {
      action: 'hold',
      confidence: 'medium',
      reason: 'Stable conditions, maintain current position',
    };
  }

  // Static factory methods
  static createFromApiResponse(apiData: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    source: string;
    timestamp?: Date;
  }): Partial<CurrencyRate> {
    const currencyPair = `${apiData.baseCurrency}_${apiData.quoteCurrency}` as CurrencyPair;
    
    return {
      currencyPair,
      baseCurrency: apiData.baseCurrency,
      quoteCurrency: apiData.quoteCurrency,
      exchangeRate: apiData.rate,
      source: RateSource.FOREX_API,
      sourceName: apiData.source,
      effectiveDate: apiData.timestamp || new Date(),
      isActive: true,
      confidenceScore: 85, // Default confidence for API data
    };
  }

  static createManualRate(data: {
    baseCurrency: string;
    quoteCurrency: string;
    rate: number;
    createdBy: string;
  }): Partial<CurrencyRate> {
    const currencyPair = `${data.baseCurrency}_${data.quoteCurrency}` as CurrencyPair;
    
    return {
      currencyPair,
      baseCurrency: data.baseCurrency,
      quoteCurrency: data.quoteCurrency,
      exchangeRate: data.rate,
      source: RateSource.MANUAL_ENTRY,
      sourceName: 'Manual Entry',
      effectiveDate: new Date(),
      lastUpdatedBy: data.createdBy,
      isActive: true,
      confidenceScore: 70, // Lower confidence for manual entry
    };
  }

  // Calculate cross rate (e.g., EUR/TRY from USD/EUR and USD/TRY)
  static calculateCrossRate(
    baseRate: CurrencyRate, // e.g., USD/EUR
    quoteRate: CurrencyRate // e.g., USD/TRY
  ): Partial<CurrencyRate> | null {
    // Only works if both rates share the same base currency
    if (baseRate.baseCurrency !== quoteRate.baseCurrency) {
      return null;
    }

    const crossRateValue = quoteRate.exchangeRate / baseRate.exchangeRate;
    const currencyPair = `${baseRate.quoteCurrency}_${quoteRate.quoteCurrency}` as CurrencyPair;
    
    return {
      currencyPair,
      baseCurrency: baseRate.quoteCurrency,
      quoteCurrency: quoteRate.quoteCurrency,
      exchangeRate: crossRateValue,
      source: RateSource.CALCULATED,
      sourceName: 'Cross Rate Calculation',
      effectiveDate: new Date(),
      isActive: true,
      confidenceScore: Math.min(baseRate.confidenceScore || 70, quoteRate.confidenceScore || 70) - 10,
    };
  }
}