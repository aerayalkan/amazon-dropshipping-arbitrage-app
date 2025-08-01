import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum BuyBoxEvent {
  WON = 'won',
  LOST = 'lost',
  MAINTAINED = 'maintained',
  REGAINED = 'regained',
  NEVER_HAD = 'never_had',
}

export enum LossReason {
  PRICE_UNDERCUT = 'price_undercut',
  OUT_OF_STOCK = 'out_of_stock',
  PERFORMANCE_METRICS = 'performance_metrics',
  SHIPPING_SPEED = 'shipping_speed',
  SELLER_RATING = 'seller_rating',
  FULFILLMENT_METHOD = 'fulfillment_method',
  ALGORITHM_CHANGE = 'algorithm_change',
  COMPETITOR_PROMOTION = 'competitor_promotion',
  ACCOUNT_ISSUE = 'account_issue',
  UNKNOWN = 'unknown',
}

export enum WinStrategy {
  PRICE_MATCH = 'price_match',
  PRICE_UNDERCUT = 'price_undercut',
  IMPROVED_SHIPPING = 'improved_shipping',
  STOCK_AVAILABILITY = 'stock_availability',
  PERFORMANCE_IMPROVEMENT = 'performance_improvement',
  COMPETITOR_OUT_OF_STOCK = 'competitor_out_of_stock',
  ALGORITHM_FAVOR = 'algorithm_favor',
  NATURAL = 'natural',
}

@Entity('buy_box_history')
@Index(['asin', 'timestamp'])
@Index(['userId', 'event'])
@Index(['winnerSellerId', 'timestamp'])
@Index(['event', 'timestamp'])
export class BuyBoxHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'asin', length: 10 })
  asin: string;

  @Column({ name: 'product_title' })
  productTitle: string;

  @Column({ name: 'product_category', nullable: true })
  productCategory?: string;

  // Buy Box Event Information
  @Column({
    type: 'enum',
    enum: BuyBoxEvent,
    name: 'event',
  })
  event: BuyBoxEvent;

  @Column({ name: 'timestamp', type: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'duration_minutes', nullable: true })
  durationMinutes?: number; // How long this state lasted

  // Current Buy Box Winner
  @Column({ name: 'winner_seller_id', nullable: true })
  winnerSellerId?: string;

  @Column({ name: 'winner_seller_name', nullable: true })
  winnerSellerName?: string;

  @Column({ name: 'winner_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  winnerPrice?: number;

  @Column({ name: 'winner_shipping_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  winnerShippingCost?: number;

  @Column({ name: 'winner_fulfillment_type', nullable: true })
  winnerFulfillmentType?: string; // 'FBA', 'FBM', 'Prime'

  @Column({ name: 'winner_seller_rating', type: 'decimal', precision: 5, scale: 2, nullable: true })
  winnerSellerRating?: number;

  @Column({ name: 'winner_prime_eligible', default: false })
  winnerPrimeEligible: boolean;

  // Previous Buy Box Winner (for comparison)
  @Column({ name: 'previous_winner_seller_id', nullable: true })
  previousWinnerSellerId?: string;

  @Column({ name: 'previous_winner_seller_name', nullable: true })
  previousWinnerSellerName?: string;

  @Column({ name: 'previous_winner_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  previousWinnerPrice?: number;

  // Our Performance
  @Column({ name: 'our_seller_id', nullable: true })
  ourSellerId?: string;

  @Column({ name: 'our_seller_name', nullable: true })
  ourSellerName?: string;

  @Column({ name: 'our_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  ourPrice?: number;

  @Column({ name: 'our_shipping_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  ourShippingCost?: number;

  @Column({ name: 'our_total_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  ourTotalCost?: number;

  @Column({ name: 'our_prime_eligible', default: false })
  ourPrimeEligible: boolean;

  @Column({ name: 'our_fulfillment_type', nullable: true })
  ourFulfillmentType?: string;

  @Column({ name: 'our_stock_quantity', nullable: true })
  ourStockQuantity?: number;

  @Column({ name: 'we_won_buy_box', default: false })
  weWonBuyBox: boolean;

  // Loss/Win Analysis
  @Column({
    type: 'enum',
    enum: LossReason,
    name: 'loss_reason',
    nullable: true,
  })
  lossReason?: LossReason;

  @Column({
    type: 'enum',
    enum: WinStrategy,
    name: 'win_strategy',
    nullable: true,
  })
  winStrategy?: WinStrategy;

  @Column({ name: 'price_difference', type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceDifference?: number; // Our price - winner price

  @Column({ name: 'price_difference_percent', type: 'decimal', precision: 8, scale: 4, nullable: true })
  priceDifferencePercent?: number;

  // Market Conditions
  @Column({ name: 'total_competitors', nullable: true })
  totalCompetitors?: number;

  @Column({ name: 'eligible_competitors', nullable: true })
  eligibleCompetitors?: number; // Buy Box eligible

  @Column({ name: 'fba_competitors', nullable: true })
  fbaCompetitors?: number;

  @Column({ name: 'prime_competitors', nullable: true })
  primeCompetitors?: number;

  @Column({ name: 'lowest_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  lowestPrice?: number;

  @Column({ name: 'highest_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  highestPrice?: number;

  @Column({ name: 'average_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  averagePrice?: number;

  @Column({ name: 'price_spread', type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceSpread?: number; // highest - lowest

  // Competition Details
  @Column({ type: 'json', nullable: true })
  competitors?: Array<{
    sellerId?: string;
    sellerName: string;
    price: number;
    shippingCost?: number;
    totalCost: number;
    fulfillmentType: string;
    primeEligible: boolean;
    sellerRating?: number;
    stockLevel?: string;
    buyBoxEligible: boolean;
    rank: number; // 1 = cheapest
  }>;

  // Performance Metrics
  @Column({ type: 'json', nullable: true })
  performanceMetrics?: {
    ourBuyBoxPercentage?: number; // Historical win rate
    avgTimeToBuyBox?: number; // Minutes to win after competitor change
    avgBuyBoxDuration?: number; // Minutes we typically hold it
    responseEffectiveness?: number; // Success rate of our repricing attempts
    competitiveIndex?: number; // How competitive we are vs others
  };

  // Detection and Response
  @Column({ name: 'detection_delay_minutes', nullable: true })
  detectionDelayMinutes?: number; // Time to detect the change

  @Column({ name: 'response_delay_minutes', nullable: true })
  responseDelayMinutes?: number; // Time to respond with repricing

  @Column({ name: 'response_action_taken', nullable: true })
  responseActionTaken?: string; // What action we took in response

  @Column({ name: 'response_successful', nullable: true })
  responseSuccessful?: boolean; // Did our response work?

  @Column({ name: 'automated_response', default: false })
  automatedResponse: boolean; // Was response automated or manual?

  @Column({ name: 'repricing_rule_id', nullable: true })
  repricingRuleId?: string; // Which rule triggered the response

  // External Factors
  @Column({ type: 'json', nullable: true })
  externalFactors?: {
    timeOfDay: number; // 0-23
    dayOfWeek: number; // 0-6
    holidayPeriod?: boolean;
    promotionActive?: boolean;
    seasonalDemand?: 'high' | 'medium' | 'low';
    marketCondition?: 'normal' | 'volatile' | 'competitive' | 'stable';
  };

  // Impact Analysis
  @Column({ type: 'json', nullable: true })
  impact?: {
    estimatedSalesLoss?: number; // Revenue impact of losing Buy Box
    estimatedSalesGain?: number; // Revenue impact of winning Buy Box
    marketShareChange?: number; // Percentage points
    visibilityImpact?: number; // Impact on product visibility
    customerAcquisition?: number; // New customers gained/lost
  };

  // Alerts and Notifications
  @Column({ type: 'json', nullable: true })
  alerts?: Array<{
    type: 'buy_box_lost' | 'buy_box_won' | 'price_gap_large' | 'new_competitor';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: Date;
    acknowledged: boolean;
  }>;

  // Data Quality
  @Column({ name: 'data_source', default: 'web_scraping' })
  dataSource: string;

  @Column({ name: 'data_confidence', type: 'decimal', precision: 5, scale: 2, default: 100 })
  dataConfidence: number;

  @Column({ name: 'validation_status', default: 'pending' })
  validationStatus: 'pending' | 'validated' | 'flagged';

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Business Logic Methods
  isLoss(): boolean {
    return this.event === BuyBoxEvent.LOST && this.weWonBuyBox === false;
  }

  isWin(): boolean {
    return (this.event === BuyBoxEvent.WON || this.event === BuyBoxEvent.REGAINED) && this.weWonBuyBox === true;
  }

  getCompetitiveGap(): number | null {
    if (!this.ourPrice || !this.winnerPrice) return null;
    return this.ourPrice - this.winnerPrice;
  }

  getCompetitiveGapPercent(): number | null {
    const gap = this.getCompetitiveGap();
    if (!gap || !this.winnerPrice) return null;
    return (gap / this.winnerPrice) * 100;
  }

  isCloseCompetition(): boolean {
    const gapPercent = this.getCompetitiveGapPercent();
    return gapPercent !== null && Math.abs(gapPercent) <= 2; // Within 2%
  }

  getWinProbability(): number {
    if (!this.ourPrice || !this.winnerPrice) return 0;
    
    let probability = 50; // Base probability
    
    // Price factor (40% weight)
    const priceGap = this.getCompetitiveGapPercent() || 0;
    if (priceGap <= 0) {
      probability += 40; // We're cheaper or equal
    } else if (priceGap <= 1) {
      probability += 30; // Within 1%
    } else if (priceGap <= 2) {
      probability += 20; // Within 2%
    } else {
      probability -= Math.min(40, priceGap * 2); // Penalty for higher price
    }
    
    // Fulfillment advantage (30% weight)
    if (this.ourPrimeEligible && !this.winnerPrimeEligible) {
      probability += 30;
    } else if (!this.ourPrimeEligible && this.winnerPrimeEligible) {
      probability -= 30;
    }
    
    // Stock availability (20% weight)
    if (this.ourStockQuantity && this.ourStockQuantity > 0) {
      probability += 20;
    }
    
    // Performance metrics (10% weight)
    if (this.performanceMetrics?.ourBuyBoxPercentage) {
      if (this.performanceMetrics.ourBuyBoxPercentage > 50) {
        probability += 10;
      } else if (this.performanceMetrics.ourBuyBoxPercentage < 20) {
        probability -= 10;
      }
    }
    
    return Math.max(0, Math.min(100, probability));
  }

  getRecommendedAction(): {
    action: 'lower_price' | 'match_price' | 'improve_logistics' | 'wait' | 'increase_stock';
    urgency: 'low' | 'medium' | 'high' | 'critical';
    reasoning: string;
    expectedImpact: string;
  } {
    if (!this.ourPrice || !this.winnerPrice) {
      return {
        action: 'wait',
        urgency: 'low',
        reasoning: 'Insufficient data to make recommendation',
        expectedImpact: 'None',
      };
    }
    
    const priceGap = this.getCompetitiveGapPercent() || 0;
    const winProb = this.getWinProbability();
    
    if (priceGap > 5) {
      return {
        action: 'lower_price',
        urgency: 'high',
        reasoning: `Price is ${priceGap.toFixed(1)}% higher than Buy Box winner`,
        expectedImpact: 'High probability of winning Buy Box',
      };
    }
    
    if (priceGap > 2) {
      return {
        action: 'match_price',
        urgency: 'medium',
        reasoning: `Small price gap of ${priceGap.toFixed(1)}%`,
        expectedImpact: 'Good chance of winning Buy Box',
      };
    }
    
    if (!this.ourPrimeEligible && this.winnerPrimeEligible) {
      return {
        action: 'improve_logistics',
        urgency: 'medium',
        reasoning: 'Winner has Prime advantage',
        expectedImpact: 'Improve competitiveness for future',
      };
    }
    
    if (this.ourStockQuantity === 0) {
      return {
        action: 'increase_stock',
        urgency: 'critical',
        reasoning: 'Out of stock - cannot win Buy Box',
        expectedImpact: 'Essential for Buy Box eligibility',
      };
    }
    
    return {
      action: 'wait',
      urgency: 'low',
      reasoning: 'Currently competitive, monitor for changes',
      expectedImpact: 'Maintain current position',
    };
  }

  calculateLossImpact(): {
    revenueImpact: number;
    marketShareLoss: number;
    visibilityReduction: number;
    customerLoss: number;
  } {
    const buyBoxShare = 0.7; // Typical Buy Box share is 70%
    const hourlyRevenue = 100; // Estimated - would come from actual data
    
    const durationHours = (this.durationMinutes || 0) / 60;
    const revenueImpact = hourlyRevenue * buyBoxShare * durationHours;
    
    return {
      revenueImpact,
      marketShareLoss: buyBoxShare * 100,
      visibilityReduction: 60, // Typical visibility reduction
      customerLoss: Math.round(revenueImpact / 25), // Assuming $25 average order
    };
  }

  // Static factory methods
  static createBuyBoxEvent(data: {
    userId: string;
    asin: string;
    productTitle: string;
    event: BuyBoxEvent;
    weWonBuyBox: boolean;
    winnerSellerId?: string;
    winnerSellerName?: string;
    winnerPrice?: number;
    ourPrice?: number;
    ourSellerId?: string;
    competitors?: any[];
    lossReason?: LossReason;
    winStrategy?: WinStrategy;
  }): Partial<BuyBoxHistory> {
    return {
      userId: data.userId,
      asin: data.asin,
      productTitle: data.productTitle,
      event: data.event,
      weWonBuyBox: data.weWonBuyBox,
      winnerSellerId: data.winnerSellerId,
      winnerSellerName: data.winnerSellerName,
      winnerPrice: data.winnerPrice,
      ourPrice: data.ourPrice,
      ourSellerId: data.ourSellerId,
      lossReason: data.lossReason,
      winStrategy: data.winStrategy,
      competitors: data.competitors,
      timestamp: new Date(),
      totalCompetitors: data.competitors?.length || 0,
      eligibleCompetitors: data.competitors?.filter(c => c.buyBoxEligible).length || 0,
      dataSource: 'amazon_api',
      dataConfidence: 95,
      validationStatus: 'pending',
    };
  }

  static analyzePattern(history: BuyBoxHistory[]): {
    winRate: number;
    avgDuration: number;
    commonLossReasons: string[];
    bestWinStrategies: string[];
    timePatterns: any;
  } {
    if (history.length === 0) {
      return {
        winRate: 0,
        avgDuration: 0,
        commonLossReasons: [],
        bestWinStrategies: [],
        timePatterns: {},
      };
    }
    
    const wins = history.filter(h => h.isWin()).length;
    const winRate = (wins / history.length) * 100;
    
    const durations = history.filter(h => h.durationMinutes).map(h => h.durationMinutes!);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    
    // Count loss reasons
    const lossReasons = history
      .filter(h => h.lossReason)
      .reduce((acc, h) => {
        acc[h.lossReason!] = (acc[h.lossReason!] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
    
    const commonLossReasons = Object.entries(lossReasons)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([reason]) => reason);
    
    // Count win strategies
    const winStrategies = history
      .filter(h => h.winStrategy)
      .reduce((acc, h) => {
        acc[h.winStrategy!] = (acc[h.winStrategy!] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });
    
    const bestWinStrategies = Object.entries(winStrategies)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([strategy]) => strategy);
    
    return {
      winRate,
      avgDuration,
      commonLossReasons,
      bestWinStrategies,
      timePatterns: {}, // Would analyze time-based patterns
    };
  }
}