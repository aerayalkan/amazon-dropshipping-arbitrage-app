import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';

import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import {
  CreateProductDto,
  UpdateProductDto,
  ProductFiltersDto,
  BulkImportDto,
  ProductAnalysisDto,
  ToggleTrackingDto,
  ToggleWishlistDto,
  ProductResponseDto,
  PaginatedProductsDto,
  BulkImportResultDto,
  ProductStatsDto,
} from './dto/products.dto';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('products')
export class ProductsController {
  private readonly logger = new Logger(ProductsController.name);

  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({
    summary: 'ASIN ile ürün ekle',
    description: 'Amazon\'dan ASIN ile ürün bilgilerini çekip veritabanına ekler'
  })
  @ApiResponse({
    status: 201,
    description: 'Ürün başarıyla eklendi',
    type: ProductResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Geçersiz ASIN veya ürün zaten mevcut'
  })
  @ApiResponse({
    status: 404,
    description: 'Amazon\'da ürün bulunamadı'
  })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createProductDto: CreateProductDto
  ): Promise<ProductResponseDto> {
    this.logger.log(`Creating product from ASIN: ${createProductDto.asin} for user: ${userId}`);
    return this.productsService.createFromAsin(userId, createProductDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Ürünleri listele',
    description: 'Kullanıcının ürünlerini filtreler ve sayfalama ile listeler'
  })
  @ApiResponse({
    status: 200,
    description: 'Ürünler başarıyla listelendi',
    type: PaginatedProductsDto
  })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() filters: ProductFiltersDto
  ): Promise<PaginatedProductsDto> {
    this.logger.log(`Getting products for user: ${userId}`);
    return this.productsService.findAll(userId, filters);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Ürün istatistikleri',
    description: 'Kullanıcının ürün portföyü hakkında istatistik bilgileri'
  })
  @ApiResponse({
    status: 200,
    description: 'İstatistikler başarıyla getirildi',
    type: ProductStatsDto
  })
  async getStats(
    @CurrentUser('id') userId: string
  ): Promise<ProductStatsDto> {
    this.logger.log(`Getting product stats for user: ${userId}`);
    return this.productsService.getStats(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Ürün detayı',
    description: 'ID ile ürün detaylarını getirir'
  })
  @ApiParam({
    name: 'id',
    description: 'Ürün ID\'si',
    format: 'uuid'
  })
  @ApiResponse({
    status: 200,
    description: 'Ürün detayları',
    type: ProductResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'Ürün bulunamadı'
  })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string
  ): Promise<ProductResponseDto> {
    this.logger.log(`Getting product ${productId} for user: ${userId}`);
    return this.productsService.findOne(userId, productId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Ürün güncelle',
    description: 'Ürün bilgilerini günceller'
  })
  @ApiParam({
    name: 'id',
    description: 'Ürün ID\'si',
    format: 'uuid'
  })
  @ApiResponse({
    status: 200,
    description: 'Ürün başarıyla güncellendi',
    type: ProductResponseDto
  })
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string,
    @Body() updateProductDto: UpdateProductDto
  ): Promise<ProductResponseDto> {
    this.logger.log(`Updating product ${productId} for user: ${userId}`);
    return this.productsService.update(userId, productId, updateProductDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Ürün sil',
    description: 'Ürünü soft delete ile siler'
  })
  @ApiParam({
    name: 'id',
    description: 'Ürün ID\'si',
    format: 'uuid'
  })
  @ApiResponse({
    status: 200,
    description: 'Ürün başarıyla silindi'
  })
  async remove(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string
  ): Promise<{ message: string }> {
    this.logger.log(`Deleting product ${productId} for user: ${userId}`);
    await this.productsService.remove(userId, productId);
    return { message: 'Ürün başarıyla silindi' };
  }

  @Post('bulk-import')
  @ApiOperation({
    summary: 'Toplu ürün ekleme',
    description: 'Birden fazla ASIN ile toplu ürün ekleme'
  })
  @ApiResponse({
    status: 201,
    description: 'Toplu import tamamlandı',
    type: BulkImportResultDto
  })
  async bulkImport(
    @CurrentUser('id') userId: string,
    @Body() bulkImportDto: BulkImportDto
  ): Promise<BulkImportResultDto> {
    this.logger.log(`Bulk importing ${bulkImportDto.asins.length} ASINs for user: ${userId}`);
    return this.productsService.bulkImport(userId, bulkImportDto);
  }

  @Patch(':id/analysis')
  @ApiOperation({
    summary: 'Ürün analizi güncelle',
    description: 'Ürünün kârlılık, rekabet ve trend skorlarını günceller'
  })
  @ApiParam({
    name: 'id',
    description: 'Ürün ID\'si',
    format: 'uuid'
  })
  @ApiResponse({
    status: 200,
    description: 'Analiz başarıyla güncellendi',
    type: ProductResponseDto
  })
  async updateAnalysis(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string,
    @Body() analysisDto: ProductAnalysisDto
  ): Promise<ProductResponseDto> {
    this.logger.log(`Updating analysis for product ${productId}`);
    return this.productsService.updateAnalysis(userId, productId, analysisDto);
  }

  @Post('toggle-tracking')
  @ApiOperation({
    summary: 'Takip durumunu değiştir',
    description: 'Seçili ürünlerin takip durumunu toplu olarak değiştirir'
  })
  @ApiResponse({
    status: 200,
    description: 'Takip durumu başarıyla güncellendi'
  })
  async toggleTracking(
    @CurrentUser('id') userId: string,
    @Body() toggleDto: ToggleTrackingDto
  ): Promise<{ message: string }> {
    this.logger.log(`Toggling tracking for ${toggleDto.productIds.length} products`);
    await this.productsService.toggleTracking(userId, toggleDto.productIds, toggleDto.isTracked);
    return { 
      message: `${toggleDto.productIds.length} ürünün takip durumu ${toggleDto.isTracked ? 'etkinleştirildi' : 'devre dışı bırakıldı'}` 
    };
  }

  @Post('toggle-wishlist')
  @ApiOperation({
    summary: 'Wishlist durumunu değiştir',
    description: 'Seçili ürünlerin wishlist durumunu toplu olarak değiştirir'
  })
  @ApiResponse({
    status: 200,
    description: 'Wishlist durumu başarıyla güncellendi'
  })
  async toggleWishlist(
    @CurrentUser('id') userId: string,
    @Body() toggleDto: ToggleWishlistDto
  ): Promise<{ message: string }> {
    this.logger.log(`Toggling wishlist for ${toggleDto.productIds.length} products`);
    await this.productsService.toggleWishlist(userId, toggleDto.productIds, toggleDto.isWishlisted);
    return { 
      message: `${toggleDto.productIds.length} ürün ${toggleDto.isWishlisted ? 'wishlist\'e eklendi' : 'wishlist\'ten çıkarıldı'}` 
    };
  }

  @Post(':id/refresh')
  @ApiOperation({
    summary: 'Amazon\'dan veri güncelle',
    description: 'Ürün bilgilerini Amazon\'dan yeniden çeker ve günceller'
  })
  @ApiParam({
    name: 'id',
    description: 'Ürün ID\'si',
    format: 'uuid'
  })
  @ApiResponse({
    status: 200,
    description: 'Ürün başarıyla güncellendi',
    type: ProductResponseDto
  })
  async refreshFromAmazon(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string
  ): Promise<ProductResponseDto> {
    this.logger.log(`Refreshing product ${productId} from Amazon`);
    return this.productsService.refreshFromAmazon(userId, productId);
  }

  @Get(':id/price-history')
  @ApiOperation({
    summary: 'Fiyat geçmişi',
    description: 'Ürünün fiyat geçmişini getirir'
  })
  @ApiParam({
    name: 'id',
    description: 'Ürün ID\'si',
    format: 'uuid'
  })
  @ApiQuery({
    name: 'days',
    description: 'Kaç günlük geçmiş (varsayılan: 30)',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Fiyat geçmişi başarıyla getirildi'
  })
  async getPriceHistory(
    @CurrentUser('id') userId: string,
    @Param('id') productId: string,
    @Query('days') days: number = 30
  ): Promise<any[]> {
    this.logger.log(`Getting price history for product ${productId}`);
    
    // Önce ürünün kullanıcıya ait olduğunu doğrula
    await this.productsService.findOne(userId, productId);
    
    // Price history logic burada implement edilecek
    // Şimdilik empty array dönüyoruz
    return [];
  }
}