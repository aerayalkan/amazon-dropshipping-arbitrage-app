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

export enum SentimentScore {
  VERY_NEGATIVE = 'very_negative', // 0-0.2
  NEGATIVE = 'negative', // 0.2-0.4
  NEUTRAL = 'neutral', // 0.4-0.6
  POSITIVE = 'positive', // 0.6-0.8
  VERY_POSITIVE = 'very_positive', // 0.8-1.0
}

export enum AnalysisSource {
  PRODUCT_REVIEWS = 'product_reviews',
  CUSTOMER_FEEDBACK = 'customer_feedback',
  SOCIAL_MEDIA = 'social_media',
  NEWS_ARTICLES = 'news_articles',
  FORUM_DISCUSSIONS = 'forum_discussions',
  COMPETITOR_ANALYSIS = 'competitor_analysis',
  MARKET_RESEARCH = 'market_research',
}

export enum EmotionType {
  JOY = 'joy',
  SADNESS = 'sadness',
  ANGER = 'anger',
  FEAR = 'fear',
  SURPRISE = 'surprise',
  DISGUST = 'disgust',
  TRUST = 'trust',
  ANTICIPATION = 'anticipation',
}

@Entity('sentiment_analyses')
@Index(['userId', 'asin'])
@Index(['analysisSource', 'analysisDate'])
@Index(['overallSentiment', 'confidence'])
@Index(['analysisDate'])
export class SentimentAnalysis {
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

  @Column({ name: 'brand_name', nullable: true })
  brandName?: string;

  @Column({ name: 'category', nullable: true })
  category?: string;

  @Column({
    type: 'enum',
    enum: AnalysisSource,
    name: 'analysis_source',
  })
  analysisSource: AnalysisSource;

  @Column({ name: 'analysis_date', type: 'timestamp' })
  analysisDate: Date;

  @Column({ name: 'data_period_start', type: 'timestamp' })
  dataPeriodStart: Date;

  @Column({ name: 'data_period_end', type: 'timestamp' })
  dataPeriodEnd: Date;

  // Overall Sentiment Results
  @Column({
    type: 'enum',
    enum: SentimentScore,
    name: 'overall_sentiment',
  })
  overallSentiment: SentimentScore;

  @Column({ name: 'sentiment_score', type: 'decimal', precision: 5, scale: 4 })
  sentimentScore: number; // 0.0 to 1.0

  @Column({ name: 'confidence', type: 'decimal', precision: 5, scale: 2 })
  confidence: number; // 0-100

  @Column({ name: 'total_samples', default: 0 })
  totalSamples: number;

  // Sentiment Distribution
  @Column({ type: 'json' })
  sentimentDistribution: {
    veryPositive: { count: number; percentage: number };
    positive: { count: number; percentage: number };
    neutral: { count: number; percentage: number };
    negative: { count: number; percentage: number };
    veryNegative: { count: number; percentage: number };
  };

  // Emotion Analysis
  @Column({ type: 'json', nullable: true })
  emotionAnalysis?: {
    primaryEmotion: EmotionType;
    emotions: Array<{
      emotion: EmotionType;
      score: number;
      confidence: number;
    }>;
    emotionalIntensity: number; // 0-1
    emotionalComplexity: number; // number of significant emotions
  };

  // Aspect-Based Sentiment Analysis
  @Column({ type: 'json', nullable: true })
  aspectSentiments?: Array<{
    aspect: string; // e.g., 'quality', 'price', 'shipping', 'customer_service'
    sentiment: SentimentScore;
    score: number;
    confidence: number;
    mentions: number;
    keywords: string[];
    examples: string[];
  }>;

  // Time-Series Sentiment
  @Column({ type: 'json', nullable: true })
  timeSeriesSentiment?: Array<{
    date: Date;
    sentiment: number;
    count: number;
    confidence: number;
  }>;

  // Text Analysis Details
  @Column({ type: 'json', nullable: true })
  textAnalysis?: {
    languageDetection: {
      language: string;
      confidence: number;
    };
    readabilityScore: number;
    averageTextLength: number;
    vocabularyComplexity: number;
    commonPhrases: Array<{
      phrase: string;
      frequency: number;
      sentiment: number;
    }>;
    keywordSentiments: Array<{
      keyword: string;
      sentiment: number;
      frequency: number;
      importance: number;
    }>;
  };

  // Sample Analysis
  @Column({ type: 'json', nullable: true })
  sampleAnalysis?: Array<{
    id: string;
    text: string;
    sentiment: SentimentScore;
    score: number;
    confidence: number;
    emotions?: EmotionType[];
    aspects?: Array<{
      aspect: string;
      sentiment: number;
    }>;
    rating?: number; // if available (e.g., star rating)
    verified?: boolean; // for reviews
    source?: string;
    date?: Date;
  }>;

  // Comparative Analysis
  @Column({ type: 'json', nullable: true })
  competitorComparison?: {
    competitorData: Array<{
      competitorName: string;
      competitorASIN?: string;
      sentiment: number;
      confidence: number;
      sampleSize: number;
    }>;
    relativePosition: 'better' | 'similar' | 'worse';
    marketAverage: number;
    percentileRank: number; // 0-100
  };

  // Trend Analysis
  @Column({ type: 'json', nullable: true })
  trendAnalysis?: {
    trendDirection: 'improving' | 'declining' | 'stable';
    changeRate: number; // sentiment change per day
    volatility: number;
    seasonalPatterns?: Array<{
      period: 'daily' | 'weekly' | 'monthly';
      pattern: string;
      strength: number;
    }>;
    significantEvents?: Array<{
      date: Date;
      event: string;
      impact: number;
      description: string;
    }>;
  };

  // Alert Triggers
  @Column({ type: 'json', nullable: true })
  alerts?: Array<{
    type: 'sentiment_drop' | 'negative_spike' | 'review_bomb' | 'competitor_advantage';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    threshold: number;
    currentValue: number;
    timestamp: Date;
    acknowledged: boolean;
  }>;

  // Topic Modeling
  @Column({ type: 'json', nullable: true })
  topics?: Array<{
    topicId: number;
    topicName: string;
    keywords: string[];
    sentiment: number;
    prevalence: number; // percentage of documents
    coherenceScore: number;
    examples: string[];
  }>;

  // Business Insights
  @Column({ type: 'json', nullable: true })
  businessInsights?: {
    strengths: Array<{
      aspect: string;
      score: number;
      evidence: string[];
      actionable: boolean;
    }>;
    weaknesses: Array<{
      aspect: string;
      score: number;
      evidence: string[];
      priority: 'low' | 'medium' | 'high';
      suggestedActions: string[];
    }>;
    opportunities: Array<{
      description: string;
      impact: 'low' | 'medium' | 'high';
      effort: 'low' | 'medium' | 'high';
      timeline: string;
    }>;
    threats: Array<{
      description: string;
      probability: number;
      impact: 'low' | 'medium' | 'high';
      mitigation: string[];
    }>;
  };

  // Quality Metrics
  @Column({ name: 'data_quality_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  dataQualityScore?: number;

  @Column({ name: 'model_accuracy', type: 'decimal', precision: 5, scale: 2, nullable: true })
  modelAccuracy?: number;

  @Column({ name: 'processing_time_ms', nullable: true })
  processingTimeMs?: number;

  @Column({ name: 'source_reliability', type: 'decimal', precision: 5, scale: 2, nullable: true })
  sourceReliability?: number;

  // Previous Analysis Comparison
  @Column({ type: 'json', nullable: true })
  previousComparison?: {
    previousAnalysisId: string;
    sentimentChange: number;
    significantChanges: string[];
    trendConsistency: boolean;
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
  isPositive(): boolean {
    return this.overallSentiment === SentimentScore.POSITIVE || 
           this.overallSentiment === SentimentScore.VERY_POSITIVE;
  }

  isNegative(): boolean {
    return this.overallSentiment === SentimentScore.NEGATIVE || 
           this.overallSentiment === SentimentScore.VERY_NEGATIVE;
  }

  isNeutral(): boolean {
    return this.overallSentiment === SentimentScore.NEUTRAL;
  }

  hasHighConfidence(): boolean {
    return this.confidence >= 80;
  }

  needsAttention(): boolean {
    return this.isNegative() && this.hasHighConfidence() && this.totalSamples >= 10;
  }

  getPositivePercentage(): number {
    const dist = this.sentimentDistribution;
    return dist.positive.percentage + dist.veryPositive.percentage;
  }

  getNegativePercentage(): number {
    const dist = this.sentimentDistribution;
    return dist.negative.percentage + dist.veryNegative.percentage;
  }

  getSentimentTrend(): 'improving' | 'declining' | 'stable' {
    return this.trendAnalysis?.trendDirection || 'stable';
  }

  getMostMentionedAspect(): any | null {
    if (!this.aspectSentiments || this.aspectSentiments.length === 0) return null;
    
    return this.aspectSentiments.reduce((max, current) => 
      current.mentions > max.mentions ? current : max
    );
  }

  getWorstAspect(): any | null {
    if (!this.aspectSentiments || this.aspectSentiments.length === 0) return null;
    
    return this.aspectSentiments.reduce((worst, current) => 
      current.score < worst.score ? current : worst
    );
  }

  getBestAspect(): any | null {
    if (!this.aspectSentiments || this.aspectSentiments.length === 0) return null;
    
    return this.aspectSentiments.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }

  calculateSentimentGrade(): 'A' | 'B' | 'C' | 'D' | 'F' {
    const score = this.sentimentScore * 100;
    
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  getCompetitivePosition(): 'leading' | 'competitive' | 'lagging' | 'unknown' {
    if (!this.competitorComparison) return 'unknown';
    
    const percentile = this.competitorComparison.percentileRank;
    
    if (percentile >= 75) return 'leading';
    if (percentile >= 50) return 'competitive';
    return 'lagging';
  }

  generateActionableInsights(): string[] {
    const insights: string[] = [];
    
    if (this.needsAttention()) {
      insights.push(`Negative sentiment detected (${this.getNegativePercentage().toFixed(1)}%) - immediate attention required`);
    }
    
    const worstAspect = this.getWorstAspect();
    if (worstAspect && worstAspect.score < 0.4) {
      insights.push(`${worstAspect.aspect} is the weakest aspect - focus improvement efforts here`);
    }
    
    if (this.getSentimentTrend() === 'declining') {
      insights.push('Sentiment is declining - investigate recent changes or issues');
    }
    
    const competitivePos = this.getCompetitivePosition();
    if (competitivePos === 'lagging') {
      insights.push('Sentiment below market average - analyze competitor strategies');
    }
    
    if (this.alerts && this.alerts.length > 0) {
      const criticalAlerts = this.alerts.filter(a => a.severity === 'critical' || a.severity === 'high');
      if (criticalAlerts.length > 0) {
        insights.push(`${criticalAlerts.length} critical sentiment alerts require immediate action`);
      }
    }
    
    return insights;
  }

  generateSummaryReport(): {
    overview: string;
    keyMetrics: any;
    trends: string[];
    recommendations: string[];
  } {
    const grade = this.calculateSentimentGrade();
    const trend = this.getSentimentTrend();
    const competitivePos = this.getCompetitivePosition();
    
    const overview = `Overall sentiment: ${this.overallSentiment} (Grade: ${grade}) with ${this.confidence}% confidence. ` +
                    `Analysis of ${this.totalSamples} samples shows ${trend} trend. ` +
                    `Competitive position: ${competitivePos}.`;
    
    const keyMetrics = {
      sentimentScore: this.sentimentScore,
      grade: grade,
      positivePercentage: this.getPositivePercentage(),
      negativePercentage: this.getNegativePercentage(),
      confidence: this.confidence,
      sampleSize: this.totalSamples,
      competitiveRank: this.competitorComparison?.percentileRank,
    };
    
    const trends = [];
    if (trend !== 'stable') {
      trends.push(`Sentiment is ${trend}`);
    }
    if (this.trendAnalysis?.volatility && this.trendAnalysis.volatility > 0.5) {
      trends.push('High sentiment volatility detected');
    }
    
    const recommendations = this.generateActionableInsights();
    
    return { overview, keyMetrics, trends, recommendations };
  }

  // Static factory methods
  static createReviewAnalysis(data: {
    userId: string;
    asin: string;
    productName: string;
    reviews: Array<{
      text: string;
      rating: number;
      verified: boolean;
      date: Date;
    }>;
  }): Partial<SentimentAnalysis> {
    return {
      userId: data.userId,
      asin: data.asin,
      productName: data.productName,
      analysisSource: AnalysisSource.PRODUCT_REVIEWS,
      analysisDate: new Date(),
      dataPeriodStart: data.reviews[0]?.date || new Date(),
      dataPeriodEnd: data.reviews[data.reviews.length - 1]?.date || new Date(),
      totalSamples: data.reviews.length,
      overallSentiment: SentimentScore.NEUTRAL, // Will be calculated
      sentimentScore: 0.5, // Will be calculated
      confidence: 0, // Will be calculated
      sentimentDistribution: {
        veryPositive: { count: 0, percentage: 0 },
        positive: { count: 0, percentage: 0 },
        neutral: { count: 0, percentage: 0 },
        negative: { count: 0, percentage: 0 },
        veryNegative: { count: 0, percentage: 0 },
      },
    };
  }

  static createCompetitorAnalysis(data: {
    userId: string;
    category: string;
    competitors: Array<{
      name: string;
      asin?: string;
      sentiment: number;
      sampleSize: number;
    }>;
  }): Partial<SentimentAnalysis> {
    const marketAverage = data.competitors.reduce((sum, c) => sum + c.sentiment, 0) / data.competitors.length;
    
    return {
      userId: data.userId,
      category: data.category,
      analysisSource: AnalysisSource.COMPETITOR_ANALYSIS,
      analysisDate: new Date(),
      dataPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      dataPeriodEnd: new Date(),
      totalSamples: data.competitors.reduce((sum, c) => sum + c.sampleSize, 0),
      overallSentiment: SentimentScore.NEUTRAL,
      sentimentScore: marketAverage,
      confidence: 75,
      sentimentDistribution: {
        veryPositive: { count: 0, percentage: 0 },
        positive: { count: 0, percentage: 0 },
        neutral: { count: 0, percentage: 0 },
        negative: { count: 0, percentage: 0 },
        veryNegative: { count: 0, percentage: 0 },
      },
      competitorComparison: {
        competitorData: data.competitors.map(c => ({
          competitorName: c.name,
          competitorASIN: c.asin,
          sentiment: c.sentiment,
          confidence: 80,
          sampleSize: c.sampleSize,
        })),
        relativePosition: 'similar',
        marketAverage,
        percentileRank: 50,
      },
    };
  }
}