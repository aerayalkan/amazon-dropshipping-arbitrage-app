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

@Entity('categories')
@Index(['name'])
@Index(['amazonCategoryId'])
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  amazonCategoryId?: string;

  @Column('uuid', { nullable: true })
  parentId?: string;

  @Column('int', { default: 0 })
  level: number;

  @Column({ default: true })
  isActive: boolean;

  // Analysis fields
  @Column('int', { default: 0 })
  productCount: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  avgPrice?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  avgRating?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  competitionLevel?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  profitabilityScore?: number;

  @Column('decimal', { precision: 5, scale: 2, nullable: true })
  trendScore?: number;

  @Column('text', { array: true, default: [] })
  topKeywords: string[];

  @Column('text', { array: true, default: [] })
  topBrands: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'parentId' })
  parent?: Category;

  @OneToMany(() => Category, category => category.parent)
  children: Category[];

  // Virtual properties
  get breadcrumb(): string {
    const buildPath = (cat: Category, path: string[] = []): string[] => {
      path.unshift(cat.name);
      return cat.parent ? buildPath(cat.parent, path) : path;
    };

    return buildPath(this).join(' > ');
  }

  get isTopLevel(): boolean {
    return this.level === 0 && !this.parentId;
  }

  get hasChildren(): boolean {
    return this.children && this.children.length > 0;
  }

  // Methods
  updateStats(stats: {
    productCount?: number;
    avgPrice?: number;
    avgRating?: number;
    competitionLevel?: number;
    profitabilityScore?: number;
    trendScore?: number;
    topKeywords?: string[];
    topBrands?: string[];
  }): void {
    Object.assign(this, stats);
  }

  getCompetitionLevelText(): string {
    if (!this.competitionLevel) return 'Unknown';
    if (this.competitionLevel <= 30) return 'Low';
    if (this.competitionLevel <= 70) return 'Medium';
    return 'High';
  }

  getProfitabilityText(): string {
    if (!this.profitabilityScore) return 'Unknown';
    if (this.profitabilityScore >= 80) return 'Excellent';
    if (this.profitabilityScore >= 60) return 'Good';
    if (this.profitabilityScore >= 40) return 'Fair';
    return 'Poor';
  }
}