import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';

export enum RuleType {
  COMPETITIVE = 'competitive', // Rekabet bazlı
  MARGIN_BASED = 'margin_based', // Marj bazlı
  DEMAND_BASED = 'demand_based', // Talep bazlı
  TIME_BASED = 'time_based', // Zaman bazlı
  INVENTORY_BASED = 'inventory_based', // Stok bazlı
  BUY_BOX_FOCUSED = 'buy_box_focused', // Buy Box odaklı
  CUSTOM = 'custom', // Özel kural
}

export enum TriggerCondition {
  COMPETITOR_PRICE_CHANGE = 'competitor_price_change',
  BUY_BOX_LOST = 'buy_box_lost',
  SALES_VELOCITY_CHANGE = 'sales_velocity_change',
  INVENTORY_LEVEL_CHANGE = 'inventory_level_change',
  TIME_INTERVAL = 'time_interval',
  MANUAL_TRIGGER = 'manual_trigger',
  MARGIN_THRESHOLD = 'margin_threshold',
  DEMAND_SPIKE = 'demand_spike',
}

export enum ActionType {
  MATCH_LOWEST = 'match_lowest', // En düşük fiyata eşitle
  UNDERCUT_BY_AMOUNT = 'undercut_by_amount', // Belirli miktarda altına in
  UNDERCUT_BY_PERCENT = 'undercut_by_percent', // Belirli yüzde altına in
  INCREASE_BY_AMOUNT = 'increase_by_amount', // Belirli miktarda artır
  INCREASE_BY_PERCENT = 'increase_by_percent', // Belirli yüzde artır
  SET_FIXED_PRICE = 'set_fixed_price', // Sabit fiyat belirle
  MAINTAIN_MARGIN = 'maintain_margin', // Marjı koru
  STOP_SELLING = 'stop_selling', // Satışı durdur
}

export enum RuleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  DISABLED = 'disabled',
  DRAFT = 'draft',
  ARCHIVED = 'archived',
}

export enum Priority {
  CRITICAL = 'critical', // 1
  HIGH = 'high', // 2
  MEDIUM = 'medium', // 3
  LOW = 'low', // 4
}

@Entity('repricing_rules')
@Index(['userId', 'ruleStatus'])
@Index(['ruleType', 'priority'])
@Index(['isActive'])
@Index(['nextExecutionTime'])
export class RepricingRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'rule_name' })
  ruleName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: RuleType,
    name: 'rule_type',
  })
  ruleType: RuleType;

  @Column({
    type: 'enum',
    enum: RuleStatus,
    name: 'rule_status',
    default: RuleStatus.DRAFT,
  })
  ruleStatus: RuleStatus;

  @Column({
    type: 'enum',
    enum: Priority,
    default: Priority.MEDIUM,
  })
  priority: Priority;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Target Configuration
  @Column({ type: 'json' })
  targetConfiguration: {
    productIds?: string[]; // Specific inventory items
    asins?: string[]; // Specific ASINs
    categories?: string[]; // Product categories
    suppliers?: string[]; // Specific suppliers
    tags?: string[]; // Product tags
    priceRange?: {
      min: number;
      max: number;
    };
    marginRange?: {
      min: number;
      max: number;
    };
    excludeProducts?: string[]; // Excluded product IDs
  };

  // Trigger Conditions
  @Column({ type: 'json' })
  triggerConditions: {
    primary: {
      condition: TriggerCondition;
      parameters: any;
    };
    secondary?: Array<{
      condition: TriggerCondition;
      parameters: any;
      operator: 'AND' | 'OR';
    }>;
    cooldownMinutes?: number; // Minimum time between executions
    maxExecutionsPerDay?: number;
  };

  // Actions to Take
  @Column({ type: 'json' })
  actions: {
    primary: {
      action: ActionType;
      parameters: any;
      failureAction?: ActionType;
    };
    secondary?: Array<{
      action: ActionType;
      parameters: any;
      condition?: any;
      delay?: number; // Delay in minutes
    }>;
    notifications?: Array<{
      type: 'email' | 'sms' | 'webhook';
      recipients: string[];
      template?: string;
      condition?: 'always' | 'on_success' | 'on_failure';
    }>;
  };

  // Constraints and Limits
  @Column({ type: 'json' })
  constraints: {
    pricing: {
      minPrice?: number;
      maxPrice?: number;
      minMargin?: number; // percentage
      maxMargin?: number; // percentage
      minProfit?: number; // absolute amount
      respectMAP?: boolean; // Minimum Advertised Price
    };
    execution: {
      maxPriceIncrease?: number; // maximum single increase
      maxPriceDecrease?: number; // maximum single decrease
      maxDailyChanges?: number;
      blackoutPeriods?: Array<{
        startTime: string; // HH:mm
        endTime: string; // HH:mm
        days: number[]; // 0-6 (Sunday-Saturday)
        timezone?: string;
      }>;
    };
    competition: {
      minCompetitors?: number; // Minimum competitors required
      maxCompetitors?: number; // Consider only top N competitors
      excludeCompetitors?: string[]; // Seller names to exclude
      trustLevel?: 'all' | 'high_rating' | 'prime_only';
    };
  };

  // Schedule Configuration
  @Column({ type: 'json', nullable: true })
  schedule?: {
    frequency: 'continuous' | 'hourly' | 'daily' | 'weekly' | 'custom';
    interval?: number; // minutes for custom frequency
    specificTimes?: string[]; // HH:mm format
    timezone?: string;
    startDate?: Date;
    endDate?: Date;
  };

  // Execution Tracking
  @Column({ name: 'last_execution_time', type: 'timestamp', nullable: true })
  lastExecutionTime?: Date;

  @Column({ name: 'next_execution_time', type: 'timestamp', nullable: true })
  nextExecutionTime?: Date;

  @Column({ name: 'total_executions', default: 0 })
  totalExecutions: number;

  @Column({ name: 'successful_executions', default: 0 })
  successfulExecutions: number;

  @Column({ name: 'failed_executions', default: 0 })
  failedExecutions: number;

  // Performance Metrics
  @Column({ type: 'json', nullable: true })
  performanceMetrics?: {
    avgExecutionTime: number; // milliseconds
    avgPriceChange: number; // percentage
    buyBoxWinRate?: number; // percentage
    salesImpact?: number; // percentage change
    marginImpact?: number; // percentage change
    errorRate: number; // percentage
  };

  // Last Error Information
  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError?: string;

  @Column({ name: 'last_error_time', type: 'timestamp', nullable: true })
  lastErrorTime?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isEligibleForExecution(): boolean {
    if (!this.isActive || this.ruleStatus !== RuleStatus.ACTIVE) {
      return false;
    }

    // Check cooldown period
    if (this.lastExecutionTime && this.triggerConditions.cooldownMinutes) {
      const cooldownMs = this.triggerConditions.cooldownMinutes * 60 * 1000;
      if (Date.now() - this.lastExecutionTime.getTime() < cooldownMs) {
        return false;
      }
    }

    // Check daily execution limit
    if (this.triggerConditions.maxExecutionsPerDay) {
      // Would need to query execution history for today
      // For now, simplified check
      return true;
    }

    // Check blackout periods
    if (this.constraints.execution.blackoutPeriods) {
      const now = new Date();
      for (const period of this.constraints.execution.blackoutPeriods) {
        if (this.isInBlackoutPeriod(now, period)) {
          return false;
        }
      }
    }

    return true;
  }

  private isInBlackoutPeriod(
    currentTime: Date,
    period: {
      startTime: string;
      endTime: string;
      days: number[];
      timezone?: string;
    }
  ): boolean {
    const currentDay = currentTime.getDay();
    if (!period.days.includes(currentDay)) {
      return false;
    }

    const currentTimeStr = currentTime.toTimeString().slice(0, 5); // HH:mm
    return currentTimeStr >= period.startTime && currentTimeStr <= period.endTime;
  }

  validatePriceChange(currentPrice: number, newPrice: number): boolean {
    const constraints = this.constraints.pricing;

    // Check absolute limits
    if (constraints.minPrice && newPrice < constraints.minPrice) return false;
    if (constraints.maxPrice && newPrice > constraints.maxPrice) return false;

    // Check change limits
    const changeAmount = Math.abs(newPrice - currentPrice);
    const changePercent = (changeAmount / currentPrice) * 100;

    if (newPrice > currentPrice && constraints.maxPriceIncrease) {
      if (changeAmount > constraints.maxPriceIncrease) return false;
    }

    if (newPrice < currentPrice && constraints.maxPriceDecrease) {
      if (changeAmount > constraints.maxPriceDecrease) return false;
    }

    return true;
  }

  calculateNewPrice(
    currentPrice: number,
    competitorData: {
      lowestPrice: number;
      averagePrice: number;
      buyBoxPrice: number;
      competitorCount: number;
    },
    productData: {
      costPrice: number;
      currentMargin: number;
      salesVelocity?: number;
      inventoryLevel?: number;
    }
  ): { newPrice: number; reasoning: string } | null {
    const action = this.actions.primary;

    let newPrice = currentPrice;
    let reasoning = '';

    switch (action.action) {
      case ActionType.MATCH_LOWEST:
        newPrice = competitorData.lowestPrice;
        reasoning = `Matched lowest competitor price: ${competitorData.lowestPrice}`;
        break;

      case ActionType.UNDERCUT_BY_AMOUNT:
        newPrice = competitorData.lowestPrice - (action.parameters.amount || 0.01);
        reasoning = `Undercut by $${action.parameters.amount || 0.01}`;
        break;

      case ActionType.UNDERCUT_BY_PERCENT:
        const undercutPercent = action.parameters.percentage || 1;
        newPrice = competitorData.lowestPrice * (1 - undercutPercent / 100);
        reasoning = `Undercut by ${undercutPercent}%`;
        break;

      case ActionType.INCREASE_BY_AMOUNT:
        newPrice = currentPrice + (action.parameters.amount || 0);
        reasoning = `Increased by $${action.parameters.amount || 0}`;
        break;

      case ActionType.INCREASE_BY_PERCENT:
        const increasePercent = action.parameters.percentage || 0;
        newPrice = currentPrice * (1 + increasePercent / 100);
        reasoning = `Increased by ${increasePercent}%`;
        break;

      case ActionType.SET_FIXED_PRICE:
        newPrice = action.parameters.price || currentPrice;
        reasoning = `Set to fixed price: $${newPrice}`;
        break;

      case ActionType.MAINTAIN_MARGIN:
        const targetMargin = action.parameters.margin || productData.currentMargin;
        newPrice = productData.costPrice / (1 - targetMargin / 100);
        reasoning = `Maintaining ${targetMargin}% margin`;
        break;

      default:
        return null;
    }

    // Round to 2 decimal places
    newPrice = Math.round(newPrice * 100) / 100;

    // Validate the new price
    if (!this.validatePriceChange(currentPrice, newPrice)) {
      return null;
    }

    return { newPrice, reasoning };
  }

  getSuccessRate(): number {
    if (this.totalExecutions === 0) return 0;
    return (this.successfulExecutions / this.totalExecutions) * 100;
  }

  getPerformanceScore(): number {
    let score = 0;

    // Success rate (40% weight)
    score += this.getSuccessRate() * 0.4;

    // Buy box win rate (30% weight)
    if (this.performanceMetrics?.buyBoxWinRate) {
      score += this.performanceMetrics.buyBoxWinRate * 0.3;
    }

    // Sales impact (20% weight)
    if (this.performanceMetrics?.salesImpact) {
      score += Math.max(0, this.performanceMetrics.salesImpact) * 0.2;
    }

    // Low error rate (10% weight)
    if (this.performanceMetrics?.errorRate !== undefined) {
      score += (100 - this.performanceMetrics.errorRate) * 0.1;
    }

    return Math.min(100, Math.max(0, score));
  }

  shouldBePaused(): boolean {
    // Auto-pause criteria
    const successRate = this.getSuccessRate();
    const errorRate = this.performanceMetrics?.errorRate || 0;

    // Pause if success rate is too low
    if (this.totalExecutions >= 10 && successRate < 20) {
      return true;
    }

    // Pause if error rate is too high
    if (this.totalExecutions >= 5 && errorRate > 80) {
      return true;
    }

    // Pause if too many consecutive failures
    if (this.failedExecutions >= 5 && this.successfulExecutions === 0) {
      return true;
    }

    return false;
  }

  generateOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const successRate = this.getSuccessRate();
    const errorRate = this.performanceMetrics?.errorRate || 0;

    if (successRate < 50) {
      suggestions.push('Consider relaxing price constraints to improve execution success');
    }

    if (errorRate > 20) {
      suggestions.push('Review trigger conditions to reduce execution errors');
    }

    if (this.performanceMetrics?.buyBoxWinRate && this.performanceMetrics.buyBoxWinRate < 30) {
      suggestions.push('Consider more aggressive undercut strategy for Buy Box');
    }

    if (this.constraints.pricing.minMargin && this.constraints.pricing.minMargin > 20) {
      suggestions.push('High minimum margin may be limiting repricing effectiveness');
    }

    if (this.triggerConditions.cooldownMinutes && this.triggerConditions.cooldownMinutes > 60) {
      suggestions.push('Long cooldown period may cause missed opportunities');
    }

    return suggestions;
  }

  // Static factory methods
  static createCompetitiveRule(data: {
    userId: string;
    name: string;
    productIds: string[];
    undercutAmount?: number;
    minMargin?: number;
  }): Partial<RepricingRule> {
    return {
      userId: data.userId,
      ruleName: data.name,
      ruleType: RuleType.COMPETITIVE,
      ruleStatus: RuleStatus.DRAFT,
      priority: Priority.HIGH,
      targetConfiguration: {
        productIds: data.productIds,
      },
      triggerConditions: {
        primary: {
          condition: TriggerCondition.COMPETITOR_PRICE_CHANGE,
          parameters: {
            priceChangeThreshold: 0.01,
          },
        },
        cooldownMinutes: 30,
        maxExecutionsPerDay: 48,
      },
      actions: {
        primary: {
          action: ActionType.UNDERCUT_BY_AMOUNT,
          parameters: {
            amount: data.undercutAmount || 0.01,
          },
        },
        notifications: [
          {
            type: 'email',
            recipients: [],
            condition: 'on_failure',
          },
        ],
      },
      constraints: {
        pricing: {
          minMargin: data.minMargin || 10,
          respectMAP: true,
        },
        execution: {
          maxPriceDecrease: 5.0,
          maxDailyChanges: 5,
        },
        competition: {
          minCompetitors: 1,
          trustLevel: 'high_rating',
        },
      },
      schedule: {
        frequency: 'hourly',
        timezone: 'UTC',
      },
    };
  }

  static createBuyBoxRule(data: {
    userId: string;
    name: string;
    productIds: string[];
    aggressiveness: 'conservative' | 'moderate' | 'aggressive';
  }): Partial<RepricingRule> {
    const undercutAmounts = {
      conservative: 0.01,
      moderate: 0.05,
      aggressive: 0.10,
    };

    return {
      userId: data.userId,
      ruleName: data.name,
      ruleType: RuleType.BUY_BOX_FOCUSED,
      ruleStatus: RuleStatus.DRAFT,
      priority: Priority.CRITICAL,
      targetConfiguration: {
        productIds: data.productIds,
      },
      triggerConditions: {
        primary: {
          condition: TriggerCondition.BUY_BOX_LOST,
          parameters: {},
        },
        cooldownMinutes: 15,
        maxExecutionsPerDay: 96,
      },
      actions: {
        primary: {
          action: ActionType.UNDERCUT_BY_AMOUNT,
          parameters: {
            amount: undercutAmounts[data.aggressiveness],
          },
        },
      },
      constraints: {
        pricing: {
          minMargin: data.aggressiveness === 'aggressive' ? 5 : 15,
        },
        execution: {
          maxPriceDecrease: data.aggressiveness === 'aggressive' ? 10.0 : 3.0,
          maxDailyChanges: 10,
        },
        competition: {
          minCompetitors: 1,
          trustLevel: 'all',
        },
      },
      schedule: {
        frequency: 'continuous',
        timezone: 'UTC',
      },
    };
  }
}