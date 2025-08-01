import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';

import { Category } from '../entities/category.entity';
import { Product } from '../entities/product.entity';
import { TrendAnalysis } from '../entities/trend-analysis.entity';
import { AmazonApiService } from '../../amazon-api/amazon-api.service';

export interface CategoryInsight {
  id: string;
  name: string;
  productCount: number;
  averagePrice: number;
  priceRange: { min: number; max: number };
  averageRating: number;
  competitionLevel: 'low' | 'medium' | 'high';
  opportunityScore: number;
  trendScore: number;
  topBrands: string[];
  topKeywords: string[];
  seasonalTrends: {
    peakMonths: string[];
    lowMonths: string[];
  };
  growthRate: number;
  profitMargin: {
    average: number;
    range: { min: number; max: number };
  };
  barriers: {
    entry: 'low' | 'medium' | 'high';
    capital: number;
    expertise: 'low' | 'medium' | 'high';
  };
  recommendations: string[];
}

export interface CategoryComparison {
  categories: Array<{
    name: string;
    opportunityScore: number;
    competitionLevel: 'low' | 'medium' | 'high';
    averagePrice: number;
    growthRate: number;
    profitPotential: number;
  }>;
  winner: {
    category: string;
    reasons: string[];
  };
  recommendations: string[];
}

export interface NicheOpportunity {
  category: string;
  subNiche: string;
  keywords: string[];
  competitorCount: number;
  averagePrice: number;
  searchVolume: number;
  difficulty: number;
  opportunityScore: number;
  estimatedRevenue: number;
  timeToMarket: number; // ay cinsinden
  requirements: {
    minimumCapital: number;
    expertise: string[];
    timeInvestment: string;
  };
  risks: string[];
  advantages: string[];
}

@Injectable()
export class CategoryAnalysisService {
  private readonly logger = new Logger(CategoryAnalysisService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(TrendAnalysis)
    private readonly trendAnalysisRepository: Repository<TrendAnalysis>,
    private readonly amazonApiService: AmazonApiService,
  ) {}

  /**
   * Kategori detaylı analizi
   */
  async analyzeCategory(categoryId: string): Promise<CategoryInsight> {
    try {
      this.logger.log(`Analyzing category: ${categoryId}`);

      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
        relations: ['children'],
      });

      if (!category) {
        throw new Error('Kategori bulunamadı');
      }

      // Kategorideki ürünleri al
      const products = await this.productRepository.find({
        where: { 
          categoryId,
          isActive: true 
        },
      });

      // Trend verilerini al
      const trendData = await this.trendAnalysisRepository.find({
        where: { categoryId },
        order: { analyzedDate: 'DESC' },
        take: 30, // Son 30 analiz
      });

      // Temel metrikleri hesapla
      const basicMetrics = this.calculateBasicMetrics(products);

      // Rekabet seviyesi
      const competitionLevel = await this.analyzeCompetitionLevel(categoryId, products);

      // Fırsat skoru
      const opportunityScore = this.calculateOpportunityScore(products, trendData);

      // Trend skoru
      const trendScore = this.calculateTrendScore(trendData);

      // Top markalar ve keywordler
      const topBrands = this.extractTopBrands(products);
      const topKeywords = this.extractTopKeywords(trendData);

      // Mevsimsel trendler
      const seasonalTrends = this.analyzeSeasonalTrends(trendData);

      // Büyüme oranı
      const growthRate = this.calculateGrowthRate(trendData);

      // Kâr marjı analizi
      const profitMargin = this.analyzeProfitMargin(products);

      // Giriş engelleri
      const barriers = this.analyzeBarriers(category, products);

      // Öneriler
      const recommendations = this.generateRecommendations(
        category,
        { opportunityScore, competitionLevel, growthRate, profitMargin }
      );

      const insight: CategoryInsight = {
        id: category.id,
        name: category.name,
        productCount: products.length,
        averagePrice: basicMetrics.averagePrice,
        priceRange: basicMetrics.priceRange,
        averageRating: basicMetrics.averageRating,
        competitionLevel,
        opportunityScore,
        trendScore,
        topBrands,
        topKeywords,
        seasonalTrends,
        growthRate,
        profitMargin,
        barriers,
        recommendations,
      };

      // Kategori istatistiklerini güncelle
      await this.updateCategoryStats(category, insight);

      this.logger.log(`Category analysis completed: ${categoryId}`);
      return insight;
    } catch (error) {
      this.logger.error(`Error analyzing category ${categoryId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Çoklu kategori karşılaştırması
   */
  async compareCategories(categoryIds: string[]): Promise<CategoryComparison> {
    try {
      this.logger.log(`Comparing ${categoryIds.length} categories`);

      const analyses = await Promise.all(
        categoryIds.map(id => this.analyzeCategory(id))
      );

      const categories = analyses.map(analysis => ({
        name: analysis.name,
        opportunityScore: analysis.opportunityScore,
        competitionLevel: analysis.competitionLevel,
        averagePrice: analysis.averagePrice,
        growthRate: analysis.growthRate,
        profitPotential: this.calculateProfitPotential(analysis),
      }));

      // En iyi kategoriyi belirle
      const winner = this.determineWinnerCategory(categories);

      // Genel öneriler
      const recommendations = this.generateComparisonRecommendations(categories);

      return {
        categories,
        winner,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Error comparing categories: ${error.message}`);
      throw error;
    }
  }

  /**
   * Niş fırsatları bul
   */
  async findNicheOpportunities(categoryId: string): Promise<NicheOpportunity[]> {
    try {
      this.logger.log(`Finding niche opportunities in category: ${categoryId}`);

      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new Error('Kategori bulunamadı');
      }

      // Alt kategorileri ve trendleri analiz et
      const trendData = await this.trendAnalysisRepository.find({
        where: { categoryId },
        order: { opportunityScore: 'DESC' },
        take: 50,
      });

      const opportunities: NicheOpportunity[] = [];

      for (const trend of trendData) {
        if (trend.opportunityScore && trend.opportunityScore >= 60) {
          const niche = await this.analyzeNicheOpportunity(category, trend);
          if (niche) {
            opportunities.push(niche);
          }
        }
      }

      // Skorlara göre sırala
      opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

      this.logger.log(`Found ${opportunities.length} niche opportunities`);
      return opportunities.slice(0, 10); // En iyi 10 fırsat
    } catch (error) {
      this.logger.error(`Error finding niche opportunities: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kategori trend analizi
   */
  async analyzeCategoryTrends(categoryId: string, months: number = 12): Promise<{
    category: string;
    overallTrend: 'up' | 'down' | 'stable';
    monthlyData: Array<{
      month: string;
      year: number;
      score: number;
      searchVolume: number;
      competitionLevel: number;
    }>;
    seasonalPattern: {
      peakMonths: Array<{ month: string; score: number }>;
      lowMonths: Array<{ month: string; score: number }>;
      volatility: number;
    };
    forecast: Array<{
      month: string;
      year: number;
      predictedScore: number;
      confidence: number;
    }>;
    insights: string[];
  }> {
    try {
      this.logger.log(`Analyzing category trends: ${categoryId}`);

      const category = await this.categoryRepository.findOne({
        where: { id: categoryId },
      });

      if (!category) {
        throw new Error('Kategori bulunamadı');
      }

      // Son X ay verilerini al
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      const trendData = await this.trendAnalysisRepository.find({
        where: {
          categoryId,
          analyzedDate: MoreThan(startDate),
        },
        order: { analyzedDate: 'ASC' },
      });

      // Genel trend yönü
      const overallTrend = this.determineOverallTrend(trendData);

      // Aylık data
      const monthlyData = this.aggregateMonthlyData(trendData);

      // Mevsimsel pattern
      const seasonalPattern = this.analyzeDetailedSeasonalPattern(monthlyData);

      // Gelecek tahmini
      const forecast = this.generateTrendForecast(monthlyData, 6);

      // İçgörüler
      const insights = this.generateTrendInsights(overallTrend, seasonalPattern, monthlyData);

      return {
        category: category.name,
        overallTrend,
        monthlyData,
        seasonalPattern,
        forecast,
        insights,
      };
    } catch (error) {
      this.logger.error(`Error analyzing category trends: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rekabet analizi
   */
  async analyzeCompetition(categoryId: string): Promise<{
    competitionLevel: 'low' | 'medium' | 'high';
    competitorCount: number;
    topCompetitors: Array<{
      name: string;
      marketShare: number;
      avgPrice: number;
      productCount: number;
      strength: 'weak' | 'moderate' | 'strong';
    }>;
    competitiveGaps: Array<{
      opportunity: string;
      difficulty: 'low' | 'medium' | 'high';
      potentialRevenue: number;
    }>;
    marketSaturation: number;
    barrierToEntry: {
      level: 'low' | 'medium' | 'high';
      factors: string[];
    };
    strategies: string[];
  }> {
    try {
      this.logger.log(`Analyzing competition for category: ${categoryId}`);

      const products = await this.productRepository.find({
        where: { categoryId, isActive: true },
      });

      // Rekabet seviyesi
      const competitionLevel = await this.analyzeCompetitionLevel(categoryId, products);

      // Top markalar (rakipler)
      const brandAnalysis = this.analyzeBrandCompetition(products);

      // Rakip boşlukları
      const competitiveGaps = await this.identifyCompetitiveGaps(categoryId);

      // Pazar doygunluğu
      const marketSaturation = this.calculateMarketSaturation(products);

      // Giriş engelleri
      const barrierToEntry = this.analyzeEntryBarriers(products);

      // Rekabet stratejileri
      const strategies = this.generateCompetitiveStrategies(competitionLevel, brandAnalysis);

      return {
        competitionLevel,
        competitorCount: brandAnalysis.length,
        topCompetitors: brandAnalysis,
        competitiveGaps,
        marketSaturation,
        barrierToEntry,
        strategies,
      };
    } catch (error) {
      this.logger.error(`Error analyzing competition: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private calculateBasicMetrics(products: Product[]): {
    averagePrice: number;
    priceRange: { min: number; max: number };
    averageRating: number;
  } {
    const prices = products.map(p => p.price || 0).filter(p => p > 0);
    const ratings = products.map(p => p.reviewAverage).filter(r => r > 0);

    return {
      averagePrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      priceRange: {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
      },
      averageRating: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0,
    };
  }

  private async analyzeCompetitionLevel(categoryId: string, products: Product[]): Promise<'low' | 'medium' | 'high'> {
    let competitionScore = 0;

    // Ürün yoğunluğu
    if (products.length > 1000) competitionScore += 30;
    else if (products.length > 500) competitionScore += 20;
    else if (products.length > 100) competitionScore += 10;

    // Marka çeşitliliği
    const uniqueBrands = new Set(products.map(p => p.brand).filter(Boolean));
    if (uniqueBrands.size > 50) competitionScore += 20;
    else if (uniqueBrands.size > 20) competitionScore += 15;
    else if (uniqueBrands.size > 10) competitionScore += 10;

    // Ortalama review sayısı
    const avgReviews = products.reduce((sum, p) => sum + p.reviewCount, 0) / products.length;
    if (avgReviews > 500) competitionScore += 25;
    else if (avgReviews > 100) competitionScore += 15;
    else if (avgReviews > 50) competitionScore += 10;

    // Fiyat rekabeti
    const prices = products.map(p => p.price || 0).filter(p => p > 0);
    if (prices.length > 0) {
      const priceStdDev = this.calculateStandardDeviation(prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      const coefficient = priceStdDev / avgPrice;
      
      if (coefficient < 0.2) competitionScore += 15; // Fiyat savaşı
    }

    if (competitionScore >= 60) return 'high';
    if (competitionScore >= 30) return 'medium';
    return 'low';
  }

  private calculateOpportunityScore(products: Product[], trendData: TrendAnalysis[]): number {
    let score = 50; // Base score

    // Trend momentum
    const recentTrends = trendData.slice(0, 10);
    const upTrendCount = recentTrends.filter(t => t.trendingDirection === 'up').length;
    score += (upTrendCount / recentTrends.length) * 30;

    // Fiyat fırsatları
    const avgPrice = products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length;
    if (avgPrice > 50) score += 10; // Yüksek değerli ürünler
    if (avgPrice < 20) score += 5; // Erişilebilir fiyatlar

    // Review kalitesi
    const lowRatedProducts = products.filter(p => p.reviewAverage < 3.5).length;
    const improvementOpportunity = (lowRatedProducts / products.length) * 20;
    score += improvementOpportunity;

    return Math.min(Math.max(score, 0), 100);
  }

  private calculateTrendScore(trendData: TrendAnalysis[]): number {
    if (trendData.length === 0) return 50;

    const avgOpportunityScore = trendData.reduce((sum, t) => sum + (t.opportunityScore || 0), 0) / trendData.length;
    const upTrendRatio = trendData.filter(t => t.trendingDirection === 'up').length / trendData.length;

    return (avgOpportunityScore * 0.7) + (upTrendRatio * 30);
  }

  private extractTopBrands(products: Product[]): string[] {
    const brandCounts = new Map<string, number>();

    products.forEach(product => {
      if (product.brand) {
        brandCounts.set(product.brand, (brandCounts.get(product.brand) || 0) + 1);
      }
    });

    return Array.from(brandCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([brand]) => brand);
  }

  private extractTopKeywords(trendData: TrendAnalysis[]): string[] {
    const keywordCounts = new Map<string, number>();

    trendData.forEach(trend => {
      if (trend.relatedKeywords) {
        trend.relatedKeywords.forEach(keyword => {
          keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
        });
      }
    });

    return Array.from(keywordCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([keyword]) => keyword);
  }

  private analyzeSeasonalTrends(trendData: TrendAnalysis[]): {
    peakMonths: string[];
    lowMonths: string[];
  } {
    const monthlyScores = new Map<string, number[]>();

    trendData.forEach(trend => {
      const month = new Date(trend.analyzedDate).toLocaleString('default', { month: 'long' });
      const score = trend.googleTrendsScore || 0;

      if (!monthlyScores.has(month)) {
        monthlyScores.set(month, []);
      }
      monthlyScores.get(month)!.push(score);
    });

    const monthlyAverages = new Map<string, number>();
    monthlyScores.forEach((scores, month) => {
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      monthlyAverages.set(month, avg);
    });

    const averageScore = Array.from(monthlyAverages.values()).reduce((sum, avg) => sum + avg, 0) / monthlyAverages.size;

    const peakMonths = Array.from(monthlyAverages.entries())
      .filter(([, avg]) => avg > averageScore * 1.1)
      .map(([month]) => month);

    const lowMonths = Array.from(monthlyAverages.entries())
      .filter(([, avg]) => avg < averageScore * 0.9)
      .map(([month]) => month);

    return { peakMonths, lowMonths };
  }

  private calculateGrowthRate(trendData: TrendAnalysis[]): number {
    if (trendData.length < 2) return 0;

    const sortedData = trendData.sort((a, b) => new Date(a.analyzedDate).getTime() - new Date(b.analyzedDate).getTime());
    const recent = sortedData.slice(-6); // Son 6 veri
    const older = sortedData.slice(0, 6); // İlk 6 veri

    const recentAvg = recent.reduce((sum, t) => sum + (t.googleTrendsScore || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + (t.googleTrendsScore || 0), 0) / older.length;

    return olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;
  }

  private analyzeProfitMargin(products: Product[]): {
    average: number;
    range: { min: number; max: number };
  } {
    // Basit kâr marjı tahmini (gerçek cost data olmadığı için)
    const margins = products.map(p => {
      const price = p.price || 0;
      if (price === 0) return 0;
      
      // Basit maliyet tahmini
      let estimatedCost = price * 0.6; // %40 margin varsayımı
      
      // Kategori bazlı ayarlama
      if (p.category?.name === 'Electronics') estimatedCost = price * 0.7; // Düşük margin
      if (p.category?.name === 'Beauty') estimatedCost = price * 0.4; // Yüksek margin
      
      return ((price - estimatedCost) / price) * 100;
    });

    const validMargins = margins.filter(m => m > 0);

    return {
      average: validMargins.length > 0 ? validMargins.reduce((sum, m) => sum + m, 0) / validMargins.length : 0,
      range: {
        min: validMargins.length > 0 ? Math.min(...validMargins) : 0,
        max: validMargins.length > 0 ? Math.max(...validMargins) : 0,
      },
    };
  }

  private analyzeBarriers(category: Category, products: Product[]): {
    entry: 'low' | 'medium' | 'high';
    capital: number;
    expertise: 'low' | 'medium' | 'high';
  } {
    let barrierScore = 0;

    // Ortalama fiyat bazlı sermaye gereksinimi
    const avgPrice = products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length;
    if (avgPrice > 100) barrierScore += 20;
    else if (avgPrice > 50) barrierScore += 10;

    // Teknik karmaşıklık
    const techCategories = ['Electronics', 'Automotive', 'Industrial'];
    if (techCategories.includes(category.name)) {
      barrierScore += 25;
    }

    // Marka yoğunluğu
    const brandCount = new Set(products.map(p => p.brand).filter(Boolean)).size;
    if (brandCount > 50) barrierScore += 15;

    const entryLevel = barrierScore >= 40 ? 'high' : barrierScore >= 20 ? 'medium' : 'low';
    const capitalRequirement = avgPrice * 100; // Inventory için
    const expertiseLevel = barrierScore >= 40 ? 'high' : barrierScore >= 20 ? 'medium' : 'low';

    return {
      entry: entryLevel,
      capital: capitalRequirement,
      expertise: expertiseLevel,
    };
  }

  private generateRecommendations(category: Category, metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.opportunityScore > 70) {
      recommendations.push('Yüksek fırsat kategorisi - öncelikli hedef');
    }

    if (metrics.competitionLevel === 'low') {
      recommendations.push('Düşük rekabet - hızlı giriş fırsatı');
    } else if (metrics.competitionLevel === 'high') {
      recommendations.push('Yüksek rekabet - farklılaşma stratejisi gerekli');
    }

    if (metrics.growthRate > 10) {
      recommendations.push('Hızla büyüyen kategori - erken yatırım yapın');
    }

    if (metrics.profitMargin.average > 40) {
      recommendations.push('Yüksek kâr marjı potansiyeli');
    }

    return recommendations;
  }

  private async updateCategoryStats(category: Category, insight: CategoryInsight): Promise<void> {
    try {
      category.updateStats({
        productCount: insight.productCount,
        avgPrice: insight.averagePrice,
        avgRating: insight.averageRating,
        competitionLevel: this.competitionLevelToNumber(insight.competitionLevel),
        profitabilityScore: insight.profitMargin.average,
        trendScore: insight.trendScore,
        topKeywords: insight.topKeywords,
        topBrands: insight.topBrands,
      });

      await this.categoryRepository.save(category);
    } catch (error) {
      this.logger.warn(`Failed to update category stats: ${error.message}`);
    }
  }

  private competitionLevelToNumber(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low': return 25;
      case 'medium': return 50;
      case 'high': return 75;
      default: return 50;
    }
  }

  private calculateProfitPotential(analysis: CategoryInsight): number {
    let score = 0;

    // Kâr marjı ağırlığı
    score += analysis.profitMargin.average * 0.4;

    // Fırsat skoru ağırlığı
    score += analysis.opportunityScore * 0.3;

    // Büyüme oranı ağırlığı
    score += Math.min(analysis.growthRate * 2, 20) * 0.2;

    // Rekabet seviyesi ağırlığı (ters orantılı)
    const competitionPenalty = analysis.competitionLevel === 'high' ? 20 : 
                              analysis.competitionLevel === 'medium' ? 10 : 0;
    score += (20 - competitionPenalty) * 0.1;

    return Math.min(Math.max(score, 0), 100);
  }

  private determineWinnerCategory(categories: any[]): { category: string; reasons: string[] } {
    let winner = categories[0];
    let maxScore = 0;

    categories.forEach(category => {
      let score = 0;
      const reasons: string[] = [];

      // Fırsat skoru ağırlık
      score += category.opportunityScore * 0.3;
      if (category.opportunityScore > 70) reasons.push('Yüksek fırsat skoru');

      // Kâr potansiyeli ağırlık
      score += category.profitPotential * 0.25;
      if (category.profitPotential > 70) reasons.push('Yüksek kâr potansiyeli');

      // Büyüme oranı ağırlık
      score += Math.min(category.growthRate * 2, 20) * 0.2;
      if (category.growthRate > 10) reasons.push('Hızlı büyüme');

      // Rekabet seviyesi ağırlık (ters orantılı)
      if (category.competitionLevel === 'low') {
        score += 20;
        reasons.push('Düşük rekabet');
      } else if (category.competitionLevel === 'medium') {
        score += 10;
      }

      // Ortalama fiyat ağırlık
      if (category.averagePrice > 50) {
        score += 5;
        reasons.push('Yüksek değerli ürünler');
      }

      if (score > maxScore) {
        maxScore = score;
        winner = { ...category, reasons };
      }
    });

    return {
      category: winner.name,
      reasons: winner.reasons || ['Genel performans'],
    };
  }

  private generateComparisonRecommendations(categories: any[]): string[] {
    const recommendations: string[] = [];

    const lowCompetitionCategories = categories.filter(c => c.competitionLevel === 'low');
    const highGrowthCategories = categories.filter(c => c.growthRate > 10);
    const highProfitCategories = categories.filter(c => c.profitPotential > 70);

    if (lowCompetitionCategories.length > 0) {
      recommendations.push(`${lowCompetitionCategories.length} kategori düşük rekabet seviyesinde`);
    }

    if (highGrowthCategories.length > 0) {
      recommendations.push(`${highGrowthCategories.length} kategori hızla büyüyor`);
    }

    if (highProfitCategories.length > 0) {
      recommendations.push(`${highProfitCategories.length} kategoride yüksek kâr potansiyeli var`);
    }

    return recommendations;
  }

  private async analyzeNicheOpportunity(category: Category, trend: TrendAnalysis): Promise<NicheOpportunity | null> {
    try {
      // Amazon'da arama yaparak rekabet analizi
      const searchResults = await this.amazonApiService.searchProducts({
        keywords: trend.keyword,
        category: category.name,
        limit: 20,
      });

      const niche: NicheOpportunity = {
        category: category.name,
        subNiche: trend.keyword,
        keywords: trend.relatedKeywords || [],
        competitorCount: searchResults.length,
        averagePrice: this.calculateAveragePrice(searchResults),
        searchVolume: trend.amazonSearchVolume || 0,
        difficulty: this.calculateNicheDifficulty(searchResults),
        opportunityScore: trend.opportunityScore || 0,
        estimatedRevenue: this.estimateNicheRevenue(searchResults),
        timeToMarket: this.estimateTimeToMarket(trend, searchResults),
        requirements: {
          minimumCapital: this.calculateMinimumCapital(searchResults),
          expertise: this.getRequiredExpertise(category.name),
          timeInvestment: this.getTimeInvestment(searchResults.length),
        },
        risks: this.identifyRisks(trend, searchResults),
        advantages: this.identifyAdvantages(trend, searchResults),
      };

      return niche;
    } catch (error) {
      this.logger.warn(`Failed to analyze niche opportunity: ${error.message}`);
      return null;
    }
  }

  private calculateAveragePrice(products: any[]): number {
    const prices = products.map(p => p.price).filter(Boolean);
    return prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  }

  private calculateNicheDifficulty(products: any[]): number {
    // Rekabet zorluğu hesaplama
    let difficulty = 50;

    if (products.length <= 10) difficulty -= 20;
    else if (products.length >= 50) difficulty += 20;

    const avgReviews = products.reduce((sum, p) => sum + (p.reviewCount || 0), 0) / products.length;
    if (avgReviews > 500) difficulty += 15;

    return Math.min(Math.max(difficulty, 0), 100);
  }

  private estimateNicheRevenue(products: any[]): number {
    const avgPrice = this.calculateAveragePrice(products);
    const estimatedMonthlySales = Math.max(50, 500 - (products.length * 5)); // Basit tahmin
    return avgPrice * estimatedMonthlySales * 12; // Yıllık tahmin
  }

  private estimateTimeToMarket(trend: TrendAnalysis, products: any[]): number {
    let months = 3; // Base time

    if (products.length > 30) months += 2; // Yüksek rekabet
    if (trend.competitionLevel === 'high') months += 1;
    
    return months;
  }

  private calculateMinimumCapital(products: any[]): number {
    const avgPrice = this.calculateAveragePrice(products);
    return avgPrice * 50; // 50 adet inventory varsayımı
  }

  private getRequiredExpertise(categoryName: string): string[] {
    const expertiseMap: { [key: string]: string[] } = {
      'Electronics': ['Teknik bilgi', 'Kalite kontrol', 'Garanti yönetimi'],
      'Beauty': ['Ürün bilgisi', 'Müşteri hizmetleri', 'Pazarlama'],
      'Sports': ['Ürün bilgisi', 'Sezonluk planlama'],
      'default': ['Pazarlama', 'Müşteri hizmetleri'],
    };

    return expertiseMap[categoryName] || expertiseMap['default'];
  }

  private getTimeInvestment(competitorCount: number): string {
    if (competitorCount <= 10) return 'Düşük (günlük 1-2 saat)';
    if (competitorCount <= 30) return 'Orta (günlük 3-4 saat)';
    return 'Yüksek (günlük 5+ saat)';
  }

  private identifyRisks(trend: TrendAnalysis, products: any[]): string[] {
    const risks: string[] = [];

    if (products.length > 50) risks.push('Yüksek rekabet');
    if (trend.competitionLevel === 'high') risks.push('Güçlü rakipler');
    if (trend.trendingDirection === 'down') risks.push('Azalan trend');

    return risks;
  }

  private identifyAdvantages(trend: TrendAnalysis, products: any[]): string[] {
    const advantages: string[] = [];

    if (products.length <= 15) advantages.push('Düşük rekabet');
    if (trend.trendingDirection === 'up') advantages.push('Yükselen trend');
    if (trend.opportunityScore && trend.opportunityScore > 75) advantages.push('Yüksek fırsat skoru');

    return advantages;
  }

  // Diğer helper metodlar...
  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  private determineOverallTrend(trendData: TrendAnalysis[]): 'up' | 'down' | 'stable' {
    if (trendData.length < 2) return 'stable';

    const recent = trendData.slice(-5);
    const older = trendData.slice(0, 5);

    const recentAvg = recent.reduce((sum, t) => sum + (t.googleTrendsScore || 0), 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + (t.googleTrendsScore || 0), 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return 'up';
    if (change < -0.1) return 'down';
    return 'stable';
  }

  private aggregateMonthlyData(trendData: TrendAnalysis[]): Array<{
    month: string;
    year: number;
    score: number;
    searchVolume: number;
    competitionLevel: number;
  }> {
    // Mock implementation
    return [];
  }

  private analyzeDetailedSeasonalPattern(monthlyData: any[]): any {
    return {
      peakMonths: [{ month: 'December', score: 85 }],
      lowMonths: [{ month: 'June', score: 45 }],
      volatility: 0.3,
    };
  }

  private generateTrendForecast(monthlyData: any[], months: number): any[] {
    return [];
  }

  private generateTrendInsights(overallTrend: string, seasonalPattern: any, monthlyData: any[]): string[] {
    return [`Genel trend ${overallTrend} yönünde`];
  }

  private analyzeBrandCompetition(products: Product[]): Array<{
    name: string;
    marketShare: number;
    avgPrice: number;
    productCount: number;
    strength: 'weak' | 'moderate' | 'strong';
  }> {
    const brandMap = new Map<string, Product[]>();

    products.forEach(product => {
      if (product.brand) {
        if (!brandMap.has(product.brand)) {
          brandMap.set(product.brand, []);
        }
        brandMap.get(product.brand)!.push(product);
      }
    });

    return Array.from(brandMap.entries())
      .map(([brand, brandProducts]) => {
        const avgPrice = brandProducts.reduce((sum, p) => sum + (p.price || 0), 0) / brandProducts.length;
        const marketShare = (brandProducts.length / products.length) * 100;
        
        let strength: 'weak' | 'moderate' | 'strong' = 'weak';
        if (marketShare > 10) strength = 'strong';
        else if (marketShare > 5) strength = 'moderate';

        return {
          name: brand,
          marketShare,
          avgPrice,
          productCount: brandProducts.length,
          strength,
        };
      })
      .sort((a, b) => b.marketShare - a.marketShare)
      .slice(0, 10);
  }

  private async identifyCompetitiveGaps(categoryId: string): Promise<Array<{
    opportunity: string;
    difficulty: 'low' | 'medium' | 'high';
    potentialRevenue: number;
  }>> {
    // Mock implementation
    return [
      {
        opportunity: 'Premium segment boşluğu',
        difficulty: 'medium',
        potentialRevenue: 50000,
      },
    ];
  }

  private calculateMarketSaturation(products: Product[]): number {
    // Basit doygunluk hesaplaması
    const uniqueBrands = new Set(products.map(p => p.brand).filter(Boolean)).size;
    const saturation = Math.min((products.length / 1000) * 100, 100);
    return saturation;
  }

  private analyzeEntryBarriers(products: Product[]): {
    level: 'low' | 'medium' | 'high';
    factors: string[];
  } {
    const factors: string[] = [];
    let barrierScore = 0;

    const avgPrice = products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length;
    if (avgPrice > 100) {
      factors.push('Yüksek sermaye gereksinimi');
      barrierScore += 20;
    }

    const brandCount = new Set(products.map(p => p.brand).filter(Boolean)).size;
    if (brandCount > 50) {
      factors.push('Güçlü marka varlığı');
      barrierScore += 15;
    }

    const level = barrierScore >= 30 ? 'high' : barrierScore >= 15 ? 'medium' : 'low';

    return { level, factors };
  }

  private generateCompetitiveStrategies(competitionLevel: string, brandAnalysis: any[]): string[] {
    const strategies: string[] = [];

    if (competitionLevel === 'low') {
      strategies.push('Hızla pazar payı kazan');
      strategies.push('Agresif fiyatlandırma stratejisi uygula');
    } else if (competitionLevel === 'high') {
      strategies.push('Niş segmentlere odaklan');
      strategies.push('Ürün farklılaşması yap');
      strategies.push('Müşteri hizmetinde öne çık');
    }

    return strategies;
  }
}