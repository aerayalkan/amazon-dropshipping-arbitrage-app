import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CompetitorProduct, CompetitorStatus, DataSource } from '../entities/competitor-product.entity';
import { PriceHistory, PriceChangeReason } from '../entities/price-history.entity';

export interface CompetitorScrapeResult {
  asin: string;
  competitors: Array<{
    sellerId?: string;
    sellerName: string;
    price: number;
    shippingCost?: number;
    totalCost: number;
    isPrime: boolean;
    fulfillmentType: 'FBA' | 'FBM' | 'PRIME';
    buyBoxWinner: boolean;
    inStock: boolean;
    sellerRating?: number;
    feedbackCount?: number;
    location?: string;
  }>;
  metadata: {
    scrapedAt: Date;
    source: string;
    responseTime: number;
    totalOffers: number;
  };
}

export interface MonitoringAlert {
  type: 'price_drop' | 'price_increase' | 'new_competitor' | 'competitor_out_of_stock' | 'buy_box_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  asin: string;
  competitorName: string;
  message: string;
  data: any;
  timestamp: Date;
}

@Injectable()
export class CompetitorMonitoringService {
  private readonly logger = new Logger(CompetitorMonitoringService.name);
  private isScrapingActive = false;

  constructor(
    @InjectRepository(CompetitorProduct)
    private readonly competitorRepository: Repository<CompetitorProduct>,
    @InjectRepository(PriceHistory)
    private readonly priceHistoryRepository: Repository<PriceHistory>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Otomatik competitor monitoring - her 30 dakikada çalışır
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async runScheduledMonitoring(): Promise<void> {
    if (this.isScrapingActive) {
      this.logger.warn('Competitor monitoring already in progress');
      return;
    }

    try {
      this.isScrapingActive = true;
      this.logger.log('Starting scheduled competitor monitoring');

      // Get competitors that need updating
      const competitorsToUpdate = await this.getCompetitorsForUpdate();
      
      const results = await this.monitorCompetitors(competitorsToUpdate);
      
      this.logger.log(`Completed competitor monitoring: ${results.updated} updated, ${results.errors} errors`);

    } catch (error) {
      this.logger.error(`Error in scheduled competitor monitoring: ${error.message}`);
    } finally {
      this.isScrapingActive = false;
    }
  }

  /**
   * Belirli ASIN'ler için competitor monitoring
   */
  async monitorASINs(
    userId: string,
    asins: string[],
    options?: {
      forceUpdate?: boolean;
      includeNewCompetitors?: boolean;
    }
  ): Promise<{
    results: CompetitorScrapeResult[];
    alerts: MonitoringAlert[];
    summary: {
      totalASINs: number;
      totalCompetitors: number;
      priceChanges: number;
      newCompetitors: number;
      errors: number;
    };
  }> {
    this.logger.log(`Monitoring ${asins.length} ASINs for user ${userId}`);

    const results: CompetitorScrapeResult[] = [];
    const alerts: MonitoringAlert[] = [];
    const summary = {
      totalASINs: asins.length,
      totalCompetitors: 0,
      priceChanges: 0,
      newCompetitors: 0,
      errors: 0,
    };

    for (const asin of asins) {
      try {
        const scrapeResult = await this.scrapeCompetitors(asin);
        results.push(scrapeResult);

        // Process the results
        const processResult = await this.processCompetitorData(userId, scrapeResult, options);
        
        summary.totalCompetitors += processResult.competitorsProcessed;
        summary.priceChanges += processResult.priceChanges;
        summary.newCompetitors += processResult.newCompetitors;
        
        alerts.push(...processResult.alerts);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        this.logger.error(`Error monitoring ASIN ${asin}: ${error.message}`);
        summary.errors++;
      }
    }

    return { results, alerts, summary };
  }

  /**
   * Yeni competitor ekleme
   */
  async addCompetitor(
    userId: string,
    competitorData: {
      asin: string;
      sellerName: string;
      sellerId?: string;
      initialPrice?: number;
      monitoringFrequency?: number;
      alertSettings?: any;
    }
  ): Promise<CompetitorProduct> {
    this.logger.log(`Adding new competitor: ${competitorData.sellerName} for ASIN ${competitorData.asin}`);

    // Check if competitor already exists
    const existing = await this.competitorRepository.findOne({
      where: {
        userId,
        asin: competitorData.asin,
        sellerName: competitorData.sellerName,
      },
    });

    if (existing) {
      throw new Error('Competitor already exists');
    }

    // Scrape initial data if no price provided
    let initialPrice = competitorData.initialPrice;
    if (!initialPrice) {
      try {
        const scrapeResult = await this.scrapeCompetitors(competitorData.asin);
        const competitor = scrapeResult.competitors.find(c => 
          c.sellerName === competitorData.sellerName ||
          c.sellerId === competitorData.sellerId
        );
        
        if (competitor) {
          initialPrice = competitor.price;
        } else {
          throw new Error('Competitor not found in current listings');
        }
      } catch (error) {
        this.logger.warn(`Could not scrape initial price for ${competitorData.sellerName}: ${error.message}`);
        throw new Error('Unable to find competitor price');
      }
    }

    // Create competitor entry
    const competitor = this.competitorRepository.create({
      userId,
      asin: competitorData.asin,
      sellerName: competitorData.sellerName,
      sellerId: competitorData.sellerId,
      currentPrice: initialPrice!,
      productTitle: `Product ${competitorData.asin}`, // Would fetch actual title
      monitoringFrequency: competitorData.monitoringFrequency || 60,
      alertSettings: competitorData.alertSettings,
      dataSource: DataSource.WEB_SCRAPING,
      isMonitored: true,
      lastScrapedAt: new Date(),
      nextScrapeAt: new Date(Date.now() + (competitorData.monitoringFrequency || 60) * 60 * 1000),
      competitorStatus: CompetitorStatus.ACTIVE,
      isInStock: true,
    });

    const saved = await this.competitorRepository.save(competitor);

    // Create initial price history entry
    await this.createPriceHistoryEntry(saved, null, 'Initial tracking setup');

    return saved;
  }

  /**
   * Competitor monitoring ayarlarını güncelle
   */
  async updateCompetitorSettings(
    userId: string,
    competitorId: string,
    updates: {
      monitoringFrequency?: number;
      isMonitored?: boolean;
      alertSettings?: any;
      tags?: string[];
      notes?: string;
    }
  ): Promise<CompetitorProduct> {
    const competitor = await this.competitorRepository.findOne({
      where: { id: competitorId, userId },
    });

    if (!competitor) {
      throw new Error('Competitor not found');
    }

    // Update fields
    if (updates.monitoringFrequency !== undefined) {
      competitor.monitoringFrequency = updates.monitoringFrequency;
      // Update next scrape time
      competitor.nextScrapeAt = new Date(Date.now() + updates.monitoringFrequency * 60 * 1000);
    }

    if (updates.isMonitored !== undefined) {
      competitor.isMonitored = updates.isMonitored;
    }

    if (updates.alertSettings !== undefined) {
      competitor.alertSettings = updates.alertSettings;
    }

    if (updates.tags !== undefined) {
      competitor.tags = updates.tags;
    }

    if (updates.notes !== undefined) {
      competitor.notes = updates.notes;
    }

    return this.competitorRepository.save(competitor);
  }

  /**
   * Competitor listesi getirme
   */
  async getCompetitors(
    userId: string,
    filters?: {
      asin?: string;
      sellerName?: string;
      isMonitored?: boolean;
      competitorStatus?: CompetitorStatus;
      tags?: string[];
      priceRange?: { min: number; max: number };
    }
  ): Promise<{
    competitors: CompetitorProduct[];
    analytics: {
      totalCompetitors: number;
      monitoredCompetitors: number;
      averagePrice: number;
      priceRange: { min: number; max: number };
      topCompetitors: CompetitorProduct[];
    };
  }> {
    let query = this.competitorRepository.createQueryBuilder('competitor')
      .where('competitor.userId = :userId', { userId });

    if (filters?.asin) {
      query = query.andWhere('competitor.asin = :asin', { asin: filters.asin });
    }

    if (filters?.sellerName) {
      query = query.andWhere('competitor.sellerName ILIKE :sellerName', { 
        sellerName: `%${filters.sellerName}%` 
      });
    }

    if (filters?.isMonitored !== undefined) {
      query = query.andWhere('competitor.isMonitored = :isMonitored', { 
        isMonitored: filters.isMonitored 
      });
    }

    if (filters?.competitorStatus) {
      query = query.andWhere('competitor.competitorStatus = :status', { 
        status: filters.competitorStatus 
      });
    }

    if (filters?.priceRange) {
      query = query.andWhere('competitor.currentPrice BETWEEN :minPrice AND :maxPrice', {
        minPrice: filters.priceRange.min,
        maxPrice: filters.priceRange.max,
      });
    }

    const competitors = await query
      .orderBy('competitor.lastScrapedAt', 'DESC')
      .getMany();

    // Calculate analytics
    const totalCompetitors = competitors.length;
    const monitoredCompetitors = competitors.filter(c => c.isMonitored).length;
    const prices = competitors.map(c => c.currentPrice);
    const averagePrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
    const priceRange = {
      min: prices.length > 0 ? Math.min(...prices) : 0,
      max: prices.length > 0 ? Math.max(...prices) : 0,
    };

    const topCompetitors = competitors
      .filter(c => c.isReliableCompetitor())
      .sort((a, b) => (b.performanceMetrics?.competitiveIndex || 0) - (a.performanceMetrics?.competitiveIndex || 0))
      .slice(0, 5);

    return {
      competitors,
      analytics: {
        totalCompetitors,
        monitoredCompetitors,
        averagePrice,
        priceRange,
        topCompetitors,
      },
    };
  }

  /**
   * Competitor price history analizi
   */
  async getCompetitorPriceHistory(
    userId: string,
    competitorId: string,
    period: 'week' | 'month' | 'quarter' = 'month'
  ): Promise<{
    history: PriceHistory[];
    analytics: {
      priceChanges: number;
      averagePrice: number;
      volatility: number;
      trend: 'upward' | 'downward' | 'stable' | 'volatile';
      buyBoxPercentage: number;
    };
  }> {
    const competitor = await this.competitorRepository.findOne({
      where: { id: competitorId, userId },
    });

    if (!competitor) {
      throw new Error('Competitor not found');
    }

    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
    }

    const history = await this.priceHistoryRepository.find({
      where: {
        userId,
        asin: competitor.asin,
        sellerName: competitor.sellerName,
        timestamp: Between(startDate, endDate),
      },
      order: { timestamp: 'ASC' },
    });

    // Calculate analytics
    const priceChanges = history.filter(h => h.isSignificantChange()).length;
    const prices = history.map(h => h.price);
    const averagePrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 0;
    const volatility = PriceHistory.calculatePriceVolatility(history);
    const trend = PriceHistory.findPriceTrend(history);
    const buyBoxEntries = history.filter(h => h.buyBoxWinner).length;
    const buyBoxPercentage = history.length > 0 ? (buyBoxEntries / history.length) * 100 : 0;

    return {
      history,
      analytics: {
        priceChanges,
        averagePrice,
        volatility,
        trend,
        buyBoxPercentage,
      },
    };
  }

  // Private helper methods
  private async getCompetitorsForUpdate(): Promise<CompetitorProduct[]> {
    const now = new Date();
    
    return this.competitorRepository.find({
      where: {
        isMonitored: true,
        nextScrapeAt: Between(new Date(0), now),
        consecutiveErrors: Between(0, 5), // Skip competitors with too many errors
      },
      order: { nextScrapeAt: 'ASC' },
      take: 100, // Limit batch size
    });
  }

  private async monitorCompetitors(
    competitors: CompetitorProduct[]
  ): Promise<{ updated: number; errors: number }> {
    let updated = 0;
    let errors = 0;

    // Group by ASIN to minimize scraping
    const asinGroups = competitors.reduce((groups, competitor) => {
      if (!groups[competitor.asin]) {
        groups[competitor.asin] = [];
      }
      groups[competitor.asin].push(competitor);
      return groups;
    }, {} as { [asin: string]: CompetitorProduct[] });

    for (const [asin, competitorGroup] of Object.entries(asinGroups)) {
      try {
        const scrapeResult = await this.scrapeCompetitors(asin);
        
        for (const competitor of competitorGroup) {
          try {
            await this.updateCompetitorFromScrape(competitor, scrapeResult);
            updated++;
          } catch (error) {
            this.logger.error(`Error updating competitor ${competitor.id}: ${error.message}`);
            competitor.recordError(error.message);
            await this.competitorRepository.save(competitor);
            errors++;
          }
        }

        // Delay between ASINs
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        this.logger.error(`Error scraping ASIN ${asin}: ${error.message}`);
        
        // Mark all competitors in this group as having errors
        for (const competitor of competitorGroup) {
          competitor.recordError(`Scraping failed: ${error.message}`);
          await this.competitorRepository.save(competitor);
        }
        
        errors += competitorGroup.length;
      }
    }

    return { updated, errors };
  }

  private async scrapeCompetitors(asin: string): Promise<CompetitorScrapeResult> {
    const startTime = Date.now();
    
    try {
      // Mock scraping implementation - in production would use real scraping
      const mockCompetitors = [
        {
          sellerName: 'Amazon.com',
          price: 29.99,
          totalCost: 29.99,
          isPrime: true,
          fulfillmentType: 'FBA' as const,
          buyBoxWinner: true,
          inStock: true,
          sellerRating: 100,
        },
        {
          sellerName: 'Example Seller',
          price: 28.95,
          totalCost: 33.94,
          shippingCost: 4.99,
          isPrime: false,
          fulfillmentType: 'FBM' as const,
          buyBoxWinner: false,
          inStock: true,
          sellerRating: 95.5,
        },
      ];

      return {
        asin,
        competitors: mockCompetitors,
        metadata: {
          scrapedAt: new Date(),
          source: 'mock_scraper',
          responseTime: Date.now() - startTime,
          totalOffers: mockCompetitors.length,
        },
      };

    } catch (error) {
      throw new Error(`Scraping failed for ASIN ${asin}: ${error.message}`);
    }
  }

  private async updateCompetitorFromScrape(
    competitor: CompetitorProduct,
    scrapeResult: CompetitorScrapeResult
  ): Promise<void> {
    // Find our competitor in the scrape results
    const scraped = scrapeResult.competitors.find(c => 
      c.sellerName === competitor.sellerName ||
      (competitor.sellerId && c.sellerId === competitor.sellerId)
    );

    if (!scraped) {
      // Competitor not found - might be out of stock
      competitor.competitorStatus = CompetitorStatus.OUT_OF_STOCK;
      competitor.isInStock = false;
      competitor.outOfStockCount++;
      competitor.lastScrapedAt = scrapeResult.metadata.scrapedAt;
      competitor.scrapeCount++;
      return;
    }

    // Check for price change
    const oldPrice = competitor.currentPrice;
    const priceChanged = Math.abs(scraped.price - oldPrice) > 0.01;

    // Update competitor data
    competitor.updatePrice(scraped.price, {
      buyBoxWinner: scraped.buyBoxWinner,
      inStock: scraped.inStock,
      shippingPrice: scraped.shippingCost,
      dataSource: DataSource.WEB_SCRAPING,
    });

    if (scraped.sellerRating) {
      competitor.sellerFeedbackPercentage = scraped.sellerRating;
    }

    // Create price history entry if price changed
    if (priceChanged) {
      await this.createPriceHistoryEntry(
        competitor, 
        oldPrice, 
        'Competitor price monitoring'
      );
    }

    await this.competitorRepository.save(competitor);
  }

  private async processCompetitorData(
    userId: string,
    scrapeResult: CompetitorScrapeResult,
    options?: { includeNewCompetitors?: boolean }
  ): Promise<{
    competitorsProcessed: number;
    priceChanges: number;
    newCompetitors: number;
    alerts: MonitoringAlert[];
  }> {
    const alerts: MonitoringAlert[] = [];
    let competitorsProcessed = 0;
    let priceChanges = 0;
    let newCompetitors = 0;

    // Get existing competitors for this ASIN
    const existingCompetitors = await this.competitorRepository.find({
      where: { userId, asin: scrapeResult.asin },
    });

    for (const scrapedCompetitor of scrapeResult.competitors) {
      const existing = existingCompetitors.find(c => 
        c.sellerName === scrapedCompetitor.sellerName ||
        (c.sellerId && c.sellerId === scrapedCompetitor.sellerId)
      );

      if (existing) {
        // Update existing competitor
        const oldPrice = existing.currentPrice;
        const priceChanged = Math.abs(scrapedCompetitor.price - oldPrice) > 0.01;

        if (priceChanged) {
          priceChanges++;
          
          // Generate price change alert
          const changePercent = ((scrapedCompetitor.price - oldPrice) / oldPrice) * 100;
          alerts.push({
            type: scrapedCompetitor.price < oldPrice ? 'price_drop' : 'price_increase',
            severity: Math.abs(changePercent) > 10 ? 'high' : Math.abs(changePercent) > 5 ? 'medium' : 'low',
            asin: scrapeResult.asin,
            competitorName: scrapedCompetitor.sellerName,
            message: `Price ${scrapedCompetitor.price < oldPrice ? 'dropped' : 'increased'} from $${oldPrice} to $${scrapedCompetitor.price} (${changePercent.toFixed(1)}%)`,
            data: { oldPrice, newPrice: scrapedCompetitor.price, changePercent },
            timestamp: scrapeResult.metadata.scrapedAt,
          });
        }

        await this.updateCompetitorFromScrape(existing, scrapeResult);
        competitorsProcessed++;

      } else if (options?.includeNewCompetitors) {
        // Add new competitor
        const newCompetitor = await this.addCompetitor(userId, {
          asin: scrapeResult.asin,
          sellerName: scrapedCompetitor.sellerName,
          sellerId: scrapedCompetitor.sellerId,
          initialPrice: scrapedCompetitor.price,
        });

        newCompetitors++;
        
        alerts.push({
          type: 'new_competitor',
          severity: 'medium',
          asin: scrapeResult.asin,
          competitorName: scrapedCompetitor.sellerName,
          message: `New competitor detected: ${scrapedCompetitor.sellerName} at $${scrapedCompetitor.price}`,
          data: { price: scrapedCompetitor.price, prime: scrapedCompetitor.isPrime },
          timestamp: scrapeResult.metadata.scrapedAt,
        });
      }
    }

    return { competitorsProcessed, priceChanges, newCompetitors, alerts };
  }

  private async createPriceHistoryEntry(
    competitor: CompetitorProduct,
    previousPrice: number | null,
    reason: string
  ): Promise<void> {
    const entry = PriceHistory.createPriceEntry({
      userId: competitor.userId,
      asin: competitor.asin,
      sellerName: competitor.sellerName,
      price: competitor.currentPrice,
      previousPrice,
      buyBoxWinner: competitor.buyBoxWinner,
      reason: PriceChangeReason.COMPETITOR_RESPONSE,
      source: competitor.dataSource,
    });

    await this.priceHistoryRepository.save(entry);
  }
}