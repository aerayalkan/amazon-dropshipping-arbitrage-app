import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_price_history')
@Index(['productId', 'recordedAt'])
@Index(['recordedAt'])
export class ProductPriceHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ nullable: true })
  availability?: string;

  @Column('int', { default: 0 })
  sellerCount: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  buyBoxPrice?: number;

  @Column({ nullable: true })
  buyBoxSeller?: string;

  @Column({ default: false })
  isBuyBoxWinner: boolean;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  priceChangePercent?: number;

  @Column('text', { nullable: true })
  priceChangeReason?: string;

  @CreateDateColumn()
  recordedAt: Date;

  // Relations
  @ManyToOne(() => Product, product => product.priceHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // Virtual properties
  get priceFormatted(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency,
    }).format(this.price);
  }

  get isAvailable(): boolean {
    return this.availability === 'In Stock' || this.availability === 'Available';
  }

  get hasBuyBox(): boolean {
    return this.buyBoxPrice !== null && this.buyBoxPrice !== undefined;
  }

  // Methods
  static calculatePriceChange(currentPrice: number, previousPrice: number): number {
    if (!previousPrice || previousPrice === 0) return 0;
    return ((currentPrice - previousPrice) / previousPrice) * 100;
  }

  static getPriceChangeText(changePercent: number): string {
    if (changePercent > 5) return 'Significant Increase';
    if (changePercent > 0) return 'Slight Increase';
    if (changePercent < -5) return 'Significant Decrease';
    if (changePercent < 0) return 'Slight Decrease';
    return 'No Change';
  }

  updatePriceChange(previousPrice?: number): void {
    if (previousPrice) {
      this.priceChangePercent = ProductPriceHistory.calculatePriceChange(
        this.price,
        previousPrice
      );
      this.priceChangeReason = ProductPriceHistory.getPriceChangeText(
        this.priceChangePercent
      );
    }
  }
}