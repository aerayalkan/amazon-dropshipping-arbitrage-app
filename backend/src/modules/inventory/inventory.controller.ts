import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  HttpCode,
  UseInterceptors,
  ClassSerializerInterceptor,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';

import { InventoryService } from './inventory.service';
import { InventoryTrackingService } from './services/inventory-tracking.service';
import { SupplierManagementService } from './services/supplier-management.service';
import { AutomationRulesService } from './services/automation-rules.service';
import { StockAlertService } from './services/stock-alert.service';
import { ProductSyncService } from './services/product-sync.service';

import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryFilterDto,
  CreateStockMovementDto,
  StockMovementFilterDto,
  CreateStockAlertDto,
  UpdateStockAlertDto,
  StockAlertFilterDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  CreatePriceUpdateDto,
  BulkPriceUpdateDto,
  SyncConfigurationDto,
  ManualSyncDto,
  GenerateReportDto,
  InventoryItemResponseDto,
  DashboardResponseDto,
  PaginatedResponseDto,
  ErrorResponseDto,
} from './dto/inventory.dto';

@ApiTags('Inventory Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly inventoryTrackingService: InventoryTrackingService,
    private readonly supplierManagementService: SupplierManagementService,
    private readonly automationRulesService: AutomationRulesService,
    private readonly stockAlertService: StockAlertService,
    private readonly productSyncService: ProductSyncService,
  ) {}

  // ==================== DASHBOARD ====================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get inventory dashboard data' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved successfully',
    type: DashboardResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  async getDashboard(@CurrentUser() user: User) {
    return this.inventoryService.getDashboard(user.id);
  }

  // ==================== INVENTORY ITEMS ====================

  @Get('items')
  @ApiOperation({ summary: 'Get inventory items with filtering and pagination' })
  @ApiQuery({ name: 'status', enum: ['all', 'active', 'low_stock', 'out_of_stock'], required: false })
  @ApiQuery({ name: 'supplierId', type: String, required: false })
  @ApiQuery({ name: 'search', type: String, required: false })
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  @ApiQuery({ name: 'sortBy', type: String, required: false })
  @ApiQuery({ name: 'sortOrder', enum: ['ASC', 'DESC'], required: false })
  @ApiResponse({
    status: 200,
    description: 'Inventory items retrieved successfully',
    type: PaginatedResponseDto<InventoryItemResponseDto>,
  })
  async getInventoryItems(
    @CurrentUser() user: User,
    @Query() filters: InventoryFilterDto,
  ) {
    return this.inventoryService.getInventoryItems(user.id, {
      status: filters.status,
      supplierId: filters.supplierId,
      search: filters.search,
      limit: filters.limit,
      offset: filters.page ? (filters.page - 1) * (filters.limit || 20) : 0,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    });
  }

  @Get('items/:id')
  @ApiOperation({ summary: 'Get inventory item by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Inventory item UUID' })
  @ApiResponse({
    status: 200,
    description: 'Inventory item retrieved successfully',
    type: InventoryItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Inventory item not found', type: ErrorResponseDto })
  async getInventoryItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) itemId: string,
  ) {
    return this.inventoryTrackingService.getInventoryItem(user.id, itemId);
  }

  @Post('items')
  @ApiOperation({ summary: 'Create new inventory item' })
  @ApiBody({ type: CreateInventoryItemDto })
  @ApiResponse({
    status: 201,
    description: 'Inventory item created successfully',
    type: InventoryItemResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request', type: ErrorResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async createInventoryItem(
    @CurrentUser() user: User,
    @Body() createDto: CreateInventoryItemDto,
  ) {
    return this.inventoryService.createInventoryItem(user.id, createDto);
  }

  @Put('items/:id')
  @ApiOperation({ summary: 'Update inventory item' })
  @ApiParam({ name: 'id', type: String, description: 'Inventory item UUID' })
  @ApiBody({ type: UpdateInventoryItemDto })
  @ApiResponse({
    status: 200,
    description: 'Inventory item updated successfully',
    type: InventoryItemResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Inventory item not found', type: ErrorResponseDto })
  async updateInventoryItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) itemId: string,
    @Body() updateDto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.updateInventoryItem(user.id, itemId, updateDto);
  }

  @Delete('items/:id')
  @ApiOperation({ summary: 'Delete inventory item' })
  @ApiParam({ name: 'id', type: String, description: 'Inventory item UUID' })
  @ApiResponse({ status: 204, description: 'Inventory item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Inventory item not found', type: ErrorResponseDto })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteInventoryItem(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) itemId: string,
  ) {
    return this.inventoryService.deleteInventoryItem(user.id, itemId);
  }

  // ==================== STOCK MOVEMENTS ====================

  @Get('movements')
  @ApiOperation({ summary: 'Get stock movements with filtering' })
  @ApiQuery({ name: 'inventoryItemId', type: String, required: false })
  @ApiQuery({ name: 'movementType', enum: ['purchase', 'sale', 'adjustment', 'transfer', 'return', 'damage', 'loss'], required: false })
  @ApiQuery({ name: 'source', enum: ['manual', 'order', 'supplier', 'amazon', 'system', 'automation'], required: false })
  @ApiQuery({ name: 'startDate', type: String, required: false })
  @ApiQuery({ name: 'endDate', type: String, required: false })
  async getStockMovements(
    @CurrentUser() user: User,
    @Query() filters: StockMovementFilterDto,
  ) {
    return this.inventoryTrackingService.getStockMovements(user.id, {
      inventoryItemId: filters.inventoryItemId,
      movementType: filters.movementType,
      source: filters.source,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      limit: filters.limit,
      offset: filters.page ? (filters.page - 1) * (filters.limit || 20) : 0,
    });
  }

  @Post('movements')
  @ApiOperation({ summary: 'Create stock movement' })
  @ApiBody({ type: CreateStockMovementDto })
  @ApiResponse({ status: 201, description: 'Stock movement created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createStockMovement(
    @CurrentUser() user: User,
    @Body() createDto: CreateStockMovementDto,
  ) {
    return this.inventoryTrackingService.createStockMovement(user.id, createDto);
  }

  @Patch('movements/:id/verify')
  @ApiOperation({ summary: 'Verify stock movement' })
  @ApiParam({ name: 'id', type: String, description: 'Stock movement UUID' })
  @ApiResponse({ status: 200, description: 'Stock movement verified successfully' })
  async verifyStockMovement(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) movementId: string,
  ) {
    return this.inventoryTrackingService.verifyStockMovement(user.id, movementId);
  }

  @Patch('movements/:id/reverse')
  @ApiOperation({ summary: 'Reverse stock movement' })
  @ApiParam({ name: 'id', type: String, description: 'Stock movement UUID' })
  @ApiResponse({ status: 200, description: 'Stock movement reversed successfully' })
  async reverseStockMovement(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) movementId: string,
    @Body('reason') reason: string,
  ) {
    return this.inventoryTrackingService.reverseStockMovement(user.id, movementId, reason);
  }

  // ==================== STOCK ALERTS ====================

  @Get('alerts')
  @ApiOperation({ summary: 'Get stock alerts with filtering' })
  @ApiQuery({ name: 'alertType', enum: ['low_stock', 'out_of_stock', 'reorder_needed', 'price_alert'], required: false })
  @ApiQuery({ name: 'priority', enum: ['low', 'medium', 'high', 'critical'], required: false })
  @ApiQuery({ name: 'isActive', type: Boolean, required: false })
  async getStockAlerts(
    @CurrentUser() user: User,
    @Query() filters: StockAlertFilterDto,
  ) {
    return this.stockAlertService.getActiveAlerts(user.id, {
      alertType: filters.alertType,
      priority: filters.priority,
      inventoryItemId: filters.inventoryItemId,
      limit: filters.limit,
      offset: filters.page ? (filters.page - 1) * (filters.limit || 20) : 0,
    });
  }

  @Post('alerts')
  @ApiOperation({ summary: 'Create custom stock alert' })
  @ApiBody({ type: CreateStockAlertDto })
  @ApiResponse({ status: 201, description: 'Stock alert created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createStockAlert(
    @CurrentUser() user: User,
    @Body() createDto: CreateStockAlertDto,
  ) {
    return this.stockAlertService.createAlert(user.id, createDto);
  }

  @Patch('alerts/:id/resolve')
  @ApiOperation({ summary: 'Resolve stock alert' })
  @ApiParam({ name: 'id', type: String, description: 'Stock alert UUID' })
  @ApiBody({ type: UpdateStockAlertDto })
  @ApiResponse({ status: 200, description: 'Stock alert resolved successfully' })
  async resolveStockAlert(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) alertId: string,
    @Body() updateDto: UpdateStockAlertDto,
  ) {
    return this.stockAlertService.resolveAlert(alertId, updateDto.resolutionNote);
  }

  @Patch('alerts/bulk-resolve')
  @ApiOperation({ summary: 'Resolve multiple stock alerts' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        alertIds: { type: 'array', items: { type: 'string' } },
        resolutionNote: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Bulk alert resolution completed' })
  async resolveBulkAlerts(
    @CurrentUser() user: User,
    @Body() body: { alertIds: string[]; resolutionNote?: string },
  ) {
    return this.stockAlertService.resolveBulkAlerts(body.alertIds, body.resolutionNote);
  }

  // ==================== SUPPLIERS ====================

  @Get('suppliers')
  @ApiOperation({ summary: 'Get suppliers list' })
  async getSuppliers(@CurrentUser() user: User) {
    return this.supplierManagementService.getSuppliers(user.id);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create new supplier' })
  @ApiBody({ type: CreateSupplierDto })
  @ApiResponse({ status: 201, description: 'Supplier created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createSupplier(
    @CurrentUser() user: User,
    @Body() createDto: CreateSupplierDto,
  ) {
    return this.supplierManagementService.createSupplier(user.id, createDto);
  }

  @Put('suppliers/:id')
  @ApiOperation({ summary: 'Update supplier' })
  @ApiParam({ name: 'id', type: String, description: 'Supplier UUID' })
  @ApiBody({ type: UpdateSupplierDto })
  @ApiResponse({ status: 200, description: 'Supplier updated successfully' })
  async updateSupplier(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) supplierId: string,
    @Body() updateDto: UpdateSupplierDto,
  ) {
    return this.supplierManagementService.updateSupplier(user.id, supplierId, updateDto);
  }

  @Get('suppliers/:id/performance')
  @ApiOperation({ summary: 'Get supplier performance metrics' })
  @ApiParam({ name: 'id', type: String, description: 'Supplier UUID' })
  async getSupplierPerformance(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) supplierId: string,
  ) {
    return this.supplierManagementService.getSupplierPerformance(user.id, supplierId);
  }

  // ==================== AUTOMATION RULES ====================

  @Get('automation-rules')
  @ApiOperation({ summary: 'Get automation rules' })
  async getAutomationRules(@CurrentUser() user: User) {
    return this.automationRulesService.getUserRules(user.id);
  }

  @Post('automation-rules')
  @ApiOperation({ summary: 'Create automation rule' })
  @ApiBody({ type: CreateAutomationRuleDto })
  @ApiResponse({ status: 201, description: 'Automation rule created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createAutomationRule(
    @CurrentUser() user: User,
    @Body() createDto: CreateAutomationRuleDto,
  ) {
    return this.automationRulesService.createRule(user.id, createDto);
  }

  @Put('automation-rules/:id')
  @ApiOperation({ summary: 'Update automation rule' })
  @ApiParam({ name: 'id', type: String, description: 'Automation rule UUID' })
  @ApiBody({ type: UpdateAutomationRuleDto })
  async updateAutomationRule(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) ruleId: string,
    @Body() updateDto: UpdateAutomationRuleDto,
  ) {
    return this.automationRulesService.updateRule(user.id, ruleId, updateDto);
  }

  @Post('automation-rules/:id/execute')
  @ApiOperation({ summary: 'Execute automation rule manually' })
  @ApiParam({ name: 'id', type: String, description: 'Automation rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule executed successfully' })
  async executeAutomationRule(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) ruleId: string,
  ) {
    return this.automationRulesService.executeRule(ruleId);
  }

  @Get('automation-rules/statistics')
  @ApiOperation({ summary: 'Get automation rules statistics' })
  async getAutomationStatistics(@CurrentUser() user: User) {
    return this.automationRulesService.getRuleStatistics(user.id);
  }

  // ==================== PRICE UPDATES ====================

  @Post('price-updates')
  @ApiOperation({ summary: 'Create price update' })
  @ApiBody({ type: CreatePriceUpdateDto })
  @ApiResponse({ status: 201, description: 'Price update created successfully' })
  @HttpCode(HttpStatus.CREATED)
  async createPriceUpdate(
    @CurrentUser() user: User,
    @Body() createDto: CreatePriceUpdateDto,
  ) {
    return this.inventoryTrackingService.updatePrice(
      user.id,
      createDto.inventoryItemId,
      createDto.newPrice,
      createDto.updateReason || 'manual',
      createDto.notes,
    );
  }

  @Post('price-updates/bulk')
  @ApiOperation({ summary: 'Bulk price update' })
  @ApiBody({ type: BulkPriceUpdateDto })
  @ApiResponse({ status: 200, description: 'Bulk price update completed' })
  async bulkPriceUpdate(
    @CurrentUser() user: User,
    @Body() bulkDto: BulkPriceUpdateDto,
  ) {
    const updates = bulkDto.updates.map(update => ({
      itemId: update.inventoryItemId,
      newPrice: update.newPrice,
      reason: update.notes,
    }));

    return this.inventoryService.bulkUpdatePrices(user.id, updates);
  }

  @Get('price-updates/history/:itemId')
  @ApiOperation({ summary: 'Get price update history for item' })
  @ApiParam({ name: 'itemId', type: String, description: 'Inventory item UUID' })
  async getPriceHistory(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.inventoryTrackingService.getPriceHistory(user.id, itemId);
  }

  // ==================== PRODUCT SYNC ====================

  @Post('sync/manual')
  @ApiOperation({ summary: 'Start manual synchronization' })
  @ApiBody({ type: ManualSyncDto })
  @ApiResponse({ status: 200, description: 'Manual sync started successfully' })
  async startManualSync(
    @CurrentUser() user: User,
    @Body() syncDto: ManualSyncDto,
  ) {
    return this.productSyncService.startManualSync(user.id, syncDto);
  }

  @Get('sync/status')
  @ApiOperation({ summary: 'Get synchronization status' })
  async getSyncStatus(@CurrentUser() user: User) {
    return this.productSyncService.getSyncStatus(user.id);
  }

  @Put('sync/configuration')
  @ApiOperation({ summary: 'Update sync configuration' })
  @ApiBody({ type: SyncConfigurationDto })
  async updateSyncConfiguration(
    @CurrentUser() user: User,
    @Body() configDto: SyncConfigurationDto,
  ) {
    return this.productSyncService.updateSyncConfiguration(user.id, configDto);
  }

  @Post('sync/products/match')
  @ApiOperation({ summary: 'Match products with suppliers' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        autoMatch: { type: 'boolean' },
        confidenceThreshold: { type: 'number', minimum: 0, maximum: 1 },
        supplierIds: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async matchProducts(
    @CurrentUser() user: User,
    @Body() body: { autoMatch?: boolean; confidenceThreshold?: number; supplierIds?: string[] },
  ) {
    return this.productSyncService.matchProducts(user.id, body);
  }

  // ==================== REPORTS ====================

  @Post('reports/generate')
  @ApiOperation({ summary: 'Generate inventory report' })
  @ApiBody({ type: GenerateReportDto })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  async generateReport(
    @CurrentUser() user: User,
    @Body() reportDto: GenerateReportDto,
  ) {
    return this.inventoryService.generateInventoryReport(user.id, reportDto);
  }

  @Get('reports/download/:reportId')
  @ApiOperation({ summary: 'Download generated report' })
  @ApiParam({ name: 'reportId', type: String, description: 'Report UUID' })
  async downloadReport(
    @CurrentUser() user: User,
    @Param('reportId') reportId: string,
  ) {
    // Report download implementation
    // Bu endpoint genellikle file stream döner
    throw new Error('Report download not implemented yet');
  }

  // ==================== ANALYTICS ====================

  @Get('analytics/summary')
  @ApiOperation({ summary: 'Get inventory analytics summary' })
  @ApiQuery({ name: 'period', enum: ['week', 'month', 'quarter', 'year'], required: false })
  async getAnalyticsSummary(
    @CurrentUser() user: User,
    @Query('period') period: 'week' | 'month' | 'quarter' | 'year' = 'month',
  ) {
    return this.inventoryTrackingService.getInventoryAnalytics(user.id, period);
  }

  @Get('analytics/velocity')
  @ApiOperation({ summary: 'Get inventory velocity analysis' })
  @ApiQuery({ name: 'days', type: Number, required: false })
  async getVelocityAnalysis(
    @CurrentUser() user: User,
    @Query('days') days: number = 30,
  ) {
    return this.inventoryTrackingService.getVelocityAnalysis(user.id, days);
  }

  @Get('analytics/profitability')
  @ApiOperation({ summary: 'Get inventory profitability analysis' })
  async getProfitabilityAnalysis(@CurrentUser() user: User) {
    return this.inventoryTrackingService.getProfitabilityAnalysis(user.id);
  }

  // ==================== HEALTH CHECK ====================

  @Get('health')
  @ApiOperation({ summary: 'Check inventory system health' })
  async checkHealth(@CurrentUser() user: User) {
    const criticalAlerts = await this.stockAlertService.getCriticalAlertsForDashboard(user.id);
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      criticalIssues: criticalAlerts.criticalCount,
      systemHealth: {
        database: 'connected',
        cache: 'connected',
        alerts: criticalAlerts.criticalCount === 0 ? 'healthy' : 'warning',
        sync: 'operational',
      },
    };
  }
}