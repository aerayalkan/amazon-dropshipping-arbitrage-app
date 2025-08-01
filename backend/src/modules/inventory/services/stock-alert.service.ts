import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThan, Between } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { StockAlert } from '../entities/stock-alert.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { Supplier } from '../entities/supplier.entity';

export interface AlertRule {
  id: string;
  name: string;
  conditions: {
    stockThreshold?: number;
    velocityThreshold?: number;
    daysSinceLastMovement?: number;
    supplierAvailability?: boolean;
    priceChangeThreshold?: number;
  };
  actions: {
    notify: boolean;
    autoReorder?: boolean;
    escalate?: boolean;
    emailRecipients?: string[];
    priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

export interface AlertStatistics {
  totalAlerts: number;
  activeAlerts: number;
  resolvedAlerts: number;
  avgResolutionTime: number;
  alertsByType: { [key: string]: number };
  alertsByPriority: { [key: string]: number };
  recentTrends: {
    period: string;
    count: number;
    percentageChange: number;
  }[];
}

@Injectable()
export class StockAlertService {
  private readonly logger = new Logger(StockAlertService.name);

  constructor(
    @InjectRepository(StockAlert)
    private readonly alertRepository: Repository<StockAlert>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  /**
   * Manuel alert oluşturma
   */
  async createAlert(userId: string, alertData: {
    inventoryItemId: string;
    alertType: StockAlert['alertType'];
    priority: StockAlert['priority'];
    title: string;
    message: string;
    data?: any;
    expiresAt?: Date;
  }): Promise<StockAlert> {
    try {
      this.logger.log(`Creating manual alert for user: ${userId}`);

      const alert = this.alertRepository.create({
        userId,
        ...alertData,
        isActive: true,
        triggeredBy: 'manual',
        triggeredAt: new Date(),
      });

      const savedAlert = await this.alertRepository.save(alert);

      // Kritik alertlerde anında bildirim gönder
      if (savedAlert.priority === 'critical') {
        await this.sendImmediateNotification(savedAlert);
      }

      this.logger.log(`Alert created: ${savedAlert.id}`);
      return savedAlert;
    } catch (error) {
      this.logger.error(`Error creating alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Low stock alert oluşturma
   */
  async createLowStockAlert(item: InventoryItem, triggerDetails?: any): Promise<StockAlert> {
    try {
      const existingAlert = await this.alertRepository.findOne({
        where: {
          inventoryItemId: item.id,
          alertType: 'low_stock',
          isActive: true,
        },
      });

      // Zaten aktif alert varsa güncelle
      if (existingAlert) {
        existingAlert.triggeredAt = new Date();
        existingAlert.data = { ...existingAlert.data, ...triggerDetails };
        return this.alertRepository.save(existingAlert);
      }

      const daysOfStock = item.calculateDaysOfStock();
      const reorderPoint = item.reorderPoint || 0;

      return this.createAlert(item.userId, {
        inventoryItemId: item.id,
        alertType: 'low_stock',
        priority: item.currentStock <= reorderPoint * 0.5 ? 'high' : 'medium',
        title: `Düşük Stok: ${item.productName}`,
        message: `Stok seviyesi kritik: ${item.currentStock} adet (${daysOfStock} günlük stok)`,
        data: {
          currentStock: item.currentStock,
          reorderPoint: reorderPoint,
          daysOfStock: daysOfStock,
          ...triggerDetails,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating low stock alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Out of stock alert oluşturma
   */
  async createOutOfStockAlert(item: InventoryItem): Promise<StockAlert> {
    try {
      return this.createAlert(item.userId, {
        inventoryItemId: item.id,
        alertType: 'out_of_stock',
        priority: 'critical',
        title: `Stok Tükendi: ${item.productName}`,
        message: `Ürün stokta kalmadı. Satışlar durduruldu.`,
        data: {
          lastStockDate: item.updatedAt,
          lastMovementId: await this.getLastMovementId(item.id),
        },
      });
    } catch (error) {
      this.logger.error(`Error creating out of stock alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reorder suggestion alert oluşturma
   */
  async createReorderAlert(item: InventoryItem, options: {
    recommendedQuantity: number;
    autoApprove?: boolean;
    triggeredBy?: string;
  }): Promise<StockAlert> {
    try {
      const supplier = await this.supplierRepository.findOne({
        where: { id: item.supplierId },
      });

      return this.createAlert(item.userId, {
        inventoryItemId: item.id,
        alertType: 'reorder_needed',
        priority: 'medium',
        title: `Sipariş Önerisi: ${item.productName}`,
        message: `${options.recommendedQuantity} adet sipariş verilmesi öneriliyor`,
        data: {
          recommendedQuantity: options.recommendedQuantity,
          supplierInfo: supplier ? {
            name: supplier.name,
            minimumOrderQuantity: supplier.minimumOrderQuantity,
            leadTime: supplier.leadTimeDays,
            reliability: supplier.performanceScore,
          } : null,
          estimatedCost: item.costPrice * options.recommendedQuantity,
          autoApprove: options.autoApprove || false,
          triggeredBy: options.triggeredBy || 'system',
        },
      });
    } catch (error) {
      this.logger.error(`Error creating reorder alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Supplier alert oluşturma
   */
  async createSupplierAlert(supplierId: string, alertData: {
    alertType: 'supplier_delay' | 'supplier_price_change' | 'supplier_unavailable';
    affectedItemIds: string[];
    details: string;
    severity: StockAlert['priority'];
  }): Promise<StockAlert[]> {
    try {
      const supplier = await this.supplierRepository.findOne({
        where: { id: supplierId },
      });

      if (!supplier) {
        throw new Error('Supplier not found');
      }

      const alerts: StockAlert[] = [];

      for (const itemId of alertData.affectedItemIds) {
        const item = await this.inventoryRepository.findOne({
          where: { id: itemId },
        });

        if (item) {
          const alert = await this.createAlert(item.userId, {
            inventoryItemId: itemId,
            alertType: alertData.alertType,
            priority: alertData.severity,
            title: `Tedarikçi Uyarısı: ${supplier.name}`,
            message: alertData.details,
            data: {
              supplierId: supplierId,
              supplierName: supplier.name,
              affectedItems: alertData.affectedItemIds.length,
            },
          });

          alerts.push(alert);
        }
      }

      this.logger.log(`Created ${alerts.length} supplier alerts for ${supplier.name}`);
      return alerts;
    } catch (error) {
      this.logger.error(`Error creating supplier alerts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Custom alert oluşturma
   */
  async createCustomAlert(item: InventoryItem, alertData: {
    alertType: string;
    priority: StockAlert['priority'];
    message: string;
    triggeredBy?: string;
  }): Promise<StockAlert> {
    return this.createAlert(item.userId, {
      inventoryItemId: item.id,
      alertType: alertData.alertType as any,
      priority: alertData.priority,
      title: `Özel Uyarı: ${item.productName}`,
      message: alertData.message,
      data: {
        triggeredBy: alertData.triggeredBy || 'custom_rule',
      },
    });
  }

  /**
   * Alert'i çözümleme
   */
  async resolveAlert(alertId: string, resolutionNote?: string): Promise<StockAlert> {
    try {
      const alert = await this.alertRepository.findOne({
        where: { id: alertId },
      });

      if (!alert) {
        throw new Error('Alert not found');
      }

      if (!alert.isActive) {
        throw new Error('Alert is already resolved');
      }

      alert.isActive = false;
      alert.resolvedAt = new Date();
      alert.resolutionNote = resolutionNote;

      // Çözüm süresini hesapla
      const resolutionTimeMs = alert.resolvedAt.getTime() - alert.triggeredAt.getTime();
      alert.resolutionTimeMinutes = Math.round(resolutionTimeMs / (1000 * 60));

      const resolvedAlert = await this.alertRepository.save(alert);

      this.logger.log(`Alert resolved: ${alertId} in ${alert.resolutionTimeMinutes} minutes`);
      return resolvedAlert;
    } catch (error) {
      this.logger.error(`Error resolving alert: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toplu alert çözümleme
   */
  async resolveBulkAlerts(alertIds: string[], resolutionNote?: string): Promise<{
    resolved: number;
    failed: number;
    errors: string[];
  }> {
    let resolved = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const alertId of alertIds) {
      try {
        await this.resolveAlert(alertId, resolutionNote);
        resolved++;
      } catch (error) {
        failed++;
        errors.push(`${alertId}: ${error.message}`);
      }
    }

    this.logger.log(`Bulk resolve completed: ${resolved} resolved, ${failed} failed`);
    return { resolved, failed, errors };
  }

  /**
   * Aktif alertleri getir
   */
  async getActiveAlerts(userId: string, filters?: {
    alertType?: StockAlert['alertType'];
    priority?: StockAlert['priority'];
    inventoryItemId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    alerts: StockAlert[];
    total: number;
    summary: {
      byType: { [key: string]: number };
      byPriority: { [key: string]: number };
    };
  }> {
    try {
      let query = this.alertRepository.createQueryBuilder('alert')
        .leftJoinAndSelect('alert.inventoryItem', 'item')
        .where('alert.userId = :userId', { userId })
        .andWhere('alert.isActive = :isActive', { isActive: true });

      if (filters?.alertType) {
        query = query.andWhere('alert.alertType = :alertType', {
          alertType: filters.alertType,
        });
      }

      if (filters?.priority) {
        query = query.andWhere('alert.priority = :priority', {
          priority: filters.priority,
        });
      }

      if (filters?.inventoryItemId) {
        query = query.andWhere('alert.inventoryItemId = :inventoryItemId', {
          inventoryItemId: filters.inventoryItemId,
        });
      }

      // Total count
      const total = await query.getCount();

      // Apply pagination
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      // Order by priority and date
      query = query.orderBy('alert.priority', 'DESC')
        .addOrderBy('alert.triggeredAt', 'DESC');

      const alerts = await query.getMany();

      // Summary statistics
      const allActiveAlerts = await this.alertRepository.find({
        where: { userId, isActive: true },
      });

      const byType = allActiveAlerts.reduce((acc, alert) => {
        acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

      const byPriority = allActiveAlerts.reduce((acc, alert) => {
        acc[alert.priority] = (acc[alert.priority] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

      return {
        alerts,
        total,
        summary: { byType, byPriority },
      };
    } catch (error) {
      this.logger.error(`Error getting active alerts: ${error.message}`);
      throw error;
    }
  }

  /**
   * Alert geçmişi
   */
  async getAlertHistory(userId: string, filters?: {
    startDate?: Date;
    endDate?: Date;
    inventoryItemId?: string;
    limit?: number;
  }): Promise<StockAlert[]> {
    try {
      let query = this.alertRepository.createQueryBuilder('alert')
        .leftJoinAndSelect('alert.inventoryItem', 'item')
        .where('alert.userId = :userId', { userId });

      if (filters?.startDate) {
        query = query.andWhere('alert.triggeredAt >= :startDate', {
          startDate: filters.startDate,
        });
      }

      if (filters?.endDate) {
        query = query.andWhere('alert.triggeredAt <= :endDate', {
          endDate: filters.endDate,
        });
      }

      if (filters?.inventoryItemId) {
        query = query.andWhere('alert.inventoryItemId = :inventoryItemId', {
          inventoryItemId: filters.inventoryItemId,
        });
      }

      query = query.orderBy('alert.triggeredAt', 'DESC');

      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      return query.getMany();
    } catch (error) {
      this.logger.error(`Error getting alert history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Alert istatistikleri
   */
  async getAlertStatistics(userId: string, period: 'week' | 'month' | 'quarter' = 'month'): Promise<AlertStatistics> {
    try {
      const now = new Date();
      const periodStart = new Date();

      switch (period) {
        case 'week':
          periodStart.setDate(now.getDate() - 7);
          break;
        case 'month':
          periodStart.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          periodStart.setMonth(now.getMonth() - 3);
          break;
      }

      const alerts = await this.alertRepository.find({
        where: {
          userId,
          triggeredAt: MoreThan(periodStart),
        },
      });

      const totalAlerts = alerts.length;
      const activeAlerts = alerts.filter(a => a.isActive).length;
      const resolvedAlerts = alerts.filter(a => !a.isActive).length;

      // Ortalama çözüm süresi
      const resolvedWithTime = alerts.filter(a => a.resolutionTimeMinutes);
      const avgResolutionTime = resolvedWithTime.length > 0
        ? resolvedWithTime.reduce((sum, a) => sum + (a.resolutionTimeMinutes || 0), 0) / resolvedWithTime.length
        : 0;

      // Tip ve öncelik bazında dağılım
      const alertsByType = alerts.reduce((acc, alert) => {
        acc[alert.alertType] = (acc[alert.alertType] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

      const alertsByPriority = alerts.reduce((acc, alert) => {
        acc[alert.priority] = (acc[alert.priority] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number });

      // Trend analizi
      const recentTrends = await this.calculateAlertTrends(userId, period);

      return {
        totalAlerts,
        activeAlerts,
        resolvedAlerts,
        avgResolutionTime,
        alertsByType,
        alertsByPriority,
        recentTrends,
      };
    } catch (error) {
      this.logger.error(`Error getting alert statistics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kritik alertler için dashboard verisi
   */
  async getCriticalAlertsForDashboard(userId: string): Promise<{
    criticalCount: number;
    highPriorityCount: number;
    outOfStockItems: number;
    lowStockItems: number;
    reorderSuggestions: number;
    recentAlerts: StockAlert[];
  }> {
    try {
      const activeAlerts = await this.alertRepository.find({
        where: { userId, isActive: true },
        relations: ['inventoryItem'],
        order: { triggeredAt: 'DESC' },
      });

      const criticalCount = activeAlerts.filter(a => a.priority === 'critical').length;
      const highPriorityCount = activeAlerts.filter(a => a.priority === 'high').length;
      const outOfStockItems = activeAlerts.filter(a => a.alertType === 'out_of_stock').length;
      const lowStockItems = activeAlerts.filter(a => a.alertType === 'low_stock').length;
      const reorderSuggestions = activeAlerts.filter(a => a.alertType === 'reorder_needed').length;

      const recentAlerts = activeAlerts.slice(0, 10);

      return {
        criticalCount,
        highPriorityCount,
        outOfStockItems,
        lowStockItems,
        reorderSuggestions,
        recentAlerts,
      };
    } catch (error) {
      this.logger.error(`Error getting critical alerts for dashboard: ${error.message}`);
      throw error;
    }
  }

  /**
   * Otomatik alert kontrolü (scheduled)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkAutomaticAlerts(): Promise<void> {
    try {
      this.logger.log('Running automatic alert checks');

      // Tüm aktif inventory itemları çek
      const items = await this.inventoryRepository.find({
        where: { isActive: true },
        relations: ['supplier'],
      });

      for (const item of items) {
        try {
          await this.checkItemAlerts(item);
        } catch (error) {
          this.logger.warn(`Error checking alerts for item ${item.id}: ${error.message}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      this.logger.log('Automatic alert check completed');
    } catch (error) {
      this.logger.error(`Error in automatic alert check: ${error.message}`);
    }
  }

  /**
   * Günlük alert summary'si gönder
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendDailyAlertSummary(): Promise<void> {
    try {
      this.logger.log('Sending daily alert summaries');

      // Unique user'ları bul
      const usersWithAlerts = await this.alertRepository
        .createQueryBuilder('alert')
        .select('DISTINCT alert.userId', 'userId')
        .where('alert.isActive = :isActive', { isActive: true })
        .getRawMany();

      for (const { userId } of usersWithAlerts) {
        try {
          const summary = await this.getCriticalAlertsForDashboard(userId);
          await this.sendAlertSummaryEmail(userId, summary);
        } catch (error) {
          this.logger.warn(`Error sending daily summary to user ${userId}: ${error.message}`);
        }
      }

      this.logger.log('Daily alert summaries sent');
    } catch (error) {
      this.logger.error(`Error sending daily alert summaries: ${error.message}`);
    }
  }

  // Private helper methods
  private async checkItemAlerts(item: InventoryItem): Promise<void> {
    // Low stock kontrolü
    if (item.currentStock <= item.reorderPoint) {
      const existingAlert = await this.alertRepository.findOne({
        where: {
          inventoryItemId: item.id,
          alertType: 'low_stock',
          isActive: true,
        },
      });

      if (!existingAlert) {
        await this.createLowStockAlert(item);
      }
    }

    // Out of stock kontrolü
    if (item.currentStock <= 0) {
      const existingAlert = await this.alertRepository.findOne({
        where: {
          inventoryItemId: item.id,
          alertType: 'out_of_stock',
          isActive: true,
        },
      });

      if (!existingAlert) {
        await this.createOutOfStockAlert(item);
      }
    }

    // Reorder önerisi kontrolü
    if (item.shouldReorder()) {
      const existingAlert = await this.alertRepository.findOne({
        where: {
          inventoryItemId: item.id,
          alertType: 'reorder_needed',
          isActive: true,
        },
      });

      if (!existingAlert) {
        const recommendedQuantity = item.calculateReorderQuantity();
        await this.createReorderAlert(item, { recommendedQuantity });
      }
    }
  }

  private async getLastMovementId(inventoryItemId: string): Promise<string | null> {
    const lastMovement = await this.movementRepository.findOne({
      where: { inventoryItemId },
      order: { createdAt: 'DESC' },
    });

    return lastMovement?.id || null;
  }

  private async calculateAlertTrends(userId: string, period: string): Promise<Array<{
    period: string;
    count: number;
    percentageChange: number;
  }>> {
    // Basit trend hesaplama - production'da daha detaylı olmalı
    const now = new Date();
    const trends: Array<{ period: string; count: number; percentageChange: number }> = [];

    for (let i = 0; i < 4; i++) {
      const start = new Date(now);
      const end = new Date(now);

      switch (period) {
        case 'week':
          start.setDate(now.getDate() - (i + 1) * 7);
          end.setDate(now.getDate() - i * 7);
          break;
        case 'month':
          start.setMonth(now.getMonth() - (i + 1));
          end.setMonth(now.getMonth() - i);
          break;
      }

      const alerts = await this.alertRepository.count({
        where: {
          userId,
          triggeredAt: Between(start, end),
        },
      });

      trends.push({
        period: start.toISOString().split('T')[0],
        count: alerts,
        percentageChange: 0, // Hesaplanacak
      });
    }

    // Percentage change hesapla
    for (let i = 0; i < trends.length - 1; i++) {
      const current = trends[i].count;
      const previous = trends[i + 1].count;
      trends[i].percentageChange = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    }

    return trends.reverse();
  }

  private async sendImmediateNotification(alert: StockAlert): Promise<void> {
    // Notification service entegrasyonu - şimdilik log
    this.logger.warn(`CRITICAL ALERT: ${alert.title} - ${alert.message}`);
  }

  private async sendAlertSummaryEmail(userId: string, summary: any): Promise<void> {
    // Email service entegrasyonu - şimdilik log
    this.logger.log(`Daily alert summary for user ${userId}: ${JSON.stringify(summary)}`);
  }
}