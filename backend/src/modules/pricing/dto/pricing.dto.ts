import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsDateString,
  IsPositive,
  Min,
  Max,
  IsNotEmpty,
  ValidateNested,
  IsObject,
  Length,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { MarketplaceType, FulfillmentMethod, CalculationType } from '../entities/pricing-calculation.entity';
import { TaxType } from '../entities/tax-configuration.entity';
import { CurrencyPair } from '../entities/currency-rate.entity';
import { AnalysisType } from '../entities/profit-analysis.entity';

// Base DTO Classes
export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

export class ProductDimensionsDto {
  @ApiProperty({ description: 'Product length' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  length: number;

  @ApiProperty({ description: 'Product width' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  width: number;

  @ApiProperty({ description: 'Product height' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  height: number;

  @ApiProperty({ description: 'Product weight' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.01)
  weight: number;

  @ApiProperty({ enum: ['inch', 'cm'], description: 'Unit of measurement' })
  @IsEnum(['inch', 'cm'])
  unit: 'inch' | 'cm';
}

export class AdditionalCostsDto {
  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  advertisingCost?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  packagingCost?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  handlingFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OtherFeeDto)
  otherFees?: OtherFeeDto[];
}

export class OtherFeeDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}

// Pricing Calculation DTOs
export class CreatePricingCalculationDto {
  @ApiProperty({ description: 'Product name' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  productName: string;

  @ApiProperty({ description: 'Cost price (supplier price)', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice: number;

  @ApiProperty({ description: 'Selling price on Amazon', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ description: 'Product category' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  productCategory: string;

  @ApiProperty({ enum: MarketplaceType, description: 'Amazon marketplace' })
  @IsEnum(MarketplaceType)
  marketplace: MarketplaceType;

  @ApiProperty({ enum: FulfillmentMethod, description: 'Fulfillment method' })
  @IsEnum(FulfillmentMethod)
  fulfillmentMethod: FulfillmentMethod;

  @ApiPropertyOptional({ description: 'Currency code (default: USD)' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ description: 'Product dimensions and weight' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @ApiPropertyOptional({ description: 'Shipping cost to Amazon warehouse', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  shippingCost?: number;

  @ApiPropertyOptional({ description: 'Additional costs' })
  @IsOptional()
  @ValidateNested()
  @Type(() => AdditionalCostsDto)
  additionalCosts?: AdditionalCostsDto;

  @ApiPropertyOptional({ description: 'Product ASIN (for competitive analysis)' })
  @IsOptional()
  @IsString()
  @Length(10, 10)
  @Matches(/^[A-Z0-9]{10}$/, { message: 'ASIN must be 10 alphanumeric characters' })
  asin?: string;

  @ApiPropertyOptional({ description: 'Inventory item ID' })
  @IsOptional()
  @IsString()
  productId?: string;
}

export class CalculationOptionsDto {
  @ApiPropertyOptional({ description: 'Include competitor analysis' })
  @IsOptional()
  @IsBoolean()
  includeCompetitorAnalysis?: boolean;

  @ApiPropertyOptional({ description: 'Include scenario analysis' })
  @IsOptional()
  @IsBoolean()
  includeScenarioAnalysis?: boolean;

  @ApiPropertyOptional({ description: 'Include forecast analysis' })
  @IsOptional()
  @IsBoolean()
  includeForecast?: boolean;

  @ApiPropertyOptional({ description: 'Target currency for conversion' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  targetCurrency?: string;

  @ApiPropertyOptional({ description: 'Tax configuration ID to use' })
  @IsOptional()
  @IsString()
  taxConfiguration?: string;

  @ApiPropertyOptional({ description: 'Save calculation to database' })
  @IsOptional()
  @IsBoolean()
  saveCalculation?: boolean;
}

export class BulkPricingCalculationDto {
  @ApiProperty({ type: [CreatePricingCalculationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePricingCalculationDto)
  calculations: CreatePricingCalculationDto[];

  @ApiPropertyOptional({ description: 'Options for all calculations' })
  @IsOptional()
  @ValidateNested()
  @Type(() => CalculationOptionsDto)
  options?: CalculationOptionsDto;
}

export class WhatIfScenarioDto {
  @ApiProperty({ description: 'Scenario name' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: 'Changes to apply' })
  @IsObject()
  changes: {
    sellingPrice?: number;
    costPrice?: number;
    shippingCost?: number;
    fulfillmentMethod?: FulfillmentMethod;
  };
}

export class WhatIfAnalysisDto {
  @ApiProperty({ description: 'Base calculation ID' })
  @IsNotEmpty()
  @IsString()
  baseCalculationId: string;

  @ApiProperty({ type: [WhatIfScenarioDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WhatIfScenarioDto)
  scenarios: WhatIfScenarioDto[];
}

// Fee Calculation DTOs
export class FeeCalculationInputDto {
  @ApiProperty({ description: 'Selling price', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ description: 'Product category' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  productCategory: string;

  @ApiProperty({ enum: MarketplaceType })
  @IsEnum(MarketplaceType)
  marketplace: MarketplaceType;

  @ApiProperty({ enum: FulfillmentMethod })
  @IsEnum(FulfillmentMethod)
  fulfillmentMethod: FulfillmentMethod;

  @ApiPropertyOptional({ description: 'Product dimensions' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @ApiPropertyOptional({ description: 'Storage duration in days', minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  storageDuration?: number;
}

export class FBAEstimationDto {
  @ApiProperty({ enum: MarketplaceType })
  @IsEnum(MarketplaceType)
  marketplace: MarketplaceType;

  @ApiProperty({ description: 'Product dimensions' })
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions: ProductDimensionsDto;

  @ApiPropertyOptional({ description: 'Storage duration in days', minimum: 1, default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  storageDuration?: number;
}

export class FulfillmentComparisonDto {
  @ApiProperty({ description: 'Selling price', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ description: 'Product category' })
  @IsNotEmpty()
  @IsString()
  productCategory: string;

  @ApiProperty({ enum: MarketplaceType })
  @IsEnum(MarketplaceType)
  marketplace: MarketplaceType;

  @ApiPropertyOptional({ description: 'Product dimensions' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;
}

// Currency Conversion DTOs
export class CurrencyConversionDto {
  @ApiProperty({ description: 'Amount to convert', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Source currency code' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ description: 'Target currency code' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  toCurrency: string;

  @ApiPropertyOptional({ description: 'Include conversion fees' })
  @IsOptional()
  @IsBoolean()
  includeFees?: boolean;

  @ApiPropertyOptional({ description: 'Fee percentage', minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  feePercentage?: number;

  @ApiPropertyOptional({ description: 'Force refresh exchange rate' })
  @IsOptional()
  @IsBoolean()
  forceRefresh?: boolean;
}

export class BulkCurrencyConversionDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  @ValidateNested({ each: true })
  conversions: Array<{
    amount: number;
    fromCurrency: string;
    toCurrency: string;
  }>;
}

export class RateAnalysisDto {
  @ApiProperty({ description: 'Base currency' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ description: 'Quote currency' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  toCurrency: string;

  @ApiPropertyOptional({ description: 'Analysis period in days', minimum: 7, maximum: 365, default: 30 })
  @IsOptional()
  @IsNumber()
  @Min(7)
  @Max(365)
  period?: number;
}

export class RateAlertDto {
  @ApiProperty({ description: 'Base currency' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ description: 'Quote currency' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  toCurrency: string;

  @ApiProperty({ description: 'Target exchange rate', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  targetRate: number;

  @ApiProperty({ enum: ['above', 'below'], description: 'Alert condition' })
  @IsEnum(['above', 'below'])
  condition: 'above' | 'below';

  @ApiPropertyOptional({ description: 'Tolerance percentage', minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10)
  tolerance?: number;
}

// Tax Calculation DTOs
export class TaxCalculationInputDto {
  @ApiProperty({ description: 'Selling price', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ enum: MarketplaceType })
  @IsEnum(MarketplaceType)
  marketplace: MarketplaceType;

  @ApiProperty({ description: 'Product category' })
  @IsNotEmpty()
  @IsString()
  productCategory: string;

  @ApiProperty({ enum: ['b2b', 'b2c', 'government', 'reseller'], description: 'Customer type' })
  @IsEnum(['b2b', 'b2c', 'government', 'reseller'])
  customerType: 'b2b' | 'b2c' | 'government' | 'reseller';

  @ApiPropertyOptional({ enum: ['individual', 'professional', 'corporation'], description: 'Business type' })
  @IsOptional()
  @IsEnum(['individual', 'professional', 'corporation'])
  businessType?: 'individual' | 'professional' | 'corporation';

  @ApiPropertyOptional({ enum: ['fba', 'fbm'], description: 'Fulfillment method' })
  @IsOptional()
  @IsEnum(['fba', 'fbm'])
  fulfillmentMethod?: 'fba' | 'fbm';

  @ApiPropertyOptional({ description: 'Customer location' })
  @IsOptional()
  @IsObject()
  customerLocation?: {
    country: string;
    state?: string;
    city?: string;
    postalCode?: string;
  };

  @ApiPropertyOptional({ description: 'Tax exempt status' })
  @IsOptional()
  @IsBoolean()
  isExempt?: boolean;

  @ApiPropertyOptional({ description: 'Exemption certificate number' })
  @IsOptional()
  @IsString()
  exemptionCertificate?: string;
}

export class SpecificTaxCalculationDto {
  @ApiProperty({ enum: TaxType })
  @IsEnum(TaxType)
  taxType: TaxType;

  @ApiProperty({ description: 'Amount to calculate tax on', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @ApiProperty({ enum: MarketplaceType })
  @IsEnum(MarketplaceType)
  marketplace: MarketplaceType;

  @ApiProperty({ description: 'Tax jurisdiction' })
  @IsNotEmpty()
  @IsString()
  jurisdiction: string;

  @ApiPropertyOptional({ description: 'Product category' })
  @IsOptional()
  @IsString()
  productCategory?: string;
}

export class EUVATCalculationDto {
  @ApiProperty({ description: 'Selling price', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ description: 'Customer country (2-letter code)' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  customerCountry: string;

  @ApiProperty({ description: 'Product category' })
  @IsNotEmpty()
  @IsString()
  productCategory: string;

  @ApiProperty({ enum: ['b2b', 'b2c'] })
  @IsEnum(['b2b', 'b2c'])
  customerType: 'b2b' | 'b2c';
}

export class USSalesTaxCalculationDto {
  @ApiProperty({ description: 'Selling price', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ description: 'Customer state (2-letter code)' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  customerState: string;

  @ApiPropertyOptional({ description: 'Customer city' })
  @IsOptional()
  @IsString()
  customerCity?: string;
}

export class CustomsDutyCalculationDto {
  @ApiProperty({ description: 'Product category' })
  @IsNotEmpty()
  @IsString()
  productCategory: string;

  @ApiProperty({ description: 'Product value', minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  productValue: number;

  @ApiProperty({ description: 'Origin country (2-letter code)' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  originCountry: string;

  @ApiProperty({ description: 'Destination country (2-letter code)' })
  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  destinationCountry: string;
}

// Profit Analysis DTOs
export class CreateProfitAnalysisDto {
  @ApiProperty({ description: 'Analysis name' })
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  analysisName: string;

  @ApiPropertyOptional({ description: 'Analysis description' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiProperty({ enum: AnalysisType })
  @IsEnum(AnalysisType)
  analysisType: AnalysisType;

  @ApiPropertyOptional({ description: 'Pricing calculation ID' })
  @IsOptional()
  @IsString()
  pricingCalculationId?: string;

  @ApiPropertyOptional({ description: 'Analysis period start' })
  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @ApiPropertyOptional({ description: 'Analysis period end' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] })
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'])
  periodType?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';
}

export class DetailedAnalysisOptionsDto {
  @ApiPropertyOptional({ description: 'Include competitive analysis' })
  @IsOptional()
  @IsBoolean()
  includeCompetitiveAnalysis?: boolean;

  @ApiPropertyOptional({ description: 'Include trend analysis' })
  @IsOptional()
  @IsBoolean()
  includeTrendAnalysis?: boolean;

  @ApiPropertyOptional({ description: 'Include forecast' })
  @IsOptional()
  @IsBoolean()
  includeForecast?: boolean;

  @ApiPropertyOptional({ description: 'Include risk assessment' })
  @IsOptional()
  @IsBoolean()
  includeRiskAssessment?: boolean;

  @ApiPropertyOptional({ enum: ['1_month', '3_months', '6_months', '1_year'] })
  @IsOptional()
  @IsEnum(['1_month', '3_months', '6_months', '1_year'])
  forecastPeriod?: '1_month' | '3_months' | '6_months' | '1_year';

  @ApiPropertyOptional({ description: 'Benchmark data' })
  @IsOptional()
  @IsObject()
  benchmarkData?: {
    industryAverage: number;
    topPerformer: number;
    marketMedian: number;
  };
}

export class PortfolioAnalysisFiltersDto {
  @ApiPropertyOptional({ description: 'Start date for analysis' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for analysis' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Product categories to include' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productCategories?: string[];

  @ApiPropertyOptional({ description: 'Minimum margin filter', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumMargin?: number;
}

export class TrendAnalysisDto {
  @ApiProperty({ enum: ['week', 'month', 'quarter', 'year'], description: 'Analysis period' })
  @IsEnum(['week', 'month', 'quarter', 'year'])
  period: 'week' | 'month' | 'quarter' | 'year';
}

export class CompetitiveAnalysisDto {
  @ApiProperty({ description: 'Product category' })
  @IsNotEmpty()
  @IsString()
  productCategory: string;

  @ApiPropertyOptional({ description: 'Target margin percentage', minimum: 0, default: 15 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  targetMargin?: number;
}

export class RiskAssessmentDto {
  @ApiPropertyOptional({ description: 'Specific calculation IDs to assess' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  calculationIds?: string[];
}

// Filter DTOs
export class CalculationFilterDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Product name search' })
  @IsOptional()
  @IsString()
  productName?: string;

  @ApiPropertyOptional({ enum: MarketplaceType })
  @IsOptional()
  @IsEnum(MarketplaceType)
  marketplace?: MarketplaceType;

  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Only profitable products' })
  @IsOptional()
  @IsBoolean()
  onlyProfitable?: boolean;

  @ApiPropertyOptional({ description: 'Product category' })
  @IsOptional()
  @IsString()
  productCategory?: string;

  @ApiPropertyOptional({ description: 'Minimum margin', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumMargin?: number;

  @ApiPropertyOptional({ description: 'Maximum margin', minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maximumMargin?: number;
}

export class RateHistoryDto {
  @ApiProperty({ description: 'Base currency' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  fromCurrency: string;

  @ApiProperty({ description: 'Quote currency' })
  @IsNotEmpty()
  @IsString()
  @Length(3, 3)
  toCurrency: string;

  @ApiPropertyOptional({ enum: ['week', 'month', 'quarter', 'year'], default: 'month' })
  @IsOptional()
  @IsEnum(['week', 'month', 'quarter', 'year'])
  period?: 'week' | 'month' | 'quarter' | 'year';
}

// Response DTOs
export class CalculationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productName: string;

  @ApiProperty()
  costPrice: number;

  @ApiProperty()
  sellingPrice: number;

  @ApiProperty()
  marketplace: MarketplaceType;

  @ApiProperty()
  fulfillmentMethod: FulfillmentMethod;

  @ApiProperty()
  profitAnalysis: {
    netProfit: number;
    netMargin: number;
    roi: number;
    totalFees: number;
  };

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedCalculationsResponseDto {
  @ApiProperty({ type: [CalculationResponseDto] })
  data: CalculationResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNext: boolean;

  @ApiProperty()
  hasPrev: boolean;
}

export class ErrorResponseDto {
  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  timestamp?: string;

  @ApiPropertyOptional()
  path?: string;
}

export class ValidationErrorDto extends ErrorResponseDto {
  @ApiProperty({ type: [String] })
  message: string[];
}