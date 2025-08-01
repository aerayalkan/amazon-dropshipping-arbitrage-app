import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { RepricingRule, RuleStatus, TriggerCondition, ActionType } from '../entities/repricing-rule.entity';
import { RepricingSession, SessionStatus, TriggerSource, ExecutionResult } from '../entities/repricing-session.entity';
import { CompetitorProduct } from '../entities/competitor-product.entity';
import { PriceHistory } from '../entities/price-history.entity';
import { BuyBoxHistory } from '../entities/buy-box-history.entity';

import { CompetitorMonitoringService } from './competitor-monitoring.service';
import { BuyBoxAnalyzerService } from './buybox-analyzer.service';
import { MarketAnalysisService } from './market-analysis.service';
import { PriceOptimizationService } from './price-optimization.service';

export interface RepricingContext {
  inventoryItemId: string;
  asin: string;
  productName: string;
  currentPrice: number;
  costPrice: number;
  currentMargin: number;
  inventoryLevel?: number;
  salesVelocity?: number;
  competitorData: {
    lowestPrice: number;
    averagePrice: number;
    buyBoxPrice: number;
    competitorCount: number;
    competitors: Array<{
      sellerId: string;
      sellerName: string;
      price: number;
      buyBoxWinner: boolean;
      prime: boolean;
      fulfillmentType: string;
    }>;
  };
  marketConditions: {
    volatility: number;
    competition: 'low' | 'medium' | 'high';
    demand: 'low' | 'medium' | 'high';
    season: 'normal' | 'peak' | 'low';
  };
}

export interface RepricingResult {
  productId: string;
  oldPrice: number;
  newPrice?: number;
  priceChange?: number;
  executed: boolean;
  result: ExecutionResult;
  reasoning: string;
  constraints?: string[];
  warnings?: string[];
  metadata?: any;
}

@Injectable()
export class RepricingEngineService {
  private readonly logger = new Logger(RepricingEngineService.name);
  private isProcessing = false;

  constructor(
    @InjectRepository(RepricingRule)
    private readonly repricingRuleRepository: Repository<RepricingRule>,
    @InjectRepository(RepricingSession)
    private readonly sessionRepository: Repository<RepricingSession>,
    @InjectRepository(CompetitorProduct)
    private readonly competitorRepository: Repository<CompetitorProduct>,
    private readonly competitorMonitoringService: CompetitorMonitoringService,
    private readonly buyBoxAnalyzerService: BuyBoxAnalyzerService,
    private readonly marketAnalysisService: MarketAnalysisService,
    private readonly priceOptimizationService: PriceOptimizationService,
  ) {}

  /**
   * Ana repricing engine - scheduled olarak çalışır
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runScheduledRepricing(): Promise<void> {
    if (this.isProcessing) {
      this.logger.warn('Repricing already in progress, skipping scheduled run');
      return;
    }

    try {
      this.isProcessing = true;
      this.logger.log('Starting scheduled repricing engine');

      // Get active rules that are due for execution
      const activeRules = await this.getActiveRulesForExecution();
      
      for (const rule of activeRules) {
        if (rule.isEligibleForExecution()) {
          await this.executeRule(rule, TriggerSource.SCHEDULED);
        }
      }

      this.logger.log(`Completed scheduled repricing: processed ${activeRules.length} rules`);

    } catch (error) {
      this.logger.error(`Error in scheduled repricing: ${error.message}`);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Belirli bir kural için repricing çalıştır
   */
  async executeRule(
    rule: RepricingRule,
    triggerSource: TriggerSource,
    triggerDetails?: any
  ): Promise<RepricingSession> {
    this.logger.log(`Executing repricing rule: ${rule.ruleName} (${rule.id})`);

    // Create session
    const session = await this.createSession(rule, triggerSource, triggerDetails);
    
    try {
      // Get target products
      const products = await this.getTargetProducts(rule);
      session.totalProducts = products.length;

      if (products.length === 0) {
        this.logger.warn(`No products found for rule: ${rule.ruleName}`);
        session.complete(SessionStatus.COMPLETED);
        await this.sessionRepository.save(session);
        return session;
      }

      // Process each product
      for (const product of products) {
        try {
          const context = await this.buildRepricingContext(product);
          const result = await this.processProduct(rule, context);
          
          session.addExecutionResult({
            productId: product.id,
            asin: product.asin,
            productName: product.productName,
            result: result.result,
            oldPrice: result.oldPrice,
            newPrice: result.newPrice,
            reasoning: result.reasoning,
            error: result.result === ExecutionResult.FAILED ? result.reasoning : undefined,
            executionTime: Date.now() - session.startedAt.getTime(),
            competitorData: context.competitorData,
          });

          // Apply price change if successful
          if (result.executed && result.newPrice) {
            await this.applyPriceChange(product.id, result.newPrice, rule.id, result.reasoning);
          }

        } catch (error) {
          this.logger.error(`Error processing product ${product.id}: ${error.message}`);
          session.addExecutionResult({
            productId: product.id,
            asin: product.asin || 'unknown',
            productName: product.productName || 'unknown',
            result: ExecutionResult.FAILED,
            oldPrice: product.currentPrice || 0,
            reasoning: `Processing error: ${error.message}`,
          });
        }
      }

      // Complete session
      session.complete(SessionStatus.COMPLETED);
      
      // Update rule performance
      await this.updateRulePerformance(rule, session);

    } catch (error) {
      this.logger.error(`Critical error in rule execution: ${error.message}`);
      session.criticalError = error.message;
      session.complete(SessionStatus.FAILED);
    }

    await this.sessionRepository.save(session);
    return session;
  }

  /**
   * Manuel repricing tetikleme
   */
  async triggerManualRepricing(
    userId: string,
    ruleId: string,
    productIds?: string[]
  ): Promise<RepricingSession> {
    const rule = await this.repricingRuleRepository.findOne({
      where: { id: ruleId, userId },
    });

    if (!rule) {
      throw new Error('Repricing rule not found');
    }

    const triggerDetails = {
      triggeredBy: userId,
      productIds,
      timestamp: new Date(),
    };

    return this.executeRule(rule, TriggerSource.MANUAL, triggerDetails);
  }

  /**
   * Competitor price change tetikleme
   */
  async handleCompetitorPriceChange(
    asin: string,
    competitorSellerId: string,
    oldPrice: number,
    newPrice: number
  ): Promise<void> {
    this.logger.log(`Competitor price change detected: ${asin}, ${oldPrice} -> ${newPrice}`);

    // Find rules that monitor this ASIN
    const rules = await this.repricingRuleRepository.find({
      where: { 
        ruleStatus: RuleStatus.ACTIVE,
        isActive: true,
      },
    });

    const applicableRules = rules.filter(rule => 
      this.isRuleApplicableToASIN(rule, asin) &&
      rule.triggerConditions.primary.condition === TriggerCondition.COMPETITOR_PRICE_CHANGE
    );

    for (const rule of applicableRules) {
      const triggerDetails = {
        asin,
        competitorSellerId,
        oldPrice,
        newPrice,
        priceChange: newPrice - oldPrice,
        priceChangePercent: ((newPrice - oldPrice) / oldPrice) * 100,
      };

      await this.executeRule(rule, TriggerSource.PRICE_CHANGE, triggerDetails);
    }
  }

  /**
   * Buy Box loss tetikleme
   */
  async handleBuyBoxLoss(
    asin: string,
    previousWinner: string,
    newWinner: string,
    newPrice: number
  ): Promise<void> {
    this.logger.log(`Buy Box lost: ${asin}, new winner: ${newWinner} at ${newPrice}`);

    const rules = await this.repricingRuleRepository.find({
      where: { 
        ruleStatus: RuleStatus.ACTIVE,
        isActive: true,
      },
    });

    const applicableRules = rules.filter(rule => 
      this.isRuleApplicableToASIN(rule, asin) &&
      rule.triggerConditions.primary.condition === TriggerCondition.BUY_BOX_LOST
    );

    for (const rule of applicableRules) {
      const triggerDetails = {
        asin,
        previousWinner,
        newWinner,
        newWinnerPrice: newPrice,
        timestamp: new Date(),
      };

      await this.executeRule(rule, TriggerSource.BUY_BOX_LOST, triggerDetails);
    }
  }

  /**
   * Repricing performance analizi
   */
  async analyzeRulePerformance(
    userId: string,
    ruleId?: string,
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{
    rulePerformance: Array<{
      ruleId: string;
      ruleName: string;
      executions: number;
      successRate: number;
      avgPriceChange: number;
      buyBoxWins: number;
      estimatedRevenue: number;
      effectiveness: number;
    }>;
    summary: {
      totalExecutions: number;
      overallSuccessRate: number;
      totalBuyBoxWins: number;
      totalRevenue: number;
    };
  }> {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    let query = this.sessionRepository.createQueryBuilder('session')
      .leftJoinAndSelect('session.rule', 'rule')
      .where('session.userId = :userId', { userId })
      .andWhere('session.startedAt BETWEEN :startDate AND :endDate', { startDate, endDate });

    if (ruleId) {
      query = query.andWhere('session.ruleId = :ruleId', { ruleId });
    }

    const sessions = await query.getMany();

    const rulePerformance = this.calculateRulePerformance(sessions);
    const summary = this.calculateSummary(sessions);

    return { rulePerformance, summary };
  }

  // Private helper methods
  private async getActiveRulesForExecution(): Promise<RepricingRule[]> {
    const now = new Date();
    
    return this.repricingRuleRepository.find({
      where: {
        ruleStatus: RuleStatus.ACTIVE,
        isActive: true,
        nextExecutionTime: Between(new Date(0), now),
      },
      order: { priority: 'ASC' },
    });
  }

  private async getTargetProducts(rule: RepricingRule): Promise<any[]> {
    // This would integrate with inventory module to get products
    // For now, return mock data
    const products = [];

    if (rule.targetConfiguration.productIds) {
      // Get specific products by ID
      products.push(...rule.targetConfiguration.productIds.map(id => ({
        id,
        asin: 'B000EXAMPLE',
        productName: 'Example Product',
        currentPrice: 29.99,
        costPrice: 15.00,
      })));
    }

    if (rule.targetConfiguration.asins) {
      // Get products by ASIN
      for (const asin of rule.targetConfiguration.asins) {
        products.push({
          id: `product_${asin}`,
          asin,
          productName: `Product ${asin}`,
          currentPrice: 29.99,
          costPrice: 15.00,
        });
      }
    }

    return products;
  }

  private async buildRepricingContext(product: any): Promise<RepricingContext> {
    // Get competitor data
    const competitors = await this.competitorRepository.find({
      where: { asin: product.asin, isMonitored: true },
      order: { currentPrice: 'ASC' },
    });

    const competitorData = {
      lowestPrice: competitors.length > 0 ? competitors[0].currentPrice : product.currentPrice,
      averagePrice: competitors.length > 0 
        ? competitors.reduce((sum, c) => sum + c.currentPrice, 0) / competitors.length
        : product.currentPrice,
      buyBoxPrice: competitors.find(c => c.buyBoxWinner)?.currentPrice || product.currentPrice,
      competitorCount: competitors.length,
      competitors: competitors.map(c => ({
        sellerId: c.sellerId || c.sellerName,
        sellerName: c.sellerName,
        price: c.currentPrice,
        buyBoxWinner: c.buyBoxWinner,
        prime: c.isPrimeEligible,
        fulfillmentType: c.fulfillmentType || 'FBM',
      })),
    };

    // Get market conditions
    const marketConditions = await this.marketAnalysisService.getMarketConditions(product.asin);

    return {
      inventoryItemId: product.id,
      asin: product.asin,
      productName: product.productName,
      currentPrice: product.currentPrice,
      costPrice: product.costPrice,
      currentMargin: ((product.currentPrice - product.costPrice) / product.currentPrice) * 100,
      competitorData,
      marketConditions,
    };
  }

  private async processProduct(
    rule: RepricingRule,
    context: RepricingContext
  ): Promise<RepricingResult> {
    const result: RepricingResult = {
      productId: context.inventoryItemId,
      oldPrice: context.currentPrice,
      executed: false,
      result: ExecutionResult.SKIPPED,
      reasoning: 'Not processed',
    };

    try {
      // Check if conditions are met
      const conditionsMet = this.evaluateTriggerConditions(rule, context);
      if (!conditionsMet.met) {
        result.result = ExecutionResult.SKIPPED;
        result.reasoning = conditionsMet.reason;
        return result;
      }

      // Calculate new price
      const priceCalculation = rule.calculateNewPrice(
        context.currentPrice,
        context.competitorData,
        {
          costPrice: context.costPrice,
          currentMargin: context.currentMargin,
          salesVelocity: context.salesVelocity,
          inventoryLevel: context.inventoryLevel,
        }
      );

      if (!priceCalculation) {
        result.result = ExecutionResult.CONSTRAINT_VIOLATION;
        result.reasoning = 'No valid price calculation possible';
        return result;
      }

      // Validate constraints
      const constraintValidation = this.validateConstraints(rule, context, priceCalculation.newPrice);
      if (!constraintValidation.valid) {
        result.result = ExecutionResult.CONSTRAINT_VIOLATION;
        result.reasoning = constraintValidation.reason;
        result.constraints = constraintValidation.violations;
        return result;
      }

      // Apply the price change
      result.newPrice = priceCalculation.newPrice;
      result.priceChange = priceCalculation.newPrice - context.currentPrice;
      result.executed = true;
      result.result = ExecutionResult.SUCCESS;
      result.reasoning = priceCalculation.reasoning;

      return result;

    } catch (error) {
      result.result = ExecutionResult.FAILED;
      result.reasoning = `Error: ${error.message}`;
      return result;
    }
  }

  private evaluateTriggerConditions(
    rule: RepricingRule,
    context: RepricingContext
  ): { met: boolean; reason: string } {
    const condition = rule.triggerConditions.primary;

    switch (condition.condition) {
      case TriggerCondition.COMPETITOR_PRICE_CHANGE:
        // Always true for scheduled runs - real logic would check if competitor prices changed recently
        return { met: true, reason: 'Competitor price monitoring active' };

      case TriggerCondition.BUY_BOX_LOST:
        // Check if we lost buy box (would need our seller info)
        const buyBoxWinner = context.competitorData.competitors.find(c => c.buyBoxWinner);
        if (buyBoxWinner && buyBoxWinner.sellerId !== 'our-seller-id') {
          return { met: true, reason: 'Buy Box lost to competitor' };
        }
        return { met: false, reason: 'Buy Box not lost' };

      case TriggerCondition.MARGIN_THRESHOLD:
        const minMargin = condition.parameters?.minMargin || 10;
        if (context.currentMargin < minMargin) {
          return { met: true, reason: `Margin below threshold: ${context.currentMargin.toFixed(1)}%` };
        }
        return { met: false, reason: 'Margin above threshold' };

      case TriggerCondition.TIME_INTERVAL:
        // For scheduled runs, always true
        return { met: true, reason: 'Scheduled time interval' };

      default:
        return { met: false, reason: 'Unknown trigger condition' };
    }
  }

  private validateConstraints(
    rule: RepricingRule,
    context: RepricingContext,
    newPrice: number
  ): { valid: boolean; reason: string; violations?: string[] } {
    const constraints = rule.constraints;
    const violations: string[] = [];

    // Price constraints
    if (constraints.pricing.minPrice && newPrice < constraints.pricing.minPrice) {
      violations.push(`Price below minimum: ${newPrice} < ${constraints.pricing.minPrice}`);
    }

    if (constraints.pricing.maxPrice && newPrice > constraints.pricing.maxPrice) {
      violations.push(`Price above maximum: ${newPrice} > ${constraints.pricing.maxPrice}`);
    }

    // Margin constraints
    const newMargin = ((newPrice - context.costPrice) / newPrice) * 100;
    if (constraints.pricing.minMargin && newMargin < constraints.pricing.minMargin) {
      violations.push(`Margin below minimum: ${newMargin.toFixed(1)}% < ${constraints.pricing.minMargin}%`);
    }

    // Change constraints
    const changeAmount = Math.abs(newPrice - context.currentPrice);
    const changePercent = (changeAmount / context.currentPrice) * 100;

    if (newPrice > context.currentPrice && constraints.execution.maxPriceIncrease) {
      if (changeAmount > constraints.execution.maxPriceIncrease) {
        violations.push(`Price increase too large: ${changeAmount} > ${constraints.execution.maxPriceIncrease}`);
      }
    }

    if (newPrice < context.currentPrice && constraints.execution.maxPriceDecrease) {
      if (changeAmount > constraints.execution.maxPriceDecrease) {
        violations.push(`Price decrease too large: ${changeAmount} > ${constraints.execution.maxPriceDecrease}`);
      }
    }

    return {
      valid: violations.length === 0,
      reason: violations.length > 0 ? violations[0] : 'All constraints satisfied',
      violations: violations.length > 0 ? violations : undefined,
    };
  }

  private async applyPriceChange(
    productId: string,
    newPrice: number,
    ruleId: string,
    reasoning: string
  ): Promise<void> {
    // This would integrate with inventory module to update the actual price
    this.logger.log(`Price change applied: Product ${productId} -> ${newPrice} (Rule: ${ruleId})`);
    
    // Would also create a price history entry
    // await this.priceHistoryService.createEntry({...});
  }

  private async createSession(
    rule: RepricingRule,
    triggerSource: TriggerSource,
    triggerDetails?: any
  ): Promise<RepricingSession> {
    const session = RepricingSession.createSession({
      userId: rule.userId,
      ruleId: rule.id,
      rule,
      triggerSource,
      triggerDetails,
    });

    return this.sessionRepository.save(session);
  }

  private isRuleApplicableToASIN(rule: RepricingRule, asin: string): boolean {
    const config = rule.targetConfiguration;
    
    // Check if ASIN is specifically included
    if (config.asins && config.asins.includes(asin)) {
      return true;
    }

    // Check if ASIN is excluded
    if (config.excludeProducts && config.excludeProducts.includes(asin)) {
      return false;
    }

    // If no specific ASINs configured, rule applies to all
    if (!config.asins || config.asins.length === 0) {
      return true;
    }

    return false;
  }

  private async updateRulePerformance(
    rule: RepricingRule,
    session: RepricingSession
  ): Promise<void> {
    rule.lastExecutionTime = session.startedAt;
    rule.totalExecutions++;
    
    if (session.sessionStatus === SessionStatus.COMPLETED) {
      rule.successfulExecutions++;
    } else {
      rule.failedExecutions++;
    }

    // Update performance metrics
    if (!rule.performanceMetrics) {
      rule.performanceMetrics = {
        avgExecutionTime: 0,
        avgPriceChange: 0,
        buyBoxWinRate: 0,
        salesImpact: 0,
        marginImpact: 0,
        errorRate: 0,
      };
    }

    if (session.durationMs) {
      rule.performanceMetrics.avgExecutionTime = 
        (rule.performanceMetrics.avgExecutionTime + session.durationMs) / 2;
    }

    rule.performanceMetrics.errorRate = 
      (rule.failedExecutions / rule.totalExecutions) * 100;

    // Schedule next execution
    if (rule.schedule?.frequency === 'hourly') {
      rule.nextExecutionTime = new Date(Date.now() + 60 * 60 * 1000);
    } else if (rule.schedule?.frequency === 'daily') {
      rule.nextExecutionTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
    } else {
      rule.nextExecutionTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes default
    }

    await this.repricingRuleRepository.save(rule);
  }

  private calculateRulePerformance(sessions: RepricingSession[]): Array<any> {
    const ruleGroups = sessions.reduce((groups, session) => {
      const ruleId = session.ruleId;
      if (!groups[ruleId]) {
        groups[ruleId] = [];
      }
      groups[ruleId].push(session);
      return groups;
    }, {} as { [key: string]: RepricingSession[] });

    return Object.entries(ruleGroups).map(([ruleId, ruleSessions]) => {
      const totalExecutions = ruleSessions.length;
      const successfulSessions = ruleSessions.filter(s => s.sessionStatus === SessionStatus.COMPLETED).length;
      const successRate = (successfulSessions / totalExecutions) * 100;

      const totalPriceChanges = ruleSessions.reduce((sum, s) => 
        sum + (s.priceChangesSummary?.totalChanges || 0), 0);
      
      const avgPriceChange = ruleSessions.length > 0
        ? ruleSessions.reduce((sum, s) => sum + (s.priceChangesSummary?.averageChange || 0), 0) / ruleSessions.length
        : 0;

      return {
        ruleId,
        ruleName: ruleSessions[0]?.ruleSnapshot?.ruleName || 'Unknown',
        executions: totalExecutions,
        successRate,
        avgPriceChange,
        buyBoxWins: 0, // Would need buy box tracking
        estimatedRevenue: 0, // Would need sales data
        effectiveness: (successRate + Math.min(100, totalPriceChanges * 10)) / 2,
      };
    });
  }

  private calculateSummary(sessions: RepricingSession[]): any {
    const totalExecutions = sessions.length;
    const successfulSessions = sessions.filter(s => s.sessionStatus === SessionStatus.COMPLETED).length;
    const overallSuccessRate = totalExecutions > 0 ? (successfulSessions / totalExecutions) * 100 : 0;

    return {
      totalExecutions,
      overallSuccessRate,
      totalBuyBoxWins: 0, // Would need buy box data
      totalRevenue: 0, // Would need sales data
    };
  }
}