import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SalesPrediction } from '../entities/sales-prediction.entity';
import { Product } from '../entities/product.entity';
import { ProductPriceHistory } from '../entities/product-price-history.entity';

export interface SalesEstimate {
  productId: string;
  estimatedMonthlySales: number;
  estimatedRevenue: number;
  confidenceLevel: 'low' | 'medium' | 'high';
  factors: {
    salesRank: number;
    pricePoint: number;
    reviewCount: number;
    reviewAverage: number;
    categoryMultiplier: number;
    seasonality: number;
    trend: number;
  };
  modelVersion: string;
}

export interface RevenueProjection {
  productId: string;
  projections: Array<{
    month: number;
    year: number;
    estimatedSales: number;
    estimatedRevenue: number;
    factors: {
      seasonality: number;
      trend: number;
      competition: number;
    };
  }>;
  totalAnnualRevenue: number;
  growthRate: number;
}

export interface MarketPotential {
  category: string;
  totalMarketSize: number;
  competitorCount: number;
  averageSalesPerProduct: number;
  marketGrowthRate: number;
  opportunityScore: number;
  recommendedPriceRange: {
    min: number;
    max: number;
    optimal: number;
  };
}

@Injectable()
export class SalesEstimationService {
  private readonly logger = new Logger(SalesEstimationService.name);
  private readonly modelVersion = 'v1.2.0';

  constructor(
    @InjectRepository(SalesPrediction)
    private readonly predictionRepository: Repository<SalesPrediction>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(ProductPriceHistory)
    private readonly priceHistoryRepository: Repository<ProductPriceHistory>,
  ) {}

  /**
   * Ürün satış tahmini yap
   */
  async estimateProductSales(productId: string): Promise<SalesEstimate> {
    try {
      this.logger.log(`Estimating sales for product: ${productId}`);

      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: ['category'],
      });

      if (!product) {
        throw new Error('Ürün bulunamadı');
      }

      // Satış tahmin faktörlerini hesapla
      const factors = await this.calculateSalesFactors(product);

      // Aylık satış tahmini
      const estimatedMonthlySales = this.calculateMonthlySales(factors);

      // Gelir tahmini
      const estimatedRevenue = estimatedMonthlySales * (product.price || 0);

      // Güven seviyesi
      const confidenceLevel = this.calculateConfidenceLevel(factors);

      const estimate: SalesEstimate = {
        productId,
        estimatedMonthlySales,
        estimatedRevenue,
        confidenceLevel,
        factors,
        modelVersion: this.modelVersion,
      };

      // Tahmini veritabanına kaydet
      await this.savePrediction(product, estimate);

      this.logger.log(`Sales estimation completed for product: ${productId}`);
      return estimate;
    } catch (error) {
      this.logger.error(`Error estimating sales for product ${productId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Çoklu ürün satış tahmini
   */
  async estimateMultipleProducts(productIds: string[]): Promise<SalesEstimate[]> {
    try {
      this.logger.log(`Estimating sales for ${productIds.length} products`);

      const estimates = await Promise.all(
        productIds.map(id => this.estimateProductSales(id))
      );

      return estimates;
    } catch (error) {
      this.logger.error(`Error estimating multiple products: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gelir projeksiyonu (12 aylık)
   */
  async projectRevenue(productId: string): Promise<RevenueProjection> {
    try {
      this.logger.log(`Projecting revenue for product: ${productId}`);

      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: ['category'],
      });

      if (!product) {
        throw new Error('Ürün bulunamadı');
      }

      const projections = [];
      let totalAnnualRevenue = 0;

      const currentDate = new Date();

      for (let i = 0; i < 12; i++) {
        const projectionDate = new Date(currentDate);
        projectionDate.setMonth(projectionDate.getMonth() + i);

        const monthFactors = await this.calculateMonthlyFactors(product, projectionDate);
        const monthlySales = this.calculateMonthlySales(monthFactors);
        const monthlyRevenue = monthlySales * (product.price || 0);

        totalAnnualRevenue += monthlyRevenue;

        projections.push({
          month: projectionDate.getMonth() + 1,
          year: projectionDate.getFullYear(),
          estimatedSales: monthlySales,
          estimatedRevenue: monthlyRevenue,
          factors: {
            seasonality: monthFactors.seasonality,
            trend: monthFactors.trend,
            competition: monthFactors.categoryMultiplier,
          },
        });
      }

      // Büyüme oranı hesapla
      const growthRate = this.calculateGrowthRate(projections);

      return {
        productId,
        projections,
        totalAnnualRevenue,
        growthRate,
      };
    } catch (error) {
      this.logger.error(`Error projecting revenue: ${error.message}`);
      throw error;
    }
  }

  /**
   * Pazar potansiyeli analizi
   */
  async analyzeMarketPotential(category: string): Promise<MarketPotential> {
    try {
      this.logger.log(`Analyzing market potential for category: ${category}`);

      // Kategorideki ürünleri al
      const categoryProducts = await this.productRepository.find({
        where: { 
          category: { name: category },
          isActive: true 
        },
        relations: ['category'],
      });

      if (categoryProducts.length === 0) {
        throw new Error('Kategoride ürün bulunamadı');
      }

      // Toplam pazar büyüklüğünü hesapla
      const totalMarketSize = this.calculateTotalMarketSize(categoryProducts);

      // Ortalama satış hesapla
      const averageSalesPerProduct = this.calculateAverageSales(categoryProducts);

      // Pazar büyüme oranı
      const marketGrowthRate = await this.calculateMarketGrowthRate(category);

      // Fırsat skoru
      const opportunityScore = this.calculateOpportunityScore(categoryProducts);

      // Önerilen fiyat aralığı
      const recommendedPriceRange = this.calculateOptimalPriceRange(categoryProducts);

      return {
        category,
        totalMarketSize,
        competitorCount: categoryProducts.length,
        averageSalesPerProduct,
        marketGrowthRate,
        opportunityScore,
        recommendedPriceRange,
      };
    } catch (error) {
      this.logger.error(`Error analyzing market potential: ${error.message}`);
      throw error;
    }
  }

  /**
   * Satış trend analizi
   */
  async analyzeSalesTrend(productId: string, months: number = 6): Promise<{
    trend: 'up' | 'down' | 'stable';
    trendStrength: number;
    seasonalPatterns: Array<{
      month: string;
      multiplier: number;
    }>;
    predictions: Array<{
      date: Date;
      predictedSales: number;
      confidence: number;
    }>;
  }> {
    try {
      this.logger.log(`Analyzing sales trend for product: ${productId}`);

      // Geçmiş tahminleri al
      const historicalPredictions = await this.predictionRepository.find({
        where: { productId },
        order: { predictionDate: 'ASC' },
      });

      if (historicalPredictions.length < 3) {
        // Yeterli veri yok, temel analiz yap
        return this.generateBasicTrendAnalysis(productId);
      }

      // Trend yönünü belirle
      const trend = this.determineTrendDirection(historicalPredictions);

      // Trend gücü
      const trendStrength = this.calculateTrendStrength(historicalPredictions);

      // Mevsimsel patternler
      const seasonalPatterns = this.identifySeasonalPatterns(historicalPredictions);

      // Gelecek tahminleri
      const predictions = this.generateFuturePredictions(historicalPredictions, months);

      return {
        trend,
        trendStrength,
        seasonalPatterns,
        predictions,
      };
    } catch (error) {
      this.logger.error(`Error analyzing sales trend: ${error.message}`);
      throw error;
    }
  }

  /**
   * Optimum fiyat analizi
   */
  async analyzeOptimalPricing(productId: string): Promise<{
    currentPrice: number;
    optimalPrice: number;
    priceElasticity: number;
    demandCurve: Array<{
      price: number;
      estimatedSales: number;
      revenue: number;
      profit: number;
    }>;
    recommendations: string[];
  }> {
    try {
      this.logger.log(`Analyzing optimal pricing for product: ${productId}`);

      const product = await this.productRepository.findOne({
        where: { id: productId },
        relations: ['priceHistory'],
      });

      if (!product) {
        throw new Error('Ürün bulunamadı');
      }

      const currentPrice = product.price || 0;

      // Fiyat elastikiyeti hesapla
      const priceElasticity = await this.calculatePriceElasticity(product);

      // Demand curve oluştur
      const demandCurve = await this.generateDemandCurve(product, priceElasticity);

      // Optimum fiyatı bul
      const optimalPrice = this.findOptimalPrice(demandCurve);

      // Öneriler oluştur
      const recommendations = this.generatePricingRecommendations(
        currentPrice,
        optimalPrice,
        demandCurve
      );

      return {
        currentPrice,
        optimalPrice,
        priceElasticity,
        demandCurve,
        recommendations,
      };
    } catch (error) {
      this.logger.error(`Error analyzing optimal pricing: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private async calculateSalesFactors(product: Product): Promise<any> {
    const factors = {
      salesRank: this.getSalesRankFactor(product.salesRank),
      pricePoint: this.getPricePointFactor(product.price),
      reviewCount: this.getReviewCountFactor(product.reviewCount),
      reviewAverage: this.getReviewAverageFactor(product.reviewAverage),
      categoryMultiplier: await this.getCategoryMultiplier(product.category?.name),
      seasonality: await this.getSeasonalityFactor(product.category?.name),
      trend: await this.getTrendFactor(product.title),
    };

    return factors;
  }

  private getSalesRankFactor(salesRank?: number): number {
    if (!salesRank) return 0.1;

    // Sales rank ne kadar düşükse, satış potansiyeli o kadar yüksek
    if (salesRank <= 100) return 1.0;
    if (salesRank <= 1000) return 0.8;
    if (salesRank <= 10000) return 0.6;
    if (salesRank <= 50000) return 0.4;
    if (salesRank <= 100000) return 0.2;
    return 0.1;
  }

  private getPricePointFactor(price?: number): number {
    if (!price) return 0.5;

    // Fiyat aralığına göre satış faktörü
    if (price <= 10) return 0.9; // Ucuz ürünler daha çok satar
    if (price <= 25) return 1.0; // Sweet spot
    if (price <= 50) return 0.8;
    if (price <= 100) return 0.6;
    return 0.4; // Pahalı ürünler daha az satar
  }

  private getReviewCountFactor(reviewCount: number): number {
    if (reviewCount === 0) return 0.3;
    if (reviewCount <= 10) return 0.5;
    if (reviewCount <= 50) return 0.7;
    if (reviewCount <= 200) return 1.0; // Optimal range
    if (reviewCount <= 1000) return 0.9;
    return 0.7; // Çok fazla review olunca yeni satış yapması zorlaşır
  }

  private getReviewAverageFactor(reviewAverage: number): number {
    if (reviewAverage === 0) return 0.3;
    if (reviewAverage < 3.0) return 0.4;
    if (reviewAverage < 3.5) return 0.6;
    if (reviewAverage < 4.0) return 0.8;
    if (reviewAverage < 4.5) return 1.0;
    return 0.9; // 4.5+ çok iyi ama şüpheli olabilir
  }

  private async getCategoryMultiplier(categoryName?: string): Promise<number> {
    if (!categoryName) return 1.0;

    // Kategori bazlı çarpanlar
    const multipliers: { [key: string]: number } = {
      'Electronics': 1.2,
      'Home & Kitchen': 1.1,
      'Sports & Outdoors': 0.9,
      'Books': 0.8,
      'Clothing': 1.0,
      'Beauty': 1.1,
      'Health': 1.0,
      'Toys': 0.9,
      'Automotive': 0.8,
    };

    return multipliers[categoryName] || 1.0;
  }

  private async getSeasonalityFactor(categoryName?: string): Promise<number> {
    const currentMonth = new Date().getMonth() + 1;

    // Basit mevsimsellik modeli
    if (!categoryName) return 1.0;

    // Kış ayları için elektronik ürünler daha fazla satılır
    if (categoryName === 'Electronics' && [11, 12, 1].includes(currentMonth)) {
      return 1.3;
    }

    // Yaz ayları için spor ürünleri daha fazla satılır
    if (categoryName === 'Sports & Outdoors' && [5, 6, 7, 8].includes(currentMonth)) {
      return 1.2;
    }

    return 1.0;
  }

  private async getTrendFactor(productTitle: string): Promise<number> {
    // Basit trend analizi - trend kelimeleri varsa bonus
    const trendKeywords = ['smart', 'wireless', 'bluetooth', 'led', 'usb-c', 'eco'];
    const titleLower = productTitle.toLowerCase();

    let trendScore = 1.0;
    trendKeywords.forEach(keyword => {
      if (titleLower.includes(keyword)) {
        trendScore += 0.1;
      }
    });

    return Math.min(trendScore, 1.5); // Maximum 1.5x
  }

  private calculateMonthlySales(factors: any): number {
    // Base satış sayısı
    let baseSales = 10;

    // Faktörleri uygula
    baseSales *= factors.salesRank;
    baseSales *= factors.pricePoint;
    baseSales *= factors.reviewCount;
    baseSales *= factors.reviewAverage;
    baseSales *= factors.categoryMultiplier;
    baseSales *= factors.seasonality;
    baseSales *= factors.trend;

    return Math.round(Math.max(baseSales, 1));
  }

  private calculateConfidenceLevel(factors: any): 'low' | 'medium' | 'high' {
    let confidence = 0;

    // Veri kalitesine göre güven seviyesi
    if (factors.salesRank > 0.5) confidence += 1;
    if (factors.reviewCount > 0.5) confidence += 1;
    if (factors.reviewAverage > 0.7) confidence += 1;

    if (confidence >= 3) return 'high';
    if (confidence >= 2) return 'medium';
    return 'low';
  }

  private async savePrediction(product: Product, estimate: SalesEstimate): Promise<void> {
    try {
      const prediction = SalesPrediction.createPrediction(
        product.id,
        new Date(),
        estimate.estimatedMonthlySales,
        estimate.estimatedRevenue,
        this.getConfidenceScore(estimate.confidenceLevel),
        estimate.modelVersion,
        estimate.factors
      );

      await this.predictionRepository.save(prediction);
    } catch (error) {
      this.logger.warn(`Failed to save prediction: ${error.message}`);
    }
  }

  private getConfidenceScore(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'high': return 0.85;
      case 'medium': return 0.65;
      case 'low': return 0.45;
      default: return 0.5;
    }
  }

  private async calculateMonthlyFactors(product: Product, date: Date): Promise<any> {
    const baseFactors = await this.calculateSalesFactors(product);
    
    // Aylık faktörleri ayarla
    const month = date.getMonth() + 1;
    const seasonalMultiplier = await this.getMonthlySeasonality(product.category?.name, month);
    
    return {
      ...baseFactors,
      seasonality: seasonalMultiplier,
    };
  }

  private async getMonthlySeasonality(categoryName?: string, month?: number): Promise<number> {
    if (!categoryName || !month) return 1.0;

    // Kategori ve ay bazlı mevsimsellik
    const seasonalData: { [key: string]: { [key: number]: number } } = {
      'Electronics': {
        11: 1.4, 12: 1.6, 1: 1.2, // Kış ayları yüksek
        6: 0.8, 7: 0.8, 8: 0.9, // Yaz ayları düşük
      },
      'Sports & Outdoors': {
        3: 1.1, 4: 1.2, 5: 1.3, 6: 1.4, 7: 1.3, 8: 1.2, // Bahar-yaz yüksek
        11: 0.7, 12: 0.6, 1: 0.6, 2: 0.7, // Kış düşük
      },
    };

    return seasonalData[categoryName]?.[month] || 1.0;
  }

  private calculateGrowthRate(projections: any[]): number {
    if (projections.length < 2) return 0;

    const firstMonth = projections[0].estimatedRevenue;
    const lastMonth = projections[projections.length - 1].estimatedRevenue;

    return firstMonth > 0 ? ((lastMonth - firstMonth) / firstMonth) * 100 : 0;
  }

  private calculateTotalMarketSize(products: Product[]): number {
    // Basit pazar büyüklüğü hesaplaması
    return products.length * 1000000; // Her ürün için 1M$ varsayımı
  }

  private calculateAverageSales(products: Product[]): number {
    // Ortalama satış hesaplama
    return Math.round(Math.random() * 500 + 100); // 100-600 arası
  }

  private async calculateMarketGrowthRate(category: string): Promise<number> {
    // Kategori bazlı büyüme oranı
    const growthRates: { [key: string]: number } = {
      'Electronics': 8.5,
      'Health': 12.0,
      'Beauty': 6.5,
      'Sports': 5.0,
    };

    return growthRates[category] || 7.0; // Default %7
  }

  private calculateOpportunityScore(products: Product[]): number {
    // Fırsat skoru hesaplama
    let score = 50;

    const avgPrice = products.reduce((sum, p) => sum + (p.price || 0), 0) / products.length;
    if (avgPrice > 50) score += 10;

    const avgRating = products.reduce((sum, p) => sum + p.reviewAverage, 0) / products.length;
    if (avgRating < 4.0) score += 15; // Düşük rating = iyileştirme fırsatı

    return Math.min(score, 100);
  }

  private calculateOptimalPriceRange(products: Product[]): {
    min: number;
    max: number;
    optimal: number;
  } {
    const prices = products.map(p => p.price || 0).filter(p => p > 0);
    
    if (prices.length === 0) {
      return { min: 20, max: 100, optimal: 50 };
    }

    prices.sort((a, b) => a - b);
    const min = prices[Math.floor(prices.length * 0.25)]; // 25th percentile
    const max = prices[Math.floor(prices.length * 0.75)]; // 75th percentile
    const optimal = (min + max) / 2;

    return { min, max, optimal };
  }

  private generateBasicTrendAnalysis(productId: string): any {
    return {
      trend: 'stable' as const,
      trendStrength: 0.5,
      seasonalPatterns: [
        { month: 'January', multiplier: 1.0 },
        { month: 'February', multiplier: 0.9 },
        // ... diğer aylar
      ],
      predictions: [],
    };
  }

  private determineTrendDirection(predictions: SalesPrediction[]): 'up' | 'down' | 'stable' {
    if (predictions.length < 2) return 'stable';

    const recent = predictions.slice(-3);
    const older = predictions.slice(0, 3);

    const recentAvg = recent.reduce((sum, p) => sum + p.predictedSales, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.predictedSales, 0) / older.length;

    const change = (recentAvg - olderAvg) / olderAvg;

    if (change > 0.1) return 'up';
    if (change < -0.1) return 'down';
    return 'stable';
  }

  private calculateTrendStrength(predictions: SalesPrediction[]): number {
    // Trend gücü hesaplama (0-1 arası)
    return Math.random() * 0.5 + 0.3; // Mock implementation
  }

  private identifySeasonalPatterns(predictions: SalesPrediction[]): Array<{
    month: string;
    multiplier: number;
  }> {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return months.map(month => ({
      month,
      multiplier: Math.random() * 0.6 + 0.7, // 0.7-1.3 arası
    }));
  }

  private generateFuturePredictions(predictions: SalesPrediction[], months: number): Array<{
    date: Date;
    predictedSales: number;
    confidence: number;
  }> {
    const futurePredictions = [];
    const lastPrediction = predictions[predictions.length - 1];
    const baseSales = lastPrediction.predictedSales;

    for (let i = 1; i <= months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);

      futurePredictions.push({
        date,
        predictedSales: Math.round(baseSales * (1 + (Math.random() - 0.5) * 0.2)),
        confidence: Math.random() * 0.3 + 0.6, // 0.6-0.9 arası
      });
    }

    return futurePredictions;
  }

  private async calculatePriceElasticity(product: Product): Promise<number> {
    // Fiyat elastikiyeti hesaplama
    // Şimdilik basit bir model
    return -1.5; // Elastik talep
  }

  private async generateDemandCurve(product: Product, elasticity: number): Promise<Array<{
    price: number;
    estimatedSales: number;
    revenue: number;
    profit: number;
  }>> {
    const currentPrice = product.price || 50;
    const curve = [];

    // %50 altından %50 üstüne kadar fiyat aralığı
    for (let priceMultiplier = 0.5; priceMultiplier <= 1.5; priceMultiplier += 0.1) {
      const price = currentPrice * priceMultiplier;
      
      // Basit elastikiyet modeli
      const priceChange = (price - currentPrice) / currentPrice;
      const salesChange = elasticity * priceChange;
      const estimatedSales = Math.max(1, Math.round(100 * (1 + salesChange)));
      
      const revenue = price * estimatedSales;
      const cost = price * 0.7; // %30 margin varsayımı
      const profit = (price - cost) * estimatedSales;

      curve.push({
        price: Math.round(price * 100) / 100,
        estimatedSales,
        revenue: Math.round(revenue * 100) / 100,
        profit: Math.round(profit * 100) / 100,
      });
    }

    return curve;
  }

  private findOptimalPrice(demandCurve: any[]): number {
    // En yüksek kârı veren fiyatı bul
    let maxProfit = 0;
    let optimalPrice = 0;

    demandCurve.forEach(point => {
      if (point.profit > maxProfit) {
        maxProfit = point.profit;
        optimalPrice = point.price;
      }
    });

    return optimalPrice;
  }

  private generatePricingRecommendations(
    currentPrice: number,
    optimalPrice: number,
    demandCurve: any[]
  ): string[] {
    const recommendations: string[] = [];

    const priceDiff = optimalPrice - currentPrice;
    const diffPercent = (priceDiff / currentPrice) * 100;

    if (Math.abs(diffPercent) < 5) {
      recommendations.push('Mevcut fiyat optimal seviyeye yakın');
    } else if (diffPercent > 0) {
      recommendations.push(`Fiyatı %${Math.round(diffPercent)} artırmanız önerilir`);
    } else {
      recommendations.push(`Fiyatı %${Math.round(Math.abs(diffPercent))} düşürmeniz önerilir`);
    }

    // Revenue sweet spot
    const maxRevenue = Math.max(...demandCurve.map(p => p.revenue));
    const revenueOptimal = demandCurve.find(p => p.revenue === maxRevenue);
    
    if (revenueOptimal && Math.abs(revenueOptimal.price - optimalPrice) > 2) {
      recommendations.push(`Gelir maksimizasyonu için $${revenueOptimal.price} fiyatını da değerlendirebilirsiniz`);
    }

    return recommendations;
  }
}