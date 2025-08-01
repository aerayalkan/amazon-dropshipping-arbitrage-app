import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { AmazonApiService } from '../../amazon-api/amazon-api.service';
import { Product } from '../entities/product.entity';
import { Category } from '../entities/category.entity';
import { TrendAnalysis } from '../entities/trend-analysis.entity';

export interface ProductOpportunity {
  asin: string;
  title: string;
  price: number;
  salesRank: number;
  reviewCount: number;
  reviewAverage: number;
  profitabilityScore: number;
  competitionScore: number;
  trendScore: number;
  overallScore: number;
  reason: string[];
  category: string;
  estimatedMonthlySales: number;
  estimatedRevenue: number;
}

export interface MarketAnalysis {
  category: string;
  totalProducts: number;
  averagePrice: number;
  priceRange: { min: number; max: number };
  competitionLevel: 'low' | 'medium' | 'high';
  topKeywords: string[];
  growthTrend: 'up' | 'down' | 'stable';
  seasonality: number;
  opportunityScore: number;
  recommendedNiches: string[];
}

export interface ResearchFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minReviews?: number;
  maxReviews?: number;
  minRating?: number;
  maxSalesRank?: number;
  primeOnly?: boolean;
  fbaOnly?: boolean;
  newProducts?: boolean;
  trending?: boolean;
  lowCompetition?: boolean;
  highProfitability?: boolean;
}

@Injectable()
export class ProductResearchService {
  private readonly logger = new Logger(ProductResearchService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(TrendAnalysis)
    private readonly trendAnalysisRepository: Repository<TrendAnalysis>,
    private readonly amazonApiService: AmazonApiService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Yükselen ürünleri bul
   */
  async findRisingProducts(filters: ResearchFilters): Promise<ProductOpportunity[]> {
    try {
      this.logger.log('Finding rising products with filters:', filters);

      // Amazon'dan yeni çıkanları ve bestseller'ları al
      const [newReleases, bestsellers] = await Promise.all([
        this.amazonApiService.getNewReleases(filters.category, 1),
        this.amazonApiService.getBestSellers(filters.category, 1),
      ]);

      const opportunities: ProductOpportunity[] = [];

      // Yeni çıkanları analiz et
      for (const product of newReleases) {
        if (this.matchesFilters(product, filters)) {
          const opportunity = await this.analyzeProductOpportunity(product);
          if (opportunity.overallScore >= 70) {
            opportunity.reason.push('Yeni çıkan ürün');
            opportunities.push(opportunity);
          }
        }
      }

      // Bestseller'ları analiz et
      for (const product of bestsellers) {
        if (this.matchesFilters(product, filters)) {
          const opportunity = await this.analyzeProductOpportunity(product);
          if (opportunity.overallScore >= 60) {
            opportunity.reason.push('Bestseller kategorisinde');
            opportunities.push(opportunity);
          }
        }
      }

      // Skorlara göre sırala
      opportunities.sort((a, b) => b.overallScore - a.overallScore);

      this.logger.log(`Found ${opportunities.length} rising product opportunities`);
      return opportunities.slice(0, 50); // İlk 50 fırsat
    } catch (error) {
      this.logger.error(`Error finding rising products: ${error.message}`);
      throw error;
    }
  }

  /**
   * Düşük rekabetli ürünleri bul
   */
  async findLowCompetitionProducts(filters: ResearchFilters): Promise<ProductOpportunity[]> {
    try {
      this.logger.log('Finding low competition products');

      const searchTerms = await this.generateSearchTerms(filters.category);
      const opportunities: ProductOpportunity[] = [];

      for (const term of searchTerms) {
        const searchResults = await this.amazonApiService.searchProducts({
          keywords: term,
          category: filters.category,
          limit: 20,
        });

        for (const product of searchResults) {
          if (this.matchesFilters(product, filters)) {
            const competitionScore = await this.analyzeCompetition(product.asin!);
            
            if (competitionScore <= 30) { // Düşük rekabet
              const opportunity = await this.analyzeProductOpportunity(product);
              opportunity.reason.push('Düşük rekabet seviyesi');
              opportunities.push(opportunity);
            }
          }
        }

        // Rate limiting
        await this.delay(1000);
      }

      // Benzersiz ASIN'leri al ve skorlara göre sırala
      const uniqueOpportunities = opportunities
        .filter((item, index, self) => index === self.findIndex(t => t.asin === item.asin))
        .sort((a, b) => a.competitionScore - b.competitionScore);

      this.logger.log(`Found ${uniqueOpportunities.length} low competition opportunities`);
      return uniqueOpportunities.slice(0, 30);
    } catch (error) {
      this.logger.error(`Error finding low competition products: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pazar analizi yap
   */
  async analyzeMarket(category: string): Promise<MarketAnalysis> {
    try {
      this.logger.log(`Analyzing market for category: ${category}`);

      // Kategori verilerini al
      const [bestsellers, newReleases, trendData] = await Promise.all([
        this.amazonApiService.getBestSellers(category, 1),
        this.amazonApiService.getNewReleases(category, 1),
        this.getTrendData(category),
      ]);

      const allProducts = [...bestsellers, ...newReleases];
      
      // Fiyat analizi
      const prices = allProducts.map(p => p.price).filter(Boolean) as number[];
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const priceRange = {
        min: Math.min(...prices),
        max: Math.max(...prices),
      };

      // Rekabet seviyesi
      const competitionLevel = await this.calculateCategoryCompetition(category);

      // Top keywords
      const topKeywords = await this.extractTopKeywords(allProducts);

      // Seasonality analizi
      const seasonality = await this.analyzeSeasonality(category);

      // Fırsat skoru hesapla
      const opportunityScore = this.calculateOpportunityScore({
        competitionLevel,
        trendDirection: trendData.direction,
        avgPrice,
        productCount: allProducts.length,
      });

      // Önerilen nişler
      const recommendedNiches = await this.findRecommendedNiches(category, topKeywords);

      const analysis: MarketAnalysis = {
        category,
        totalProducts: allProducts.length,
        averagePrice: avgPrice,
        priceRange,
        competitionLevel,
        topKeywords,
        growthTrend: trendData.direction,
        seasonality,
        opportunityScore,
        recommendedNiches,
      };

      this.logger.log(`Market analysis completed for ${category}`);
      return analysis;
    } catch (error) {
      this.logger.error(`Error analyzing market for ${category}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Anahtar kelime araştırması
   */
  async researchKeywords(baseKeyword: string, category?: string): Promise<{
    primary: string;
    related: string[];
    longTail: string[];
    searchVolume: { keyword: string; volume: number }[];
    difficulty: { keyword: string; difficulty: number }[];
    trends: { keyword: string; trend: 'up' | 'down' | 'stable' }[];
  }> {
    try {
      this.logger.log(`Researching keywords for: ${baseKeyword}`);

      // Google Trends API ile related keywords al
      const relatedKeywords = await this.getRelatedKeywords(baseKeyword);
      
      // Long tail keywords oluştur
      const longTailKeywords = await this.generateLongTailKeywords(baseKeyword, category);

      // Search volume analizi
      const searchVolume = await this.analyzeSearchVolume([baseKeyword, ...relatedKeywords]);

      // Keyword difficulty
      const difficulty = await this.analyzeKeywordDifficulty([baseKeyword, ...relatedKeywords]);

      // Trend analizi
      const trends = await this.analyzeTrends([baseKeyword, ...relatedKeywords]);

      return {
        primary: baseKeyword,
        related: relatedKeywords,
        longTail: longTailKeywords,
        searchVolume,
        difficulty,
        trends,
      };
    } catch (error) {
      this.logger.error(`Error researching keywords: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ürün fırsatı analizi
   */
  private async analyzeProductOpportunity(product: any): Promise<ProductOpportunity> {
    try {
      // Profitability score
      const profitabilityScore = this.calculateProfitabilityScore(product);
      
      // Competition score
      const competitionScore = await this.analyzeCompetition(product.asin);
      
      // Trend score
      const trendScore = await this.analyzeTrendScore(product.title);

      // Overall score
      const overallScore = (profitabilityScore * 0.4) + 
                          ((100 - competitionScore) * 0.3) + 
                          (trendScore * 0.3);

      // Satış tahmini
      const salesEstimate = this.estimateMonthlySales(product);

      return {
        asin: product.asin,
        title: product.title,
        price: product.price || 0,
        salesRank: product.salesRank || 999999,
        reviewCount: product.reviewCount || 0,
        reviewAverage: product.reviewAverage || 0,
        profitabilityScore,
        competitionScore,
        trendScore,
        overallScore,
        reason: [],
        category: product.category || 'Unknown',
        estimatedMonthlySales: salesEstimate.sales,
        estimatedRevenue: salesEstimate.revenue,
      };
    } catch (error) {
      this.logger.error(`Error analyzing product opportunity: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private matchesFilters(product: any, filters: ResearchFilters): boolean {
    if (filters.minPrice && product.price < filters.minPrice) return false;
    if (filters.maxPrice && product.price > filters.maxPrice) return false;
    if (filters.minReviews && product.reviewCount < filters.minReviews) return false;
    if (filters.maxReviews && product.reviewCount > filters.maxReviews) return false;
    if (filters.minRating && product.reviewAverage < filters.minRating) return false;
    if (filters.maxSalesRank && product.salesRank > filters.maxSalesRank) return false;
    if (filters.primeOnly && !product.isPrime) return false;
    if (filters.fbaOnly && !product.isFba) return false;
    
    return true;
  }

  private calculateProfitabilityScore(product: any): number {
    let score = 0;

    // Fiyat bazlı skor (yüksek fiyat = yüksek kâr potansiyeli)
    if (product.price) {
      if (product.price >= 50) score += 30;
      else if (product.price >= 25) score += 20;
      else if (product.price >= 15) score += 10;
    }

    // Sales rank bazlı skor (düşük rank = yüksek satış)
    if (product.salesRank) {
      if (product.salesRank <= 1000) score += 25;
      else if (product.salesRank <= 10000) score += 20;
      else if (product.salesRank <= 50000) score += 15;
      else if (product.salesRank <= 100000) score += 10;
    }

    // Review sayısı bazlı skor (orta seviye en iyi)
    if (product.reviewCount) {
      if (product.reviewCount >= 50 && product.reviewCount <= 500) score += 25;
      else if (product.reviewCount <= 50) score += 20;
      else if (product.reviewCount <= 1000) score += 15;
      else score += 5;
    }

    // Rating bazlı skor
    if (product.reviewAverage >= 4.0) score += 20;
    else if (product.reviewAverage >= 3.5) score += 15;
    else if (product.reviewAverage >= 3.0) score += 10;

    return Math.min(score, 100);
  }

  private async analyzeCompetition(asin: string): Promise<number> {
    try {
      const competitors = await this.amazonApiService.getCompetitors(asin);
      
      let competitionScore = 0;
      
      // Satıcı sayısı bazlı skor
      if (competitors.length <= 3) competitionScore += 30;
      else if (competitors.length <= 10) competitionScore += 20;
      else if (competitors.length <= 20) competitionScore += 10;
      else competitionScore += 50; // Yüksek rekabet

      // FBA satıcı oranı
      const fbaCount = competitors.filter(c => c.isFba).length;
      const fbaRatio = fbaCount / competitors.length;
      
      if (fbaRatio >= 0.8) competitionScore += 20; // Çok FBA satıcı = yüksek rekabet
      else if (fbaRatio >= 0.5) competitionScore += 10;

      // Fiyat dağılımı analizi
      const prices = competitors.map(c => c.price).filter(Boolean);
      if (prices.length > 1) {
        const priceStdDev = this.calculateStandardDeviation(prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const coefficient = priceStdDev / avgPrice;
        
        if (coefficient > 0.2) competitionScore -= 10; // Fiyat dağılımı varsa rekabet düşük
      }

      return Math.min(competitionScore, 100);
    } catch (error) {
      return 50; // Orta seviye rekabet varsayımı
    }
  }

  private async analyzeTrendScore(productTitle: string): Promise<number> {
    try {
      // Basit keyword analizi
      const keywords = productTitle.toLowerCase().split(' ');
      let trendScore = 50; // Varsayılan orta skor

      // Trend verilerini kontrol et
      for (const keyword of keywords) {
        const trendData = await this.trendAnalysisRepository.findOne({
          where: { keyword },
          order: { analyzedDate: 'DESC' },
        });

        if (trendData) {
          if (trendData.trendingDirection === 'up') trendScore += 10;
          else if (trendData.trendingDirection === 'down') trendScore -= 10;
          
          if (trendData.opportunityScore) {
            trendScore = (trendScore + trendData.opportunityScore) / 2;
          }
        }
      }

      return Math.min(Math.max(trendScore, 0), 100);
    } catch (error) {
      return 50;
    }
  }

  private estimateMonthlySales(product: any): { sales: number; revenue: number } {
    // Basit satış tahmini algoritması
    let monthlySales = 0;

    if (product.salesRank) {
      // Sales rank bazlı tahmin
      if (product.salesRank <= 100) monthlySales = 1000;
      else if (product.salesRank <= 1000) monthlySales = 500;
      else if (product.salesRank <= 10000) monthlySales = 100;
      else if (product.salesRank <= 50000) monthlySales = 50;
      else if (product.salesRank <= 100000) monthlySales = 25;
      else monthlySales = 10;

      // Review sayısı faktörü
      if (product.reviewCount) {
        const reviewFactor = Math.min(product.reviewCount / 100, 2);
        monthlySales *= reviewFactor;
      }
    }

    const revenue = monthlySales * (product.price || 0);

    return {
      sales: Math.round(monthlySales),
      revenue: Math.round(revenue),
    };
  }

  private async generateSearchTerms(category?: string): Promise<string[]> {
    const baseTerms = [
      'best', 'top', 'premium', 'professional', 'portable', 'wireless',
      'smart', 'digital', 'automatic', 'rechargeable', 'waterproof',
      'adjustable', 'durable', 'compact', 'lightweight', 'heavy duty'
    ];

    if (category) {
      return baseTerms.map(term => `${term} ${category}`);
    }

    return baseTerms;
  }

  private async getTrendData(category: string): Promise<{ direction: 'up' | 'down' | 'stable' }> {
    // Google Trends API entegrasyonu yapılacak
    // Şimdilik rastgele trend döndürüyoruz
    const trends = ['up', 'down', 'stable'] as const;
    return { direction: trends[Math.floor(Math.random() * trends.length)] };
  }

  private async calculateCategoryCompetition(category: string): Promise<'low' | 'medium' | 'high'> {
    // Kategori rekabet analizi yapılacak
    // Şimdilik rastgele döndürüyoruz
    const levels = ['low', 'medium', 'high'] as const;
    return levels[Math.floor(Math.random() * levels.length)];
  }

  private async extractTopKeywords(products: any[]): Promise<string[]> {
    const keywords = new Map<string, number>();

    products.forEach(product => {
      const words = product.title.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) {
          keywords.set(word, (keywords.get(word) || 0) + 1);
        }
      });
    });

    return Array.from(keywords.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private async analyzeSeasonality(category: string): Promise<number> {
    // Mevsimsellik analizi yapılacak
    return Math.random(); // 0-1 arası rastgele değer
  }

  private calculateOpportunityScore(params: {
    competitionLevel: 'low' | 'medium' | 'high';
    trendDirection: 'up' | 'down' | 'stable';
    avgPrice: number;
    productCount: number;
  }): number {
    let score = 50;

    // Rekabet seviyesi
    if (params.competitionLevel === 'low') score += 20;
    else if (params.competitionLevel === 'high') score -= 20;

    // Trend yönü
    if (params.trendDirection === 'up') score += 15;
    else if (params.trendDirection === 'down') score -= 15;

    // Ortalama fiyat (yüksek fiyat = daha iyi kâr marjı)
    if (params.avgPrice >= 50) score += 10;
    else if (params.avgPrice <= 15) score -= 10;

    return Math.min(Math.max(score, 0), 100);
  }

  private async findRecommendedNiches(category: string, topKeywords: string[]): Promise<string[]> {
    // Niş önerileri algoritması
    const nisches = topKeywords.map(keyword => `${keyword} ${category}`);
    return nisches.slice(0, 5);
  }

  private async getRelatedKeywords(keyword: string): Promise<string[]> {
    // Google Suggest API veya başka keyword tool entegrasyonu
    return [
      `${keyword} best`,
      `${keyword} review`,
      `${keyword} cheap`,
      `${keyword} quality`,
      `${keyword} professional`,
    ];
  }

  private async generateLongTailKeywords(baseKeyword: string, category?: string): Promise<string[]> {
    const modifiers = ['best', 'top rated', 'professional', 'cheap', 'quality', 'durable'];
    const suffixes = ['for sale', 'reviews', 'guide', 'comparison'];
    
    const longTails: string[] = [];
    
    modifiers.forEach(modifier => {
      longTails.push(`${modifier} ${baseKeyword}`);
      if (category) {
        longTails.push(`${modifier} ${baseKeyword} for ${category}`);
      }
    });

    suffixes.forEach(suffix => {
      longTails.push(`${baseKeyword} ${suffix}`);
    });

    return longTails.slice(0, 10);
  }

  private async analyzeSearchVolume(keywords: string[]): Promise<{ keyword: string; volume: number }[]> {
    // Keyword volume analizi API entegrasyonu
    return keywords.map(keyword => ({
      keyword,
      volume: Math.floor(Math.random() * 10000) + 100,
    }));
  }

  private async analyzeKeywordDifficulty(keywords: string[]): Promise<{ keyword: string; difficulty: number }[]> {
    // Keyword difficulty analizi
    return keywords.map(keyword => ({
      keyword,
      difficulty: Math.floor(Math.random() * 100),
    }));
  }

  private async analyzeTrends(keywords: string[]): Promise<{ keyword: string; trend: 'up' | 'down' | 'stable' }[]> {
    const trends = ['up', 'down', 'stable'] as const;
    return keywords.map(keyword => ({
      keyword,
      trend: trends[Math.floor(Math.random() * trends.length)],
    }));
  }

  private calculateStandardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}