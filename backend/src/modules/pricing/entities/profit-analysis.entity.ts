import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';

import { PricingCalculation } from './pricing-calculation.entity';

export enum AnalysisType {
  SINGLE_PRODUCT = 'single_product',
  PRODUCT_COMPARISON = 'product_comparison',
  PORTFOLIO_ANALYSIS = 'portfolio_analysis',
  TREND_ANALYSIS = 'trend_analysis',
  PERFORMANCE_ANALYSIS = 'performance_analysis',
  FORECAST_ANALYSIS = 'forecast_analysis',
}

export enum ProfitabilityGrade {
  EXCELLENT = 'excellent', // > 25% net margin
  GOOD = 'good',          // 15-25% net margin
  FAIR = 'fair',          // 5-15% net margin
  POOR = 'poor',          // 0-5% net margin
  LOSS = 'loss',          // < 0% net margin
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('profit_analyses')
@Index(['userId', 'analysisType'])
@Index(['pricingCalculationId'])
@Index(['profitabilityGrade'])
@Index(['createdAt'])
export class ProfitAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'pricing_calculation_id', nullable: true })
  pricingCalculationId?: string;

  @ManyToOne(() => PricingCalculation, { nullable: true })
  @JoinColumn({ name: 'pricing_calculation_id' })
  pricingCalculation?: PricingCalculation;

  @Column({
    type: 'enum',
    enum: AnalysisType,
    name: 'analysis_type',
  })
  analysisType: AnalysisType;

  @Column({ name: 'analysis_name' })
  analysisName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Time period for analysis
  @Column({ name: 'period_start', type: 'date', nullable: true })
  periodStart?: Date;

  @Column({ name: 'period_end', type: 'date', nullable: true })
  periodEnd?: Date;

  @Column({ name: 'period_type', nullable: true })
  periodType?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

  // Core profitability metrics
  @Column({ type: 'json' })
  profitabilityMetrics: {
    totalRevenue: number;
    totalCosts: number;
    grossProfit: number;
    netProfit: number;
    grossMargin: number; // percentage
    netMargin: number; // percentage
    operatingMargin?: number; // percentage
    ebitdaMargin?: number; // percentage
    roi: number; // percentage
    roiAnnualized?: number; // percentage
    roas?: number; // Return on Ad Spend
    acos?: number; // Advertising Cost of Sales
    breakEvenPoint: number;
    profitPerUnit: number;
    averageOrderValue?: number;
    conversionRate?: number;
  };

  // Cost breakdown analysis
  @Column({ type: 'json' })
  costBreakdown: {
    productCosts: {
      totalCostOfGoods: number;
      averageCostPerUnit: number;
      costPercentageOfRevenue: number;
    };
    amazonFees: {
      totalFees: number;
      referralFees: number;
      fulfillmentFees: number;
      storageFees: number;
      otherFees: number;
      feePercentageOfRevenue: number;
    };
    operatingCosts: {
      advertisingCosts: number;
      shippingCosts: number;
      packagingCosts: number;
      handlingCosts: number;
      insuranceCosts: number;
      otherOperatingCosts: number;
      totalOperatingCosts: number;
      operatingCostPercentage: number;
    };
    taxes: {
      salesTax: number;
      incomeTax: number;
      vatTax: number;
      customsDuty: number;
      totalTaxes: number;
      taxPercentageOfRevenue: number;
    };
  };

  // Performance indicators
  @Column({ type: 'json' })
  performanceIndicators: {
    salesVolume: number;
    averageDailySales: number;
    salesGrowthRate?: number; // percentage
    inventoryTurnover?: number;
    daysSalesInInventory?: number;
    stockoutRate?: number; // percentage
    returnRate?: number; // percentage
    customerSatisfactionScore?: number;
    competitiveRanking?: number;
  };

  // Risk assessment
  @Column({ type: 'json' })
  riskAssessment: {
    overallRiskLevel: RiskLevel;
    riskFactors: Array<{
      factor: string;
      level: RiskLevel;
      impact: 'high' | 'medium' | 'low';
      probability: 'high' | 'medium' | 'low';
      description: string;
      mitigation?: string;
    }>;
    marketRisks: {
      competitionLevel: 'low' | 'medium' | 'high';
      priceVolatility: number; // percentage
      demandStability: 'stable' | 'seasonal' | 'declining' | 'growing';
      supplierReliability: 'excellent' | 'good' | 'fair' | 'poor';
    };
    financialRisks: {
      cashFlowRisk: RiskLevel;
      exchangeRateRisk: RiskLevel;
      creditRisk: RiskLevel;
      liquidityRisk: RiskLevel;
    };
  };

  // Comparative analysis
  @Column({ type: 'json', nullable: true })
  comparativeAnalysis?: {
    benchmarkData: {
      industryAverageMargin: number;
      topPerformerMargin: number;
      marketAveragePrice: number;
      competitorCount: number;
    };
    performanceVsBenchmark: {
      marginComparison: 'above' | 'below' | 'equal';
      marginDifference: number; // percentage points
      priceComparison: 'above' | 'below' | 'equal';
      priceDifference: number; // percentage
      competitivePosition: 'leader' | 'challenger' | 'follower' | 'nicher';
    };
    improvementPotential: {
      marginImprovement: number; // percentage points
      priceOptimization: number; // percentage
      costReduction: number; // percentage
      volumeIncrease: number; // percentage
    };
  };

  // Trend analysis
  @Column({ type: 'json', nullable: true })
  trendAnalysis?: {
    profitTrend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    volumeTrend: 'increasing' | 'decreasing' | 'stable' | 'seasonal';
    costTrend: 'increasing' | 'decreasing' | 'stable';
    marginTrend: 'improving' | 'declining' | 'stable';
    trendStrength: 'strong' | 'moderate' | 'weak';
    seasonalityIndex?: number; // 0-100, higher = more seasonal
    cyclicalPatterns?: Array<{
      pattern: string;
      frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
      strength: number; // 0-100
    }>;
  };

  // Forecasting
  @Column({ type: 'json', nullable: true })
  forecast?: {
    forecastPeriod: '1_month' | '3_months' | '6_months' | '1_year';
    confidence: number; // 0-100
    projectedRevenue: {
      conservative: number;
      realistic: number;
      optimistic: number;
    };
    projectedProfit: {
      conservative: number;
      realistic: number;
      optimistic: number;
    };
    projectedMargin: {
      conservative: number;
      realistic: number;
      optimistic: number;
    };
    keyAssumptions: string[];
    riskAdjustments: Array<{
      risk: string;
      adjustment: number; // percentage
      rationale: string;
    }>;
  };

  // Recommendations
  @Column({ type: 'json' })
  recommendations: {
    immediate: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      expectedImpact: string;
      timeToImplement: string;
      resourcesRequired: string;
    }>;
    shortTerm: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      expectedImpact: string;
      timeline: string;
    }>;
    longTerm: Array<{
      action: string;
      priority: 'high' | 'medium' | 'low';
      expectedImpact: string;
      timeline: string;
    }>;
    overallStrategy: string;
  };

  // Grading and scoring
  @Column({
    type: 'enum',
    enum: ProfitabilityGrade,
    name: 'profitability_grade',
  })
  profitabilityGrade: ProfitabilityGrade;

  @Column({ name: 'overall_score', type: 'decimal', precision: 5, scale: 2 })
  overallScore: number; // 0-100

  @Column({ type: 'json' })
  scoreBreakdown: {
    profitabilityScore: number; // 0-100
    stabilityScore: number; // 0-100
    growthScore: number; // 0-100
    competitiveScore: number; // 0-100
    riskScore: number; // 0-100 (lower is better)
    sustainabilityScore: number; // 0-100
  };

  // Analysis metadata
  @Column({ name: 'data_sources', type: 'json' })
  dataSources: {
    salesData: 'amazon_api' | 'manual_entry' | 'estimate';
    costData: 'supplier_api' | 'manual_entry' | 'estimate';
    feeData: 'amazon_calculator' | 'api' | 'estimate';
    marketData?: 'scraping' | 'api' | 'manual';
    lastUpdated: Date;
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  };

  @Column({ name: 'calculation_version', default: '1.0' })
  calculationVersion: string;

  @Column({ name: 'analysis_duration_ms', type: 'int', nullable: true })
  analysisDurationMs?: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ name: 'is_archived', default: false })
  isArchived: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isProfitable(): boolean {
    return this.profitabilityMetrics.netProfit > 0;
  }

  isHighPerforming(): boolean {
    return this.overallScore >= 80 && this.profitabilityGrade === ProfitabilityGrade.EXCELLENT;
  }

  needsAttention(): boolean {
    return this.profitabilityGrade === ProfitabilityGrade.POOR || 
           this.profitabilityGrade === ProfitabilityGrade.LOSS ||
           this.riskAssessment.overallRiskLevel === RiskLevel.HIGH ||
           this.riskAssessment.overallRiskLevel === RiskLevel.CRITICAL;
  }

  getHealthStatus(): 'excellent' | 'good' | 'warning' | 'critical' {
    if (this.profitabilityGrade === ProfitabilityGrade.LOSS) return 'critical';
    if (this.profitabilityGrade === ProfitabilityGrade.POOR) return 'warning';
    if (this.riskAssessment.overallRiskLevel === RiskLevel.CRITICAL) return 'critical';
    if (this.riskAssessment.overallRiskLevel === RiskLevel.HIGH) return 'warning';
    if (this.profitabilityGrade === ProfitabilityGrade.EXCELLENT && this.overallScore >= 80) return 'excellent';
    return 'good';
  }

  calculateROICategory(): 'excellent' | 'good' | 'fair' | 'poor' {
    const roi = this.profitabilityMetrics.roi;
    
    if (roi >= 50) return 'excellent';
    if (roi >= 25) return 'good';
    if (roi >= 10) return 'fair';
    return 'poor';
  }

  getTopRecommendations(count: number = 3): Array<{
    action: string;
    priority: 'high' | 'medium' | 'low';
    expectedImpact: string;
    category: 'immediate' | 'short_term' | 'long_term';
  }> {
    const allRecommendations = [
      ...this.recommendations.immediate.map(r => ({ ...r, category: 'immediate' as const })),
      ...this.recommendations.shortTerm.map(r => ({ ...r, category: 'short_term' as const })),
      ...this.recommendations.longTerm.map(r => ({ ...r, category: 'long_term' as const })),
    ];

    // Sort by priority: high > medium > low
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    allRecommendations.sort((a, b) => priorityOrder[b.priority] - priorityOrder[a.priority]);

    return allRecommendations.slice(0, count);
  }

  calculateMarginImprovement(targetMargin: number): {
    currentMargin: number;
    targetMargin: number;
    improvementNeeded: number; // percentage points
    approaches: Array<{
      method: 'increase_price' | 'reduce_costs' | 'improve_volume';
      changeRequired: number; // percentage
      feasibility: 'high' | 'medium' | 'low';
      impact: string;
    }>;
  } {
    const currentMargin = this.profitabilityMetrics.netMargin;
    const improvementNeeded = targetMargin - currentMargin;
    
    const currentRevenue = this.profitabilityMetrics.totalRevenue;
    const currentCosts = this.profitabilityMetrics.totalCosts;
    
    // Calculate required changes
    const priceIncreaseNeeded = (improvementNeeded * currentRevenue) / (100 * currentRevenue) * 100;
    const costReductionNeeded = (improvementNeeded * currentRevenue) / (100 * currentCosts) * 100;
    
    return {
      currentMargin,
      targetMargin,
      improvementNeeded,
      approaches: [
        {
          method: 'increase_price',
          changeRequired: Math.round(priceIncreaseNeeded * 100) / 100,
          feasibility: priceIncreaseNeeded <= 5 ? 'high' : priceIncreaseNeeded <= 15 ? 'medium' : 'low',
          impact: `Increase selling price by ${priceIncreaseNeeded.toFixed(1)}%`,
        },
        {
          method: 'reduce_costs',
          changeRequired: Math.round(costReductionNeeded * 100) / 100,
          feasibility: costReductionNeeded <= 10 ? 'high' : costReductionNeeded <= 25 ? 'medium' : 'low',
          impact: `Reduce total costs by ${costReductionNeeded.toFixed(1)}%`,
        },
        {
          method: 'improve_volume',
          changeRequired: Math.round((improvementNeeded / (currentMargin - improvementNeeded)) * 100 * 100) / 100,
          feasibility: 'medium',
          impact: 'Increase sales volume while maintaining cost efficiency',
        },
      ],
    };
  }

  generateExecutiveSummary(): {
    headline: string;
    keyMetrics: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'stable' }>;
    mainInsights: string[];
    urgentActions: string[];
    outlook: 'positive' | 'neutral' | 'negative';
  } {
    const netMargin = this.profitabilityMetrics.netMargin;
    const roi = this.profitabilityMetrics.roi;
    const grade = this.profitabilityGrade;

    const headline = this.generateHeadline();
    
    const keyMetrics = [
      {
        label: 'Net Profit Margin',
        value: `${netMargin.toFixed(1)}%`,
        trend: this.trendAnalysis?.marginTrend === 'improving' ? 'up' as const : 
               this.trendAnalysis?.marginTrend === 'declining' ? 'down' as const : 'stable' as const,
      },
      {
        label: 'Return on Investment',
        value: `${roi.toFixed(1)}%`,
      },
      {
        label: 'Overall Score',
        value: `${this.overallScore.toFixed(0)}/100`,
      },
      {
        label: 'Profitability Grade',
        value: grade.charAt(0).toUpperCase() + grade.slice(1),
      },
    ];

    const mainInsights = this.generateMainInsights();
    const urgentActions = this.recommendations.immediate
      .filter(r => r.priority === 'high')
      .map(r => r.action)
      .slice(0, 3);

    const outlook = this.determineOutlook();

    return {
      headline,
      keyMetrics,
      mainInsights,
      urgentActions,
      outlook,
    };
  }

  private generateHeadline(): string {
    const grade = this.profitabilityGrade;
    const netMargin = this.profitabilityMetrics.netMargin;
    const riskLevel = this.riskAssessment.overallRiskLevel;

    if (grade === ProfitabilityGrade.LOSS) {
      return `Critical: Product showing losses with ${Math.abs(netMargin).toFixed(1)}% negative margin`;
    }
    
    if (grade === ProfitabilityGrade.EXCELLENT && riskLevel === RiskLevel.LOW) {
      return `Excellent performance with ${netMargin.toFixed(1)}% margin and low risk profile`;
    }
    
    if (grade === ProfitabilityGrade.GOOD) {
      return `Solid profitability at ${netMargin.toFixed(1)}% margin with room for optimization`;
    }
    
    if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
      return `Profitability concerns: ${netMargin.toFixed(1)}% margin with high risk factors`;
    }

    return `Moderate performance with ${netMargin.toFixed(1)}% margin requiring attention`;
  }

  private generateMainInsights(): string[] {
    const insights: string[] = [];
    
    // Profitability insights
    if (this.profitabilityMetrics.netMargin > 20) {
      insights.push('Exceptional profit margins indicate strong pricing power');
    } else if (this.profitabilityMetrics.netMargin < 5) {
      insights.push('Low profit margins suggest need for cost optimization or price increase');
    }

    // Cost structure insights
    const amazonFeePercentage = this.costBreakdown.amazonFees.feePercentageOfRevenue;
    if (amazonFeePercentage > 25) {
      insights.push('High Amazon fees are impacting profitability significantly');
    }

    // Risk insights
    const highRiskFactors = this.riskAssessment.riskFactors.filter(f => f.level === RiskLevel.HIGH);
    if (highRiskFactors.length > 0) {
      insights.push(`${highRiskFactors.length} high-risk factors identified requiring immediate attention`);
    }

    // Trend insights
    if (this.trendAnalysis?.profitTrend === 'decreasing') {
      insights.push('Declining profit trend indicates need for strategic intervention');
    } else if (this.trendAnalysis?.profitTrend === 'increasing') {
      insights.push('Positive profit trend shows effective business management');
    }

    return insights.slice(0, 4); // Return top 4 insights
  }

  private determineOutlook(): 'positive' | 'neutral' | 'negative' {
    let score = 0;

    // Profitability factor
    if (this.profitabilityGrade === ProfitabilityGrade.EXCELLENT) score += 2;
    else if (this.profitabilityGrade === ProfitabilityGrade.GOOD) score += 1;
    else if (this.profitabilityGrade === ProfitabilityGrade.POOR) score -= 1;
    else if (this.profitabilityGrade === ProfitabilityGrade.LOSS) score -= 2;

    // Trend factor
    if (this.trendAnalysis?.profitTrend === 'increasing') score += 1;
    else if (this.trendAnalysis?.profitTrend === 'decreasing') score -= 1;

    // Risk factor
    if (this.riskAssessment.overallRiskLevel === RiskLevel.LOW) score += 1;
    else if (this.riskAssessment.overallRiskLevel === RiskLevel.HIGH) score -= 1;
    else if (this.riskAssessment.overallRiskLevel === RiskLevel.CRITICAL) score -= 2;

    if (score >= 2) return 'positive';
    if (score <= -2) return 'negative';
    return 'neutral';
  }

  // Static factory methods
  static createBasicAnalysis(data: {
    userId: string;
    analysisName: string;
    profitabilityMetrics: any;
    costBreakdown: any;
    analysisType?: AnalysisType;
  }): Partial<ProfitAnalysis> {
    const netMargin = data.profitabilityMetrics.netMargin;
    
    let grade: ProfitabilityGrade;
    if (netMargin < 0) grade = ProfitabilityGrade.LOSS;
    else if (netMargin < 5) grade = ProfitabilityGrade.POOR;
    else if (netMargin < 15) grade = ProfitabilityGrade.FAIR;
    else if (netMargin < 25) grade = ProfitabilityGrade.GOOD;
    else grade = ProfitabilityGrade.EXCELLENT;

    return {
      userId: data.userId,
      analysisName: data.analysisName,
      analysisType: data.analysisType || AnalysisType.SINGLE_PRODUCT,
      profitabilityMetrics: data.profitabilityMetrics,
      costBreakdown: data.costBreakdown,
      profitabilityGrade: grade,
      overallScore: Math.max(0, Math.min(100, netMargin * 3 + 40)), // Simple scoring
      performanceIndicators: {
        salesVolume: 0,
        averageDailySales: 0,
      },
      riskAssessment: {
        overallRiskLevel: RiskLevel.MEDIUM,
        riskFactors: [],
        marketRisks: {
          competitionLevel: 'medium',
          priceVolatility: 0,
          demandStability: 'stable',
          supplierReliability: 'good',
        },
        financialRisks: {
          cashFlowRisk: RiskLevel.MEDIUM,
          exchangeRateRisk: RiskLevel.MEDIUM,
          creditRisk: RiskLevel.LOW,
          liquidityRisk: RiskLevel.LOW,
        },
      },
      recommendations: {
        immediate: [],
        shortTerm: [],
        longTerm: [],
        overallStrategy: 'Monitor performance and optimize based on data',
      },
      scoreBreakdown: {
        profitabilityScore: Math.max(0, netMargin * 4),
        stabilityScore: 75,
        growthScore: 50,
        competitiveScore: 50,
        riskScore: 25,
        sustainabilityScore: 60,
      },
      dataSources: {
        salesData: 'manual_entry',
        costData: 'manual_entry',
        feeData: 'amazon_calculator',
        lastUpdated: new Date(),
        dataQuality: 'good',
      },
      isArchived: false,
    };
  }
}