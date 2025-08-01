import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { MarketplaceType } from './pricing-calculation.entity';

export enum TaxType {
  SALES_TAX = 'sales_tax',
  VAT = 'vat',
  INCOME_TAX = 'income_tax',
  CUSTOMS_DUTY = 'customs_duty',
  EXCISE_TAX = 'excise_tax',
  IMPORT_TAX = 'import_tax',
  EXPORT_TAX = 'export_tax',
  WITHHOLDING_TAX = 'withholding_tax',
}

export enum TaxCalculationMethod {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  TIERED = 'tiered',
  PROGRESSIVE = 'progressive',
  COMPOUND = 'compound',
}

export enum TaxJurisdiction {
  FEDERAL = 'federal',
  STATE = 'state',
  COUNTY = 'county',
  CITY = 'city',
  EU = 'eu',
  INTERNATIONAL = 'international',
}

@Entity('tax_configurations')
@Index(['userId', 'marketplaceType'])
@Index(['taxType', 'jurisdiction'])
@Index(['isActive'])
@Index(['effectiveDate'])
export class TaxConfiguration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'configuration_name' })
  configurationName: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: MarketplaceType,
    name: 'marketplace_type',
  })
  marketplaceType: MarketplaceType;

  @Column({
    type: 'enum',
    enum: TaxType,
    name: 'tax_type',
  })
  taxType: TaxType;

  @Column({
    type: 'enum',
    enum: TaxJurisdiction,
  })
  jurisdiction: TaxJurisdiction;

  @Column({ name: 'jurisdiction_name' })
  jurisdictionName: string; // e.g., "California", "Germany", "New York City"

  @Column({ name: 'tax_code', nullable: true })
  taxCode?: string; // Official tax code or identifier

  // Tax calculation structure
  @Column({
    type: 'enum',
    enum: TaxCalculationMethod,
    name: 'calculation_method',
  })
  calculationMethod: TaxCalculationMethod;

  @Column({ type: 'json' })
  rateStructure: {
    percentage?: number;
    fixedAmount?: number;
    tiers?: Array<{
      minAmount: number;
      maxAmount?: number;
      rate: number;
      fixedAmount?: number;
    }>;
    progressiveRates?: Array<{
      minIncome: number;
      maxIncome?: number;
      rate: number;
      baseAmount?: number;
    }>;
  };

  // Applicability rules
  @Column({ type: 'json' })
  applicabilityRules: {
    productCategories?: string[]; // Which product categories this tax applies to
    priceThresholds?: {
      minimum?: number;
      maximum?: number;
    };
    businessTypes?: Array<'individual' | 'professional' | 'corporation' | 'non_profit'>;
    customerTypes?: Array<'b2b' | 'b2c' | 'government' | 'reseller'>;
    fulfillmentMethods?: Array<'fba' | 'fbm' | 'sfp'>;
    exemptions?: Array<{
      condition: string;
      description: string;
      documentRequired?: string;
    }>;
  };

  // Geographic scope
  @Column({ type: 'json', nullable: true })
  geographicScope?: {
    countries?: string[];
    states?: string[];
    cities?: string[];
    postalCodes?: string[];
    excludedAreas?: string[];
  };

  // Filing and compliance requirements
  @Column({ type: 'json', nullable: true })
  complianceRequirements?: {
    filingFrequency: 'monthly' | 'quarterly' | 'annually' | 'on_transaction';
    reportingDeadline?: string; // e.g., "15th of following month"
    minimumThresholdForFiling?: number;
    requiredDocuments?: string[];
    penaltyForLatePayment?: {
      type: 'percentage' | 'fixed';
      amount: number;
      gracePeriodDays?: number;
    };
    registrationRequired?: boolean;
    taxIdRequired?: boolean;
  };

  // Special rules and conditions
  @Column({ type: 'json', nullable: true })
  specialRules?: Array<{
    ruleName: string;
    condition: string;
    taxModification: {
      type: 'multiply' | 'add' | 'subtract' | 'override';
      value: number;
    };
    description: string;
  }>;

  // Currency and localization
  @Column({ name: 'currency_code', length: 3 })
  currencyCode: string;

  @Column({ name: 'decimal_places', default: 2 })
  decimalPlaces: number;

  @Column({ name: 'rounding_method', default: 'round' })
  roundingMethod: 'round' | 'floor' | 'ceil';

  // Validity period
  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Versioning and updates
  @Column({ name: 'version', default: 1 })
  version: number;

  @Column({ name: 'source', default: 'manual' })
  source: 'manual' | 'api' | 'government_feed' | 'third_party';

  @Column({ name: 'last_verified', type: 'timestamp', nullable: true })
  lastVerified?: Date;

  @Column({ name: 'verification_source', nullable: true })
  verificationSource?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  isApplicableToProduct(productCategory: string, price: number, fulfillmentMethod: string): boolean {
    // Check product category
    if (this.applicabilityRules.productCategories && 
        !this.applicabilityRules.productCategories.includes(productCategory)) {
      return false;
    }

    // Check price thresholds
    if (this.applicabilityRules.priceThresholds) {
      const { minimum, maximum } = this.applicabilityRules.priceThresholds;
      if (minimum && price < minimum) return false;
      if (maximum && price > maximum) return false;
    }

    // Check fulfillment method
    if (this.applicabilityRules.fulfillmentMethods && 
        !this.applicabilityRules.fulfillmentMethods.includes(fulfillmentMethod as any)) {
      return false;
    }

    return true;
  }

  calculateTax(amount: number, context?: {
    productCategory?: string;
    customerType?: string;
    businessType?: string;
    isExempt?: boolean;
  }): {
    taxAmount: number;
    effectiveRate: number;
    breakdown?: any;
    applicableRules?: string[];
  } {
    if (context?.isExempt) {
      return { taxAmount: 0, effectiveRate: 0 };
    }

    let taxAmount = 0;
    let breakdown: any = {};
    const applicableRules: string[] = [];

    switch (this.calculationMethod) {
      case TaxCalculationMethod.PERCENTAGE:
        if (this.rateStructure.percentage) {
          taxAmount = (amount * this.rateStructure.percentage) / 100;
          breakdown.baseRate = this.rateStructure.percentage;
        }
        break;

      case TaxCalculationMethod.FIXED_AMOUNT:
        if (this.rateStructure.fixedAmount) {
          taxAmount = this.rateStructure.fixedAmount;
          breakdown.fixedAmount = this.rateStructure.fixedAmount;
        }
        break;

      case TaxCalculationMethod.TIERED:
        if (this.rateStructure.tiers) {
          for (const tier of this.rateStructure.tiers) {
            if (amount >= tier.minAmount && 
                (tier.maxAmount === undefined || amount <= tier.maxAmount)) {
              taxAmount = (amount * tier.rate) / 100;
              if (tier.fixedAmount) {
                taxAmount += tier.fixedAmount;
              }
              breakdown.appliedTier = tier;
              break;
            }
          }
        }
        break;

      case TaxCalculationMethod.PROGRESSIVE:
        if (this.rateStructure.progressiveRates) {
          for (const rate of this.rateStructure.progressiveRates) {
            if (amount > rate.minIncome) {
              const taxableInThisBracket = Math.min(
                amount - rate.minIncome,
                (rate.maxIncome || Infinity) - rate.minIncome
              );
              
              if (taxableInThisBracket > 0) {
                taxAmount += (taxableInThisBracket * rate.rate) / 100;
                breakdown[`bracket_${rate.rate}%`] = taxableInThisBracket * rate.rate / 100;
              }
            }
          }
        }
        break;
    }

    // Apply special rules
    if (this.specialRules) {
      for (const rule of this.specialRules) {
        // Simple rule evaluation - in production, this would be more sophisticated
        if (this.evaluateRuleCondition(rule.condition, amount, context)) {
          switch (rule.taxModification.type) {
            case 'multiply':
              taxAmount *= rule.taxModification.value;
              break;
            case 'add':
              taxAmount += rule.taxModification.value;
              break;
            case 'subtract':
              taxAmount -= rule.taxModification.value;
              break;
            case 'override':
              taxAmount = rule.taxModification.value;
              break;
          }
          applicableRules.push(rule.ruleName);
        }
      }
    }

    // Apply rounding
    taxAmount = this.applyRounding(taxAmount);

    const effectiveRate = amount > 0 ? (taxAmount / amount) * 100 : 0;

    return {
      taxAmount: Math.max(0, taxAmount), // Ensure non-negative
      effectiveRate,
      breakdown,
      applicableRules,
    };
  }

  private evaluateRuleCondition(condition: string, amount: number, context?: any): boolean {
    // Simplified rule evaluation - in production, use a proper rule engine
    if (condition.includes('amount >')) {
      const threshold = parseFloat(condition.split('amount >')[1].trim());
      return amount > threshold;
    }
    
    if (condition.includes('amount <')) {
      const threshold = parseFloat(condition.split('amount <')[1].trim());
      return amount < threshold;
    }

    if (condition.includes('category =')) {
      const category = condition.split('category =')[1].trim().replace(/['"]/g, '');
      return context?.productCategory === category;
    }

    return false;
  }

  private applyRounding(amount: number): number {
    const factor = Math.pow(10, this.decimalPlaces);
    
    switch (this.roundingMethod) {
      case 'floor':
        return Math.floor(amount * factor) / factor;
      case 'ceil':
        return Math.ceil(amount * factor) / factor;
      case 'round':
      default:
        return Math.round(amount * factor) / factor;
    }
  }

  isCurrentlyValid(): boolean {
    const now = new Date();
    const isAfterStart = now >= this.effectiveDate;
    const isBeforeEnd = !this.expiryDate || now <= this.expiryDate;
    
    return this.isActive && isAfterStart && isBeforeEnd;
  }

  needsUpdate(): boolean {
    if (!this.lastVerified) return true;
    
    const daysSinceVerification = (Date.now() - this.lastVerified.getTime()) / (1000 * 60 * 60 * 24);
    
    // Suggest update if not verified in last 90 days
    return daysSinceVerification > 90;
  }

  getComplianceStatus(): {
    status: 'compliant' | 'warning' | 'non_compliant';
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check if configuration is up to date
    if (this.needsUpdate()) {
      issues.push('Tax configuration has not been verified recently');
      recommendations.push('Verify tax rates with local authorities');
    }

    // Check if effective date is appropriate
    if (this.effectiveDate > new Date()) {
      issues.push('Tax configuration is not yet effective');
    }

    // Check if expired
    if (this.expiryDate && this.expiryDate < new Date()) {
      issues.push('Tax configuration has expired');
      recommendations.push('Update tax configuration with current rates');
    }

    // Check for missing compliance requirements
    if (!this.complianceRequirements && this.taxType !== TaxType.CUSTOMS_DUTY) {
      issues.push('Missing compliance requirements');
      recommendations.push('Define filing and reporting requirements');
    }

    const status = issues.length === 0 ? 'compliant' : 
                  issues.length <= 2 ? 'warning' : 'non_compliant';

    return { status, issues, recommendations };
  }

  // Static factory methods
  static createUSASalesTaxConfig(data: {
    userId: string;
    stateName: string;
    stateRate: number;
    cityName?: string;
    cityRate?: number;
  }): Partial<TaxConfiguration> {
    return {
      userId: data.userId,
      configurationName: `${data.stateName} Sales Tax`,
      marketplaceType: MarketplaceType.AMAZON_US,
      taxType: TaxType.SALES_TAX,
      jurisdiction: TaxJurisdiction.STATE,
      jurisdictionName: data.stateName,
      calculationMethod: TaxCalculationMethod.PERCENTAGE,
      rateStructure: {
        percentage: data.stateRate + (data.cityRate || 0),
      },
      applicabilityRules: {
        fulfillmentMethods: ['fba', 'fbm'],
        businessTypes: ['individual', 'professional', 'corporation'],
        customerTypes: ['b2c'],
      },
      geographicScope: {
        states: [data.stateName],
        cities: data.cityName ? [data.cityName] : undefined,
      },
      currencyCode: 'USD',
      effectiveDate: new Date(),
      isActive: true,
      source: 'manual',
    };
  }

  static createEUVATConfig(data: {
    userId: string;
    countryName: string;
    standardRate: number;
    reducedRate?: number;
  }): Partial<TaxConfiguration> {
    const tiers = [
      {
        minAmount: 0,
        maxAmount: 10000, // Standard rate threshold
        rate: data.standardRate,
      }
    ];

    if (data.reducedRate) {
      tiers.unshift({
        minAmount: 0,
        maxAmount: 1000, // Reduced rate for essential goods
        rate: data.reducedRate,
      });
    }

    return {
      userId: data.userId,
      configurationName: `${data.countryName} VAT`,
      marketplaceType: MarketplaceType.AMAZON_DE, // Default to DE, adjust as needed
      taxType: TaxType.VAT,
      jurisdiction: TaxJurisdiction.EU,
      jurisdictionName: data.countryName,
      calculationMethod: TaxCalculationMethod.TIERED,
      rateStructure: { tiers },
      applicabilityRules: {
        fulfillmentMethods: ['fba', 'fbm'],
        businessTypes: ['individual', 'professional', 'corporation'],
        customerTypes: ['b2c', 'b2b'],
      },
      geographicScope: {
        countries: [data.countryName],
      },
      complianceRequirements: {
        filingFrequency: 'quarterly',
        reportingDeadline: '20th of following month',
        minimumThresholdForFiling: 0,
        registrationRequired: true,
        taxIdRequired: true,
      },
      currencyCode: 'EUR',
      effectiveDate: new Date(),
      isActive: true,
      source: 'manual',
    };
  }
}