import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';

export enum CompetitorStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  OUT_OF_STOCK = 'out_of_stock',
  SUSPENDED = 'suspended',
  PRICE_ERROR = 'price_error',
}

export enum FulfillmentType {
  FBA = 'fba',
  FBM = 'fbm',
  PRIME = 'prime',
  UNKNOWN = 'unknown',
}

export enum SellerRating {
  EXCELLENT = 'excellent', // 95-100%
  VERY_GOOD = 'very_good', // 90-94%
  GOOD = 'good', // 85-89%
  FAIR = 'fair', // 80-84%
  POOR = 'poor', // <80%
  UNKNOWN = 'unknown',
}

export enum DataSource {
  AMAZON_API = 'amazon_api',
  WEB_SCRAPING = 'web_scraping',
  MANUAL_ENTRY = 'manual_entry',
  THIRD_PARTY_API = 'third_party_api',
}

@Entity('competitor_products')
@Index(['asin', 'sellerName'])
@Index(['asin', 'lastScrapedAt'])
@Index(['userId', 'isMonitored'])
@Index(['currentPrice'])
@Index(['buyBoxWinner'])
export class CompetitorProduct {
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

  @Column({ name: 'product_title' })
  productTitle: string;

  @Column({ name: 'product_category', nullable: true })
  productCategory?: string;

  @Column({ name: 'brand_name', nullable: true })
  brandName?: string;

  // Pricing Information
  @Column({ name: 'current_price', type: 'decimal', precision: 10, scale: 2 })
  currentPrice: number;

  @Column({ name: 'previous_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  previousPrice?: number;

  @Column({ name: 'lowest_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  lowestPrice?: number;

  @Column({ name: 'highest_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  highestPrice?: number;

  @Column({ name: 'average_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  averagePrice?: number;

  @Column({ name: 'price_currency', length: 3, default: 'USD' })
  priceCurrency: string;

  // Shipping and Fulfillment
  @Column({ name: 'shipping_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  shippingPrice?: number;

  @Column({
    type: 'enum',
    enum: FulfillmentType,
    name: 'fulfillment_type',
    default: FulfillmentType.UNKNOWN,
  })
  fulfillmentType: FulfillmentType;

  @Column({ name: 'is_prime_eligible', default: false })
  isPrimeEligible: boolean;

  @Column({ name: 'shipping_time', nullable: true })
  shippingTime?: string; // e.g., "1-2 business days"

  @Column({ name: 'delivery_date', type: 'date', nullable: true })
  estimatedDeliveryDate?: Date;

  // Seller Information
  @Column({
    type: 'enum',
    enum: SellerRating,
    name: 'seller_rating',
    default: SellerRating.UNKNOWN,
  })
  sellerRating: SellerRating;

  @Column({ name: 'seller_feedback_count', nullable: true })
  sellerFeedbackCount?: number;

  @Column({ name: 'seller_feedback_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  sellerFeedbackPercentage?: number;

  @Column({ name: 'seller_location', nullable: true })
  sellerLocation?: string;

  @Column({ name: 'seller_business_type', nullable: true })
  sellerBusinessType?: string; // 'individual' | 'business'

  // Buy Box Information
  @Column({ name: 'buy_box_winner', default: false })
  buyBoxWinner: boolean;

  @Column({ name: 'buy_box_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  buyBoxPercentage?: number; // Historical win rate

  @Column({ name: 'last_buy_box_win', type: 'timestamp', nullable: true })
  lastBuyBoxWin?: Date;

  @Column({ name: 'buy_box_eligible', nullable: true })
  buyBoxEligible?: boolean;

  // Stock and Availability
  @Column({
    type: 'enum',
    enum: CompetitorStatus,
    name: 'competitor_status',
    default: CompetitorStatus.ACTIVE,
  })
  competitorStatus: CompetitorStatus;

  @Column({ name: 'stock_quantity', nullable: true })
  stockQuantity?: number;

  @Column({ name: 'is_in_stock', default: true })
  isInStock: boolean;

  @Column({ name: 'last_in_stock', type: 'timestamp', nullable: true })
  lastInStock?: Date;

  @Column({ name: 'out_of_stock_count', default: 0 })
  outOfStockCount: number;

  @Column({ name: 'back_order_allowed', nullable: true })
  backOrderAllowed?: boolean;

  // Product Details
  @Column({ name: 'product_condition', nullable: true })
  productCondition?: string; // 'new', 'used', 'refurbished'

  @Column({ name: 'product_images', type: 'json', nullable: true })
  productImages?: string[];

  @Column({ name: 'product_features', type: 'json', nullable: true })
  productFeatures?: string[];

  @Column({ name: 'product_description', type: 'text', nullable: true })
  productDescription?: string;

  // Tracking and Monitoring
  @Column({ name: 'is_monitored', default: true })
  isMonitored: boolean;

  @Column({ name: 'monitoring_frequency', default: 60 })
  monitoringFrequency: number; // minutes

  @Column({ name: 'last_scraped_at', type: 'timestamp' })
  lastScrapedAt: Date;

  @Column({ name: 'next_scrape_at', type: 'timestamp' })
  nextScrapeAt: Date;

  @Column({ name: 'scrape_count', default: 0 })
  scrapeCount: number;

  @Column({ name: 'failed_scrape_count', default: 0 })
  failedScrapeCount: number;

  @Column({
    type: 'enum',
    enum: DataSource,
    name: 'data_source',
    default: DataSource.WEB_SCRAPING,
  })
  dataSource: DataSource;

  // Performance Metrics
  @Column({ type: 'json', nullable: true })
  performanceMetrics?: {
    priceChangeFrequency: number; // changes per week
    avgPriceChange: number; // percentage
    priceVolatility: number; // standard deviation
    responseTime: number; // minutes to respond to price changes
    competitiveIndex: number; // 0-100 how competitive this seller is
    reliabilityScore: number; // 0-100 based on stock availability
  };

  // Price History Summary
  @Column({ type: 'json', nullable: true })
  priceHistorySummary?: {
    daily?: Array<{
      date: Date;
      price: number;
      buyBox: boolean;
    }>;
    weekly?: Array<{
      weekStart: Date;
      avgPrice: number;
      minPrice: number;
      maxPrice: number;
      buyBoxDays: number;
    }>;
    monthly?: Array<{
      month: number;
      year: number;
      avgPrice: number;
      buyBoxPercentage: number;
    }>;
  };

  // Alerts and Notifications
  @Column({ type: 'json', nullable: true })
  alertSettings?: {
    priceDropAlert: boolean;
    priceIncreaseAlert: boolean;
    buyBoxLossAlert: boolean;
    stockOutAlert: boolean;
    thresholds: {
      priceChangePercentage: number;
      priceAbsolute?: number;
    };
  };

  // Error Tracking
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'last_error_time', type: 'timestamp', nullable: true })
  lastErrorTime?: Date;

  @Column({ name: 'consecutive_errors', default: 0 })
  consecutiveErrors: number;

  // Additional Metadata
  @Column({ type: 'json', nullable: true })
  metadata?: {
    keywords?: string[];
    seasonality?: {
      peakMonths: number[];
      lowMonths: number[];
    };
    promotions?: Array<{
      type: string;
      description: string;
      startDate: Date;
      endDate?: Date;
    }>;
    customAttributes?: { [key: string]: any };
  };

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isActive(): boolean {
    return this.competitorStatus === CompetitorStatus.ACTIVE && this.isInStock;
  }

  isReliableCompetitor(): boolean {
    const reliability = this.performanceMetrics?.reliabilityScore || 0;
    const feedbackPercentage = this.sellerFeedbackPercentage || 0;
    const feedbackCount = this.sellerFeedbackCount || 0;

    return reliability >= 70 && feedbackPercentage >= 90 && feedbackCount >= 100;
  }

  isPrimeCompetitor(): boolean {
    return this.isPrimeEligible || this.fulfillmentType === FulfillmentType.PRIME;
  }

  calculatePriceChangePercent(): number {
    if (!this.previousPrice || this.previousPrice === 0) return 0;
    return ((this.currentPrice - this.previousPrice) / this.previousPrice) * 100;
  }

  getPricePosition(allCompetitorPrices: number[]): 'lowest' | 'below_average' | 'average' | 'above_average' | 'highest' {
    const sortedPrices = allCompetitorPrices.sort((a, b) => a - b);
    const myIndex = sortedPrices.indexOf(this.currentPrice);
    const totalCompetitors = sortedPrices.length;

    if (myIndex === 0) return 'lowest';
    if (myIndex === totalCompetitors - 1) return 'highest';
    
    const position = myIndex / (totalCompetitors - 1);
    if (position <= 0.25) return 'below_average';
    if (position >= 0.75) return 'above_average';
    return 'average';
  }

  getCompetitiveAdvantages(): string[] {
    const advantages: string[] = [];

    if (this.buyBoxWinner) {
      advantages.push('Currently owns Buy Box');
    }

    if (this.isPrimeEligible) {
      advantages.push('Prime eligible');
    }

    if (this.fulfillmentType === FulfillmentType.FBA) {
      advantages.push('FBA fulfillment');
    }

    if (this.sellerFeedbackPercentage && this.sellerFeedbackPercentage >= 95) {
      advantages.push('Excellent seller rating');
    }

    if (this.performanceMetrics?.reliabilityScore && this.performanceMetrics.reliabilityScore >= 90) {
      advantages.push('High reliability score');
    }

    return advantages;
  }

  getWeaknesses(): string[] {
    const weaknesses: string[] = [];

    if (!this.isInStock) {
      weaknesses.push('Currently out of stock');
    }

    if (!this.isPrimeEligible) {
      weaknesses.push('Not Prime eligible');
    }

    if (this.fulfillmentType === FulfillmentType.FBM) {
      weaknesses.push('Merchant fulfilled');
    }

    if (this.sellerFeedbackPercentage && this.sellerFeedbackPercentage < 90) {
      weaknesses.push('Lower seller rating');
    }

    if (this.outOfStockCount > 5) {
      weaknesses.push('Frequent stock issues');
    }

    if (this.consecutiveErrors > 3) {
      weaknesses.push('Data reliability issues');
    }

    return weaknesses;
  }

  shouldBeMonitored(): boolean {
    // Don't monitor if seller is unreliable
    if (this.consecutiveErrors > 10) return false;
    
    // Don't monitor if frequently out of stock
    if (this.outOfStockCount > 20) return false;
    
    // Don't monitor if price is too high (more than 50% above lowest)
    if (this.lowestPrice && this.currentPrice > this.lowestPrice * 1.5) return false;

    return true;
  }

  needsUpdate(): boolean {
    const now = new Date();
    return now >= this.nextScrapeAt;
  }

  updatePrice(
    newPrice: number,
    options?: {
      buyBoxWinner?: boolean;
      inStock?: boolean;
      shippingPrice?: number;
      dataSource?: DataSource;
    }
  ): void {
    this.previousPrice = this.currentPrice;
    this.currentPrice = newPrice;

    // Update price bounds
    if (!this.lowestPrice || newPrice < this.lowestPrice) {
      this.lowestPrice = newPrice;
    }
    if (!this.highestPrice || newPrice > this.highestPrice) {
      this.highestPrice = newPrice;
    }

    // Update status
    if (options?.buyBoxWinner !== undefined) {
      this.buyBoxWinner = options.buyBoxWinner;
      if (options.buyBoxWinner) {
        this.lastBuyBoxWin = new Date();
      }
    }

    if (options?.inStock !== undefined) {
      this.isInStock = options.inStock;
      if (options.inStock) {
        this.lastInStock = new Date();
        this.competitorStatus = CompetitorStatus.ACTIVE;
      } else {
        this.outOfStockCount++;
        this.competitorStatus = CompetitorStatus.OUT_OF_STOCK;
      }
    }

    if (options?.shippingPrice !== undefined) {
      this.shippingPrice = options.shippingPrice;
    }

    if (options?.dataSource) {
      this.dataSource = options.dataSource;
    }

    // Update tracking info
    this.lastScrapedAt = new Date();
    this.scrapeCount++;
    this.consecutiveErrors = 0; // Reset on successful update

    // Schedule next scrape
    this.nextScrapeAt = new Date(Date.now() + this.monitoringFrequency * 60 * 1000);
  }

  recordError(error: string): void {
    this.lastError = error;
    this.lastErrorTime = new Date();
    this.consecutiveErrors++;
    this.failedScrapeCount++;

    // Increase monitoring frequency on errors (up to max)
    if (this.consecutiveErrors > 3) {
      this.monitoringFrequency = Math.min(this.monitoringFrequency * 1.5, 480); // Max 8 hours
    }
  }

  calculateCompetitiveIndex(): number {
    let score = 50; // Base score

    // Price competitiveness (30% weight)
    if (this.performanceMetrics?.priceChangeFrequency) {
      const freq = this.performanceMetrics.priceChangeFrequency;
      score += Math.min(20, freq * 2); // More frequent changes = more competitive
    }

    // Buy Box performance (25% weight)
    if (this.buyBoxPercentage) {
      score += this.buyBoxPercentage * 0.25;
    }

    // Seller quality (20% weight)
    if (this.sellerFeedbackPercentage) {
      score += (this.sellerFeedbackPercentage - 80) * 0.2;
    }

    // Fulfillment advantages (15% weight)
    if (this.isPrimeEligible) score += 10;
    if (this.fulfillmentType === FulfillmentType.FBA) score += 5;

    // Reliability (10% weight)
    const reliability = this.performanceMetrics?.reliabilityScore || 50;
    score += (reliability - 50) * 0.1;

    return Math.max(0, Math.min(100, score));
  }

  // Static factory methods
  static createFromAmazonData(data: {
    userId: string;
    asin: string;
    sellerName: string;
    price: number;
    sellerId?: string;
    buyBoxWinner?: boolean;
    prime?: boolean;
    fulfillmentType?: FulfillmentType;
  }): Partial<CompetitorProduct> {
    return {
      userId: data.userId,
      asin: data.asin,
      sellerName: data.sellerName,
      sellerId: data.sellerId,
      currentPrice: data.price,
      buyBoxWinner: data.buyBoxWinner || false,
      isPrimeEligible: data.prime || false,
      fulfillmentType: data.fulfillmentType || FulfillmentType.UNKNOWN,
      dataSource: DataSource.AMAZON_API,
      isMonitored: true,
      monitoringFrequency: 60, // 1 hour default
      lastScrapedAt: new Date(),
      nextScrapeAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
      competitorStatus: CompetitorStatus.ACTIVE,
      isInStock: true,
    };
  }

  static createManualEntry(data: {
    userId: string;
    asin: string;
    sellerName: string;
    price: number;
    notes?: string;
  }): Partial<CompetitorProduct> {
    return {
      userId: data.userId,
      asin: data.asin,
      sellerName: data.sellerName,
      currentPrice: data.price,
      dataSource: DataSource.MANUAL_ENTRY,
      isMonitored: false, // Manual entries not monitored by default
      lastScrapedAt: new Date(),
      nextScrapeAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      competitorStatus: CompetitorStatus.ACTIVE,
      isInStock: true,
      notes: data.notes,
    };
  }
}