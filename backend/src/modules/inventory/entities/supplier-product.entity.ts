import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Supplier } from './supplier.entity';
import { InventoryItem } from './inventory-item.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('supplier_products')
@Index(['supplierId', 'productId'])
@Index(['supplierId', 'isActive'])
@Index(['supplierPrice'])
@Index(['lastUpdated'])
@Unique(['supplierId', 'supplierSku'])
export class SupplierProduct {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  supplierId: string;

  @Column('uuid')
  productId: string;

  @Column('uuid', { nullable: true })
  inventoryItemId?: string;

  @Column()
  supplierSku: string;

  @Column({ nullable: true })
  supplierProductId?: string;

  @Column('text')
  supplierProductName: string;

  @Column('text', { nullable: true })
  supplierProductUrl?: string;

  @Column('decimal', { precision: 10, scale: 2 })
  supplierPrice: number;

  @Column({ length: 3, default: 'USD' })
  supplierCurrency: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  shippingCost?: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  totalCost?: number;

  @Column('int', { default: 1 })
  minimumOrderQuantity: number;

  @Column('int', { default: 999999 })
  maximumOrderQuantity: number;

  @Column('int', { default: 0 })
  availableStock: number;

  @Column('int', { default: 7 })
  leadTimeDays: number;

  @Column({
    type: 'enum',
    enum: ['available', 'limited', 'out_of_stock', 'discontinued'],
    default: 'available',
  })
  availabilityStatus: 'available' | 'limited' | 'out_of_stock' | 'discontinued';

  @Column('jsonb', { nullable: true })
  productVariations?: Array<{
    name: string;
    options: string[];
    priceModifier?: number;
  }>;

  @Column('jsonb', { nullable: true })
  shippingOptions?: Array<{
    method: string;
    cost: number;
    deliveryTime: string;
    trackingAvailable: boolean;
  }>;

  @Column('jsonb', { nullable: true })
  qualityGrades?: Array<{
    grade: string;
    description: string;
    priceModifier: number;
  }>;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  qualityScore: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  reliabilityScore: number;

  @Column('int', { default: 0 })
  orderCount: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalOrderValue: number;

  @Column('timestamp', { nullable: true })
  lastOrderDate?: Date;

  @Column('timestamp', { nullable: true })
  lastPriceUpdate?: Date;

  @Column('timestamp', { nullable: true })
  lastStockCheck?: Date;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  priceChangePercent?: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPreferred: boolean;

  @Column({ default: false })
  autoReorder: boolean;

  @Column({ default: false })
  priceTrackingEnabled: boolean;

  @Column({ default: false })
  stockTrackingEnabled: boolean;

  @Column('jsonb', { nullable: true })
  customAttributes?: {
    weight?: number;
    dimensions?: {
      length: number;
      width: number;
      height: number;
    };
    material?: string;
    color?: string;
    size?: string;
    packaging?: string;
    warranty?: string;
    certification?: string[];
  };

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Supplier, supplier => supplier.supplierProducts)
  @JoinColumn({ name: 'supplierId' })
  supplier: Supplier;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'productId' })
  product: Product;

  @ManyToOne(() => InventoryItem, { nullable: true })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem?: InventoryItem;

  // Virtual Properties
  get costPerUnit(): number {
    return this.totalCost || (this.supplierPrice + (this.shippingCost || 0));
  }

  get profitMargin(): number {
    if (!this.inventoryItem?.sellingPrice) return 0;
    const margin = this.inventoryItem.sellingPrice - this.costPerUnit;
    return (margin / this.inventoryItem.sellingPrice) * 100;
  }

  get isCompetitivellyPriced(): boolean {
    // Bu method başka tedarikçilerin fiyatları ile karşılaştırma yapacak
    return this.qualityScore >= 70 && this.reliabilityScore >= 70;
  }

  get stockStatus(): 'high' | 'medium' | 'low' | 'out' {
    if (this.availableStock === 0) return 'out';
    if (this.availableStock <= this.minimumOrderQuantity) return 'low';
    if (this.availableStock <= this.minimumOrderQuantity * 3) return 'medium';
    return 'high';
  }

  get performanceScore(): number {
    let score = 0;
    let factors = 0;

    if (this.qualityScore > 0) {
      score += this.qualityScore;
      factors++;
    }

    if (this.reliabilityScore > 0) {
      score += this.reliabilityScore;
      factors++;
    }

    if (this.orderCount > 0) {
      // Order history score (max 100)
      const historyScore = Math.min((this.orderCount / 10) * 100, 100);
      score += historyScore;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  get recommendationLevel(): 'low' | 'medium' | 'high' {
    const performance = this.performanceScore;
    if (performance >= 80) return 'high';
    if (performance >= 60) return 'medium';
    return 'low';
  }

  // Methods
  updatePrice(newPrice: number): void {
    const oldPrice = this.supplierPrice;
    this.supplierPrice = newPrice;
    
    if (oldPrice > 0) {
      this.priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
    }
    
    this.totalCost = newPrice + (this.shippingCost || 0);
    this.lastPriceUpdate = new Date();
  }

  updateStock(newStock: number): void {
    this.availableStock = Math.max(0, newStock);
    
    // Update availability status based on stock
    if (newStock === 0) {
      this.availabilityStatus = 'out_of_stock';
    } else if (newStock <= this.minimumOrderQuantity) {
      this.availabilityStatus = 'limited';
    } else {
      this.availabilityStatus = 'available';
    }
    
    this.lastStockCheck = new Date();
  }

  recordOrder(quantity: number, unitPrice: number): void {
    this.orderCount += 1;
    this.totalOrderValue += quantity * unitPrice;
    this.lastOrderDate = new Date();
    
    // Update available stock if tracking is enabled
    if (this.stockTrackingEnabled) {
      this.availableStock = Math.max(0, this.availableStock - quantity);
    }
  }

  calculateOrderCost(quantity: number): {
    unitCost: number;
    shippingCost: number;
    totalCost: number;
    estimatedDelivery: Date;
  } {
    const unitCost = this.supplierPrice;
    let shippingCost = this.shippingCost || 0;
    
    // Apply bulk shipping discount if applicable
    if (quantity >= 10) {
      shippingCost *= 0.8; // 20% discount for bulk orders
    }
    
    const totalCost = (unitCost * quantity) + shippingCost;
    
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + this.leadTimeDays);
    
    return {
      unitCost,
      shippingCost,
      totalCost,
      estimatedDelivery,
    };
  }

  checkReorderNeed(currentStock: number, minimumThreshold: number): boolean {
    return (
      this.autoReorder &&
      this.isActive &&
      currentStock <= minimumThreshold &&
      this.availabilityStatus === 'available' &&
      this.availableStock >= this.minimumOrderQuantity
    );
  }

  updateQualityMetrics(quality: number, reliability: number): void {
    this.qualityScore = Math.max(0, Math.min(100, quality));
    this.reliabilityScore = Math.max(0, Math.min(100, reliability));
  }

  getVariationPrice(variationOptions: { [key: string]: string }): number {
    if (!this.productVariations) return this.supplierPrice;
    
    let priceModifier = 0;
    
    this.productVariations.forEach(variation => {
      const selectedOption = variationOptions[variation.name];
      if (selectedOption && variation.options.includes(selectedOption)) {
        priceModifier += variation.priceModifier || 0;
      }
    });
    
    return this.supplierPrice + priceModifier;
  }

  getShippingQuote(destination: string, weight?: number): number {
    if (!this.shippingOptions || this.shippingOptions.length === 0) {
      return this.shippingCost || 0;
    }
    
    // Return cheapest shipping option
    const cheapestOption = this.shippingOptions.reduce((min, option) => 
      option.cost < min.cost ? option : min
    );
    
    return cheapestOption.cost;
  }

  validate(): string[] {
    const errors: string[] = [];
    
    if (!this.supplierSku || this.supplierSku.trim().length === 0) {
      errors.push('Tedarikçi SKU gerekli');
    }
    
    if (!this.supplierProductName || this.supplierProductName.trim().length === 0) {
      errors.push('Tedarikçi ürün adı gerekli');
    }
    
    if (this.supplierPrice <= 0) {
      errors.push('Tedarikçi fiyatı sıfırdan büyük olmalı');
    }
    
    if (this.minimumOrderQuantity <= 0) {
      errors.push('Minimum sipariş miktarı sıfırdan büyük olmalı');
    }
    
    if (this.maximumOrderQuantity < this.minimumOrderQuantity) {
      errors.push('Maximum sipariş miktarı minimum miktardan küçük olamaz');
    }
    
    if (this.leadTimeDays < 0) {
      errors.push('Teslimat süresi negatif olamaz');
    }
    
    if (this.qualityScore < 0 || this.qualityScore > 100) {
      errors.push('Kalite skoru 0-100 arasında olmalı');
    }
    
    if (this.reliabilityScore < 0 || this.reliabilityScore > 100) {
      errors.push('Güvenilirlik skoru 0-100 arasında olmalı');
    }
    
    return errors;
  }

  static createFromSupplierData(data: {
    supplierId: string;
    productId: string;
    supplierSku: string;
    name: string;
    price: number;
    currency?: string;
    url?: string;
    stock?: number;
    leadTime?: number;
  }): Partial<SupplierProduct> {
    return {
      supplierId: data.supplierId,
      productId: data.productId,
      supplierSku: data.supplierSku,
      supplierProductName: data.name,
      supplierProductUrl: data.url,
      supplierPrice: data.price,
      supplierCurrency: data.currency || 'USD',
      availableStock: data.stock || 0,
      leadTimeDays: data.leadTime || 7,
      isActive: true,
    };
  }
}