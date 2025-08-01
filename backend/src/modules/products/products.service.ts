import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, In } from 'typeorm';
import { AmazonApiService } from '../amazon-api/amazon-api.service';

import { Product } from './entities/product.entity';
import { Category } from './entities/category.entity';
import { ProductPriceHistory } from './entities/product-price-history.entity';

import { 
  CreateProductDto,
  UpdateProductDto,
  ProductFiltersDto,
  BulkImportDto,
  ProductAnalysisDto
} from './dto/products.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(ProductPriceHistory)
    private readonly priceHistoryRepository: Repository<ProductPriceHistory>,
    private readonly amazonApiService: AmazonApiService,
  ) {}

  /**
   * Kullanıcının tüm ürünlerini getir (filtreleme ile)
   */
  async findAll(userId: string, filters: ProductFiltersDto): Promise<{
    products: Product[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        search,
        categoryId,
        minPrice,
        maxPrice,
        minRating,
        minReviews,
        isTracked,
        isWishlisted,
        sortBy = 'createdAt',
        sortOrder = 'DESC',
        page = 1,
        limit = 20,
      } = filters;

      const query = this.productRepository
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.category', 'category')
        .where('product.userId = :userId', { userId })
        .andWhere('product.isActive = :isActive', { isActive: true });

      // Arama filtresi
      if (search) {
        query.andWhere(
          '(product.title ILIKE :search OR product.brand ILIKE :search OR product.asin ILIKE :search)',
          { search: `%${search}%` }
        );
      }

      // Kategori filtresi
      if (categoryId) {
        query.andWhere('product.categoryId = :categoryId', { categoryId });
      }

      // Fiyat filtreleri
      if (minPrice !== undefined) {
        query.andWhere('product.price >= :minPrice', { minPrice });
      }
      if (maxPrice !== undefined) {
        query.andWhere('product.price <= :maxPrice', { maxPrice });
      }

      // Rating filtresi
      if (minRating !== undefined) {
        query.andWhere('product.reviewAverage >= :minRating', { minRating });
      }

      // Review count filtresi
      if (minReviews !== undefined) {
        query.andWhere('product.reviewCount >= :minReviews', { minReviews });
      }

      // Tracking filtresi
      if (isTracked !== undefined) {
        query.andWhere('product.isTracked = :isTracked', { isTracked });
      }

      // Wishlist filtresi
      if (isWishlisted !== undefined) {
        query.andWhere('product.isWishlisted = :isWishlisted', { isWishlisted });
      }

      // Sıralama
      const validSortFields = [
        'createdAt', 'updatedAt', 'title', 'price', 'reviewAverage', 
        'reviewCount', 'salesRank', 'overallScore'
      ];
      
      if (validSortFields.includes(sortBy)) {
        query.orderBy(`product.${sortBy}`, sortOrder as 'ASC' | 'DESC');
      }

      // Sayfalama
      const offset = (page - 1) * limit;
      query.skip(offset).take(limit);

      const [products, total] = await query.getManyAndCount();
      const totalPages = Math.ceil(total / limit);

      this.logger.log(`Found ${products.length} products for user ${userId}`);

      return {
        products,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error(`Error finding products for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * ID ile ürün getir
   */
  async findOne(userId: string, productId: string): Promise<Product> {
    try {
      const product = await this.productRepository.findOne({
        where: { id: productId, userId },
        relations: ['category', 'priceHistory', 'salesPredictions'],
      });

      if (!product) {
        throw new NotFoundException('Ürün bulunamadı');
      }

      return product;
    } catch (error) {
      this.logger.error(`Error finding product ${productId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * ASIN ile ürün oluştur (Amazon'dan veri çek)
   */
  async createFromAsin(userId: string, createProductDto: CreateProductDto): Promise<Product> {
    try {
      const { asin, categoryId, isTracked, notes } = createProductDto;

      this.logger.log(`Creating product from ASIN: ${asin} for user: ${userId}`);

      // ASIN'in zaten ekli olup olmadığını kontrol et
      const existingProduct = await this.productRepository.findOne({
        where: { userId, asin }
      });

      if (existingProduct) {
        throw new BadRequestException('Bu ASIN zaten eklendi');
      }

      // Amazon'dan ürün bilgilerini çek
      const amazonProduct = await this.amazonApiService.getProductByAsin(asin);
      
      if (!amazonProduct) {
        throw new NotFoundException('Amazon\'da ürün bulunamadı');
      }

      // Kategori kontrolü
      let category: Category | undefined;
      if (categoryId) {
        category = await this.categoryRepository.findOne({
          where: { id: categoryId }
        });
      }

      // Ürün oluştur
      const product = this.productRepository.create({
        userId,
        asin,
        title: amazonProduct.title,
        description: amazonProduct.description,
        brand: amazonProduct.brand,
        categoryId: category?.id,
        imageUrl: amazonProduct.images?.[0],
        productUrl: amazonProduct.amazonUrl || `https://www.amazon.com/dp/${asin}`,
        price: amazonProduct.price,
        primeEligible: amazonProduct.isPrime || false,
        isFba: amazonProduct.isFba || false,
        salesRank: amazonProduct.salesRank,
        reviewCount: amazonProduct.reviewCount || 0,
        reviewAverage: amazonProduct.reviewAverage || 0,
        dimensions: amazonProduct.dimensions,
        weight: amazonProduct.dimensions?.weight,
        features: amazonProduct.features || [],
        variations: amazonProduct.variations,
        isTracked: isTracked || false,
        notes,
      });

      const savedProduct = await this.productRepository.save(product);

      // İlk fiyat kaydını oluştur
      if (amazonProduct.price) {
        await this.createPriceHistory(savedProduct.id, amazonProduct.price);
      }

      this.logger.log(`Product created successfully: ${savedProduct.id}`);
      return savedProduct;
    } catch (error) {
      this.logger.error(`Error creating product from ASIN ${createProductDto.asin}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ürün güncelle
   */
  async update(userId: string, productId: string, updateProductDto: UpdateProductDto): Promise<Product> {
    try {
      const product = await this.findOne(userId, productId);

      // Güncelleme verilerini uygula
      Object.assign(product, updateProductDto);

      const updatedProduct = await this.productRepository.save(product);

      this.logger.log(`Product updated: ${productId}`);
      return updatedProduct;
    } catch (error) {
      this.logger.error(`Error updating product ${productId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ürün sil (soft delete)
   */
  async remove(userId: string, productId: string): Promise<void> {
    try {
      const product = await this.findOne(userId, productId);

      product.isActive = false;
      await this.productRepository.save(product);

      this.logger.log(`Product soft deleted: ${productId}`);
    } catch (error) {
      this.logger.error(`Error deleting product ${productId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toplu ürün ekleme (ASIN listesi)
   */
  async bulkImport(userId: string, bulkImportDto: BulkImportDto): Promise<{
    successful: Product[];
    failed: Array<{ asin: string; error: string }>;
  }> {
    try {
      const { asins, categoryId, isTracked } = bulkImportDto;
      const successful: Product[] = [];
      const failed: Array<{ asin: string; error: string }> = [];

      this.logger.log(`Bulk importing ${asins.length} ASINs for user: ${userId}`);

      for (const asin of asins) {
        try {
          const product = await this.createFromAsin(userId, {
            asin,
            categoryId,
            isTracked,
          });
          successful.push(product);
        } catch (error) {
          failed.push({
            asin,
            error: error.message,
          });
        }

        // Rate limiting - 1 saniye bekle
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.logger.log(`Bulk import completed: ${successful.length} successful, ${failed.length} failed`);

      return { successful, failed };
    } catch (error) {
      this.logger.error(`Error in bulk import: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ürün analizi güncelle
   */
  async updateAnalysis(userId: string, productId: string, analysisDto: ProductAnalysisDto): Promise<Product> {
    try {
      const product = await this.findOne(userId, productId);

      const { profitabilityScore, competitionScore, trendScore } = analysisDto;
      
      product.updateScores(profitabilityScore, competitionScore, trendScore);

      const updatedProduct = await this.productRepository.save(product);

      this.logger.log(`Product analysis updated: ${productId}`);
      return updatedProduct;
    } catch (error) {
      this.logger.error(`Error updating product analysis ${productId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fiyat geçmişi ekle
   */
  async createPriceHistory(productId: string, price: number, additional?: {
    availability?: string;
    sellerCount?: number;
    buyBoxPrice?: number;
    buyBoxSeller?: string;
  }): Promise<ProductPriceHistory> {
    try {
      // Önceki fiyatı al
      const previousPrice = await this.priceHistoryRepository.findOne({
        where: { productId },
        order: { recordedAt: 'DESC' },
      });

      const priceHistory = this.priceHistoryRepository.create({
        productId,
        price,
        availability: additional?.availability || 'In Stock',
        sellerCount: additional?.sellerCount || 1,
        buyBoxPrice: additional?.buyBoxPrice,
        buyBoxSeller: additional?.buyBoxSeller,
        isBuyBoxWinner: additional?.buyBoxPrice === price,
      });

      // Fiyat değişimi hesapla
      if (previousPrice) {
        priceHistory.updatePriceChange(previousPrice.price);
      }

      return await this.priceHistoryRepository.save(priceHistory);
    } catch (error) {
      this.logger.error(`Error creating price history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ürünleri takip et/takibi bırak
   */
  async toggleTracking(userId: string, productIds: string[], isTracked: boolean): Promise<void> {
    try {
      await this.productRepository.update(
        { id: In(productIds), userId },
        { isTracked }
      );

      this.logger.log(`Updated tracking for ${productIds.length} products: ${isTracked}`);
    } catch (error) {
      this.logger.error(`Error updating tracking: ${error.message}`);
      throw error;
    }
  }

  /**
   * Wishlist'e ekle/çıkar
   */
  async toggleWishlist(userId: string, productIds: string[], isWishlisted: boolean): Promise<void> {
    try {
      await this.productRepository.update(
        { id: In(productIds), userId },
        { isWishlisted }
      );

      this.logger.log(`Updated wishlist for ${productIds.length} products: ${isWishlisted}`);
    } catch (error) {
      this.logger.error(`Error updating wishlist: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ürün istatistikleri
   */
  async getStats(userId: string): Promise<{
    totalProducts: number;
    trackedProducts: number;
    wishlistedProducts: number;
    averagePrice: number;
    averageRating: number;
    topCategories: Array<{ name: string; count: number }>;
    recentlyAdded: Product[];
  }> {
    try {
      const baseQuery = this.productRepository
        .createQueryBuilder('product')
        .where('product.userId = :userId', { userId })
        .andWhere('product.isActive = :isActive', { isActive: true });

      // Toplam sayılar
      const totalProducts = await baseQuery.getCount();
      
      const trackedProducts = await baseQuery
        .clone()
        .andWhere('product.isTracked = :isTracked', { isTracked: true })
        .getCount();

      const wishlistedProducts = await baseQuery
        .clone()
        .andWhere('product.isWishlisted = :isWishlisted', { isWishlisted: true })
        .getCount();

      // Ortalamalar
      const avgResult = await baseQuery
        .select([
          'AVG(product.price) as avgPrice',
          'AVG(product.reviewAverage) as avgRating',
        ])
        .getRawOne();

      // Top kategoriler
      const topCategories = await this.productRepository
        .createQueryBuilder('product')
        .leftJoin('product.category', 'category')
        .select([
          'category.name as name',
          'COUNT(*) as count',
        ])
        .where('product.userId = :userId', { userId })
        .andWhere('product.isActive = :isActive', { isActive: true })
        .andWhere('category.name IS NOT NULL')
        .groupBy('category.name')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany();

      // Son eklenenler
      const recentlyAdded = await baseQuery
        .clone()
        .orderBy('product.createdAt', 'DESC')
        .limit(5)
        .getMany();

      return {
        totalProducts,
        trackedProducts,
        wishlistedProducts,
        averagePrice: parseFloat(avgResult?.avgPrice || '0'),
        averageRating: parseFloat(avgResult?.avgRating || '0'),
        topCategories,
        recentlyAdded,
      };
    } catch (error) {
      this.logger.error(`Error getting stats for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Amazon'dan ürün verilerini güncelle
   */
  async refreshFromAmazon(userId: string, productId: string): Promise<Product> {
    try {
      const product = await this.findOne(userId, productId);

      this.logger.log(`Refreshing product data from Amazon: ${product.asin}`);

      // Amazon'dan güncel veriyi al
      const amazonProduct = await this.amazonApiService.getProductByAsin(product.asin);
      
      if (!amazonProduct) {
        throw new NotFoundException('Amazon\'da ürün bulunamadı');
      }

      // Ürün bilgilerini güncelle
      product.title = amazonProduct.title;
      product.description = amazonProduct.description || product.description;
      product.price = amazonProduct.price || product.price;
      product.reviewCount = amazonProduct.reviewCount || product.reviewCount;
      product.reviewAverage = amazonProduct.reviewAverage || product.reviewAverage;
      product.salesRank = amazonProduct.salesRank || product.salesRank;

      const updatedProduct = await this.productRepository.save(product);

      // Fiyat değişikliği varsa kaydet
      if (amazonProduct.price && amazonProduct.price !== product.price) {
        await this.createPriceHistory(product.id, amazonProduct.price);
      }

      this.logger.log(`Product refreshed from Amazon: ${productId}`);
      return updatedProduct;
    } catch (error) {
      this.logger.error(`Error refreshing product ${productId}: ${error.message}`);
      throw error;
    }
  }
}