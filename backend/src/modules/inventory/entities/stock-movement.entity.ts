import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('stock_movements')
@Index(['inventoryItemId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['movementType'])
@Index(['createdAt'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('uuid')
  inventoryItemId: string;

  @Column({
    type: 'enum',
    enum: [
      'purchase',
      'sale',
      'adjustment',
      'return',
      'damaged',
      'lost',
      'transfer_in',
      'transfer_out',
      'reservation',
      'release_reservation',
      'manual_correction',
      'system_correction',
      'initial_stock',
    ],
  })
  movementType: 
    | 'purchase'
    | 'sale'
    | 'adjustment'
    | 'return'
    | 'damaged'
    | 'lost'
    | 'transfer_in'
    | 'transfer_out'
    | 'reservation'
    | 'release_reservation'
    | 'manual_correction'
    | 'system_correction'
    | 'initial_stock';

  @Column('int')
  quantity: number;

  @Column('int')
  previousStock: number;

  @Column('int')
  newStock: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  unitCost?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalValue?: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column('text')
  reason: string;

  @Column('text', { nullable: true })
  notes?: string;

  @Column({ nullable: true })
  referenceId?: string;

  @Column({
    type: 'enum',
    enum: ['order', 'return', 'adjustment', 'transfer', 'correction', 'other'],
    nullable: true,
  })
  referenceType?: 'order' | 'return' | 'adjustment' | 'transfer' | 'correction' | 'other';

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true })
  performedBy?: string;

  @Column({
    type: 'enum',
    enum: ['manual', 'automatic', 'system'],
    default: 'manual',
  })
  source: 'manual' | 'automatic' | 'system';

  @Column('jsonb', { nullable: true })
  metadata?: {
    orderId?: string;
    customerId?: string;
    supplierId?: string;
    batchNumber?: string;
    serialNumbers?: string[];
    expiryDate?: string;
    qualityGrade?: string;
    condition?: string;
    tags?: string[];
  };

  @Column({ default: false })
  isReversible: boolean;

  @Column({ default: false })
  isReversed: boolean;

  @Column('uuid', { nullable: true })
  reversalMovementId?: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => InventoryItem, item => item.stockMovements)
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem: InventoryItem;

  @ManyToOne(() => StockMovement, { nullable: true })
  @JoinColumn({ name: 'reversalMovementId' })
  reversalMovement?: StockMovement;

  // Virtual Properties
  get isInbound(): boolean {
    return [
      'purchase',
      'return',
      'transfer_in',
      'release_reservation',
      'manual_correction',
      'system_correction',
      'initial_stock',
    ].includes(this.movementType) && this.quantity > 0;
  }

  get isOutbound(): boolean {
    return [
      'sale',
      'damaged',
      'lost',
      'transfer_out',
      'reservation',
    ].includes(this.movementType) || this.quantity < 0;
  }

  get isAdjustment(): boolean {
    return [
      'adjustment',
      'manual_correction',
      'system_correction',
    ].includes(this.movementType);
  }

  get absoluteQuantity(): number {
    return Math.abs(this.quantity);
  }

  get valueImpact(): number {
    return this.totalValue || (this.absoluteQuantity * (this.unitCost || 0));
  }

  get movementDirection(): 'in' | 'out' | 'neutral' {
    if (this.quantity > 0) return 'in';
    if (this.quantity < 0) return 'out';
    return 'neutral';
  }

  get formattedMovementType(): string {
    const typeLabels: { [key: string]: string } = {
      purchase: 'Satın Alma',
      sale: 'Satış',
      adjustment: 'Düzeltme',
      return: 'İade',
      damaged: 'Hasarlı',
      lost: 'Kayıp',
      transfer_in: 'Transfer Giren',
      transfer_out: 'Transfer Çıkan',
      reservation: 'Rezervasyon',
      release_reservation: 'Rezervasyon İptal',
      manual_correction: 'Manuel Düzeltme',
      system_correction: 'Sistem Düzeltmesi',
      initial_stock: 'Başlangıç Stoku',
    };

    return typeLabels[this.movementType] || this.movementType;
  }

  get impactDescription(): string {
    const direction = this.movementDirection;
    const abs = this.absoluteQuantity;
    
    if (direction === 'in') {
      return `+${abs} adet stok eklendi`;
    } else if (direction === 'out') {
      return `-${abs} adet stok çıkarıldı`;
    } else {
      return 'Stok değişimi yok';
    }
  }

  // Methods
  reverse(reason: string, performedBy?: string): Partial<StockMovement> {
    if (!this.isReversible) {
      throw new Error('Bu stok hareketi geri alınamaz');
    }

    if (this.isReversed) {
      throw new Error('Bu stok hareketi zaten geri alınmış');
    }

    const reversalMovement: Partial<StockMovement> = {
      userId: this.userId,
      inventoryItemId: this.inventoryItemId,
      movementType: this.getReversalMovementType(),
      quantity: -this.quantity, // Ters işaret
      previousStock: this.newStock,
      newStock: this.previousStock,
      unitCost: this.unitCost,
      totalValue: this.totalValue ? -this.totalValue : undefined,
      currency: this.currency,
      reason: `REVERSAL: ${reason}`,
      notes: `Bu hareket ${this.id} ID'li hareketin geri alınmasıdır. Orijinal sebep: ${this.reason}`,
      referenceId: this.id,
      referenceType: 'correction',
      location: this.location,
      performedBy: performedBy || this.performedBy,
      source: 'manual',
      isReversible: false,
      metadata: {
        ...this.metadata,
        originalMovementId: this.id,
        reversalReason: reason,
      },
    };

    return reversalMovement;
  }

  private getReversalMovementType(): StockMovement['movementType'] {
    const reversalMap: { [key: string]: StockMovement['movementType'] } = {
      purchase: 'return',
      sale: 'return',
      damaged: 'manual_correction',
      lost: 'manual_correction',
      transfer_in: 'transfer_out',
      transfer_out: 'transfer_in',
      reservation: 'release_reservation',
      release_reservation: 'reservation',
      adjustment: 'manual_correction',
    };

    return reversalMap[this.movementType] || 'manual_correction';
  }

  validate(): string[] {
    const errors: string[] = [];

    if (this.quantity === 0) {
      errors.push('Miktar sıfır olamaz');
    }

    if (!this.reason || this.reason.trim().length === 0) {
      errors.push('Hareket sebebi gerekli');
    }

    if (this.unitCost !== null && this.unitCost !== undefined && this.unitCost < 0) {
      errors.push('Birim maliyet negatif olamaz');
    }

    if (this.totalValue !== null && this.totalValue !== undefined) {
      const expectedValue = Math.abs(this.quantity) * (this.unitCost || 0);
      const actualValue = Math.abs(this.totalValue);
      
      // Allow 1% tolerance for rounding differences
      if (Math.abs(expectedValue - actualValue) > expectedValue * 0.01) {
        errors.push('Toplam değer miktar ve birim maliyet ile uyumsuz');
      }
    }

    if (this.newStock < 0) {
      errors.push('Yeni stok seviyesi negatif olamaz');
    }

    if (this.previousStock < 0) {
      errors.push('Önceki stok seviyesi negatif olamaz');
    }

    // Validate stock calculation
    const expectedNewStock = this.previousStock + this.quantity;
    if (expectedNewStock !== this.newStock) {
      errors.push('Stok hesaplaması hatalı');
    }

    return errors;
  }

  static createPurchaseMovement(data: {
    userId: string;
    inventoryItemId: string;
    quantity: number;
    previousStock: number;
    unitCost: number;
    currency?: string;
    supplierId?: string;
    orderId?: string;
    performedBy?: string;
  }): Partial<StockMovement> {
    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      movementType: 'purchase',
      quantity: Math.abs(data.quantity), // Ensure positive for purchase
      previousStock: data.previousStock,
      newStock: data.previousStock + Math.abs(data.quantity),
      unitCost: data.unitCost,
      totalValue: Math.abs(data.quantity) * data.unitCost,
      currency: data.currency || 'USD',
      reason: 'Tedarikçiden satın alma',
      referenceId: data.orderId,
      referenceType: 'order',
      performedBy: data.performedBy,
      source: 'manual',
      isReversible: true,
      metadata: {
        supplierId: data.supplierId,
        orderId: data.orderId,
      },
    };
  }

  static createSaleMovement(data: {
    userId: string;
    inventoryItemId: string;
    quantity: number;
    previousStock: number;
    unitCost?: number;
    orderId?: string;
    customerId?: string;
    performedBy?: string;
  }): Partial<StockMovement> {
    const saleQuantity = -Math.abs(data.quantity); // Ensure negative for sale
    
    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      movementType: 'sale',
      quantity: saleQuantity,
      previousStock: data.previousStock,
      newStock: data.previousStock + saleQuantity,
      unitCost: data.unitCost,
      totalValue: data.unitCost ? Math.abs(saleQuantity) * data.unitCost : undefined,
      currency: 'USD',
      reason: 'Müşteriye satış',
      referenceId: data.orderId,
      referenceType: 'order',
      performedBy: data.performedBy,
      source: 'automatic',
      isReversible: true,
      metadata: {
        orderId: data.orderId,
        customerId: data.customerId,
      },
    };
  }

  static createAdjustmentMovement(data: {
    userId: string;
    inventoryItemId: string;
    newStock: number;
    previousStock: number;
    reason: string;
    performedBy?: string;
    notes?: string;
  }): Partial<StockMovement> {
    const quantity = data.newStock - data.previousStock;
    
    return {
      userId: data.userId,
      inventoryItemId: data.inventoryItemId,
      movementType: 'adjustment',
      quantity,
      previousStock: data.previousStock,
      newStock: data.newStock,
      reason: data.reason,
      notes: data.notes,
      performedBy: data.performedBy,
      source: 'manual',
      isReversible: true,
    };
  }

  getMovementSummary(): {
    type: string;
    impact: string;
    value: string;
    date: string;
    reason: string;
  } {
    return {
      type: this.formattedMovementType,
      impact: this.impactDescription,
      value: this.totalValue 
        ? new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: this.currency,
          }).format(Math.abs(this.totalValue))
        : 'N/A',
      date: this.createdAt.toLocaleDateString('tr-TR'),
      reason: this.reason,
    };
  }
}