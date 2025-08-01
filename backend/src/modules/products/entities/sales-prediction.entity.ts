import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('sales_predictions')
@Index(['productId', 'predictionDate'])
@Index(['predictionDate'])
@Unique(['productId', 'predictionDate'])
export class SalesPrediction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  productId: string;

  @Column('date')
  predictionDate: Date;

  @Column('int')
  predictedSales: number;

  @Column('decimal', { precision: 12, scale: 2 })
  predictedRevenue: number;

  @Column('decimal', { precision: 5, scale: 4 })
  confidenceScore: number;

  @Column({ nullable: true })
  modelVersion?: string;

  @Column('jsonb', { nullable: true })
  featuresUsed?: {
    price?: number;
    salesRank?: number;
    reviewCount?: number;
    reviewAverage?: number;
    seasonality?: number;
    trend?: number;
    competition?: number;
    [key: string]: any;
  };

  @Column('int', { nullable: true })
  actualSales?: number;

  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  actualRevenue?: number;

  @Column('decimal', { precision: 5, scale: 4, nullable: true })
  accuracyScore?: number;

  @Column('text', { nullable: true })
  predictionNotes?: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Product, product => product.salesPredictions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // Virtual properties
  get isPredictionAccurate(): boolean {
    if (!this.actualSales || !this.accuracyScore) return false;
    return this.accuracyScore >= 0.8; // 80% accuracy threshold
  }

  get predictionError(): number | null {
    if (!this.actualSales) return null;
    return Math.abs(this.predictedSales - this.actualSales) / this.actualSales;
  }

  get confidenceLevel(): 'low' | 'medium' | 'high' {
    if (this.confidenceScore >= 0.8) return 'high';
    if (this.confidenceScore >= 0.6) return 'medium';
    return 'low';
  }

  get revenueFormatted(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(this.predictedRevenue);
  }

  get actualRevenueFormatted(): string | null {
    if (!this.actualRevenue) return null;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(this.actualRevenue);
  }

  // Methods
  updateWithActualData(actualSales: number, actualRevenue: number): void {
    this.actualSales = actualSales;
    this.actualRevenue = actualRevenue;
    this.calculateAccuracy();
  }

  private calculateAccuracy(): void {
    if (!this.actualSales) return;

    const salesError = Math.abs(this.predictedSales - this.actualSales) / this.actualSales;
    const revenueError = this.actualRevenue 
      ? Math.abs(this.predictedRevenue - this.actualRevenue) / this.actualRevenue 
      : salesError;

    // Combined accuracy score (lower error = higher accuracy)
    this.accuracyScore = 1 - ((salesError + revenueError) / 2);
    this.accuracyScore = Math.max(0, Math.min(1, this.accuracyScore)); // Clamp between 0-1
  }

  static createPrediction(
    productId: string,
    predictionDate: Date,
    predictedSales: number,
    predictedRevenue: number,
    confidenceScore: number,
    modelVersion?: string,
    featuresUsed?: any
  ): SalesPrediction {
    const prediction = new SalesPrediction();
    prediction.productId = productId;
    prediction.predictionDate = predictionDate;
    prediction.predictedSales = predictedSales;
    prediction.predictedRevenue = predictedRevenue;
    prediction.confidenceScore = confidenceScore;
    prediction.modelVersion = modelVersion;
    prediction.featuresUsed = featuresUsed;
    return prediction;
  }

  getDetailedAnalysis(): {
    prediction: {
      sales: number;
      revenue: string;
      confidence: string;
    };
    actual?: {
      sales: number;
      revenue: string;
      accuracy: string;
    };
    features: string[];
  } {
    const analysis = {
      prediction: {
        sales: this.predictedSales,
        revenue: this.revenueFormatted,
        confidence: `${Math.round(this.confidenceScore * 100)}%`,
      },
      features: Object.keys(this.featuresUsed || {}),
    };

    if (this.actualSales) {
      analysis['actual'] = {
        sales: this.actualSales,
        revenue: this.actualRevenueFormatted || 'N/A',
        accuracy: this.accuracyScore ? `${Math.round(this.accuracyScore * 100)}%` : 'N/A',
      };
    }

    return analysis;
  }
}