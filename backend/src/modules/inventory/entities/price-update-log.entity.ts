import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { InventoryItem } from './inventory-item.entity';
import { AutomationRule } from './automation-rule.entity';

@Entity('price_update_logs')
@Index(['userId', 'createdAt'])
@Index(['inventoryItemId', 'createdAt'])
@Index(['updateSource'])
@Index(['createdAt'])
export class PriceUpdateLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('uuid')
  inventoryItemId: string;

  @Column('uuid', { nullable: true })
  automationRuleId?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  oldPrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  newPrice: number;

  @Column('decimal', { precision: 5, scale: 2 })
  changeAmount: number;

  @Column('decimal', { precision: 5, scale: 2 })
  changePercentage: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['manual', 'automation', 'api', 'bulk_update', 'supplier_sync', 'competitor_match'],
  })
  updateSource: 'manual' | 'automation' | 'api' | 'bulk_update' | 'supplier_sync' | 'competitor_match';

  @Column('text')
  reason: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column({ nullable: true })
  performedBy?: string;

  @Column('jsonb', { nullable: true })
  sourceData?: {
    supplierPrice?: number;
    competitorPrices?: Array<{
      source: string;
      price: number;
    }>;
    marketAnalysis?: {
      averagePrice: number;
      priceRange: { min: number; max: number };
      position: 'below' | 'at' | 'above';
    };
    automation?: {
      ruleId: string;
      ruleName: string;
      triggeredBy: string;
    };
    bulkUpdate?: {
      batchId: string;
      totalUpdated: number;
      formula: string;
    };
  };

  @Column('jsonb', { nullable: true })
  impactAnalysis?: {
    profitMarginChange: number;
    estimatedSalesImpact: number;
    competitivePosition: string;
    riskLevel: 'low' | 'medium' | 'high';
    recommendation: string;
  };

  @Column({ default: false })
  isReverted: boolean;

  @Column('uuid', { nullable: true })
  revertedByLogId?: string;

  @Column('timestamp', { nullable: true })
  revertedAt?: Date;

  @Column({ nullable: true })
  revertReason?: string;

  @Column({ default: true })
  wasSuccessful: boolean;

  @Column('text', { nullable: true })
  errorMessage?: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => InventoryItem)
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @ManyToOne(() => AutomationRule, { nullable: true })
  @JoinColumn({ name: 'automationRuleId' })
  automationRule?: AutomationRule;

  @ManyToOne(() => PriceUpdateLog, { nullable: true })
  @JoinColumn({ name: 'revertedByLogId' })
  revertedByLog?: PriceUpdateLog;

  // Virtual Properties
  get isIncrease(): boolean {
    return this.changeAmount > 0;
  }

  get isDecrease(): boolean {
    return this.changeAmount < 0;
  }

  get isSignificantChange(): boolean {
    return Math.abs(this.changePercentage) >= 5; // 5% or more
  }

  get isMajorChange(): boolean {
    return Math.abs(this.changePercentage) >= 20; // 20% or more
  }

  get changeDirection(): 'increase' | 'decrease' | 'no_change' {
    if (this.changeAmount > 0) return 'increase';
    if (this.changeAmount < 0) return 'decrease';
    return 'no_change';
  }

  get formattedChange(): string {
    const sign = this.changeAmount >= 0 ? '+' : '';
    const percentage = this.changePercentage.toFixed(1);
    const amount = new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: this.currency,
    }).format(Math.abs(this.changeAmount));

    return `${sign}${amount} (${sign}${percentage}%)`;
  }

  get riskAssessment(): {
    level: 'low' | 'medium' | 'high';
    factors: string[];
    recommendation: string;
  } {
    const factors: string[] = [];
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    // Check change magnitude
    if (this.isMajorChange) {
      factors.push('Büyük fiyat değişimi (>20%)');
      riskLevel = 'high';
    } else if (this.isSignificantChange) {
      factors.push('Önemli fiyat değişimi (>5%)');
      riskLevel = 'medium';
    }

    // Check source reliability
    if (this.updateSource === 'automation') {
      factors.push('Otomatik güncelleme');
    } else if (this.updateSource === 'api') {
      factors.push('API güncelleme');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
    }

    // Check price increase on low margin
    if (this.isIncrease && this.impactAnalysis?.profitMarginChange) {
      if (this.impactAnalysis.profitMarginChange < 10) {
        factors.push('Düşük kar marjında artış');
        riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      }
    }

    // Generate recommendation
    let recommendation = 'Değişiklik düşük riskli görünüyor';
    if (riskLevel === 'high') {
      recommendation = 'Acil gözden geçirilmeli - yüksek risk';
    } else if (riskLevel === 'medium') {
      recommendation = 'Dikkatli takip edilmeli';
    }

    return { level: riskLevel, factors, recommendation };
  }

  // Methods
  calculateImpact(currentStock: number, avgMonthlySales: number, costPrice: number): void {
    const profitMarginOld = costPrice > 0 ? ((this.oldPrice - costPrice) / this.oldPrice) * 100 : 0;
    const profitMarginNew = costPrice > 0 ? ((this.newPrice - costPrice) / this.newPrice) * 100 : 0;
    const profitMarginChange = profitMarginNew - profitMarginOld;

    // Estimate sales impact based on price elasticity
    const priceElasticity = -1.5; // Assume elastic demand
    const estimatedSalesImpact = (this.changePercentage / 100) * priceElasticity * avgMonthlySales;

    // Determine competitive position
    let competitivePosition = 'unknown';
    if (this.sourceData?.marketAnalysis) {
      const { position } = this.sourceData.marketAnalysis;
      competitivePosition = position;
    }

    // Assess risk level
    const risk = this.riskAssessment;

    this.impactAnalysis = {
      profitMarginChange,
      estimatedSalesImpact,
      competitivePosition,
      riskLevel: risk.level,
      recommendation: risk.recommendation,
    };
  }

  revert(revertReason: string, performedBy?: string): Partial<PriceUpdateLog> {
    if (this.isReverted) {
      throw new Error('Bu fiyat güncellemesi zaten geri alınmış');
    }

    const revertLog: Partial<PriceUpdateLog> = {
      userId: this.userId,
      inventoryItemId: this.inventoryItemId,
      oldPrice: this.newPrice, // Current price becomes old price
      newPrice: this.oldPrice, // Original price becomes new price
      changeAmount: -this.changeAmount, // Opposite change
      changePercentage: -this.changePercentage,
      currency: this.currency,
      updateSource: 'manual',
      reason: `REVERT: ${revertReason}`,
      notes: `Bu güncelleme ${this.id} ID'li güncelleməni geri alıyor`,
      performedBy,
      sourceData: {
        automation: {
          ruleId: this.id,
          ruleName: 'Price Revert',
          triggeredBy: 'manual_revert',
        },
      },
      wasSuccessful: true,
    };

    // Mark this log as reverted
    this.isReverted = true;
    this.revertedAt = new Date();
    this.revertReason = revertReason;

    return revertLog;
  }

  markAsReverted(revertLogId: string, reason: string): void {
    this.isReverted = true;
    this.revertedByLogId = revertLogId;
    this.revertedAt = new Date();
    this.revertReason = reason;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (this.oldPrice < 0) {
      errors.push('Eski fiyat negatif olamaz');
    }

    if (this.newPrice < 0) {
      errors.push('Yeni fiyat negatif olamaz');
    }

    if (!this.reason || this.reason.trim().length === 0) {
      errors.push('Güncelleme sebebi gerekli');
    }

    // Validate change calculations
    const expectedChange = this.newPrice - this.oldPrice;
    if (Math.abs(expectedChange - this.changeAmount) > 0.01) {
      errors.push('Değişim miktarı hesaplama hatası');
    }

    if (this.oldPrice > 0) {
      const expectedPercentage = (expectedChange / this.oldPrice) * 100;
      if (Math.abs(expectedPercentage - this.changePercentage) > 0.01) {
        errors.push('Değişim yüzdesi hesaplama hatası');
      }
    }

    return errors;
  }

  static createManualUpdateLog(data: {
    userId: string;
    inventoryItemId: string;
    oldPrice: number;
    newPrice: number;
    reason: string;
    performedBy: string;
    notes?: string;
  }): Partial<PriceUpdateLog> {
    const changeAmount = data.newPrice - data.oldPrice;
    const changePercentage = data.oldPrice > 0 ? (changeAmount / data.oldPrice) * 100 : 0;

    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      oldPrice: data.oldPrice,
      newPrice: data.newPrice,
      changeAmount,
      changePercentage,
      updateSource: 'manual',
      reason: data.reason,
      notes: data.notes,
      performedBy: data.performedBy,
      wasSuccessful: true,
    };
  }

  static createAutomationUpdateLog(data: {
    userId: string;
    inventoryItemId: string;
    automationRuleId: string;
    oldPrice: number;
    newPrice: number;
    ruleName: string;
    triggeredBy: string;
  }): Partial<PriceUpdateLog> {
    const changeAmount = data.newPrice - data.oldPrice;
    const changePercentage = data.oldPrice > 0 ? (changeAmount / data.oldPrice) * 100 : 0;

    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      automationRuleId: data.automationRuleId,
      oldPrice: data.oldPrice,
      newPrice: data.newPrice,
      changeAmount,
      changePercentage,
      updateSource: 'automation',
      reason: `Otomatik kural tarafından güncellendi: ${data.ruleName}`,
      sourceData: {
        automation: {
          ruleId: data.automationRuleId,
          ruleName: data.ruleName,
          triggeredBy: data.triggeredBy,
        },
      },
      wasSuccessful: true,
    };
  }

  static createSupplierSyncLog(data: {
    userId: string;
    inventoryItemId: string;
    oldPrice: number;
    newPrice: number;
    supplierPrice: number;
    supplierId: string;
  }): Partial<PriceUpdateLog> {
    const changeAmount = data.newPrice - data.oldPrice;
    const changePercentage = data.oldPrice > 0 ? (changeAmount / data.oldPrice) * 100 : 0;

    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      oldPrice: data.oldPrice,
      newPrice: data.newPrice,
      changeAmount,
      changePercentage,
      updateSource: 'supplier_sync',
      reason: 'Tedarikçi fiyat değişikliğine göre güncellendi',
      sourceData: {
        supplierPrice: data.supplierPrice,
      },
      wasSuccessful: true,
    };
  }

  getUpdateSummary(): {
    direction: string;
    magnitude: string;
    source: string;
    impact: string;
    risk: string;
  } {
    return {
      direction: this.isIncrease ? 'Artış' : this.isDecrease ? 'Düşüş' : 'Değişiklik Yok',
      magnitude: this.isMajorChange ? 'Büyük' : this.isSignificantChange ? 'Orta' : 'Küçük',
      source: this.updateSource.replace('_', ' ').toUpperCase(),
      impact: this.impactAnalysis?.estimatedSalesImpact 
        ? `${this.impactAnalysis.estimatedSalesImpact > 0 ? '+' : ''}${this.impactAnalysis.estimatedSalesImpact.toFixed(0)} satış`
        : 'Bilinmiyor',
      risk: this.riskAssessment.level.toUpperCase(),
    };
  }
}