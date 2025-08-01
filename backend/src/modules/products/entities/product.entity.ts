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
import { Category } from './category.entity';
import { ProductPriceHistory } from './product-price-history.entity';
import { SalesPrediction } from './sales-prediction.entity';
import { User } from '../../auth/entities/user.entity';

@Entity('products')
@Index(['userId', 'asin'], { unique: true })
@Index(['asin'])
@Index(['categoryId'])
@Index(['salesRank'])
@Index(['reviewCount'])
@Index(['reviewAverage'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ length: 10 })
  asin: string;

  @Column('text')
  title: string;

  @Column('text', { nullable: true })
  description?: string;

  @Column({ nullable: true })
  brand?: string;

  @Column('uuid', { nullable: true })
  categoryId?: string;

  @Column('text', { nullable: true })
  imageUrl?: string;

  @Column('text', { nullable: true })
  productUrl?: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ default: false })
  primeEligible: boolean;

  @Column({ default: false })
  isFba: boolean;

  @Column('int', { nullable: true })
  salesRank?: number;

  @Column('int', { default: 0 })
  reviewCount: number;

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  reviewAverage: number;

  @Column('jsonb', { nullable: true })
  dimensions?: {
    height?: number;
    width?: number;
    length?: number;
    weight?: number;
  };

  @Column('decimal', { precision: 8, scale: 2, nullable: true })
  weight?: number;

  @Column('text', { array: true, default: [] })
  features: string[];

  @Column('jsonb', { nullable: true })
  variations?: any[];

  @Column({ default: false })
  isAdult: boolean;

  @Column({ default: false })
  isPrimePantry: boolean;

  @Column({ default: false })
  tradeInEligible: boolean;

  // Computed fields
  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  profitabilityScore?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  competitionScore?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  trendScore?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  overallScore?: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isTracked: boolean;

  @Column({ default: false })
  isWishlisted: boolean;

  @Column('text', { nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @OneToMany(() => ProductPriceHistory, history => history.product)
  priceHistory: ProductPriceHistory[];

  @OneToMany(() => SalesPrediction, prediction => prediction.product)
  salesPredictions: SalesPrediction[];

  // Virtual properties
  get fullImageUrl(): string | null {
    if (!this.imageUrl) return null;
    if (this.imageUrl.startsWith('http')) return this.imageUrl;
    return `https://images-na.ssl-images-amazon.com/images/I/${this.imageUrl}`;
  }

  get amazonUrl(): string {
    return `https://www.amazon.com/dp/${this.asin}`;
  }

  get isHighlyRated(): boolean {
    return this.reviewAverage >= 4.0 && this.reviewCount >= 100;
  }

  get isProfitable(): boolean {
    return this.profitabilityScore ? this.profitabilityScore >= 70 : false;
  }

  get competitionLevel(): 'low' | 'medium' | 'high' {
    if (!this.competitionScore) return 'medium';
    if (this.competitionScore <= 30) return 'low';
    if (this.competitionScore >= 70) return 'high';
    return 'medium';
  }

  // Methods
  calculateOverallScore(): number {
    const scores = [
      this.profitabilityScore || 0,
      this.competitionScore || 0,
      this.trendScore || 0,
    ];

    const weights = [0.4, 0.3, 0.3]; // Profitability is most important
    
    return scores.reduce((acc, score, index) => acc + (score * weights[index]), 0);
  }

  updateScores(
    profitabilityScore?: number,
    competitionScore?: number,
    trendScore?: number
  ): void {
    if (profitabilityScore !== undefined) this.profitabilityScore = profitabilityScore;
    if (competitionScore !== undefined) this.competitionScore = competitionScore;
    if (trendScore !== undefined) this.trendScore = trendScore;
    
    this.overallScore = this.calculateOverallScore();
  }
}