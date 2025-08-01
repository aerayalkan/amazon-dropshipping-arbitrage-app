import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RepricingRule, ActionType } from '../entities/repricing-rule.entity';
import { CompetitorProduct } from '../entities/competitor-product.entity';
import { PriceHistory } from '../entities/price-history.entity';
import { MarketAnalysisService, MarketConditions } from './market-analysis.service';

export interface OptimizationContext {
  productId: string;
  asin: string;
  currentPrice: number;
  costPrice: number;
  targetMargin?: number;
  minMargin?: number;
  maxPrice?: number;
  minPrice?: number;
  inventoryLevel?: number;
  salesVelocity?: number;
  competitorData: {
    lowestPrice: number;
    averagePrice: number;
    buyBoxPrice: number;
    competitors: CompetitorProduct[];
  };
  marketConditions: MarketConditions;
  businessGoals: {
    primaryGoal: 'profit_maximization' | 'market_share' | 'buy_box_win' | 'inventory_turnover';
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    timeHorizon: 'short_term' | 'medium_term' | 'long_term';
  };
}

export interface OptimizationResult {
  recommendedPrice: number;
  priceChange: number;
  priceChangePercent: number;
  confidence: number; // 0-100
  reasoning: string;
  expectedOutcomes: {
    buyBoxProbability: number;
    marginImpact: number;
    salesImpact: number;
    competitivePosition: string;
  };
  risks: Array<{
    risk: string;
    probability: number;
    impact: 'low' | 'medium' | 'high';
    mitigation: string;
  }>;
  alternatives: Array<{
    price: number;
    scenario: string;
    pros: string[];
    cons: string[];
    score: number;
  }>;
}

export interface DynamicPricingStrategy {
  strategyName: string;
  description: string;
  rules: Array<{
    condition: string;
    action: string;
    parameters: any;
  }>;
  constraints: {
    maxPriceIncrease: number;
    maxPriceDecrease: number;
    minMargin: number;
    maxPrice: number;
    minPrice: number;
  };
  performance: {
    backtestedResults?: {
      avgMargin: number;
      buyBoxWinRate: number;
      totalRevenue: number;
      riskScore: number;
    };
  };
}

@Injectable()
export class PriceOptimizationService {
  private readonly logger = new Logger(PriceOptimizationService.name);

  constructor(
    @InjectRepository(RepricingRule)
    private readonly repricingRuleRepository: Repository<RepricingRule>,
    @InjectRepository(CompetitorProduct)
    private readonly competitorRepository: Repository<CompetitorProduct>,
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepository: Repository<PriceHistory>,
    private readonly marketAnalysisService: MarketAnalysisService,
  ) {}

  /**
   * Optimal fiyat önerisi hesapla
   */
  async optimizePrice(context: OptimizationContext): Promise<OptimizationResult> {
    this.logger.log(`Optimizing price for product: ${context.productId}`);

    // Apply different optimization strategies based on business goals
    const strategies = await this.generateOptimizationStrategies(context);
    
    // Evaluate each strategy
    const evaluatedStrategies = await Promise.all(
      strategies.map(strategy => this.evaluateStrategy(strategy, context))
    );

    // Select the best strategy
    const bestStrategy = evaluatedStrategies.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // Calculate detailed outcomes
    const expectedOutcomes = await this.calculateExpectedOutcomes(
      bestStrategy.price, 
      context
    );

    // Identify risks
    const risks = this.identifyRisks(bestStrategy.price, context);

    // Generate alternatives
    const alternatives = evaluatedStrategies
      .filter(s => s.price !== bestStrategy.price)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return {
      recommendedPrice: bestStrategy.price,
      priceChange: bestStrategy.price - context.currentPrice,
      priceChangePercent: ((bestStrategy.price - context.currentPrice) / context.currentPrice) * 100,
      confidence: bestStrategy.score,
      reasoning: bestStrategy.reasoning,
      expectedOutcomes,
      risks,
      alternatives: alternatives.map(alt => ({
        price: alt.price,
        scenario: alt.scenario,
        pros: alt.pros,
        cons: alt.cons,
        score: alt.score,
      })),
    };
  }

  /**
   * Dinamik fiyatlandırma stratejisi oluştur
   */
  async createDynamicPricingStrategy(
    userId: string,
    productIds: string[],
    config: {
      name: string;
      primaryGoal: 'profit_maximization' | 'market_share' | 'buy_box_win' | 'inventory_turnover';
      riskTolerance: 'conservative' | 'moderate' | 'aggressive';
      constraints: {
        maxPriceIncrease: number;
        maxPriceDecrease: number;
        minMargin: number;
      };
      marketResponseSensitivity: 'low' | 'medium' | 'high';
    }
  ): Promise<DynamicPricingStrategy> {
    this.logger.log(`Creating dynamic pricing strategy: ${config.name}`);

    const strategy = this.buildDynamicStrategy(config);
    
    // Backtest the strategy if historical data is available
    const backtestedResults = await this.backtestStrategy(strategy, productIds);
    strategy.performance.backtestedResults = backtestedResults;

    return strategy;
  }

  /**
   * A/B test fiyatlandırma stratejilerini karşılaştır
   */
  async compareStrategies(
    productId: string,
    strategies: Array<{
      name: string;
      pricePoint: number;
      duration: number; // days
    }>
  ): Promise<{
    results: Array<{
      strategyName: string;
      performance: {
        revenue: number;
        margin: number;
        units: number;
        buyBoxTime: number;
        conversationRate: number;
      };
      significance: number; // statistical significance
    }>;
    recommendation: string;
    confidence: number;
  }> {
    // This would implement A/B testing logic
    // For now, return mock results
    
    const results = strategies.map(strategy => ({
      strategyName: strategy.name,
      performance: {
        revenue: Math.random() * 10000,
        margin: Math.random() * 30,
        units: Math.random() * 1000,
        buyBoxTime: Math.random() * 100,
        conversationRate: Math.random() * 5,
      },
      significance: Math.random() * 100,
    }));

    const bestStrategy = results.reduce((best, current) => 
      current.performance.revenue > best.performance.revenue ? current : best
    );

    return {
      results,
      recommendation: `Strategy "${bestStrategy.strategyName}" shows best performance`,
      confidence: bestStrategy.significance,
    };
  }

  /**
   * Elasticity-based fiyat optimizasyonu
   */
  async optimizePriceByElasticity(
    asin: string,
    currentPrice: number,
    costPrice: number
  ): Promise<{
    optimalPrice: number;
    priceElasticity: number;
    demandForecast: Array<{
      price: number;
      expectedDemand: number;
      expectedRevenue: number;
      expectedProfit: number;
    }>;
    recommendation: string;
  }> {
    this.logger.log(`Calculating price elasticity for ASIN: ${asin}`);

    // Get historical price and sales data
    const priceHistory = await this.priceHistoryRepository.find({
      where: { asin },
      order: { timestamp: 'DESC' },
      take: 100,
    });

    // Calculate price elasticity (simplified)
    const priceElasticity = this.calculatePriceElasticity(priceHistory);
    
    // Generate demand forecast for different price points
    const demandForecast = this.generateDemandForecast(
      currentPrice,
      costPrice,
      priceElasticity
    );

    // Find optimal price point
    const optimalPoint = demandForecast.reduce((best, current) => 
      current.expectedProfit > best.expectedProfit ? current : best
    );

    const recommendation = this.generateElasticityRecommendation(
      currentPrice,
      optimalPoint.price,
      priceElasticity
    );

    return {
      optimalPrice: optimalPoint.price,
      priceElasticity,
      demandForecast,
      recommendation,
    };
  }

  // Private helper methods
  private async generateOptimizationStrategies(
    context: OptimizationContext
  ): Promise<Array<{
    name: string;
    price: number;
    reasoning: string;
    scenario: string;
  }>> {
    const strategies = [];
    const { competitorData, businessGoals, marketConditions } = context;

    // Strategy 1: Match lowest competitor
    strategies.push({
      name: 'Price Match',
      price: competitorData.lowestPrice,
      reasoning: 'Match lowest competitor to maximize competitiveness',
      scenario: 'price_match',
    });

    // Strategy 2: Undercut by small amount
    strategies.push({
      name: 'Aggressive Undercut',
      price: Math.max(context.minPrice || 0, competitorData.lowestPrice - 0.01),
      reasoning: 'Undercut lowest competitor by $0.01 for maximum competitive advantage',
      scenario: 'aggressive_undercut',
    });

    // Strategy 3: Premium positioning
    if (marketConditions.competition === 'low' || marketConditions.demand === 'high') {
      strategies.push({
        name: 'Premium Position',
        price: Math.min(context.maxPrice || Infinity, competitorData.averagePrice * 1.05),
        reasoning: 'Position above average for better margins in favorable market conditions',
        scenario: 'premium_position',
      });
    }

    // Strategy 4: Margin-optimized pricing
    if (context.targetMargin) {
      const marginPrice = context.costPrice / (1 - context.targetMargin / 100);
      strategies.push({
        name: 'Margin Target',
        price: marginPrice,
        reasoning: `Price to achieve target margin of ${context.targetMargin}%`,
        scenario: 'margin_target',
      });
    }

    // Strategy 5: Buy Box focused
    if (businessGoals.primaryGoal === 'buy_box_win') {
      const buyBoxPrice = this.calculateBuyBoxOptimalPrice(competitorData);
      strategies.push({
        name: 'Buy Box Optimized',
        price: buyBoxPrice,
        reasoning: 'Optimized specifically for Buy Box win probability',
        scenario: 'buy_box_focused',
      });
    }

    return strategies.filter(s => 
      s.price >= (context.minPrice || 0) && 
      s.price <= (context.maxPrice || Infinity)
    );
  }

  private async evaluateStrategy(
    strategy: { name: string; price: number; reasoning: string; scenario: string },
    context: OptimizationContext
  ): Promise<{
    price: number;
    scenario: string;
    reasoning: string;
    score: number;
    pros: string[];
    cons: string[];
  }> {
    let score = 50; // Base score
    const pros: string[] = [];
    const cons: string[] = [];

    // Calculate margin impact
    const newMargin = ((strategy.price - context.costPrice) / strategy.price) * 100;
    const marginDiff = newMargin - ((context.currentPrice - context.costPrice) / context.currentPrice) * 100;

    if (marginDiff > 0) {
      score += Math.min(20, marginDiff * 2);
      pros.push(`Improves margin by ${marginDiff.toFixed(1)}%`);
    } else if (marginDiff < 0) {
      score += Math.max(-20, marginDiff * 2);
      cons.push(`Reduces margin by ${Math.abs(marginDiff).toFixed(1)}%`);
    }

    // Evaluate competitive position
    const competitiveRank = this.calculateCompetitiveRank(strategy.price, context.competitorData);
    if (competitiveRank === 1) {
      score += 25;
      pros.push('Achieves lowest price position');
    } else if (competitiveRank <= 3) {
      score += 15;
      pros.push('Achieves top 3 price position');
    } else {
      score -= 10;
      cons.push('Higher than most competitors');
    }

    // Buy Box probability
    const buyBoxProb = this.estimateBuyBoxProbability(strategy.price, context);
    score += buyBoxProb * 0.3; // 30% weight
    if (buyBoxProb > 70) {
      pros.push(`High Buy Box probability (${buyBoxProb.toFixed(0)}%)`);
    } else if (buyBoxProb < 30) {
      cons.push(`Low Buy Box probability (${buyBoxProb.toFixed(0)}%)`);
    }

    // Risk assessment
    const riskScore = this.assessPricingRisk(strategy.price, context);
    score -= riskScore * 0.2; // Risk penalty

    // Business goal alignment
    const goalAlignment = this.assessGoalAlignment(strategy, context.businessGoals);
    score += goalAlignment * 0.15;

    return {
      price: strategy.price,
      scenario: strategy.scenario,
      reasoning: strategy.reasoning,
      score: Math.max(0, Math.min(100, score)),
      pros,
      cons,
    };
  }

  private calculateCompetitiveRank(price: number, competitorData: any): number {
    const allPrices = [price, ...competitorData.competitors.map(c => c.currentPrice)];
    const sortedPrices = allPrices.sort((a, b) => a - b);
    return sortedPrices.indexOf(price) + 1;
  }

  private estimateBuyBoxProbability(price: number, context: OptimizationContext): number {
    // Simplified Buy Box probability calculation
    const { competitorData } = context;
    const lowestPrice = competitorData.lowestPrice;
    
    if (price <= lowestPrice) return 85;
    
    const priceGapPercent = ((price - lowestPrice) / lowestPrice) * 100;
    
    if (priceGapPercent <= 1) return 75;
    if (priceGapPercent <= 2) return 60;
    if (priceGapPercent <= 5) return 40;
    if (priceGapPercent <= 10) return 20;
    
    return 5;
  }

  private assessPricingRisk(price: number, context: OptimizationContext): number {
    let risk = 0;

    // Price change magnitude risk
    const priceChangePercent = Math.abs((price - context.currentPrice) / context.currentPrice) * 100;
    if (priceChangePercent > 20) risk += 30;
    else if (priceChangePercent > 10) risk += 15;
    else if (priceChangePercent > 5) risk += 5;

    // Margin risk
    const newMargin = ((price - context.costPrice) / price) * 100;
    if (newMargin < (context.minMargin || 0)) risk += 40;
    else if (newMargin < 10) risk += 20;

    // Market volatility risk
    if (context.marketConditions.volatility > 20) risk += 15;
    else if (context.marketConditions.volatility > 10) risk += 10;

    // Competition risk
    if (context.marketConditions.competition === 'high') risk += 10;

    return Math.min(100, risk);
  }

  private assessGoalAlignment(
    strategy: { scenario: string },
    businessGoals: OptimizationContext['businessGoals']
  ): number {
    const { primaryGoal, riskTolerance } = businessGoals;
    
    let alignment = 0;

    switch (primaryGoal) {
      case 'profit_maximization':
        if (strategy.scenario === 'margin_target' || strategy.scenario === 'premium_position') {
          alignment += 20;
        }
        break;
      case 'market_share':
        if (strategy.scenario === 'aggressive_undercut' || strategy.scenario === 'price_match') {
          alignment += 20;
        }
        break;
      case 'buy_box_win':
        if (strategy.scenario === 'buy_box_focused' || strategy.scenario === 'aggressive_undercut') {
          alignment += 20;
        }
        break;
    }

    // Risk tolerance alignment
    if (riskTolerance === 'conservative' && strategy.scenario === 'premium_position') {
      alignment += 10;
    } else if (riskTolerance === 'aggressive' && strategy.scenario === 'aggressive_undercut') {
      alignment += 10;
    }

    return alignment;
  }

  private calculateBuyBoxOptimalPrice(competitorData: OptimizationContext['competitorData']): number {
    const { lowestPrice, competitors } = competitorData;
    
    // Find the best positioned competitor
    const primeCompetitors = competitors.filter(c => c.isPrimeEligible);
    const bestCompetitor = primeCompetitors.length > 0 ? 
      primeCompetitors.reduce((best, current) => 
        current.currentPrice < best.currentPrice ? current : best
      ) : competitors[0];

    // Price slightly below the best competitor
    return Math.max(lowestPrice - 0.01, bestCompetitor.currentPrice - 0.01);
  }

  private async calculateExpectedOutcomes(
    price: number,
    context: OptimizationContext
  ): Promise<OptimizationResult['expectedOutcomes']> {
    const buyBoxProbability = this.estimateBuyBoxProbability(price, context);
    
    const currentMargin = ((context.currentPrice - context.costPrice) / context.currentPrice) * 100;
    const newMargin = ((price - context.costPrice) / price) * 100;
    const marginImpact = newMargin - currentMargin;

    // Simplified sales impact calculation
    const priceChangePercent = ((price - context.currentPrice) / context.currentPrice) * 100;
    const salesImpact = -priceChangePercent * 0.5; // Assume 0.5 elasticity

    const competitiveRank = this.calculateCompetitiveRank(price, context.competitorData);
    const competitivePosition = competitiveRank === 1 ? 'Lowest price' :
                               competitiveRank <= 3 ? 'Top 3 pricing' :
                               competitiveRank <= 5 ? 'Competitive' : 'Above market';

    return {
      buyBoxProbability,
      marginImpact,
      salesImpact,
      competitivePosition,
    };
  }

  private identifyRisks(
    price: number,
    context: OptimizationContext
  ): OptimizationResult['risks'] {
    const risks: OptimizationResult['risks'] = [];

    // Price war risk
    if (price < context.competitorData.lowestPrice) {
      risks.push({
        risk: 'May trigger price war with competitors',
        probability: 60,
        impact: 'high',
        mitigation: 'Monitor competitor responses and be ready to adjust',
      });
    }

    // Margin erosion risk
    const newMargin = ((price - context.costPrice) / price) * 100;
    if (newMargin < 15) {
      risks.push({
        risk: 'Low margin may impact profitability',
        probability: 80,
        impact: 'medium',
        mitigation: 'Focus on volume increase to compensate',
      });
    }

    // Market volatility risk
    if (context.marketConditions.volatility > 15) {
      risks.push({
        risk: 'High market volatility may require frequent adjustments',
        probability: 70,
        impact: 'medium',
        mitigation: 'Implement dynamic pricing rules',
      });
    }

    return risks;
  }

  private buildDynamicStrategy(config: any): DynamicPricingStrategy {
    const rules = [];

    // Add rules based on configuration
    if (config.primaryGoal === 'buy_box_win') {
      rules.push({
        condition: 'competitor_price_change',
        action: 'undercut_by_amount',
        parameters: { amount: 0.01 },
      });
    }

    if (config.marketResponseSensitivity === 'high') {
      rules.push({
        condition: 'demand_spike',
        action: 'increase_by_percent',
        parameters: { percentage: 5 },
      });
    }

    return {
      strategyName: config.name,
      description: `Dynamic pricing strategy focused on ${config.primaryGoal}`,
      rules,
      constraints: {
        maxPriceIncrease: config.constraints.maxPriceIncrease,
        maxPriceDecrease: config.constraints.maxPriceDecrease,
        minMargin: config.constraints.minMargin,
        maxPrice: 999.99,
        minPrice: 0.01,
      },
      performance: {},
    };
  }

  private async backtestStrategy(
    strategy: DynamicPricingStrategy,
    productIds: string[]
  ): Promise<any> {
    // Simplified backtesting - would use historical data in production
    return {
      avgMargin: 25.5,
      buyBoxWinRate: 68.2,
      totalRevenue: 125000,
      riskScore: 35,
    };
  }

  private calculatePriceElasticity(priceHistory: PriceHistory[]): number {
    if (priceHistory.length < 10) return -1.5; // Default elasticity

    // Simplified elasticity calculation
    const priceChanges = [];
    const demandChanges = [];

    for (let i = 1; i < priceHistory.length; i++) {
      const priceChange = (priceHistory[i].price - priceHistory[i-1].price) / priceHistory[i-1].price;
      // Would need actual sales data - using proxy
      const demandChange = Math.random() * 0.1 - 0.05; // Mock data
      
      if (Math.abs(priceChange) > 0.01) {
        priceChanges.push(priceChange);
        demandChanges.push(demandChange);
      }
    }

    if (priceChanges.length === 0) return -1.5;

    // Simple linear regression for elasticity
    const correlation = this.calculateCorrelation(priceChanges, demandChanges);
    return correlation * -2; // Convert to elasticity
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const correlation = (n * sumXY - sumX * sumY) / 
      Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return isNaN(correlation) ? 0 : correlation;
  }

  private generateDemandForecast(
    currentPrice: number,
    costPrice: number,
    elasticity: number
  ): Array<{
    price: number;
    expectedDemand: number;
    expectedRevenue: number;
    expectedProfit: number;
  }> {
    const forecast = [];
    const baselineDemand = 100; // Units per month

    for (let i = -20; i <= 20; i += 5) {
      const price = currentPrice * (1 + i / 100);
      const priceChange = (price - currentPrice) / currentPrice;
      const demandChange = elasticity * priceChange;
      const expectedDemand = baselineDemand * (1 + demandChange);
      const expectedRevenue = price * expectedDemand;
      const expectedProfit = (price - costPrice) * expectedDemand;

      forecast.push({
        price,
        expectedDemand,
        expectedRevenue,
        expectedProfit,
      });
    }

    return forecast;
  }

  private generateElasticityRecommendation(
    currentPrice: number,
    optimalPrice: number,
    elasticity: number
  ): string {
    const priceChange = ((optimalPrice - currentPrice) / currentPrice) * 100;
    
    if (Math.abs(priceChange) < 2) {
      return 'Current pricing is near optimal. Minor adjustments may be beneficial.';
    } else if (priceChange > 0) {
      return `Consider increasing price by ${priceChange.toFixed(1)}% to maximize profit. Demand is relatively inelastic (${elasticity.toFixed(2)}).`;
    } else {
      return `Consider decreasing price by ${Math.abs(priceChange).toFixed(1)}% to maximize profit through increased volume.`;
    }
  }
}