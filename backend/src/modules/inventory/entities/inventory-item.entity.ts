import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { User } from '../../auth/entities/user.entity';
import { Supplier } from './supplier.entity';
import { SupplierProduct } from './supplier-product.entity';
import { StockMovement } from './stock-movement.entity';
import { StockAlert } from './stock-alert.entity';

@Entity('inventory_items')
@Index(['userId', 'productId'], { unique: true })
@Index(['userId', 'sku'])
@Index(['stockLevel'])
@Index(['stockStatus'])
@Index(['lastUpdated'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('uuid')
  productId: string;

  @Column('uuid', { nullable: true })
  supplierId?: string;

  @Column({ unique: true })
  sku: string;

  @Column('int', { default: 0 })
  stockLevel: number;

  @Column('int', { default: 0 })
  reservedStock: number;

  @Column('int', { default: 0 })
  availableStock: number;

  @Column('int', { default: 10 })
  minimumStock: number;

  @Column('int', { default: 100 })
  maximumStock: number;

  @Column('int', { default: 20 })
  reorderPoint: number;

  @Column('int', { default: 50 })
  reorderQuantity: number;

  @Column({
    type: 'enum',
    enum: ['in_stock', 'low_stock', 'out_of_stock', 'discontinued'],
    default: 'in_stock',
  })
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  costPrice?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  sellingPrice?: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ default: true })
  autoReorder: boolean;

  @Column({ default: true })
  trackStock: boolean;

  @Column({ default: false })
  allowBackorders: boolean;

  @Column('text', { nullable: true })
  location?: string;

  @Column('jsonb', { nullable: true })
  attributes?: {
    weight?: number;
    dimensions?: {
      length: number;
      width: number;
      height: number;
    };
    color?: string;
    size?: string;
    condition?: 'new' | 'used' | 'refurbished';
    expiryDate?: string;
    batchNumber?: string;
    serialNumbers?: string[];
  };

  @Column('text', { nullable: true })
  notes?: string;

  @Column('timestamp', { nullable: true })
  lastStockCheck?: Date;

  @Column('timestamp', { nullable: true })
  lastReorder?: Date;

  @Column('timestamp', { nullable: true })
  lastSale?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplierId' })
  supplier?: Supplier;

  @OneToMany(() => SupplierProduct, sp => sp.inventoryItem)
  supplierProducts: SupplierProduct[];

  @OneToMany(() => StockMovement, movement => movement.inventoryItem)
  stockMovements: StockMovement[];

  @OneToMany(() => StockAlert, alert => alert.inventoryItem)
  stockAlerts: StockAlert[];

  // Virtual Properties
  get stockValue(): number {
    return this.stockLevel * (this.costPrice || 0);
  }

  get potentialProfit(): number {
    const margin = (this.sellingPrice || 0) - (this.costPrice || 0);
    return this.stockLevel * margin;
  }

  get turnoverRate(): number {
    // Basit turnover hesaplaması
    if (!this.lastSale || this.stockLevel === 0) return 0;
    
    const daysSinceLastSale = Math.floor(
      (Date.now() - new Date(this.lastSale).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    return daysSinceLastSale > 0 ? this.stockLevel / daysSinceLastSale : 0;
  }

  get needsReorder(): boolean {
    return this.autoReorder && this.availableStock <= this.reorderPoint;
  }

  get stockHealthScore(): number {
    let score = 100;

    // Stok seviyesi kontrolü
    if (this.stockStatus === 'out_of_stock') score -= 50;
    else if (this.stockStatus === 'low_stock') score -= 25;

    // Turnover rate kontrolü
    if (this.turnoverRate < 0.1) score -= 20; // Yavaş hareket eden stok

    // Reorder point kontrolü
    if (this.needsReorder) score -= 15;

    // Son kontrol tarihi
    if (this.lastStockCheck) {
      const daysSinceCheck = Math.floor(
        (Date.now() - new Date(this.lastStockCheck).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceCheck > 7) score -= 10; // 1 haftadan fazla kontrol edilmemiş
    }

    return Math.max(0, score);
  }

  // Methods
  updateStockLevel(newLevel: number, reason: string): void {
    const previousLevel = this.stockLevel;
    this.stockLevel = newLevel;
    this.availableStock = Math.max(0, newLevel - this.reservedStock);
    
    // Stock status güncelle
    this.updateStockStatus();
    
    this.lastStockCheck = new Date();

    // Stock movement log için data
    const movementData = {
      previousLevel,
      newLevel,
      difference: newLevel - previousLevel,
      reason,
    };
  }

  private updateStockStatus(): void {
    if (this.stockLevel <= 0) {
      this.stockStatus = 'out_of_stock';
    } else if (this.stockLevel <= this.minimumStock) {
      this.stockStatus = 'low_stock';
    } else {
      this.stockStatus = 'in_stock';
    }
  }

  reserveStock(quantity: number): boolean {
    if (this.availableStock >= quantity) {
      this.reservedStock += quantity;
      this.availableStock -= quantity;
      return true;
    }
    return false;
  }

  releaseStock(quantity: number): void {
    const releaseAmount = Math.min(quantity, this.reservedStock);
    this.reservedStock -= releaseAmount;
    this.availableStock += releaseAmount;
  }

  adjustStock(adjustment: number, reason: string): void {
    const newLevel = Math.max(0, this.stockLevel + adjustment);
    this.updateStockLevel(newLevel, reason);
  }

  calculateReorderQuantity(): number {
    if (!this.autoReorder) return 0;

    let quantity = this.reorderQuantity;

    // Satış hızına göre ayarlama
    if (this.turnoverRate > 1) {
      quantity = Math.ceil(quantity * 1.5); // Hızlı satılan ürünler için artır
    } else if (this.turnoverRate < 0.1) {
      quantity = Math.ceil(quantity * 0.7); // Yavaş satılan ürünler için azalt
    }

    // Maximum stock kontrolü
    const maxAllowed = this.maximumStock - this.stockLevel;
    return Math.min(quantity, maxAllowed);
  }

  getStockMovementSummary(days: number = 30): {
    totalIn: number;
    totalOut: number;
    netMovement: number;
    averageDailyMovement: number;
  } {
    // Bu method stock movements ile implement edilecek
    return {
      totalIn: 0,
      totalOut: 0,
      netMovement: 0,
      averageDailyMovement: 0,
    };
  }

  static generateSku(productId: string, supplierId?: string): string {
    const productPart = productId.slice(0, 8).toUpperCase();
    const supplierPart = supplierId ? supplierId.slice(0, 4).toUpperCase() : 'MAIN';
    const timestamp = Date.now().toString().slice(-6);
    
    return `${productPart}-${supplierPart}-${timestamp}`;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (this.stockLevel < 0) {
      errors.push('Stok seviyesi negatif olamaz');
    }

    if (this.reservedStock < 0) {
      errors.push('Rezerve stok negatif olamaz');
    }

    if (this.reservedStock > this.stockLevel) {
      errors.push('Rezerve stok toplam stoktan fazla olamaz');
    }

    if (this.minimumStock >= this.maximumStock) {
      errors.push('Minimum stok maximum stoktan küçük olmalı');
    }

    if (this.reorderPoint > this.maximumStock) {
      errors.push('Yeniden sipariş noktası maximum stoktan küçük olmalı');
    }

    if (this.costPrice && this.costPrice < 0) {
      errors.push('Maliyet fiyatı negatif olamaz');
    }

    if (this.sellingPrice && this.sellingPrice < 0) {
      errors.push('Satış fiyatı negatif olamaz');
    }

    return errors;
  }
}