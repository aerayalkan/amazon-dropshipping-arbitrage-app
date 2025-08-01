import { 
  IsString, 
  IsNumber, 
  IsOptional, 
  IsBoolean, 
  IsUUID, 
  IsArray,
  IsEnum,
  IsDateString,
  IsPositive,
  Min,
  Max,
  IsNotEmpty,
  ValidateNested,
  ArrayMinSize,
  IsEmail,
  IsUrl,
  Length,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { MovementType, MovementSource } from '../entities/stock-movement.entity';
import { AlertType, AlertPriority } from '../entities/stock-alert.entity';
import { RuleType, TriggerType, ActionType } from '../entities/automation-rule.entity';
import { UpdateReason } from '../entities/price-update-log.entity';

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

// Inventory Item DTOs
export class CreateInventoryItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(10, 10)
  @Matches(/^[A-Z0-9]{10}$/, { message: 'ASIN must be 10 alphanumeric characters' })
  asin?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  productName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(8, 50)
  barcode?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierProductId?: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellingPrice: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  currentStock: number;

  @ApiProperty({ minimum: 0 })
  @IsNumber()
  @Min(0)
  reorderPoint: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStockLevel?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

export class UpdateInventoryItemDto extends PartialType(CreateInventoryItemDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class InventoryFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['all', 'active', 'low_stock', 'out_of_stock'] })
  @IsOptional()
  @IsEnum(['all', 'active', 'low_stock', 'out_of_stock'])
  status?: 'all' | 'active' | 'low_stock' | 'out_of_stock';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

// Stock Movement DTOs
export class CreateStockMovementDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  inventoryItemId: string;

  @ApiProperty({ enum: MovementType })
  @IsEnum(MovementType)
  movementType: MovementType;

  @ApiPropertyOptional({ enum: MovementSource })
  @IsOptional()
  @IsEnum(MovementSource)
  source?: MovementSource;

  @ApiProperty()
  @IsNumber()
  quantity: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: any;
}

export class StockMovementFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @ApiPropertyOptional({ enum: MovementType })
  @IsOptional()
  @IsEnum(MovementType)
  movementType?: MovementType;

  @ApiPropertyOptional({ enum: MovementSource })
  @IsOptional()
  @IsEnum(MovementSource)
  source?: MovementSource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

// Stock Alert DTOs
export class CreateStockAlertDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  inventoryItemId: string;

  @ApiProperty({ enum: AlertType })
  @IsEnum(AlertType)
  alertType: AlertType;

  @ApiPropertyOptional({ enum: AlertPriority })
  @IsOptional()
  @IsEnum(AlertPriority)
  priority?: AlertPriority;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  title: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 1000)
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  data?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateStockAlertDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  resolutionNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class StockAlertFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;

  @ApiPropertyOptional({ enum: AlertPriority })
  @IsOptional()
  @IsEnum(AlertPriority)
  priority?: AlertPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  inventoryItemId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Supplier DTOs
export class CreateSupplierDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 20)
  contactPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 100)
  country?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minimumOrderQuantity?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  leadTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethods?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  shippingMethods?: string[];
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Automation Rule DTOs
export class CreateAutomationRuleDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @Length(1, 255)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiProperty({ enum: RuleType })
  @IsEnum(RuleType)
  ruleType: RuleType;

  @ApiProperty()
  @IsNotEmpty()
  conditions: {
    triggers: Array<{
      type: TriggerType;
      operator: 'equals' | 'greater_than' | 'less_than' | 'between' | 'contains';
      value: any;
      threshold?: number;
      percentage?: number;
    }>;
    logicalOperator: 'AND' | 'OR';
    timeWindow?: {
      start?: string;
      end?: string;
      timezone?: string;
    };
    excludeDays?: number[];
  };

  @ApiProperty()
  @IsNotEmpty()
  actions: {
    primaryAction: {
      type: ActionType;
      parameters: any;
    };
    secondaryActions?: Array<{
      type: ActionType;
      parameters: any;
      delay?: number;
      condition?: any;
    }>;
    notifications?: Array<{
      type: 'email' | 'sms' | 'webhook';
      recipients: string[];
      template?: string;
      condition?: any;
    }>;
  };

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetProductIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  targetCategories?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  schedule?: {
    frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'monthly';
    interval?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    timeOfDay?: string;
    timezone?: string;
  };

  @ApiPropertyOptional()
  @IsOptional()
  limits?: {
    maxExecutionsPerDay?: number;
    maxExecutionsPerHour?: number;
    cooldownMinutes?: number;
    maxAffectedItems?: number;
  };
}

export class UpdateAutomationRuleDto extends PartialType(CreateAutomationRuleDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Price Update DTOs
export class CreatePriceUpdateDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  inventoryItemId: string;

  @ApiProperty({ minimum: 0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  newPrice: number;

  @ApiPropertyOptional({ enum: UpdateReason })
  @IsOptional()
  @IsEnum(UpdateReason)
  updateReason?: UpdateReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: any;
}

export class BulkPriceUpdateDto {
  @ApiProperty({ type: [Object] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePriceUpdateDto)
  updates: CreatePriceUpdateDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 255)
  reason?: string;
}

// Product Sync DTOs
export class SyncConfigurationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSync?: boolean;

  @ApiPropertyOptional({ enum: ['hourly', 'daily', 'weekly'] })
  @IsOptional()
  @IsEnum(['hourly', 'daily', 'weekly'])
  syncFrequency?: 'hourly' | 'daily' | 'weekly';

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(23)
  syncHour?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 6 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(6)
  syncDayOfWeek?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  enabledSuppliers?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  syncTypes?: {
    prices: boolean;
    stock: boolean;
    productInfo: boolean;
    availability: boolean;
  };

  @ApiPropertyOptional()
  @IsOptional()
  conflictResolution?: {
    priceConflict: 'supplier_wins' | 'manual_review' | 'no_change';
    stockConflict: 'supplier_wins' | 'manual_review' | 'no_change';
  };

  @ApiPropertyOptional()
  @IsOptional()
  notifications?: {
    onSuccess: boolean;
    onFailure: boolean;
    onConflicts: boolean;
    emailRecipients: string[];
  };
}

export class ManualSyncDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  supplierIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  inventoryItemIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  syncTypes?: {
    prices: boolean;
    stock: boolean;
    productInfo: boolean;
    availability: boolean;
  };

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;
}

// Report DTOs
export class GenerateReportDto {
  @ApiProperty({ enum: ['json', 'csv', 'excel'] })
  @IsEnum(['json', 'csv', 'excel'])
  format: 'json' | 'csv' | 'excel';

  @ApiProperty({ enum: ['current', 'week', 'month', 'quarter'] })
  @IsEnum(['current', 'week', 'month', 'quarter'])
  period: 'current' | 'week' | 'month' | 'quarter';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeMovements?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  includeAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoryFilter?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  supplierFilter?: string[];
}

// Response DTOs
export class InventoryItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productName: string;

  @ApiPropertyOptional()
  sku?: string;

  @ApiPropertyOptional()
  asin?: string;

  @ApiProperty()
  currentStock: number;

  @ApiProperty()
  reorderPoint: number;

  @ApiProperty()
  costPrice: number;

  @ApiProperty()
  sellingPrice: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  supplier?: {
    id: string;
    name: string;
    country: string;
  };
}

export class DashboardResponseDto {
  @ApiProperty()
  summary: {
    totalItems: number;
    activeItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalValue: number;
    avgStockDays: number;
  };

  @ApiProperty()
  alerts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };

  @ApiProperty()
  movements: {
    todayMovements: number;
    weeklyMovements: number;
    monthlyMovements: number;
  };

  @ApiProperty()
  suppliers: {
    totalSuppliers: number;
    activeSuppliers: number;
    reliableSuppliers: number;
  };
}

export class PaginatedResponseDto<T> {
  @ApiProperty()
  data: T[];

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

// Error DTOs
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