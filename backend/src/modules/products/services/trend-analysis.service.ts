import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { TrendAnalysis } from '../entities/trend-analysis.entity';
import { Category } from '../entities/category.entity';

export interface TrendInsight {
  keyword: string;
  category?: string;
  currentScore: number;
  historicalData: Array<{
    date: Date;
    score: number;
  }>;
  seasonalPattern: {
    peakMonths: string[];
    lowMonths: string[];
    volatility: number;
  };
  forecast: Array<{
    date: Date;
    predictedScore: number;
    confidence: number;
  }>;
  recommendations: string[];
}

export interface SeasonalTrend {
  keyword: string;
  monthlyData: Array<{
    month: string;
    score: number;
    year: number;
  }>;
  peakSeason: {
    months: string[];
    averageIncrease: number;
  };
  lowSeason: {
    months: string[];
    averageDecrease: number;
  };
  yearOverYearGrowth: number;
}

export interface CompetitiveAnalysis {
  keyword: string;
  competitionLevel: 'low' | 'medium' | 'high';
  topCompetitors: Array<{
    domain: string;
    rank: number;
    relevanceScore: number;
  }>;
  gapOpportunities: Array<{
    relatedKeyword: string;
    difficulty: number;
    volume: number;
    opportunity: number;
  }>;
  marketSaturation: number;
}

@Injectable()
export class TrendAnalysisService {
  private readonly logger = new Logger(TrendAnalysisService.name);

  constructor(
    @InjectRepository(TrendAnalysis)
    private readonly trendRepository: Repository<TrendAnalysis>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Anahtar kelime trend analizi yap
   */
  async analyzeKeywordTrend(keyword: string, categoryId?: string): Promise<TrendAnalysis> {
    try {
      this.logger.log(`Analyzing trend for keyword: ${keyword}`);

      // Mevcut analizi kontrol et (bugün yapılmış mı?)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let existingAnalysis = await this.trendRepository.findOne({
        where: {
          keyword,
          categoryId,
          analyzedDate: MoreThan(today),
        },
      });

      if (existingAnalysis) {
        this.logger.log(`Using existing trend analysis for: ${keyword}`);
        return existingAnalysis;
      }

      // Yeni analiz yap
      const [googleTrendsData, amazonSearchData, competitionData] = await Promise.all([
        this.getGoogleTrendsData(keyword),
        this.getAmazonSearchVolume(keyword),
        this.analyzeCompetition(keyword),
      ]);

      // Analiz oluştur
      const analysis = this.trendRepository.create({
        keyword,
        categoryId,
        googleTrendsScore: googleTrendsData.score,
        amazonSearchVolume: amazonSearchData.volume,
        trendingDirection: this.determineTrendDirection(googleTrendsData.timelineData),
        seasonalityScore: this.calculateSeasonality(googleTrendsData.timelineData),
        competitionLevel: competitionData.level,
        relatedKeywords: googleTrendsData.relatedQueries,
        trendData: {
          timelineData: googleTrendsData.timelineData,
          peakMonths: this.identifyPeakMonths(googleTrendsData.timelineData),
          growthRate: this.calculateGrowthRate(googleTrendsData.timelineData),
          volatility: this.calculateVolatility(googleTrendsData.timelineData),
        },
        competitorData: {
          topProducts: competitionData.topProducts,
          avgPrice: competitionData.avgPrice,
          priceRange: competitionData.priceRange,
        },
        analyzedDate: new Date(),
      });

      // Fırsat skoru hesapla
      analysis.updateOpportunityScore();

      const savedAnalysis = await this.trendRepository.save(analysis);

      this.logger.log(`Trend analysis completed for: ${keyword}`);
      return savedAnalysis;
    } catch (error) {
      this.logger.error(`Error analyzing trend for ${keyword}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Çoklu anahtar kelime karşılaştırması
   */
  async compareKeywords(keywords: string[], categoryId?: string): Promise<{
    comparison: Array<{
      keyword: string;
      score: number;
      trend: 'up' | 'down' | 'stable';
      opportunity: number;
      competition: 'low' | 'medium' | 'high';
    }>;
    winner: {
      keyword: string;
      reason: string[];
    };
    recommendations: string[];
  }> {
    try {
      this.logger.log(`Comparing keywords: ${keywords.join(', ')}`);

      const analyses = await Promise.all(
        keywords.map(keyword => this.analyzeKeywordTrend(keyword, categoryId))
      );

      const comparison = analyses.map(analysis => ({
        keyword: analysis.keyword,
        score: analysis.googleTrendsScore || 0,
        trend: analysis.trendingDirection || 'stable',
        opportunity: analysis.opportunityScore || 0,
        competition: analysis.competitionLevel || 'medium',
      }));

      // En iyi anahtar kelimeyi belirle
      const winner = this.determineWinnerKeyword(comparison);

      // Öneriler oluştur
      const recommendations = this.generateKeywordRecommendations(comparison);

      return {
        comparison,
        winner,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Error comparing keywords: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mevsimsel trend analizi
   */
  async analyzeSeasonalTrends(keyword: string, years: number = 2): Promise<SeasonalTrend> {
    try {
      this.logger.log(`Analyzing seasonal trends for: ${keyword}`);

      // Son 2 yıl verisini al
      const endDate = new Date();
      const startDate = new Date();
      startDate.setFullYear(endDate.getFullYear() - years);

      const historicalData = await this.trendRepository.find({
        where: {
          keyword,
          analyzedDate: Between(startDate, endDate),
        },
        order: { analyzedDate: 'ASC' },
      });

      // Aylık veriye grup
      const monthlyData = this.groupByMonth(historicalData);

      // Pik sezonları belirle
      const peakSeason = this.identifyPeakSeason(monthlyData);
      const lowSeason = this.identifyLowSeason(monthlyData);

      // Yıllık büyüme hesapla
      const yearOverYearGrowth = this.calculateYearOverYearGrowth(monthlyData);

      return {
        keyword,
        monthlyData,
        peakSeason,
        lowSeason,
        yearOverYearGrowth,
      };
    } catch (error) {
      this.logger.error(`Error analyzing seasonal trends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detaylı trend içgörüleri
   */
  async getTrendInsights(keyword: string, categoryId?: string): Promise<TrendInsight> {
    try {
      this.logger.log(`Getting trend insights for: ${keyword}`);

      // Mevcut analizi al
      const currentAnalysis = await this.analyzeKeywordTrend(keyword, categoryId);

      // Geçmiş verileri al (son 6 ay)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const historicalData = await this.trendRepository.find({
        where: {
          keyword,
          analyzedDate: MoreThan(sixMonthsAgo),
        },
        order: { analyzedDate: 'ASC' },
      });

      // Mevsimsel pattern analizi
      const seasonalPattern = this.analyzeSeasonalPattern(historicalData);

      // Gelecek tahmini (3 ay)
      const forecast = this.generateForecast(historicalData, 3);

      // Öneriler oluştur
      const recommendations = this.generateTrendRecommendations(currentAnalysis, seasonalPattern);

      return {
        keyword,
        category: categoryId,
        currentScore: currentAnalysis.googleTrendsScore || 0,
        historicalData: historicalData.map(data => ({
          date: data.analyzedDate,
          score: data.googleTrendsScore || 0,
        })),
        seasonalPattern,
        forecast,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Error getting trend insights: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kategori trend analizi
   */
  async analyzeCategoryTrends(categoryId: string): Promise<{
    category: string;
    overallTrend: 'up' | 'down' | 'stable';
    topKeywords: Array<{
      keyword: string;
      score: number;
      change: number;
    }>;
    emergingKeywords: Array<{
      keyword: string;
      growthRate: number;
    }>;
    decliningKeywords: Array<{
      keyword: string;
      declineRate: number;
    }>;
    seasonalPatterns: {
      peakMonths: string[];
      lowMonths: string[];
    };
  }> {
    try {
      this.logger.log(`Analyzing category trends for: ${categoryId}`);

      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new Error('Kategori bulunamadı');
      }

      // Kategoriye ait trend verilerini al
      const categoryTrends = await this.trendRepository.find({
        where: { categoryId },
        order: { analyzedDate: 'DESC' },
      });

      // Genel trend yönünü belirle
      const overallTrend = this.determineCategoryTrend(categoryTrends);

      // Top keywords
      const topKeywords = this.getTopKeywords(categoryTrends);

      // Yükselen keywords
      const emergingKeywords = this.getEmergingKeywords(categoryTrends);

      // Düşen keywords
      const decliningKeywords = this.getDecliningKeywords(categoryTrends);

      // Mevsimsel patternler
      const seasonalPatterns = this.getCategorySeasonalPatterns(categoryTrends);

      return {
        category: category.name,
        overallTrend,
        topKeywords,
        emergingKeywords,
        decliningKeywords,
        seasonalPatterns,
      };
    } catch (error) {
      this.logger.error(`Error analyzing category trends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rakip analizi
   */
  async analyzeCompetitiveKeywords(baseKeyword: string): Promise<CompetitiveAnalysis> {
    try {
      this.logger.log(`Analyzing competitive keywords for: ${baseKeyword}`);

      // Rekabet seviyesini analiz et
      const competitionLevel = await this.determineCompetitionLevel(baseKeyword);

      // Top rekabet edenleri bul
      const topCompetitors = await this.getTopCompetitors(baseKeyword);

      // Fırsat boşluklarını belirle
      const gapOpportunities = await this.identifyGapOpportunities(baseKeyword);

      // Pazar doygunluğu
      const marketSaturation = await this.calculateMarketSaturation(baseKeyword);

      return {
        keyword: baseKeyword,
        competitionLevel,
        topCompetitors,
        gapOpportunities,
        marketSaturation,
      };
    } catch (error) {
      this.logger.error(`Error analyzing competitive keywords: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private async getGoogleTrendsData(keyword: string): Promise<{
    score: number;
    timelineData: Array<{ date: string; value: number }>;
    relatedQueries: string[];
  }> {
    try {
      // Google Trends API entegrasyonu (pytrends kullanılabilir)
      // Şimdilik simüle ediyoruz
      const timelineData = this.generateMockTimelineData();
      const score = timelineData[timelineData.length - 1]?.value || 50;
      
      return {
        score,
        timelineData,
        relatedQueries: [
          `${keyword} best`,
          `${keyword} review`,
          `${keyword} price`,
          `${keyword} buy`,
        ],
      };
    } catch (error) {
      this.logger.warn(`Google Trends API error: ${error.message}`);
      return {
        score: 50,
        timelineData: [],
        relatedQueries: [],
      };
    }
  }

  private async getAmazonSearchVolume(keyword: string): Promise<{
    volume: number;
    relatedTerms: string[];
  }> {
    try {
      // Amazon search suggest API veya üçüncü parti tool
      // Şimdilik tahmin ediyoruz
      const baseVolume = keyword.length > 10 ? 1000 : 5000;
      const randomFactor = Math.random() * 0.5 + 0.75; // 0.75-1.25 arası
      
      return {
        volume: Math.round(baseVolume * randomFactor),
        relatedTerms: [],
      };
    } catch (error) {
      this.logger.warn(`Amazon search volume error: ${error.message}`);
      return { volume: 1000, relatedTerms: [] };
    }
  }

  private async analyzeCompetition(keyword: string): Promise<{
    level: 'low' | 'medium' | 'high';
    topProducts: any[];
    avgPrice: number;
    priceRange: { min: number; max: number };
  }> {
    try {
      // Amazon arama yaparak rekabeti analiz et
      // Şimdilik mock data
      const levels = ['low', 'medium', 'high'] as const;
      const level = levels[Math.floor(Math.random() * levels.length)];
      
      return {
        level,
        topProducts: [],
        avgPrice: 50,
        priceRange: { min: 20, max: 100 },
      };
    } catch (error) {
      return {
        level: 'medium',
        topProducts: [],
        avgPrice: 50,
        priceRange: { min: 20, max: 100 },
      };
    }
  }

  private determineTrendDirection(timelineData: Array<{ date: string; value: number }>): 'up' | 'down' | 'stable' {
    if (timelineData.length < 2) return 'stable';

    const recent = timelineData.slice(-6); // Son 6 veri noktası
    const oldData = timelineData.slice(0, 6); // İlk 6 veri noktası

    const recentAvg = recent.reduce((sum, item) => sum + item.value, 0) / recent.length;
    const oldAvg = oldData.reduce((sum, item) => sum + item.value, 0) / oldData.length;

    const change = (recentAvg - oldAvg) / oldAvg;

    if (change > 0.1) return 'up';
    if (change < -0.1) return 'down';
    return 'stable';
  }

  private calculateSeasonality(timelineData: Array<{ date: string; value: number }>): number {
    if (timelineData.length < 12) return 0;

    // Aylık veriye grupla ve varyansı hesapla
    const monthlyAverages = new Array(12).fill(0);
    const monthCounts = new Array(12).fill(0);

    timelineData.forEach(data => {
      const month = new Date(data.date).getMonth();
      monthlyAverages[month] += data.value;
      monthCounts[month]++;
    });

    for (let i = 0; i < 12; i++) {
      if (monthCounts[i] > 0) {
        monthlyAverages[i] /= monthCounts[i];
      }
    }

    // Coefficient of variation hesapla
    const mean = monthlyAverages.reduce((sum, val) => sum + val, 0) / 12;
    const variance = monthlyAverages.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / 12;
    const stdDev = Math.sqrt(variance);

    return mean > 0 ? stdDev / mean : 0;
  }

  private identifyPeakMonths(timelineData: Array<{ date: string; value: number }>): string[] {
    const monthData = new Map<string, number[]>();

    timelineData.forEach(data => {
      const date = new Date(data.date);
      const monthKey = date.toLocaleString('default', { month: 'long' });
      
      if (!monthData.has(monthKey)) {
        monthData.set(monthKey, []);
      }
      monthData.get(monthKey)!.push(data.value);
    });

    const monthAverages = new Map<string, number>();
    monthData.forEach((values, month) => {
      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      monthAverages.set(month, avg);
    });

    const allAverages = Array.from(monthAverages.values());
    const threshold = allAverages.reduce((sum, val) => sum + val, 0) / allAverages.length * 1.2;

    return Array.from(monthAverages.entries())
      .filter(([, avg]) => avg > threshold)
      .map(([month]) => month);
  }

  private calculateGrowthRate(timelineData: Array<{ date: string; value: number }>): number {
    if (timelineData.length < 2) return 0;

    const first = timelineData[0].value;
    const last = timelineData[timelineData.length - 1].value;

    return first > 0 ? ((last - first) / first) * 100 : 0;
  }

  private calculateVolatility(timelineData: Array<{ date: string; value: number }>): number {
    if (timelineData.length < 2) return 0;

    const values = timelineData.map(data => data.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

    return Math.sqrt(variance);
  }

  private generateMockTimelineData(): Array<{ date: string; value: number }> {
    const data = [];
    const now = new Date();
    
    for (let i = 12; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      
      const baseValue = 50;
      const trend = (12 - i) * 2; // Genel yükselme trendi
      const seasonality = Math.sin((date.getMonth() / 12) * 2 * Math.PI) * 15; // Mevsimsel dalgalanma
      const noise = (Math.random() - 0.5) * 10; // Rastgele gürültü
      
      const value = Math.max(0, Math.min(100, baseValue + trend + seasonality + noise));
      
      data.push({
        date: date.toISOString().split('T')[0],
        value: Math.round(value),
      });
    }
    
    return data;
  }

  private determineWinnerKeyword(comparison: any[]): { keyword: string; reason: string[] } {
    let winner = comparison[0];
    let maxScore = 0;

    comparison.forEach(item => {
      let score = 0;
      const reasons: string[] = [];

      // Fırsat skoru ağırlık
      score += item.opportunity * 0.4;
      if (item.opportunity > 70) reasons.push('Yüksek fırsat skoru');

      // Trend yönü ağırlık
      if (item.trend === 'up') {
        score += 30;
        reasons.push('Yükselen trend');
      } else if (item.trend === 'stable') {
        score += 15;
      }

      // Rekabet seviyesi ağırlık (ters orantılı)
      if (item.competition === 'low') {
        score += 20;
        reasons.push('Düşük rekabet');
      } else if (item.competition === 'medium') {
        score += 10;
      }

      // Google Trends skoru ağırlık
      score += item.score * 0.1;

      if (score > maxScore) {
        maxScore = score;
        winner = { ...item, reason: reasons };
      }
    });

    return {
      keyword: winner.keyword,
      reason: winner.reason || ['Genel performans']
    };
  }

  private generateKeywordRecommendations(comparison: any[]): string[] {
    const recommendations: string[] = [];

    const upTrending = comparison.filter(item => item.trend === 'up');
    const lowCompetition = comparison.filter(item => item.competition === 'low');
    const highOpportunity = comparison.filter(item => item.opportunity > 70);

    if (upTrending.length > 0) {
      recommendations.push(`${upTrending.length} adet yükselen trend kelimesi mevcut`);
    }

    if (lowCompetition.length > 0) {
      recommendations.push(`${lowCompetition.length} adet düşük rekabetli kelime fırsatı var`);
    }

    if (highOpportunity.length > 0) {
      recommendations.push(`${highOpportunity.length} adet yüksek fırsat potansiyeli olan kelime`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Daha detaylı araştırma yapmanız önerilir');
    }

    return recommendations;
  }

  private groupByMonth(data: TrendAnalysis[]): Array<{
    month: string;
    score: number;
    year: number;
  }> {
    const monthlyData: Array<{ month: string; score: number; year: number }> = [];

    data.forEach(item => {
      const date = new Date(item.analyzedDate);
      monthlyData.push({
        month: date.toLocaleString('default', { month: 'long' }),
        score: item.googleTrendsScore || 0,
        year: date.getFullYear(),
      });
    });

    return monthlyData;
  }

  private identifyPeakSeason(monthlyData: Array<{ month: string; score: number; year: number }>): {
    months: string[];
    averageIncrease: number;
  } {
    // Mock implementation
    return {
      months: ['December', 'January'],
      averageIncrease: 25,
    };
  }

  private identifyLowSeason(monthlyData: Array<{ month: string; score: number; year: number }>): {
    months: string[];
    averageDecrease: number;
  } {
    // Mock implementation
    return {
      months: ['June', 'July'],
      averageDecrease: -15,
    };
  }

  private calculateYearOverYearGrowth(monthlyData: Array<{ month: string; score: number; year: number }>): number {
    // Mock implementation
    return Math.random() * 20 - 10; // -10% ile +10% arası
  }

  private analyzeSeasonalPattern(data: TrendAnalysis[]): {
    peakMonths: string[];
    lowMonths: string[];
    volatility: number;
  } {
    // Mock implementation
    return {
      peakMonths: ['December', 'January'],
      lowMonths: ['June', 'July'],
      volatility: 0.3,
    };
  }

  private generateForecast(data: TrendAnalysis[], months: number): Array<{
    date: Date;
    predictedScore: number;
    confidence: number;
  }> {
    const forecast = [];
    const now = new Date();

    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(now);
      futureDate.setMonth(futureDate.getMonth() + i);

      forecast.push({
        date: futureDate,
        predictedScore: Math.random() * 100,
        confidence: Math.random() * 0.4 + 0.6, // 0.6-1.0 arası
      });
    }

    return forecast;
  }

  private generateTrendRecommendations(analysis: TrendAnalysis, seasonalPattern: any): string[] {
    const recommendations: string[] = [];

    if (analysis.trendingDirection === 'up') {
      recommendations.push('Trend yükselişte - şimdi yatırım yapın');
    }

    if (analysis.competitionLevel === 'low') {
      recommendations.push('Düşük rekabet - hızlı giriş fırsatı');
    }

    if (analysis.opportunityScore && analysis.opportunityScore > 70) {
      recommendations.push('Yüksek fırsat skoru - öncelikli hedef');
    }

    return recommendations;
  }

  private determineCategoryTrend(trends: TrendAnalysis[]): 'up' | 'down' | 'stable' {
    // Mock implementation
    const directions = ['up', 'down', 'stable'] as const;
    return directions[Math.floor(Math.random() * directions.length)];
  }

  private getTopKeywords(trends: TrendAnalysis[]): Array<{ keyword: string; score: number; change: number }> {
    return trends.slice(0, 10).map(trend => ({
      keyword: trend.keyword,
      score: trend.googleTrendsScore || 0,
      change: Math.random() * 20 - 10,
    }));
  }

  private getEmergingKeywords(trends: TrendAnalysis[]): Array<{ keyword: string; growthRate: number }> {
    return trends.slice(0, 5).map(trend => ({
      keyword: trend.keyword,
      growthRate: Math.random() * 50 + 10,
    }));
  }

  private getDecliningKeywords(trends: TrendAnalysis[]): Array<{ keyword: string; declineRate: number }> {
    return trends.slice(0, 5).map(trend => ({
      keyword: trend.keyword,
      declineRate: -(Math.random() * 30 + 5),
    }));
  }

  private getCategorySeasonalPatterns(trends: TrendAnalysis[]): {
    peakMonths: string[];
    lowMonths: string[];
  } {
    return {
      peakMonths: ['December', 'January'],
      lowMonths: ['June', 'July'],
    };
  }

  private async determineCompetitionLevel(keyword: string): Promise<'low' | 'medium' | 'high'> {
    const levels = ['low', 'medium', 'high'] as const;
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private async getTopCompetitors(keyword: string): Promise<Array<{
    domain: string;
    rank: number;
    relevanceScore: number;
  }>> {
    return [
      { domain: 'amazon.com', rank: 1, relevanceScore: 95 },
      { domain: 'ebay.com', rank: 2, relevanceScore: 85 },
      { domain: 'walmart.com', rank: 3, relevanceScore: 80 },
    ];
  }

  private async identifyGapOpportunities(keyword: string): Promise<Array<{
    relatedKeyword: string;
    difficulty: number;
    volume: number;
    opportunity: number;
  }>> {
    return [
      {
        relatedKeyword: `${keyword} cheap`,
        difficulty: 30,
        volume: 1000,
        opportunity: 75,
      },
    ];
  }

  private async calculateMarketSaturation(keyword: string): Promise<number> {
    return Math.random() * 100;
  }
}