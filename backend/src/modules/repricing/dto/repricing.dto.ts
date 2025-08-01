import {
  IsString,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsArray,
  IsObject,
  ValidateNested,
  Min,
  Max,
  IsUUID,
  IsDateString,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  RuleType,
  TriggerCondition,
  ActionType,
  RuleStatus,
  Priority,
} from '../entities/repricing-rule.entity';
import { TriggerSource } from '../entities/repricing-session.entity';

// Create Repricing Rule DTOs
export class CreateTriggerConditionDto {
  @ApiProperty({ enum: TriggerCondition })
  @IsEnum(TriggerCondition)
  condition: TriggerCondition;

  @ApiProperty()
  @IsObject()
  parameters: any;
}

export class CreateActionDto {
  @ApiProperty({ enum: ActionType })
  @IsEnum(ActionType)
  action: ActionType;

  @ApiProperty()
  @IsObject()
  parameters: any;

  @ApiPropertyOptional({ enum: ActionType })
  @IsEnum(ActionType)
  @IsOptional()
  failureAction?: ActionType;
}

export class CreateConstraintsDto {
  @ApiProperty()
  @IsObject()
  pricing: {
    minPrice?: number;
    maxPrice?: number;
    minMargin?: number;
    maxMargin?: number;
    minProfit?: number;
    respectMAP?: boolean;
  };

  @ApiProperty()
  @IsObject()
  execution: {
    maxPriceIncrease?: number;
    maxPriceDecrease?: number;
    maxDailyChanges?: number;
    blackoutPeriods?: Array<{
      startTime: string;
      endTime: string;
      days: number[];
      timezone?: string;
    }>;
  };

  @ApiProperty()
  @IsObject()
  competition: {
    minCompetitors?: number;
    maxCompetitors?: number;
    excludeCompetitors?: string[];
    trustLevel?: 'all' | 'high_rating' | 'prime_only';
  };
}

export class CreateRepricingRuleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ruleName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: RuleType })
  @IsEnum(RuleType)
  ruleType: RuleType;

  @ApiProperty({ enum: Priority })
  @IsEnum(Priority)
  priority: Priority;

  @ApiProperty()
  @IsObject()
  targetConfiguration: {
    productIds?: string[];
    asins?: string[];
    categories?: string[];
    suppliers?: string[];
    tags?: string[];
    priceRange?: { min: number; max: number };
    marginRange?: { min: number; max: number };
    excludeProducts?: string[];
  };

  @ApiProperty()
  @ValidateNested()
  @Type(() => CreateTriggerConditionDto)
  triggerConditions: {
    primary: CreateTriggerConditionDto;
    secondary?: Array<{
      condition: TriggerCondition;
      parameters: any;
      operator: 'AND' | 'OR';
    }>;
    cooldownMinutes?: number;
    maxExecutionsPerDay?: number;
  };

  @ApiProperty()
  @ValidateNested()
  @Type(() => CreateActionDto)
  actions: {
    primary: CreateActionDto;
    secondary?: Array<{
      action: ActionType;
      parameters: any;
      condition?: any;
      delay?: number;
    }>;
    notifications?: Array<{
      type: 'email' | 'sms' | 'webhook';
      recipients: string[];
      template?: string;
      condition?: 'always' | 'on_success' | 'on_failure';
    }>;
  };

  @ApiProperty()
  @ValidateNested()
  @Type(() => CreateConstraintsDto)
  constraints: CreateConstraintsDto;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  schedule?: {
    frequency: 'continuous' | 'hourly' | 'daily' | 'weekly' | 'custom';
    interval?: number;
    specificTimes?: string[];
    timezone?: string;
    startDate?: Date;
    endDate?: Date;
  };

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateRepricingRuleDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ruleName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: RuleStatus })
  @IsEnum(RuleStatus)
  @IsOptional()
  ruleStatus?: RuleStatus;

  @ApiPropertyOptional({ enum: Priority })
  @IsEnum(Priority)
  @IsOptional()
  priority?: Priority;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  targetConfiguration?: any;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  triggerConditions?: any;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  actions?: any;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  constraints?: any;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  schedule?: any;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

// Manual Repricing DTOs
export class TriggerManualRepricingDto {
  @ApiProperty()
  @IsUUID()
  ruleId: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  productIds?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}

// Competitor Monitoring DTOs
export class AddCompetitorDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  asin: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sellerName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sellerId?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  initialPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  @IsOptional()
  monitoringFrequency?: number; // minutes

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  alertSettings?: {
    priceDropAlert: boolean;
    priceIncreaseAlert: boolean;
    buyBoxLossAlert: boolean;
    stockOutAlert: boolean;
    thresholds: {
      priceChangePercentage: number;
      priceAbsolute?: number;
    };
  };

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCompetitorDto {
  @ApiPropertyOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  @IsOptional()
  monitoringFrequency?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  isMonitored?: boolean;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  alertSettings?: any;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class MonitorASINsDto {
  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  asins: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  forceUpdate?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  includeNewCompetitors?: boolean;
}

// Buy Box Analysis DTOs
export class RecordBuyBoxLossDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  asin: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productTitle: string;

  @ApiProperty()
  @IsObject()
  previousWinner: {
    sellerId?: string;
    sellerName: string;
    price: number;
  };

  @ApiProperty()
  @IsObject()
  newWinner: {
    sellerId?: string;
    sellerName: string;
    price: number;
    primeEligible?: boolean;
    fulfillmentType?: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  ourData?: {
    sellerId?: string;
    sellerName?: string;
    price: number;
    primeEligible?: boolean;
    fulfillmentType?: string;
    stockQuantity?: number;
  };

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  competitors?: any[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  lossReason?: string;
}

export class RecordBuyBoxWinDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  asin: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productTitle: string;

  @ApiProperty()
  @IsObject()
  ourData: {
    sellerId?: string;
    sellerName: string;
    price: number;
    primeEligible?: boolean;
    fulfillmentType?: string;
  };

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  previousWinner?: {
    sellerId?: string;
    sellerName: string;
    price: number;
  };

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  winStrategy?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  competitors?: any[];

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  responseTime?: number; // minutes
}

// Market Analysis DTOs
export class GetMarketAnalysisDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  asin: string;

  @ApiPropertyOptional({ enum: ['week', 'month', 'quarter'] })
  @IsEnum(['week', 'month', 'quarter'])
  @IsOptional()
  period?: 'week' | 'month' | 'quarter';
}

export class IdentifyOpportunitiesDto {
  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  asins?: string[];

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}

// Price Optimization DTOs
export class OptimizePriceDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  asin: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  currentPrice: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costPrice: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  targetMargin?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  minMargin?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  inventoryLevel?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  salesVelocity?: number;

  @ApiProperty()
  @IsObject()
  businessGoals: {
    primaryGoal: 'profit_maximization' | 'market_share' | 'buy_box_win' | 'inventory_turnover';
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    timeHorizon: 'short_term' | 'medium_term' | 'long_term';
  };
}

export class CreateDynamicStrategyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  productIds: string[];

  @ApiProperty()
  @IsEnum(['profit_maximization', 'market_share', 'buy_box_win', 'inventory_turnover'])
  primaryGoal: 'profit_maximization' | 'market_share' | 'buy_box_win' | 'inventory_turnover';

  @ApiProperty()
  @IsEnum(['conservative', 'moderate', 'aggressive'])
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';

  @ApiProperty()
  @IsObject()
  constraints: {
    maxPriceIncrease: number;
    maxPriceDecrease: number;
    minMargin: number;
  };

  @ApiProperty()
  @IsEnum(['low', 'medium', 'high'])
  marketResponseSensitivity: 'low' | 'medium' | 'high';
}

// Query DTOs
export class GetRepricingRulesQueryDto {
  @ApiPropertyOptional()
  @IsEnum(RuleStatus)
  @IsOptional()
  @Transform(({ value }) => value)
  status?: RuleStatus;

  @ApiPropertyOptional()
  @IsEnum(RuleType)
  @IsOptional()
  @Transform(({ value }) => value)
  type?: RuleType;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  tags?: string[];

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

export class GetCompetitorsQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  asin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  sellerName?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  isMonitored?: boolean;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  tags?: string[];

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  priceRange?: { min: number; max: number };

  @ApiPropertyOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}

export class GetPerformanceReportQueryDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  ruleId?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsEnum(['day', 'week', 'month'])
  @IsOptional()
  period?: 'day' | 'week' | 'month';

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

// Response DTOs
export class RepricingRuleResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ruleName: string;

  @ApiProperty()
  description?: string;

  @ApiProperty({ enum: RuleType })
  ruleType: RuleType;

  @ApiProperty({ enum: RuleStatus })
  ruleStatus: RuleStatus;

  @ApiProperty({ enum: Priority })
  priority: Priority;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  targetConfiguration: any;

  @ApiProperty()
  triggerConditions: any;

  @ApiProperty()
  actions: any;

  @ApiProperty()
  constraints: any;

  @ApiProperty()
  schedule?: any;

  @ApiProperty()
  totalExecutions: number;

  @ApiProperty()
  successfulExecutions: number;

  @ApiProperty()
  failedExecutions: number;

  @ApiProperty()
  performanceMetrics?: any;

  @ApiProperty()
  lastExecutionTime?: Date;

  @ApiProperty()
  nextExecutionTime?: Date;

  @ApiProperty()
  tags?: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class RepricingSessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ruleId: string;

  @ApiProperty()
  sessionStatus: string;

  @ApiProperty()
  triggerSource: TriggerSource;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty()
  completedAt?: Date;

  @ApiProperty()
  totalProducts: number;

  @ApiProperty()
  successfulUpdates: number;

  @ApiProperty()
  failedUpdates: number;

  @ApiProperty()
  skippedUpdates: number;

  @ApiProperty()
  priceChangesSummary?: any;

  @ApiProperty()
  performanceMetrics?: any;

  @ApiProperty()
  executionResults: any[];
}

export class CompetitorResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  asin: string;

  @ApiProperty()
  sellerName: string;

  @ApiProperty()
  sellerId?: string;

  @ApiProperty()
  productTitle: string;

  @ApiProperty()
  currentPrice: number;

  @ApiProperty()
  previousPrice?: number;

  @ApiProperty()
  buyBoxWinner: boolean;

  @ApiProperty()
  isPrimeEligible: boolean;

  @ApiProperty()
  fulfillmentType?: string;

  @ApiProperty()
  competitorStatus: string;

  @ApiProperty()
  isMonitored: boolean;

  @ApiProperty()
  lastScrapedAt: Date;

  @ApiProperty()
  performanceMetrics?: any;

  @ApiProperty()
  tags?: string[];
}

export class MarketAnalysisResponseDto {
  @ApiProperty()
  asin: string;

  @ApiProperty()
  analysisDate: Date;

  @ApiProperty()
  period: {
    startDate: Date;
    endDate: Date;
    days: number;
  };

  @ApiProperty()
  priceAnalysis: any;

  @ApiProperty()
  competitionAnalysis: any;

  @ApiProperty()
  demandAnalysis: any;

  @ApiProperty()
  recommendations: any[];
}

export class PriceOptimizationResponseDto {
  @ApiProperty()
  recommendedPrice: number;

  @ApiProperty()
  priceChange: number;

  @ApiProperty()
  priceChangePercent: number;

  @ApiProperty()
  confidence: number;

  @ApiProperty()
  reasoning: string;

  @ApiProperty()
  expectedOutcomes: any;

  @ApiProperty()
  risks: any[];

  @ApiProperty()
  alternatives: any[];
}