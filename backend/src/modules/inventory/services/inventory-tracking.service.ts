import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { InventoryItem } from '../entities/inventory-item.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockAlert } from '../entities/stock-alert.entity';
import { StockAlertService } from './stock-alert.service';

export interface StockMetrics {
  totalValue: number;
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  overstockItems: number;
  averageTurnover: number;
  healthScore: number;
}

export interface StockMovementSummary {
  period: string;
  totalMovements: number;
  inboundMovements: number;
  outboundMovements: number;
  adjustments: number;
  valueIn: number;
  valueOut: number;
  netChange: number;
}

export interface InventoryForecast {
  productId: string;
  currentStock: number;
  predictedStockIn7Days: number;
  predictedStockIn30Days: number;
  reorderRecommendation: {
    shouldReorder: boolean;
    recommendedQuantity: number;
    urgency: 'low' | 'medium' | 'high';
    reasoning: string[];
  };
  riskFactors: string[];
}

@Injectable()
export class InventoryTrackingService {
  private readonly logger = new Logger(InventoryTrackingService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(StockAlert)
    private readonly alertRepository: Repository<StockAlert>,
    private readonly stockAlertService: StockAlertService,
  ) {}

  /**
   * Gerçek zamanlı stok takibi - stok seviyesi güncelle
   */
  async updateStockLevel(
    inventoryItemId: string,
    newLevel: number,
    movementType: StockMovement['movementType'],
    reason: string,
    metadata?: any
  ): Promise<{
    inventoryItem: InventoryItem;
    movement: StockMovement;
    alertsTriggered: StockAlert[];
  }> {
    try {
      this.logger.log(`Updating stock level for item ${inventoryItemId}: ${newLevel}`);

      const inventoryItem = await this.inventoryRepository.findOne({
        where: { id: inventoryItemId },
        relations: ['user', 'product'],
      });

      if (!inventoryItem) {
        throw new Error('Inventory item not found');
      }

      const previousLevel = inventoryItem.stockLevel;
      const quantity = newLevel - previousLevel;

      // Stok seviyesini güncelle
      inventoryItem.updateStockLevel(newLevel, reason);

      // Stock movement kaydı oluştur
      const movementData = {
        userId: inventoryItem.userId,
        inventoryItemId: inventoryItem.id,
        movementType,
        quantity,
        previousStock: previousLevel,
        newStock: newLevel,
        reason,
        source: 'system' as const,
        metadata,
      };

      const movement = this.movementRepository.create(movementData);

      // Veritabanını güncelle
      const [savedItem, savedMovement] = await Promise.all([
        this.inventoryRepository.save(inventoryItem),
        this.movementRepository.save(movement),
      ]);

      // Uyarıları kontrol et ve oluştur
      const alertsTriggered = await this.checkAndCreateAlerts(savedItem);

      this.logger.log(`Stock updated: ${previousLevel} -> ${newLevel} for item ${inventoryItemId}`);

      return {
        inventoryItem: savedItem,
        movement: savedMovement,
        alertsTriggered,
      };
    } catch (error) {
      this.logger.error(`Error updating stock level: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stok rezervasyonu (sipariş alındığında)
   */
  async reserveStock(inventoryItemId: string, quantity: number, orderId: string): Promise<boolean> {
    try {
      const inventoryItem = await this.inventoryRepository.findOne({
        where: { id: inventoryItemId },
      });

      if (!inventoryItem) {
        throw new Error('Inventory item not found');
      }

      const success = inventoryItem.reserveStock(quantity);

      if (success) {
        // Stock movement kaydı
        await this.createStockMovement({
          userId: inventoryItem.userId,
          inventoryItemId: inventoryItem.id,
          movementType: 'reservation',
          quantity: -quantity,
          previousStock: inventoryItem.stockLevel,
          newStock: inventoryItem.stockLevel, // Stock level değişmiyor, sadece rezervasyon
          reason: `Sipariş rezervasyonu: ${orderId}`,
          referenceId: orderId,
          referenceType: 'order',
          metadata: { orderId },
        });

        await this.inventoryRepository.save(inventoryItem);
        this.logger.log(`Reserved ${quantity} units for order ${orderId}`);
      }

      return success;
    } catch (error) {
      this.logger.error(`Error reserving stock: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stok rezervasyonunu serbest bırak
   */
  async releaseReservation(inventoryItemId: string, quantity: number, orderId: string): Promise<void> {
    try {
      const inventoryItem = await this.inventoryRepository.findOne({
        where: { id: inventoryItemId },
      });

      if (!inventoryItem) {
        throw new Error('Inventory item not found');
      }

      inventoryItem.releaseStock(quantity);

      // Stock movement kaydı
      await this.createStockMovement({
        userId: inventoryItem.userId,
        inventoryItemId: inventoryItem.id,
        movementType: 'release_reservation',
        quantity: quantity,
        previousStock: inventoryItem.stockLevel,
        newStock: inventoryItem.stockLevel,
        reason: `Rezervasyon iptali: ${orderId}`,
        referenceId: orderId,
        referenceType: 'order',
        metadata: { orderId },
      });

      await this.inventoryRepository.save(inventoryItem);
      this.logger.log(`Released ${quantity} units reservation for order ${orderId}`);
    } catch (error) {
      this.logger.error(`Error releasing reservation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toplu stok güncelleme
   */
  async bulkUpdateStock(updates: Array<{
    inventoryItemId: string;
    newLevel: number;
    reason: string;
  }>): Promise<{
    successful: number;
    failed: Array<{ inventoryItemId: string; error: string }>;
  }> {
    try {
      this.logger.log(`Bulk updating ${updates.length} inventory items`);

      let successful = 0;
      const failed: Array<{ inventoryItemId: string; error: string }> = [];

      for (const update of updates) {
        try {
          await this.updateStockLevel(
            update.inventoryItemId,
            update.newLevel,
            'adjustment',
            update.reason
          );
          successful++;
        } catch (error) {
          failed.push({
            inventoryItemId: update.inventoryItemId,
            error: error.message,
          });
        }
      }

      this.logger.log(`Bulk update completed: ${successful} successful, ${failed.length} failed`);

      return { successful, failed };
    } catch (error) {
      this.logger.error(`Error in bulk stock update: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stok metrikleri hesapla
   */
  async getStockMetrics(userId: string): Promise<StockMetrics> {
    try {
      const inventoryItems = await this.inventoryRepository.find({
        where: { userId, isActive: true },
      });

      const totalValue = inventoryItems.reduce((sum, item) => sum + item.stockValue, 0);
      const totalItems = inventoryItems.length;
      const lowStockItems = inventoryItems.filter(item => item.stockStatus === 'low_stock').length;
      const outOfStockItems = inventoryItems.filter(item => item.stockStatus === 'out_of_stock').length;
      const overstockItems = inventoryItems.filter(item => item.stockLevel > item.maximumStock).length;

      // Ortalama turnover hesapla
      const turnovers = inventoryItems.map(item => item.turnoverRate).filter(rate => rate > 0);
      const averageTurnover = turnovers.length > 0 
        ? turnovers.reduce((sum, rate) => sum + rate, 0) / turnovers.length 
        : 0;

      // Health score hesapla
      const healthScores = inventoryItems.map(item => item.stockHealthScore);
      const healthScore = healthScores.length > 0
        ? healthScores.reduce((sum, score) => sum + score, 0) / healthScores.length
        : 100;

      return {
        totalValue,
        totalItems,
        lowStockItems,
        outOfStockItems,
        overstockItems,
        averageTurnover,
        healthScore,
      };
    } catch (error) {
      this.logger.error(`Error calculating stock metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stok hareket özeti
   */
  async getStockMovementSummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<StockMovementSummary> {
    try {
      const movements = await this.movementRepository.find({
        where: {
          userId,
          createdAt: Between(startDate, endDate),
        },
      });

      const inboundMovements = movements.filter(m => m.isInbound);
      const outboundMovements = movements.filter(m => m.isOutbound);
      const adjustments = movements.filter(m => m.isAdjustment);

      const valueIn = inboundMovements.reduce((sum, m) => sum + (m.totalValue || 0), 0);
      const valueOut = outboundMovements.reduce((sum, m) => sum + Math.abs(m.totalValue || 0), 0);
      const netChange = valueIn - valueOut;

      return {
        period: `${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]}`,
        totalMovements: movements.length,
        inboundMovements: inboundMovements.length,
        outboundMovements: outboundMovements.length,
        adjustments: adjustments.length,
        valueIn,
        valueOut,
        netChange,
      };
    } catch (error) {
      this.logger.error(`Error generating movement summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stok tahmini ve öneriler
   */
  async generateInventoryForecast(userId: string): Promise<InventoryForecast[]> {
    try {
      const inventoryItems = await this.inventoryRepository.find({
        where: { userId, isActive: true, trackStock: true },
        relations: ['stockMovements'],
      });

      const forecasts: InventoryForecast[] = [];

      for (const item of inventoryItems) {
        const forecast = await this.calculateItemForecast(item);
        forecasts.push(forecast);
      }

      // Yüksek riskli olanları öne çıkar
      forecasts.sort((a, b) => {
        const aUrgency = a.reorderRecommendation.urgency;
        const bUrgency = b.reorderRecommendation.urgency;
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        return urgencyOrder[bUrgency] - urgencyOrder[aUrgency];
      });

      return forecasts;
    } catch (error) {
      this.logger.error(`Error generating inventory forecast: ${error.message}`);
      throw error;
    }
  }

  /**
   * Otomatik stok kontrolleri (her gün çalışır)
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async performDailyStockCheck(): Promise<void> {
    try {
      this.logger.log('Starting daily stock check');

      // Düşük stok seviyeli öğeleri bul
      const lowStockItems = await this.inventoryRepository.find({
        where: {
          isActive: true,
          stockStatus: 'low_stock',
        },
        relations: ['user'],
      });

      for (const item of lowStockItems) {
        // Her öğe için uyarı kontrolü
        await this.checkAndCreateAlerts(item);
      }

      // Yeniden sipariş gerekenleri kontrol et
      const reorderNeeded = await this.inventoryRepository.find({
        where: {
          isActive: true,
          autoReorder: true,
        },
      });

      for (const item of reorderNeeded) {
        if (item.needsReorder) {
          await this.stockAlertService.createReorderAlert(item);
        }
      }

      this.logger.log(`Daily stock check completed. Checked ${lowStockItems.length + reorderNeeded.length} items`);
    } catch (error) {
      this.logger.error(`Error in daily stock check: ${error.message}`);
    }
  }

  /**
   * Yavaş hareket eden stokları tespit et (haftalık)
   */
  @Cron(CronExpression.EVERY_WEEK)
  async identifySlowMovingStock(): Promise<void> {
    try {
      this.logger.log('Identifying slow-moving stock');

      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Son 3 ayda hiç hareket olmayan stoklar
      const slowMovingItems = await this.inventoryRepository
        .createQueryBuilder('item')
        .leftJoin('item.stockMovements', 'movement')
        .where('item.isActive = :active', { active: true })
        .andWhere('item.stockLevel > 0')
        .andWhere(qb => {
          const subQuery = qb.subQuery()
            .select('1')
            .from(StockMovement, 'sm')
            .where('sm.inventoryItemId = item.id')
            .andWhere('sm.createdAt > :threeMonthsAgo')
            .andWhere('sm.movementType = :saleType')
            .getQuery();
          return `NOT EXISTS ${subQuery}`;
        })
        .setParameter('threeMonthsAgo', threeMonthsAgo)
        .setParameter('saleType', 'sale')
        .getMany();

      for (const item of slowMovingItems) {
        await this.stockAlertService.createSlowMovingAlert(item);
      }

      this.logger.log(`Identified ${slowMovingItems.length} slow-moving items`);
    } catch (error) {
      this.logger.error(`Error identifying slow-moving stock: ${error.message}`);
    }
  }

  // Private helper methods
  private async checkAndCreateAlerts(inventoryItem: InventoryItem): Promise<StockAlert[]> {
    const alerts: StockAlert[] = [];

    try {
      // Düşük stok uyarısı
      if (inventoryItem.stockStatus === 'low_stock' || inventoryItem.stockStatus === 'out_of_stock') {
        const alert = await this.stockAlertService.createLowStockAlert(inventoryItem);
        if (alert) alerts.push(alert);
      }

      // Yeniden sipariş uyarısı
      if (inventoryItem.needsReorder) {
        const alert = await this.stockAlertService.createReorderAlert(inventoryItem);
        if (alert) alerts.push(alert);
      }

      // Overstock uyarısı
      if (inventoryItem.stockLevel > inventoryItem.maximumStock * 1.2) {
        const alert = await this.stockAlertService.createOverstockAlert(inventoryItem);
        if (alert) alerts.push(alert);
      }

      return alerts;
    } catch (error) {
      this.logger.warn(`Error creating alerts for item ${inventoryItem.id}: ${error.message}`);
      return [];
    }
  }

  private async createStockMovement(data: {
    userId: string;
    inventoryItemId: string;
    movementType: StockMovement['movementType'];
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: any;
  }): Promise<StockMovement> {
    const movement = this.movementRepository.create({
      ...data,
      source: 'system',
      isReversible: true,
    });

    return this.movementRepository.save(movement);
  }

  private async calculateItemForecast(item: InventoryItem): Promise<InventoryForecast> {
    // Son 30 günlük satış hareketlerini al
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSales = await this.movementRepository.find({
      where: {
        inventoryItemId: item.id,
        movementType: 'sale',
        createdAt: MoreThan(thirtyDaysAgo),
      },
      order: { createdAt: 'DESC' },
    });

    // Günlük ortalama satış hesapla
    const totalSold = recentSales.reduce((sum, sale) => sum + Math.abs(sale.quantity), 0);
    const dailyAverageSales = recentSales.length > 0 ? totalSold / 30 : 0;

    // Tahminler
    const predictedStockIn7Days = Math.max(0, item.stockLevel - (dailyAverageSales * 7));
    const predictedStockIn30Days = Math.max(0, item.stockLevel - (dailyAverageSales * 30));

    // Yeniden sipariş önerisi
    const shouldReorder = predictedStockIn7Days <= item.reorderPoint;
    const recommendedQuantity = shouldReorder ? item.calculateReorderQuantity() : 0;

    let urgency: 'low' | 'medium' | 'high' = 'low';
    const reasoning: string[] = [];

    if (predictedStockIn7Days <= 0) {
      urgency = 'high';
      reasoning.push('7 gün içinde stok tükenecek');
    } else if (predictedStockIn7Days <= item.minimumStock) {
      urgency = 'medium';
      reasoning.push('7 gün içinde minimum stok seviyesinin altına düşecek');
    }

    if (dailyAverageSales > item.turnoverRate * 1.5) {
      reasoning.push('Satış hızı normalin üzerinde');
    }

    // Risk faktörleri
    const riskFactors: string[] = [];
    if (item.turnoverRate < 0.1) riskFactors.push('Yavaş hareket eden stok');
    if (item.stockLevel > item.maximumStock) riskFactors.push('Aşırı stok');
    if (!item.autoReorder) riskFactors.push('Otomatik yeniden sipariş kapalı');

    return {
      productId: item.productId,
      currentStock: item.stockLevel,
      predictedStockIn7Days,
      predictedStockIn30Days,
      reorderRecommendation: {
        shouldReorder,
        recommendedQuantity,
        urgency,
        reasoning,
      },
      riskFactors,
    };
  }
}