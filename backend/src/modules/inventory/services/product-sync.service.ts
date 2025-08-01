import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { InventoryItem } from '../entities/inventory-item.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { Supplier } from '../entities/supplier.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { Product } from '../../products/entities/product.entity';

export interface SyncResult {
  syncId: string;
  startTime: Date;
  endTime: Date;
  totalItems: number;
  processedItems: number;
  updatedItems: number;
  failedItems: number;
  errors: Array<{
    itemId: string;
    error: string;
    details?: any;
  }>;
  summary: {
    priceUpdates: number;
    stockUpdates: number;
    newProducts: number;
    discontinuedProducts: number;
  };
}

export interface SyncConfiguration {
  autoSync: boolean;
  syncFrequency: 'hourly' | 'daily' | 'weekly';
  syncHour?: number; // For daily sync
  syncDayOfWeek?: number; // For weekly sync (0=Sunday)
  enabledSuppliers: string[];
  syncTypes: {
    prices: boolean;
    stock: boolean;
    productInfo: boolean;
    availability: boolean;
  };
  conflictResolution: {
    priceConflict: 'supplier_wins' | 'manual_review' | 'no_change';
    stockConflict: 'supplier_wins' | 'manual_review' | 'no_change';
  };
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    onConflicts: boolean;
    emailRecipients: string[];
  };
}

export interface ProductMatch {
  supplierProductId: string;
  inventoryItemId: string;
  confidence: number;
  matchType: 'exact' | 'sku' | 'barcode' | 'manual';
  lastVerified: Date;
  isActive: boolean;
}

@Injectable()
export class ProductSyncService {
  private readonly logger = new Logger(ProductSyncService.name);
  private activeSyncs = new Map<string, boolean>();

  constructor(
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(SupplierProduct)
    private readonly supplierProductRepository: Repository<SupplierProduct>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(StockMovement)
    private readonly movementRepository: Repository<StockMovement>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  /**
   * Manuel senkronizasyon başlat
   */
  async startManualSync(userId: string, options?: {
    supplierIds?: string[];
    inventoryItemIds?: string[];
    syncTypes?: SyncConfiguration['syncTypes'];
    forceUpdate?: boolean;
  }): Promise<SyncResult> {
    const syncId = `manual_${Date.now()}_${userId}`;
    
    try {
      this.logger.log(`Starting manual sync: ${syncId}`);

      if (this.activeSyncs.has(userId)) {
        throw new Error('Bu kullanıcı için zaten aktif bir senkronizasyon var');
      }

      this.activeSyncs.set(userId, true);

      const syncResult: SyncResult = {
        syncId,
        startTime: new Date(),
        endTime: new Date(),
        totalItems: 0,
        processedItems: 0,
        updatedItems: 0,
        failedItems: 0,
        errors: [],
        summary: {
          priceUpdates: 0,
          stockUpdates: 0,
          newProducts: 0,
          discontinuedProducts: 0,
        },
      };

      // Senkronize edilecek itemları bul
      let query = this.inventoryRepository.createQueryBuilder('item')
        .leftJoinAndSelect('item.supplierProduct', 'sp')
        .leftJoinAndSelect('sp.supplier', 'supplier')
        .where('item.userId = :userId', { userId })
        .andWhere('item.isActive = :isActive', { isActive: true });

      if (options?.supplierIds && options.supplierIds.length > 0) {
        query = query.andWhere('supplier.id IN (:...supplierIds)', {
          supplierIds: options.supplierIds,
        });
      }

      if (options?.inventoryItemIds && options.inventoryItemIds.length > 0) {
        query = query.andWhere('item.id IN (:...itemIds)', {
          itemIds: options.inventoryItemIds,
        });
      }

      const items = await query.getMany();
      syncResult.totalItems = items.length;

      // Her item için senkronizasyon
      for (const item of items) {
        try {
          const itemResult = await this.syncInventoryItem(
            item,
            options?.syncTypes || {
              prices: true,
              stock: true,
              productInfo: true,
              availability: true,
            },
            options?.forceUpdate || false
          );

          syncResult.processedItems++;

          if (itemResult.updated) {
            syncResult.updatedItems++;
            
            if (itemResult.priceChanged) syncResult.summary.priceUpdates++;
            if (itemResult.stockChanged) syncResult.summary.stockUpdates++;
            if (itemResult.productInfoChanged) syncResult.summary.newProducts++;
          }

        } catch (error) {
          syncResult.failedItems++;
          syncResult.errors.push({
            itemId: item.id,
            error: error.message,
            details: {
              productName: item.productName,
              supplierName: item.supplierProduct?.supplier?.name,
            },
          });

          this.logger.warn(`Sync failed for item ${item.id}: ${error.message}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      syncResult.endTime = new Date();
      this.activeSyncs.delete(userId);

      this.logger.log(`Manual sync completed: ${syncId} - ${syncResult.updatedItems}/${syncResult.totalItems} updated`);
      return syncResult;

    } catch (error) {
      this.activeSyncs.delete(userId);
      this.logger.error(`Manual sync failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Otomatik senkronizasyon (scheduler)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runAutomaticSync(): Promise<void> {
    try {
      this.logger.log('Running automatic sync for all users');

      // Otomatik sync enabled olan user'ları bul
      const activeSuppliers = await this.supplierRepository.find({
        where: { isActive: true, syncEnabled: true },
      });

      const userIds = [...new Set(activeSuppliers.map(s => s.userId))];

      for (const userId of userIds) {
        try {
          if (!this.activeSyncs.has(userId)) {
            await this.runUserAutomaticSync(userId);
          }
        } catch (error) {
          this.logger.warn(`Automatic sync failed for user ${userId}: ${error.message}`);
        }

        // Rate limiting between users
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.logger.log('Automatic sync completed');
    } catch (error) {
      this.logger.error(`Error in automatic sync: ${error.message}`);
    }
  }

  /**
   * Tek kullanıcı için otomatik sync
   */
  private async runUserAutomaticSync(userId: string): Promise<void> {
    try {
      const suppliers = await this.supplierRepository.find({
        where: { userId, isActive: true, syncEnabled: true },
      });

      if (suppliers.length === 0) {
        return;
      }

      // Her supplier için sınırlı sync
      for (const supplier of suppliers) {
        const canSync = this.canSupplierSync(supplier);
        
        if (canSync) {
          await this.syncSupplierProducts(supplier, {
            maxItems: 50, // Otomatik sync'te sınırlı
            quickSync: true,
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      this.logger.error(`User automatic sync failed for ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Supplier ürünlerini senkronize et
   */
  async syncSupplierProducts(supplier: Supplier, options?: {
    maxItems?: number;
    quickSync?: boolean;
    forceUpdate?: boolean;
  }): Promise<SyncResult> {
    const syncId = `supplier_${supplier.id}_${Date.now()}`;
    
    try {
      this.logger.log(`Syncing supplier products: ${supplier.name}`);

      const syncResult: SyncResult = {
        syncId,
        startTime: new Date(),
        endTime: new Date(),
        totalItems: 0,
        processedItems: 0,
        updatedItems: 0,
        failedItems: 0,
        errors: [],
        summary: {
          priceUpdates: 0,
          stockUpdates: 0,
          newProducts: 0,
          discontinuedProducts: 0,
        },
      };

      // Supplier'ın ürünlerini al
      let query = this.supplierProductRepository.createQueryBuilder('sp')
        .leftJoinAndSelect('sp.inventoryItems', 'item')
        .where('sp.supplierId = :supplierId', { supplierId: supplier.id })
        .andWhere('sp.isActive = :isActive', { isActive: true });

      if (options?.maxItems) {
        query = query.limit(options.maxItems);
      }

      const supplierProducts = await query.getMany();
      syncResult.totalItems = supplierProducts.length;

      for (const supplierProduct of supplierProducts) {
        try {
          // API'den güncel bilgileri al
          const supplierData = await this.fetchSupplierProductData(supplierProduct);
          
          if (supplierData) {
            const updateResult = await this.updateSupplierProduct(
              supplierProduct,
              supplierData,
              options?.quickSync || false
            );

            syncResult.processedItems++;

            if (updateResult.updated) {
              syncResult.updatedItems++;
              
              if (updateResult.priceChanged) syncResult.summary.priceUpdates++;
              if (updateResult.stockChanged) syncResult.summary.stockUpdates++;
            }
          }

        } catch (error) {
          syncResult.failedItems++;
          syncResult.errors.push({
            itemId: supplierProduct.id,
            error: error.message,
            details: { supplierProductId: supplierProduct.supplierProductId },
          });
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      syncResult.endTime = new Date();

      // Supplier sync timestamp'ini güncelle
      supplier.lastSyncAt = new Date();
      await this.supplierRepository.save(supplier);

      this.logger.log(`Supplier sync completed: ${supplier.name} - ${syncResult.updatedItems}/${syncResult.totalItems} updated`);
      return syncResult;

    } catch (error) {
      this.logger.error(`Supplier sync failed for ${supplier.name}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ürün eşleştirme
   */
  async matchProducts(userId: string, options?: {
    autoMatch?: boolean;
    confidenceThreshold?: number;
    supplierIds?: string[];
  }): Promise<{
    totalMatches: number;
    newMatches: number;
    updatedMatches: number;
    conflicts: Array<{
      supplierProductId: string;
      possibleMatches: ProductMatch[];
      reason: string;
    }>;
  }> {
    try {
      this.logger.log(`Starting product matching for user: ${userId}`);

      const result = {
        totalMatches: 0,
        newMatches: 0,
        updatedMatches: 0,
        conflicts: [] as any[],
      };

      // Eşleştirilmemiş supplier ürünleri
      let query = this.supplierProductRepository.createQueryBuilder('sp')
        .leftJoin('sp.inventoryItems', 'item')
        .leftJoinAndSelect('sp.supplier', 'supplier')
        .where('supplier.userId = :userId', { userId })
        .andWhere('sp.isActive = :isActive', { isActive: true });

      if (options?.supplierIds && options.supplierIds.length > 0) {
        query = query.andWhere('supplier.id IN (:...supplierIds)', {
          supplierIds: options.supplierIds,
        });
      }

      const unmatchedProducts = await query.getMany();

      for (const supplierProduct of unmatchedProducts) {
        try {
          const matches = await this.findProductMatches(supplierProduct, userId);
          
          if (matches.length === 1 && matches[0].confidence >= (options?.confidenceThreshold || 0.8)) {
            // Yüksek güvenilirlik - otomatik eşleştir
            if (options?.autoMatch !== false) {
              await this.createProductMatch(supplierProduct, matches[0]);
              result.newMatches++;
            }
          } else if (matches.length > 1) {
            // Çoklu eşleşme - manuel inceleme gerekli
            result.conflicts.push({
              supplierProductId: supplierProduct.id,
              possibleMatches: matches,
              reason: 'Multiple potential matches found',
            });
          }

          result.totalMatches += matches.length;

        } catch (error) {
          this.logger.warn(`Product matching failed for ${supplierProduct.id}: ${error.message}`);
        }
      }

      this.logger.log(`Product matching completed: ${result.newMatches} new matches, ${result.conflicts.length} conflicts`);
      return result;

    } catch (error) {
      this.logger.error(`Product matching failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync durumunu kontrol et
   */
  async getSyncStatus(userId: string): Promise<{
    isActive: boolean;
    lastSync?: Date;
    nextSync?: Date;
    configuration: SyncConfiguration;
    recentSyncs: Array<{
      syncId: string;
      startTime: Date;
      duration: number;
      itemsUpdated: number;
      success: boolean;
    }>;
    statistics: {
      totalSyncs: number;
      successRate: number;
      avgDuration: number;
      avgItemsPerSync: number;
    };
  }> {
    try {
      const isActive = this.activeSyncs.has(userId);

      // Bu gerçek implementasyonda database'den gelecek
      const configuration: SyncConfiguration = {
        autoSync: true,
        syncFrequency: 'daily',
        syncHour: 9,
        enabledSuppliers: [],
        syncTypes: {
          prices: true,
          stock: true,
          productInfo: true,
          availability: true,
        },
        conflictResolution: {
          priceConflict: 'supplier_wins',
          stockConflict: 'manual_review',
        },
        notifications: {
          onSuccess: false,
          onFailure: true,
          onConflicts: true,
          emailRecipients: [],
        },
      };

      // Mock data - gerçek implementasyonda database'den gelecek
      const recentSyncs = [
        {
          syncId: 'sync_123',
          startTime: new Date(),
          duration: 120,
          itemsUpdated: 45,
          success: true,
        },
      ];

      const statistics = {
        totalSyncs: 10,
        successRate: 0.95,
        avgDuration: 85,
        avgItemsPerSync: 32,
      };

      return {
        isActive,
        configuration,
        recentSyncs,
        statistics,
      };

    } catch (error) {
      this.logger.error(`Error getting sync status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync raporu oluştur
   */
  async generateSyncReport(userId: string, options: {
    period: 'week' | 'month' | 'quarter';
    format: 'json' | 'csv' | 'excel';
    includeDetails?: boolean;
  }): Promise<{
    reportId: string;
    generatedAt: Date;
    period: string;
    data: any;
    downloadUrl?: string;
  }> {
    try {
      this.logger.log(`Generating sync report for user: ${userId}`);

      const reportId = `sync_report_${Date.now()}_${userId}`;
      const now = new Date();

      // Period hesapla
      const periodStart = new Date();
      switch (options.period) {
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

      // Mock data - gerçek implementasyonda database'den gelecek
      const reportData = {
        summary: {
          totalSyncs: 28,
          successfulSyncs: 26,
          failedSyncs: 2,
          totalItemsProcessed: 1250,
          totalItemsUpdated: 420,
          avgSyncDuration: 95,
        },
        suppliers: [
          {
            name: 'Alibaba Supplier 1',
            syncs: 14,
            successRate: 0.93,
            itemsUpdated: 180,
          },
        ],
        trends: {
          syncFrequency: 'Increasing',
          updateRate: 'Stable',
          errorRate: 'Decreasing',
        },
        errors: [
          {
            date: new Date(),
            supplier: 'Test Supplier',
            error: 'API rate limit exceeded',
            count: 3,
          },
        ],
      };

      return {
        reportId,
        generatedAt: now,
        period: `${periodStart.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`,
        data: reportData,
        downloadUrl: options.format !== 'json' ? `/api/reports/${reportId}/download` : undefined,
      };

    } catch (error) {
      this.logger.error(`Error generating sync report: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private async syncInventoryItem(
    item: InventoryItem,
    syncTypes: SyncConfiguration['syncTypes'],
    forceUpdate: boolean
  ): Promise<{
    updated: boolean;
    priceChanged: boolean;
    stockChanged: boolean;
    productInfoChanged: boolean;
  }> {
    const result = {
      updated: false,
      priceChanged: false,
      stockChanged: false,
      productInfoChanged: false,
    };

    if (!item.supplierProduct) {
      throw new Error('No supplier product linked');
    }

    // Supplier'dan güncel bilgileri al
    const supplierData = await this.fetchSupplierProductData(item.supplierProduct);
    
    if (!supplierData) {
      throw new Error('Could not fetch supplier data');
    }

    // Price sync
    if (syncTypes.prices && supplierData.price && 
        (forceUpdate || Math.abs(supplierData.price - item.costPrice) > 0.01)) {
      item.costPrice = supplierData.price;
      result.priceChanged = true;
      result.updated = true;
    }

    // Stock sync
    if (syncTypes.stock && supplierData.stock !== undefined &&
        (forceUpdate || supplierData.stock !== item.supplierStock)) {
      item.supplierStock = supplierData.stock;
      result.stockChanged = true;
      result.updated = true;
    }

    // Product info sync
    if (syncTypes.productInfo && supplierData.productInfo) {
      if (supplierData.productInfo.title && 
          supplierData.productInfo.title !== item.productName) {
        item.productName = supplierData.productInfo.title;
        result.productInfoChanged = true;
        result.updated = true;
      }
    }

    // Availability sync
    if (syncTypes.availability && supplierData.availability !== undefined) {
      item.supplierProduct.isAvailable = supplierData.availability;
      result.updated = true;
    }

    if (result.updated) {
      item.lastSyncAt = new Date();
      await this.inventoryRepository.save(item);
      
      if (item.supplierProduct) {
        await this.supplierProductRepository.save(item.supplierProduct);
      }
    }

    return result;
  }

  private async fetchSupplierProductData(supplierProduct: SupplierProduct): Promise<{
    price?: number;
    stock?: number;
    availability?: boolean;
    productInfo?: {
      title?: string;
      description?: string;
      imageUrl?: string;
    };
  } | null> {
    try {
      // Bu gerçek implementasyonda supplier API'sine request yapacak
      // Şimdilik mock data
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Simulate API call

      return {
        price: Math.random() * 100 + 10,
        stock: Math.floor(Math.random() * 1000),
        availability: Math.random() > 0.1,
        productInfo: {
          title: `Updated Product ${supplierProduct.supplierProductId}`,
          description: 'Updated description',
        },
      };
    } catch (error) {
      this.logger.warn(`Error fetching supplier data: ${error.message}`);
      return null;
    }
  }

  private async updateSupplierProduct(
    supplierProduct: SupplierProduct,
    supplierData: any,
    quickSync: boolean
  ): Promise<{
    updated: boolean;
    priceChanged: boolean;
    stockChanged: boolean;
  }> {
    const result = {
      updated: false,
      priceChanged: false,
      stockChanged: false,
    };

    // Price update
    if (supplierData.price && Math.abs(supplierData.price - supplierProduct.price) > 0.01) {
      supplierProduct.price = supplierData.price;
      result.priceChanged = true;
      result.updated = true;
    }

    // Stock update (quick sync'te sadece büyük değişiklikler)
    if (supplierData.stock !== undefined) {
      const stockDiff = Math.abs(supplierData.stock - (supplierProduct.stock || 0));
      const threshold = quickSync ? 10 : 1;
      
      if (stockDiff >= threshold) {
        supplierProduct.stock = supplierData.stock;
        result.stockChanged = true;
        result.updated = true;
      }
    }

    // Availability
    if (supplierData.availability !== undefined) {
      supplierProduct.isAvailable = supplierData.availability;
      result.updated = true;
    }

    if (result.updated) {
      supplierProduct.lastSyncAt = new Date();
      await this.supplierProductRepository.save(supplierProduct);
    }

    return result;
  }

  private canSupplierSync(supplier: Supplier): boolean {
    if (!supplier.lastSyncAt) {
      return true; // İlk sync
    }

    const now = new Date();
    const timeSinceLastSync = now.getTime() - supplier.lastSyncAt.getTime();
    const minInterval = 60 * 60 * 1000; // 1 saat minimum

    return timeSinceLastSync >= minInterval;
  }

  private async findProductMatches(
    supplierProduct: SupplierProduct,
    userId: string
  ): Promise<ProductMatch[]> {
    const matches: ProductMatch[] = [];

    // SKU-based matching
    if (supplierProduct.sku) {
      const skuMatches = await this.inventoryRepository.find({
        where: { userId, sku: supplierProduct.sku },
      });

      for (const item of skuMatches) {
        matches.push({
          supplierProductId: supplierProduct.id,
          inventoryItemId: item.id,
          confidence: 0.95,
          matchType: 'sku',
          lastVerified: new Date(),
          isActive: true,
        });
      }
    }

    // Barcode-based matching
    if (supplierProduct.barcode) {
      const barcodeMatches = await this.inventoryRepository.find({
        where: { userId, barcode: supplierProduct.barcode },
      });

      for (const item of barcodeMatches) {
        matches.push({
          supplierProductId: supplierProduct.id,
          inventoryItemId: item.id,
          confidence: 0.9,
          matchType: 'barcode',
          lastVerified: new Date(),
          isActive: true,
        });
      }
    }

    return matches;
  }

  private async createProductMatch(
    supplierProduct: SupplierProduct,
    match: ProductMatch
  ): Promise<void> {
    const inventoryItem = await this.inventoryRepository.findOne({
      where: { id: match.inventoryItemId },
    });

    if (inventoryItem) {
      inventoryItem.supplierProductId = supplierProduct.id;
      await this.inventoryRepository.save(inventoryItem);

      this.logger.log(`Product matched: ${supplierProduct.id} -> ${inventoryItem.id}`);
    }
  }
}