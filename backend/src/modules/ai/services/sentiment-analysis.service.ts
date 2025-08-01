import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';

import { 
  SentimentAnalysis, 
  SentimentScore, 
  AnalysisSource, 
  EmotionType 
} from '../entities/sentiment-analysis.entity';
import { PredictionModel, ModelType } from '../entities/prediction-model.entity';

export interface SentimentAnalysisInput {
  texts: Array<{
    id: string;
    text: string;
    rating?: number;
    verified?: boolean;
    date?: Date;
    source?: string;
  }>;
  analysisSource: AnalysisSource;
  includeEmotions?: boolean;
  includeAspects?: boolean;
  compareWithCompetitors?: boolean;
}

export interface SentimentAnalysisResult {
  overallSentiment: SentimentScore;
  sentimentScore: number;
  confidence: number;
  sentimentDistribution: {
    veryPositive: { count: number; percentage: number };
    positive: { count: number; percentage: number };
    neutral: { count: number; percentage: number };
    negative: { count: number; percentage: number };
    veryNegative: { count: number; percentage: number };
  };
  emotionAnalysis?: {
    primaryEmotion: EmotionType;
    emotions: Array<{
      emotion: EmotionType;
      score: number;
      confidence: number;
    }>;
  };
  aspectSentiments?: Array<{
    aspect: string;
    sentiment: SentimentScore;
    score: number;
    confidence: number;
    mentions: number;
    keywords: string[];
  }>;
  insights: string[];
  recommendations: string[];
}

export interface DistilBERTConfig {
  model_name: 'distilbert-base-uncased-finetuned-sst-2-english';
  max_length: number;
  batch_size: number;
  confidence_threshold: number;
}

export interface RoBERTaConfig {
  model_name: 'cardiffnlp/twitter-roberta-base-sentiment-latest';
  max_length: number;
  batch_size: number;
  use_preprocessing: boolean;
}

@Injectable()
export class SentimentAnalysisService {
  private readonly logger = new Logger(SentimentAnalysisService.name);

  constructor(
    @InjectRepository(SentimentAnalysis)
    private readonly sentimentAnalysisRepository: Repository<SentimentAnalysis>,
    @InjectRepository(PredictionModel)
    private readonly predictionModelRepository: Repository<PredictionModel>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * DistilBERT kullanarak sentiment analizi
   */
  async analyzeSentimentWithDistilBERT(
    userId: string,
    input: SentimentAnalysisInput,
    config?: Partial<DistilBERTConfig>
  ): Promise<SentimentAnalysisResult> {
    this.logger.log(`Starting DistilBERT sentiment analysis for user ${userId}`);

    try {
      // Konfigürasyon
      const distilbertConfig = this.buildDistilBERTConfig(config);
      
      // Model yükle
      const model = await this.loadDistilBERTModel(distilbertConfig);
      
      // Metinleri ön işle
      const preprocessedTexts = await this.preprocessTexts(input.texts);
      
      // Batch olarak analiz et
      const sentimentResults = await this.runDistilBERTAnalysis(
        model, 
        preprocessedTexts, 
        distilbertConfig
      );
      
      // Sonuçları işle
      const result = this.processSentimentResults(sentimentResults, input);
      
      // Sonuçları kaydet
      await this.saveSentimentAnalysis(userId, input, result, ModelType.TRANSFORMER);
      
      return result;

    } catch (error) {
      this.logger.error(`DistilBERT sentiment analysis failed: ${error.message}`);
      throw new Error(`DistilBERT sentiment analysis failed: ${error.message}`);
    }
  }

  /**
   * RoBERTa kullanarak sentiment analizi
   */
  async analyzeSentimentWithRoBERTa(
    userId: string,
    input: SentimentAnalysisInput,
    config?: Partial<RoBERTaConfig>
  ): Promise<SentimentAnalysisResult> {
    this.logger.log(`Starting RoBERTa sentiment analysis for user ${userId}`);

    try {
      // Konfigürasyon
      const robertaConfig = this.buildRoBERTaConfig(config);
      
      // Model yükle
      const model = await this.loadRoBERTaModel(robertaConfig);
      
      // Twitter preprocessing
      const preprocessedTexts = robertaConfig.use_preprocessing 
        ? await this.preprocessForSocialMedia(input.texts)
        : await this.preprocessTexts(input.texts);
      
      // Sentiment analizi
      const sentimentResults = await this.runRoBERTaAnalysis(
        model, 
        preprocessedTexts, 
        robertaConfig
      );
      
      // Sonuçları işle
      const result = this.processSentimentResults(sentimentResults, input);
      
      // Kaydet
      await this.saveSentimentAnalysis(userId, input, result, ModelType.TRANSFORMER);
      
      return result;

    } catch (error) {
      this.logger.error(`RoBERTa sentiment analysis failed: ${error.message}`);
      throw new Error(`RoBERTa sentiment analysis failed: ${error.message}`);
    }
  }

  /**
   * Emotion analizi yap
   */
  async analyzeEmotions(
    userId: string,
    texts: Array<{ text: string; id: string }>
  ): Promise<Array<{
    id: string;
    text: string;
    emotions: Array<{
      emotion: EmotionType;
      score: number;
      confidence: number;
    }>;
    primaryEmotion: EmotionType;
    emotionalIntensity: number;
  }>> {
    this.logger.log(`Analyzing emotions for user ${userId}`);

    try {
      const emotionResults = [];
      
      for (const textItem of texts) {
        const emotions = await this.detectEmotions(textItem.text);
        const primaryEmotion = emotions.reduce((max, current) => 
          current.score > max.score ? current : max
        );
        
        const emotionalIntensity = emotions.reduce((sum, e) => sum + e.score, 0) / emotions.length;
        
        emotionResults.push({
          id: textItem.id,
          text: textItem.text,
          emotions,
          primaryEmotion: primaryEmotion.emotion,
          emotionalIntensity,
        });
      }
      
      return emotionResults;

    } catch (error) {
      this.logger.error(`Emotion analysis failed: ${error.message}`);
      throw new Error(`Emotion analysis failed: ${error.message}`);
    }
  }

  /**
   * Aspect-based sentiment analizi
   */
  async analyzeAspectBasedSentiment(
    userId: string,
    texts: Array<{ text: string; id: string }>,
    aspects: string[] = ['quality', 'price', 'shipping', 'customer_service', 'packaging']
  ): Promise<Array<{
    aspect: string;
    sentiment: SentimentScore;
    score: number;
    confidence: number;
    mentions: number;
    keywords: string[];
    examples: string[];
  }>> {
    this.logger.log(`Analyzing aspect-based sentiment for user ${userId}`);

    try {
      const aspectResults = [];
      
      for (const aspect of aspects) {
        const aspectMentions = await this.extractAspectMentions(texts, aspect);
        
        if (aspectMentions.length > 0) {
          const aspectSentiment = await this.analyzeAspectSentiment(aspectMentions);
          
          aspectResults.push({
            aspect,
            sentiment: aspectSentiment.sentiment,
            score: aspectSentiment.score,
            confidence: aspectSentiment.confidence,
            mentions: aspectMentions.length,
            keywords: aspectSentiment.keywords,
            examples: aspectMentions.slice(0, 3).map(m => m.text),
          });
        }
      }
      
      return aspectResults;

    } catch (error) {
      this.logger.error(`Aspect-based sentiment analysis failed: ${error.message}`);
      throw new Error(`Aspect-based sentiment analysis failed: ${error.message}`);
    }
  }

  /**
   * Competitor sentiment karşılaştırması
   */
  async compareCompetitorSentiment(
    userId: string,
    ourProductASIN: string,
    competitorASINs: string[]
  ): Promise<{
    ourSentiment: {
      asin: string;
      sentiment: number;
      confidence: number;
      sampleSize: number;
    };
    competitors: Array<{
      asin: string;
      sentiment: number;
      confidence: number;
      sampleSize: number;
    }>;
    comparison: {
      position: 'leading' | 'competitive' | 'lagging';
      percentileRank: number;
      marketAverage: number;
      recommendations: string[];
    };
  }> {
    this.logger.log(`Comparing competitor sentiment for user ${userId}`);

    try {
      // Kendi ürünümüzün sentiment'ini al
      const ourSentiment = await this.getProductSentiment(ourProductASIN);
      
      // Rakiplerin sentiment'lerini al
      const competitorSentiments = [];
      for (const asin of competitorASINs) {
        const sentiment = await this.getProductSentiment(asin);
        competitorSentiments.push({
          asin,
          sentiment: sentiment.score,
          confidence: sentiment.confidence,
          sampleSize: sentiment.sampleSize,
        });
      }
      
      // Karşılaştırma analizi
      const allSentiments = [ourSentiment.score, ...competitorSentiments.map(c => c.sentiment)];
      const marketAverage = allSentiments.reduce((sum, s) => sum + s, 0) / allSentiments.length;
      
      const sortedSentiments = [...allSentiments].sort((a, b) => b - a);
      const ourRank = sortedSentiments.indexOf(ourSentiment.score);
      const percentileRank = ((sortedSentiments.length - ourRank) / sortedSentiments.length) * 100;
      
      let position: 'leading' | 'competitive' | 'lagging';
      if (percentileRank >= 75) position = 'leading';
      else if (percentileRank >= 50) position = 'competitive';
      else position = 'lagging';
      
      const recommendations = this.generateCompetitorRecommendations(
        position, 
        ourSentiment.score, 
        marketAverage
      );
      
      return {
        ourSentiment: {
          asin: ourProductASIN,
          sentiment: ourSentiment.score,
          confidence: ourSentiment.confidence,
          sampleSize: ourSentiment.sampleSize,
        },
        competitors: competitorSentiments,
        comparison: {
          position,
          percentileRank,
          marketAverage,
          recommendations,
        },
      };

    } catch (error) {
      this.logger.error(`Competitor sentiment comparison failed: ${error.message}`);
      throw new Error(`Competitor sentiment comparison failed: ${error.message}`);
    }
  }

  /**
   * Real-time sentiment monitoring
   */
  async monitorSentimentChanges(
    userId: string,
    asin: string,
    thresholds: {
      negativeSpike: number; // 10% increase in negative sentiment
      overallDrop: number; // 0.1 point drop in overall sentiment
      reviewCount: number; // minimum reviews to trigger alert
    }
  ): Promise<{
    alerts: Array<{
      type: 'negative_spike' | 'sentiment_drop' | 'review_bomb';
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      data: any;
      timestamp: Date;
    }>;
    currentStatus: {
      sentiment: number;
      trend: 'improving' | 'stable' | 'declining';
      riskLevel: 'low' | 'medium' | 'high';
    };
  }> {
    this.logger.log(`Monitoring sentiment changes for ASIN ${asin}`);

    try {
      // Son 24 saatteki sentiment verisini al
      const recentAnalyses = await this.sentimentAnalysisRepository.find({
        where: {
          userId,
          asin,
        },
        order: { analysisDate: 'DESC' },
        take: 10,
      });

      const alerts = [];
      
      if (recentAnalyses.length >= 2) {
        const latest = recentAnalyses[0];
        const previous = recentAnalyses[1];
        
        // Negative spike kontrolü
        const negativeIncrease = latest.getNegativePercentage() - previous.getNegativePercentage();
        if (negativeIncrease > thresholds.negativeSpike) {
          alerts.push({
            type: 'negative_spike' as const,
            severity: negativeIncrease > 20 ? 'critical' : negativeIncrease > 10 ? 'high' : 'medium',
            message: `Negative sentiment increased by ${negativeIncrease.toFixed(1)}%`,
            data: { increase: negativeIncrease, current: latest.getNegativePercentage() },
            timestamp: new Date(),
          });
        }
        
        // Overall sentiment drop
        const sentimentDrop = previous.sentimentScore - latest.sentimentScore;
        if (sentimentDrop > thresholds.overallDrop) {
          alerts.push({
            type: 'sentiment_drop' as const,
            severity: sentimentDrop > 0.3 ? 'critical' : sentimentDrop > 0.2 ? 'high' : 'medium',
            message: `Overall sentiment dropped by ${sentimentDrop.toFixed(2)} points`,
            data: { drop: sentimentDrop, current: latest.sentimentScore },
            timestamp: new Date(),
          });
        }
      }
      
      // Trend analizi
      const trend = this.calculateSentimentTrend(recentAnalyses);
      const riskLevel = this.assessRiskLevel(recentAnalyses);
      
      return {
        alerts,
        currentStatus: {
          sentiment: recentAnalyses[0]?.sentimentScore || 0.5,
          trend,
          riskLevel,
        },
      };

    } catch (error) {
      this.logger.error(`Sentiment monitoring failed: ${error.message}`);
      throw new Error(`Sentiment monitoring failed: ${error.message}`);
    }
  }

  // Private helper methods
  private buildDistilBERTConfig(customConfig?: Partial<DistilBERTConfig>): DistilBERTConfig {
    return {
      model_name: 'distilbert-base-uncased-finetuned-sst-2-english',
      max_length: 512,
      batch_size: 16,
      confidence_threshold: 0.7,
      ...customConfig,
    };
  }

  private buildRoBERTaConfig(customConfig?: Partial<RoBERTaConfig>): RoBERTaConfig {
    return {
      model_name: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      max_length: 512,
      batch_size: 16,
      use_preprocessing: true,
      ...customConfig,
    };
  }

  private async loadDistilBERTModel(config: DistilBERTConfig): Promise<any> {
    // Mock model loading
    this.logger.log(`Loading DistilBERT model: ${config.model_name}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { config, loaded: true };
  }

  private async loadRoBERTaModel(config: RoBERTaConfig): Promise<any> {
    // Mock model loading
    this.logger.log(`Loading RoBERTa model: ${config.model_name}`);
    await new Promise(resolve => setTimeout(resolve, 500));
    return { config, loaded: true };
  }

  private async preprocessTexts(texts: Array<any>): Promise<Array<any>> {
    return texts.map(item => ({
      ...item,
      processedText: this.cleanText(item.text),
    }));
  }

  private async preprocessForSocialMedia(texts: Array<any>): Promise<Array<any>> {
    return texts.map(item => ({
      ...item,
      processedText: this.cleanSocialMediaText(item.text),
    }));
  }

  private cleanText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanSocialMediaText(text: string): string {
    return text
      .replace(/@\w+/g, '@user') // Replace mentions
      .replace(/http\S+/g, 'http') // Replace URLs
      .replace(/[^\w\s@#]/gi, ' ') // Keep hashtags and mentions
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async runDistilBERTAnalysis(
    model: any,
    texts: Array<any>,
    config: DistilBERTConfig
  ): Promise<Array<any>> {
    const results = [];
    
    // Batch işleme simülasyonu
    for (let i = 0; i < texts.length; i += config.batch_size) {
      const batch = texts.slice(i, i + config.batch_size);
      
      for (const item of batch) {
        // Mock DistilBERT prediction
        const sentiment = this.mockDistilBERTPrediction(item.processedText);
        results.push({
          ...item,
          sentiment,
        });
      }
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  private async runRoBERTaAnalysis(
    model: any,
    texts: Array<any>,
    config: RoBERTaConfig
  ): Promise<Array<any>> {
    const results = [];
    
    for (let i = 0; i < texts.length; i += config.batch_size) {
      const batch = texts.slice(i, i + config.batch_size);
      
      for (const item of batch) {
        const sentiment = this.mockRoBERTaPrediction(item.processedText);
        results.push({
          ...item,
          sentiment,
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return results;
  }

  private mockDistilBERTPrediction(text: string): any {
    // Mock DistilBERT sentiment prediction
    const positiveKeywords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect'];
    const negativeKeywords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible'];
    
    const words = text.toLowerCase().split(' ');
    let score = 0.5; // Neutral başlangıç
    
    for (const word of words) {
      if (positiveKeywords.includes(word)) score += 0.1;
      if (negativeKeywords.includes(word)) score -= 0.1;
    }
    
    score = Math.max(0, Math.min(1, score + (Math.random() - 0.5) * 0.2));
    
    return {
      score,
      confidence: 0.8 + Math.random() * 0.15,
      label: score > 0.6 ? 'POSITIVE' : score < 0.4 ? 'NEGATIVE' : 'NEUTRAL',
    };
  }

  private mockRoBERTaPrediction(text: string): any {
    // Mock RoBERTa prediction (similar to DistilBERT but slightly different)
    const sentiment = this.mockDistilBERTPrediction(text);
    
    return {
      ...sentiment,
      confidence: sentiment.confidence * 0.95, // RoBERTa typically more confident
      roberta_specific: true,
    };
  }

  private processSentimentResults(results: Array<any>, input: SentimentAnalysisInput): SentimentAnalysisResult {
    const totalResults = results.length;
    
    // Sentiment distribution hesapla
    const distribution = {
      veryPositive: { count: 0, percentage: 0 },
      positive: { count: 0, percentage: 0 },
      neutral: { count: 0, percentage: 0 },
      negative: { count: 0, percentage: 0 },
      veryNegative: { count: 0, percentage: 0 },
    };

    results.forEach(result => {
      const score = result.sentiment.score;
      if (score >= 0.8) distribution.veryPositive.count++;
      else if (score >= 0.6) distribution.positive.count++;
      else if (score >= 0.4) distribution.neutral.count++;
      else if (score >= 0.2) distribution.negative.count++;
      else distribution.veryNegative.count++;
    });

    // Percentages hesapla
    Object.keys(distribution).forEach(key => {
      distribution[key as keyof typeof distribution].percentage = 
        (distribution[key as keyof typeof distribution].count / totalResults) * 100;
    });

    // Overall sentiment
    const avgScore = results.reduce((sum, r) => sum + r.sentiment.score, 0) / totalResults;
    const overallSentiment = this.scoreToSentimentEnum(avgScore);
    
    // Confidence
    const avgConfidence = results.reduce((sum, r) => sum + r.sentiment.confidence, 0) / totalResults;

    // Insights ve recommendations
    const insights = this.generateInsights(distribution, avgScore);
    const recommendations = this.generateRecommendations(distribution, avgScore);

    return {
      overallSentiment,
      sentimentScore: avgScore,
      confidence: avgConfidence * 100,
      sentimentDistribution: distribution,
      insights,
      recommendations,
    };
  }

  private scoreToSentimentEnum(score: number): SentimentScore {
    if (score >= 0.8) return SentimentScore.VERY_POSITIVE;
    if (score >= 0.6) return SentimentScore.POSITIVE;
    if (score >= 0.4) return SentimentScore.NEUTRAL;
    if (score >= 0.2) return SentimentScore.NEGATIVE;
    return SentimentScore.VERY_NEGATIVE;
  }

  private async detectEmotions(text: string): Promise<Array<{
    emotion: EmotionType;
    score: number;
    confidence: number;
  }>> {
    // Mock emotion detection
    const emotions = [
      EmotionType.JOY, EmotionType.SADNESS, EmotionType.ANGER, 
      EmotionType.FEAR, EmotionType.SURPRISE, EmotionType.TRUST
    ];

    return emotions.map(emotion => ({
      emotion,
      score: Math.random(),
      confidence: 0.7 + Math.random() * 0.3,
    }));
  }

  private async extractAspectMentions(
    texts: Array<{ text: string; id: string }>,
    aspect: string
  ): Promise<Array<{ text: string; id: string }>> {
    // Aspect keywords mapping
    const aspectKeywords: { [key: string]: string[] } = {
      quality: ['quality', 'build', 'construction', 'material', 'durable', 'solid'],
      price: ['price', 'cost', 'expensive', 'cheap', 'value', 'money', 'worth'],
      shipping: ['shipping', 'delivery', 'fast', 'slow', 'arrived', 'package'],
      customer_service: ['service', 'support', 'help', 'staff', 'representative'],
      packaging: ['packaging', 'package', 'box', 'wrapped', 'protected'],
    };

    const keywords = aspectKeywords[aspect] || [aspect];
    
    return texts.filter(item => {
      const text = item.text.toLowerCase();
      return keywords.some(keyword => text.includes(keyword));
    });
  }

  private async analyzeAspectSentiment(mentions: Array<{ text: string; id: string }>): Promise<{
    sentiment: SentimentScore;
    score: number;
    confidence: number;
    keywords: string[];
  }> {
    // Mock aspect sentiment analysis
    const scores = mentions.map(mention => this.mockDistilBERTPrediction(mention.text).score);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    return {
      sentiment: this.scoreToSentimentEnum(avgScore),
      score: avgScore,
      confidence: 0.85,
      keywords: ['quality', 'good', 'excellent'], // Mock keywords
    };
  }

  private async getProductSentiment(asin: string): Promise<{
    score: number;
    confidence: number;
    sampleSize: number;
  }> {
    // Mock product sentiment retrieval
    return {
      score: 0.6 + Math.random() * 0.3,
      confidence: 0.8 + Math.random() * 0.15,
      sampleSize: Math.floor(Math.random() * 1000) + 100,
    };
  }

  private generateCompetitorRecommendations(
    position: 'leading' | 'competitive' | 'lagging',
    ourSentiment: number,
    marketAverage: number
  ): string[] {
    const recommendations = [];
    
    if (position === 'lagging') {
      recommendations.push('Conduct detailed competitor analysis to identify improvement areas');
      recommendations.push('Focus on addressing negative feedback themes');
      recommendations.push('Implement customer feedback collection and response system');
    } else if (position === 'competitive') {
      recommendations.push('Identify and amplify positive differentiators');
      recommendations.push('Monitor competitor strategies closely');
    } else {
      recommendations.push('Maintain current excellence and monitor for threats');
      recommendations.push('Use positive sentiment as marketing advantage');
    }
    
    return recommendations;
  }

  private calculateSentimentTrend(analyses: SentimentAnalysis[]): 'improving' | 'stable' | 'declining' {
    if (analyses.length < 3) return 'stable';
    
    const recent = analyses.slice(0, 3).map(a => a.sentimentScore);
    const slope = (recent[0] - recent[2]) / 2; // Simple slope calculation
    
    if (slope > 0.05) return 'improving';
    if (slope < -0.05) return 'declining';
    return 'stable';
  }

  private assessRiskLevel(analyses: SentimentAnalysis[]): 'low' | 'medium' | 'high' {
    if (analyses.length === 0) return 'medium';
    
    const latest = analyses[0];
    const negativePercentage = latest.getNegativePercentage();
    
    if (negativePercentage > 30) return 'high';
    if (negativePercentage > 15) return 'medium';
    return 'low';
  }

  private generateInsights(distribution: any, avgScore: number): string[] {
    const insights = [];
    
    if (avgScore > 0.7) {
      insights.push('Strong positive sentiment detected');
    } else if (avgScore < 0.4) {
      insights.push('Concerning negative sentiment requires attention');
    }
    
    if (distribution.veryNegative.percentage > 10) {
      insights.push('High percentage of very negative feedback');
    }
    
    if (distribution.neutral.percentage > 50) {
      insights.push('High neutral sentiment suggests lack of strong opinions');
    }
    
    return insights;
  }

  private generateRecommendations(distribution: any, avgScore: number): string[] {
    const recommendations = [];
    
    if (avgScore < 0.5) {
      recommendations.push('Immediate action required to address negative sentiment');
      recommendations.push('Analyze negative feedback for common themes');
    }
    
    if (distribution.negative.percentage > 20) {
      recommendations.push('Implement systematic response to negative reviews');
    }
    
    if (distribution.positive.percentage > 60) {
      recommendations.push('Leverage positive sentiment in marketing campaigns');
    }
    
    return recommendations;
  }

  private async saveSentimentAnalysis(
    userId: string,
    input: SentimentAnalysisInput,
    result: SentimentAnalysisResult,
    modelType: ModelType
  ): Promise<SentimentAnalysis> {
    const analysis = this.sentimentAnalysisRepository.create({
      userId,
      analysisSource: input.analysisSource,
      analysisDate: new Date(),
      dataPeriodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      dataPeriodEnd: new Date(),
      overallSentiment: result.overallSentiment,
      sentimentScore: result.sentimentScore,
      confidence: result.confidence,
      totalSamples: input.texts.length,
      sentimentDistribution: result.sentimentDistribution,
      aspectSentiments: result.aspectSentiments,
      businessInsights: {
        strengths: [],
        weaknesses: [],
        opportunities: [],
        threats: [],
      },
    });

    return this.sentimentAnalysisRepository.save(analysis);
  }
}