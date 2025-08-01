import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { HttpService } from '@nestjs/axios';

import { PriceHistory, MarketCondition } from '../entities/price-history.entity';
import { CompetitorProduct } from '../entities/competitor-product.entity';
import { BuyBoxHistory } from '../entities/buy-box-history.entity';

export interface MarketConditions {
  volatility: number; // 0-100
  competition: 'low' | 'medium' | 'high';
  demand: 'low' | 'medium' | 'high';
  season: 'normal' | 'peak' | 'low';
  trends: {
    priceDirection: 'up' | 'down' | 'stable';
    demandDirection: 'increasing' | 'decreasing' | 'stable';
    competitionDirection: 'increasing' | 'decreasing' | 'stable';
  };
  marketCondition: MarketCondition;
}

export interface MarketAnalysisReport {
  asin: string;
  analysisDate: Date;
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };
  priceAnalysis: {
    currentPrice: number;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    priceSpread: number;
    volatility: number;
    priceChanges: number;
    trend: 'upward' | 'downward' | 'stable' | 'volatile';
  };
  competitionAnalysis: {
    totalCompetitors: number;
    activeCompetitors: number;
    newCompetitors: number;
    lostCompetitors: number;
    competitionIntensity: number; // 0-100
    marketShare: {
      topSellers: Array<{
        sellerName: string;
        estimatedShare: number;
        avgPrice: number;
        buyBoxWinRate: number;
      }>;
    };
  };
  demandAnalysis: {
    demandLevel: 'low' | 'medium' | 'high';
    demandTrend: 'increasing' | 'decreasing' | 'stable';
    seasonality: {
      currentSeason: 'normal' | 'peak' | 'low';
      seasonalIndex: number; // 0-200, 100 = normal
      peakMonths: number[];
      lowMonths: number[];
    };
    externalFactors: Array<{
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      strength: 'low' | 'medium' | 'high';
    }>;
  };
  recommendations: Array<{
    type: 'pricing' | 'inventory' | 'competition' | 'timing';
    priority: 'low' | 'medium' | 'high' | 'critical';
    action: string;
    reasoning: string;
    expectedImpact: string;
    timeframe: string;
  }>;
}

export interface PricingOpportunity {
  asin: string;
  opportunityType: 'underpriced' | 'overpriced' | 'gap_opportunity' | 'demand_spike' | 'weak_competition';
  severity: 'low' | 'medium' | 'high';
  description: string;
  currentPrice: number;
  suggestedPrice: number;
  potentialGain: number; // percentage
  confidence: number; // 0-100
  actionRequired: string;
  timeframe: 'immediate' | 'short_term' | 'medium_term';
}

@Injectable()
export class MarketAnalysisService {
  private readonly logger = new Logger(MarketAnalysisService.name);

  constructor(
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepository: Repository<PriceHistory>,
    @InjectRepository(CompetitorProduct)
    private readonly competitorRepository: Repository<CompetitorProduct>,
    @InjectRepository(BuyBoxHistory)
    private readonly buyBoxHistoryRepository: Repository<BuyBoxHistory>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * ASIN için mevcut pazar koşullarını analiz et
   */
  async getMarketConditions(asin: string): Promise<MarketConditions> {
    this.logger.log(`Analyzing market conditions for ASIN: ${asin}`);

    // Get recent data (last 30 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const [priceHistory, competitors, buyBoxHistory] = await Promise.all([
      this.priceHistoryRepository.find({
        where: { asin, timestamp: Between(startDate, endDate) },
        order: { timestamp: 'ASC' },
      }),
      this.competitorRepository.find({
        where: { asin },
        order: { lastScrapedAt: 'DESC' },
      }),
      this.buyBoxHistoryRepository.find({
        where: { asin, timestamp: Between(startDate, endDate) },
        order: { timestamp: 'ASC' },
      }),
    ]);

    // Calculate volatility
    const volatility = this.calculatePriceVolatility(priceHistory);

    // Determine competition level
    const competition = this.determineCompetitionLevel(competitors);

    // Estimate demand level
    const demand = this.estimateDemandLevel(priceHistory, buyBoxHistory);

    // Determine seasonality
    const season = this.determineSeasonality(new Date(), asin);

    // Analyze trends
    const trends = this.analyzeTrends(priceHistory, competitors);

    // Determine overall market condition
    const marketCondition = this.determineMarketCondition(volatility, competition, demand);

    return {
      volatility,
      competition,
      demand,
      season,
      trends,
      marketCondition,
    };
  }

  /**
   * Detaylı pazar analizi raporu
   */
  async generateMarketAnalysisReport(
    userId: string,
    asin: string,
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<MarketAnalysisReport> {
    this.logger.log(`Generating market analysis report for ASIN: ${asin}`);

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

    // Get data
    const [priceHistory, competitors, buyBoxHistory] = await Promise.all([
      this.priceHistoryRepository.find({
        where: { asin, timestamp: Between(startDate, endDate) },
        order: { timestamp: 'ASC' },
      }),
      this.competitorRepository.find({
        where: { asin },
        order: { lastScrapedAt: 'DESC' },
      }),
      this.buyBoxHistoryRepository.find({
        where: { asin, timestamp: Between(startDate, endDate) },
        order: { timestamp: 'ASC' },
      }),
    ]);

    // Analyze price data
    const priceAnalysis = this.analyzePriceData(priceHistory);
    
    // Analyze competition
    const competitionAnalysis = this.analyzeCompetition(competitors, priceHistory, buyBoxHistory);
    
    // Analyze demand
    const demandAnalysis = this.analyzeDemand(asin, priceHistory, buyBoxHistory);
    
    // Generate recommendations
    const recommendations = this.generateMarketRecommendations(
      priceAnalysis,
      competitionAnalysis,
      demandAnalysis
    );

    return {
      asin,
      analysisDate: new Date(),
      period: { startDate, endDate, days },
      priceAnalysis,
      competitionAnalysis,
      demandAnalysis,
      recommendations,
    };
  }

  /**
   * Fiyatlandırma fırsatlarını tespit et
   */
  async identifyPricingOpportunities(
    userId: string,
    asins?: string[]
  ): Promise<PricingOpportunity[]> {
    this.logger.log(`Identifying pricing opportunities for user: ${userId}`);

    const opportunities: PricingOpportunity[] = [];

    // Get ASINs to analyze
    let targetASINs = asins;
    if (!targetASINs) {
      const competitors = await this.competitorRepository.find({
        where: { userId },
        select: ['asin'],
      });
      targetASINs = [...new Set(competitors.map(c => c.asin))];
    }

    for (const asin of targetASINs) {
      try {
        const asinOpportunities = await this.analyzeASINOpportunities(userId, asin);
        opportunities.push(...asinOpportunities);
      } catch (error) {
        this.logger.error(`Error analyzing opportunities for ASIN ${asin}: ${error.message}`);
      }
    }

    return opportunities.sort((a, b) => b.potentialGain - a.potentialGain);
  }

  /**
   * Pazar trendlerini analiz et
   */
  async analyzeTrends(
    asin: string,
    timeframe: 'daily' | 'weekly' | 'monthly' = 'weekly'
  ): Promise<{
    priceTrend: Array<{ date: Date; avgPrice: number; volume?: number }>;
    competitionTrend: Array<{ date: Date; competitorCount: number; newEntrants: number }>;
    demandTrend: Array<{ date: Date; demandIndex: number; buyBoxChanges: number }>;
    insights: Array<{
      type: 'price' | 'competition' | 'demand';
      insight: string;
      confidence: number;
      impact: 'positive' | 'negative' | 'neutral';
    }>;
  }> {
    const endDate = new Date();
    const startDate = new Date();
    
    // Set timeframe
    switch (timeframe) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 84); // 12 weeks
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 12); // 12 months
        break;
    }

    // Get historical data
    const priceHistory = await this.priceHistoryRepository.find({
      where: { asin, timestamp: Between(startDate, endDate) },
      order: { timestamp: 'ASC' },
    });

    const buyBoxHistory = await this.buyBoxHistoryRepository.find({
      where: { asin, timestamp: Between(startDate, endDate) },
      order: { timestamp: 'ASC' },
    });

    // Aggregate data by timeframe
    const priceTrend = this.aggregatePriceData(priceHistory, timeframe);
    const competitionTrend = this.aggregateCompetitionData(priceHistory, timeframe);
    const demandTrend = this.aggregateDemandData(buyBoxHistory, timeframe);

    // Generate insights
    const insights = this.generateTrendInsights(priceTrend, competitionTrend, demandTrend);

    return {
      priceTrend,
      competitionTrend,
      demandTrend,
      insights,
    };
  }

  // Private helper methods
  private calculatePriceVolatility(priceHistory: PriceHistory[]): number {
    if (priceHistory.length < 2) return 0;
    return PriceHistory.calculatePriceVolatility(priceHistory);
  }

  private determineCompetitionLevel(competitors: CompetitorProduct[]): 'low' | 'medium' | 'high' {
    const activeCompetitors = competitors.filter(c => c.isActive()).length;
    
    if (activeCompetitors <= 3) return 'low';
    if (activeCompetitors <= 8) return 'medium';
    return 'high';
  }

  private estimateDemandLevel(
    priceHistory: PriceHistory[],
    buyBoxHistory: BuyBoxHistory[]
  ): 'low' | 'medium' | 'high' {
    // Simplified demand estimation based on price changes and buy box activity
    const recentPriceChanges = priceHistory.filter(p => 
      p.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    const recentBuyBoxChanges = buyBoxHistory.filter(b => 
      b.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    const activityScore = recentPriceChanges + recentBuyBoxChanges * 2;
    
    if (activityScore <= 5) return 'low';
    if (activityScore <= 15) return 'medium';
    return 'high';
  }

  private determineSeasonality(date: Date, asin: string): 'normal' | 'peak' | 'low' {
    const month = date.getMonth() + 1;
    
    // General seasonality patterns
    if (month >= 11 || month <= 1) return 'peak'; // Holiday season
    if (month >= 6 && month <= 8) return 'low'; // Summer slowdown
    return 'normal';
  }

  private analyzeTrends(
    priceHistory: PriceHistory[],
    competitors: CompetitorProduct[]
  ): MarketConditions['trends'] {
    const priceTrend = PriceHistory.findPriceTrend(priceHistory);
    
    let priceDirection: 'up' | 'down' | 'stable';
    if (priceTrend === 'upward') priceDirection = 'up';
    else if (priceTrend === 'downward') priceDirection = 'down';
    else priceDirection = 'stable';

    // Simplified demand and competition trend analysis
    const demandDirection = 'stable'; // Would need more data
    const competitionDirection = 'stable'; // Would analyze competitor entry/exit

    return {
      priceDirection,
      demandDirection,
      competitionDirection,
    };
  }

  private determineMarketCondition(
    volatility: number,
    competition: 'low' | 'medium' | 'high',
    demand: 'low' | 'medium' | 'high'
  ): MarketCondition {
    if (volatility > 15) return MarketCondition.VOLATILE_MARKET;
    if (competition === 'high' && demand === 'high') return MarketCondition.HIGH_COMPETITION;
    if (competition === 'low') return MarketCondition.LOW_COMPETITION;
    if (volatility < 5 && competition === 'medium') return MarketCondition.STABLE_MARKET;
    
    return MarketCondition.NORMAL;
  }

  private analyzePriceData(priceHistory: PriceHistory[]): MarketAnalysisReport['priceAnalysis'] {
    if (priceHistory.length === 0) {
      return {
        currentPrice: 0,
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        priceSpread: 0,
        volatility: 0,
        priceChanges: 0,
        trend: 'stable',
      };
    }

    const prices = priceHistory.map(p => p.price);
    const currentPrice = prices[prices.length - 1];
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceSpread = maxPrice - minPrice;
    const volatility = this.calculatePriceVolatility(priceHistory);
    const priceChanges = priceHistory.filter(p => p.isSignificantChange()).length;
    const trend = PriceHistory.findPriceTrend(priceHistory);

    return {
      currentPrice,
      avgPrice,
      minPrice,
      maxPrice,
      priceSpread,
      volatility,
      priceChanges,
      trend,
    };
  }

  private analyzeCompetition(
    competitors: CompetitorProduct[],
    priceHistory: PriceHistory[],
    buyBoxHistory: BuyBoxHistory[]
  ): MarketAnalysisReport['competitionAnalysis'] {
    const totalCompetitors = competitors.length;
    const activeCompetitors = competitors.filter(c => c.isActive()).length;
    
    // Would need historical competitor data to calculate new/lost competitors
    const newCompetitors = 0;
    const lostCompetitors = 0;
    
    const competitionIntensity = Math.min(100, (activeCompetitors * 10) + (priceHistory.length / 10));
    
    // Calculate market share estimates
    const topSellers = competitors
      .filter(c => c.isActive())
      .sort((a, b) => (b.performanceMetrics?.competitiveIndex || 0) - (a.performanceMetrics?.competitiveIndex || 0))
      .slice(0, 5)
      .map(c => ({
        sellerName: c.sellerName,
        estimatedShare: c.calculateMarketShare(),
        avgPrice: c.currentPrice,
        buyBoxWinRate: c.buyBoxPercentage || 0,
      }));

    return {
      totalCompetitors,
      activeCompetitors,
      newCompetitors,
      lostCompetitors,
      competitionIntensity,
      marketShare: { topSellers },
    };
  }

  private analyzeDemand(
    asin: string,
    priceHistory: PriceHistory[],
    buyBoxHistory: BuyBoxHistory[]
  ): MarketAnalysisReport['demandAnalysis'] {
    const demandLevel = this.estimateDemandLevel(priceHistory, buyBoxHistory);
    const demandTrend = 'stable'; // Simplified
    
    const currentMonth = new Date().getMonth() + 1;
    const seasonality = {
      currentSeason: this.determineSeasonality(new Date(), asin),
      seasonalIndex: this.calculateSeasonalIndex(currentMonth),
      peakMonths: [11, 12, 1], // Holiday season
      lowMonths: [6, 7, 8], // Summer
    };

    const externalFactors = [
      {
        factor: 'Holiday Season',
        impact: currentMonth >= 11 || currentMonth <= 1 ? 'positive' as const : 'neutral' as const,
        strength: 'medium' as const,
      },
    ];

    return {
      demandLevel,
      demandTrend,
      seasonality,
      externalFactors,
    };
  }

  private calculateSeasonalIndex(month: number): number {
    // Simplified seasonal index - would use historical data in production
    const seasonalFactors = [105, 95, 100, 100, 100, 85, 80, 85, 100, 105, 120, 130];
    return seasonalFactors[month - 1] || 100;
  }

  private generateMarketRecommendations(
    priceAnalysis: MarketAnalysisReport['priceAnalysis'],
    competitionAnalysis: MarketAnalysisReport['competitionAnalysis'],
    demandAnalysis: MarketAnalysisReport['demandAnalysis']
  ): MarketAnalysisReport['recommendations'] {
    const recommendations: MarketAnalysisReport['recommendations'] = [];

    // Price-based recommendations
    if (priceAnalysis.volatility > 15) {
      recommendations.push({
        type: 'pricing',
        priority: 'high',
        action: 'Implement dynamic pricing strategy',
        reasoning: `High price volatility (${priceAnalysis.volatility.toFixed(1)}%) indicates unstable market`,
        expectedImpact: 'Better price competitiveness and margin protection',
        timeframe: 'Immediate',
      });
    }

    // Competition-based recommendations
    if (competitionAnalysis.competitionIntensity > 70) {
      recommendations.push({
        type: 'competition',
        priority: 'medium',
        action: 'Focus on differentiation rather than price competition',
        reasoning: `High competition intensity (${competitionAnalysis.competitionIntensity}) makes pure price competition difficult`,
        expectedImpact: 'Better margins and sustainable competitive advantage',
        timeframe: 'Medium term',
      });
    }

    // Demand-based recommendations
    if (demandAnalysis.demandLevel === 'high' && demandAnalysis.seasonality.currentSeason === 'peak') {
      recommendations.push({
        type: 'pricing',
        priority: 'high',
        action: 'Consider premium pricing during peak demand',
        reasoning: 'High demand during peak season allows for better margins',
        expectedImpact: 'Increased profitability',
        timeframe: 'Immediate',
      });
    }

    return recommendations;
  }

  private async analyzeASINOpportunities(userId: string, asin: string): Promise<PricingOpportunity[]> {
    const opportunities: PricingOpportunity[] = [];

    // Get recent data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 14); // Last 2 weeks

    const [competitors, priceHistory] = await Promise.all([
      this.competitorRepository.find({
        where: { userId, asin },
        order: { currentPrice: 'ASC' },
      }),
      this.priceHistoryRepository.find({
        where: { asin, timestamp: Between(startDate, endDate) },
        order: { timestamp: 'DESC' },
        take: 100,
      }),
    ]);

    if (competitors.length === 0) return opportunities;

    const prices = competitors.map(c => c.currentPrice);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);

    // Check for price gaps
    const sortedPrices = [...prices].sort((a, b) => a - b);
    for (let i = 0; i < sortedPrices.length - 1; i++) {
      const gap = sortedPrices[i + 1] - sortedPrices[i];
      if (gap > 1.0) { // $1+ gap
        opportunities.push({
          asin,
          opportunityType: 'gap_opportunity',
          severity: gap > 5 ? 'high' : gap > 2 ? 'medium' : 'low',
          description: `Price gap of $${gap.toFixed(2)} between $${sortedPrices[i]} and $${sortedPrices[i + 1]}`,
          currentPrice: sortedPrices[i],
          suggestedPrice: sortedPrices[i] + gap / 2,
          potentialGain: (gap / 2 / sortedPrices[i]) * 100,
          confidence: 70,
          actionRequired: 'Position product in price gap',
          timeframe: 'immediate',
        });
      }
    }

    // Check for weak competition
    const weakCompetitors = competitors.filter(c => 
      !c.isPrimeEligible && 
      (c.sellerFeedbackPercentage || 0) < 90
    );

    if (weakCompetitors.length / competitors.length > 0.5) {
      opportunities.push({
        asin,
        opportunityType: 'weak_competition',
        severity: 'medium',
        description: 'Many competitors have weak seller metrics',
        currentPrice: avgPrice,
        suggestedPrice: avgPrice * 1.05,
        potentialGain: 5,
        confidence: 80,
        actionRequired: 'Leverage superior seller metrics for premium pricing',
        timeframe: 'short_term',
      });
    }

    return opportunities;
  }

  private aggregatePriceData(
    priceHistory: PriceHistory[],
    timeframe: 'daily' | 'weekly' | 'monthly'
  ): Array<{ date: Date; avgPrice: number; volume?: number }> {
    const grouped = this.groupDataByTimeframe(priceHistory, timeframe);
    
    return Object.entries(grouped).map(([dateKey, entries]) => ({
      date: new Date(dateKey),
      avgPrice: entries.reduce((sum, e) => sum + e.price, 0) / entries.length,
      volume: entries.length, // Use number of price points as volume proxy
    }));
  }

  private aggregateCompetitionData(
    priceHistory: PriceHistory[],
    timeframe: 'daily' | 'weekly' | 'monthly'
  ): Array<{ date: Date; competitorCount: number; newEntrants: number }> {
    const grouped = this.groupDataByTimeframe(priceHistory, timeframe);
    
    return Object.entries(grouped).map(([dateKey, entries]) => {
      const uniqueSellers = new Set(entries.map(e => e.sellerName));
      return {
        date: new Date(dateKey),
        competitorCount: uniqueSellers.size,
        newEntrants: 0, // Would need historical tracking
      };
    });
  }

  private aggregateDemandData(
    buyBoxHistory: BuyBoxHistory[],
    timeframe: 'daily' | 'weekly' | 'monthly'
  ): Array<{ date: Date; demandIndex: number; buyBoxChanges: number }> {
    const grouped = this.groupDataByTimeframe(buyBoxHistory, timeframe);
    
    return Object.entries(grouped).map(([dateKey, entries]) => ({
      date: new Date(dateKey),
      demandIndex: entries.length * 10, // Simplified demand index
      buyBoxChanges: entries.length,
    }));
  }

  private groupDataByTimeframe<T extends { timestamp: Date }>(
    data: T[],
    timeframe: 'daily' | 'weekly' | 'monthly'
  ): { [key: string]: T[] } {
    return data.reduce((groups, item) => {
      let key: string;
      const date = item.timestamp;
      
      switch (timeframe) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as { [key: string]: T[] });
  }

  private generateTrendInsights(
    priceTrend: any[],
    competitionTrend: any[],
    demandTrend: any[]
  ): Array<{
    type: 'price' | 'competition' | 'demand';
    insight: string;
    confidence: number;
    impact: 'positive' | 'negative' | 'neutral';
  }> {
    const insights = [];

    // Price trend insights
    if (priceTrend.length >= 2) {
      const priceChange = priceTrend[priceTrend.length - 1].avgPrice - priceTrend[0].avgPrice;
      const percentChange = (priceChange / priceTrend[0].avgPrice) * 100;
      
      if (Math.abs(percentChange) > 5) {
        insights.push({
          type: 'price' as const,
          insight: `Prices have ${percentChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(percentChange).toFixed(1)}% over the period`,
          confidence: 85,
          impact: percentChange > 0 ? 'negative' as const : 'positive' as const,
        });
      }
    }

    // Competition trend insights
    if (competitionTrend.length >= 2) {
      const competitorChange = competitionTrend[competitionTrend.length - 1].competitorCount - competitionTrend[0].competitorCount;
      
      if (Math.abs(competitorChange) >= 2) {
        insights.push({
          type: 'competition' as const,
          insight: `Number of competitors has ${competitorChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(competitorChange)} sellers`,
          confidence: 75,
          impact: competitorChange > 0 ? 'negative' as const : 'positive' as const,
        });
      }
    }

    return insights;
  }
}