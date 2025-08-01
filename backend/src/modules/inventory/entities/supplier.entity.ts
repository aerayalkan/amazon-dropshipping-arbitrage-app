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
@Index(['userId', 'isActive'])
@Index(['country'])
@Index(['rating'])
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  companyName?: string;

  @Column({ nullable: true })
  contactPerson?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  website?: string;

  @Column({
    type: 'enum',
    enum: ['aliexpress', 'alibaba', 'dhgate', 'made-in-china', 'global-sources', 'other'],
    default: 'other',
  })
  platform: 'aliexpress' | 'alibaba' | 'dhgate' | 'made-in-china' | 'global-sources' | 'other';

  @Column({ nullable: true })
  platformUrl?: string;

  @Column({ nullable: true })
  platformStoreId?: string;

  @Column({ nullable: true })
  country?: string;

  @Column({ nullable: true })
  region?: string;

  @Column({ nullable: true })
  city?: string;

  @Column('text', { nullable: true })
  address?: string;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['verified', 'gold', 'silver', 'standard', 'unverified'],
    default: 'standard',
  })
  verificationLevel: 'verified' | 'gold' | 'silver' | 'standard' | 'unverified';

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column('int', { default: 0 })
  totalOrders: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalOrderValue: number;

  @Column('int', { default: 0 })
  responseTimeHours: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  onTimeDeliveryRate: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  qualityScore: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  communicationScore: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  shippingScore: number;

  @Column('jsonb', { nullable: true })
  paymentMethods?: string[];

  @Column('jsonb', { nullable: true })
  shippingMethods?: Array<{
    method: string;
    cost: number;
    deliveryTime: string;
    trackingAvailable: boolean;
  }>;

  @Column('jsonb', { nullable: true })
  certificates?: Array<{
    name: string;
    issuedBy: string;
    validUntil?: string;
    verified: boolean;
  }>;

  @Column('int', { default: 1 })
  minimumOrderQuantity: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  minimumOrderValue?: number;

  @Column('int', { default: 30 })
  leadTimeDays: number;

  @Column('int', { default: 7 })
  sampleTime: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  sampleCost: number;

  @Column({ default: false })
  freeShippingAvailable: boolean;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  freeShippingThreshold: number;

  @Column({ default: false })
  customizationAvailable: boolean;

  @Column({ default: false })
  dropshippingSupported: boolean;

  @Column({ default: false })
  bulkDiscountAvailable: boolean;

  @Column('jsonb', { nullable: true })
  bulkDiscountTiers?: Array<{
    minQuantity: number;
    discountPercent: number;
  }>;

  @Column('text', { array: true, default: [] })
  tags: string[];

  @Column('text', { nullable: true })
  notes?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isFavorite: boolean;

  @Column({ default: false })
  isBlacklisted: boolean;

  @Column('text', { nullable: true })
  blacklistReason?: string;

  @Column('timestamp', { nullable: true })
  lastContactDate?: Date;

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
  get overallScore(): number {
    const scores = [
      this.rating * 20, // Convert 5-star to 100-point scale
      this.onTimeDeliveryRate,
      this.qualityScore,
      this.communicationScore,
      this.shippingScore,
    ].filter(score => score > 0);

    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  }

  get reliabilityLevel(): 'low' | 'medium' | 'high' {
    const score = this.overallScore;
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  get averageOrderValue(): number {
    return this.totalOrders > 0 ? this.totalOrderValue / this.totalOrders : 0;
  }

  get isRecommended(): boolean {
    return (
      this.overallScore >= 70 &&
      this.onTimeDeliveryRate >= 85 &&
      this.qualityScore >= 75 &&
      this.totalOrders >= 5 &&
      this.isActive &&
      !this.isBlacklisted
    );
  }

  get riskLevel(): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Verification level risk
    if (this.verificationLevel === 'unverified') riskScore += 30;
    else if (this.verificationLevel === 'standard') riskScore += 15;

    // Order history risk
    if (this.totalOrders < 5) riskScore += 25;
    else if (this.totalOrders < 20) riskScore += 10;

    // Performance risk
    if (this.onTimeDeliveryRate < 70) riskScore += 20;
    else if (this.onTimeDeliveryRate < 85) riskScore += 10;

    if (this.qualityScore < 60) riskScore += 15;

    // Communication risk
    if (this.responseTimeHours > 48) riskScore += 10;

    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  // Methods
  updateRating(newRating: number): void {
    this.rating = Math.max(0, Math.min(5, newRating));
  }

  addOrder(orderValue: number, isOnTime: boolean, qualityRating: number): void {
    this.totalOrders += 1;
    this.totalOrderValue += orderValue;
    
    // Update on-time delivery rate
    const currentTotal = this.onTimeDeliveryRate * (this.totalOrders - 1);
    this.onTimeDeliveryRate = (currentTotal + (isOnTime ? 100 : 0)) / this.totalOrders;
    
    // Update quality score
    const currentQualityTotal = this.qualityScore * (this.totalOrders - 1);
    this.qualityScore = (currentQualityTotal + qualityRating) / this.totalOrders;
    
    this.lastOrderDate = new Date();
  }

  updateCommunicationScore(responseTime: number, quality: number): void {
    this.responseTimeHours = responseTime;
    this.communicationScore = quality;
    this.lastContactDate = new Date();
  }

  blacklist(reason: string): void {
    this.isBlacklisted = true;
    this.isActive = false;
    this.blacklistReason = reason;
  }

  whitelist(): void {
    this.isBlacklisted = false;
    this.blacklistReason = null;
    this.isActive = true;
  }

  calculateShippingCost(weight: number, destination: string): number {
    // Basit shipping cost hesaplama
    if (!this.shippingMethods || this.shippingMethods.length === 0) {
      return weight * 2; // Default rate
    }

    const cheapestMethod = this.shippingMethods.reduce((min, method) => 
      method.cost < min.cost ? method : min
    );

    return cheapestMethod.cost * Math.ceil(weight / 1000); // Per kg
  }

  getBulkDiscount(quantity: number): number {
    if (!this.bulkDiscountAvailable || !this.bulkDiscountTiers) {
      return 0;
    }

    const applicableTier = this.bulkDiscountTiers
      .filter(tier => quantity >= tier.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity)[0];

    return applicableTier ? applicableTier.discountPercent : 0;
  }

  getEstimatedDeliveryDays(shippingMethod?: string): number {
    if (shippingMethod && this.shippingMethods) {
      const method = this.shippingMethods.find(m => m.method === shippingMethod);
      if (method) {
        // Parse delivery time string (e.g., "7-15 days")
        const match = method.deliveryTime.match(/(\d+)-?(\d+)?/);
        if (match) {
          const min = parseInt(match[1]);
          const max = match[2] ? parseInt(match[2]) : min;
          return (min + max) / 2;
        }
      }
    }

    return this.leadTimeDays;
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Tedarikçi adı gerekli');
    }

    if (this.email && !this.email.includes('@')) {
      errors.push('Geçerli bir email adresi gerekli');
    }

    if (this.rating < 0 || this.rating > 5) {
      errors.push('Rating 0-5 arasında olmalı');
    }

    if (this.minimumOrderQuantity < 0) {
      errors.push('Minimum sipariş miktarı negatif olamaz');
    }

    if (this.minimumOrderValue && this.minimumOrderValue < 0) {
      errors.push('Minimum sipariş tutarı negatif olamaz');
    }

    if (this.leadTimeDays < 0) {
      errors.push('Teslimat süresi negatif olamaz');
    }

    if (this.sampleCost < 0) {
      errors.push('Numune ücreti negatif olamaz');
    }

    return errors;
  }

  static createFromPlatformData(platformData: {
    platform: string;
    storeId: string;
    name: string;
    url: string;
    rating?: number;
    country?: string;
  }): Partial<Supplier> {
    return {
      name: platformData.name,
      platform: platformData.platform as any,
      platformUrl: platformData.url,
      platformStoreId: platformData.storeId,
      rating: platformData.rating || 0,
      country: platformData.country,
      verificationLevel: 'standard',
      isActive: true,
    };
  }
}