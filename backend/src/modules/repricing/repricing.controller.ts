import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import { RepricingEngineService } from './services/repricing-engine.service';
import { CompetitorMonitoringService } from './services/competitor-monitoring.service';
import { BuyBoxAnalyzerService } from './services/buybox-analyzer.service';
import { MarketAnalysisService } from './services/market-analysis.service';
import { PriceOptimizationService } from './services/price-optimization.service';

import {
  CreateRepricingRuleDto,
  UpdateRepricingRuleDto,
  TriggerManualRepricingDto,
  AddCompetitorDto,
  UpdateCompetitorDto,
  MonitorASINsDto,
  RecordBuyBoxLossDto,
  RecordBuyBoxWinDto,
  GetMarketAnalysisDto,
  IdentifyOpportunitiesDto,
  OptimizePriceDto,
  CreateDynamicStrategyDto,
  GetRepricingRulesQueryDto,
  GetCompetitorsQueryDto,
  GetPerformanceReportQueryDto,
  RepricingRuleResponseDto,
  RepricingSessionResponseDto,
  CompetitorResponseDto,
  MarketAnalysisResponseDto,
  PriceOptimizationResponseDto,
} from './dto/repricing.dto';

@ApiTags('Repricing & Competitor Analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('repricing')
export class RepricingController {
  constructor(
    private readonly repricingEngineService: RepricingEngineService,
    private readonly competitorMonitoringService: CompetitorMonitoringService,
    private readonly buyBoxAnalyzerService: BuyBoxAnalyzerService,
    private readonly marketAnalysisService: MarketAnalysisService,
    private readonly priceOptimizationService: PriceOptimizationService,
  ) {}

  // Repricing Rules Management
  @Post('rules')
  @ApiOperation({ 
    summary: 'Create new repricing rule',
    description: 'Create a new automated repricing rule with custom triggers, actions, and constraints'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Repricing rule created successfully',
    type: RepricingRuleResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async createRepricingRule(
    @CurrentUser('id') userId: string,
    @Body() createRuleDto: CreateRepricingRuleDto,
  ): Promise<RepricingRuleResponseDto> {
    try {
      // Would implement rule creation logic
      throw new HttpException('Implementation pending', HttpStatus.NOT_IMPLEMENTED);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create repricing rule',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rules')
  @ApiOperation({ 
    summary: 'Get repricing rules',
    description: 'Retrieve all repricing rules with optional filtering'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Rules retrieved successfully',
    type: [RepricingRuleResponseDto]
  })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'paused', 'disabled', 'draft', 'archived'] })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getRepricingRules(
    @CurrentUser('id') userId: string,
    @Query() query: GetRepricingRulesQueryDto,
  ): Promise<{
    rules: RepricingRuleResponseDto[];
    total: number;
    analytics: {
      totalRules: number;
      activeRules: number;
      avgSuccessRate: number;
      totalExecutions: number;
    };
  }> {
    try {
      // Would implement rules retrieval logic
      return {
        rules: [],
        total: 0,
        analytics: {
          totalRules: 0,
          activeRules: 0,
          avgSuccessRate: 0,
          totalExecutions: 0,
        },
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve repricing rules',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('rules/:id')
  @ApiOperation({ 
    summary: 'Get repricing rule by ID',
    description: 'Retrieve detailed information about a specific repricing rule'
  })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Rule retrieved successfully',
    type: RepricingRuleResponseDto
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async getRepricingRuleById(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) ruleId: string,
  ): Promise<RepricingRuleResponseDto> {
    try {
      // Would implement rule retrieval by ID logic
      throw new HttpException('Rule not found', HttpStatus.NOT_FOUND);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve repricing rule',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('rules/:id')
  @ApiOperation({ 
    summary: 'Update repricing rule',
    description: 'Update an existing repricing rule configuration'
  })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Rule updated successfully',
    type: RepricingRuleResponseDto
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async updateRepricingRule(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) ruleId: string,
    @Body() updateRuleDto: UpdateRepricingRuleDto,
  ): Promise<RepricingRuleResponseDto> {
    try {
      // Would implement rule update logic
      throw new HttpException('Implementation pending', HttpStatus.NOT_IMPLEMENTED);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update repricing rule',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('rules/:id')
  @ApiOperation({ 
    summary: 'Delete repricing rule',
    description: 'Delete a repricing rule and stop all associated executions'
  })
  @ApiParam({ name: 'id', description: 'Rule ID' })
  @ApiResponse({ status: 200, description: 'Rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async deleteRepricingRule(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) ruleId: string,
  ): Promise<{ message: string }> {
    try {
      // Would implement rule deletion logic
      return { message: 'Repricing rule deleted successfully' };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete repricing rule',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Manual Repricing
  @Post('trigger')
  @ApiOperation({ 
    summary: 'Trigger manual repricing',
    description: 'Manually trigger repricing execution for a specific rule'
  })
  @ApiResponse({ 
    status: 202, 
    description: 'Repricing triggered successfully',
    type: RepricingSessionResponseDto
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async triggerManualRepricing(
    @CurrentUser('id') userId: string,
    @Body() triggerDto: TriggerManualRepricingDto,
  ): Promise<RepricingSessionResponseDto> {
    try {
      const session = await this.repricingEngineService.triggerManualRepricing(
        userId,
        triggerDto.ruleId,
        triggerDto.productIds,
      );
      
      return session as RepricingSessionResponseDto;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to trigger manual repricing',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Performance Reports
  @Get('performance')
  @ApiOperation({ 
    summary: 'Get repricing performance report',
    description: 'Retrieve detailed performance analytics for repricing rules'
  })
  @ApiQuery({ name: 'ruleId', required: false, description: 'Specific rule ID' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month'] })
  @ApiQuery({ name: 'startDate', required: false, type: Date })
  @ApiQuery({ name: 'endDate', required: false, type: Date })
  @ApiResponse({ status: 200, description: 'Performance report generated successfully' })
  async getPerformanceReport(
    @CurrentUser('id') userId: string,
    @Query() query: GetPerformanceReportQueryDto,
  ): Promise<{
    rulePerformance: any[];
    summary: any;
    trends: any;
    recommendations: string[];
  }> {
    try {
      const report = await this.repricingEngineService.analyzeRulePerformance(
        userId,
        query.ruleId,
        query.period || 'week',
      );
      
      return {
        ...report,
        trends: {}, // Would calculate trends
        recommendations: [], // Would generate recommendations
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate performance report',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Competitor Monitoring
  @Post('competitors')
  @ApiOperation({ 
    summary: 'Add new competitor',
    description: 'Add a new competitor for monitoring and price tracking'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Competitor added successfully',
    type: CompetitorResponseDto
  })
  @ApiResponse({ status: 400, description: 'Invalid competitor data' })
  async addCompetitor(
    @CurrentUser('id') userId: string,
    @Body() addCompetitorDto: AddCompetitorDto,
  ): Promise<CompetitorResponseDto> {
    try {
      const competitor = await this.competitorMonitoringService.addCompetitor(userId, {
        asin: addCompetitorDto.asin,
        sellerName: addCompetitorDto.sellerName,
        sellerId: addCompetitorDto.sellerId,
        initialPrice: addCompetitorDto.initialPrice,
        monitoringFrequency: addCompetitorDto.monitoringFrequency,
        alertSettings: addCompetitorDto.alertSettings,
      });
      
      return competitor as CompetitorResponseDto;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to add competitor',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('competitors')
  @ApiOperation({ 
    summary: 'Get competitors',
    description: 'Retrieve all monitored competitors with analytics'
  })
  @ApiQuery({ name: 'asin', required: false, description: 'Filter by ASIN' })
  @ApiQuery({ name: 'sellerName', required: false, description: 'Filter by seller name' })
  @ApiQuery({ name: 'isMonitored', required: false, type: Boolean })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ 
    status: 200, 
    description: 'Competitors retrieved successfully',
    type: [CompetitorResponseDto]
  })
  async getCompetitors(
    @CurrentUser('id') userId: string,
    @Query() query: GetCompetitorsQueryDto,
  ): Promise<{
    competitors: CompetitorResponseDto[];
    analytics: any;
  }> {
    try {
      const result = await this.competitorMonitoringService.getCompetitors(userId, {
        asin: query.asin,
        sellerName: query.sellerName,
        isMonitored: query.isMonitored,
        tags: query.tags,
        priceRange: query.priceRange,
      });
      
      return {
        competitors: result.competitors as CompetitorResponseDto[],
        analytics: result.analytics,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve competitors',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('competitors/:id')
  @ApiOperation({ 
    summary: 'Update competitor settings',
    description: 'Update monitoring settings for a specific competitor'
  })
  @ApiParam({ name: 'id', description: 'Competitor ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Competitor updated successfully',
    type: CompetitorResponseDto
  })
  @ApiResponse({ status: 404, description: 'Competitor not found' })
  async updateCompetitor(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) competitorId: string,
    @Body() updateDto: UpdateCompetitorDto,
  ): Promise<CompetitorResponseDto> {
    try {
      const competitor = await this.competitorMonitoringService.updateCompetitorSettings(
        userId,
        competitorId,
        {
          monitoringFrequency: updateDto.monitoringFrequency,
          isMonitored: updateDto.isMonitored,
          alertSettings: updateDto.alertSettings,
          tags: updateDto.tags,
          notes: updateDto.notes,
        },
      );
      
      return competitor as CompetitorResponseDto;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update competitor',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('monitor')
  @ApiOperation({ 
    summary: 'Monitor ASINs',
    description: 'Manually trigger competitor monitoring for specific ASINs'
  })
  @ApiResponse({ status: 202, description: 'Monitoring started successfully' })
  async monitorASINs(
    @CurrentUser('id') userId: string,
    @Body() monitorDto: MonitorASINsDto,
  ): Promise<{
    results: any[];
    alerts: any[];
    summary: any;
  }> {
    try {
      const result = await this.competitorMonitoringService.monitorASINs(
        userId,
        monitorDto.asins,
        {
          forceUpdate: monitorDto.forceUpdate,
          includeNewCompetitors: monitorDto.includeNewCompetitors,
        },
      );
      
      return result;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to start monitoring',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Buy Box Analysis
  @Get('buybox/analysis/:asin')
  @ApiOperation({ 
    summary: 'Get Buy Box analysis',
    description: 'Analyze current Buy Box status and get recommendations'
  })
  @ApiParam({ name: 'asin', description: 'Product ASIN' })
  @ApiQuery({ name: 'ourSellerId', required: false, description: 'Our seller ID for comparison' })
  @ApiResponse({ status: 200, description: 'Buy Box analysis completed successfully' })
  async getBuyBoxAnalysis(
    @CurrentUser('id') userId: string,
    @Param('asin') asin: string,
    @Query('ourSellerId') ourSellerId?: string,
  ): Promise<any> {
    try {
      const analysis = await this.buyBoxAnalyzerService.analyzeBuyBoxStatus(
        userId,
        asin,
        ourSellerId,
      );
      
      return analysis;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to analyze Buy Box',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('buybox/performance/:asin')
  @ApiOperation({ 
    summary: 'Get Buy Box performance report',
    description: 'Generate detailed Buy Box performance report with patterns and trends'
  })
  @ApiParam({ name: 'asin', description: 'Product ASIN' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter'] })
  @ApiQuery({ name: 'ourSellerId', required: false, description: 'Our seller ID' })
  @ApiResponse({ status: 200, description: 'Performance report generated successfully' })
  async getBuyBoxPerformance(
    @CurrentUser('id') userId: string,
    @Param('asin') asin: string,
    @Query('period') period: 'week' | 'month' | 'quarter' = 'month',
    @Query('ourSellerId') ourSellerId?: string,
  ): Promise<any> {
    try {
      const report = await this.buyBoxAnalyzerService.generatePerformanceReport(
        userId,
        asin,
        period,
        ourSellerId,
      );
      
      return report;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate Buy Box performance report',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('buybox/loss')
  @ApiOperation({ 
    summary: 'Record Buy Box loss',
    description: 'Record a Buy Box loss event for analysis and tracking'
  })
  @ApiResponse({ status: 201, description: 'Buy Box loss recorded successfully' })
  async recordBuyBoxLoss(
    @CurrentUser('id') userId: string,
    @Body() lossDto: RecordBuyBoxLossDto,
  ): Promise<{ message: string; eventId: string }> {
    try {
      const event = await this.buyBoxAnalyzerService.recordBuyBoxLoss(
        userId,
        lossDto.asin,
        lossDto.productTitle,
        {
          previousWinner: lossDto.previousWinner,
          newWinner: lossDto.newWinner,
          ourData: lossDto.ourData,
          competitors: lossDto.competitors,
          lossReason: lossDto.lossReason as any,
        },
      );
      
      return {
        message: 'Buy Box loss recorded successfully',
        eventId: event.id,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to record Buy Box loss',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('buybox/win')
  @ApiOperation({ 
    summary: 'Record Buy Box win',
    description: 'Record a Buy Box win event for analysis and tracking'
  })
  @ApiResponse({ status: 201, description: 'Buy Box win recorded successfully' })
  async recordBuyBoxWin(
    @CurrentUser('id') userId: string,
    @Body() winDto: RecordBuyBoxWinDto,
  ): Promise<{ message: string; eventId: string }> {
    try {
      const event = await this.buyBoxAnalyzerService.recordBuyBoxWin(
        userId,
        winDto.asin,
        winDto.productTitle,
        {
          previousWinner: winDto.previousWinner,
          ourData: winDto.ourData,
          winStrategy: winDto.winStrategy as any,
          competitors: winDto.competitors,
          responseTime: winDto.responseTime,
        },
      );
      
      return {
        message: 'Buy Box win recorded successfully',
        eventId: event.id,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to record Buy Box win',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Market Analysis
  @Get('market/analysis')
  @ApiOperation({ 
    summary: 'Get market analysis',
    description: 'Generate comprehensive market analysis report for an ASIN'
  })
  @ApiQuery({ name: 'asin', required: true, description: 'Product ASIN' })
  @ApiQuery({ name: 'period', required: false, enum: ['week', 'month', 'quarter'] })
  @ApiResponse({ 
    status: 200, 
    description: 'Market analysis completed successfully',
    type: MarketAnalysisResponseDto
  })
  async getMarketAnalysis(
    @CurrentUser('id') userId: string,
    @Query() query: GetMarketAnalysisDto,
  ): Promise<MarketAnalysisResponseDto> {
    try {
      const analysis = await this.marketAnalysisService.generateMarketAnalysisReport(
        userId,
        query.asin,
        query.period || 'month',
      );
      
      return analysis as MarketAnalysisResponseDto;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to generate market analysis',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('market/conditions/:asin')
  @ApiOperation({ 
    summary: 'Get market conditions',
    description: 'Get current market conditions for a specific ASIN'
  })
  @ApiParam({ name: 'asin', description: 'Product ASIN' })
  @ApiResponse({ status: 200, description: 'Market conditions retrieved successfully' })
  async getMarketConditions(
    @CurrentUser('id') userId: string,
    @Param('asin') asin: string,
  ): Promise<any> {
    try {
      const conditions = await this.marketAnalysisService.getMarketConditions(asin);
      return conditions;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get market conditions',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('market/opportunities')
  @ApiOperation({ 
    summary: 'Identify pricing opportunities',
    description: 'Identify pricing opportunities across monitored products'
  })
  @ApiQuery({ name: 'asins', required: false, type: [String], description: 'Specific ASINs to analyze' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Limit number of results' })
  @ApiResponse({ status: 200, description: 'Pricing opportunities identified successfully' })
  async identifyOpportunities(
    @CurrentUser('id') userId: string,
    @Query() query: IdentifyOpportunitiesDto,
  ): Promise<any[]> {
    try {
      const opportunities = await this.marketAnalysisService.identifyPricingOpportunities(
        userId,
        query.asins,
      );
      
      return query.limit ? opportunities.slice(0, query.limit) : opportunities;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to identify opportunities',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Price Optimization
  @Post('optimize/price')
  @ApiOperation({ 
    summary: 'Optimize price',
    description: 'Get optimal price recommendation using AI-powered analysis'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Price optimization completed successfully',
    type: PriceOptimizationResponseDto
  })
  async optimizePrice(
    @CurrentUser('id') userId: string,
    @Body() optimizeDto: OptimizePriceDto,
  ): Promise<PriceOptimizationResponseDto> {
    try {
      // Get market conditions
      const marketConditions = await this.marketAnalysisService.getMarketConditions(optimizeDto.asin);
      
      // Get competitor data
      const competitors = await this.competitorMonitoringService.getCompetitors(userId, {
        asin: optimizeDto.asin,
      });

      const competitorData = {
        lowestPrice: Math.min(...competitors.competitors.map(c => c.currentPrice)),
        averagePrice: competitors.competitors.reduce((sum, c) => sum + c.currentPrice, 0) / competitors.competitors.length,
        buyBoxPrice: competitors.competitors.find(c => c.buyBoxWinner)?.currentPrice || optimizeDto.currentPrice,
        competitors: competitors.competitors,
      };

      const optimization = await this.priceOptimizationService.optimizePrice({
        productId: optimizeDto.productId,
        asin: optimizeDto.asin,
        currentPrice: optimizeDto.currentPrice,
        costPrice: optimizeDto.costPrice,
        targetMargin: optimizeDto.targetMargin,
        minMargin: optimizeDto.minMargin,
        maxPrice: optimizeDto.maxPrice,
        minPrice: optimizeDto.minPrice,
        inventoryLevel: optimizeDto.inventoryLevel,
        salesVelocity: optimizeDto.salesVelocity,
        competitorData,
        marketConditions,
        businessGoals: optimizeDto.businessGoals,
      });
      
      return optimization as PriceOptimizationResponseDto;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to optimize price',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('optimize/strategy')
  @ApiOperation({ 
    summary: 'Create dynamic pricing strategy',
    description: 'Create and backtest a dynamic pricing strategy'
  })
  @ApiResponse({ status: 201, description: 'Dynamic strategy created successfully' })
  async createDynamicStrategy(
    @CurrentUser('id') userId: string,
    @Body() strategyDto: CreateDynamicStrategyDto,
  ): Promise<any> {
    try {
      const strategy = await this.priceOptimizationService.createDynamicPricingStrategy(
        userId,
        strategyDto.productIds,
        {
          name: strategyDto.name,
          primaryGoal: strategyDto.primaryGoal,
          riskTolerance: strategyDto.riskTolerance,
          constraints: strategyDto.constraints,
          marketResponseSensitivity: strategyDto.marketResponseSensitivity,
        },
      );
      
      return strategy;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create dynamic strategy',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('optimize/elasticity/:asin')
  @ApiOperation({ 
    summary: 'Get price elasticity analysis',
    description: 'Analyze price elasticity and get demand forecasting'
  })
  @ApiParam({ name: 'asin', description: 'Product ASIN' })
  @ApiQuery({ name: 'currentPrice', required: true, type: Number })
  @ApiQuery({ name: 'costPrice', required: true, type: Number })
  @ApiResponse({ status: 200, description: 'Price elasticity analysis completed successfully' })
  async getPriceElasticity(
    @CurrentUser('id') userId: string,
    @Param('asin') asin: string,
    @Query('currentPrice') currentPrice: number,
    @Query('costPrice') costPrice: number,
  ): Promise<any> {
    try {
      const analysis = await this.priceOptimizationService.optimizePriceByElasticity(
        asin,
        currentPrice,
        costPrice,
      );
      
      return analysis;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to analyze price elasticity',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}