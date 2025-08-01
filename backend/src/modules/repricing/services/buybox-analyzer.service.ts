import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { BuyBoxHistory, BuyBoxEvent, LossReason, WinStrategy } from '../entities/buy-box-history.entity';
import { CompetitorProduct } from '../entities/competitor-product.entity';
import { PriceHistory } from '../entities/price-history.entity';

export interface BuyBoxAnalysis {
  currentStatus: {
    hasOurProduct: boolean;
    weHaveBuyBox: boolean;
    buyBoxWinner: {
      sellerName: string;
      sellerId?: string;
      price: number;
      shippingCost?: number;
      totalCost: number;
      fulfillmentType: string;
      primeEligible: boolean;
    } | null;
    ourPosition: {
      price: number;
      rank: number;
      priceGap: number;
      priceGapPercent: number;
      advantages: string[];
      disadvantages: string[];
    } | null;
  };
  winProbability: {
    current: number;
    scenarios: Array<{
      priceChange: number;
      newPrice: number;
      probability: number;
      requiredActions: string[];
    }>;
  };
  recommendations: Array<{
    action: 'lower_price' | 'match_price' | 'improve_metrics' | 'wait' | 'optimize_logistics';
    priority: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    expectedOutcome: string;
    timeframe: string;
    cost?: number;
  }>;
  competitiveAnalysis: {
    totalCompetitors: number;
    eligibleCompetitors: number;
    avgPrice: number;
    priceSpread: number;
    competitionLevel: 'low' | 'medium' | 'high';
    threats: Array<{
      competitorName: string;
      threat: 'price_aggressive' | 'better_metrics' | 'prime_advantage';
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

export interface BuyBoxPerformanceReport {
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  performance: {
    buyBoxWinRate: number;
    avgBuyBoxDuration: number; // minutes
    totalBuyBoxTime: number; // minutes
    lossCount: number;
    winCount: number;
    responseTime: {
      avgDetectionTime: number; // minutes
      avgResponseTime: number; // minutes
      responseEffectiveness: number; // percentage
    };
  };
  patterns: {
    commonLossReasons: Array<{ reason: LossReason; count: number; percentage: number }>;
    successfulStrategies: Array<{ strategy: WinStrategy; count: number; successRate: number }>;
    timePatterns: {
      bestPerformanceHours: number[];
      worstPerformanceHours: number[];
      dayOfWeekPerformance: Array<{ day: number; winRate: number }>;
    };
  };
  trends: {
    winRateTrend: 'improving' | 'declining' | 'stable';
    competitionTrend: 'increasing' | 'decreasing' | 'stable';
    priceEffectiveness: 'high' | 'medium' | 'low';
  };
}

@Injectable()
export class BuyBoxAnalyzerService {
  private readonly logger = new Logger(BuyBoxAnalyzerService.name);

  constructor(
    @InjectRepository(BuyBoxHistory)
    private readonly buyBoxHistoryRepository: Repository<BuyBoxHistory>,
    @InjectRepository(CompetitorProduct)
    private readonly competitorRepository: Repository<CompetitorProduct>,
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepository: Repository<PriceHistory>,
  ) {}

  /**
   * ASIN için buy box durumunu analiz et
   */
  async analyzeBuyBoxStatus(
    userId: string,
    asin: string,
    ourSellerId?: string
  ): Promise<BuyBoxAnalysis> {
    this.logger.log(`Analyzing Buy Box status for ASIN: ${asin}`);

    // Get current competitors
    const competitors = await this.competitorRepository.find({
      where: { userId, asin, isInStock: true },
      order: { currentPrice: 'ASC' },
    });

    if (competitors.length === 0) {
      throw new Error('No competitor data available for this ASIN');
    }

    // Find current buy box winner
    const buyBoxWinner = competitors.find(c => c.buyBoxWinner);
    const ourProduct = ourSellerId ? 
      competitors.find(c => c.sellerId === ourSellerId) : null;

    // Analyze current status
    const currentStatus = this.analyzeCurrentStatus(competitors, buyBoxWinner, ourProduct);
    
    // Calculate win probability
    const winProbability = this.calculateWinProbability(competitors, ourProduct);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(competitors, ourProduct, buyBoxWinner);
    
    // Competitive analysis
    const competitiveAnalysis = this.analyzeCompetition(competitors, ourProduct);

    return {
      currentStatus,
      winProbability,
      recommendations,
      competitiveAnalysis,
    };
  }

  /**
   * Buy Box performance raporu
   */
  async generatePerformanceReport(
    userId: string,
    asin: string,
    period: 'week' | 'month' | 'quarter' = 'month',
    ourSellerId?: string
  ): Promise<BuyBoxPerformanceReport> {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
    }

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Get buy box history
    const history = await this.buyBoxHistoryRepository.find({
      where: {
        userId,
        asin,
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });

    // Calculate performance metrics
    const performance = this.calculatePerformanceMetrics(history, ourSellerId);
    
    // Analyze patterns
    const patterns = this.analyzePatterns(history);
    
    // Determine trends
    const trends = this.analyzeTrends(history);

    return {
      period: { startDate, endDate, days },
      performance,
      patterns,
      trends,
    };
  }

  /**
   * Buy Box kaybı tespit et ve kaydet
   */
  async recordBuyBoxLoss(
    userId: string,
    asin: string,
    productTitle: string,
    lossData: {
      previousWinner: {
        sellerId?: string;
        sellerName: string;
        price: number;
      };
      newWinner: {
        sellerId?: string;
        sellerName: string;
        price: number;
        primeEligible?: boolean;
        fulfillmentType?: string;
      };
      ourData?: {
        sellerId?: string;
        sellerName?: string;
        price: number;
        primeEligible?: boolean;
        fulfillmentType?: string;
        stockQuantity?: number;
      };
      competitors?: any[];
      lossReason?: LossReason;
      marketConditions?: any;
    }
  ): Promise<BuyBoxHistory> {
    this.logger.log(`Recording Buy Box loss for ASIN: ${asin}`);

    const buyBoxEvent = BuyBoxHistory.createBuyBoxEvent({
      userId,
      asin,
      productTitle,
      event: BuyBoxEvent.LOST,
      weWonBuyBox: false,
      winnerSellerId: lossData.newWinner.sellerId,
      winnerSellerName: lossData.newWinner.sellerName,
      winnerPrice: lossData.newWinner.price,
      ourPrice: lossData.ourData?.price,
      ourSellerId: lossData.ourData?.sellerId,
      competitors: lossData.competitors,
      lossReason: lossData.lossReason,
    });

    // Calculate additional metrics
    if (lossData.ourData && lossData.newWinner) {
      buyBoxEvent.priceDifference = lossData.ourData.price - lossData.newWinner.price;
      buyBoxEvent.priceDifferencePercent = 
        (buyBoxEvent.priceDifference / lossData.newWinner.price) * 100;
    }

    // Set market conditions
    if (lossData.marketConditions) {
      buyBoxEvent.externalFactors = lossData.marketConditions;
    }

    // Set previous winner data
    buyBoxEvent.previousWinnerSellerId = lossData.previousWinner.sellerId;
    buyBoxEvent.previousWinnerSellerName = lossData.previousWinner.sellerName;
    buyBoxEvent.previousWinnerPrice = lossData.previousWinner.price;

    const saved = await this.buyBoxHistoryRepository.save(buyBoxEvent);

    // Trigger alerts if needed
    await this.checkAndTriggerAlerts(saved);

    return saved;
  }

  /**
   * Buy Box kazanımı kaydet
   */
  async recordBuyBoxWin(
    userId: string,
    asin: string,
    productTitle: string,
    winData: {
      previousWinner?: {
        sellerId?: string;
        sellerName: string;
        price: number;
      };
      ourData: {
        sellerId?: string;
        sellerName: string;
        price: number;
        primeEligible?: boolean;
        fulfillmentType?: string;
      };
      winStrategy?: WinStrategy;
      competitors?: any[];
      responseTime?: number; // minutes
    }
  ): Promise<BuyBoxHistory> {
    this.logger.log(`Recording Buy Box win for ASIN: ${asin}`);

    const buyBoxEvent = BuyBoxHistory.createBuyBoxEvent({
      userId,
      asin,
      productTitle,
      event: BuyBoxEvent.WON,
      weWonBuyBox: true,
      winnerSellerId: winData.ourData.sellerId,
      winnerSellerName: winData.ourData.sellerName,
      winnerPrice: winData.ourData.price,
      ourPrice: winData.ourData.price,
      ourSellerId: winData.ourData.sellerId,
      competitors: winData.competitors,
      winStrategy: winData.winStrategy,
    });

    // Set previous winner data
    if (winData.previousWinner) {
      buyBoxEvent.previousWinnerSellerId = winData.previousWinner.sellerId;
      buyBoxEvent.previousWinnerSellerName = winData.previousWinner.sellerName;
      buyBoxEvent.previousWinnerPrice = winData.previousWinner.price;
    }

    // Set response time
    if (winData.responseTime) {
      buyBoxEvent.responseDelayMinutes = winData.responseTime;
    }

    return this.buyBoxHistoryRepository.save(buyBoxEvent);
  }

  /**
   * Buy Box win probability hesapla
   */
  calculateBuyBoxWinProbability(
    ourPrice: number,
    ourMetrics: {
      primeEligible: boolean;
      fulfillmentType: 'FBA' | 'FBM' | 'PRIME';
      sellerRating?: number;
      feedbackCount?: number;
      stockLevel?: number;
    },
    competition: Array<{
      price: number;
      primeEligible: boolean;
      fulfillmentType: string;
      sellerRating?: number;
      buyBoxEligible: boolean;
    }>
  ): number {
    let probability = 50; // Base probability

    const eligibleCompetitors = competition.filter(c => c.buyBoxEligible);
    const lowestPrice = Math.min(...eligibleCompetitors.map(c => c.price));
    const averagePrice = eligibleCompetitors.reduce((sum, c) => sum + c.price, 0) / eligibleCompetitors.length;

    // Price factor (40% weight)
    if (ourPrice <= lowestPrice) {
      probability += 40; // We're cheapest
    } else {
      const priceGapPercent = ((ourPrice - lowestPrice) / lowestPrice) * 100;
      if (priceGapPercent <= 1) {
        probability += 35; // Very close to cheapest
      } else if (priceGapPercent <= 2) {
        probability += 25; // Close to cheapest
      } else if (priceGapPercent <= 5) {
        probability += 10; // Somewhat competitive
      } else {
        probability -= Math.min(30, priceGapPercent * 2); // Penalty for higher price
      }
    }

    // Fulfillment advantage (25% weight)
    if (ourMetrics.fulfillmentType === 'FBA' || ourMetrics.primeEligible) {
      const nonPrimeCompetitors = eligibleCompetitors.filter(c => !c.primeEligible);
      if (nonPrimeCompetitors.length > 0) {
        probability += 25;
      } else {
        probability += 15; // Still advantage but everyone has Prime
      }
    }

    // Seller performance (20% weight)
    if (ourMetrics.sellerRating && ourMetrics.sellerRating >= 95) {
      probability += 20;
    } else if (ourMetrics.sellerRating && ourMetrics.sellerRating >= 90) {
      probability += 15;
    } else if (ourMetrics.sellerRating && ourMetrics.sellerRating < 85) {
      probability -= 10;
    }

    // Feedback count (10% weight)
    if (ourMetrics.feedbackCount && ourMetrics.feedbackCount >= 1000) {
      probability += 10;
    } else if (ourMetrics.feedbackCount && ourMetrics.feedbackCount >= 100) {
      probability += 5;
    }

    // Stock availability (5% weight)
    if (ourMetrics.stockLevel && ourMetrics.stockLevel > 10) {
      probability += 5;
    } else if (!ourMetrics.stockLevel || ourMetrics.stockLevel === 0) {
      probability = 0; // Can't win without stock
    }

    return Math.max(0, Math.min(100, probability));
  }

  // Private helper methods
  private analyzeCurrentStatus(
    competitors: CompetitorProduct[],
    buyBoxWinner: CompetitorProduct | undefined,
    ourProduct: CompetitorProduct | null
  ): BuyBoxAnalysis['currentStatus'] {
    const hasOurProduct = ourProduct !== null;
    const weHaveBuyBox = hasOurProduct && ourProduct!.buyBoxWinner;

    let buyBoxWinnerInfo = null;
    if (buyBoxWinner) {
      buyBoxWinnerInfo = {
        sellerName: buyBoxWinner.sellerName,
        sellerId: buyBoxWinner.sellerId,
        price: buyBoxWinner.currentPrice,
        shippingCost: buyBoxWinner.shippingCost || 0,
        totalCost: buyBoxWinner.currentPrice + (buyBoxWinner.shippingCost || 0),
        fulfillmentType: buyBoxWinner.fulfillmentType || 'Unknown',
        primeEligible: buyBoxWinner.isPrimeEligible,
      };
    }

    let ourPosition = null;
    if (ourProduct) {
      const sortedByPrice = [...competitors].sort((a, b) => a.currentPrice - b.currentPrice);
      const ourRank = sortedByPrice.findIndex(c => c.id === ourProduct.id) + 1;
      const lowestPrice = sortedByPrice[0].currentPrice;
      const priceGap = ourProduct.currentPrice - lowestPrice;
      const priceGapPercent = lowestPrice > 0 ? (priceGap / lowestPrice) * 100 : 0;

      ourPosition = {
        price: ourProduct.currentPrice,
        rank: ourRank,
        priceGap,
        priceGapPercent,
        advantages: ourProduct.getCompetitiveAdvantages(),
        disadvantages: ourProduct.getWeaknesses(),
      };
    }

    return {
      hasOurProduct,
      weHaveBuyBox,
      buyBoxWinner: buyBoxWinnerInfo,
      ourPosition,
    };
  }

  private calculateWinProbability(
    competitors: CompetitorProduct[],
    ourProduct: CompetitorProduct | null
  ): BuyBoxAnalysis['winProbability'] {
    if (!ourProduct) {
      return {
        current: 0,
        scenarios: [],
      };
    }

    const current = this.calculateBuyBoxWinProbability(
      ourProduct.currentPrice,
      {
        primeEligible: ourProduct.isPrimeEligible,
        fulfillmentType: (ourProduct.fulfillmentType as any) || 'FBM',
        sellerRating: ourProduct.sellerFeedbackPercentage,
        feedbackCount: ourProduct.sellerFeedbackCount,
        stockLevel: ourProduct.stockQuantity,
      },
      competitors.map(c => ({
        price: c.currentPrice,
        primeEligible: c.isPrimeEligible,
        fulfillmentType: c.fulfillmentType || 'FBM',
        sellerRating: c.sellerFeedbackPercentage,
        buyBoxEligible: c.buyBoxEligible || true, // Assume eligible if not specified
      }))
    );

    // Calculate scenarios with different price points
    const lowestPrice = Math.min(...competitors.map(c => c.currentPrice));
    const scenarios = [
      {
        priceChange: lowestPrice - ourProduct.currentPrice,
        newPrice: lowestPrice,
        probability: 85,
        requiredActions: ['Match lowest price'],
      },
      {
        priceChange: (lowestPrice - 0.01) - ourProduct.currentPrice,
        newPrice: lowestPrice - 0.01,
        probability: 90,
        requiredActions: ['Undercut by $0.01'],
      },
      {
        priceChange: (lowestPrice - 0.05) - ourProduct.currentPrice,
        newPrice: lowestPrice - 0.05,
        probability: 95,
        requiredActions: ['Undercut by $0.05'],
      },
    ].filter(s => s.priceChange < 0); // Only show scenarios that require price reduction

    return { current, scenarios };
  }

  private generateRecommendations(
    competitors: CompetitorProduct[],
    ourProduct: CompetitorProduct | null,
    buyBoxWinner: CompetitorProduct | undefined
  ): BuyBoxAnalysis['recommendations'] {
    const recommendations: BuyBoxAnalysis['recommendations'] = [];

    if (!ourProduct) {
      return [{
        action: 'wait',
        priority: 'low',
        description: 'No product data available',
        expectedOutcome: 'Cannot make recommendations without product information',
        timeframe: 'N/A',
      }];
    }

    const lowestPrice = Math.min(...competitors.map(c => c.currentPrice));
    const priceGap = ourProduct.currentPrice - lowestPrice;
    const priceGapPercent = (priceGap / lowestPrice) * 100;

    // Price-based recommendations
    if (priceGapPercent > 5) {
      recommendations.push({
        action: 'lower_price',
        priority: 'high',
        description: `Your price is ${priceGapPercent.toFixed(1)}% higher than the lowest competitor`,
        expectedOutcome: 'High probability of winning Buy Box',
        timeframe: 'Immediate',
        cost: priceGap * 100, // Estimated revenue impact per 100 units
      });
    } else if (priceGapPercent > 2) {
      recommendations.push({
        action: 'match_price',
        priority: 'medium',
        description: `Small price gap of ${priceGapPercent.toFixed(1)}% can be closed`,
        expectedOutcome: 'Good chance of winning Buy Box',
        timeframe: '1-2 hours',
        cost: priceGap * 100,
      });
    }

    // Fulfillment recommendations
    if (!ourProduct.isPrimeEligible && buyBoxWinner?.isPrimeEligible) {
      recommendations.push({
        action: 'optimize_logistics',
        priority: 'medium',
        description: 'Consider switching to FBA for Prime eligibility',
        expectedOutcome: 'Improved Buy Box competitiveness',
        timeframe: '1-2 weeks',
      });
    }

    // Performance recommendations
    if (ourProduct.sellerFeedbackPercentage && ourProduct.sellerFeedbackPercentage < 90) {
      recommendations.push({
        action: 'improve_metrics',
        priority: 'medium',
        description: 'Improve seller performance metrics',
        expectedOutcome: 'Better Buy Box algorithm scoring',
        timeframe: '1-3 months',
      });
    }

    // Stock recommendations
    if (!ourProduct.stockQuantity || ourProduct.stockQuantity < 5) {
      recommendations.push({
        action: 'optimize_logistics',
        priority: 'critical',
        description: 'Increase inventory levels',
        expectedOutcome: 'Maintain Buy Box eligibility',
        timeframe: 'Immediate',
      });
    }

    // If no major issues, recommend monitoring
    if (recommendations.length === 0) {
      recommendations.push({
        action: 'wait',
        priority: 'low',
        description: 'Currently competitive, monitor for changes',
        expectedOutcome: 'Maintain current position',
        timeframe: 'Ongoing',
      });
    }

    return recommendations;
  }

  private analyzeCompetition(
    competitors: CompetitorProduct[],
    ourProduct: CompetitorProduct | null
  ): BuyBoxAnalysis['competitiveAnalysis'] {
    const totalCompetitors = competitors.length;
    const eligibleCompetitors = competitors.filter(c => c.buyBoxEligible !== false).length;
    const prices = competitors.map(c => c.currentPrice);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const priceSpread = Math.max(...prices) - Math.min(...prices);

    let competitionLevel: 'low' | 'medium' | 'high';
    if (totalCompetitors <= 3) competitionLevel = 'low';
    else if (totalCompetitors <= 8) competitionLevel = 'medium';
    else competitionLevel = 'high';

    const threats = competitors
      .filter(c => c.id !== ourProduct?.id)
      .map(c => {
        const threats = [];
        
        if (c.currentPrice < (ourProduct?.currentPrice || Infinity)) {
          threats.push({
            competitorName: c.sellerName,
            threat: 'price_aggressive' as const,
            severity: 'high' as const,
          });
        }
        
        if (c.isPrimeEligible && !ourProduct?.isPrimeEligible) {
          threats.push({
            competitorName: c.sellerName,
            threat: 'prime_advantage' as const,
            severity: 'medium' as const,
          });
        }
        
        if (c.sellerFeedbackPercentage && c.sellerFeedbackPercentage > (ourProduct?.sellerFeedbackPercentage || 0) + 5) {
          threats.push({
            competitorName: c.sellerName,
            threat: 'better_metrics' as const,
            severity: 'low' as const,
          });
        }
        
        return threats;
      })
      .flat()
      .slice(0, 5); // Top 5 threats

    return {
      totalCompetitors,
      eligibleCompetitors,
      avgPrice,
      priceSpread,
      competitionLevel,
      threats,
    };
  }

  private calculatePerformanceMetrics(
    history: BuyBoxHistory[],
    ourSellerId?: string
  ): BuyBoxPerformanceReport['performance'] {
    const ourEvents = ourSellerId ? 
      history.filter(h => h.ourSellerId === ourSellerId) : 
      history.filter(h => h.weWonBuyBox);

    const winEvents = ourEvents.filter(h => h.isWin());
    const lossEvents = ourEvents.filter(h => h.isLoss());

    const totalTime = ourEvents
      .filter(h => h.durationMinutes)
      .reduce((sum, h) => sum + (h.durationMinutes || 0), 0);

    const buyBoxTime = winEvents
      .filter(h => h.durationMinutes)
      .reduce((sum, h) => sum + (h.durationMinutes || 0), 0);

    const detectionTimes = ourEvents
      .filter(h => h.detectionDelayMinutes)
      .map(h => h.detectionDelayMinutes!);

    const responseTimes = ourEvents
      .filter(h => h.responseDelayMinutes)
      .map(h => h.responseDelayMinutes!);

    return {
      buyBoxWinRate: totalTime > 0 ? (buyBoxTime / totalTime) * 100 : 0,
      avgBuyBoxDuration: winEvents.length > 0 ? buyBoxTime / winEvents.length : 0,
      totalBuyBoxTime: buyBoxTime,
      lossCount: lossEvents.length,
      winCount: winEvents.length,
      responseTime: {
        avgDetectionTime: detectionTimes.length > 0 ? 
          detectionTimes.reduce((sum, t) => sum + t, 0) / detectionTimes.length : 0,
        avgResponseTime: responseTimes.length > 0 ? 
          responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length : 0,
        responseEffectiveness: ourEvents.filter(h => h.responseSuccessful).length / Math.max(1, ourEvents.length) * 100,
      },
    };
  }

  private analyzePatterns(history: BuyBoxHistory[]): BuyBoxPerformanceReport['patterns'] {
    // Common loss reasons
    const lossReasons = history
      .filter(h => h.lossReason)
      .reduce((acc, h) => {
        acc[h.lossReason!] = (acc[h.lossReason!] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

    const totalLosses = Object.values(lossReasons).reduce((sum, count) => sum + count, 0);
    const commonLossReasons = Object.entries(lossReasons)
      .map(([reason, count]) => ({
        reason: reason as LossReason,
        count,
        percentage: (count / totalLosses) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Successful strategies
    const winStrategies = history
      .filter(h => h.winStrategy)
      .reduce((acc, h) => {
        const key = h.winStrategy!;
        if (!acc[key]) acc[key] = { total: 0, successful: 0 };
        acc[key].total++;
        if (h.responseSuccessful) acc[key].successful++;
        return acc;
      }, {} as { [key: string]: { total: number; successful: number } });

    const successfulStrategies = Object.entries(winStrategies)
      .map(([strategy, data]) => ({
        strategy: strategy as WinStrategy,
        count: data.total,
        successRate: (data.successful / data.total) * 100,
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    // Time patterns
    const hourlyPerformance = new Array(24).fill(0).map((_, hour) => {
      const hourEvents = history.filter(h => h.externalFactors?.timeOfDay === hour);
      const hourWins = hourEvents.filter(h => h.weWonBuyBox).length;
      return { hour, winRate: hourEvents.length > 0 ? (hourWins / hourEvents.length) * 100 : 0 };
    });

    const bestPerformanceHours = hourlyPerformance
      .filter(h => h.winRate > 0)
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 6)
      .map(h => h.hour);

    const worstPerformanceHours = hourlyPerformance
      .filter(h => h.winRate < 100)
      .sort((a, b) => a.winRate - b.winRate)
      .slice(0, 6)
      .map(h => h.hour);

    const dayOfWeekPerformance = new Array(7).fill(0).map((_, day) => {
      const dayEvents = history.filter(h => h.externalFactors?.dayOfWeek === day);
      const dayWins = dayEvents.filter(h => h.weWonBuyBox).length;
      return { day, winRate: dayEvents.length > 0 ? (dayWins / dayEvents.length) * 100 : 0 };
    });

    return {
      commonLossReasons,
      successfulStrategies,
      timePatterns: {
        bestPerformanceHours,
        worstPerformanceHours,
        dayOfWeekPerformance,
      },
    };
  }

  private analyzeTrends(history: BuyBoxHistory[]): BuyBoxPerformanceReport['trends'] {
    if (history.length < 10) {
      return {
        winRateTrend: 'stable',
        competitionTrend: 'stable',
        priceEffectiveness: 'medium',
      };
    }

    // Split history into two halves to compare trends
    const midPoint = Math.floor(history.length / 2);
    const firstHalf = history.slice(0, midPoint);
    const secondHalf = history.slice(midPoint);

    // Win rate trend
    const firstHalfWinRate = firstHalf.filter(h => h.weWonBuyBox).length / firstHalf.length;
    const secondHalfWinRate = secondHalf.filter(h => h.weWonBuyBox).length / secondHalf.length;
    const winRateDiff = secondHalfWinRate - firstHalfWinRate;

    let winRateTrend: 'improving' | 'declining' | 'stable';
    if (winRateDiff > 0.1) winRateTrend = 'improving';
    else if (winRateDiff < -0.1) winRateTrend = 'declining';
    else winRateTrend = 'stable';

    // Competition trend
    const firstHalfAvgCompetitors = firstHalf.reduce((sum, h) => sum + (h.totalCompetitors || 0), 0) / firstHalf.length;
    const secondHalfAvgCompetitors = secondHalf.reduce((sum, h) => sum + (h.totalCompetitors || 0), 0) / secondHalf.length;
    const competitorsDiff = secondHalfAvgCompetitors - firstHalfAvgCompetitors;

    let competitionTrend: 'increasing' | 'decreasing' | 'stable';
    if (competitorsDiff > 1) competitionTrend = 'increasing';
    else if (competitorsDiff < -1) competitionTrend = 'decreasing';
    else competitionTrend = 'stable';

    // Price effectiveness
    const priceBasedWins = history.filter(h => 
      h.winStrategy === WinStrategy.PRICE_MATCH || 
      h.winStrategy === WinStrategy.PRICE_UNDERCUT
    ).length;
    const totalWins = history.filter(h => h.isWin()).length;
    const priceEffectivenessRatio = totalWins > 0 ? priceBasedWins / totalWins : 0;

    let priceEffectiveness: 'high' | 'medium' | 'low';
    if (priceEffectivenessRatio > 0.7) priceEffectiveness = 'high';
    else if (priceEffectivenessRatio > 0.4) priceEffectiveness = 'medium';
    else priceEffectiveness = 'low';

    return {
      winRateTrend,
      competitionTrend,
      priceEffectiveness,
    };
  }

  private async checkAndTriggerAlerts(buyBoxEvent: BuyBoxHistory): Promise<void> {
    // Generate alerts based on buy box events
    if (buyBoxEvent.isLoss()) {
      const alert = {
        type: 'buy_box_lost' as const,
        severity: 'high' as const,
        message: `Buy Box lost to ${buyBoxEvent.winnerSellerName} at $${buyBoxEvent.winnerPrice}`,
        timestamp: buyBoxEvent.timestamp,
        acknowledged: false,
      };

      if (!buyBoxEvent.alerts) buyBoxEvent.alerts = [];
      buyBoxEvent.alerts.push(alert);

      this.logger.warn(`Buy Box alert: ${alert.message}`);
    }

    // Check for large price gaps
    if (buyBoxEvent.priceDifferencePercent && buyBoxEvent.priceDifferencePercent > 10) {
      const alert = {
        type: 'price_gap_large' as const,
        severity: 'medium' as const,
        message: `Large price gap detected: ${buyBoxEvent.priceDifferencePercent.toFixed(1)}%`,
        timestamp: buyBoxEvent.timestamp,
        acknowledged: false,
      };

      if (!buyBoxEvent.alerts) buyBoxEvent.alerts = [];
      buyBoxEvent.alerts.push(alert);
    }
  }
}