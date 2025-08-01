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

export enum TrendDirection {
  UPWARD = 'upward',
  DOWNWARD = 'downward',
  STABLE = 'stable',
  VOLATILE = 'volatile',
  SEASONAL = 'seasonal',
  CYCLICAL = 'cyclical',
}

export enum TrendStrength {
  VERY_WEAK = 'very_weak',
  WEAK = 'weak',
  MODERATE = 'moderate',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong',
}

export enum TrendTimeframe {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

export enum AnalysisType {
  PRICE_TREND = 'price_trend',
  SALES_TREND = 'sales_trend',
  DEMAND_TREND = 'demand_trend',
  MARKET_TREND = 'market_trend',
  COMPETITION_TREND = 'competition_trend',
  SEASONALITY = 'seasonality',
  ANOMALY_DETECTION = 'anomaly_detection',
}

@Entity('trend_analyses')
@Index(['userId', 'asin'])
@Index(['analysisType', 'trendDirection'])
@Index(['confidence', 'analysisDate'])
@Index(['timeframe', 'analysisDate'])
export class TrendAnalysis {
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

  @Column({
    type: 'enum',
    enum: AnalysisType,
    name: 'analysis_type',
  })
  analysisType: AnalysisType;

  @Column({
    type: 'enum',
    enum: TrendTimeframe,
    name: 'timeframe',
  })
  timeframe: TrendTimeframe;

  @Column({ name: 'analysis_date', type: 'timestamp' })
  analysisDate: Date;

  @Column({ name: 'period_start', type: 'timestamp' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'timestamp' })
  periodEnd: Date;

  // Trend Analysis Results
  @Column({
    type: 'enum',
    enum: TrendDirection,
    name: 'trend_direction',
  })
  trendDirection: TrendDirection;

  @Column({
    type: 'enum',
    enum: TrendStrength,
    name: 'trend_strength',
  })
  trendStrength: TrendStrength;

  @Column({ name: 'confidence', type: 'decimal', precision: 5, scale: 2 })
  confidence: number; // 0-100

  @Column({ name: 'trend_score', type: 'decimal', precision: 8, scale: 4 })
  trendScore: number; // -1 to 1, negative for downward, positive for upward

  // Statistical Metrics
  @Column({ type: 'json' })
  statisticalMetrics: {
    correlation: number;
    rSquared: number;
    pValue: number;
    slope: number;
    intercept: number;
    standardError: number;
    meanAbsoluteError: number;
    rootMeanSquareError: number;
    autocorrelation?: number;
    stationarity?: {
      isStationary: boolean;
      adfStatistic: number;
      pValue: number;
    };
  };

  // Time Series Components
  @Column({ type: 'json', nullable: true })
  timeSeriesDecomposition?: {
    trend: Array<{ date: Date; value: number }>;
    seasonal: Array<{ date: Date; value: number }>;
    residual: Array<{ date: Date; value: number }>;
    seasonalPeriod?: number;
    seasonalStrength?: number;
    trendStrength?: number;
  };

  // Data Points
  @Column({ type: 'json' })
  dataPoints: Array<{
    date: Date;
    value: number;
    predicted?: number;
    confidence?: number;
    anomaly?: boolean;
    seasonalIndex?: number;
  }>;

  // Forecasting Results
  @Column({ type: 'json', nullable: true })
  forecast?: {
    predictions: Array<{
      date: Date;
      predicted: number;
      lowerBound: number;
      upperBound: number;
      confidence: number;
    }>;
    forecastHorizon: number; // days
    forecastAccuracy?: number;
    forecastMethod: string;
    uncertaintyMetrics: {
      averageError: number;
      errorStandardDeviation: number;
      confidenceInterval: number;
    };
  };

  // Seasonality Analysis
  @Column({ type: 'json', nullable: true })
  seasonalityAnalysis?: {
    hasSeasonality: boolean;
    seasonalPeriods: Array<{
      period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      strength: number;
      peaks: number[];
      troughs: number[];
    }>;
    seasonalIndices: Array<{
      period: string;
      index: number;
      significance: number;
    }>;
    holidayEffects?: Array<{
      holiday: string;
      effect: number;
      significance: number;
    }>;
  };

  // Anomaly Detection
  @Column({ type: 'json', nullable: true })
  anomalies?: Array<{
    date: Date;
    value: number;
    expectedValue: number;
    anomalyScore: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: 'outlier' | 'level_shift' | 'trend_change' | 'seasonal_anomaly';
    explanation?: string;
  }>;

  // Change Points
  @Column({ type: 'json', nullable: true })
  changePoints?: Array<{
    date: Date;
    changeType: 'trend' | 'level' | 'variance';
    magnitude: number;
    significance: number;
    beforeTrend: number;
    afterTrend: number;
    explanation?: string;
  }>;

  // Pattern Recognition
  @Column({ type: 'json', nullable: true })
  patterns?: Array<{
    patternType: 'cycle' | 'trend' | 'irregular' | 'seasonal';
    description: string;
    startDate: Date;
    endDate: Date;
    strength: number;
    frequency?: number;
    amplitude?: number;
  }>;

  // Market Context
  @Column({ type: 'json', nullable: true })
  marketContext?: {
    competitorTrends: Array<{
      competitorName: string;
      trendDirection: TrendDirection;
      correlation: number;
    }>;
    marketVolatility: number;
    marketPhase: 'growth' | 'maturity' | 'decline' | 'emergence';
    externalFactors: Array<{
      factor: string;
      impact: 'positive' | 'negative' | 'neutral';
      strength: number;
    }>;
  };

  // Business Insights
  @Column({ type: 'json', nullable: true })
  businessInsights?: {
    keyFindings: string[];
    opportunities: Array<{
      type: string;
      description: string;
      impact: 'low' | 'medium' | 'high';
      timeframe: string;
      requiredActions: string[];
    }>;
    risks: Array<{
      type: string;
      description: string;
      probability: number;
      impact: 'low' | 'medium' | 'high';
      mitigation: string[];
    }>;
    recommendations: Array<{
      action: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
      expectedOutcome: string;
      timeline: string;
      resources?: string[];
    }>;
  };

  // Model Performance
  @Column({ name: 'model_accuracy', type: 'decimal', precision: 5, scale: 2, nullable: true })
  modelAccuracy?: number;

  @Column({ name: 'processing_time_ms', nullable: true })
  processingTimeMs?: number;

  @Column({ name: 'data_quality_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  dataQualityScore?: number;

  // Comparison with Previous Analysis
  @Column({ type: 'json', nullable: true })
  previousComparison?: {
    previousAnalysisId: string;
    trendChange: 'improved' | 'deteriorated' | 'unchanged';
    confidenceChange: number;
    significantChanges: string[];
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
  isSignificantTrend(): boolean {
    return this.confidence >= 80 && 
           (this.trendStrength === TrendStrength.STRONG || 
            this.trendStrength === TrendStrength.VERY_STRONG);
  }

  isActionable(): boolean {
    return this.isSignificantTrend() && 
           this.confidence >= 70 &&
           this.statisticalMetrics.pValue < 0.05;
  }

  getTrendMagnitude(): number {
    return Math.abs(this.trendScore);
  }

  getTrendVelocity(): number {
    if (!this.dataPoints || this.dataPoints.length < 2) return 0;
    
    const firstPoint = this.dataPoints[0];
    const lastPoint = this.dataPoints[this.dataPoints.length - 1];
    const timeDiff = (lastPoint.date.getTime() - firstPoint.date.getTime()) / (1000 * 60 * 60 * 24); // days
    const valueDiff = lastPoint.value - firstPoint.value;
    
    return valueDiff / timeDiff; // change per day
  }

  getSeasonalStrength(): number {
    if (!this.seasonalityAnalysis?.seasonalPeriods) return 0;
    
    return this.seasonalityAnalysis.seasonalPeriods.reduce((max, period) => 
      Math.max(max, period.strength), 0);
  }

  hasAnomalies(): boolean {
    return (this.anomalies?.length || 0) > 0;
  }

  getCriticalAnomalies(): any[] {
    return this.anomalies?.filter(a => a.severity === 'critical' || a.severity === 'high') || [];
  }

  getNextForecastPoint(): any | null {
    if (!this.forecast?.predictions || this.forecast.predictions.length === 0) return null;
    
    const nextPrediction = this.forecast.predictions.find(p => p.date > new Date());
    return nextPrediction || null;
  }

  calculateTrendReliability(): number {
    let reliability = 50; // Base score

    // Confidence factor (40% weight)
    reliability += (this.confidence - 50) * 0.8;

    // Statistical significance (30% weight)
    if (this.statisticalMetrics.pValue < 0.01) reliability += 30;
    else if (this.statisticalMetrics.pValue < 0.05) reliability += 20;
    else if (this.statisticalMetrics.pValue < 0.1) reliability += 10;

    // Data quality (20% weight)
    if (this.dataQualityScore) {
      reliability += (this.dataQualityScore - 50) * 0.4;
    }

    // Sample size (10% weight)
    const sampleSize = this.dataPoints.length;
    if (sampleSize >= 100) reliability += 10;
    else if (sampleSize >= 50) reliability += 7;
    else if (sampleSize >= 20) reliability += 5;
    else if (sampleSize >= 10) reliability += 2;

    return Math.max(0, Math.min(100, reliability));
  }

  generateSummary(): string {
    const direction = this.trendDirection;
    const strength = this.trendStrength;
    const confidence = Math.round(this.confidence);
    
    let summary = `${this.analysisType.replace('_', ' ')} shows a ${strength} ${direction} trend with ${confidence}% confidence. `;
    
    if (this.isSignificantTrend()) {
      summary += 'This trend is statistically significant and actionable. ';
    }
    
    if (this.hasAnomalies()) {
      const criticalCount = this.getCriticalAnomalies().length;
      if (criticalCount > 0) {
        summary += `${criticalCount} critical anomalies detected. `;
      }
    }
    
    if (this.getSeasonalStrength() > 0.5) {
      summary += 'Strong seasonal patterns identified. ';
    }
    
    return summary;
  }

  getActionableInsights(): string[] {
    const insights: string[] = [];
    
    if (this.isSignificantTrend()) {
      if (this.trendDirection === TrendDirection.UPWARD) {
        insights.push(`Strong upward trend detected - consider increasing inventory or pricing optimization`);
      } else if (this.trendDirection === TrendDirection.DOWNWARD) {
        insights.push(`Declining trend identified - review pricing strategy or promotional activities`);
      }
    }
    
    if (this.getCriticalAnomalies().length > 0) {
      insights.push(`${this.getCriticalAnomalies().length} critical anomalies require immediate attention`);
    }
    
    if (this.seasonalityAnalysis?.hasSeasonality) {
      const strongSeasons = this.seasonalityAnalysis.seasonalPeriods.filter(p => p.strength > 0.7);
      if (strongSeasons.length > 0) {
        insights.push(`Strong ${strongSeasons[0].period} seasonality - plan inventory and marketing accordingly`);
      }
    }
    
    return insights;
  }

  // Static factory methods
  static createPriceTrendAnalysis(data: {
    userId: string;
    asin: string;
    timeframe: TrendTimeframe;
    dataPoints: Array<{ date: Date; value: number }>;
  }): Partial<TrendAnalysis> {
    return {
      userId: data.userId,
      asin: data.asin,
      analysisType: AnalysisType.PRICE_TREND,
      timeframe: data.timeframe,
      analysisDate: new Date(),
      periodStart: data.dataPoints[0]?.date || new Date(),
      periodEnd: data.dataPoints[data.dataPoints.length - 1]?.date || new Date(),
      dataPoints: data.dataPoints,
      trendDirection: TrendDirection.STABLE, // Will be calculated
      trendStrength: TrendStrength.MODERATE, // Will be calculated
      confidence: 0, // Will be calculated
      trendScore: 0, // Will be calculated
      statisticalMetrics: {
        correlation: 0,
        rSquared: 0,
        pValue: 1,
        slope: 0,
        intercept: 0,
        standardError: 0,
        meanAbsoluteError: 0,
        rootMeanSquareError: 0,
      },
    };
  }

  static createSeasonalityAnalysis(data: {
    userId: string;
    asin: string;
    dataPoints: Array<{ date: Date; value: number }>;
  }): Partial<TrendAnalysis> {
    return {
      userId: data.userId,
      asin: data.asin,
      analysisType: AnalysisType.SEASONALITY,
      timeframe: TrendTimeframe.YEARLY,
      analysisDate: new Date(),
      periodStart: data.dataPoints[0]?.date || new Date(),
      periodEnd: data.dataPoints[data.dataPoints.length - 1]?.date || new Date(),
      dataPoints: data.dataPoints,
      trendDirection: TrendDirection.SEASONAL,
      trendStrength: TrendStrength.MODERATE,
      confidence: 0,
      trendScore: 0,
      statisticalMetrics: {
        correlation: 0,
        rSquared: 0,
        pValue: 1,
        slope: 0,
        intercept: 0,
        standardError: 0,
        meanAbsoluteError: 0,
        rootMeanSquareError: 0,
      },
    };
  }
}