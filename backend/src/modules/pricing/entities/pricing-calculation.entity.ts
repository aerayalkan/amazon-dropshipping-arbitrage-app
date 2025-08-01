import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';

export enum CalculationType {
  PRODUCT_ANALYSIS = 'product_analysis',
  BULK_ANALYSIS = 'bulk_analysis',
  WHAT_IF_ANALYSIS = 'what_if_analysis',
  COMPETITIVE_ANALYSIS = 'competitive_analysis',
  SCENARIO_ANALYSIS = 'scenario_analysis',
}

export enum MarketplaceType {
  AMAZON_US = 'amazon_us',
  AMAZON_UK = 'amazon_uk',
  AMAZON_DE = 'amazon_de',
  AMAZON_FR = 'amazon_fr',
  AMAZON_IT = 'amazon_it',
  AMAZON_ES = 'amazon_es',
  AMAZON_TR = 'amazon_tr',
}

export enum FulfillmentMethod {
  FBA = 'fba',
  FBM = 'fbm',
  SFP = 'sfp', // Seller Fulfilled Prime
}

@Entity('pricing_calculations')
@Index(['userId', 'createdAt'])
@Index(['productId'])
@Index(['calculationType'])
@Index(['marketplaceType'])
export class PricingCalculation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'product_id', nullable: true })
  productId?: string; // InventoryItem ID veya ASIN

  @Column({ nullable: true })
  asin?: string;

  @Column({ name: 'product_name' })
  productName: string;

  @Column({
    type: 'enum',
    enum: CalculationType,
    name: 'calculation_type',
  })
  calculationType: CalculationType;

  @Column({
    type: 'enum',
    enum: MarketplaceType,
    name: 'marketplace_type',
  })
  marketplaceType: MarketplaceType;

  @Column({
    type: 'enum',
    enum: FulfillmentMethod,
    name: 'fulfillment_method',
  })
  fulfillmentMethod: FulfillmentMethod;

  // Input Parameters
  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 2 })
  costPrice: number;

  @Column({ name: 'selling_price', type: 'decimal', precision: 10, scale: 2 })
  sellingPrice: number;

  @Column({ name: 'shipping_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  shippingCost: number;

  @Column({ name: 'product_weight', type: 'decimal', precision: 8, scale: 3, nullable: true })
  productWeight?: number; // kg

  @Column({ type: 'json', nullable: true })
  productDimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'inch';
  };

  @Column({ name: 'product_category' })
  productCategory: string;

  @Column({ name: 'currency_code', length: 3, default: 'USD' })
  currencyCode: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 10, scale: 4, default: 1 })
  exchangeRate: number;

  // Amazon Fees Breakdown
  @Column({ type: 'json' })
  amazonFees: {
    referralFee: {
      percentage: number;
      amount: number;
    };
    fulfillmentFee?: {
      pickPackFee: number;
      weightHandlingFee: number;
      storageFeeMontly?: number;
      longTermStorageFee?: number;
    };
    closingFee?: number;
    variableClosingFee?: number;
    returnProcessingFee?: number;
    refundAdministrationFee?: number;
    disposalFee?: number;
    removalFee?: number;
    totalFees: number;
  };

  // Tax Calculations
  @Column({ type: 'json', nullable: true })
  taxCalculations?: {
    vatRate?: number;
    vatAmount?: number;
    salesTaxRate?: number;
    salesTaxAmount?: number;
    incomeTaxRate?: number;
    incomeTaxAmount?: number;
    customsDuty?: number;
    totalTaxes: number;
  };

  // Additional Costs
  @Column({ type: 'json', nullable: true })
  additionalCosts?: {
    advertisingCost?: number;
    storageRent?: number;
    insuranceCost?: number;
    handlingFee?: number;
    packagingCost?: number;
    otherFees?: Array<{
      name: string;
      amount: number;
      description?: string;
    }>;
    totalAdditionalCosts: number;
  };

  // Profit Calculations  
  @Column({ type: 'json' })
  profitAnalysis: {
    grossProfit: number;
    netProfit: number;
    grossMargin: number; // percentage
    netMargin: number; // percentage
    roi: number; // percentage
    roiAnnualized?: number; // percentage
    breakEvenPrice: number;
    profitPerUnit: number;
    totalRevenue: number;
    totalCosts: number;
  };

  // Competitive Analysis
  @Column({ type: 'json', nullable: true })
  competitiveAnalysis?: {
    lowestCompetitorPrice: number;
    averageMarketPrice: number;
    medianMarketPrice: number;
    pricePosition: 'lowest' | 'below_average' | 'average' | 'above_average' | 'highest';
    competitorCount: number;
    marketShare?: number;
    priceGap: number; // Difference with lowest competitor
  };

  // Scenario Analysis
  @Column({ type: 'json', nullable: true })
  scenarioAnalysis?: {
    optimisticScenario?: {
      sellingPrice: number;
      expectedProfit: number;
      probability: number;
    };
    realisticScenario?: {
      sellingPrice: number;
      expectedProfit: number;
      probability: number;
    };
    pessimisticScenario?: {
      sellingPrice: number;
      expectedProfit: number;
      probability: number;
    };
    recommendedAction: 'proceed' | 'adjust_price' | 'find_better_supplier' | 'avoid';
  };

  // Performance Tracking
  @Column({ name: 'calculation_duration_ms', type: 'int', nullable: true })
  calculationDurationMs?: number;

  @Column({ name: 'data_sources', type: 'json', nullable: true })
  dataSources?: {
    priceData: 'api' | 'scraping' | 'manual';
    feeData: 'amazon_api' | 'calculator' | 'estimate';
    currencyData: 'live_rate' | 'cached_rate' | 'manual';
    competitorData?: 'scraping' | 'api' | 'manual';
    lastUpdated: Date;
  };

  @Column({ name: 'is_bookmarked', default: false })
  isBookmarked: boolean;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'json', nullable: true })
  tags?: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isProfitable(): boolean {
    return this.profitAnalysis.netProfit > 0;
  }

  isHighMargin(): boolean {
    return this.profitAnalysis.netMargin >= 15; // 15% net margin threshold
  }

  getMarginCategory(): 'high' | 'medium' | 'low' | 'loss' {
    const margin = this.profitAnalysis.netMargin;
    
    if (margin < 0) return 'loss';
    if (margin < 5) return 'low';
    if (margin < 15) return 'medium';
    return 'high';
  }

  getRoiCategory(): 'excellent' | 'good' | 'fair' | 'poor' {
    const roi = this.profitAnalysis.roi;
    
    if (roi >= 50) return 'excellent';
    if (roi >= 25) return 'good';
    if (roi >= 10) return 'fair';
    return 'poor';
  }

  getCompetitivePosition(): 'very_competitive' | 'competitive' | 'average' | 'expensive' | 'premium' {
    if (!this.competitiveAnalysis) return 'average';
    
    const position = this.competitiveAnalysis.pricePosition;
    
    switch (position) {
      case 'lowest': return 'very_competitive';
      case 'below_average': return 'competitive';
      case 'average': return 'average';
      case 'above_average': return 'expensive';
      case 'highest': return 'premium';
      default: return 'average';
    }
  }

  calculatePriceElasticity(): number | null {
    if (!this.competitiveAnalysis) return null;
    
    const avgPrice = this.competitiveAnalysis.averageMarketPrice;
    const ourPrice = this.sellingPrice;
    
    return avgPrice > 0 ? ((ourPrice - avgPrice) / avgPrice) * 100 : 0;
  }

  getRecommendedActions(): string[] {
    const actions: string[] = [];
    const margin = this.profitAnalysis.netMargin;
    const roi = this.profitAnalysis.roi;

    // Profitability recommendations
    if (margin < 0) {
      actions.push('Zarar ediyor - fiyat artırın veya maliyet düşürün');
    } else if (margin < 5) {
      actions.push('Düşük marj - maliyet optimizasyonu yapın');
    }

    // ROI recommendations
    if (roi < 10) {
      actions.push('Düşük ROI - daha karlı ürünler araştırın');
    }

    // Competitive recommendations
    if (this.competitiveAnalysis) {
      const position = this.competitiveAnalysis.pricePosition;
      
      if (position === 'highest') {
        actions.push('En yüksek fiyat - rekabet gücünü değerlendirin');
      } else if (position === 'lowest') {
        actions.push('En düşük fiyat - marj artırma potansiyeli var');
      }
    }

    return actions.length > 0 ? actions : ['Mevcut hesaplama optimal görünüyor'];
  }

  exportSummary(): {
    product: string;
    costPrice: number;
    sellingPrice: number;
    totalFees: number;
    netProfit: number;
    netMargin: number;
    roi: number;
    recommendation: string;
  } {
    return {
      product: this.productName,
      costPrice: this.costPrice,
      sellingPrice: this.sellingPrice,
      totalFees: this.amazonFees.totalFees + (this.taxCalculations?.totalTaxes || 0) + (this.additionalCosts?.totalAdditionalCosts || 0),
      netProfit: this.profitAnalysis.netProfit,
      netMargin: this.profitAnalysis.netMargin,
      roi: this.profitAnalysis.roi,
      recommendation: this.getRecommendedActions()[0] || 'No recommendation',
    };
  }

  // Static factory methods
  static createBasicCalculation(data: {
    userId: string;
    productName: string;
    costPrice: number;
    sellingPrice: number;
    marketplace?: MarketplaceType;
    fulfillmentMethod?: FulfillmentMethod;
    productCategory?: string;
  }): Partial<PricingCalculation> {
    return {
      userId: data.userId,
      productName: data.productName,
      costPrice: data.costPrice,
      sellingPrice: data.sellingPrice,
      calculationType: CalculationType.PRODUCT_ANALYSIS,
      marketplaceType: data.marketplace || MarketplaceType.AMAZON_US,
      fulfillmentMethod: data.fulfillmentMethod || FulfillmentMethod.FBA,
      productCategory: data.productCategory || 'General',
      currencyCode: 'USD',
      exchangeRate: 1,
      shippingCost: 0,
      isBookmarked: false,
    };
  }

  static createWhatIfAnalysis(baseCalculation: PricingCalculation, modifications: {
    newSellingPrice?: number;
    newCostPrice?: number;
    newShippingCost?: number;
    newFulfillmentMethod?: FulfillmentMethod;
  }): Partial<PricingCalculation> {
    return {
      ...baseCalculation,
      id: undefined, // New calculation
      calculationType: CalculationType.WHAT_IF_ANALYSIS,
      sellingPrice: modifications.newSellingPrice || baseCalculation.sellingPrice,
      costPrice: modifications.newCostPrice || baseCalculation.costPrice,
      shippingCost: modifications.newShippingCost || baseCalculation.shippingCost,
      fulfillmentMethod: modifications.newFulfillmentMethod || baseCalculation.fulfillmentMethod,
      createdAt: undefined,
      updatedAt: undefined,
    };
  }
}