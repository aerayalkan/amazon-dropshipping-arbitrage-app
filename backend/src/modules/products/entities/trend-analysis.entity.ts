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
import { Category } from './category.entity';

@Entity('trend_analysis')
@Index(['keyword'])
@Index(['analyzedDate'])
@Index(['categoryId'])
@Unique(['keyword', 'analyzedDate'])
export class TrendAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  keyword: string;

  @Column('uuid', { nullable: true })
  categoryId?: string;

  @Column('int', { nullable: true })
  googleTrendsScore?: number;

  @Column('int', { nullable: true })
  amazonSearchVolume?: number;

  @Column({ type: 'enum', enum: ['up', 'down', 'stable'], nullable: true })
  trendingDirection?: 'up' | 'down' | 'stable';

  @Column('decimal', { precision: 3, scale: 2, nullable: true })
  seasonalityScore?: number;

  @Column({ type: 'enum', enum: ['low', 'medium', 'high'], nullable: true })
  competitionLevel?: 'low' | 'medium' | 'high';

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  opportunityScore?: number;

  @Column('jsonb', { nullable: true })
  relatedKeywords?: string[];

  @Column('jsonb', { nullable: true })
  trendData?: {
    timelineData?: Array<{
      date: string;
      value: number;
    }>;
    peakMonths?: string[];
    growthRate?: number;
    volatility?: number;
  };

  @Column('jsonb', { nullable: true })
  competitorData?: {
    topProducts?: Array<{
      asin: string;
      title: string;
      price: number;
      rank: number;
    }>;
    avgPrice?: number;
    priceRange?: {
      min: number;
      max: number;
    };
  };

  @Column('date')
  analyzedDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  // Virtual properties
  get trendStrength(): 'weak' | 'moderate' | 'strong' {
    if (!this.googleTrendsScore) return 'weak';
    if (this.googleTrendsScore >= 70) return 'strong';
    if (this.googleTrendsScore >= 40) return 'moderate';
    return 'weak';
  }

  get isOpportunity(): boolean {
    return this.opportunityScore ? this.opportunityScore >= 70 : false;
  }

  get isSeasonal(): boolean {
    return this.seasonalityScore ? this.seasonalityScore >= 0.6 : false;
  }

  get trendIcon(): string {
    switch (this.trendingDirection) {
      case 'up': return '📈';
      case 'down': return '📉';
      case 'stable': return '➡️';
      default: return '❓';
    }
  }

  get competitionColor(): string {
    switch (this.competitionLevel) {
      case 'low': return 'green';
      case 'medium': return 'yellow';
      case 'high': return 'red';
      default: return 'gray';
    }
  }

  // Methods
  calculateOpportunityScore(): number {
    let score = 0;
    
    // Google Trends weight: 30%
    if (this.googleTrendsScore) {
      score += (this.googleTrendsScore / 100) * 30;
    }

    // Search Volume weight: 25%
    if (this.amazonSearchVolume) {
      const volumeScore = Math.min(this.amazonSearchVolume / 10000, 1); // Normalize to 0-1
      score += volumeScore * 25;
    }

    // Trending Direction weight: 20%
    if (this.trendingDirection === 'up') {
      score += 20;
    } else if (this.trendingDirection === 'stable') {
      score += 10;
    }

    // Competition Level weight: 25% (inverse - lower competition = higher score)
    if (this.competitionLevel) {
      const competitionScore = this.competitionLevel === 'low' ? 25 : 
                              this.competitionLevel === 'medium' ? 15 : 5;
      score += competitionScore;
    }

    return Math.round(Math.min(score, 100));
  }

  updateOpportunityScore(): void {
    this.opportunityScore = this.calculateOpportunityScore();
  }

  getDetailedInsights(): {
    trend: string;
    opportunity: string;
    competition: string;
    seasonality: string;
    recommendations: string[];
  } {
    const insights = {
      trend: this.getTrendInsight(),
      opportunity: this.getOpportunityInsight(),
      competition: this.getCompetitionInsight(),
      seasonality: this.getSeasonalityInsight(),
      recommendations: this.getRecommendations(),
    };

    return insights;
  }

  private getTrendInsight(): string {
    const strength = this.trendStrength;
    const direction = this.trendingDirection || 'unknown';
    
    return `${strength.charAt(0).toUpperCase() + strength.slice(1)} ${direction} trend`;
  }

  private getOpportunityInsight(): string {
    const score = this.opportunityScore || 0;
    
    if (score >= 80) return 'Excellent opportunity';
    if (score >= 60) return 'Good opportunity';
    if (score >= 40) return 'Moderate opportunity';
    return 'Limited opportunity';
  }

  private getCompetitionInsight(): string {
    return `${this.competitionLevel || 'unknown'} competition level`;
  }

  private getSeasonalityInsight(): string {
    if (this.isSeasonal) {
      const peakMonths = this.trendData?.peakMonths || [];
      return `Seasonal trend with peaks in ${peakMonths.join(', ')}`;
    }
    return 'Non-seasonal trend';
  }

  private getRecommendations(): string[] {
    const recommendations: string[] = [];

    if (this.opportunityScore && this.opportunityScore >= 70) {
      recommendations.push('Strong market opportunity - consider investment');
    }

    if (this.competitionLevel === 'low') {
      recommendations.push('Low competition - good entry point');
    } else if (this.competitionLevel === 'high') {
      recommendations.push('High competition - requires differentiation strategy');
    }

    if (this.trendingDirection === 'up') {
      recommendations.push('Upward trend - favorable market conditions');
    } else if (this.trendingDirection === 'down') {
      recommendations.push('Downward trend - proceed with caution');
    }

    if (this.isSeasonal && this.trendData?.peakMonths) {
      recommendations.push(`Plan inventory for peak months: ${this.trendData.peakMonths.join(', ')}`);
    }

    return recommendations;
  }

  static createAnalysis(
    keyword: string,
    categoryId?: string,
    analyzedDate: Date = new Date()
  ): TrendAnalysis {
    const analysis = new TrendAnalysis();
    analysis.keyword = keyword;
    analysis.categoryId = categoryId;
    analysis.analyzedDate = analyzedDate;
    return analysis;
  }
}