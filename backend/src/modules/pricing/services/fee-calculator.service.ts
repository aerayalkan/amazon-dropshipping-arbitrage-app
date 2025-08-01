import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FeeStructure, SizeTier, WeightTier } from '../entities/fee-structure.entity';
import { MarketplaceType, FulfillmentMethod } from '../entities/pricing-calculation.entity';

export interface FeeCalculationInput {
  sellingPrice: number;
  productCategory: string;
  marketplace: MarketplaceType;
  fulfillmentMethod: FulfillmentMethod;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    weight: number;
    unit: 'inch' | 'cm';
  };
  storageDuration?: number; // days
}

export interface FeeCalculationResult {
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
  breakdown: {
    feeType: string;
    amount: number;
    percentage: number;
  }[];
}

@Injectable()
export class FeeCalculatorService {
  private readonly logger = new Logger(FeeCalculatorService.name);

  constructor(
    @InjectRepository(FeeStructure)
    private readonly feeStructureRepository: Repository<FeeStructure>,
  ) {}

  /**
   * Amazon ücretlerini hesapla
   */
  async calculateAmazonFees(input: FeeCalculationInput): Promise<FeeCalculationResult> {
    try {
      this.logger.debug(`Calculating Amazon fees for ${input.marketplace} - ${input.productCategory}`);

      // Get applicable fee structure
      const feeStructure = await this.getFeeStructure(
        input.marketplace,
        input.productCategory,
        input.fulfillmentMethod
      );

      if (!feeStructure) {
        // Use default fee structure if specific one not found
        return this.calculateWithDefaultFees(input);
      }

      // Calculate referral fee
      const referralFee = feeStructure.calculateReferralFee(input.sellingPrice);

      const result: FeeCalculationResult = {
        referralFee: {
          percentage: this.getReferralFeePercentage(feeStructure, input.sellingPrice),
          amount: referralFee,
        },
        totalFees: referralFee,
        breakdown: [
          {
            feeType: 'Referral Fee',
            amount: referralFee,
            percentage: (referralFee / input.sellingPrice) * 100,
          },
        ],
      };

      // Calculate fulfillment fees (if FBA)
      if (input.fulfillmentMethod === FulfillmentMethod.FBA && input.dimensions) {
        const fulfillmentFees = feeStructure.calculateFulfillmentFee(input.dimensions);
        
        result.fulfillmentFee = {
          pickPackFee: fulfillmentFees.pickPackFee,
          weightHandlingFee: fulfillmentFees.weightHandlingFee,
        };

        result.totalFees += fulfillmentFees.totalFee;
        result.breakdown.push({
          feeType: 'Fulfillment Fee',
          amount: fulfillmentFees.totalFee,
          percentage: (fulfillmentFees.totalFee / input.sellingPrice) * 100,
        });

        // Calculate storage fees
        if (input.storageDuration) {
          const storageFees = feeStructure.calculateStorageFee(
            input.dimensions,
            input.storageDuration,
            new Date().getMonth() + 1
          );

          if (storageFees.monthlyFee > 0) {
            result.fulfillmentFee.storageFeeMontly = storageFees.monthlyFee;
            result.totalFees += storageFees.monthlyFee;
            result.breakdown.push({
              feeType: 'Storage Fee',
              amount: storageFees.monthlyFee,
              percentage: (storageFees.monthlyFee / input.sellingPrice) * 100,
            });
          }

          if (storageFees.longTermFee > 0) {
            result.fulfillmentFee.longTermStorageFee = storageFees.longTermFee;
            result.totalFees += storageFees.longTermFee;
            result.breakdown.push({
              feeType: 'Long-term Storage Fee',
              amount: storageFees.longTermFee,
              percentage: (storageFees.longTermFee / input.sellingPrice) * 100,
            });
          }
        }
      }

      // Add other fees
      if (feeStructure.otherFees?.closingFee) {
        result.closingFee = feeStructure.otherFees.closingFee;
        result.totalFees += result.closingFee;
        result.breakdown.push({
          feeType: 'Closing Fee',
          amount: result.closingFee,
          percentage: (result.closingFee / input.sellingPrice) * 100,
        });
      }

      // Return processing fee
      if (feeStructure.otherFees?.returnProcessingFee) {
        const returnFee = this.calculateReturnProcessingFee(
          input.sellingPrice,
          feeStructure.otherFees.returnProcessingFee
        );
        
        if (returnFee > 0) {
          result.returnProcessingFee = returnFee;
          result.totalFees += returnFee;
          result.breakdown.push({
            feeType: 'Return Processing Fee',
            amount: returnFee,
            percentage: (returnFee / input.sellingPrice) * 100,
          });
        }
      }

      // Refund administration fee
      if (feeStructure.otherFees?.refundAdministrationFee) {
        const refundFee = this.calculateRefundAdministrationFee(
          input.sellingPrice,
          feeStructure.otherFees.refundAdministrationFee
        );
        
        if (refundFee > 0) {
          result.refundAdministrationFee = refundFee;
          result.totalFees += refundFee;
          result.breakdown.push({
            feeType: 'Refund Administration Fee',
            amount: refundFee,
            percentage: (refundFee / input.sellingPrice) * 100,
          });
        }
      }

      // Round total fees
      result.totalFees = Math.round(result.totalFees * 100) / 100;

      this.logger.debug(`Total Amazon fees calculated: $${result.totalFees}`);
      return result;

    } catch (error) {
      this.logger.error(`Error calculating Amazon fees: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kategori bazlı referral fee getir
   */
  async getCategoryReferralFee(
    marketplace: MarketplaceType,
    category: string
  ): Promise<{
    percentage: number;
    minimumFee?: number;
    maximumFee?: number;
  }> {
    const feeStructure = await this.getFeeStructure(marketplace, category, FulfillmentMethod.FBA);
    
    if (!feeStructure) {
      return { percentage: 15 }; // Default Amazon referral fee
    }

    return {
      percentage: feeStructure.referralFeeStructure.percentage || 15,
      minimumFee: feeStructure.referralFeeStructure.minimumFee,
      maximumFee: feeStructure.referralFeeStructure.maximumFee,
    };
  }

  /**
   * Size tier hesapla
   */
  calculateSizeTier(dimensions: {
    length: number;
    width: number;
    height: number;
    weight: number;
    unit: 'inch' | 'cm';
  }): SizeTier {
    // Convert to inches if needed
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

    // Small standard
    if (length <= 15 && width <= 12 && height <= 0.75 && weight <= 1) {
      return SizeTier.SMALL_STANDARD;
    }

    // Large standard
    if (length <= 18 && width <= 14 && height <= 8 && weight <= 20) {
      return SizeTier.LARGE_STANDARD;
    }

    // Oversized categories
    const maxDimension = Math.max(length, width, height);
    
    if (weight <= 70 && maxDimension <= 60) {
      return SizeTier.SMALL_OVERSIZED;
    }

    if (weight <= 150 && maxDimension <= 108) {
      return SizeTier.MEDIUM_OVERSIZED;
    }

    if (weight <= 1500 && maxDimension <= 108) {
      return SizeTier.LARGE_OVERSIZED;
    }

    return SizeTier.SPECIAL_OVERSIZED;
  }

  /**
   * FBA fee estimator
   */
  async estimateFBAFees(
    marketplace: MarketplaceType,
    dimensions: {
      length: number;
      width: number;
      height: number;
      weight: number;
      unit: 'inch' | 'cm';
    },
    storageDuration: number = 30
  ): Promise<{
    pickPackFee: number;
    weightHandlingFee: number;
    storageFee: number;
    totalFBAFee: number;
    sizeTier: SizeTier;
    recommendations: string[];
  }> {
    const sizeTier = this.calculateSizeTier(dimensions);
    
    // Get default fee structure for estimation
    const defaultFees = this.getDefaultFBAFees(marketplace);
    
    const pickPackFee = defaultFees.pickPack[sizeTier] || 0;
    const weightHandlingFee = this.calculateWeightHandlingFee(dimensions.weight, sizeTier);
    const storageFee = this.calculateStorageFee(dimensions, storageDuration, marketplace);
    
    const totalFBAFee = pickPackFee + weightHandlingFee + storageFee;

    const recommendations = this.generateFeeOptimizationRecommendations(
      dimensions,
      sizeTier,
      totalFBAFee
    );

    return {
      pickPackFee,
      weightHandlingFee,
      storageFee,
      totalFBAFee,
      sizeTier,
      recommendations,
    };
  }

  /**
   * Fee comparison between FBA and FBM
   */
  async compareFulfillmentMethods(
    input: FeeCalculationInput
  ): Promise<{
    fba: FeeCalculationResult;
    fbm: FeeCalculationResult;
    recommendation: 'fba' | 'fbm';
    savings: number;
    reasoning: string[];
  }> {
    const fbaFees = await this.calculateAmazonFees({
      ...input,
      fulfillmentMethod: FulfillmentMethod.FBA,
    });

    const fbmFees = await this.calculateAmazonFees({
      ...input,
      fulfillmentMethod: FulfillmentMethod.FBM,
    });

    const savings = Math.abs(fbaFees.totalFees - fbmFees.totalFees);
    const recommendation = fbaFees.totalFees < fbmFees.totalFees ? 'fba' : 'fbm';

    const reasoning = this.generateFulfillmentRecommendationReasoning(
      input,
      fbaFees,
      fbmFees
    );

    return {
      fba: fbaFees,
      fbm: fbmFees,
      recommendation,
      savings,
      reasoning,
    };
  }

  // Private helper methods
  private async getFeeStructure(
    marketplace: MarketplaceType,
    category: string,
    fulfillmentMethod: FulfillmentMethod
  ): Promise<FeeStructure | null> {
    return this.feeStructureRepository.findOne({
      where: {
        marketplaceType: marketplace,
        category,
        fulfillmentMethod,
        isActive: true,
      },
      order: { effectiveDate: 'DESC' },
    });
  }

  private getReferralFeePercentage(feeStructure: FeeStructure, sellingPrice: number): number {
    if (feeStructure.referralFeeStructure.type === 'percentage') {
      return feeStructure.referralFeeStructure.percentage || 15;
    }

    if (feeStructure.referralFeeStructure.type === 'tiered' && feeStructure.referralFeeStructure.tiers) {
      for (const tier of feeStructure.referralFeeStructure.tiers) {
        if (sellingPrice >= tier.minAmount && 
            (tier.maxAmount === undefined || sellingPrice <= tier.maxAmount)) {
          return tier.percentage;
        }
      }
    }

    return 15; // Default
  }

  private calculateReturnProcessingFee(
    sellingPrice: number,
    feeConfig: { percentage?: number; fixedAmount?: number; minimumFee?: number }
  ): number {
    let fee = 0;

    if (feeConfig.percentage) {
      fee = (sellingPrice * feeConfig.percentage) / 100;
    }

    if (feeConfig.fixedAmount) {
      fee += feeConfig.fixedAmount;
    }

    if (feeConfig.minimumFee) {
      fee = Math.max(fee, feeConfig.minimumFee);
    }

    return Math.round(fee * 100) / 100;
  }

  private calculateRefundAdministrationFee(
    sellingPrice: number,
    feeConfig: { percentage?: number; minimumFee?: number; maximumFee?: number }
  ): number {
    let fee = 0;

    if (feeConfig.percentage) {
      fee = (sellingPrice * feeConfig.percentage) / 100;
    }

    if (feeConfig.minimumFee) {
      fee = Math.max(fee, feeConfig.minimumFee);
    }

    if (feeConfig.maximumFee) {
      fee = Math.min(fee, feeConfig.maximumFee);
    }

    return Math.round(fee * 100) / 100;
  }

  private calculateWithDefaultFees(input: FeeCalculationInput): FeeCalculationResult {
    const defaultReferralFee = 15; // 15% default
    const referralFeeAmount = (input.sellingPrice * defaultReferralFee) / 100;

    const result: FeeCalculationResult = {
      referralFee: {
        percentage: defaultReferralFee,
        amount: referralFeeAmount,
      },
      totalFees: referralFeeAmount,
      breakdown: [
        {
          feeType: 'Referral Fee (Default)',
          amount: referralFeeAmount,
          percentage: defaultReferralFee,
        },
      ],
    };

    // Add estimated fulfillment fee for FBA
    if (input.fulfillmentMethod === FulfillmentMethod.FBA && input.dimensions) {
      const sizeTier = this.calculateSizeTier(input.dimensions);
      const defaultFees = this.getDefaultFBAFees(input.marketplace);
      
      const pickPackFee = defaultFees.pickPack[sizeTier] || 3.22;
      const weightHandlingFee = this.calculateWeightHandlingFee(input.dimensions.weight, sizeTier);
      const fulfillmentFeeTotal = pickPackFee + weightHandlingFee;

      result.fulfillmentFee = {
        pickPackFee,
        weightHandlingFee,
      };

      result.totalFees += fulfillmentFeeTotal;
      result.breakdown.push({
        feeType: 'Fulfillment Fee (Estimated)',
        amount: fulfillmentFeeTotal,
        percentage: (fulfillmentFeeTotal / input.sellingPrice) * 100,
      });
    }

    return result;
  }

  private getDefaultFBAFees(marketplace: MarketplaceType): any {
    // Default FBA fees for US marketplace
    const defaultFees = {
      pickPack: {
        [SizeTier.SMALL_STANDARD]: 3.22,
        [SizeTier.LARGE_STANDARD]: 4.75,
        [SizeTier.SMALL_OVERSIZED]: 9.73,
        [SizeTier.MEDIUM_OVERSIZED]: 19.05,
        [SizeTier.LARGE_OVERSIZED]: 89.98,
        [SizeTier.SPECIAL_OVERSIZED]: 197.78,
      },
      weightHandling: {
        perPound: 0.42,
        first2lbs: 0,
      },
      storage: {
        standardSize: {
          janToSep: 0.87,
          octToDec: 2.40,
        },
        oversized: {
          janToSep: 0.56,
          octToDec: 1.40,
        },
      },
    };

    // Adjust for different marketplaces
    if (marketplace === MarketplaceType.AMAZON_UK) {
      // Convert USD to GBP approximately
      Object.keys(defaultFees.pickPack).forEach(key => {
        defaultFees.pickPack[key] *= 0.8;
      });
    }

    return defaultFees;
  }

  private calculateWeightHandlingFee(weight: number, sizeTier: SizeTier): number {
    // Convert weight to pounds if needed
    let weightInPounds = weight;
    
    if (sizeTier.includes('oversized')) {
      // Oversized items have different weight handling
      if (weightInPounds <= 2) return 0;
      return (weightInPounds - 2) * 0.42;
    }

    // Standard size weight handling
    if (weightInPounds <= 1) return 0;
    if (weightInPounds <= 2) return 0.42;
    if (weightInPounds <= 3) return 0.84;
    return (weightInPounds - 3) * 0.42 + 0.84;
  }

  private calculateStorageFee(
    dimensions: { length: number; width: number; height: number; unit: 'inch' | 'cm' },
    storageDuration: number,
    marketplace: MarketplaceType
  ): number {
    // Calculate cubic feet
    let length = dimensions.length;
    let width = dimensions.width;
    let height = dimensions.height;

    if (dimensions.unit === 'cm') {
      length = length / 2.54;
      width = width / 2.54;
      height = height / 2.54;
    }

    const cubicFeet = (length * width * height) / 1728;
    const currentMonth = new Date().getMonth() + 1;
    const isHighSeason = currentMonth >= 10 && currentMonth <= 12;

    const defaultRates = this.getDefaultFBAFees(marketplace).storage;
    const rate = isHighSeason 
      ? defaultRates.standardSize.octToDec 
      : defaultRates.standardSize.janToSep;

    const monthlyFee = cubicFeet * rate;
    const totalFee = (monthlyFee * storageDuration) / 30; // Pro-rated

    return Math.round(totalFee * 100) / 100;
  }

  private generateFeeOptimizationRecommendations(
    dimensions: any,
    sizeTier: SizeTier,
    totalFee: number
  ): string[] {
    const recommendations = [];

    if (sizeTier === SizeTier.LARGE_STANDARD && dimensions.weight < 1) {
      recommendations.push('Ürün ağırlığı 1 lb altında - small standard boyutuna optimize edilebilir');
    }

    if (sizeTier.includes('oversized')) {
      recommendations.push('Oversized ürün - paketleme optimizasyonu ile maliyetler düşürülebilir');
    }

    if (totalFee > 10) {
      recommendations.push('Yüksek FBA ücretleri - FBM alternatifini değerlendirin');
    }

    if (dimensions.weight > 20) {
      recommendations.push('Ağır ürün - kargo maliyetleri yüksek olabilir');
    }

    return recommendations;
  }

  private generateFulfillmentRecommendationReasoning(
    input: FeeCalculationInput,
    fbaFees: FeeCalculationResult,
    fbmFees: FeeCalculationResult
  ): string[] {
    const reasoning = [];
    const feeDifference = Math.abs(fbaFees.totalFees - fbmFees.totalFees);
    const feePercentage = (feeDifference / input.sellingPrice) * 100;

    if (feePercentage > 5) {
      reasoning.push(`Ücret farkı %${feePercentage.toFixed(1)} - önemli tasarruf potansiyeli`);
    }

    if (fbaFees.totalFees < fbmFees.totalFees) {
      reasoning.push('FBA daha düşük toplam ücret sunuyor');
      reasoning.push('Prime eligibility ve customer service avantajları');
    } else {
      reasoning.push('FBM daha düşük ücretlerle daha yüksek kar marjı sağlıyor');
      reasoning.push('Kendi shipping kontrolünüz olacak');
    }

    if (input.dimensions && this.calculateSizeTier(input.dimensions).includes('oversized')) {
      reasoning.push('Oversized ürün için FBA ücretleri yüksek olabilir');
    }

    return reasoning;
  }
}