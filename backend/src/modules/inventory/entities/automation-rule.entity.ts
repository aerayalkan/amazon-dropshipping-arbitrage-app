import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('automation_rules')
@Index(['userId', 'isActive'])
@Index(['ruleType', 'isActive'])
@Index(['priority'])
export class AutomationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: [
      'price_update',
      'stock_reorder',
      'stock_alert',
      'price_alert',
      'competitor_tracking',
      'inventory_sync',
      'auto_listing',
      'performance_optimization',
    ],
  })
  ruleType: 
    | 'price_update'
    | 'stock_reorder'
    | 'stock_alert'
    | 'price_alert'
    | 'competitor_tracking'
    | 'inventory_sync'
    | 'auto_listing'
    | 'performance_optimization';

  @Column('jsonb')
  conditions: {
    triggers: Array<{
      field: string;
      operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'between';
      value: any;
      logicalOperator?: 'AND' | 'OR';
    }>;
    filters?: {
      categories?: string[];
      suppliers?: string[];
      tags?: string[];
      priceRange?: { min: number; max: number };
      stockRange?: { min: number; max: number };
    };
  };

  @Column('jsonb')
  actions: {
    primaryAction: {
      type: string;
      parameters: { [key: string]: any };
    };
    secondaryActions?: Array<{
      type: string;
      parameters: { [key: string]: any };
      delay?: number; // seconds
    }>;
    notifications?: Array<{
      type: 'email' | 'sms' | 'push' | 'webhook';
      recipients: string[];
      template?: string;
    }>;
  };

  @Column('int', { default: 5 })
  priority: number; // 1-10, higher = more priority

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isGlobal: boolean; // Applies to all products or specific ones

  @Column('text', { array: true, default: [] })
  targetProductIds: string[]; // If not global, specific product IDs

  @Column('text', { array: true, default: [] })
  targetCategories: string[];

  @Column('text', { array: true, default: [] })
  targetSuppliers: string[];

  @Column('jsonb', { nullable: true })
  schedule?: {
    frequency: 'once' | 'daily' | 'weekly' | 'monthly' | 'realtime';
    interval?: number; // For frequency-based rules
    timeOfDay?: string; // HH:MM format
    daysOfWeek?: number[]; // 0-6, Sunday = 0
    daysOfMonth?: number[]; // 1-31
    timezone?: string;
  };

  @Column('jsonb', { nullable: true })
  limits?: {
    maxExecutionsPerDay?: number;
    maxExecutionsPerHour?: number;
    cooldownPeriod?: number; // Minutes between executions
    budgetLimit?: number; // For actions that cost money
  };

  @Column('int', { default: 0 })
  executionCount: number;

  @Column('timestamp', { nullable: true })
  lastExecuted?: Date;

  @Column('timestamp', { nullable: true })
  lastSuccess?: Date;

  @Column('timestamp', { nullable: true })
  lastFailure?: Date;

  @Column('text', { nullable: true })
  lastError?: string;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  successRate: number;

  @Column('jsonb', { nullable: true })
  executionHistory?: Array<{
    timestamp: string;
    success: boolean;
    details: string;
    affectedItems: number;
  }>;

  @Column('jsonb', { nullable: true })
  configuration?: {
    retryAttempts?: number;
    retryDelay?: number;
    timeoutSeconds?: number;
    batchSize?: number;
    parallelExecution?: boolean;
    rollbackOnFailure?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // Virtual Properties
  get isScheduled(): boolean {
    return this.schedule?.frequency !== 'realtime' && this.schedule?.frequency !== 'once';
  }

  get isRealtime(): boolean {
    return this.schedule?.frequency === 'realtime';
  }

  get nextExecution(): Date | null {
    if (!this.isScheduled || !this.isActive) return null;

    const now = new Date();
    const schedule = this.schedule!;

    switch (schedule.frequency) {
      case 'daily':
        const nextDaily = new Date(now);
        if (schedule.timeOfDay) {
          const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
          nextDaily.setHours(hours, minutes, 0, 0);
          if (nextDaily <= now) {
            nextDaily.setDate(nextDaily.getDate() + 1);
          }
        }
        return nextDaily;

      case 'weekly':
        // Implementation for weekly scheduling
        return null; // Simplified for now

      case 'monthly':
        // Implementation for monthly scheduling
        return null; // Simplified for now

      default:
        return null;
    }
  }

  get canExecute(): boolean {
    if (!this.isActive) return false;

    // Check cooldown period
    if (this.limits?.cooldownPeriod && this.lastExecuted) {
      const cooldownEnd = new Date(this.lastExecuted);
      cooldownEnd.setMinutes(cooldownEnd.getMinutes() + this.limits.cooldownPeriod);
      if (new Date() < cooldownEnd) return false;
    }

    // Check daily execution limit
    if (this.limits?.maxExecutionsPerDay) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todayExecutions = this.executionHistory?.filter(exec => 
        new Date(exec.timestamp) >= today
      ).length || 0;
      
      if (todayExecutions >= this.limits.maxExecutionsPerDay) return false;
    }

    // Check hourly execution limit
    if (this.limits?.maxExecutionsPerHour) {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const recentExecutions = this.executionHistory?.filter(exec => 
        new Date(exec.timestamp) >= oneHourAgo
      ).length || 0;
      
      if (recentExecutions >= this.limits.maxExecutionsPerHour) return false;
    }

    return true;
  }

  get healthScore(): number {
    let score = 100;

    // Success rate impact
    if (this.executionCount > 0) {
      score *= (this.successRate / 100);
    }

    // Recent failures impact
    if (this.lastFailure && this.lastSuccess) {
      if (this.lastFailure > this.lastSuccess) {
        score *= 0.7; // 30% penalty for recent failure
      }
    }

    // Execution frequency impact
    if (this.isActive && this.lastExecuted) {
      const daysSinceExecution = Math.floor(
        (Date.now() - this.lastExecuted.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceExecution > 7) {
        score *= 0.8; // 20% penalty for stale rules
      }
    }

    return Math.round(score);
  }

  // Methods
  evaluateConditions(data: any): boolean {
    const { triggers, filters } = this.conditions;

    // Evaluate triggers
    let triggerResult = true;
    let currentLogicalOp = 'AND';

    for (const trigger of triggers) {
      const fieldValue = this.getNestedValue(data, trigger.field);
      const conditionResult = this.evaluateCondition(fieldValue, trigger.operator, trigger.value);

      if (currentLogicalOp === 'AND') {
        triggerResult = triggerResult && conditionResult;
      } else {
        triggerResult = triggerResult || conditionResult;
      }

      currentLogicalOp = trigger.logicalOperator || 'AND';
    }

    // Evaluate filters if triggers pass
    if (triggerResult && filters) {
      return this.evaluateFilters(data, filters);
    }

    return triggerResult;
  }

  private evaluateCondition(fieldValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'equals':
        return fieldValue === expectedValue;
      case 'not_equals':
        return fieldValue !== expectedValue;
      case 'greater_than':
        return Number(fieldValue) > Number(expectedValue);
      case 'less_than':
        return Number(fieldValue) < Number(expectedValue);
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(expectedValue).toLowerCase());
      case 'between':
        const [min, max] = expectedValue;
        const numValue = Number(fieldValue);
        return numValue >= min && numValue <= max;
      default:
        return false;
    }
  }

  private evaluateFilters(data: any, filters: any): boolean {
    // Category filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(data.categoryId)) {
        return false;
      }
    }

    // Supplier filter
    if (filters.suppliers && filters.suppliers.length > 0) {
      if (!filters.suppliers.includes(data.supplierId)) {
        return false;
      }
    }

    // Price range filter
    if (filters.priceRange) {
      const price = Number(data.price);
      if (price < filters.priceRange.min || price > filters.priceRange.max) {
        return false;
      }
    }

    // Stock range filter
    if (filters.stockRange) {
      const stock = Number(data.stockLevel);
      if (stock < filters.stockRange.min || stock > filters.stockRange.max) {
        return false;
      }
    }

    return true;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  recordExecution(success: boolean, details: string, affectedItems: number = 0): void {
    this.executionCount += 1;
    this.lastExecuted = new Date();

    if (success) {
      this.lastSuccess = new Date();
    } else {
      this.lastFailure = new Date();
      this.lastError = details;
    }

    // Update success rate
    if (this.executionCount === 1) {
      this.successRate = success ? 100 : 0;
    } else {
      const currentSuccesses = Math.round((this.successRate / 100) * (this.executionCount - 1));
      const newSuccesses = success ? currentSuccesses + 1 : currentSuccesses;
      this.successRate = (newSuccesses / this.executionCount) * 100;
    }

    // Add to execution history
    if (!this.executionHistory) {
      this.executionHistory = [];
    }

    this.executionHistory.push({
      timestamp: new Date().toISOString(),
      success,
      details,
      affectedItems,
    });

    // Keep only last 100 execution records
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Kural adı gerekli');
    }

    if (!this.conditions || !this.conditions.triggers || this.conditions.triggers.length === 0) {
      errors.push('En az bir tetikleyici koşul gerekli');
    }

    if (!this.actions || !this.actions.primaryAction) {
      errors.push('Ana eylem gerekli');
    }

    if (this.priority < 1 || this.priority > 10) {
      errors.push('Öncelik 1-10 arasında olmalı');
    }

    // Validate schedule if present
    if (this.schedule) {
      if (this.schedule.frequency === 'daily' && this.schedule.timeOfDay) {
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(this.schedule.timeOfDay)) {
          errors.push('Geçersiz zaman formatı (HH:MM bekleniyor)');
        }
      }

      if (this.schedule.daysOfWeek) {
        const invalidDays = this.schedule.daysOfWeek.filter(day => day < 0 || day > 6);
        if (invalidDays.length > 0) {
          errors.push('Geçersiz hafta günü (0-6 arasında olmalı)');
        }
      }
    }

    // Validate limits if present
    if (this.limits) {
      if (this.limits.maxExecutionsPerDay && this.limits.maxExecutionsPerDay < 1) {
        errors.push('Günlük maksimum çalıştırma sayısı 1\'den az olamaz');
      }

      if (this.limits.maxExecutionsPerHour && this.limits.maxExecutionsPerHour < 1) {
        errors.push('Saatlik maksimum çalıştırma sayısı 1\'den az olamaz');
      }

      if (this.limits.cooldownPeriod && this.limits.cooldownPeriod < 0) {
        errors.push('Bekleme süresi negatif olamaz');
      }
    }

    return errors;
  }

  static createPriceUpdateRule(data: {
    userId: string;
    name: string;
    priceChangeThreshold: number;
    newPriceFormula: string;
    targetProducts?: string[];
  }): Partial<AutomationRule> {
    return {
      userId: data.userId,
      name: data.name,
      ruleType: 'price_update',
      conditions: {
        triggers: [
          {
            field: 'supplierPrice',
            operator: 'greater_than',
            value: 0,
          },
        ],
      },
      actions: {
        primaryAction: {
          type: 'update_price',
          parameters: {
            formula: data.newPriceFormula,
            threshold: data.priceChangeThreshold,
          },
        },
        notifications: [
          {
            type: 'email',
            recipients: ['user@example.com'],
            template: 'price_update_notification',
          },
        ],
      },
      isGlobal: !data.targetProducts,
      targetProductIds: data.targetProducts || [],
      schedule: {
        frequency: 'daily',
        timeOfDay: '09:00',
      },
      isActive: true,
    };
  }

  static createStockReorderRule(data: {
    userId: string;
    name: string;
    reorderPoint: number;
    reorderQuantity: number;
    targetProducts?: string[];
  }): Partial<AutomationRule> {
    return {
      userId: data.userId,
      name: data.name,
      ruleType: 'stock_reorder',
      conditions: {
        triggers: [
          {
            field: 'availableStock',
            operator: 'less_than',
            value: data.reorderPoint,
          },
        ],
      },
      actions: {
        primaryAction: {
          type: 'create_reorder',
          parameters: {
            quantity: data.reorderQuantity,
            autoApprove: false,
          },
        },
        notifications: [
          {
            type: 'email',
            recipients: ['inventory@example.com'],
            template: 'reorder_notification',
          },
        ],
      },
      isGlobal: !data.targetProducts,
      targetProductIds: data.targetProducts || [],
      schedule: {
        frequency: 'realtime',
      },
      isActive: true,
    };
  }
}