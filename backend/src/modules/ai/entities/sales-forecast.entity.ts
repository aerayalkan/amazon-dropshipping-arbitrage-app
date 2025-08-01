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

import { PredictionModel } from './prediction-model.entity';

export enum ForecastType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  CUSTOM = 'custom',
}

export enum ForecastMethod {
  LSTM = 'lstm',
  PROPHET = 'prophet',
  ARIMA = 'arima',
  EXPONENTIAL_SMOOTHING = 'exponential_smoothing',
  LINEAR_REGRESSION = 'linear_regression',
  ENSEMBLE = 'ensemble',
  HYBRID = 'hybrid',
}

export enum ForecastAccuracy {
  EXCELLENT = 'excellent', // >95%
  GOOD = 'good', // 85-95%
  FAIR = 'fair', // 70-85%
  POOR = 'poor', // 50-70%
  UNRELIABLE = 'unreliable', // <50%
}

export enum SeasonalityType {
  NONE = 'none',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
  HOLIDAY = 'holiday',
  CUSTOM = 'custom',
}

@Entity('sales_forecasts')
@Index(['userId', 'asin'])
@Index(['forecastType', 'forecastDate'])
@Index(['accuracy', 'forecastMethod'])
@Index(['forecastPeriodStart', 'forecastPeriodEnd'])
export class SalesForecast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'model_id', nullable: true })
  modelId?: string;

  @ManyToOne(() => PredictionModel, { nullable: true })
  @JoinColumn({ name: 'model_id' })
  model?: PredictionModel;

  @Column({ name: 'asin', length: 10, nullable: true })
  asin?: string;

  @Column({ name: 'product_name', nullable: true })
  productName?: string;

  @Column({ name: 'category', nullable: true })
  category?: string;

  @Column({ name: 'sku', nullable: true })
  sku?: string;

  @Column({
    type: 'enum',
    enum: ForecastType,
    name: 'forecast_type',
  })
  forecastType: ForecastType;

  @Column({
    type: 'enum',
    enum: ForecastMethod,
    name: 'forecast_method',
  })
  forecastMethod: ForecastMethod;

  @Column({ name: 'forecast_date', type: 'timestamp' })
  forecastDate: Date;

  @Column({ name: 'forecast_period_start', type: 'timestamp' })
  forecastPeriodStart: Date;

  @Column({ name: 'forecast_period_end', type: 'timestamp' })
  forecastPeriodEnd: Date;

  @Column({ name: 'training_period_start', type: 'timestamp' })
  trainingPeriodStart: Date;

  @Column({ name: 'training_period_end', type: 'timestamp' })
  trainingPeriodEnd: Date;

  // Historical Data Summary
  @Column({ type: 'json' })
  historicalData: {
    totalSales: number;
    averageDailySales: number;
    salesTrend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
    dataPoints: number;
    dataQuality: number; // 0-100
    missingDataPercentage: number;
    outliers: number;
  };

  // Forecast Results
  @Column({ type: 'json' })
  forecastResults: Array<{
    date: Date;
    predicted: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
    seasonalComponent?: number;
    trendComponent?: number;
    errorMargin?: number;
  }>;

  // Aggregate Forecasts
  @Column({ name: 'total_forecast_sales', type: 'decimal', precision: 12, scale: 2 })
  totalForecastSales: number;

  @Column({ name: 'average_daily_forecast', type: 'decimal', precision: 10, scale: 2 })
  averageDailyForecast: number;

  @Column({ name: 'peak_sales_date', type: 'timestamp', nullable: true })
  peakSalesDate?: Date;

  @Column({ name: 'peak_sales_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  peakSalesAmount?: number;

  @Column({ name: 'minimum_sales_date', type: 'timestamp', nullable: true })
  minimumSalesDate?: Date;

  @Column({ name: 'minimum_sales_amount', type: 'decimal', precision: 10, scale: 2, nullable: true })
  minimumSalesAmount?: number;

  // Seasonality Analysis
  @Column({ type: 'json', nullable: true })
  seasonalityAnalysis?: {
    hasSeasonality: boolean;
    seasonalityType: SeasonalityType;
    seasonalStrength: number; // 0-1
    seasonalPeriod: number; // days
    seasonalPeaks: Array<{
      period: string;
      multiplier: number;
      confidence: number;
    }>;
    holidayEffects?: Array<{
      holiday: string;
      effect: number;
      significance: number;
      dates: Date[];
    }>;
  };

  // Accuracy Metrics
  @Column({ name: 'accuracy_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  accuracyPercentage?: number;

  @Column({
    type: 'enum',
    enum: ForecastAccuracy,
    name: 'accuracy_rating',
    nullable: true,
  })
  accuracyRating?: ForecastAccuracy;

  @Column({ name: 'mae', type: 'decimal', precision: 12, scale: 6, nullable: true })
  mae?: number; // Mean Absolute Error

  @Column({ name: 'mape', type: 'decimal', precision: 8, scale: 4, nullable: true })
  mape?: number; // Mean Absolute Percentage Error

  @Column({ name: 'rmse', type: 'decimal', precision: 12, scale: 6, nullable: true })
  rmse?: number; // Root Mean Square Error

  @Column({ name: 'r_squared', type: 'decimal', precision: 8, scale: 4, nullable: true })
  rSquared?: number;

  // External Factors
  @Column({ type: 'json', nullable: true })
  externalFactors?: {
    economicIndicators?: {
      gdpGrowth: number;
      inflationRate: number;
      unemploymentRate: number;
      consumerConfidence: number;
    };
    marketFactors?: {
      competitorActions: string[];
      priceChanges: Array<{
        date: Date;
        change: number;
        reason: string;
      }>;
      promotions: Array<{
        startDate: Date;
        endDate: Date;
        type: string;
        impact: number;
      }>;
    };
    seasonalFactors?: {
      holidays: string[];
      events: string[];
      weatherPatterns?: any;
    };
    customFactors?: Array<{
      name: string;
      value: number;
      weight: number;
      description: string;
    }>;
  };

  // Scenario Analysis
  @Column({ type: 'json', nullable: true })
  scenarios?: {
    optimistic: {
      totalSales: number;
      probability: number;
      assumptions: string[];
      keyDrivers: string[];
    };
    pessimistic: {
      totalSales: number;
      probability: number;
      risks: string[];
      mitigations: string[];
    };
    realistic: {
      totalSales: number;
      probability: number;
      factors: string[];
    };
  };

  // Risk Analysis
  @Column({ type: 'json', nullable: true })
  riskAnalysis?: {
    volatilityScore: number; // 0-100
    riskFactors: Array<{
      factor: string;
      impact: 'low' | 'medium' | 'high';
      probability: number;
      mitigation: string;
    }>;
    confidenceInterval: {
      lower: number;
      upper: number;
      percentage: number; // 95%, 99%, etc.
    };
    sensitivityAnalysis?: Array<{
      variable: string;
      changePercent: number;
      salesImpact: number;
    }>;
  };

  // Business Insights
  @Column({ type: 'json', nullable: true })
  businessInsights?: {
    trendInsights: string[];
    opportunities: Array<{
      description: string;
      potentialImpact: number;
      timeline: string;
      requirements: string[];
    }>;
    warnings: Array<{
      type: 'demand_drop' | 'inventory_shortage' | 'seasonal_decline' | 'market_saturation';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      timeline: string;
      recommendations: string[];
    }>;
    recommendations: Array<{
      action: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      expectedOutcome: string;
      resource: string;
      timeline: string;
    }>;
  };

  // Inventory Planning
  @Column({ type: 'json', nullable: true })
  inventoryRecommendations?: {
    suggestedStockLevels: Array<{
      date: Date;
      recommendedStock: number;
      safetyStock: number;
      reorderPoint: number;
      rationale: string;
    }>;
    totalInventoryNeeded: number;
    investmentRequired: number;
    turnoverForecast: number;
    stockoutRisk: Array<{
      date: Date;
      riskLevel: 'low' | 'medium' | 'high';
      probability: number;
    }>;
  };

  // Model Performance
  @Column({ name: 'model_confidence', type: 'decimal', precision: 5, scale: 2 })
  modelConfidence: number; // 0-100

  @Column({ name: 'training_samples', nullable: true })
  trainingSamples?: number;

  @Column({ name: 'processing_time_ms', nullable: true })
  processingTimeMs?: number;

  @Column({ name: 'cross_validation_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  crossValidationScore?: number;

  // Validation Against Actual Results
  @Column({ type: 'json', nullable: true })
  actualResults?: Array<{
    date: Date;
    actualSales: number;
    predictedSales: number;
    error: number;
    errorPercentage: number;
  }>;

  @Column({ name: 'validation_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  validationScore?: number;

  @Column({ name: 'last_validation_date', type: 'timestamp', nullable: true })
  lastValidationDate?: Date;

  // Comparison with Previous Forecasts
  @Column({ type: 'json', nullable: true })
  previousComparison?: {
    previousForecastId: string;
    accuracy: 'improved' | 'similar' | 'degraded';
    changeInMAPE: number;
    significantChanges: string[];
  };

  @Column({ type: 'json', nullable: true })
  metadata?: {
    dataFilters?: any;
    analysisParameters?: any;
    customSettings?: any;
  };

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isAccurate(): boolean {
    return this.accuracyPercentage !== undefined && this.accuracyPercentage >= 85;
  }

  isReliable(): boolean {
    return this.modelConfidence >= 80 && this.isAccurate();
  }

  hasSeasonality(): boolean {
    return this.seasonalityAnalysis?.hasSeasonality || false;
  }

  isHighRisk(): boolean {
    const riskScore = this.riskAnalysis?.volatilityScore || 0;
    return riskScore > 70;
  }

  getForecastHorizonDays(): number {
    return Math.ceil((this.forecastPeriodEnd.getTime() - this.forecastPeriodStart.getTime()) / (1000 * 60 * 60 * 24));
  }

  getTotalForecastRevenue(avgPrice?: number): number {
    if (!avgPrice) return 0;
    return this.totalForecastSales * avgPrice;
  }

  getPeakSalesPeriod(): { date: Date; amount: number } | null {
    if (!this.peakSalesDate || !this.peakSalesAmount) return null;
    return {
      date: this.peakSalesDate,
      amount: this.peakSalesAmount,
    };
  }

  getGrowthRate(): number {
    if (this.forecastResults.length < 2) return 0;
    
    const firstPeriod = this.forecastResults[0];
    const lastPeriod = this.forecastResults[this.forecastResults.length - 1];
    
    return ((lastPeriod.predicted - firstPeriod.predicted) / firstPeriod.predicted) * 100;
  }

  getConfidenceLevel(): 'high' | 'medium' | 'low' {
    if (this.modelConfidence >= 85) return 'high';
    if (this.modelConfidence >= 70) return 'medium';
    return 'low';
  }

  getAccuracyGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (!this.accuracyPercentage) return 'F';
    
    if (this.accuracyPercentage >= 95) return 'A';
    if (this.accuracyPercentage >= 85) return 'B';
    if (this.accuracyPercentage >= 70) return 'C';
    if (this.accuracyPercentage >= 50) return 'D';
    return 'F';
  }

  getNextMajorPeak(): { date: Date; amount: number } | null {
    const futureResults = this.forecastResults.filter(r => r.date > new Date());
    if (futureResults.length === 0) return null;
    
    const peak = futureResults.reduce((max, current) => 
      current.predicted > max.predicted ? current : max
    );
    
    return {
      date: peak.date,
      amount: peak.predicted,
    };
  }

  validateForecast(actualSales: Array<{ date: Date; sales: number }>): {
    accuracy: number;
    mae: number;
    mape: number;
    insights: string[];
  } {
    const validationResults = [];
    
    for (const actual of actualSales) {
      const predicted = this.forecastResults.find(f => 
        f.date.toDateString() === actual.date.toDateString()
      );
      
      if (predicted) {
        const error = Math.abs(actual.sales - predicted.predicted);
        const errorPercentage = (error / actual.sales) * 100;
        
        validationResults.push({
          error,
          errorPercentage,
          actual: actual.sales,
          predicted: predicted.predicted,
        });
      }
    }
    
    if (validationResults.length === 0) {
      return { accuracy: 0, mae: 0, mape: 0, insights: ['No matching data for validation'] };
    }
    
    const mae = validationResults.reduce((sum, r) => sum + r.error, 0) / validationResults.length;
    const mape = validationResults.reduce((sum, r) => sum + r.errorPercentage, 0) / validationResults.length;
    const accuracy = Math.max(0, 100 - mape);
    
    const insights = [];
    if (accuracy >= 90) insights.push('Excellent forecast accuracy');
    else if (accuracy < 70) insights.push('Forecast accuracy needs improvement');
    
    if (mape > 20) insights.push('High prediction errors detected');
    
    return { accuracy, mae, mape, insights };
  }

  generateSummaryReport(): {
    overview: string;
    keyMetrics: any;
    insights: string[];
    recommendations: string[];
  } {
    const horizon = this.getForecastHorizonDays();
    const growth = this.getGrowthRate();
    const confidence = this.getConfidenceLevel();
    
    const overview = `Sales forecast for ${horizon} days ahead shows ${this.totalForecastSales} total units ` +
                    `with ${growth.toFixed(1)}% growth trend. Confidence level: ${confidence}.`;
    
    const keyMetrics = {
      totalForecastSales: this.totalForecastSales,
      averageDailySales: this.averageDailyForecast,
      growthRate: growth,
      confidenceLevel: confidence,
      accuracy: this.accuracyPercentage,
      peakSalesDate: this.peakSalesDate,
      peakSalesAmount: this.peakSalesAmount,
    };
    
    const insights = [];
    if (this.hasSeasonality()) {
      insights.push('Strong seasonal patterns detected');
    }
    if (this.isHighRisk()) {
      insights.push('High volatility - monitor closely');
    }
    if (growth > 10) {
      insights.push('Strong growth trend identified');
    } else if (growth < -10) {
      insights.push('Declining trend requires attention');
    }
    
    const recommendations = this.businessInsights?.recommendations.map(r => r.action) || [];
    
    return { overview, keyMetrics, insights, recommendations };
  }

  // Static factory methods
  static createDailySalesForecast(data: {
    userId: string;
    asin: string;
    productName: string;
    historicalSales: Array<{ date: Date; sales: number }>;
    forecastDays: number;
  }): Partial<SalesForecast> {
    const now = new Date();
    const forecastStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const forecastEnd = new Date(forecastStart.getTime() + data.forecastDays * 24 * 60 * 60 * 1000);
    
    const totalHistoricalSales = data.historicalSales.reduce((sum, s) => sum + s.sales, 0);
    const avgDailySales = totalHistoricalSales / data.historicalSales.length;
    
    return {
      userId: data.userId,
      asin: data.asin,
      productName: data.productName,
      forecastType: ForecastType.DAILY,
      forecastMethod: ForecastMethod.LSTM,
      forecastDate: now,
      forecastPeriodStart: forecastStart,
      forecastPeriodEnd: forecastEnd,
      trainingPeriodStart: data.historicalSales[0]?.date || new Date(),
      trainingPeriodEnd: data.historicalSales[data.historicalSales.length - 1]?.date || new Date(),
      historicalData: {
        totalSales: totalHistoricalSales,
        averageDailySales: avgDailySales,
        salesTrend: 'stable', // Will be calculated
        dataPoints: data.historicalSales.length,
        dataQuality: 90,
        missingDataPercentage: 0,
        outliers: 0,
      },
      forecastResults: [], // Will be populated by forecasting algorithm
      totalForecastSales: avgDailySales * data.forecastDays, // Initial estimate
      averageDailyForecast: avgDailySales,
      modelConfidence: 75,
    };
  }

  static createSeasonalForecast(data: {
    userId: string;
    asin: string;
    seasonalPeriod: number;
    seasonalStrength: number;
    historicalData: any;
  }): Partial<SalesForecast> {
    return {
      userId: data.userId,
      asin: data.asin,
      forecastType: ForecastType.MONTHLY,
      forecastMethod: ForecastMethod.PROPHET,
      forecastDate: new Date(),
      forecastPeriodStart: new Date(),
      forecastPeriodEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months
      trainingPeriodStart: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year back
      trainingPeriodEnd: new Date(),
      seasonalityAnalysis: {
        hasSeasonality: true,
        seasonalityType: SeasonalityType.YEARLY,
        seasonalStrength: data.seasonalStrength,
        seasonalPeriod: data.seasonalPeriod,
        seasonalPeaks: [],
      },
      historicalData: data.historicalData,
      forecastResults: [],
      totalForecastSales: 0,
      averageDailyForecast: 0,
      modelConfidence: 80,
    };
  }
}