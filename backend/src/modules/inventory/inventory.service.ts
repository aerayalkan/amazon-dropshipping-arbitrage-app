import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, Between, In } from 'typeorm';

import { InventoryItem } from './entities/inventory-item.entity';
import { Supplier } from './entities/supplier.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { StockAlert } from './entities/stock-alert.entity';
import { AutomationRule } from './entities/automation-rule.entity';
import { PriceUpdateLog } from './entities/price-update-log.entity';

import { InventoryTrackingService } from './services/inventory-tracking.service';
import { SupplierManagementService } from './services/supplier-management.service';
import { AutomationRulesService } from './services/automation-rules.service';
import { StockAlertService } from './services/stock-alert.service';
import { ProductSyncService } from './services/product-sync.service';

export interface InventoryDashboard {
  summary: {
    totalItems: number;
    activeItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
    avgStockDays: number;
  };
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
    recentAlerts: StockAlert[];
  };
  movements: {
    todayMovements: number;
    weeklyMovements: number;
    monthlyMovements: number;
    recentMovements: StockMovement[];
  };
  suppliers: {
    totalSuppliers: number;
    activeSuppliers: number;
    reliableSuppliers: number;
    topSuppliers: Array<{
      id: string;
      name: string;
      itemCount: number;
      reliability: number;
    }>;
  };
  trends: {
    stockTrend: 'increasing' | 'decreasing' | 'stable';
    valueTrend: 'increasing' | 'decreasing' | 'stable';
    velocityTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface InventoryReport {
  reportId: string;
  generatedAt: Date;
  period: string;
  summary: InventoryDashboard['summary'];
  detailedItems: Array<{
    id: string;
    productName: string;
    sku: string;
    currentStock: number;
    reorderPoint: number;
    daysOfStock: number;
    lastMovement: Date;
    totalValue: number;
    velocity: number;
    status: 'healthy' | 'low_stock' | 'out_of_stock' | 'overstocked';
  }>;
  recommendations: Array<{
    type: 'reorder' | 'price_adjustment' | 'clearance' | 'optimization';
    priority: 'high' | 'medium' | 'low';
    item: string;
    description: string;
    expectedImpact: string;
  }>;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SupplierProduct)
    private readonly supplierProductRepository: Repository<SupplierProduct>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(StockAlert)
    private readonly alertRepository: Repository<StockAlert>,
    @InjectRepository(AutomationRule)
    private readonly ruleRepository: Repository<AutomationRule>,
    @InjectRepository(PriceUpdateLog)
    private readonly priceLogRepository: Repository<PriceUpdateLog>,
    private readonly dataSource: DataSource,
    private readonly inventoryTrackingService: InventoryTrackingService,
    private readonly supplierManagementService: SupplierManagementService,
    private readonly automationRulesService: AutomationRulesService,
    private readonly stockAlertService: StockAlertService,
    private readonly productSyncService: ProductSyncService,
  ) {}

  /**
   * Inventory dashboard verilerini getir
   */
  async getDashboard(userId: string): Promise<InventoryDashboard> {
    try {
      this.logger.log(`Getting inventory dashboard for user: ${userId}`);

      // Parallel olarak tüm verileri çek
      const [
        inventoryItems,
        activeAlerts,
        recentMovements,
        suppliers,
        stockMovements
      ] = await Promise.all([
        this.inventoryRepository.find({
          where: { userId },
          relations: ['supplierProduct', 'supplier'],
        }),
        this.alertRepository.find({
          where: { userId, isActive: true },
          order: { triggeredAt: 'DESC' },
          take: 10,
        }),
        this.movementRepository.find({
          where: { userId },
          order: { createdAt: 'DESC' },
          take: 10,
          relations: ['inventoryItem'],
        }),
        this.supplierRepository.find({
          where: { userId },
          relations: ['products'],
        }),
        this.getMovementCounts(userId),
      ]);

      // Summary hesapla
      const summary = this.calculateSummary(inventoryItems);
      
      // Alerts hesapla
      const alerts = this.calculateAlertsSummary(activeAlerts);
      
      // Movements hesapla
      const movements = {
        ...stockMovements,
        recentMovements: recentMovements.slice(0, 5),
      };
      
      // Suppliers hesapla
      const suppliersSummary = this.calculateSuppliersSummary(suppliers);
      
      // Trends hesapla
      const trends = await this.calculateTrends(userId);

      return {
        summary,
        alerts,
        movements,
        suppliers: suppliersSummary,
        trends,
      };

    } catch (error) {
      this.logger.error(`Error getting dashboard: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inventory öğelerini listele
   */
  async getInventoryItems(userId: string, filters?: {
    status?: 'all' | 'active' | 'low_stock' | 'out_of_stock';
    supplierId?: string;
    search?: string;
    limit?: number;
    offset?: number;
    sortBy?: 'name' | 'stock' | 'value' | 'velocity' | 'last_movement';
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{
    items: InventoryItem[];
    total: number;
    summary: {
      totalValue: number;
      lowStockCount: number;
      outOfStockCount: number;
    };
  }> {
    try {
      let query = this.inventoryRepository.createQueryBuilder('item')
        .leftJoinAndSelect('item.supplier', 'supplier')
        .leftJoinAndSelect('item.supplierProduct', 'sp')
        .where('item.userId = :userId', { userId });

      // Filters
      if (filters?.status && filters.status !== 'all') {
        switch (filters.status) {
          case 'active':
            query = query.andWhere('item.isActive = :isActive', { isActive: true });
            break;
          case 'low_stock':
            query = query.andWhere('item.currentStock <= item.reorderPoint');
            break;
          case 'out_of_stock':
            query = query.andWhere('item.currentStock <= 0');
            break;
        }
      }

      if (filters?.supplierId) {
        query = query.andWhere('item.supplierId = :supplierId', {
          supplierId: filters.supplierId,
        });
      }

      if (filters?.search) {
        query = query.andWhere(
          '(item.productName ILIKE :search OR item.sku ILIKE :search OR item.asin ILIKE :search)',
          { search: `%${filters.search}%` }
        );
      }

      // Sorting
      const sortBy = filters?.sortBy || 'name';
      const sortOrder = filters?.sortOrder || 'ASC';
      
      switch (sortBy) {
        case 'name':
          query = query.orderBy('item.productName', sortOrder);
          break;
        case 'stock':
          query = query.orderBy('item.currentStock', sortOrder);
          break;
        case 'value':
          query = query.orderBy('item.currentStock * item.costPrice', sortOrder);
          break;
        case 'last_movement':
          query = query.orderBy('item.lastMovementAt', sortOrder);
          break;
        default:
          query = query.orderBy('item.productName', sortOrder);
      }

      // Total count
      const total = await query.getCount();

      // Pagination
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }
      if (filters?.offset) {
        query = query.offset(filters.offset);
      }

      const items = await query.getMany();

      // Summary
      const allItems = await this.inventoryRepository.find({
        where: { userId, isActive: true },
      });

      const summary = {
        totalValue: allItems.reduce((sum, item) => 
          sum + (item.currentStock * item.costPrice), 0
        ),
        lowStockCount: allItems.filter(item => 
          item.currentStock <= item.reorderPoint
        ).length,
        outOfStockCount: allItems.filter(item => 
          item.currentStock <= 0
        ).length,
      };

      return { items, total, summary };

    } catch (error) {
      this.logger.error(`Error getting inventory items: ${error.message}`);
      throw error;
    }
  }

  /**
   * Yeni inventory item oluştur
   */
  async createInventoryItem(userId: string, itemData: {
    productId?: string;
    asin?: string;
    productName: string;
    sku?: string;
    barcode?: string;
    supplierId: string;
    supplierProductId?: string;
    costPrice: number;
    sellingPrice: number;
    currentStock: number;
    reorderPoint: number;
    maxStockLevel?: number;
    location?: string;
    notes?: string;
  }): Promise<InventoryItem> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      this.logger.log(`Creating inventory item for user: ${userId}`);

      // Supplier'ın var olduğunu kontrol et
      const supplier = await this.supplierRepository.findOne({
        where: { id: itemData.supplierId, userId },
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      // SKU unique kontrolü
      if (itemData.sku) {
        const existingItem = await this.inventoryRepository.findOne({
          where: { userId, sku: itemData.sku },
        });

        if (existingItem) {
          throw new BadRequestException('SKU already exists');
        }
      }

      // Inventory item oluştur
      const inventoryItem = this.inventoryRepository.create({
        userId,
        ...itemData,
        isActive: true,
        lastUpdatedAt: new Date(),
      });

      const savedItem = await queryRunner.manager.save(inventoryItem);

      // İlk stock movement'ı oluştur
      if (itemData.currentStock > 0) {
        const initialMovement = StockMovement.createAdjustmentMovement({
          userId,
          inventoryItemId: savedItem.id,
          previousStock: 0,
          newStock: itemData.currentStock,
          reason: 'Initial stock',
          notes: 'Initial inventory setup',
          processedBy: 'system',
        });

        await queryRunner.manager.save(StockMovement, initialMovement);
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Inventory item created: ${savedItem.id}`);
      return savedItem;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating inventory item: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Inventory item güncelle
   */
  async updateInventoryItem(
    userId: string,
    itemId: string,
    updateData: Partial<{
      productName: string;
      sku: string;
      barcode: string;
      costPrice: number;
      sellingPrice: number;
      reorderPoint: number;
      maxStockLevel: number;
      location: string;
      notes: string;
      isActive: boolean;
    }>
  ): Promise<InventoryItem> {
    try {
      const item = await this.inventoryRepository.findOne({
        where: { id: itemId, userId },
      });

      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      // Fiyat değişikliği varsa log oluştur
      if (updateData.sellingPrice && updateData.sellingPrice !== item.sellingPrice) {
        const priceLog = PriceUpdateLog.createManualUpdate({
          userId,
          inventoryItemId: itemId,
          oldPrice: item.sellingPrice,
          newPrice: updateData.sellingPrice,
          notes: 'Manual price update',
          triggeredBy: userId,
        });

        await this.priceLogRepository.save(priceLog);
      }

      Object.assign(item, updateData);
      item.lastUpdatedAt = new Date();

      const updatedItem = await this.inventoryRepository.save(item);

      this.logger.log(`Inventory item updated: ${itemId}`);
      return updatedItem;

    } catch (error) {
      this.logger.error(`Error updating inventory item: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inventory item sil
   */
  async deleteInventoryItem(userId: string, itemId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const item = await this.inventoryRepository.findOne({
        where: { id: itemId, userId },
      });

      if (!item) {
        throw new NotFoundException('Inventory item not found');
      }

      // Aktif alertleri kapat
      await queryRunner.manager.update(
        StockAlert,
        { inventoryItemId: itemId, isActive: true },
        { isActive: false, resolvedAt: new Date(), resolvedBy: userId }
      );

      // Item'ı soft delete
      item.isActive = false;
      item.deletedAt = new Date();
      await queryRunner.manager.save(item);

      await queryRunner.commitTransaction();

      this.logger.log(`Inventory item deleted: ${itemId}`);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error deleting inventory item: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Inventory raporu oluştur
   */
  async generateInventoryReport(userId: string, options: {
    format: 'json' | 'csv' | 'excel';
    period: 'current' | 'week' | 'month' | 'quarter';
    includeMovements?: boolean;
    includeAlerts?: boolean;
    categoryFilter?: string[];
    supplierFilter?: string[];
  }): Promise<InventoryReport> {
    try {
      this.logger.log(`Generating inventory report for user: ${userId}`);

      const reportId = `inventory_report_${Date.now()}_${userId}`;
      const now = new Date();

      // Period hesapla
      let periodStart = new Date();
      let periodText = 'Current Status';

      switch (options.period) {
        case 'week':
          periodStart.setDate(now.getDate() - 7);
          periodText = 'Last 7 Days';
          break;
        case 'month':
          periodStart.setMonth(now.getMonth() - 1);
          periodText = 'Last 30 Days';
          break;
        case 'quarter':
          periodStart.setMonth(now.getMonth() - 3);
          periodText = 'Last 90 Days';
          break;
      }

      // Inventory items getir
      let query = this.inventoryRepository.createQueryBuilder('item')
        .leftJoinAndSelect('item.supplier', 'supplier')
        .where('item.userId = :userId', { userId })
        .andWhere('item.isActive = :isActive', { isActive: true });

      if (options.supplierFilter && options.supplierFilter.length > 0) {
        query = query.andWhere('item.supplierId IN (:...supplierIds)', {
          supplierIds: options.supplierFilter,
        });
      }

      const items = await query.getMany();

      // Summary hesapla
      const summary = this.calculateSummary(items);

      // Detailed items
      const detailedItems = await Promise.all(
        items.map(async (item) => {
          const velocity = await this.calculateItemVelocity(item.id, 30);
          const daysOfStock = item.calculateDaysOfStock();
          
          let status: 'healthy' | 'low_stock' | 'out_of_stock' | 'overstocked' = 'healthy';
          
          if (item.currentStock <= 0) {
            status = 'out_of_stock';
          } else if (item.currentStock <= item.reorderPoint) {
            status = 'low_stock';
          } else if (item.maxStockLevel && item.currentStock > item.maxStockLevel) {
            status = 'overstocked';
          }

          return {
            id: item.id,
            productName: item.productName,
            sku: item.sku || '',
            currentStock: item.currentStock,
            reorderPoint: item.reorderPoint,
            daysOfStock,
            lastMovement: item.lastMovementAt || item.createdAt,
            totalValue: item.currentStock * item.costPrice,
            velocity,
            status,
          };
        })
      );

      // Recommendations oluştur
      const recommendations = await this.generateRecommendations(items);

      return {
        reportId,
        generatedAt: now,
        period: periodText,
        summary,
        detailedItems,
        recommendations,
      };

    } catch (error) {
      this.logger.error(`Error generating inventory report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Bulk operations
   */
  async bulkUpdatePrices(userId: string, updates: Array<{
    itemId: string;
    newPrice: number;
    reason?: string;
  }>): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const batchId = `bulk_price_${Date.now()}`;
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const update of updates) {
      try {
        const item = await this.inventoryRepository.findOne({
          where: { id: update.itemId, userId },
        });

        if (!item) {
          errors.push(`Item ${update.itemId}: Not found`);
          failed++;
          continue;
        }

        // Price log oluştur
        const priceLog = PriceUpdateLog.createBulkUpdate({
          userId,
          inventoryItemId: update.itemId,
          oldPrice: item.sellingPrice,
          newPrice: update.newPrice,
          batchId,
          totalItems: updates.length,
          updateCriteria: update.reason || 'Bulk price update',
          triggeredBy: userId,
        });

        await this.priceLogRepository.save(priceLog);

        // Fiyatı güncelle
        item.sellingPrice = update.newPrice;
        item.lastUpdatedAt = new Date();
        await this.inventoryRepository.save(item);

        successful++;

      } catch (error) {
        errors.push(`Item ${update.itemId}: ${error.message}`);
        failed++;
      }
    }

    this.logger.log(`Bulk price update completed: ${successful} successful, ${failed} failed`);
    return { successful, failed, errors };
  }

  // Private helper methods
  private calculateSummary(items: InventoryItem[]): InventoryDashboard['summary'] {
    const activeItems = items.filter(item => item.isActive);
    const lowStockItems = activeItems.filter(item => 
      item.currentStock <= item.reorderPoint
    );
    const outOfStockItems = activeItems.filter(item => 
      item.currentStock <= 0
    );

    const totalValue = activeItems.reduce((sum, item) => 
      sum + (item.currentStock * item.costPrice), 0
    );

    const avgStockDays = activeItems.length > 0
      ? activeItems.reduce((sum, item) => sum + item.calculateDaysOfStock(), 0) / activeItems.length
      : 0;

    return {
      totalItems: items.length,
      activeItems: activeItems.length,
      lowStockItems: lowStockItems.length,
      outOfStockItems: outOfStockItems.length,
      totalValue,
      avgStockDays: Math.round(avgStockDays),
    };
  }

  private calculateAlertsSummary(alerts: StockAlert[]): InventoryDashboard['alerts'] {
    const critical = alerts.filter(a => a.priority === 'critical').length;
    const high = alerts.filter(a => a.priority === 'high').length;
    const medium = alerts.filter(a => a.priority === 'medium').length;
    const low = alerts.filter(a => a.priority === 'low').length;

    return {
      critical,
      high,
      medium,
      low,
      total: alerts.length,
      recentAlerts: alerts.slice(0, 5),
    };
  }

  private calculateSuppliersSummary(suppliers: Supplier[]): InventoryDashboard['suppliers'] {
    const activeSuppliers = suppliers.filter(s => s.isActive);
    const reliableSuppliers = activeSuppliers.filter(s => s.performanceScore >= 4.0);

    const topSuppliers = suppliers
      .map(supplier => ({
        id: supplier.id,
        name: supplier.name,
        itemCount: supplier.products?.length || 0,
        reliability: supplier.performanceScore,
      }))
      .sort((a, b) => b.reliability - a.reliability)
      .slice(0, 5);

    return {
      totalSuppliers: suppliers.length,
      activeSuppliers: activeSuppliers.length,
      reliableSuppliers: reliableSuppliers.length,
      topSuppliers,
    };
  }

  private async calculateTrends(userId: string): Promise<InventoryDashboard['trends']> {
    // Mock implementation - gerçek trend analizi için historical data gerekli
    return {
      stockTrend: 'stable',
      valueTrend: 'increasing',
      velocityTrend: 'stable',
    };
  }

  private async getMovementCounts(userId: string): Promise<{
    todayMovements: number;
    weeklyMovements: number;
    monthlyMovements: number;
  }> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [todayMovements, weeklyMovements, monthlyMovements] = await Promise.all([
      this.movementRepository.count({
        where: { userId, createdAt: Between(today, now) },
      }),
      this.movementRepository.count({
        where: { userId, createdAt: Between(weekAgo, now) },
      }),
      this.movementRepository.count({
        where: { userId, createdAt: Between(monthAgo, now) },
      }),
    ]);

    return { todayMovements, weeklyMovements, monthlyMovements };
  }

  private async calculateItemVelocity(itemId: string, days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const movements = await this.movementRepository.find({
      where: {
        inventoryItemId: itemId,
        movementType: 'sale',
        createdAt: Between(startDate, new Date()),
      },
    });

    const totalSold = movements.reduce((sum, movement) => 
      sum + Math.abs(movement.quantity), 0
    );

    return totalSold / days; // Günlük ortalama satış
  }

  private async generateRecommendations(items: InventoryItem[]): Promise<InventoryReport['recommendations']> {
    const recommendations: InventoryReport['recommendations'] = [];

    for (const item of items) {
      // Low stock recommendation
      if (item.currentStock <= item.reorderPoint) {
        const priority = item.currentStock <= 0 ? 'high' : 'medium';
        recommendations.push({
          type: 'reorder',
          priority,
          item: item.productName,
          description: `Stok seviyesi kritik (${item.currentStock} adet)`,
          expectedImpact: 'Satış kaybını önler',
        });
      }

      // Overstock recommendation
      if (item.maxStockLevel && item.currentStock > item.maxStockLevel * 1.5) {
        recommendations.push({
          type: 'clearance',
          priority: 'medium',
          item: item.productName,
          description: `Fazla stok (${item.currentStock} adet, max: ${item.maxStockLevel})`,
          expectedImpact: 'Nakit akışını iyileştirir',
        });
      }
    }

    return recommendations.slice(0, 10); // En fazla 10 öneri
  }
}