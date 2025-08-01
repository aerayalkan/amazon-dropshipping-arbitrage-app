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
import { User } from '../../auth/entities/user.entity';
import { SupplierProduct } from './supplier-product.entity';
import { InventoryItem } from './inventory-item.entity';

@Entity('suppliers')
@Index(['userId', 'name'])
@Index(['country'])
@Index(['rating'])
@Index(['isActive'])
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  companyName?: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: ['aliexpress', 'alibaba', 'amazon', 'local', 'wholesale', 'manufacturer', 'other'],
    default: 'other',
  })
  platform: 'aliexpress' | 'alibaba' | 'amazon' | 'local' | 'wholesale' | 'manufacturer' | 'other';

  // İletişim Bilgileri
  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  website?: string;

  @Column({ nullable: true })
  profileUrl?: string;

  // Adres Bilgileri
  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  state?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  postalCode?: string;

  // İş Bilgileri
  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column('int', { default: 0 })
  totalOrders: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  totalOrderValue: number;

  @Column('int', { default: 0 })
  responseTimeHours: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  onTimeDeliveryRate: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  qualityScore: number;

  @Column('int', { default: 0 })
  shippingTimeMin: number;

  @Column('int', { default: 0 })
  shippingTimeMax: number;

  @Column('text', { array: true, default: [] })
  shippingMethods: string[];

  @Column('jsonb', { nullable: true })
  shippingCosts?: {
    [method: string]: {
      baseCost: number;
      perKgCost: number;
      freeShippingThreshold?: number;
    };
  };

  // Ödeme Şartları
  @Column('text', { array: true, default: [] })
  paymentMethods: string[];

  @Column('int', { default: 30 })
  paymentTermsDays: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  discountRate: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  minimumOrderValue?: number;

  // Vergi ve Uyumluluk
  @Column({ nullable: true })
  taxId?: string;

  @Column('text', { array: true, default: [] })
  certifications: string[];

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  hasContract: boolean;

  @Column('text', { nullable: true })
  contractDetails?: string;

  // API/Entegrasyon
  @Column('jsonb', { nullable: true })
  apiCredentials?: {
    apiKey?: string;
    accessToken?: string;
    shopId?: string;
    supplierId?: string;
    lastApiCall?: string;
  };

  @Column({ default: false })
  hasApiIntegration: boolean;

  @Column('int', { default: 60 })
  syncIntervalMinutes: number;

  // Durum ve Notlar
  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isPreferred: boolean;

  @Column('text', { nullable: true })
  notes?: string;

  @Column('jsonb', { nullable: true })
  tags?: string[];

  @Column('timestamp', { nullable: true })
  lastContact?: Date;

  @Column('timestamp', { nullable: true })
  lastOrderDate?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => SupplierProduct, sp => sp.supplier)
  supplierProducts: SupplierProduct[];

  @OneToMany(() => InventoryItem, item => item.supplier)
  inventoryItems: InventoryItem[];

  // Virtual Properties
  get averageOrderValue(): number {
    return this.totalOrders > 0 ? this.totalOrderValue / this.totalOrders : 0;
  }

  get reliabilityScore(): number {
    let score = 0;
    let factors = 0;

    if (this.rating > 0) {
      score += this.rating * 20; // 0-5 rating -> 0-100
      factors++;
    }

    if (this.onTimeDeliveryRate > 0) {
      score += this.onTimeDeliveryRate;
      factors++;
    }

    if (this.qualityScore > 0) {
      score += this.qualityScore;
      factors++;
    }

    if (this.responseTimeHours > 0) {
      const responseScore = Math.max(0, 100 - this.responseTimeHours);
      score += responseScore;
      factors++;
    }

    return factors > 0 ? score / factors : 0;
  }

  get averageShippingTime(): number {
    return this.shippingTimeMin > 0 && this.shippingTimeMax > 0
      ? (this.shippingTimeMin + this.shippingTimeMax) / 2
      : 0;
  }

  get isRecommended(): boolean {
    return this.reliabilityScore >= 80 && this.rating >= 4.0 && this.isVerified;
  }

  get communicationScore(): number {
    let score = 50; // Base score

    if (this.responseTimeHours <= 2) score += 25;
    else if (this.responseTimeHours <= 8) score += 15;
    else if (this.responseTimeHours <= 24) score += 5;

    if (this.email && this.phone) score += 15;
    else if (this.email || this.phone) score += 10;

    if (this.lastContact) {
      const daysSinceContact = Math.floor(
        (Date.now() - new Date(this.lastContact).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceContact <= 7) score += 10;
      else if (daysSinceContact <= 30) score += 5;
    }

    return Math.min(score, 100);
  }

  get businessScore(): number {
    let score = 0;

    // Order volume
    if (this.totalOrders > 100) score += 20;
    else if (this.totalOrders > 50) score += 15;
    else if (this.totalOrders > 10) score += 10;

    // Order value
    if (this.averageOrderValue > 1000) score += 15;
    else if (this.averageOrderValue > 500) score += 10;
    else if (this.averageOrderValue > 100) score += 5;

    // Verification and certifications
    if (this.isVerified) score += 15;
    if (this.certifications.length > 0) score += 10;
    if (this.hasContract) score += 10;

    // Recent activity
    if (this.lastOrderDate) {
      const daysSinceOrder = Math.floor(
        (Date.now() - new Date(this.lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceOrder <= 30) score += 15;
      else if (daysSinceOrder <= 90) score += 10;
      else if (daysSinceOrder <= 180) score += 5;
    }

    // Platform preference
    if (['alibaba', 'manufacturer'].includes(this.platform)) score += 10;
    else if (['wholesale', 'aliexpress'].includes(this.platform)) score += 5;

    return Math.min(score, 100);
  }

  // Methods
  updateRating(newRating: number, orderId?: string): void {
    if (newRating < 0 || newRating > 5) {
      throw new Error('Rating 0-5 arasında olmalıdır');
    }

    // Ağırlıklı ortalama hesaplama
    const totalWeight = this.totalOrders;
    const newWeight = 1;
    
    this.rating = totalWeight > 0 
      ? ((this.rating * totalWeight) + (newRating * newWeight)) / (totalWeight + newWeight)
      : newRating;
    
    this.rating = Math.round(this.rating * 100) / 100; // 2 decimal places
  }

  updateDeliveryPerformance(deliveredOnTime: boolean): void {
    const totalDeliveries = this.totalOrders;
    const currentSuccessfulDeliveries = (this.onTimeDeliveryRate / 100) * totalDeliveries;
    
    const newSuccessfulDeliveries = deliveredOnTime 
      ? currentSuccessfulDeliveries + 1 
      : currentSuccessfulDeliveries;
    
    this.onTimeDeliveryRate = totalDeliveries > 0 
      ? (newSuccessfulDeliveries / totalDeliveries) * 100 
      : deliveredOnTime ? 100 : 0;
  }

  addOrder(orderValue: number, deliveredOnTime: boolean = true): void {
    this.totalOrders += 1;
    this.totalOrderValue += orderValue;
    this.lastOrderDate = new Date();
    
    this.updateDeliveryPerformance(deliveredOnTime);
  }

  calculateShippingCost(weight: number, method: string = 'standard'): number {
    if (!this.shippingCosts || !this.shippingCosts[method]) {
      return 0;
    }

    const shipping = this.shippingCosts[method];
    const totalCost = shipping.baseCost + (weight * shipping.perKgCost);

    // Free shipping threshold kontrolü
    if (shipping.freeShippingThreshold && this.averageOrderValue >= shipping.freeShippingThreshold) {
      return 0;
    }

    return totalCost;
  }

  canFulfillOrder(requiredQuantity: number, productId: string): boolean {
    // Bu method supplier products ile implement edilecek
    return true; // Placeholder
  }

  getPerformanceReport(): {
    overall: number;
    reliability: number;
    communication: number;
    business: number;
    recommendations: string[];
  } {
    const reliability = this.reliabilityScore;
    const communication = this.communicationScore;
    const business = this.businessScore;
    const overall = (reliability + communication + business) / 3;

    const recommendations: string[] = [];

    if (reliability < 70) {
      recommendations.push('Teslimat performansını iyileştirin');
    }

    if (communication < 70) {
      recommendations.push('İletişim hızını artırın');
    }

    if (business < 70) {
      recommendations.push('İş hacmini ve doğrulamayı tamamlayın');
    }

    if (this.rating < 4.0) {
      recommendations.push('Müşteri memnuniyetini artırın');
    }

    if (!this.isVerified) {
      recommendations.push('Hesap doğrulamasını tamamlayın');
    }

    return {
      overall,
      reliability,
      communication,
      business,
      recommendations,
    };
  }

  static createFromPlatformData(
    userId: string,
    platform: string,
    platformData: any
  ): Supplier {
    const supplier = new Supplier();
    supplier.userId = userId;
    supplier.platform = platform as any;
    
    // Platform spesifik mapping
    switch (platform) {
      case 'aliexpress':
        supplier.name = platformData.sellerName || platformData.storeName;
        supplier.rating = platformData.rating || 0;
        supplier.profileUrl = platformData.storeUrl;
        supplier.country = platformData.location || 'China';
        break;
        
      case 'alibaba':
        supplier.name = platformData.companyName || platformData.supplierName;
        supplier.companyName = platformData.companyName;
        supplier.rating = platformData.rating || 0;
        supplier.isVerified = platformData.goldSupplier || false;
        supplier.country = platformData.country || 'China';
        break;
        
      default:
        supplier.name = platformData.name || 'Unknown Supplier';
    }

    return supplier;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Tedarikçi adı gereklidir');
    }

    if (this.rating < 0 || this.rating > 5) {
      errors.push('Rating 0-5 arasında olmalıdır');
    }

    if (this.onTimeDeliveryRate < 0 || this.onTimeDeliveryRate > 100) {
      errors.push('Teslimat oranı 0-100 arasında olmalıdır');
    }

    if (this.qualityScore < 0 || this.qualityScore > 100) {
      errors.push('Kalite skoru 0-100 arasında olmalıdır');
    }

    if (this.shippingTimeMin > this.shippingTimeMax) {
      errors.push('Minimum teslimat süresi maksimumdan küçük olmalı');
    }

    if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      errors.push('Geçerli bir e-posta adresi giriniz');
    }

    return errors;
  }
}