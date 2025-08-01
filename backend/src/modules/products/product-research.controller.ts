import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';

import { ProductResearchService } from './services/product-research.service';
import { SalesEstimationService } from './services/sales-estimation.service';
import { CategoryAnalysisService } from './services/category-analysis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import {
  ResearchFiltersDto,
  KeywordResearchDto,
  ProductOpportunityDto,
  MarketAnalysisDto,
  KeywordAnalysisDto,
} from './dto/products.dto';

@ApiTags('product-research')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('product-research')
export class ProductResearchController {
  private readonly logger = new Logger(ProductResearchController.name);

  constructor(
    private readonly productResearchService: ProductResearchService,
    private readonly salesEstimationService: SalesEstimationService,
    private readonly categoryAnalysisService: CategoryAnalysisService,
  ) {}

  @Get('rising-products')
  @ApiOperation({
    summary: 'Yükselen ürünler',
    description: 'Trend olan ve potansiyel fırsat sunan ürünleri bulur'
  })
  @ApiResponse({
    status: 200,
    description: 'Yükselen ürünler başarıyla listelendi',
    type: [ProductOpportunityDto]
  })
  async findRisingProducts(
    @Query() filters: ResearchFiltersDto
  ): Promise<ProductOpportunityDto[]> {
    this.logger.log('Finding rising products');
    return this.productResearchService.findRisingProducts(filters);
  }

  @Get('low-competition')
  @ApiOperation({
    summary: 'Düşük rekabetli ürünler',
    description: 'Az rakibi olan ve giriş yapılabilir ürünleri bulur'
  })
  @ApiResponse({
    status: 200,
    description: 'Düşük rekabetli ürünler başarıyla listelendi',
    type: [ProductOpportunityDto]
  })
  async findLowCompetitionProducts(
    @Query() filters: ResearchFiltersDto
  ): Promise<ProductOpportunityDto[]> {
    this.logger.log('Finding low competition products');
    return this.productResearchService.findLowCompetitionProducts(filters);
  }

  @Get('market-analysis/:category')
  @ApiOperation({
    summary: 'Pazar analizi',
    description: 'Belirtilen kategori için detaylı pazar analizi yapar'
  })
  @ApiResponse({
    status: 200,
    description: 'Pazar analizi başarıyla tamamlandı',
    type: MarketAnalysisDto
  })
  async analyzeMarket(
    @Query('category') category: string
  ): Promise<MarketAnalysisDto> {
    this.logger.log(`Analyzing market for category: ${category}`);
    return this.productResearchService.analyzeMarket(category);
  }

  @Post('keyword-research')
  @ApiOperation({
    summary: 'Anahtar kelime araştırması',
    description: 'Anahtar kelime için detaylı araştırma ve analiz yapar'
  })
  @ApiResponse({
    status: 200,
    description: 'Anahtar kelime araştırması tamamlandı',
    type: KeywordAnalysisDto
  })
  async researchKeywords(
    @Body() keywordDto: KeywordResearchDto
  ): Promise<KeywordAnalysisDto> {
    this.logger.log(`Researching keywords: ${keywordDto.baseKeyword}`);
    return this.productResearchService.researchKeywords(
      keywordDto.baseKeyword,
      keywordDto.category
    );
  }

  @Get('sales-estimation/:productId')
  @ApiOperation({
    summary: 'Satış tahmini',
    description: 'Ürün için aylık satış ve gelir tahmini yapar'
  })
  @ApiResponse({
    status: 200,
    description: 'Satış tahmini başarıyla hesaplandı'
  })
  async estimateSales(
    @CurrentUser('id') userId: string,
    @Query('productId') productId: string
  ): Promise<any> {
    this.logger.log(`Estimating sales for product: ${productId}`);
    return this.salesEstimationService.estimateProductSales(productId);
  }

  @Get('revenue-projection/:productId')
  @ApiOperation({
    summary: 'Gelir projeksiyonu',
    description: '12 aylık gelir projeksiyonu yapar'
  })
  @ApiResponse({
    status: 200,
    description: 'Gelir projeksiyonu başarıyla hesaplandı'
  })
  async projectRevenue(
    @CurrentUser('id') userId: string,
    @Query('productId') productId: string
  ): Promise<any> {
    this.logger.log(`Projecting revenue for product: ${productId}`);
    return this.salesEstimationService.projectRevenue(productId);
  }

  @Get('market-potential/:category')
  @ApiOperation({
    summary: 'Pazar potansiyeli',
    description: 'Kategori için pazar potansiyeli analizi yapar'
  })
  @ApiResponse({
    status: 200,
    description: 'Pazar potansiyeli analizi tamamlandı'
  })
  async analyzeMarketPotential(
    @Query('category') category: string
  ): Promise<any> {
    this.logger.log(`Analyzing market potential for: ${category}`);
    return this.salesEstimationService.analyzeMarketPotential(category);
  }

  @Get('category-insights/:categoryId')
  @ApiOperation({
    summary: 'Kategori analizi',
    description: 'Kategori için detaylı insight ve analiz sağlar'
  })
  @ApiResponse({
    status: 200,
    description: 'Kategori analizi tamamlandı'
  })
  async getCategoryInsights(
    @Query('categoryId') categoryId: string
  ): Promise<any> {
    this.logger.log(`Getting category insights for: ${categoryId}`);
    return this.categoryAnalysisService.analyzeCategory(categoryId);
  }

  @Post('compare-categories')
  @ApiOperation({
    summary: 'Kategori karşılaştırması',
    description: 'Birden fazla kategoriyi karşılaştırır ve en iyisini önerir'
  })
  @ApiResponse({
    status: 200,
    description: 'Kategori karşılaştırması tamamlandı'
  })
  async compareCategories(
    @Body() body: { categoryIds: string[] }
  ): Promise<any> {
    this.logger.log(`Comparing ${body.categoryIds.length} categories`);
    return this.categoryAnalysisService.compareCategories(body.categoryIds);
  }

  @Get('niche-opportunities/:categoryId')
  @ApiOperation({
    summary: 'Niş fırsatları',
    description: 'Kategori içindeki niş fırsatları bulur'
  })
  @ApiResponse({
    status: 200,
    description: 'Niş fırsatları başarıyla listelendi'
  })
  async findNicheOpportunities(
    @Query('categoryId') categoryId: string
  ): Promise<any> {
    this.logger.log(`Finding niche opportunities in category: ${categoryId}`);
    return this.categoryAnalysisService.findNicheOpportunities(categoryId);
  }

  @Get('pricing-analysis/:productId')
  @ApiOperation({
    summary: 'Fiyat analizi',
    description: 'Optimum fiyat analizi ve öneriler'
  })
  @ApiResponse({
    status: 200,
    description: 'Fiyat analizi tamamlandı'
  })
  async analyzePricing(
    @CurrentUser('id') userId: string,
    @Query('productId') productId: string
  ): Promise<any> {
    this.logger.log(`Analyzing pricing for product: ${productId}`);
    return this.salesEstimationService.analyzeOptimalPricing(productId);
  }

  @Get('sales-trends/:productId')
  @ApiOperation({
    summary: 'Satış trend analizi',
    description: 'Ürün için satış trend analizi ve gelecek tahminleri'
  })
  @ApiQuery({
    name: 'months',
    description: 'Analiz periyodu (ay)',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Satış trend analizi tamamlandı'
  })
  async analyzeSalesTrends(
    @CurrentUser('id') userId: string,
    @Query('productId') productId: string,
    @Query('months') months: number = 6
  ): Promise<any> {
    this.logger.log(`Analyzing sales trends for product: ${productId}`);
    return this.salesEstimationService.analyzeSalesTrend(productId, months);
  }

  @Get('competition-analysis/:categoryId')
  @ApiOperation({
    summary: 'Rekabet analizi',
    description: 'Kategori için detaylı rekabet analizi'
  })
  @ApiResponse({
    status: 200,
    description: 'Rekabet analizi tamamlandı'
  })
  async analyzeCompetition(
    @Query('categoryId') categoryId: string
  ): Promise<any> {
    this.logger.log(`Analyzing competition for category: ${categoryId}`);
    return this.categoryAnalysisService.analyzeCompetition(categoryId);
  }

  @Get('trending-keywords')
  @ApiOperation({
    summary: 'Trend olan keywords',
    description: 'Şu anda trend olan anahtar kelimeleri listeler'
  })
  @ApiQuery({
    name: 'category',
    description: 'Kategori filtresi',
    required: false
  })
  @ApiQuery({
    name: 'limit',
    description: 'Sonuç limiti',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Trend olan keywords başarıyla listelendi'
  })
  async getTrendingKeywords(
    @Query('category') category?: string,
    @Query('limit') limit: number = 20
  ): Promise<any> {
    this.logger.log('Getting trending keywords');
    
    // Bu fonksiyon trend analysis service'te implement edilecek
    return {
      keywords: [
        { keyword: 'wireless earbuds', trend: 'up', score: 85 },
        { keyword: 'smart watch', trend: 'up', score: 78 },
        { keyword: 'laptop stand', trend: 'stable', score: 65 },
      ],
      category,
      updatedAt: new Date(),
    };
  }

  @Get('opportunity-score/:asin')
  @ApiOperation({
    summary: 'Fırsat skoru',
    description: 'ASIN için genel fırsat skoru hesaplar'
  })
  @ApiResponse({
    status: 200,
    description: 'Fırsat skoru başarıyla hesaplandı'
  })
  async calculateOpportunityScore(
    @Query('asin') asin: string
  ): Promise<{
    asin: string;
    opportunityScore: number;
    factors: {
      profitability: number;
      competition: number;
      trend: number;
      market: number;
    };
    recommendation: string;
    confidence: 'low' | 'medium' | 'high';
  }> {
    this.logger.log(`Calculating opportunity score for ASIN: ${asin}`);
    
    // Bu fonksiyon geliştirilecek
    return {
      asin,
      opportunityScore: Math.round(Math.random() * 40 + 60), // 60-100 arası
      factors: {
        profitability: Math.round(Math.random() * 30 + 70),
        competition: Math.round(Math.random() * 40 + 30),
        trend: Math.round(Math.random() * 30 + 60),
        market: Math.round(Math.random() * 25 + 65),
      },
      recommendation: 'Yüksek potansiyel - detaylı analiz önerilir',
      confidence: 'high',
    };
  }
}