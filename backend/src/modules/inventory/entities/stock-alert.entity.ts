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

@Entity('stock_alerts')
@Index(['userId', 'isActive'])
@Index(['alertType', 'isActive'])
@Index(['priority'])
@Index(['createdAt'])
export class StockAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('uuid', { nullable: true })
  inventoryItemId?: string;

  @Column({
    type: 'enum',
    enum: [
      'low_stock',
      'out_of_stock',
      'overstock',
      'reorder_needed',
      'price_change',
      'supplier_issue',
      'quality_issue',
      'expiry_warning',
      'slow_moving',
      'fast_moving',
    ],
  })
  alertType: 
    | 'low_stock'
    | 'out_of_stock'
    | 'overstock'
    | 'reorder_needed'
    | 'price_change'
    | 'supplier_issue'
    | 'quality_issue'
    | 'expiry_warning'
    | 'slow_moving'
    | 'fast_moving';

  @Column({
    type: 'enum',
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  })
  priority: 'low' | 'medium' | 'high' | 'critical';

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column('jsonb', { nullable: true })
  details?: {
    currentStock?: number;
    threshold?: number;
    recommendedAction?: string;
    affectedProducts?: number;
    estimatedImpact?: string;
    supplierInfo?: {
      name: string;
      contact: string;
    };
    priceChange?: {
      oldPrice: number;
      newPrice: number;
      percentage: number;
    };
    expiryDate?: string;
    daysUntilExpiry?: number;
  };

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isResolved: boolean;

  @Column('text', { nullable: true })
  resolutionNotes?: string;

  @Column('timestamp', { nullable: true })
  resolvedAt?: Date;

  @Column({ nullable: true })
  resolvedBy?: string;

  @Column('timestamp', { nullable: true })
  acknowledgedAt?: Date;

  @Column({ nullable: true })
  acknowledgedBy?: string;

  @Column('timestamp', { nullable: true })
  scheduledAction?: Date;

  @Column('jsonb', { nullable: true })
  actions?: Array<{
    type: 'reorder' | 'price_update' | 'contact_supplier' | 'quality_check' | 'remove_product';
    description: string;
    url?: string;
    parameters?: { [key: string]: any };
  }>;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column('jsonb', { nullable: true })
  notificationSettings?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
    webhook?: boolean;
    frequency?: 'immediate' | 'hourly' | 'daily';
  };

  @Column({ default: false })
  isRecurring: boolean;

  @Column('timestamp', { nullable: true })
  nextCheckDate?: Date;

  @Column('int', { default: 0 })
  occurrenceCount: number;

  @Column('timestamp', { nullable: true })
  lastNotificationSent?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => InventoryItem, { nullable: true })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem?: InventoryItem;

  // Virtual Properties
  get priorityScore(): number {
    const scores = { low: 1, medium: 2, high: 3, critical: 4 };
    return scores[this.priority];
  }

  get isUrgent(): boolean {
    return this.priority === 'critical' || this.priority === 'high';
  }

  get ageInHours(): number {
    return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
  }

  get isStale(): boolean {
    // Consider alert stale if:
    // - Critical: older than 1 hour
    // - High: older than 4 hours  
    // - Medium: older than 24 hours
    // - Low: older than 72 hours
    const staleThresholds = {
      critical: 1,
      high: 4,
      medium: 24,
      low: 72,
    };
    
    return this.ageInHours > staleThresholds[this.priority];
  }

  get statusIcon(): string {
    if (this.isResolved) return '✅';
    if (this.isRead) return '👁️';
    if (this.isUrgent) return '🚨';
    return '⚠️';
  }

  get formattedType(): string {
    const typeLabels: { [key: string]: string } = {
      low_stock: 'Düşük Stok',
      out_of_stock: 'Stok Tükendi',
      overstock: 'Fazla Stok',
      reorder_needed: 'Yeniden Sipariş Gerekli',
      price_change: 'Fiyat Değişimi',
      supplier_issue: 'Tedarikçi Sorunu',
      quality_issue: 'Kalite Sorunu',
      expiry_warning: 'Son Kullanma Uyarısı',
      slow_moving: 'Yavaş Hareket Eden',
      fast_moving: 'Hızlı Hareket Eden',
    };

    return typeLabels[this.alertType] || this.alertType;
  }

  get priorityColor(): string {
    const colors = {
      low: '#10B981',     // Green
      medium: '#F59E0B',  // Yellow
      high: '#EF4444',    // Red
      critical: '#7C2D12', // Dark Red
    };
    
    return colors[this.priority];
  }

  // Methods
  acknowledge(acknowledgedBy: string): void {
    this.isRead = true;
    this.acknowledgedAt = new Date();
    this.acknowledgedBy = acknowledgedBy;
  }

  resolve(resolvedBy: string, notes?: string): void {
    this.isResolved = true;
    this.resolvedAt = new Date();
    this.resolvedBy = resolvedBy;
    this.resolutionNotes = notes;
    this.isActive = false;
  }

  reopen(reason: string): void {
    this.isResolved = false;
    this.resolvedAt = null;
    this.resolvedBy = null;
    this.resolutionNotes = reason;
    this.isActive = true;
    this.occurrenceCount += 1;
  }

  scheduleAction(actionDate: Date): void {
    this.scheduledAction = actionDate;
  }

  updateDetails(newDetails: Partial<StockAlert['details']>): void {
    this.details = { ...this.details, ...newDetails };
    this.updatedAt = new Date();
  }

  addAction(action: {
    type: 'reorder' | 'price_update' | 'contact_supplier' | 'quality_check' | 'remove_product';
    description: string;
    url?: string;
    parameters?: { [key: string]: any };
  }): void {
    if (!this.actions) {
      this.actions = [];
    }
    this.actions.push(action);
  }

  shouldSendNotification(): boolean {
    if (!this.isActive || this.isResolved) return false;
    
    const settings = this.notificationSettings;
    if (!settings) return true; // Default to sending notifications
    
    if (settings.frequency === 'immediate') return true;
    
    if (!this.lastNotificationSent) return true;
    
    const hoursSinceLastNotification = Math.floor(
      (Date.now() - this.lastNotificationSent.getTime()) / (1000 * 60 * 60)
    );
    
    switch (settings.frequency) {
      case 'hourly':
        return hoursSinceLastNotification >= 1;
      case 'daily':
        return hoursSinceLastNotification >= 24;
      default:
        return false;
    }
  }

  markNotificationSent(): void {
    this.lastNotificationSent = new Date();
  }

  escalate(): void {
    const escalationMap = {
      low: 'medium' as const,
      medium: 'high' as const,
      high: 'critical' as const,
      critical: 'critical' as const,
    };
    
    this.priority = escalationMap[this.priority];
    this.occurrenceCount += 1;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Alert başlığı gerekli');
    }

    if (!this.message || this.message.trim().length === 0) {
      errors.push('Alert mesajı gerekli');
    }

    if (this.scheduledAction && this.scheduledAction < new Date()) {
      errors.push('Planlanan eylem tarihi gelecekte olmalı');
    }

    if (this.isResolved && !this.resolvedBy) {
      errors.push('Çözümleyenin kimliği gerekli');
    }

    return errors;
  }

  static createLowStockAlert(data: {
    userId: string;
    inventoryItemId: string;
    currentStock: number;
    threshold: number;
    productName: string;
  }): Partial<StockAlert> {
    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      alertType: 'low_stock',
      priority: data.currentStock === 0 ? 'critical' : 'high',
      title: `Düşük Stok: ${data.productName}`,
      message: `${data.productName} ürününde stok seviyesi kritik eşiğin altına düştü`,
      details: {
        currentStock: data.currentStock,
        threshold: data.threshold,
        recommendedAction: 'Yeniden sipariş verin',
      },
      actions: [
        {
          type: 'reorder',
          description: 'Yeniden sipariş oluştur',
          parameters: { inventoryItemId: data.inventoryItemId },
        },
      ],
      tags: ['stok', 'kritik'],
      isActive: true,
    };
  }

  static createPriceChangeAlert(data: {
    userId: string;
    inventoryItemId: string;
    productName: string;
    oldPrice: number;
    newPrice: number;
    changePercentage: number;
  }): Partial<StockAlert> {
    const isIncrease = data.newPrice > data.oldPrice;
    const priority = Math.abs(data.changePercentage) > 20 ? 'high' : 'medium';

    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      alertType: 'price_change',
      priority,
      title: `Fiyat Değişimi: ${data.productName}`,
      message: `${data.productName} ürününde %${Math.abs(data.changePercentage).toFixed(1)} ${isIncrease ? 'artış' : 'düşüş'}`,
      details: {
        priceChange: {
          oldPrice: data.oldPrice,
          newPrice: data.newPrice,
          percentage: data.changePercentage,
        },
        recommendedAction: isIncrease ? 'Satış fiyatını güncellemeyi düşünün' : 'Stok artırma fırsatı',
      },
      actions: [
        {
          type: 'price_update',
          description: 'Satış fiyatını güncelle',
          parameters: { inventoryItemId: data.inventoryItemId, suggestedPrice: data.newPrice * 1.3 },
        },
      ],
      tags: ['fiyat', isIncrease ? 'artış' : 'düşüş'],
      isActive: true,
    };
  }

  static createExpiryAlert(data: {
    userId: string;
    inventoryItemId: string;
    productName: string;
    expiryDate: Date;
    daysUntilExpiry: number;
  }): Partial<StockAlert> {
    const priority = data.daysUntilExpiry <= 7 ? 'critical' : data.daysUntilExpiry <= 30 ? 'high' : 'medium';

    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      alertType: 'expiry_warning',
      priority,
      title: `Son Kullanma Uyarısı: ${data.productName}`,
      message: `${data.productName} ürününün son kullanma tarihi ${data.daysUntilExpiry} gün sonra`,
      details: {
        expiryDate: data.expiryDate.toISOString(),
        daysUntilExpiry: data.daysUntilExpiry,
        recommendedAction: data.daysUntilExpiry <= 7 ? 'Acil satış yapın' : 'İndirimli satış planlayın',
      },
      actions: [
        {
          type: 'price_update',
          description: 'İndirimli fiyat uygula',
          parameters: { inventoryItemId: data.inventoryItemId, discountPercent: 20 },
        },
      ],
      tags: ['son kullanma', 'acil'],
      isActive: true,
      scheduledAction: new Date(Date.now() + (data.daysUntilExpiry - 3) * 24 * 60 * 60 * 1000), // 3 days before expiry
    };
  }

  getAlertSummary(): {
    type: string;
    priority: string;
    status: string;
    age: string;
    actions: number;
  } {
    return {
      type: this.formattedType,
      priority: this.priority.toUpperCase(),
      status: this.isResolved ? 'Çözümlendi' : this.isRead ? 'Okundu' : 'Yeni',
      age: this.ageInHours < 24 
        ? `${this.ageInHours} saat önce`
        : `${Math.floor(this.ageInHours / 24)} gün önce`,
      actions: this.actions?.length || 0,
    };
  }
}