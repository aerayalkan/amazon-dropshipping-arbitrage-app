import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

import { Supplier } from '../entities/supplier.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { InventoryItem } from '../entities/inventory-item.entity';

export interface SupplierPerformanceMetrics {
  supplierId: string;
  name: string;
  overallScore: number;
  orderCount: number;
  totalOrderValue: number;
  averageOrderValue: number;
  onTimeDeliveryRate: number;
  qualityScore: number;
  communicationScore: number;
  priceCompetitiveness: number;
  reliability: 'low' | 'medium' | 'high';
  recommendation: 'avoid' | 'monitor' | 'preferred' | 'top_choice';
  trends: {
    performance: 'improving' | 'stable' | 'declining';
    priceChanges: 'increasing' | 'stable' | 'decreasing';
    reliability: 'improving' | 'stable' | 'declining';
  };
}

export interface SupplierComparison {
  productName: string;
  suppliers: Array<{
    supplierId: string;
    supplierName: string;
    price: number;
    currency: string;
    leadTime: number;
    minOrderQty: number;
    qualityScore: number;
    reliabilityScore: number;
    totalCost: number;
    recommendationScore: number;
  }>;
  bestChoice: {
    supplierId: string;
    reason: string[];
  };
}

export interface MarketResearch {
  platform: string;
  keyword: string;
  suppliers: Array<{
    name: string;
    storeId: string;
    rating: number;
    totalSales: number;
    responseRate: string;
    location: string;
    verificationLevel: string;
    products: Array<{
      title: string;
      price: number;
      minOrder: number;
      imageUrl: string;
      url: string;
    }>;
  }>;
  averagePrice: number;
  priceRange: { min: number; max: number };
  topRegions: string[];
}

@Injectable()
export class SupplierManagementService {
  private readonly logger = new Logger(SupplierManagementService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SupplierProduct)
    private readonly supplierProductRepository: Repository<SupplierProduct>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Yeni tedarikçi ekle
   */
  async createSupplier(userId: string, supplierData: {
    name: string;
    platform: Supplier['platform'];
    platformUrl?: string;
    email?: string;
    phone?: string;
    country?: string;
    notes?: string;
  }): Promise<Supplier> {
    try {
      this.logger.log(`Creating supplier: ${supplierData.name} for user: ${userId}`);

      // Duplicate kontrol
      const existingSupplier = await this.supplierRepository.findOne({
        where: {
          userId,
          name: supplierData.name,
          platform: supplierData.platform,
        },
      });

      if (existingSupplier) {
        throw new Error('Bu tedarikçi zaten mevcut');
      }

      const supplier = this.supplierRepository.create({
        userId,
        ...supplierData,
        isActive: true,
      });

      const savedSupplier = await this.supplierRepository.save(supplier);

      // Platform verilerini çekmeye çalış
      try {
        await this.enrichSupplierData(savedSupplier);
      } catch (error) {
        this.logger.warn(`Could not enrich supplier data: ${error.message}`);
      }

      this.logger.log(`Supplier created: ${savedSupplier.id}`);
      return savedSupplier;
    } catch (error) {
      this.logger.error(`Error creating supplier: ${error.message}`);
      throw error;
    }
  }

  /**
   * Tedarikçi performansını analiz et
   */
  async analyzeSupplierPerformance(supplierId: string): Promise<SupplierPerformanceMetrics> {
    try {
      const supplier = await this.supplierRepository.findOne({
        where: { id: supplierId },
        relations: ['supplierProducts', 'inventoryItems'],
      });

      if (!supplier) {
        throw new Error('Tedarikçi bulunamadı');
      }

      // Performans metrikleri hesapla
      const metrics = this.calculatePerformanceMetrics(supplier);

      // Trend analizi
      const trends = await this.analyzeTrends(supplier);

      // Öneri kategorisi
      const recommendation = this.determineRecommendation(metrics, trends);

      return {
        supplierId: supplier.id,
        name: supplier.name,
        overallScore: supplier.overallScore,
        orderCount: supplier.totalOrders,
        totalOrderValue: supplier.totalOrderValue,
        averageOrderValue: supplier.averageOrderValue,
        onTimeDeliveryRate: supplier.onTimeDeliveryRate,
        qualityScore: supplier.qualityScore,
        communicationScore: supplier.communicationScore,
        priceCompetitiveness: await this.calculatePriceCompetitiveness(supplier),
        reliability: supplier.reliabilityLevel,
        recommendation,
        trends,
      };
    } catch (error) {
      this.logger.error(`Error analyzing supplier performance: ${error.message}`);
      throw error;
    }
  }

  /**
   * Tedarikçi karşılaştırması (aynı ürün için)
   */
  async compareSuppliers(productId: string): Promise<SupplierComparison> {
    try {
      const supplierProducts = await this.supplierProductRepository.find({
        where: { productId, isActive: true },
        relations: ['supplier', 'product'],
      });

      if (supplierProducts.length === 0) {
        throw new Error('Bu ürün için tedarikçi bulunamadı');
      }

      const productName = supplierProducts[0].product.title;

      const suppliers = supplierProducts.map(sp => {
        const totalCost = sp.costPerUnit;
        const recommendationScore = this.calculateSupplierRecommendationScore(sp);

        return {
          supplierId: sp.supplierId,
          supplierName: sp.supplier.name,
          price: sp.supplierPrice,
          currency: sp.supplierCurrency,
          leadTime: sp.leadTimeDays,
          minOrderQty: sp.minimumOrderQuantity,
          qualityScore: sp.qualityScore,
          reliabilityScore: sp.reliabilityScore,
          totalCost,
          recommendationScore,
        };
      });

      // En iyi seçimi belirle
      const bestChoice = this.selectBestSupplier(suppliers);

      return {
        productName,
        suppliers: suppliers.sort((a, b) => b.recommendationScore - a.recommendationScore),
        bestChoice,
      };
    } catch (error) {
      this.logger.error(`Error comparing suppliers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Otomatik tedarikçi keşfi (AliExpress, Alibaba vb.)
   */
  async discoverSuppliers(keyword: string, platform: string = 'aliexpress'): Promise<MarketResearch> {
    try {
      this.logger.log(`Discovering suppliers for keyword: ${keyword} on ${platform}`);

      let suppliers: MarketResearch['suppliers'] = [];

      switch (platform.toLowerCase()) {
        case 'aliexpress':
          suppliers = await this.searchAliExpressSuppliers(keyword);
          break;
        case 'alibaba':
          suppliers = await this.searchAlibabaSuppliers(keyword);
          break;
        default:
          throw new Error(`Platform ${platform} desteklenmiyor`);
      }

      // İstatistikler hesapla
      const prices = suppliers.flatMap(s => s.products.map(p => p.price));
      const averagePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const priceRange = {
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
      };

      const topRegions = this.getTopRegions(suppliers);

      this.logger.log(`Found ${suppliers.length} suppliers for keyword: ${keyword}`);

      return {
        platform,
        keyword,
        suppliers,
        averagePrice,
        priceRange,
        topRegions,
      };
    } catch (error) {
      this.logger.error(`Error discovering suppliers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Tedarikçi fiyatlarını güncelle
   */
  async updateSupplierPrices(supplierId: string): Promise<{
    updated: number;
    errors: Array<{ productId: string; error: string }>;
  }> {
    try {
      this.logger.log(`Updating supplier prices for: ${supplierId}`);

      const supplierProducts = await this.supplierProductRepository.find({
        where: { supplierId, isActive: true },
        relations: ['supplier'],
      });

      let updated = 0;
      const errors: Array<{ productId: string; error: string }> = [];

      for (const sp of supplierProducts) {
        try {
          const newPrice = await this.fetchLatestPrice(sp);
          
          if (newPrice && newPrice !== sp.supplierPrice) {
            sp.updatePrice(newPrice);
            await this.supplierProductRepository.save(sp);
            updated++;
            
            this.logger.log(`Updated price for product ${sp.productId}: ${sp.supplierPrice} -> ${newPrice}`);
          }
        } catch (error) {
          errors.push({
            productId: sp.productId,
            error: error.message,
          });
        }
      }

      this.logger.log(`Price update completed: ${updated} updated, ${errors.length} errors`);

      return { updated, errors };
    } catch (error) {
      this.logger.error(`Error updating supplier prices: ${error.message}`);
      throw error;
    }
  }

  /**
   * Tedarikçi güvenilirlik skoru hesapla
   */
  async calculateSupplierReliability(supplierId: string): Promise<{
    reliabilityScore: number;
    factors: Array<{
      factor: string;
      score: number;
      weight: number;
      impact: 'positive' | 'negative' | 'neutral';
    }>;
    recommendation: string;
  }> {
    try {
      const supplier = await this.supplierRepository.findOne({
        where: { id: supplierId },
        relations: ['supplierProducts'],
      });

      if (!supplier) {
        throw new Error('Tedarikçi bulunamadı');
      }

      const factors = [
        {
          factor: 'Verification Level',
          score: this.getVerificationScore(supplier.verificationLevel),
          weight: 0.2,
          impact: 'positive' as const,
        },
        {
          factor: 'Order History',
          score: this.getOrderHistoryScore(supplier.totalOrders),
          weight: 0.25,
          impact: 'positive' as const,
        },
        {
          factor: 'On-time Delivery',
          score: supplier.onTimeDeliveryRate,
          weight: 0.25,
          impact: 'positive' as const,
        },
        {
          factor: 'Quality Score',
          score: supplier.qualityScore,
          weight: 0.15,
          impact: 'positive' as const,
        },
        {
          factor: 'Communication',
          score: supplier.communicationScore,
          weight: 0.15,
          impact: 'positive' as const,
        },
      ];

      // Weighted average hesapla
      const reliabilityScore = factors.reduce((total, factor) => {
        return total + (factor.score * factor.weight);
      }, 0);

      // Öneri oluştur
      let recommendation = 'Güvenilir tedarikçi';
      if (reliabilityScore < 50) {
        recommendation = 'Yüksek riskli - dikkatli olun';
      } else if (reliabilityScore < 70) {
        recommendation = 'Orta güvenilirlik - takip edin';
      } else if (reliabilityScore >= 85) {
        recommendation = 'Çok güvenilir - öncelikli tedarikçi';
      }

      return {
        reliabilityScore: Math.round(reliabilityScore),
        factors,
        recommendation,
      };
    } catch (error) {
      this.logger.error(`Error calculating supplier reliability: ${error.message}`);
      throw error;
    }
  }

  /**
   * Tedarikçi önerileri al
   */
  async getSupplierRecommendations(userId: string, criteria?: {
    category?: string;
    maxPrice?: number;
    minRating?: number;
    country?: string;
  }): Promise<Array<{
    supplier: Supplier;
    matchScore: number;
    reasons: string[];
    availableProducts: number;
  }>> {
    try {
      let query = this.supplierRepository.createQueryBuilder('supplier')
        .where('supplier.userId = :userId', { userId })
        .andWhere('supplier.isActive = :isActive', { isActive: true })
        .leftJoinAndSelect('supplier.supplierProducts', 'products');

      // Kriterleri uygula
      if (criteria?.minRating) {
        query = query.andWhere('supplier.rating >= :minRating', { minRating: criteria.minRating });
      }

      if (criteria?.country) {
        query = query.andWhere('supplier.country = :country', { country: criteria.country });
      }

      const suppliers = await query.getMany();

      const recommendations = suppliers.map(supplier => {
        const matchScore = this.calculateMatchScore(supplier, criteria);
        const reasons = this.generateRecommendationReasons(supplier, criteria);
        const availableProducts = supplier.supplierProducts?.filter(p => p.isActive).length || 0;

        return {
          supplier,
          matchScore,
          reasons,
          availableProducts,
        };
      });

      // Skor bazında sırala
      return recommendations
        .filter(rec => rec.matchScore > 50) // Minimum threshold
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 10); // Top 10
    } catch (error) {
      this.logger.error(`Error getting supplier recommendations: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private async enrichSupplierData(supplier: Supplier): Promise<void> {
    try {
      if (supplier.platformUrl) {
        // Platform verilerini çekmeye çalış
        const platformData = await this.fetchPlatformData(supplier.platformUrl, supplier.platform);
        
        if (platformData) {
          supplier.rating = platformData.rating || supplier.rating;
          supplier.verificationLevel = platformData.verificationLevel || supplier.verificationLevel;
          supplier.responseTimeHours = platformData.responseTime || supplier.responseTimeHours;
          
          await this.supplierRepository.save(supplier);
        }
      }
    } catch (error) {
      this.logger.warn(`Could not enrich supplier data: ${error.message}`);
    }
  }

  private calculatePerformanceMetrics(supplier: Supplier): any {
    return {
      orderPerformance: supplier.totalOrders > 0 ? 'good' : 'new',
      deliveryPerformance: supplier.onTimeDeliveryRate >= 90 ? 'excellent' : 
                          supplier.onTimeDeliveryRate >= 75 ? 'good' : 'needs_improvement',
      qualityPerformance: supplier.qualityScore >= 80 ? 'excellent' :
                         supplier.qualityScore >= 60 ? 'good' : 'needs_improvement',
      communicationPerformance: supplier.communicationScore >= 80 ? 'excellent' :
                               supplier.communicationScore >= 60 ? 'good' : 'needs_improvement',
    };
  }

  private async analyzeTrends(supplier: Supplier): Promise<SupplierPerformanceMetrics['trends']> {
    // Simplified trend analysis - in a real implementation, this would analyze historical data
    return {
      performance: 'stable',
      priceChanges: 'stable',
      reliability: 'stable',
    };
  }

  private determineRecommendation(metrics: any, trends: any): SupplierPerformanceMetrics['recommendation'] {
    // Simplified recommendation logic
    if (metrics.qualityPerformance === 'excellent' && metrics.deliveryPerformance === 'excellent') {
      return 'top_choice';
    } else if (metrics.qualityPerformance === 'good' && metrics.deliveryPerformance === 'good') {
      return 'preferred';
    } else if (metrics.qualityPerformance === 'needs_improvement' || metrics.deliveryPerformance === 'needs_improvement') {
      return 'monitor';
    } else {
      return 'avoid';
    }
  }

  private async calculatePriceCompetitiveness(supplier: Supplier): Promise<number> {
    // Simplified price competitiveness calculation
    return Math.random() * 100; // In real implementation, compare with market prices
  }

  private calculateSupplierRecommendationScore(supplierProduct: SupplierProduct): number {
    let score = 0;

    // Fiyat faktörü (düşük fiyat = yüksek skor)
    score += Math.max(0, 100 - (supplierProduct.supplierPrice / 10)); // Normalize price

    // Kalite faktörü
    score += supplierProduct.qualityScore * 0.3;

    // Güvenilirlik faktörü
    score += supplierProduct.reliabilityScore * 0.4;

    // Teslimat süresi faktörü (hızlı teslimat = yüksek skor)
    score += Math.max(0, 100 - (supplierProduct.leadTimeDays * 5));

    // Minimum sipariş miktarı faktörü
    score += Math.max(0, 100 - (supplierProduct.minimumOrderQuantity * 2));

    return Math.min(score, 100);
  }

  private selectBestSupplier(suppliers: Array<any>): { supplierId: string; reason: string[] } {
    const bestSupplier = suppliers.reduce((best, current) => 
      current.recommendationScore > best.recommendationScore ? current : best
    );

    const reasons: string[] = [];
    
    if (bestSupplier.qualityScore >= 80) reasons.push('Yüksek kalite skoru');
    if (bestSupplier.reliabilityScore >= 80) reasons.push('Yüksek güvenilirlik');
    if (bestSupplier.leadTime <= 7) reasons.push('Hızlı teslimat');
    if (bestSupplier.price === Math.min(...suppliers.map(s => s.price))) reasons.push('En düşük fiyat');

    return {
      supplierId: bestSupplier.supplierId,
      reason: reasons,
    };
  }

  private async searchAliExpressSuppliers(keyword: string): Promise<MarketResearch['suppliers']> {
    // Mock implementation - in real scenario, use AliExpress API or scraping
    return [
      {
        name: 'Sample Electronics Store',
        storeId: 'store123',
        rating: 4.8,
        totalSales: 10000,
        responseRate: '98%',
        location: 'Guangdong, China',
        verificationLevel: 'verified',
        products: [
          {
            title: `${keyword} - Premium Quality`,
            price: 25.99,
            minOrder: 1,
            imageUrl: 'https://example.com/image.jpg',
            url: 'https://aliexpress.com/item/123',
          },
        ],
      },
    ];
  }

  private async searchAlibabaSuppliers(keyword: string): Promise<MarketResearch['suppliers']> {
    // Mock implementation
    return [
      {
        name: 'Wholesale Factory Direct',
        storeId: 'factory456',
        rating: 4.5,
        totalSales: 50000,
        responseRate: '95%',
        location: 'Zhejiang, China',
        verificationLevel: 'gold',
        products: [
          {
            title: `${keyword} - Bulk Orders`,
            price: 12.50,
            minOrder: 100,
            imageUrl: 'https://example.com/factory-image.jpg',
            url: 'https://alibaba.com/product/456',
          },
        ],
      },
    ];
  }

  private getTopRegions(suppliers: MarketResearch['suppliers']): string[] {
    const regionCounts = new Map<string, number>();
    
    suppliers.forEach(supplier => {
      const region = supplier.location.split(',')[0];
      regionCounts.set(region, (regionCounts.get(region) || 0) + 1);
    });

    return Array.from(regionCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([region]) => region);
  }

  private async fetchLatestPrice(supplierProduct: SupplierProduct): Promise<number | null> {
    try {
      // Mock implementation - in real scenario, scrape or use API
      // Return a slightly different price to simulate real price changes
      const variation = 0.95 + (Math.random() * 0.1); // ±5% variation
      return Math.round(supplierProduct.supplierPrice * variation * 100) / 100;
    } catch (error) {
      this.logger.warn(`Could not fetch latest price: ${error.message}`);
      return null;
    }
  }

  private async fetchPlatformData(url: string, platform: string): Promise<any> {
    try {
      // Mock implementation
      return {
        rating: 4.0 + Math.random(),
        verificationLevel: 'verified',
        responseTime: Math.floor(Math.random() * 24) + 1,
      };
    } catch (error) {
      this.logger.warn(`Could not fetch platform data: ${error.message}`);
      return null;
    }
  }

  private getVerificationScore(level: Supplier['verificationLevel']): number {
    const scores = {
      unverified: 20,
      standard: 40,
      silver: 60,
      gold: 80,
      verified: 100,
    };
    return scores[level] || 40;
  }

  private getOrderHistoryScore(orderCount: number): number {
    if (orderCount === 0) return 0;
    if (orderCount < 5) return 30;
    if (orderCount < 20) return 60;
    if (orderCount < 50) return 80;
    return 100;
  }

  private calculateMatchScore(supplier: Supplier, criteria?: any): number {
    let score = 50; // Base score

    // Rating factor
    score += supplier.rating * 10;

    // Reliability factor
    if (supplier.reliabilityLevel === 'high') score += 20;
    else if (supplier.reliabilityLevel === 'medium') score += 10;

    // Verification factor
    if (supplier.verificationLevel === 'verified' || supplier.verificationLevel === 'gold') {
      score += 15;
    }

    // Order history factor
    if (supplier.totalOrders > 10) score += 10;

    return Math.min(score, 100);
  }

  private generateRecommendationReasons(supplier: Supplier, criteria?: any): string[] {
    const reasons: string[] = [];

    if (supplier.rating >= 4.5) reasons.push('Yüksek rating');
    if (supplier.reliabilityLevel === 'high') reasons.push('Yüksek güvenilirlik');
    if (supplier.onTimeDeliveryRate >= 90) reasons.push('Zamanında teslimat');
    if (supplier.verificationLevel === 'verified') reasons.push('Doğrulanmış tedarikçi');
    if (supplier.totalOrders > 20) reasons.push('Deneyimli tedarikçi');

    return reasons;
  }
}