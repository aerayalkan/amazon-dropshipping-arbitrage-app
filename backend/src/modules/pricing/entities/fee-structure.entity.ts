import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

import { MarketplaceType, FulfillmentMethod } from './pricing-calculation.entity';

export enum FeeType {
  REFERRAL_FEE = 'referral_fee',
  FULFILLMENT_FEE = 'fulfillment_fee',
  STORAGE_FEE = 'storage_fee',
  CLOSING_FEE = 'closing_fee',
  RETURN_PROCESSING_FEE = 'return_processing_fee',
  DISPOSAL_FEE = 'disposal_fee',
  REMOVAL_FEE = 'removal_fee',
  ADVERTISING_FEE = 'advertising_fee',
  SUBSCRIPTION_FEE = 'subscription_fee',
}

export enum WeightTier {
  STANDARD_0_TO_1_LB = 'standard_0_to_1_lb',
  STANDARD_1_TO_2_LB = 'standard_1_to_2_lb',
  STANDARD_2_TO_3_LB = 'standard_2_to_3_lb',
  STANDARD_OVER_3_LB = 'standard_over_3_lb',
  OVERSIZED_SMALL = 'oversized_small',
  OVERSIZED_MEDIUM = 'oversized_medium',
  OVERSIZED_LARGE = 'oversized_large',
  OVERSIZED_SPECIAL = 'oversized_special',
}

export enum SizeTier {
  SMALL_STANDARD = 'small_standard',
  LARGE_STANDARD = 'large_standard',
  SMALL_OVERSIZED = 'small_oversized',
  MEDIUM_OVERSIZED = 'medium_oversized',
  LARGE_OVERSIZED = 'large_oversized',
  SPECIAL_OVERSIZED = 'special_oversized',
}

@Entity('fee_structures')
@Index(['marketplaceType', 'category'])
@Index(['fulfillmentMethod'])
@Index(['isActive'])
@Index(['effectiveDate'])
export class FeeStructure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: MarketplaceType,
    name: 'marketplace_type',
  })
  marketplaceType: MarketplaceType;

  @Column()
  category: string;

  @Column({ name: 'sub_category', nullable: true })
  subCategory?: string;

  @Column({
    type: 'enum',
    enum: FulfillmentMethod,
    name: 'fulfillment_method',
  })
  fulfillmentMethod: FulfillmentMethod;

  // Referral Fee Structure
  @Column({ type: 'json' })
  referralFeeStructure: {
    type: 'percentage' | 'tiered' | 'fixed';
    minimumFee?: number;
    maximumFee?: number;
    percentage?: number;
    tiers?: Array<{
      minAmount: number;
      maxAmount?: number;
      percentage: number;
      fixedAmount?: number;
    }>;
    specialRules?: Array<{
      condition: string;
      fee: number;
      description: string;
    }>;
  };

  // FBA Fulfillment Fee Structure
  @Column({ type: 'json', nullable: true })
  fulfillmentFeeStructure?: {
    pickAndPackFee: {
      [key in SizeTier]?: number;
    };
    weightHandlingFee?: {
      [key in WeightTier]?: {
        baseWeight: number;
        baseFee: number;
        additionalWeightFee: number; // per lb/kg
      };
    };
    dimensionalWeight?: {
      formula: string; // "(L × W × H) / divisor"
      divisor: number;
      unit: 'inch' | 'cm';
    };
    sizeClassification: {
      small_standard: {
        maxLength: number;
        maxWidth: number;
        maxHeight: number;
        maxWeight: number;
        unit: 'inch' | 'cm';
      };
      large_standard: {
        maxLength: number;
        maxWidth: number;
        maxHeight: number;
        maxWeight: number;
        unit: 'inch' | 'cm';
      };
      oversized: {
        small: { maxWeight: number; maxLength: number };
        medium: { maxWeight: number; maxLength: number };
        large: { maxWeight: number; maxLength: number };
        special: { description: string };
      };
    };
  };

  // Storage Fee Structure
  @Column({ type: 'json', nullable: true })
  storageFeeStructure?: {
    monthly: {
      standardSize: {
        janToSep: number; // per cubic foot
        octToDec: number; // per cubic foot
      };
      oversized: {
        janToSep: number;
        octToDec: number;
      };
    };
    longTermStorage: {
      thresholdDays: number; // typically 365 days
      standardSize: number; // per cubic foot
      oversized: number;
    };
    removalFee?: {
      standardSize: number;
      oversized: number;
    };
    disposalFee?: {
      standardSize: number;
      oversized: number;
    };
  };

  // Other Fees
  @Column({ type: 'json', nullable: true })
  otherFees?: {
    closingFee?: number;
    returnProcessingFee?: {
      percentage?: number;
      fixedAmount?: number;
      minimumFee?: number;
    };
    refundAdministrationFee?: {
      percentage?: number;
      minimumFee?: number;
      maximumFee?: number;
    };
    highVolumeListingFee?: {
      thresholdQuantity: number;
      feePerItem: number;
    };
    subscriptionFee?: {
      individual: number; // per item sold
      professional: number; // monthly fee
    };
  };

  // Special Category Rules
  @Column({ type: 'json', nullable: true })
  specialRules?: Array<{
    ruleType: 'category_specific' | 'brand_specific' | 'price_specific' | 'weight_specific';
    conditions: any;
    feeAdjustments: any;
    description: string;
  }>;

  // Currency and Localization
  @Column({ name: 'currency_code', length: 3 })
  currencyCode: string;

  @Column({ name: 'country_code', length: 2 })
  countryCode: string;

  // Validity
  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'version', default: 1 })
  version: number;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Business Logic Methods
  calculateReferralFee(sellingPrice: number): number {
    const structure = this.referralFeeStructure;

    if (structure.type === 'percentage') {
      let fee = (sellingPrice * (structure.percentage || 0)) / 100;
      
      if (structure.minimumFee) {
        fee = Math.max(fee, structure.minimumFee);
      }
      
      if (structure.maximumFee) {
        fee = Math.min(fee, structure.maximumFee);
      }
      
      return Math.round(fee * 100) / 100; // Round to 2 decimal places
    }

    if (structure.type === 'tiered' && structure.tiers) {
      for (const tier of structure.tiers) {
        const isInRange = sellingPrice >= tier.minAmount && 
          (tier.maxAmount === undefined || sellingPrice <= tier.maxAmount);
        
        if (isInRange) {
          let fee = (sellingPrice * tier.percentage) / 100;
          
          if (tier.fixedAmount) {
            fee += tier.fixedAmount;
          }
          
          return Math.round(fee * 100) / 100;
        }
      }
    }

    return 0;
  }

  calculateFulfillmentFee(dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
    unit: 'inch' | 'cm';
  }): { pickPackFee: number; weightHandlingFee: number; totalFee: number } {
    if (!this.fulfillmentFeeStructure) {
      return { pickPackFee: 0, weightHandlingFee: 0, totalFee: 0 };
    }

    // Determine size tier
    const sizeTier = this.determineSizeTier(dimensions);
    
    // Calculate pick and pack fee
    const pickPackFee = this.fulfillmentFeeStructure.pickAndPackFee[sizeTier] || 0;
    
    // Calculate weight handling fee
    const weightTier = this.determineWeightTier(dimensions.weight, sizeTier);
    let weightHandlingFee = 0;

    if (this.fulfillmentFeeStructure.weightHandlingFee?.[weightTier]) {
      const weightStructure = this.fulfillmentFeeStructure.weightHandlingFee[weightTier];
      weightHandlingFee = weightStructure.baseFee;
      
      if (dimensions.weight > weightStructure.baseWeight) {
        const additionalWeight = dimensions.weight - weightStructure.baseWeight;
        weightHandlingFee += additionalWeight * weightStructure.additionalWeightFee;
      }
    }

    const totalFee = pickPackFee + weightHandlingFee;

    return {
      pickPackFee: Math.round(pickPackFee * 100) / 100,
      weightHandlingFee: Math.round(weightHandlingFee * 100) / 100,
      totalFee: Math.round(totalFee * 100) / 100,
    };
  }

  calculateStorageFee(
    dimensions: { length: number; width: number; height: number; unit: 'inch' | 'cm' },
    storageDuration: number, // days
    currentMonth: number // 1-12
  ): { monthlyFee: number; longTermFee: number; totalFee: number } {
    if (!this.storageFeeStructure) {
      return { monthlyFee: 0, longTermFee: 0, totalFee: 0 };
    }

    // Calculate cubic volume
    let cubicFeet = (dimensions.length * dimensions.width * dimensions.height);
    if (dimensions.unit === 'cm') {
      cubicFeet = cubicFeet / 28316.8; // Convert cm³ to ft³
    } else {
      cubicFeet = cubicFeet / 1728; // Convert in³ to ft³
    }

    // Determine if oversized
    const sizeTier = this.determineSizeTier({
      ...dimensions,
      weight: 0, // Weight not needed for this calculation
    });
    const isOversized = sizeTier.includes('oversized');

    // Calculate monthly storage fee
    const isHighSeason = currentMonth >= 10 && currentMonth <= 12; // Oct-Dec
    const monthlyRate = isOversized 
      ? (isHighSeason ? this.storageFeeStructure.monthly.oversized.octToDec : this.storageFeeStructure.monthly.oversized.janToSep)
      : (isHighSeason ? this.storageFeeStructure.monthly.standardSize.octToDec : this.storageFeeStructure.monthly.standardSize.janToSep);
    
    const monthlyFee = cubicFeet * monthlyRate;

    // Calculate long-term storage fee
    let longTermFee = 0;
    if (storageDuration > this.storageFeeStructure.longTermStorage.thresholdDays) {
      const longTermRate = isOversized 
        ? this.storageFeeStructure.longTermStorage.oversized
        : this.storageFeeStructure.longTermStorage.standardSize;
      
      longTermFee = cubicFeet * longTermRate;
    }

    const totalFee = monthlyFee + longTermFee;

    return {
      monthlyFee: Math.round(monthlyFee * 100) / 100,
      longTermFee: Math.round(longTermFee * 100) / 100,
      totalFee: Math.round(totalFee * 100) / 100,
    };
  }

  private determineSizeTier(dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
    unit: 'inch' | 'cm';
  }): SizeTier {
    if (!this.fulfillmentFeeStructure?.sizeClassification) {
      return SizeTier.SMALL_STANDARD;
    }

    const classification = this.fulfillmentFeeStructure.sizeClassification;
    
    // Convert dimensions to inches if needed
    let length = dimensions.length;
    let width = dimensions.width;
    let height = dimensions.height;
    let weight = dimensions.weight;

    if (dimensions.unit === 'cm') {
      length = length / 2.54;
      width = width / 2.54;
      height = height / 2.54;
      weight = weight * 2.20462; // kg to lbs
    }

    // Check small standard
    if (length <= classification.small_standard.maxLength &&
        width <= classification.small_standard.maxWidth &&
        height <= classification.small_standard.maxHeight &&
        weight <= classification.small_standard.maxWeight) {
      return SizeTier.SMALL_STANDARD;
    }

    // Check large standard
    if (length <= classification.large_standard.maxLength &&
        width <= classification.large_standard.maxWidth &&
        height <= classification.large_standard.maxHeight &&
        weight <= classification.large_standard.maxWeight) {
      return SizeTier.LARGE_STANDARD;
    }

    // Check oversized categories
    if (weight <= classification.oversized.small.maxWeight && 
        Math.max(length, width, height) <= classification.oversized.small.maxLength) {
      return SizeTier.SMALL_OVERSIZED;
    }

    if (weight <= classification.oversized.medium.maxWeight && 
        Math.max(length, width, height) <= classification.oversized.medium.maxLength) {
      return SizeTier.MEDIUM_OVERSIZED;
    }

    if (weight <= classification.oversized.large.maxWeight && 
        Math.max(length, width, height) <= classification.oversized.large.maxLength) {
      return SizeTier.LARGE_OVERSIZED;
    }

    return SizeTier.SPECIAL_OVERSIZED;
  }

  private determineWeightTier(weight: number, sizeTier: SizeTier): WeightTier {
    // Convert weight to lbs if needed (assuming input is in lbs)
    
    if (sizeTier.includes('oversized')) {
      if (weight <= 70) return WeightTier.OVERSIZED_SMALL;
      if (weight <= 150) return WeightTier.OVERSIZED_MEDIUM;
      if (weight <= 1500) return WeightTier.OVERSIZED_LARGE;
      return WeightTier.OVERSIZED_SPECIAL;
    }

    // Standard size tiers
    if (weight <= 1) return WeightTier.STANDARD_0_TO_1_LB;
    if (weight <= 2) return WeightTier.STANDARD_1_TO_2_LB;
    if (weight <= 3) return WeightTier.STANDARD_2_TO_3_LB;
    return WeightTier.STANDARD_OVER_3_LB;
  }

  getTotalEstimatedFees(params: {
    sellingPrice: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
      weight: number;
      unit: 'inch' | 'cm';
    };
    storageDuration?: number;
    currentMonth?: number;
  }): {
    referralFee: number;
    fulfillmentFee: number;
    storageFee: number;
    otherFees: number;
    totalFees: number;
    breakdown: any;
  } {
    const referralFee = this.calculateReferralFee(params.sellingPrice);
    const fulfillment = this.calculateFulfillmentFee(params.dimensions);
    const storage = this.calculateStorageFee(
      params.dimensions,
      params.storageDuration || 30,
      params.currentMonth || new Date().getMonth() + 1
    );

    const closingFee = this.otherFees?.closingFee || 0;
    const otherFees = closingFee;
    
    const totalFees = referralFee + fulfillment.totalFee + storage.totalFee + otherFees;

    return {
      referralFee,
      fulfillmentFee: fulfillment.totalFee,
      storageFee: storage.totalFee,
      otherFees,
      totalFees: Math.round(totalFees * 100) / 100,
      breakdown: {
        referral: { fee: referralFee },
        fulfillment,
        storage,
        other: { closingFee },
      },
    };
  }

  // Static factory methods
  static createAmazonUSStandardFeeStructure(): Partial<FeeStructure> {
    return {
      marketplaceType: MarketplaceType.AMAZON_US,
      category: 'General',
      fulfillmentMethod: FulfillmentMethod.FBA,
      currencyCode: 'USD',
      countryCode: 'US',
      effectiveDate: new Date(),
      isActive: true,
      version: 1,
      referralFeeStructure: {
        type: 'percentage',
        percentage: 15, // Default 15% for most categories
        minimumFee: 0.30,
      },
      fulfillmentFeeStructure: {
        pickAndPackFee: {
          [SizeTier.SMALL_STANDARD]: 3.22,
          [SizeTier.LARGE_STANDARD]: 4.75,
          [SizeTier.SMALL_OVERSIZED]: 9.73,
          [SizeTier.MEDIUM_OVERSIZED]: 19.05,
          [SizeTier.LARGE_OVERSIZED]: 89.98,
          [SizeTier.SPECIAL_OVERSIZED]: 197.78,
        },
        weightHandlingFee: {
          [WeightTier.STANDARD_0_TO_1_LB]: {
            baseWeight: 1,
            baseFee: 0,
            additionalWeightFee: 0.42,
          },
          [WeightTier.STANDARD_1_TO_2_LB]: {
            baseWeight: 2,
            baseFee: 0.42,
            additionalWeightFee: 0.42,
          },
        },
        sizeClassification: {
          small_standard: {
            maxLength: 15,
            maxWidth: 12,
            maxHeight: 0.75,
            maxWeight: 1,
            unit: 'inch',
          },
          large_standard: {
            maxLength: 18,
            maxWidth: 14,
            maxHeight: 8,
            maxWeight: 20,
            unit: 'inch',
          },
          oversized: {
            small: { maxWeight: 70, maxLength: 60 },
            medium: { maxWeight: 150, maxLength: 108 },
            large: { maxWeight: 1500, maxLength: 108 },
            special: { description: 'Over 1500 lbs or over 108 inches' },
          },
        },
      },
      storageFeeStructure: {
        monthly: {
          standardSize: {
            janToSep: 0.87, // per cubic foot
            octToDec: 2.40,
          },
          oversized: {
            janToSep: 0.56,
            octToDec: 1.40,
          },
        },
        longTermStorage: {
          thresholdDays: 365,
          standardSize: 6.90,
          oversized: 4.30,
        },
      },
      otherFees: {
        closingFee: 1.80,
        returnProcessingFee: {
          percentage: 20,
          minimumFee: 2.00,
        },
      },
    };
  }
}