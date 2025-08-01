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

import { PricingCalculatorService } from './services/pricing-calculator.service';
import { FeeCalculatorService } from './services/fee-calculator.service';
import { CurrencyConverterService } from './services/currency-converter.service';
import { TaxCalculatorService } from './services/tax-calculator.service';
import { ProfitAnalyzerService } from './services/profit-analyzer.service';

import {
  CreatePricingCalculationDto,
  CalculationOptionsDto,
  BulkPricingCalculationDto,
  WhatIfAnalysisDto,
  FeeCalculationInputDto,
  FBAEstimationDto,
  FulfillmentComparisonDto,
  CurrencyConversionDto,
  BulkCurrencyConversionDto,
  RateAnalysisDto,
  RateAlertDto,
  TaxCalculationInputDto,
  SpecificTaxCalculationDto,
  EUVATCalculationDto,
  USSalesTaxCalculationDto,
  CustomsDutyCalculationDto,
  CreateProfitAnalysisDto,
  DetailedAnalysisOptionsDto,
  PortfolioAnalysisFiltersDto,
  TrendAnalysisDto,
  CompetitiveAnalysisDto,
  RiskAssessmentDto,
  CalculationFilterDto,
  RateHistoryDto,
  CalculationResponseDto,
  PaginatedCalculationsResponseDto,
  ErrorResponseDto,
} from './dto/pricing.dto';

@ApiTags('Pricing Calculator')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@Controller('pricing')
export class PricingController {
  constructor(
    private readonly pricingCalculatorService: PricingCalculatorService,
    private readonly feeCalculatorService: FeeCalculatorService,
    private readonly currencyConverterService: CurrencyConverterService,
    private readonly taxCalculatorService: TaxCalculatorService,
    private readonly profitAnalyzerService: ProfitAnalyzerService,
  ) {}

  // ==================== PRICING CALCULATIONS ====================

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate pricing and profit analysis for a product' })
  @ApiBody({ type: CreatePricingCalculationDto })
  @ApiResponse({
    status: 201,
    description: 'Pricing calculation completed successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request', type: ErrorResponseDto })
  @HttpCode(HttpStatus.CREATED)
  async calculatePricing(
    @CurrentUser() user: User,
    @Body() calculationDto: CreatePricingCalculationDto,
    @Query() options?: CalculationOptionsDto,
  ) {
    const input = {
      productName: calculationDto.productName,
      costPrice: calculationDto.costPrice,
      sellingPrice: calculationDto.sellingPrice,
      productCategory: calculationDto.productCategory,
      marketplace: calculationDto.marketplace,
      fulfillmentMethod: calculationDto.fulfillmentMethod,
      currency: calculationDto.currency,
      dimensions: calculationDto.dimensions,
      shippingCost: calculationDto.shippingCost,
      additionalCosts: calculationDto.additionalCosts,
      asin: calculationDto.asin,
      productId: calculationDto.productId,
    };

    return this.pricingCalculatorService.calculatePricing(user.id, input, options);
  }

  @Post('calculate/bulk')
  @ApiOperation({ summary: 'Bulk pricing calculation for multiple products' })
  @ApiBody({ type: BulkPricingCalculationDto })
  @ApiResponse({
    status: 200,
    description: 'Bulk pricing calculation completed',
  })
  async calculateBulkPricing(
    @CurrentUser() user: User,
    @Body() bulkDto: BulkPricingCalculationDto,
  ) {
    const inputs = bulkDto.calculations.map(calc => ({
      productName: calc.productName,
      costPrice: calc.costPrice,
      sellingPrice: calc.sellingPrice,
      productCategory: calc.productCategory,
      marketplace: calc.marketplace,
      fulfillmentMethod: calc.fulfillmentMethod,
      currency: calc.currency,
      dimensions: calc.dimensions,
      shippingCost: calc.shippingCost,
      additionalCosts: calc.additionalCosts,
      asin: calc.asin,
      productId: calc.productId,
    }));

    return this.pricingCalculatorService.calculateBulkPricing(
      user.id,
      inputs,
      bulkDto.options,
    );
  }

  @Post('what-if')
  @ApiOperation({ summary: 'Perform what-if analysis on existing calculation' })
  @ApiBody({ type: WhatIfAnalysisDto })
  @ApiResponse({
    status: 200,
    description: 'What-if analysis completed',
  })
  async performWhatIfAnalysis(
    @CurrentUser() user: User,
    @Body() whatIfDto: WhatIfAnalysisDto,
  ) {
    return this.pricingCalculatorService.performWhatIfAnalysis(
      user.id,
      whatIfDto.baseCalculationId,
      whatIfDto.scenarios,
    );
  }

  @Get('calculations')
  @ApiOperation({ summary: 'Get calculation history with filtering' })
  @ApiQuery({ name: 'productName', required: false })
  @ApiQuery({ name: 'marketplace', enum: ['amazon_us', 'amazon_uk', 'amazon_de'], required: false })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'onlyProfitable', type: Boolean, required: false })
  @ApiResponse({
    status: 200,
    description: 'Calculation history retrieved',
    type: PaginatedCalculationsResponseDto,
  })
  async getCalculationHistory(
    @CurrentUser() user: User,
    @Query() filters: CalculationFilterDto,
  ) {
    const filterOptions = {
      productName: filters.productName,
      marketplace: filters.marketplace,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      onlyProfitable: filters.onlyProfitable,
      limit: filters.limit,
    };

    return this.pricingCalculatorService.getCalculationHistory(user.id, filterOptions);
  }

  @Get('calculations/:id')
  @ApiOperation({ summary: 'Get specific calculation by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Calculation UUID' })
  @ApiResponse({
    status: 200,
    description: 'Calculation retrieved successfully',
    type: CalculationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Calculation not found' })
  async getCalculation(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) calculationId: string,
  ) {
    // Implementation would fetch specific calculation
    return { message: 'Get specific calculation', calculationId };
  }

  // ==================== FEE CALCULATIONS ====================

  @Post('fees/calculate')
  @ApiOperation({ summary: 'Calculate Amazon fees for a product' })
  @ApiBody({ type: FeeCalculationInputDto })
  @ApiResponse({
    status: 200,
    description: 'Amazon fees calculated successfully',
  })
  async calculateAmazonFees(
    @Body() feeInput: FeeCalculationInputDto,
  ) {
    return this.feeCalculatorService.calculateAmazonFees({
      sellingPrice: feeInput.sellingPrice,
      productCategory: feeInput.productCategory,
      marketplace: feeInput.marketplace,
      fulfillmentMethod: feeInput.fulfillmentMethod,
      dimensions: feeInput.dimensions,
      storageDuration: feeInput.storageDuration,
    });
  }

  @Post('fees/fba-estimate')
  @ApiOperation({ summary: 'Estimate FBA fees and size tier' })
  @ApiBody({ type: FBAEstimationDto })
  @ApiResponse({
    status: 200,
    description: 'FBA fees estimated successfully',
  })
  async estimateFBAFees(
    @Body() estimationDto: FBAEstimationDto,
  ) {
    return this.feeCalculatorService.estimateFBAFees(
      estimationDto.marketplace,
      estimationDto.dimensions,
      estimationDto.storageDuration,
    );
  }

  @Post('fees/fulfillment-comparison')
  @ApiOperation({ summary: 'Compare FBA vs FBM fulfillment costs' })
  @ApiBody({ type: FulfillmentComparisonDto })
  @ApiResponse({
    status: 200,
    description: 'Fulfillment comparison completed',
  })
  async compareFulfillmentMethods(
    @Body() comparisonDto: FulfillmentComparisonDto,
  ) {
    return this.feeCalculatorService.compareFulfillmentMethods({
      sellingPrice: comparisonDto.sellingPrice,
      productCategory: comparisonDto.productCategory,
      marketplace: comparisonDto.marketplace,
      fulfillmentMethod: 'fba', // Base comparison
      dimensions: comparisonDto.dimensions,
    });
  }

  @Get('fees/category/:marketplace/:category')
  @ApiOperation({ summary: 'Get referral fee for specific category' })
  @ApiParam({ name: 'marketplace', enum: ['amazon_us', 'amazon_uk', 'amazon_de'] })
  @ApiParam({ name: 'category', type: String })
  @ApiResponse({
    status: 200,
    description: 'Category referral fee retrieved',
  })
  async getCategoryReferralFee(
    @Param('marketplace') marketplace: string,
    @Param('category') category: string,
  ) {
    return this.feeCalculatorService.getCategoryReferralFee(
      marketplace as any,
      category,
    );
  }

  // ==================== CURRENCY CONVERSION ====================

  @Post('currency/convert')
  @ApiOperation({ summary: 'Convert currency with real-time rates' })
  @ApiBody({ type: CurrencyConversionDto })
  @ApiResponse({
    status: 200,
    description: 'Currency conversion completed',
  })
  async convertCurrency(
    @Body() conversionDto: CurrencyConversionDto,
  ) {
    return this.currencyConverterService.convertCurrency(
      conversionDto.amount,
      conversionDto.fromCurrency,
      conversionDto.toCurrency,
      {
        includeFees: conversionDto.includeFees,
        feePercentage: conversionDto.feePercentage,
        forceRefresh: conversionDto.forceRefresh,
      },
    );
  }

  @Post('currency/convert/bulk')
  @ApiOperation({ summary: 'Bulk currency conversion' })
  @ApiBody({ type: BulkCurrencyConversionDto })
  @ApiResponse({
    status: 200,
    description: 'Bulk currency conversion completed',
  })
  async convertMultipleCurrencies(
    @Body() bulkConversionDto: BulkCurrencyConversionDto,
  ) {
    return this.currencyConverterService.convertMultiple(bulkConversionDto.conversions);
  }

  @Get('currency/rate/:from/:to')
  @ApiOperation({ summary: 'Get current exchange rate' })
  @ApiParam({ name: 'from', type: String, description: 'Source currency code' })
  @ApiParam({ name: 'to', type: String, description: 'Target currency code' })
  @ApiQuery({ name: 'forceRefresh', type: Boolean, required: false })
  @ApiResponse({
    status: 200,
    description: 'Exchange rate retrieved',
  })
  async getExchangeRate(
    @Param('from') fromCurrency: string,
    @Param('to') toCurrency: string,
    @Query('forceRefresh') forceRefresh?: boolean,
  ) {
    const rate = await this.currencyConverterService.getExchangeRate(
      fromCurrency,
      toCurrency,
      forceRefresh,
    );

    return {
      fromCurrency,
      toCurrency,
      exchangeRate: rate,
      timestamp: new Date(),
    };
  }

  @Post('currency/analyze')
  @ApiOperation({ summary: 'Analyze currency rate trends and volatility' })
  @ApiBody({ type: RateAnalysisDto })
  @ApiResponse({
    status: 200,
    description: 'Rate analysis completed',
  })
  async analyzeRate(
    @Body() analysisDto: RateAnalysisDto,
  ) {
    return this.currencyConverterService.analyzeRate(
      analysisDto.fromCurrency,
      analysisDto.toCurrency,
      analysisDto.period,
    );
  }

  @Post('currency/history')
  @ApiOperation({ summary: 'Get exchange rate history' })
  @ApiBody({ type: RateHistoryDto })
  @ApiResponse({
    status: 200,
    description: 'Rate history retrieved',
  })
  async getRateHistory(
    @Body() historyDto: RateHistoryDto,
  ) {
    return this.currencyConverterService.getRateHistory(
      historyDto.fromCurrency,
      historyDto.toCurrency,
      historyDto.period,
    );
  }

  @Post('currency/alerts/check')
  @ApiOperation({ summary: 'Check rate alerts' })
  @ApiBody({ type: [RateAlertDto] })
  @ApiResponse({
    status: 200,
    description: 'Rate alerts checked',
  })
  async checkRateAlerts(
    @CurrentUser() user: User,
    @Body() alerts: RateAlertDto[],
  ) {
    return this.currencyConverterService.checkRateAlerts(user.id, alerts);
  }

  @Get('currency/supported')
  @ApiOperation({ summary: 'Get list of supported currencies' })
  @ApiResponse({
    status: 200,
    description: 'Supported currencies list',
  })
  getSupportedCurrencies() {
    return {
      currencies: this.currencyConverterService.getSupportedCurrencies(),
    };
  }

  // ==================== TAX CALCULATIONS ====================

  @Post('tax/calculate')
  @ApiOperation({ summary: 'Calculate taxes for a sale' })
  @ApiBody({ type: TaxCalculationInputDto })
  @ApiResponse({
    status: 200,
    description: 'Tax calculation completed',
  })
  async calculateTaxes(
    @CurrentUser() user: User,
    @Body() taxInput: TaxCalculationInputDto,
  ) {
    return this.taxCalculatorService.calculateTaxes(user.id, {
      sellingPrice: taxInput.sellingPrice,
      marketplace: taxInput.marketplace,
      productCategory: taxInput.productCategory,
      customerType: taxInput.customerType,
      businessType: taxInput.businessType,
      fulfillmentMethod: taxInput.fulfillmentMethod,
      customerLocation: taxInput.customerLocation,
      isExempt: taxInput.isExempt,
      exemptionCertificate: taxInput.exemptionCertificate,
    });
  }

  @Post('tax/specific')
  @ApiOperation({ summary: 'Calculate specific tax type' })
  @ApiBody({ type: SpecificTaxCalculationDto })
  @ApiResponse({
    status: 200,
    description: 'Specific tax calculated',
  })
  async calculateSpecificTax(
    @CurrentUser() user: User,
    @Body() specificTaxDto: SpecificTaxCalculationDto,
  ) {
    return this.taxCalculatorService.calculateSpecificTax(
      user.id,
      specificTaxDto.taxType,
      specificTaxDto.amount,
      {
        marketplace: specificTaxDto.marketplace,
        jurisdiction: specificTaxDto.jurisdiction,
        productCategory: specificTaxDto.productCategory,
      },
    );
  }

  @Post('tax/eu-vat')
  @ApiOperation({ summary: 'Calculate EU VAT' })
  @ApiBody({ type: EUVATCalculationDto })
  @ApiResponse({
    status: 200,
    description: 'EU VAT calculated',
  })
  async calculateEUVAT(
    @CurrentUser() user: User,
    @Body() vatDto: EUVATCalculationDto,
  ) {
    return this.taxCalculatorService.calculateEUVAT(
      user.id,
      vatDto.sellingPrice,
      vatDto.customerCountry,
      vatDto.productCategory,
      vatDto.customerType,
    );
  }

  @Post('tax/us-sales-tax')
  @ApiOperation({ summary: 'Calculate US Sales Tax' })
  @ApiBody({ type: USSalesTaxCalculationDto })
  @ApiResponse({
    status: 200,
    description: 'US Sales Tax calculated',
  })
  async calculateUSSalesTax(
    @CurrentUser() user: User,
    @Body() salesTaxDto: USSalesTaxCalculationDto,
  ) {
    return this.taxCalculatorService.calculateUSSalesTax(
      user.id,
      salesTaxDto.sellingPrice,
      salesTaxDto.customerState,
      salesTaxDto.customerCity,
    );
  }

  @Post('tax/customs-duty')
  @ApiOperation({ summary: 'Calculate customs duty' })
  @ApiBody({ type: CustomsDutyCalculationDto })
  @ApiResponse({
    status: 200,
    description: 'Customs duty calculated',
  })
  async calculateCustomsDuty(
    @Body() dutyDto: CustomsDutyCalculationDto,
  ) {
    return this.taxCalculatorService.calculateCustomsDuty(
      dutyDto.productCategory,
      dutyDto.productValue,
      dutyDto.originCountry,
      dutyDto.destinationCountry,
    );
  }

  @Get('tax/compliance/:marketplace')
  @ApiOperation({ summary: 'Check tax compliance status' })
  @ApiParam({ name: 'marketplace', enum: ['amazon_us', 'amazon_uk', 'amazon_de'] })
  @ApiResponse({
    status: 200,
    description: 'Tax compliance status',
  })
  async checkTaxCompliance(
    @CurrentUser() user: User,
    @Param('marketplace') marketplace: string,
  ) {
    return this.taxCalculatorService.checkTaxCompliance(user.id, marketplace as any);
  }

  // ==================== PROFIT ANALYSIS ====================

  @Post('analysis/detailed')
  @ApiOperation({ summary: 'Create detailed profit analysis' })
  @ApiBody({ type: CreateProfitAnalysisDto })
  @ApiResponse({
    status: 201,
    description: 'Detailed analysis created',
  })
  @HttpCode(HttpStatus.CREATED)
  async createDetailedAnalysis(
    @CurrentUser() user: User,
    @Body() analysisDto: CreateProfitAnalysisDto,
    @Query() options?: DetailedAnalysisOptionsDto,
  ) {
    // This would require getting the pricing calculation first
    throw new Error('Implementation pending - need to get calculation from analysisDto.pricingCalculationId');
  }

  @Post('analysis/portfolio')
  @ApiOperation({ summary: 'Analyze product portfolio' })
  @ApiBody({ type: PortfolioAnalysisFiltersDto })
  @ApiResponse({
    status: 200,
    description: 'Portfolio analysis completed',
  })
  async analyzePortfolio(
    @CurrentUser() user: User,
    @Body() filtersDto: PortfolioAnalysisFiltersDto,
  ) {
    const filters = {
      startDate: filtersDto.startDate ? new Date(filtersDto.startDate) : undefined,
      endDate: filtersDto.endDate ? new Date(filtersDto.endDate) : undefined,
      productCategories: filtersDto.productCategories,
      minimumMargin: filtersDto.minimumMargin,
    };

    return this.profitAnalyzerService.analyzePortfolio(user.id, filters);
  }

  @Post('analysis/trends')
  @ApiOperation({ summary: 'Analyze profit trends' })
  @ApiBody({ type: TrendAnalysisDto })
  @ApiResponse({
    status: 200,
    description: 'Trend analysis completed',
  })
  async analyzeTrends(
    @CurrentUser() user: User,
    @Body() trendDto: TrendAnalysisDto,
  ) {
    return this.profitAnalyzerService.analyzeTrends(user.id, trendDto.period);
  }

  @Post('analysis/competitive')
  @ApiOperation({ summary: 'Perform competitive analysis' })
  @ApiBody({ type: CompetitiveAnalysisDto })
  @ApiResponse({
    status: 200,
    description: 'Competitive analysis completed',
  })
  async performCompetitiveAnalysis(
    @CurrentUser() user: User,
    @Body() competitiveDto: CompetitiveAnalysisDto,
  ) {
    return this.profitAnalyzerService.performCompetitiveAnalysis(
      user.id,
      competitiveDto.productCategory,
      competitiveDto.targetMargin,
    );
  }

  @Post('analysis/risk-assessment')
  @ApiOperation({ summary: 'Assess portfolio risks' })
  @ApiBody({ type: RiskAssessmentDto })
  @ApiResponse({
    status: 200,
    description: 'Risk assessment completed',
  })
  async assessRisks(
    @CurrentUser() user: User,
    @Body() riskDto: RiskAssessmentDto,
  ) {
    return this.profitAnalyzerService.assessRisks(user.id, riskDto.calculationIds);
  }

  // ==================== UTILITIES & HELPERS ====================

  @Get('dashboard')
  @ApiOperation({ summary: 'Get pricing dashboard data' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard data retrieved',
  })
  async getDashboard(@CurrentUser() user: User) {
    // Get summary statistics
    const calculations = await this.pricingCalculatorService.getCalculationHistory(user.id, {
      limit: 100,
    });

    const summary = {
      totalCalculations: calculations.analytics.totalCalculations,
      profitablePercentage: calculations.analytics.profitablePercentage,
      averageMargin: calculations.analytics.averageMargin,
      topPerformers: calculations.analytics.topPerformers.slice(0, 5),
      recentCalculations: calculations.calculations.slice(0, 10),
    };

    return summary;
  }

  @Get('categories/:marketplace')
  @ApiOperation({ summary: 'Get product categories for marketplace' })
  @ApiParam({ name: 'marketplace', enum: ['amazon_us', 'amazon_uk', 'amazon_de'] })
  @ApiResponse({
    status: 200,
    description: 'Product categories list',
  })
  async getProductCategories(@Param('marketplace') marketplace: string) {
    // Return common Amazon categories
    const categories = [
      'Electronics',
      'Home & Kitchen',
      'Clothing, Shoes & Jewelry',
      'Health & Personal Care',
      'Sports & Outdoors',
      'Toys & Games',
      'Books',
      'Beauty & Personal Care',
      'Automotive',
      'Industrial & Scientific',
      'Arts, Crafts & Sewing',
      'Baby',
      'Grocery & Gourmet Food',
      'Pet Supplies',
      'Tools & Home Improvement',
      'Video Games',
      'Cell Phones & Accessories',
      'Office Products',
      'Musical Instruments',
      'Camera & Photo',
    ];

    return { marketplace, categories };
  }

  @Get('health')
  @ApiOperation({ summary: 'Check pricing service health' })
  @ApiResponse({
    status: 200,
    description: 'Service health status',
  })
  async checkHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        pricingCalculator: 'operational',
        feeCalculator: 'operational',
        currencyConverter: 'operational',
        taxCalculator: 'operational',
        profitAnalyzer: 'operational',
      },
      version: '1.0.0',
    };
  }
}