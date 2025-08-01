import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TaxConfiguration, TaxType } from '../entities/tax-configuration.entity';
import { MarketplaceType } from '../entities/pricing-calculation.entity';

export interface TaxCalculationInput {
  sellingPrice: number;
  marketplace: MarketplaceType;
  productCategory: string;
  customerType: 'b2b' | 'b2c' | 'government' | 'reseller';
  businessType?: 'individual' | 'professional' | 'corporation';
  fulfillmentMethod?: 'fba' | 'fbm';
  customerLocation?: {
    country: string;
    state?: string;
    city?: string;
    postalCode?: string;
  };
  isExempt?: boolean;
  exemptionCertificate?: string;
}

export interface TaxCalculationResult {
  salesTax: {
    rate: number;
    amount: number;
    jurisdiction: string;
  };
  vatTax?: {
    rate: number;
    amount: number;
    jurisdiction: string;
  };
  incomeTax?: {
    rate: number;
    amount: number;
    jurisdiction: string;
  };
  customsDuty?: {
    rate: number;
    amount: number;
    description: string;
  };
  totalTaxes: number;
  applicableTaxes: Array<{
    taxType: TaxType;
    rate: number;
    amount: number;
    jurisdiction: string;
    calculation: string;
  }>;
  exemptions: Array<{
    taxType: TaxType;
    reason: string;
    savedAmount: number;
  }>;
  complianceRequirements: Array<{
    requirement: string;
    deadline?: string;
    action: string;
  }>;
}

@Injectable()
export class TaxCalculatorService {
  private readonly logger = new Logger(TaxCalculatorService.name);

  constructor(
    @InjectRepository(TaxConfiguration)
    private readonly taxConfigRepository: Repository<TaxConfiguration>,
  ) {}

  /**
   * Ana vergi hesaplama metodu
   */
  async calculateTaxes(
    userId: string,
    input: TaxCalculationInput
  ): Promise<TaxCalculationResult> {
    try {
      this.logger.debug(`Calculating taxes for ${input.marketplace} - ${input.productCategory}`);

      const result: TaxCalculationResult = {
        salesTax: { rate: 0, amount: 0, jurisdiction: 'N/A' },
        totalTaxes: 0,
        applicableTaxes: [],
        exemptions: [],
        complianceRequirements: [],
      };

      // Get applicable tax configurations
      const taxConfigs = await this.getApplicableTaxConfigurations(userId, input);

      for (const config of taxConfigs) {
        if (!config.isApplicableToProduct(
          input.productCategory,
          input.sellingPrice,
          input.fulfillmentMethod || 'fba'
        )) {
          continue;
        }

        const taxCalculation = config.calculateTax(input.sellingPrice, {
          productCategory: input.productCategory,
          customerType: input.customerType,
          businessType: input.businessType,
          isExempt: input.isExempt,
        });

        if (taxCalculation.taxAmount > 0) {
          this.addTaxToResult(result, config, taxCalculation);
        } else if (input.isExempt) {
          this.addExemptionToResult(result, config, input.sellingPrice);
        }

        // Add compliance requirements
        if (config.complianceRequirements) {
          this.addComplianceRequirements(result, config);
        }
      }

      result.totalTaxes = result.applicableTaxes.reduce((sum, tax) => sum + tax.amount, 0);

      this.logger.debug(`Total taxes calculated: ${result.totalTaxes}`);
      return result;

    } catch (error) {
      this.logger.error(`Error calculating taxes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Specific tax type calculation
   */
  async calculateSpecificTax(
    userId: string,
    taxType: TaxType,
    amount: number,
    context: {
      marketplace: MarketplaceType;
      jurisdiction: string;
      productCategory?: string;
    }
  ): Promise<{
    rate: number;
    amount: number;
    calculation: string;
    compliance?: any;
  }> {
    const config = await this.taxConfigRepository.findOne({
      where: {
        userId,
        taxType,
        marketplaceType: context.marketplace,
        jurisdictionName: context.jurisdiction,
        isActive: true,
      },
      order: { effectiveDate: 'DESC' },
    });

    if (!config) {
      return {
        rate: 0,
        amount: 0,
        calculation: 'No applicable tax configuration found',
      };
    }

    const result = config.calculateTax(amount, {
      productCategory: context.productCategory,
    });

    return {
      rate: result.effectiveRate,
      amount: result.taxAmount,
      calculation: `${result.effectiveRate.toFixed(2)}% of ${amount}`,
      compliance: config.complianceRequirements,
    };
  }

  /**
   * VAT calculation for EU
   */
  async calculateEUVAT(
    userId: string,
    sellingPrice: number,
    customerCountry: string,
    productCategory: string,
    customerType: 'b2b' | 'b2c'
  ): Promise<{
    vatRate: number;
    vatAmount: number;
    country: string;
    isReverseCharge: boolean;
    vatNumber?: string;
  }> {
    // EU VAT rules implementation
    const vatConfig = await this.taxConfigRepository.findOne({
      where: {
        userId,
        taxType: TaxType.VAT,
        geographicScope: { countries: [customerCountry] } as any,
        isActive: true,
      },
      order: { effectiveDate: 'DESC' },
    });

    if (!vatConfig) {
      // Default EU VAT rates
      const defaultVATRates: { [key: string]: number } = {
        'DE': 19, 'FR': 20, 'IT': 22, 'ES': 21, 'NL': 21,
        'BE': 21, 'AT': 20, 'PL': 23, 'SE': 25, 'DK': 25,
      };

      const vatRate = defaultVATRates[customerCountry] || 20;
      const vatAmount = customerType === 'b2c' ? (sellingPrice * vatRate) / 100 : 0;

      return {
        vatRate,
        vatAmount,
        country: customerCountry,
        isReverseCharge: customerType === 'b2b',
      };
    }

    const vatCalculation = vatConfig.calculateTax(sellingPrice, {
      productCategory,
      customerType,
    });

    return {
      vatRate: vatCalculation.effectiveRate,
      vatAmount: customerType === 'b2c' ? vatCalculation.taxAmount : 0,
      country: customerCountry,
      isReverseCharge: customerType === 'b2b',
    };
  }

  /**
   * US Sales Tax calculation
   */
  async calculateUSSalesTax(
    userId: string,
    sellingPrice: number,
    customerState: string,
    customerCity?: string
  ): Promise<{
    stateRate: number;
    localRate: number;
    totalRate: number;
    totalTax: number;
    nexusRequired: boolean;
  }> {
    // US Sales Tax calculation
    const stateTaxConfig = await this.taxConfigRepository.findOne({
      where: {
        userId,
        taxType: TaxType.SALES_TAX,
        geographicScope: { states: [customerState] } as any,
        isActive: true,
      },
    });

    if (!stateTaxConfig) {
      // Default state tax rates
      const defaultRates: { [key: string]: number } = {
        'CA': 7.25, 'NY': 4.0, 'TX': 6.25, 'FL': 6.0, 'WA': 6.5,
        'OR': 0, 'NH': 0, 'MT': 0, 'DE': 0, 'AK': 0,
      };

      const stateRate = defaultRates[customerState] || 5.0;
      const localRate = customerCity ? 2.5 : 0; // Estimated local rate
      const totalRate = stateRate + localRate;
      const totalTax = (sellingPrice * totalRate) / 100;

      return {
        stateRate,
        localRate,
        totalRate,
        totalTax,
        nexusRequired: this.checkNexusRequirement(customerState),
      };
    }

    const stateCalculation = stateTaxConfig.calculateTax(sellingPrice);
    
    return {
      stateRate: stateCalculation.effectiveRate,
      localRate: 0, // Would need separate local tax config
      totalRate: stateCalculation.effectiveRate,
      totalTax: stateCalculation.taxAmount,
      nexusRequired: this.checkNexusRequirement(customerState),
    };
  }

  /**
   * Customs duty calculation
   */
  async calculateCustomsDuty(
    productCategory: string,
    productValue: number,
    originCountry: string,
    destinationCountry: string
  ): Promise<{
    dutyRate: number;
    dutyAmount: number;
    hsCode?: string;
    description: string;
  }> {
    // Simplified customs duty calculation
    const dutyRates: { [key: string]: number } = {
      'Electronics': 0, // Many electronics are duty-free
      'Textiles': 10.5,
      'Footwear': 15.2,
      'Jewelry': 5.5,
      'Toys': 0,
      'Books': 0,
      'Home & Garden': 5.3,
      'Health & Beauty': 3.2,
    };

    const dutyRate = dutyRates[productCategory] || 5.0; // Default 5%
    const dutyAmount = (productValue * dutyRate) / 100;

    return {
      dutyRate,
      dutyAmount,
      description: `${dutyRate}% duty on ${productCategory} from ${originCountry} to ${destinationCountry}`,
    };
  }

  /**
   * Tax compliance check
   */
  async checkTaxCompliance(
    userId: string,
    marketplace: MarketplaceType
  ): Promise<{
    status: 'compliant' | 'warning' | 'non_compliant';
    issues: Array<{
      severity: 'high' | 'medium' | 'low';
      issue: string;
      recommendation: string;
      deadline?: Date;
    }>;
    requiredActions: string[];
  }> {
    const configs = await this.taxConfigRepository.find({
      where: { userId, marketplaceType: marketplace, isActive: true },
    });

    const issues = [];
    const requiredActions = [];

    for (const config of configs) {
      const compliance = config.getComplianceStatus();
      
      if (compliance.status !== 'compliant') {
        issues.push(...compliance.issues.map(issue => ({
          severity: 'medium' as const,
          issue,
          recommendation: compliance.recommendations[0] || 'Review configuration',
        })));
      }

      if (config.needsUpdate()) {
        requiredActions.push(`Update tax configuration for ${config.jurisdictionName}`);
      }
    }

    const status = issues.length === 0 ? 'compliant' :
                  issues.filter(i => i.severity === 'high').length > 0 ? 'non_compliant' : 'warning';

    return {
      status,
      issues,
      requiredActions,
    };
  }

  /**
   * Tax report generation
   */
  async generateTaxReport(
    userId: string,
    period: { startDate: Date; endDate: Date },
    groupBy: 'jurisdiction' | 'taxType' | 'product'
  ): Promise<{
    summary: {
      totalTaxCollected: number;
      totalTaxPaid: number;
      netTaxLiability: number;
    };
    breakdown: Array<{
      category: string;
      taxCollected: number;
      taxPaid: number;
      netAmount: number;
      transactionCount: number;
    }>;
    complianceDeadlines: Array<{
      jurisdiction: string;
      deadline: Date;
      requirement: string;
      amount?: number;
    }>;
  }> {
    // This would integrate with actual transaction data
    // For now, returning mock report structure
    
    return {
      summary: {
        totalTaxCollected: 1250.50,
        totalTaxPaid: 850.25,
        netTaxLiability: 400.25,
      },
      breakdown: [
        {
          category: 'California Sales Tax',
          taxCollected: 485.30,
          taxPaid: 0,
          netAmount: 485.30,
          transactionCount: 67,
        },
        {
          category: 'EU VAT',
          taxCollected: 765.20,
          taxPaid: 850.25,
          netAmount: -85.05,
          transactionCount: 42,
        },
      ],
      complianceDeadlines: [
        {
          jurisdiction: 'California',
          deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days
          requirement: 'Monthly Sales Tax Filing',
          amount: 485.30,
        },
      ],
    };
  }

  // Private helper methods
  private async getApplicableTaxConfigurations(
    userId: string,
    input: TaxCalculationInput
  ): Promise<TaxConfiguration[]> {
    let query = this.taxConfigRepository.createQueryBuilder('config')
      .where('config.userId = :userId', { userId })
      .andWhere('config.marketplaceType = :marketplace', { marketplace: input.marketplace })
      .andWhere('config.isActive = :isActive', { isActive: true })
      .andWhere('config.effectiveDate <= :now', { now: new Date() })
      .andWhere('(config.expiryDate IS NULL OR config.expiryDate > :now)', { now: new Date() });

    // Filter by geographic scope if customer location provided
    if (input.customerLocation) {
      if (input.customerLocation.country) {
        query = query.andWhere(`
          (config.geographicScope IS NULL OR 
           config.geographicScope::jsonb -> 'countries' @> :country OR
           config.geographicScope::jsonb -> 'states' @> :state OR
           config.geographicScope::jsonb -> 'cities' @> :city)
        `, {
          country: JSON.stringify([input.customerLocation.country]),
          state: JSON.stringify([input.customerLocation.state]),
          city: JSON.stringify([input.customerLocation.city]),
        });
      }
    }

    return query.orderBy('config.priority', 'DESC').getMany();
  }

  private addTaxToResult(
    result: TaxCalculationResult,
    config: TaxConfiguration,
    calculation: any
  ): void {
    const taxEntry = {
      taxType: config.taxType,
      rate: calculation.effectiveRate,
      amount: calculation.taxAmount,
      jurisdiction: config.jurisdictionName,
      calculation: `${calculation.effectiveRate.toFixed(2)}% of selling price`,
    };

    result.applicableTaxes.push(taxEntry);

    // Add to specific tax type
    switch (config.taxType) {
      case TaxType.SALES_TAX:
        result.salesTax = {
          rate: calculation.effectiveRate,
          amount: calculation.taxAmount,
          jurisdiction: config.jurisdictionName,
        };
        break;
      
      case TaxType.VAT:
        result.vatTax = {
          rate: calculation.effectiveRate,
          amount: calculation.taxAmount,
          jurisdiction: config.jurisdictionName,
        };
        break;
      
      case TaxType.INCOME_TAX:
        result.incomeTax = {
          rate: calculation.effectiveRate,
          amount: calculation.taxAmount,
          jurisdiction: config.jurisdictionName,
        };
        break;
      
      case TaxType.CUSTOMS_DUTY:
        result.customsDuty = {
          rate: calculation.effectiveRate,
          amount: calculation.taxAmount,
          description: `${config.jurisdictionName} customs duty`,
        };
        break;
    }
  }

  private addExemptionToResult(
    result: TaxCalculationResult,
    config: TaxConfiguration,
    sellingPrice: number
  ): void {
    const potentialTax = config.calculateTax(sellingPrice, { isExempt: false });
    
    result.exemptions.push({
      taxType: config.taxType,
      reason: 'Tax exempt status',
      savedAmount: potentialTax.taxAmount,
    });
  }

  private addComplianceRequirements(
    result: TaxCalculationResult,
    config: TaxConfiguration
  ): void {
    if (!config.complianceRequirements) return;

    const compliance = config.complianceRequirements;
    
    if (compliance.filingFrequency) {
      result.complianceRequirements.push({
        requirement: `${compliance.filingFrequency} tax filing required`,
        deadline: compliance.reportingDeadline,
        action: `File ${config.taxType} return for ${config.jurisdictionName}`,
      });
    }

    if (compliance.registrationRequired) {
      result.complianceRequirements.push({
        requirement: 'Tax registration required',
        action: `Register for ${config.taxType} in ${config.jurisdictionName}`,
      });
    }
  }

  private checkNexusRequirement(state: string): boolean {
    // Simplified nexus check - in reality this would be more complex
    const nexusStates = ['CA', 'NY', 'TX', 'FL', 'WA', 'PA', 'IL'];
    return nexusStates.includes(state);
  }
}