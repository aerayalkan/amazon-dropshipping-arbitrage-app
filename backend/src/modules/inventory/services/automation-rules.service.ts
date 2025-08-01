import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AutomationRule } from '../entities/automation-rule.entity';
import { InventoryItem } from '../entities/inventory-item.entity';
import { SupplierProduct } from '../entities/supplier-product.entity';
import { PriceUpdateLog } from '../entities/price-update-log.entity';
import { InventoryTrackingService } from './inventory-tracking.service';
import { StockAlertService } from './stock-alert.service';

export interface RuleExecution {
  ruleId: string;
  ruleName: string;
  success: boolean;
  affectedItems: number;
  details: string;
  executionTime: number;
  errors?: string[];
}

export interface RuleValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

@Injectable()
export class AutomationRulesService {
  private readonly logger = new Logger(AutomationRulesService.name);

  constructor(
    @InjectRepository(AutomationRule)
    private readonly ruleRepository: Repository<AutomationRule>,
    @InjectRepository(InventoryItem)
    private readonly inventoryRepository: Repository<InventoryItem>,
    @InjectRepository(SupplierProduct)
    private readonly supplierProductRepository: Repository<SupplierProduct>,
    @InjectRepository(PriceUpdateLog)
    private readonly priceLogRepository: Repository<PriceUpdateLog>,
    private readonly inventoryTrackingService: InventoryTrackingService,
    private readonly stockAlertService: StockAlertService,
  ) {}

  /**
   * Yeni kural oluştur
   */
  async createRule(userId: string, ruleData: {
    name: string;
    description?: string;
    ruleType: AutomationRule['ruleType'];
    conditions: AutomationRule['conditions'];
    actions: AutomationRule['actions'];
    priority?: number;
    isGlobal?: boolean;
    targetProductIds?: string[];
    schedule?: AutomationRule['schedule'];
    limits?: AutomationRule['limits'];
  }): Promise<AutomationRule> {
    try {
      this.logger.log(`Creating automation rule: ${ruleData.name} for user: ${userId}`);

      // Kural validasyonu
      const validation = this.validateRule(ruleData);
      if (!validation.isValid) {
        throw new Error(`Kural geçersiz: ${validation.errors.join(', ')}`);
      }

      const rule = this.ruleRepository.create({
        userId,
        ...ruleData,
        isActive: true,
        executionCount: 0,
        successRate: 0,
      });

      const savedRule = await this.ruleRepository.save(rule);

      this.logger.log(`Automation rule created: ${savedRule.id}`);
      return savedRule;
    } catch (error) {
      this.logger.error(`Error creating automation rule: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kuralları manuel çalıştır
   */
  async executeRule(ruleId: string): Promise<RuleExecution> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`Executing automation rule: ${ruleId}`);

      const rule = await this.ruleRepository.findOne({
        where: { id: ruleId, isActive: true },
      });

      if (!rule) {
        throw new Error('Kural bulunamadı veya deaktif');
      }

      if (!rule.canExecute) {
        throw new Error('Kural şu anda çalıştırılamaz (limit veya cooldown)');
      }

      // Hedef öğeleri al
      const targetItems = await this.getTargetItems(rule);

      if (targetItems.length === 0) {
        const execution: RuleExecution = {
          ruleId: rule.id,
          ruleName: rule.name,
          success: true,
          affectedItems: 0,
          details: 'Koşulları karşılayan öğe bulunamadı',
          executionTime: Date.now() - startTime,
        };

        rule.recordExecution(true, execution.details, 0);
        await this.ruleRepository.save(rule);

        return execution;
      }

      // Koşulları kontrol et ve eylemleri çalıştır
      let affectedItems = 0;
      const errors: string[] = [];

      for (const item of targetItems) {
        try {
          const shouldExecute = rule.evaluateConditions(item);
          
          if (shouldExecute) {
            await this.executeActions(rule, item);
            affectedItems++;
          }
        } catch (error) {
          errors.push(`Item ${item.id}: ${error.message}`);
        }
      }

      const success = errors.length === 0;
      const details = success 
        ? `${affectedItems} öğe başarıyla işlendi`
        : `${affectedItems} öğe işlendi, ${errors.length} hata`;

      // Execution kaydını güncelle
      rule.recordExecution(success, details, affectedItems);
      await this.ruleRepository.save(rule);

      const execution: RuleExecution = {
        ruleId: rule.id,
        ruleName: rule.name,
        success,
        affectedItems,
        details,
        executionTime: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      };

      this.logger.log(`Rule execution completed: ${execution.details}`);
      return execution;
    } catch (error) {
      this.logger.error(`Error executing rule ${ruleId}: ${error.message}`);
      
      // Hata kaydını güncelle
      try {
        const rule = await this.ruleRepository.findOne({ where: { id: ruleId } });
        if (rule) {
          rule.recordExecution(false, error.message, 0);
          await this.ruleRepository.save(rule);
        }
      } catch (updateError) {
        this.logger.error(`Error updating rule execution record: ${updateError.message}`);
      }

      throw error;
    }
  }

  /**
   * Tüm aktif kuralları çalıştır (scheduler tarafından çağrılır)
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async executeScheduledRules(): Promise<void> {
    try {
      this.logger.log('Executing scheduled automation rules');

      const now = new Date();

      // Çalıştırılması gereken kuralları bul
      const rules = await this.ruleRepository.find({
        where: { isActive: true },
      });

      const eligibleRules = rules.filter(rule => {
        if (!rule.canExecute) return false;

        // Realtime kurallar her zaman çalışır
        if (rule.isRealtime) return true;

        // Scheduled kuralları kontrol et
        if (rule.isScheduled && rule.nextExecution) {
          return rule.nextExecution <= now;
        }

        return false;
      });

      this.logger.log(`Found ${eligibleRules.length} eligible rules to execute`);

      // Öncelik sırasına göre çalıştır
      const sortedRules = eligibleRules.sort((a, b) => b.priority - a.priority);

      for (const rule of sortedRules) {
        try {
          await this.executeRule(rule.id);
        } catch (error) {
          this.logger.error(`Error executing scheduled rule ${rule.id}: ${error.message}`);
        }

        // Rate limiting için kısa bekleme
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.log('Scheduled rule execution completed');
    } catch (error) {
      this.logger.error(`Error in scheduled rule execution: ${error.message}`);
    }
  }

  /**
   * Realtime event-based rule execution
   */
  async executeRealtimeRules(eventType: string, data: any): Promise<void> {
    try {
      const realtimeRules = await this.ruleRepository.find({
        where: {
          isActive: true,
          ruleType: In(['price_update', 'stock_alert', 'inventory_sync']),
        },
      });

      const applicableRules = realtimeRules.filter(rule => 
        rule.isRealtime && this.isEventApplicable(rule, eventType)
      );

      for (const rule of applicableRules) {
        try {
          if (rule.canExecute && rule.evaluateConditions(data)) {
            await this.executeActions(rule, data);
          }
        } catch (error) {
          this.logger.error(`Error executing realtime rule ${rule.id}: ${error.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error in realtime rule execution: ${error.message}`);
    }
  }

  /**
   * Kural validasyonu
   */
  validateRule(ruleData: any): RuleValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Temel validasyonlar
    if (!ruleData.name || ruleData.name.trim().length === 0) {
      errors.push('Kural adı gerekli');
    }

    if (!ruleData.conditions || !ruleData.conditions.triggers || ruleData.conditions.triggers.length === 0) {
      errors.push('En az bir koşul gerekli');
    }

    if (!ruleData.actions || !ruleData.actions.primaryAction) {
      errors.push('Ana eylem gerekli');
    }

    // Priority validation
    if (ruleData.priority && (ruleData.priority < 1 || ruleData.priority > 10)) {
      errors.push('Öncelik 1-10 arasında olmalı');
    }

    // Schedule validation
    if (ruleData.schedule) {
      if (ruleData.schedule.frequency === 'daily' && ruleData.schedule.timeOfDay) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(ruleData.schedule.timeOfDay)) {
          errors.push('Geçersiz zaman formatı');
        }
      }
    }

    // Action validation
    if (ruleData.actions) {
      const validActionTypes = [
        'update_price', 'create_reorder', 'send_notification', 
        'update_stock', 'sync_supplier', 'create_alert'
      ];

      if (!validActionTypes.includes(ruleData.actions.primaryAction.type)) {
        errors.push('Geçersiz eylem tipi');
      }
    }

    // Warnings
    if (ruleData.isGlobal && ruleData.targetProductIds && ruleData.targetProductIds.length > 0) {
      warnings.push('Global kural için hedef ürün listesi göz ardı edilecek');
    }

    if (!ruleData.limits) {
      suggestions.push('Güvenlik için execution limits belirlemeniz önerilir');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Kural istatistikleri
   */
  async getRuleStatistics(userId: string): Promise<{
    totalRules: number;
    activeRules: number;
    totalExecutions: number;
    successfulExecutions: number;
    averageSuccessRate: number;
    topPerformingRules: Array<{
      id: string;
      name: string;
      successRate: number;
      executionCount: number;
    }>;
    recentExecutions: Array<{
      ruleId: string;
      ruleName: string;
      executedAt: Date;
      success: boolean;
      affectedItems: number;
    }>;
  }> {
    try {
      const rules = await this.ruleRepository.find({
        where: { userId },
      });

      const totalRules = rules.length;
      const activeRules = rules.filter(r => r.isActive).length;
      const totalExecutions = rules.reduce((sum, r) => sum + r.executionCount, 0);
      const successfulExecutions = rules.reduce((sum, r) => {
        return sum + Math.round((r.successRate / 100) * r.executionCount);
      }, 0);

      const averageSuccessRate = rules.length > 0
        ? rules.reduce((sum, r) => sum + r.successRate, 0) / rules.length
        : 0;

      const topPerformingRules = rules
        .filter(r => r.executionCount > 0)
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5)
        .map(r => ({
          id: r.id,
          name: r.name,
          successRate: r.successRate,
          executionCount: r.executionCount,
        }));

      const recentExecutions = rules
        .filter(r => r.executionHistory && r.executionHistory.length > 0)
        .flatMap(r => r.executionHistory!.map(h => ({
          ruleId: r.id,
          ruleName: r.name,
          executedAt: new Date(h.timestamp),
          success: h.success,
          affectedItems: h.affectedItems,
        })))
        .sort((a, b) => b.executedAt.getTime() - a.executedAt.getTime())
        .slice(0, 10);

      return {
        totalRules,
        activeRules,
        totalExecutions,
        successfulExecutions,
        averageSuccessRate,
        topPerformingRules,
        recentExecutions,
      };
    } catch (error) {
      this.logger.error(`Error getting rule statistics: ${error.message}`);
      throw error;
    }
  }

  // Private helper methods
  private async getTargetItems(rule: AutomationRule): Promise<InventoryItem[]> {
    let query = this.inventoryRepository.createQueryBuilder('item')
      .where('item.userId = :userId', { userId: rule.userId })
      .andWhere('item.isActive = :isActive', { isActive: true });

    // Global değilse specific products
    if (!rule.isGlobal && rule.targetProductIds.length > 0) {
      query = query.andWhere('item.productId IN (:...productIds)', {
        productIds: rule.targetProductIds,
      });
    }

    // Kategori filtreleri
    if (rule.targetCategories.length > 0) {
      query = query.leftJoin('item.product', 'product')
        .leftJoin('product.category', 'category')
        .andWhere('category.id IN (:...categoryIds)', {
          categoryIds: rule.targetCategories,
        });
    }

    return query.getMany();
  }

  private async executeActions(rule: AutomationRule, item: any): Promise<void> {
    const { primaryAction, secondaryActions, notifications } = rule.actions;

    // Ana eylemi çalıştır
    await this.executeAction(primaryAction, item, rule);

    // İkincil eylemleri çalıştır
    if (secondaryActions) {
      for (const action of secondaryActions) {
        try {
          if (action.delay) {
            await new Promise(resolve => setTimeout(resolve, action.delay * 1000));
          }
          await this.executeAction(action, item, rule);
        } catch (error) {
          this.logger.warn(`Secondary action failed: ${error.message}`);
        }
      }
    }

    // Bildirimleri gönder
    if (notifications) {
      for (const notification of notifications) {
        try {
          await this.sendNotification(notification, item, rule);
        } catch (error) {
          this.logger.warn(`Notification failed: ${error.message}`);
        }
      }
    }
  }

  private async executeAction(action: any, item: any, rule: AutomationRule): Promise<void> {
    switch (action.type) {
      case 'update_price':
        await this.executePriceUpdate(action.parameters, item, rule);
        break;
      
      case 'create_reorder':
        await this.executeReorder(action.parameters, item, rule);
        break;
      
      case 'send_notification':
        await this.executeNotification(action.parameters, item, rule);
        break;
      
      case 'update_stock':
        await this.executeStockUpdate(action.parameters, item, rule);
        break;
      
      case 'create_alert':
        await this.executeCreateAlert(action.parameters, item, rule);
        break;
      
      default:
        throw new Error(`Bilinmeyen eylem tipi: ${action.type}`);
    }
  }

  private async executePriceUpdate(parameters: any, item: InventoryItem, rule: AutomationRule): Promise<void> {
    try {
      const formula = parameters.formula || 'cost * 1.3'; // Default 30% markup
      const threshold = parameters.threshold || 5; // Default 5% threshold

      // Yeni fiyatı hesapla
      const currentPrice = item.sellingPrice || 0;
      const costPrice = item.costPrice || 0;
      
      // Simple formula evaluation - in production, use a proper expression evaluator
      let newPrice = costPrice * 1.3; // Default formula
      
      if (formula.includes('cost * ')) {
        const multiplier = parseFloat(formula.split('cost * ')[1]);
        newPrice = costPrice * multiplier;
      }

      // Threshold kontrolü
      const changePercent = currentPrice > 0 ? Math.abs((newPrice - currentPrice) / currentPrice) * 100 : 0;
      
      if (changePercent >= threshold) {
        // Fiyat güncelleme log'u oluştur
        const logData = PriceUpdateLog.createAutomationUpdateLog({
          userId: item.userId,
          inventoryItemId: item.id,
          automationRuleId: rule.id,
          oldPrice: currentPrice,
          newPrice: newPrice,
          ruleName: rule.name,
          triggeredBy: 'automation',
        });

        await this.priceLogRepository.save(logData);
        
        // Inventory item'ı güncelle
        item.sellingPrice = newPrice;
        await this.inventoryRepository.save(item);

        this.logger.log(`Price updated for item ${item.id}: ${currentPrice} -> ${newPrice}`);
      }
    } catch (error) {
      throw new Error(`Fiyat güncelleme hatası: ${error.message}`);
    }
  }

  private async executeReorder(parameters: any, item: InventoryItem, rule: AutomationRule): Promise<void> {
    try {
      const quantity = parameters.quantity || item.calculateReorderQuantity();
      const autoApprove = parameters.autoApprove || false;

      // Reorder alert oluştur
      await this.stockAlertService.createReorderAlert(item, {
        recommendedQuantity: quantity,
        autoApprove,
        triggeredBy: `Automation Rule: ${rule.name}`,
      });

      this.logger.log(`Reorder created for item ${item.id}: ${quantity} units`);
    } catch (error) {
      throw new Error(`Reorder oluşturma hatası: ${error.message}`);
    }
  }

  private async executeStockUpdate(parameters: any, item: InventoryItem, rule: AutomationRule): Promise<void> {
    try {
      const newLevel = parameters.newLevel;
      const reason = parameters.reason || `Automation Rule: ${rule.name}`;

      await this.inventoryTrackingService.updateStockLevel(
        item.id,
        newLevel,
        'system_correction',
        reason
      );

      this.logger.log(`Stock updated for item ${item.id}: ${newLevel}`);
    } catch (error) {
      throw new Error(`Stok güncelleme hatası: ${error.message}`);
    }
  }

  private async executeCreateAlert(parameters: any, item: InventoryItem, rule: AutomationRule): Promise<void> {
    try {
      const alertType = parameters.alertType || 'low_stock';
      const priority = parameters.priority || 'medium';
      const message = parameters.message || `Alert triggered by ${rule.name}`;

      await this.stockAlertService.createCustomAlert(item, {
        alertType,
        priority,
        message,
        triggeredBy: rule.name,
      });

      this.logger.log(`Alert created for item ${item.id}: ${alertType}`);
    } catch (error) {
      throw new Error(`Alert oluşturma hatası: ${error.message}`);
    }
  }

  private async executeNotification(parameters: any, item: InventoryItem, rule: AutomationRule): Promise<void> {
    // Notification service entegrasyonu - şimdilik log
    this.logger.log(`Notification sent for rule ${rule.name}: ${JSON.stringify(parameters)}`);
  }

  private async sendNotification(notification: any, item: any, rule: AutomationRule): Promise<void> {
    // Notification service entegrasyonu - şimdilik log
    this.logger.log(`Notification sent: ${notification.type} for rule ${rule.name}`);
  }

  private isEventApplicable(rule: AutomationRule, eventType: string): boolean {
    const eventRuleMapping: { [key: string]: AutomationRule['ruleType'][] } = {
      'stock_changed': ['stock_reorder', 'stock_alert'],
      'price_changed': ['price_update', 'price_alert'],
      'supplier_updated': ['inventory_sync', 'price_update'],
      'order_created': ['stock_reorder'],
    };

    return eventRuleMapping[eventType]?.includes(rule.ruleType) || false;
  }
}