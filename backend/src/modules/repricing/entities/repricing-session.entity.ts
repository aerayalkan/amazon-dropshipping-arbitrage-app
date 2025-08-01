import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';

import { RepricingRule } from './repricing-rule.entity';

export enum SessionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIAL_SUCCESS = 'partial_success',
}

export enum TriggerSource {
  SCHEDULED = 'scheduled',
  MANUAL = 'manual',
  WEBHOOK = 'webhook',
  PRICE_CHANGE = 'price_change',
  BUY_BOX_LOST = 'buy_box_lost',
  INVENTORY_CHANGE = 'inventory_change',
  COMPETITOR_CHANGE = 'competitor_change',
  SYSTEM_AUTO = 'system_auto',
}

export enum ExecutionResult {
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  CONSTRAINT_VIOLATION = 'constraint_violation',
  INSUFFICIENT_DATA = 'insufficient_data',
  RATE_LIMITED = 'rate_limited',
  MARKET_CLOSED = 'market_closed',
}

@Entity('repricing_sessions')
@Index(['userId', 'sessionStatus'])
@Index(['ruleId', 'startedAt'])
@Index(['triggerSource'])
@Index(['sessionStatus', 'startedAt'])
export class RepricingSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'rule_id' })
  ruleId: string;

  @ManyToOne(() => RepricingRule)
  @JoinColumn({ name: 'rule_id' })
  rule: RepricingRule;

  @Column({ name: 'session_name', nullable: true })
  sessionName?: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    name: 'session_status',
    default: SessionStatus.PENDING,
  })
  sessionStatus: SessionStatus;

  @Column({
    type: 'enum',
    enum: TriggerSource,
    name: 'trigger_source',
  })
  triggerSource: TriggerSource;

  @Column({ name: 'trigger_details', type: 'json', nullable: true })
  triggerDetails?: {
    triggeredBy?: string; // User ID or system component
    originalEvent?: any; // Event that triggered the session
    parameters?: any; // Additional trigger parameters
    metadata?: any;
  };

  // Timing Information
  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs?: number;

  @Column({ name: 'scheduled_for', type: 'timestamp', nullable: true })
  scheduledFor?: Date;

  // Execution Summary
  @Column({ name: 'total_products', default: 0 })
  totalProducts: number;

  @Column({ name: 'successful_updates', default: 0 })
  successfulUpdates: number;

  @Column({ name: 'failed_updates', default: 0 })
  failedUpdates: number;

  @Column({ name: 'skipped_updates', default: 0 })
  skippedUpdates: number;

  @Column({ name: 'products_processed', default: 0 })
  productsProcessed: number;

  // Price Changes Summary
  @Column({ type: 'json', nullable: true })
  priceChangesSummary?: {
    totalChanges: number;
    averageChange: number; // percentage
    largestIncrease: number; // percentage
    largestDecrease: number; // percentage
    priceIncreases: number;
    priceDecreases: number;
    noChanges: number;
  };

  // Market Impact Analysis
  @Column({ type: 'json', nullable: true })
  marketImpact?: {
    buyBoxChanges: {
      gained: number;
      lost: number;
      maintained: number;
    };
    competitivePosition: {
      improved: number;
      declined: number;
      unchanged: number;
    };
    estimatedSalesImpact?: number; // percentage
    estimatedRevenueImpact?: number; // dollar amount
  };

  // Execution Details
  @Column({ type: 'json' })
  executionResults: Array<{
    productId: string;
    asin?: string;
    productName: string;
    result: ExecutionResult;
    oldPrice: number;
    newPrice?: number;
    priceChange?: number; // absolute change
    priceChangePercent?: number;
    reasoning?: string;
    error?: string;
    executionTime?: number; // milliseconds
    competitorData?: {
      lowestPrice: number;
      buyBoxPrice: number;
      competitorCount: number;
    };
    constraints?: {
      minPrice?: number;
      maxPrice?: number;
      minMargin?: number;
      violated?: string[];
    };
    metadata?: any;
  }>;

  // Performance Metrics
  @Column({ type: 'json', nullable: true })
  performanceMetrics?: {
    avgProcessingTime: number; // milliseconds per product
    successRate: number; // percentage
    errorRate: number; // percentage
    skipRate: number; // percentage
    apiCallsUsed: number;
    dataFreshness: number; // minutes since last competitor update
    systemLoad?: {
      cpuUsage: number;
      memoryUsage: number;
      networkLatency: number;
    };
  };

  // Error Tracking
  @Column({ name: 'error_summary', type: 'json', nullable: true })
  errorSummary?: {
    totalErrors: number;
    errorTypes: { [key: string]: number };
    criticalErrors: number;
    warnings: number;
    commonErrors: Array<{
      error: string;
      count: number;
      affectedProducts: string[];
    }>;
  };

  @Column({ name: 'critical_error', type: 'text', nullable: true })
  criticalError?: string;

  // Configuration Snapshot
  @Column({ name: 'rule_snapshot', type: 'json' })
  ruleSnapshot: {
    ruleName: string;
    ruleType: string;
    triggerConditions: any;
    actions: any;
    constraints: any;
    version?: string;
  };

  @Column({ name: 'market_conditions', type: 'json', nullable: true })
  marketConditions?: {
    timestamp: Date;
    conditions: {
      averageCompetitorCount: number;
      marketVolatility: number; // 0-100
      priceSpread: number; // max - min price
      buyBoxCompetition: number; // number of buy box eligible sellers
    };
    trends?: {
      priceDirection: 'up' | 'down' | 'stable';
      demandLevel: 'high' | 'medium' | 'low';
      competition: 'increasing' | 'decreasing' | 'stable';
    };
  };

  // Notifications and Alerts
  @Column({ type: 'json', nullable: true })
  notifications?: Array<{
    type: 'email' | 'sms' | 'webhook' | 'slack';
    recipient: string;
    subject: string;
    content: string;
    sentAt: Date;
    status: 'sent' | 'failed' | 'pending';
    error?: string;
  }>;

  @Column({ name: 'alerts_generated', type: 'json', nullable: true })
  alertsGenerated?: Array<{
    alertType: 'price_limit_hit' | 'margin_too_low' | 'buy_box_lost' | 'high_error_rate' | 'competitor_aggressive';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    affectedProducts: string[];
    timestamp: Date;
    acknowledged?: boolean;
  }>;

  // Session Configuration
  @Column({ name: 'execution_mode', nullable: true })
  executionMode?: 'live' | 'dry_run' | 'test';

  @Column({ name: 'concurrency_level', default: 1 })
  concurrencyLevel: number;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'max_retries', default: 3 })
  maxRetries: number;

  // Quality Assurance
  @Column({ type: 'json', nullable: true })
  qualityChecks?: {
    preExecution: {
      dataFreshness: boolean;
      ruleValidation: boolean;
      constraintCheck: boolean;
      marketConditions: boolean;
    };
    postExecution: {
      priceValidation: boolean;
      marginCheck: boolean;
      competitorAnalysis: boolean;
      impactAssessment: boolean;
    };
    issues?: string[];
  };

  // Audit Trail
  @Column({ type: 'json', nullable: true })
  auditTrail?: Array<{
    timestamp: Date;
    action: string;
    details: any;
    userId?: string;
    systemComponent?: string;
  }>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isCompleted(): boolean {
    return this.sessionStatus === SessionStatus.COMPLETED || 
           this.sessionStatus === SessionStatus.FAILED ||
           this.sessionStatus === SessionStatus.CANCELLED ||
           this.sessionStatus === SessionStatus.PARTIAL_SUCCESS;
  }

  isSuccessful(): boolean {
    return this.sessionStatus === SessionStatus.COMPLETED && 
           this.failedUpdates === 0;
  }

  getSuccessRate(): number {
    if (this.totalProducts === 0) return 0;
    return (this.successfulUpdates / this.totalProducts) * 100;
  }

  getAverageProcessingTime(): number {
    if (!this.durationMs || this.productsProcessed === 0) return 0;
    return this.durationMs / this.productsProcessed;
  }

  calculateEffectiveness(): {
    score: number;
    factors: {
      successRate: number;
      speedScore: number;
      impactScore: number;
      errorScore: number;
    };
  } {
    const successRate = this.getSuccessRate();
    
    // Speed score (faster is better, normalized to 0-100)
    const avgTime = this.getAverageProcessingTime();
    const speedScore = Math.max(0, 100 - (avgTime / 1000) * 10); // Penalty for each second
    
    // Impact score based on actual price changes
    const impactScore = this.priceChangesSummary 
      ? Math.min(100, (this.priceChangesSummary.totalChanges / this.totalProducts) * 100)
      : 0;
    
    // Error score (fewer errors is better)
    const errorRate = (this.failedUpdates / Math.max(1, this.totalProducts)) * 100;
    const errorScore = Math.max(0, 100 - errorRate * 2);
    
    const overallScore = (successRate * 0.4) + (speedScore * 0.2) + (impactScore * 0.2) + (errorScore * 0.2);
    
    return {
      score: Math.round(overallScore),
      factors: {
        successRate: Math.round(successRate),
        speedScore: Math.round(speedScore),
        impactScore: Math.round(impactScore),
        errorScore: Math.round(errorScore),
      },
    };
  }

  addExecutionResult(result: {
    productId: string;
    asin?: string;
    productName: string;
    result: ExecutionResult;
    oldPrice: number;
    newPrice?: number;
    reasoning?: string;
    error?: string;
    executionTime?: number;
    competitorData?: any;
    constraints?: any;
  }): void {
    this.executionResults.push(result);
    this.productsProcessed++;

    // Update counters
    switch (result.result) {
      case ExecutionResult.SUCCESS:
        this.successfulUpdates++;
        break;
      case ExecutionResult.FAILED:
      case ExecutionResult.RATE_LIMITED:
        this.failedUpdates++;
        break;
      case ExecutionResult.SKIPPED:
      case ExecutionResult.CONSTRAINT_VIOLATION:
      case ExecutionResult.INSUFFICIENT_DATA:
      case ExecutionResult.MARKET_CLOSED:
        this.skippedUpdates++;
        break;
    }

    // Update price changes summary
    if (result.newPrice && result.newPrice !== result.oldPrice) {
      if (!this.priceChangesSummary) {
        this.priceChangesSummary = {
          totalChanges: 0,
          averageChange: 0,
          largestIncrease: 0,
          largestDecrease: 0,
          priceIncreases: 0,
          priceDecreases: 0,
          noChanges: 0,
        };
      }

      const changePercent = ((result.newPrice - result.oldPrice) / result.oldPrice) * 100;
      
      this.priceChangesSummary.totalChanges++;
      
      if (changePercent > 0) {
        this.priceChangesSummary.priceIncreases++;
        this.priceChangesSummary.largestIncrease = Math.max(
          this.priceChangesSummary.largestIncrease, 
          changePercent
        );
      } else {
        this.priceChangesSummary.priceDecreases++;
        this.priceChangesSummary.largestDecrease = Math.min(
          this.priceChangesSummary.largestDecrease, 
          changePercent
        );
      }
    }
  }

  complete(status: SessionStatus = SessionStatus.COMPLETED): void {
    this.sessionStatus = status;
    this.completedAt = new Date();
    this.durationMs = this.completedAt.getTime() - this.startedAt.getTime();

    // Calculate final metrics
    if (this.priceChangesSummary && this.priceChangesSummary.totalChanges > 0) {
      // Update average change (would need to calculate from individual results)
      const totalChange = this.executionResults
        .filter(r => r.newPrice && r.oldPrice)
        .reduce((sum, r) => {
          const change = ((r.newPrice! - r.oldPrice) / r.oldPrice) * 100;
          return sum + change;
        }, 0);
      
      this.priceChangesSummary.averageChange = totalChange / this.priceChangesSummary.totalChanges;
    }

    // Update performance metrics
    if (!this.performanceMetrics) {
      this.performanceMetrics = {
        avgProcessingTime: 0,
        successRate: 0,
        errorRate: 0,
        skipRate: 0,
        apiCallsUsed: 0,
        dataFreshness: 0,
      };
    }

    this.performanceMetrics.avgProcessingTime = this.getAverageProcessingTime();
    this.performanceMetrics.successRate = this.getSuccessRate();
    this.performanceMetrics.errorRate = (this.failedUpdates / Math.max(1, this.totalProducts)) * 100;
    this.performanceMetrics.skipRate = (this.skippedUpdates / Math.max(1, this.totalProducts)) * 100;
  }

  addAlert(alert: {
    alertType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    affectedProducts?: string[];
  }): void {
    if (!this.alertsGenerated) {
      this.alertsGenerated = [];
    }

    this.alertsGenerated.push({
      ...alert,
      timestamp: new Date(),
      affectedProducts: alert.affectedProducts || [],
      acknowledged: false,
    });
  }

  generateSummaryReport(): {
    sessionInfo: any;
    performance: any;
    priceChanges: any;
    issues: any;
    recommendations: string[];
  } {
    const effectiveness = this.calculateEffectiveness();
    
    return {
      sessionInfo: {
        id: this.id,
        ruleName: this.ruleSnapshot.ruleName,
        status: this.sessionStatus,
        triggerSource: this.triggerSource,
        duration: this.durationMs,
        startedAt: this.startedAt,
        completedAt: this.completedAt,
      },
      performance: {
        totalProducts: this.totalProducts,
        successfulUpdates: this.successfulUpdates,
        failedUpdates: this.failedUpdates,
        skippedUpdates: this.skippedUpdates,
        successRate: this.getSuccessRate(),
        effectiveness: effectiveness,
      },
      priceChanges: this.priceChangesSummary || {},
      issues: {
        criticalErrors: this.errorSummary?.criticalErrors || 0,
        totalErrors: this.errorSummary?.totalErrors || 0,
        alerts: this.alertsGenerated?.length || 0,
      },
      recommendations: this.generateRecommendations(),
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const successRate = this.getSuccessRate();
    const errorRate = this.performanceMetrics?.errorRate || 0;

    if (successRate < 50) {
      recommendations.push('Review rule constraints - low success rate indicates overly restrictive settings');
    }

    if (errorRate > 20) {
      recommendations.push('Check data sources and API connectivity - high error rate detected');
    }

    if (this.priceChangesSummary && this.priceChangesSummary.totalChanges === 0) {
      recommendations.push('No price changes made - consider adjusting trigger conditions');
    }

    if (this.alertsGenerated && this.alertsGenerated.length > 5) {
      recommendations.push('Multiple alerts generated - review rule configuration');
    }

    if (this.getAverageProcessingTime() > 5000) {
      recommendations.push('Slow processing detected - optimize data fetching or reduce batch size');
    }

    return recommendations;
  }

  // Static factory methods
  static createSession(data: {
    userId: string;
    ruleId: string;
    rule: RepricingRule;
    triggerSource: TriggerSource;
    triggerDetails?: any;
    productCount?: number;
  }): Partial<RepricingSession> {
    return {
      userId: data.userId,
      ruleId: data.ruleId,
      triggerSource: data.triggerSource,
      triggerDetails: data.triggerDetails,
      sessionStatus: SessionStatus.PENDING,
      startedAt: new Date(),
      totalProducts: data.productCount || 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      skippedUpdates: 0,
      productsProcessed: 0,
      executionResults: [],
      ruleSnapshot: {
        ruleName: data.rule.ruleName,
        ruleType: data.rule.ruleType,
        triggerConditions: data.rule.triggerConditions,
        actions: data.rule.actions,
        constraints: data.rule.constraints,
      },
      executionMode: 'live',
      concurrencyLevel: 1,
      retryCount: 0,
      maxRetries: 3,
    };
  }
}