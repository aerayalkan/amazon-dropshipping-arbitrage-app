import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';

import { PricingCalculation, CalculationType, MarketplaceType, FulfillmentMethod } from '../entities/pricing-calculation.entity';
import { FeeStructure } from '../entities/fee-structure.entity';
import { CurrencyRate } from '../entities/currency-rate.entity';
import { TaxConfiguration } from '../entities/tax-configuration.entity';
import { ProfitAnalysis } from '../entities/profit-analysis.entity';

import { FeeCalculatorService } from './fee-calculator.service';
import { CurrencyConverterService } from './currency-converter.service';
import { TaxCalculatorService } from './tax-calculator.service';
import { ProfitAnalyzerService } from './profit-analyzer.service';

export interface PricingInput {
  productName: string;
  costPrice: number;
  sellingPrice: number;
  productCategory: string;
  marketplace: MarketplaceType;
  fulfillmentMethod: FulfillmentMethod;
  currency?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    weight: number;
    unit: 'inch' | 'cm';
  };
  shippingCost?: number;
  additionalCosts?: {
    advertisingCost?: number;
    packagingCost?: number;
    handlingFee?: number;
    otherFees?: Array<{ name: string; amount: number }>;
  };
  asin?: string;
  productId?: string;
}

export interface CalculationOptions {
  includeCompetitorAnalysis?: boolean;
  includeScenarioAnalysis?: boolean;
  includeForecast?: boolean;
  targetCurrency?: string;
  taxConfiguration?: string; // Tax config ID
  saveCalculation?: boolean;
}

export interface CalculationResult {
  calculation: PricingCalculation;
  profitAnalysis?: ProfitAnalysis;
  recommendations: Array<{
    type: 'price_optimization' | 'cost_reduction' | 'market_opportunity' | 'risk_warning';
    priority: 'high' | 'medium' | 'low';
    message: string;
    action?: string;
    impact?: string;
  }>;
  benchmarks?: {
    industryAverage: number;
    topPerformer: number;
    marketMedian: number;
  };
}

@Injectable()
export class PricingCalculatorService {
  private readonly logger = new Logger(PricingCalculatorService.name);

  constructor(
    @InjectRepository(PricingCalculation)
    private readonly calculationRepository: Repository<PricingCalculation>,
    @InjectRepository(FeeStructure)
    private readonly feeStructureRepository: Repository<FeeStructure>,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly taxCalculatorService: TaxCalculatorService,
    private readonly profitAnalyzerService: ProfitAnalyzerService,
  ) {}

  /**
   * Ana fiyatlandırma hesaplama metodu
   */
  async calculatePricing(
    userId: string,
    input: PricingInput,
    options: CalculationOptions = {}
  ): Promise<CalculationResult> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Starting pricing calculation for user: ${userId}, product: ${input.productName}`);

      // 1. Currency conversion (if needed)
      const baseCurrency = input.currency || 'USD';
      const targetCurrency = options.targetCurrency || baseCurrency;
      
      let exchangeRate = 1;
      if (baseCurrency !== targetCurrency) {
        exchangeRate = await this.currencyConverterService.getExchangeRate(baseCurrency, targetCurrency);
      }

      // 2. Amazon fees calculation
      const amazonFees = await this.feeCalculatorService.calculateAmazonFees({
        sellingPrice: input.sellingPrice,
        productCategory: input.productCategory,
        marketplace: input.marketplace,
        fulfillmentMethod: input.fulfillmentMethod,
        dimensions: input.dimensions,
      });

      // 3. Tax calculation
      const taxCalculations = await this.taxCalculatorService.calculateTaxes(userId, {
        sellingPrice: input.sellingPrice,
        marketplace: input.marketplace,
        productCategory: input.productCategory,
        customerType: 'b2c',
      });

      // 4. Additional costs processing
      const additionalCosts = this.processAdditionalCosts(input.additionalCosts);

      // 5. Profit calculations
      const profitAnalysis = this.calculateProfitMetrics({
        costPrice: input.costPrice,
        sellingPrice: input.sellingPrice,
        shippingCost: input.shippingCost || 0,
        amazonFees,
        taxCalculations,
        additionalCosts,
      });

      // 6. Create pricing calculation entity
      const calculation = await this.createPricingCalculation(userId, {
        input,
        amazonFees,
        taxCalculations,
        additionalCosts,
        profitAnalysis,
        exchangeRate,
        targetCurrency,
        calculationDuration: Date.now() - startTime,
      });

      // 7. Competitive analysis (if requested)
      let competitiveAnalysis;
      if (options.includeCompetitorAnalysis && input.asin) {
        competitiveAnalysis = await this.performCompetitiveAnalysis(input.asin, input.sellingPrice);
        calculation.competitiveAnalysis = competitiveAnalysis;
      }

      // 8. Scenario analysis (if requested)
      if (options.includeScenarioAnalysis) {
        const scenarioAnalysis = await this.performScenarioAnalysis(userId, input);
        calculation.scenarioAnalysis = scenarioAnalysis;
      }

      // 9. Save calculation (if requested)
      if (options.saveCalculation !== false) {
        await this.calculationRepository.save(calculation);
      }

      // 10. Generate profit analysis
      let detailedProfitAnalysis;
      if (options.includeForecast) {
        detailedProfitAnalysis = await this.profitAnalyzerService.createDetailedAnalysis(
          userId,
          calculation
        );
      }

      // 11. Generate recommendations
      const recommendations = this.generateRecommendations(calculation);

      // 12. Get benchmarks
      const benchmarks = await this.getBenchmarks(input.productCategory, input.marketplace);

      const result: CalculationResult = {
        calculation,
        profitAnalysis: detailedProfitAnalysis,
        recommendations,
        benchmarks,
      };

      this.logger.log(`Pricing calculation completed for ${input.productName} in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      this.logger.error(`Error in pricing calculation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toplu fiyatlandırma hesaplaması
   */
  async calculateBulkPricing(
    userId: string,
    inputs: PricingInput[],
    options: CalculationOptions = {}
  ): Promise<{
    results: CalculationResult[];
    summary: {
      totalProducts: number;
      profitableProducts: number;
      averageMargin: number;
      totalExpectedProfit: number;
      recommendations: string[];
    };
  }> {
    this.logger.log(`Starting bulk pricing calculation for ${inputs.length} products`);

    const results: CalculationResult[] = [];
    let totalProfit = 0;
    let profitableCount = 0;
    let totalMargin = 0;

    for (const input of inputs) {
      try {
        const result = await this.calculatePricing(userId, input, {
          ...options,
          saveCalculation: false, // Don't save individual calculations
        });

        results.push(result);

        const profit = result.calculation.profitAnalysis.netProfit;
        const margin = result.calculation.profitAnalysis.netMargin;

        totalProfit += profit;
        totalMargin += margin;
        
        if (profit > 0) {
          profitableCount++;
        }

        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10));

      } catch (error) {
        this.logger.warn(`Failed to calculate pricing for ${input.productName}: ${error.message}`);
      }
    }

    // Save bulk calculation
    if (options.saveCalculation !== false) {
      const bulkCalculation = await this.createBulkCalculation(userId, results);
      await this.calculationRepository.save(bulkCalculation);
    }

    const averageMargin = results.length > 0 ? totalMargin / results.length : 0;

    const summary = {
      totalProducts: inputs.length,
      profitableProducts: profitableCount,
      averageMargin,
      totalExpectedProfit: totalProfit,
      recommendations: this.generateBulkRecommendations(results),
    };

    this.logger.log(`Bulk pricing calculation completed: ${profitableCount}/${inputs.length} profitable`);

    return { results, summary };
  }

  /**
   * What-if analizi
   */
  async performWhatIfAnalysis(
    userId: string,
    baseCalculationId: string,
    scenarios: Array<{
      name: string;
      changes: {
        sellingPrice?: number;
        costPrice?: number;
        shippingCost?: number;
        fulfillmentMethod?: FulfillmentMethod;
      };
    }>
  ): Promise<{
    baseCalculation: PricingCalculation;
    scenarios: Array<{
      name: string;
      calculation: PricingCalculation;
      comparison: {
        profitDifference: number;
        marginDifference: number;
        roiDifference: number;
        recommendation: string;
      };
    }>;
  }> {
    const baseCalculation = await this.calculationRepository.findOne({
      where: { id: baseCalculationId, userId },
    });

    if (!baseCalculation) {
      throw new Error('Base calculation not found');
    }

    const results = [];

    for (const scenario of scenarios) {
      const modifiedInput: PricingInput = {
        productName: baseCalculation.productName,
        costPrice: scenario.changes.costPrice || baseCalculation.costPrice,
        sellingPrice: scenario.changes.sellingPrice || baseCalculation.sellingPrice,
        productCategory: baseCalculation.productCategory,
        marketplace: baseCalculation.marketplaceType,
        fulfillmentMethod: scenario.changes.fulfillmentMethod || baseCalculation.fulfillmentMethod,
        currency: baseCalculation.currencyCode,
        shippingCost: scenario.changes.shippingCost || baseCalculation.shippingCost,
        dimensions: baseCalculation.productDimensions,
      };

      const scenarioResult = await this.calculatePricing(userId, modifiedInput, {
        saveCalculation: false,
      });

      const comparison = {
        profitDifference: scenarioResult.calculation.profitAnalysis.netProfit - baseCalculation.profitAnalysis.netProfit,
        marginDifference: scenarioResult.calculation.profitAnalysis.netMargin - baseCalculation.profitAnalysis.netMargin,
        roiDifference: scenarioResult.calculation.profitAnalysis.roi - baseCalculation.profitAnalysis.roi,
        recommendation: this.generateScenarioRecommendation(baseCalculation, scenarioResult.calculation),
      };

      results.push({
        name: scenario.name,
        calculation: scenarioResult.calculation,
        comparison,
      });
    }

    return {
      baseCalculation,
      scenarios: results,
    };
  }

  /**
   * Geçmiş hesaplamaları getir
   */
  async getCalculationHistory(
    userId: string,
    filters?: {
      productName?: string;
      marketplace?: MarketplaceType;
      startDate?: Date;
      endDate?: Date;
      onlyProfitable?: boolean;
      limit?: number;
    }
  ): Promise<{
    calculations: PricingCalculation[];
    analytics: {
      totalCalculations: number;
      profitablePercentage: number;
      averageMargin: number;
      topPerformers: PricingCalculation[];
      trends: {
        marginTrend: 'improving' | 'declining' | 'stable';
        volumeTrend: 'increasing' | 'decreasing' | 'stable';
      };
    };
  }> {
    let query = this.calculationRepository.createQueryBuilder('calc')
      .where('calc.userId = :userId', { userId })
      .orderBy('calc.createdAt', 'DESC');

    if (filters?.productName) {
      query = query.andWhere('calc.productName ILIKE :productName', {
        productName: `%${filters.productName}%`,
      });
    }

    if (filters?.marketplace) {
      query = query.andWhere('calc.marketplaceType = :marketplace', {
        marketplace: filters.marketplace,
      });
    }

    if (filters?.startDate && filters?.endDate) {
      query = query.andWhere('calc.createdAt BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters?.onlyProfitable) {
      query = query.andWhere("(calc.profitAnalysis->>'netProfit')::numeric > 0");
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const calculations = await query.getMany();

    // Calculate analytics
    const totalCalculations = calculations.length;
    const profitableCount = calculations.filter(c => c.profitAnalysis.netProfit > 0).length;
    const profitablePercentage = totalCalculations > 0 ? (profitableCount / totalCalculations) * 100 : 0;
    
    const totalMargin = calculations.reduce((sum, c) => sum + c.profitAnalysis.netMargin, 0);
    const averageMargin = totalCalculations > 0 ? totalMargin / totalCalculations : 0;

    const topPerformers = calculations
      .filter(c => c.profitAnalysis.netProfit > 0)
      .sort((a, b) => b.profitAnalysis.netMargin - a.profitAnalysis.netMargin)
      .slice(0, 5);

    // Calculate trends (simplified)
    const trends = this.calculateTrends(calculations);

    return {
      calculations,
      analytics: {
        totalCalculations,
        profitablePercentage,
        averageMargin,
        topPerformers,
        trends,
      },
    };
  }

  // Private helper methods
  private processAdditionalCosts(costs?: PricingInput['additionalCosts']): any {
    if (!costs) {
      return {
        advertisingCost: 0,
        packagingCost: 0,
        handlingFee: 0,
        otherFees: [],
        totalAdditionalCosts: 0,
      };
    }

    const otherFeesTotal = (costs.otherFees || []).reduce((sum, fee) => sum + fee.amount, 0);
    const totalAdditionalCosts = 
      (costs.advertisingCost || 0) +
      (costs.packagingCost || 0) +
      (costs.handlingFee || 0) +
      otherFeesTotal;

    return {
      advertisingCost: costs.advertisingCost || 0,
      packagingCost: costs.packagingCost || 0,
      handlingFee: costs.handlingFee || 0,
      otherFees: costs.otherFees || [],
      totalAdditionalCosts,
    };
  }

  private calculateProfitMetrics(params: {
    costPrice: number;
    sellingPrice: number;
    shippingCost: number;
    amazonFees: any;
    taxCalculations: any;
    additionalCosts: any;
  }): any {
    const totalRevenue = params.sellingPrice;
    const totalCosts = 
      params.costPrice +
      params.shippingCost +
      params.amazonFees.totalFees +
      (params.taxCalculations?.totalTaxes || 0) +
      params.additionalCosts.totalAdditionalCosts;

    const grossProfit = totalRevenue - params.costPrice;
    const netProfit = totalRevenue - totalCosts;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const roi = params.costPrice > 0 ? (netProfit / params.costPrice) * 100 : 0;
    const breakEvenPrice = totalCosts;
    const profitPerUnit = netProfit;

    return {
      grossProfit,
      netProfit,
      grossMargin,
      netMargin,
      roi,
      breakEvenPrice,
      profitPerUnit,
      totalRevenue,
      totalCosts,
    };
  }

  private async createPricingCalculation(userId: string, data: any): Promise<PricingCalculation> {
    const calculation = this.calculationRepository.create({
      userId,
      productId: data.input.productId,
      asin: data.input.asin,
      productName: data.input.productName,
      calculationType: CalculationType.PRODUCT_ANALYSIS,
      marketplaceType: data.input.marketplace,
      fulfillmentMethod: data.input.fulfillmentMethod,
      costPrice: data.input.costPrice,
      sellingPrice: data.input.sellingPrice,
      shippingCost: data.input.shippingCost || 0,
      productWeight: data.input.dimensions?.weight,
      productDimensions: data.input.dimensions,
      productCategory: data.input.productCategory,
      currencyCode: data.targetCurrency,
      exchangeRate: data.exchangeRate,
      amazonFees: data.amazonFees,
      taxCalculations: data.taxCalculations,
      additionalCosts: data.additionalCosts,
      profitAnalysis: data.profitAnalysis,
      calculationDurationMs: data.calculationDuration,
      dataSources: {
        priceData: 'manual',
        feeData: 'amazon_calculator',
        currencyData: 'live_rate',
        lastUpdated: new Date(),
      },
    });

    return calculation;
  }

  private async createBulkCalculation(userId: string, results: CalculationResult[]): Promise<PricingCalculation> {
    const totalRevenue = results.reduce((sum, r) => sum + r.calculation.profitAnalysis.totalRevenue, 0);
    const totalCosts = results.reduce((sum, r) => sum + r.calculation.profitAnalysis.totalCosts, 0);
    const totalProfit = totalRevenue - totalCosts;
    const averageMargin = results.length > 0 
      ? results.reduce((sum, r) => sum + r.calculation.profitAnalysis.netMargin, 0) / results.length 
      : 0;

    const bulkCalculation = this.calculationRepository.create({
      userId,
      productName: `Bulk Analysis (${results.length} products)`,
      calculationType: CalculationType.BULK_ANALYSIS,
      marketplaceType: MarketplaceType.AMAZON_US, // Default
      fulfillmentMethod: FulfillmentMethod.FBA, // Default
      costPrice: totalCosts,
      sellingPrice: totalRevenue,
      profitAnalysis: {
        grossProfit: totalProfit,
        netProfit: totalProfit,
        grossMargin: averageMargin,
        netMargin: averageMargin,
        roi: totalCosts > 0 ? (totalProfit / totalCosts) * 100 : 0,
        breakEvenPrice: totalCosts,
        profitPerUnit: totalProfit / results.length,
        totalRevenue,
        totalCosts,
      },
      amazonFees: { totalFees: 0 },
      currencyCode: 'USD',
      exchangeRate: 1,
    });

    return bulkCalculation;
  }

  private generateRecommendations(calculation: PricingCalculation): CalculationResult['recommendations'] {
    const recommendations = [];
    const { netMargin, roi, netProfit } = calculation.profitAnalysis;

    if (netProfit < 0) {
      recommendations.push({
        type: 'risk_warning' as const,
        priority: 'high' as const,
        message: 'Bu ürün zarar ediyor',
        action: 'Fiyat artırın veya maliyet düşürün',
        impact: 'Zararı önlemek için kritik',
      });
    } else if (netMargin < 5) {
      recommendations.push({
        type: 'price_optimization' as const,
        priority: 'high' as const,
        message: 'Çok düşük kar marjı',
        action: 'Satış fiyatını %10-15 artırmayı değerlendirin',
        impact: 'Karlılığı önemli ölçüde artırabilir',
      });
    }

    if (roi < 10) {
      recommendations.push({
        type: 'market_opportunity' as const,
        priority: 'medium' as const,
        message: 'Düşük yatırım getirisi',
        action: 'Daha karlı ürünler araştırın',
        impact: 'Sermaye verimliliğini artırır',
      });
    }

    if (calculation.amazonFees.totalFees / calculation.sellingPrice > 0.25) {
      recommendations.push({
        type: 'cost_reduction' as const,
        priority: 'medium' as const,
        message: 'Amazon ücretleri çok yüksek',
        action: 'FBM ile fulfillment yapmayı değerlendirin',
        impact: 'Ücret maliyetlerini azaltabilir',
      });
    }

    return recommendations;
  }

  private generateScenarioRecommendation(base: PricingCalculation, scenario: PricingCalculation): string {
    const profitDiff = scenario.profitAnalysis.netProfit - base.profitAnalysis.netProfit;
    const marginDiff = scenario.profitAnalysis.netMargin - base.profitAnalysis.netMargin;

    if (profitDiff > 0 && marginDiff > 2) {
      return 'Bu senaryo karlılığı önemli ölçüde artırıyor - uygulanması önerilir';
    } else if (profitDiff > 0) {
      return 'Bu senaryo karlılığı artırıyor - değerlendirilebilir';
    } else if (profitDiff < 0) {
      return 'Bu senaryo karlılığı azaltıyor - önerilmez';
    } else {
      return 'Bu senaryo karlılığı önemli ölçüde etkilemiyor';
    }
  }

  private generateBulkRecommendations(results: CalculationResult[]): string[] {
    const recommendations = [];
    const profitableCount = results.filter(r => r.calculation.profitAnalysis.netProfit > 0).length;
    const profitablePercentage = (profitableCount / results.length) * 100;

    if (profitablePercentage < 50) {
      recommendations.push('Ürün portföyünün yarıdan fazlası karlı değil - ürün seçim kriterlerini gözden geçirin');
    } else if (profitablePercentage > 80) {
      recommendations.push('Mükemmel ürün portföyü - mevcut stratejinizi sürdürün');
    }

    const highMarginProducts = results.filter(r => r.calculation.profitAnalysis.netMargin > 15).length;
    if (highMarginProducts < results.length * 0.3) {
      recommendations.push('Yüksek marjlı ürünlerin oranını artırmaya odaklanın');
    }

    return recommendations;
  }

  private calculateTrends(calculations: PricingCalculation[]): any {
    if (calculations.length < 10) {
      return {
        marginTrend: 'stable' as const,
        volumeTrend: 'stable' as const,
      };
    }

    // Simplified trend calculation
    const recent = calculations.slice(0, 5);
    const older = calculations.slice(-5);

    const recentAvgMargin = recent.reduce((sum, c) => sum + c.profitAnalysis.netMargin, 0) / recent.length;
    const olderAvgMargin = older.reduce((sum, c) => sum + c.profitAnalysis.netMargin, 0) / older.length;

    const marginTrend = recentAvgMargin > olderAvgMargin + 2 ? 'improving' :
                       recentAvgMargin < olderAvgMargin - 2 ? 'declining' : 'stable';

    return {
      marginTrend,
      volumeTrend: 'stable' as const, // Would need sales data for this
    };
  }

  private async performCompetitiveAnalysis(asin: string, ourPrice: number): Promise<any> {
    // Mock competitive analysis - in production, this would scrape or use API
    const competitorPrices = [
      ourPrice * 0.95,
      ourPrice * 1.05,
      ourPrice * 0.9,
      ourPrice * 1.1,
      ourPrice * 0.98,
    ];

    const lowestPrice = Math.min(...competitorPrices);
    const averagePrice = competitorPrices.reduce((sum, p) => sum + p, 0) / competitorPrices.length;
    const medianPrice = competitorPrices.sort()[Math.floor(competitorPrices.length / 2)];

    let position: 'lowest' | 'below_average' | 'average' | 'above_average' | 'highest';
    if (ourPrice <= lowestPrice) position = 'lowest';
    else if (ourPrice < averagePrice * 0.95) position = 'below_average';
    else if (ourPrice > averagePrice * 1.05) position = 'above_average';
    else if (ourPrice >= Math.max(...competitorPrices)) position = 'highest';
    else position = 'average';

    return {
      lowestCompetitorPrice: lowestPrice,
      averageMarketPrice: averagePrice,
      medianMarketPrice: medianPrice,
      pricePosition: position,
      competitorCount: competitorPrices.length,
      priceGap: ourPrice - lowestPrice,
    };
  }

  private async performScenarioAnalysis(userId: string, input: PricingInput): Promise<any> {
    const optimisticPrice = input.sellingPrice * 1.15;
    const pessimisticPrice = input.sellingPrice * 0.9;

    // Quick calculations for scenarios
    const optimisticProfit = optimisticPrice - input.costPrice - (optimisticPrice * 0.15);
    const pessimisticProfit = pessimisticPrice - input.costPrice - (pessimisticPrice * 0.15);
    const realisticProfit = input.sellingPrice - input.costPrice - (input.sellingPrice * 0.15);

    let recommendedAction: 'proceed' | 'adjust_price' | 'find_better_supplier' | 'avoid';
    
    if (realisticProfit > input.costPrice * 0.2) recommendedAction = 'proceed';
    else if (realisticProfit > 0) recommendedAction = 'adjust_price';
    else if (optimisticProfit > 0) recommendedAction = 'find_better_supplier';
    else recommendedAction = 'avoid';

    return {
      optimisticScenario: {
        sellingPrice: optimisticPrice,
        expectedProfit: optimisticProfit,
        probability: 0.2,
      },
      realisticScenario: {
        sellingPrice: input.sellingPrice,
        expectedProfit: realisticProfit,
        probability: 0.6,
      },
      pessimisticScenario: {
        sellingPrice: pessimisticPrice,
        expectedProfit: pessimisticProfit,
        probability: 0.2,
      },
      recommendedAction,
    };
  }

  private async getBenchmarks(category: string, marketplace: MarketplaceType): Promise<CalculationResult['benchmarks']> {
    // Mock benchmarks - in production, this would come from real market data
    const baseBenchmarks = {
      'Electronics': { industry: 12, top: 25, median: 15 },
      'Home & Kitchen': { industry: 18, top: 35, median: 22 },
      'Fashion': { industry: 22, top: 45, median: 28 },
      'Health & Beauty': { industry: 25, top: 50, median: 30 },
      'Sports': { industry: 15, top: 30, median: 20 },
    };

    const benchmark = baseBenchmarks[category] || { industry: 15, top: 30, median: 20 };

    return {
      industryAverage: benchmark.industry,
      topPerformer: benchmark.top,
      marketMedian: benchmark.median,
    };
  }
}