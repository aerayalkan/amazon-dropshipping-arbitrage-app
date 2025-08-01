import { 
  IsString, 
  IsNumber, 
  IsBoolean, 
  IsOptional, 
  IsArray, 
  IsUUID,
  Min, 
  Max,
  Length,
  IsEnum,
  ValidateNested,
  IsDateString
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Base DTOs
export class CreateProductDto {
  @ApiProperty({ 
    description: 'Amazon ASIN', 
    example: 'B08N5WRWNW',
    minLength: 10,
    maxLength: 10
  })
  @IsString()
  @Length(10, 10, { message: 'ASIN 10 karakter olmalıdır' })
  asin: string;

  @ApiPropertyOptional({ 
    description: 'Kategori ID', 
    format: 'uuid'
  })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ 
    description: 'Ürünü takip et', 
    default: false
  })
  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;

  @ApiPropertyOptional({ 
    description: 'Notlar', 
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ description: 'Kategori ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Takip durumu' })
  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;

  @ApiPropertyOptional({ description: 'Wishlist durumu' })
  @IsOptional()
  @IsBoolean()
  isWishlisted?: boolean;

  @ApiPropertyOptional({ description: 'Notlar' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Aktif durumu' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProductFiltersDto {
  @ApiPropertyOptional({ description: 'Arama metni' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Kategori ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Minimum fiyat' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum fiyat' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Minimum rating' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Minimum review sayısı' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minReviews?: number;

  @ApiPropertyOptional({ description: 'Sadece takip edilenler' })
  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;

  @ApiPropertyOptional({ description: 'Sadece wishlist\'tekiler' })
  @IsOptional()
  @IsBoolean()
  isWishlisted?: boolean;

  @ApiPropertyOptional({ 
    description: 'Sıralama alanı',
    enum: ['createdAt', 'updatedAt', 'title', 'price', 'reviewAverage', 'reviewCount', 'salesRank', 'overallScore'],
    default: 'createdAt'
  })
  @IsOptional()
  @IsEnum(['createdAt', 'updatedAt', 'title', 'price', 'reviewAverage', 'reviewCount', 'salesRank', 'overallScore'])
  sortBy?: string;

  @ApiPropertyOptional({ 
    description: 'Sıralama yönü',
    enum: ['ASC', 'DESC'],
    default: 'DESC'
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @ApiPropertyOptional({ 
    description: 'Sayfa numarası',
    minimum: 1,
    default: 1
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Transform(({ value }) => parseInt(value))
  page?: number;

  @ApiPropertyOptional({ 
    description: 'Sayfa başına öğe sayısı',
    minimum: 1,
    maximum: 100,
    default: 20
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  limit?: number;
}

export class BulkImportDto {
  @ApiProperty({ 
    description: 'ASIN listesi',
    type: [String],
    example: ['B08N5WRWNW', 'B07FZ8S74R']
  })
  @IsArray()
  @IsString({ each: true })
  @Length(10, 10, { each: true, message: 'Her ASIN 10 karakter olmalıdır' })
  asins: string[];

  @ApiPropertyOptional({ description: 'Tüm ürünler için kategori ID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Tüm ürünleri takip et' })
  @IsOptional()
  @IsBoolean()
  isTracked?: boolean;
}

export class ProductAnalysisDto {
  @ApiPropertyOptional({ 
    description: 'Kârlılık skoru (0-100)',
    minimum: 0,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  profitabilityScore?: number;

  @ApiPropertyOptional({ 
    description: 'Rekabet skoru (0-100)',
    minimum: 0,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  competitionScore?: number;

  @ApiPropertyOptional({ 
    description: 'Trend skoru (0-100)',
    minimum: 0,
    maximum: 100
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  trendScore?: number;
}

export class ToggleTrackingDto {
  @ApiProperty({ 
    description: 'Ürün ID listesi',
    type: [String]
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  productIds: string[];

  @ApiProperty({ description: 'Takip durumu' })
  @IsBoolean()
  isTracked: boolean;
}

export class ToggleWishlistDto {
  @ApiProperty({ 
    description: 'Ürün ID listesi',
    type: [String]
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  productIds: string[];

  @ApiProperty({ description: 'Wishlist durumu' })
  @IsBoolean()
  isWishlisted: boolean;
}

// Research DTOs
export class ResearchFiltersDto {
  @ApiPropertyOptional({ description: 'Kategori' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Minimum fiyat' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum fiyat' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Minimum review sayısı' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minReviews?: number;

  @ApiPropertyOptional({ description: 'Maximum review sayısı' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxReviews?: number;

  @ApiPropertyOptional({ description: 'Minimum rating' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Maximum sales rank' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxSalesRank?: number;

  @ApiPropertyOptional({ description: 'Sadece Prime ürünleri' })
  @IsOptional()
  @IsBoolean()
  primeOnly?: boolean;

  @ApiPropertyOptional({ description: 'Sadece FBA ürünleri' })
  @IsOptional()
  @IsBoolean()
  fbaOnly?: boolean;

  @ApiPropertyOptional({ description: 'Sadece yeni ürünler' })
  @IsOptional()
  @IsBoolean()
  newProducts?: boolean;

  @ApiPropertyOptional({ description: 'Sadece trend olan ürünler' })
  @IsOptional()
  @IsBoolean()
  trending?: boolean;

  @ApiPropertyOptional({ description: 'Sadece düşük rekabetli ürünler' })
  @IsOptional()
  @IsBoolean()
  lowCompetition?: boolean;

  @ApiPropertyOptional({ description: 'Sadece yüksek kârlılık potansiyeli olan ürünler' })
  @IsOptional()
  @IsBoolean()
  highProfitability?: boolean;
}

export class KeywordResearchDto {
  @ApiProperty({ 
    description: 'Ana anahtar kelime',
    example: 'bluetooth speaker'
  })
  @IsString()
  baseKeyword: string;

  @ApiPropertyOptional({ 
    description: 'Kategori (opsiyonel)',
    example: 'electronics'
  })
  @IsOptional()
  @IsString()
  category?: string;
}

// Response DTOs
export class ProductResponseDto {
  @ApiProperty({ description: 'Ürün ID' })
  id: string;

  @ApiProperty({ description: 'ASIN' })
  asin: string;

  @ApiProperty({ description: 'Başlık' })
  title: string;

  @ApiPropertyOptional({ description: 'Marka' })
  brand?: string;

  @ApiPropertyOptional({ description: 'Fiyat' })
  price?: number;

  @ApiProperty({ description: 'Yorum sayısı' })
  reviewCount: number;

  @ApiProperty({ description: 'Yorum ortalaması' })
  reviewAverage: number;

  @ApiPropertyOptional({ description: 'Satış sıralaması' })
  salesRank?: number;

  @ApiPropertyOptional({ description: 'Kârlılık skoru' })
  profitabilityScore?: number;

  @ApiPropertyOptional({ description: 'Rekabet skoru' })
  competitionScore?: number;

  @ApiPropertyOptional({ description: 'Trend skoru' })
  trendScore?: number;

  @ApiPropertyOptional({ description: 'Genel skor' })
  overallScore?: number;

  @ApiProperty({ description: 'Takip durumu' })
  isTracked: boolean;

  @ApiProperty({ description: 'Wishlist durumu' })
  isWishlisted: boolean;

  @ApiProperty({ description: 'Oluşturulma tarihi' })
  createdAt: Date;
}

export class ProductOpportunityDto {
  @ApiProperty({ description: 'ASIN' })
  asin: string;

  @ApiProperty({ description: 'Başlık' })
  title: string;

  @ApiProperty({ description: 'Fiyat' })
  price: number;

  @ApiProperty({ description: 'Satış sıralaması' })
  salesRank: number;

  @ApiProperty({ description: 'Yorum sayısı' })
  reviewCount: number;

  @ApiProperty({ description: 'Yorum ortalaması' })
  reviewAverage: number;

  @ApiProperty({ description: 'Kârlılık skoru' })
  profitabilityScore: number;

  @ApiProperty({ description: 'Rekabet skoru' })
  competitionScore: number;

  @ApiProperty({ description: 'Trend skoru' })
  trendScore: number;

  @ApiProperty({ description: 'Genel skor' })
  overallScore: number;

  @ApiProperty({ description: 'Fırsat nedenleri', type: [String] })
  reason: string[];

  @ApiProperty({ description: 'Kategori' })
  category: string;

  @ApiProperty({ description: 'Tahmini aylık satış' })
  estimatedMonthlySales: number;

  @ApiProperty({ description: 'Tahmini gelir' })
  estimatedRevenue: number;
}

export class MarketAnalysisDto {
  @ApiProperty({ description: 'Kategori' })
  category: string;

  @ApiProperty({ description: 'Toplam ürün sayısı' })
  totalProducts: number;

  @ApiProperty({ description: 'Ortalama fiyat' })
  averagePrice: number;

  @ApiProperty({ description: 'Fiyat aralığı' })
  priceRange: {
    min: number;
    max: number;
  };

  @ApiProperty({ description: 'Rekabet seviyesi', enum: ['low', 'medium', 'high'] })
  competitionLevel: 'low' | 'medium' | 'high';

  @ApiProperty({ description: 'Popüler anahtar kelimeler', type: [String] })
  topKeywords: string[];

  @ApiProperty({ description: 'Büyüme trendi', enum: ['up', 'down', 'stable'] })
  growthTrend: 'up' | 'down' | 'stable';

  @ApiProperty({ description: 'Mevsimsellik skoru' })
  seasonality: number;

  @ApiProperty({ description: 'Fırsat skoru' })
  opportunityScore: number;

  @ApiProperty({ description: 'Önerilen nişler', type: [String] })
  recommendedNiches: string[];
}

export class KeywordAnalysisDto {
  @ApiProperty({ description: 'Ana anahtar kelime' })
  primary: string;

  @ApiProperty({ description: 'İlgili anahtar kelimeler', type: [String] })
  related: string[];

  @ApiProperty({ description: 'Uzun kuyruk anahtar kelimeler', type: [String] })
  longTail: string[];

  @ApiProperty({ description: 'Arama hacmi' })
  searchVolume: Array<{
    keyword: string;
    volume: number;
  }>;

  @ApiProperty({ description: 'Anahtar kelime zorluğu' })
  difficulty: Array<{
    keyword: string;
    difficulty: number;
  }>;

  @ApiProperty({ description: 'Trend analizi' })
  trends: Array<{
    keyword: string;
    trend: 'up' | 'down' | 'stable';
  }>;
}

export class ProductStatsDto {
  @ApiProperty({ description: 'Toplam ürün sayısı' })
  totalProducts: number;

  @ApiProperty({ description: 'Takip edilen ürün sayısı' })
  trackedProducts: number;

  @ApiProperty({ description: 'Wishlist\'teki ürün sayısı' })
  wishlistedProducts: number;

  @ApiProperty({ description: 'Ortalama fiyat' })
  averagePrice: number;

  @ApiProperty({ description: 'Ortalama rating' })
  averageRating: number;

  @ApiProperty({ description: 'En popüler kategoriler' })
  topCategories: Array<{
    name: string;
    count: number;
  }>;

  @ApiProperty({ description: 'Son eklenen ürünler', type: [ProductResponseDto] })
  recentlyAdded: ProductResponseDto[];
}

export class BulkImportResultDto {
  @ApiProperty({ description: 'Başarılı ürünler', type: [ProductResponseDto] })
  successful: ProductResponseDto[];

  @ApiProperty({ description: 'Başarısız ürünler' })
  failed: Array<{
    asin: string;
    error: string;
  }>;
}

export class PaginatedProductsDto {
  @ApiProperty({ description: 'Ürünler', type: [ProductResponseDto] })
  products: ProductResponseDto[];

  @ApiProperty({ description: 'Toplam kayıt sayısı' })
  total: number;

  @ApiProperty({ description: 'Mevcut sayfa' })
  page: number;

  @ApiProperty({ description: 'Sayfa başına kayıt sayısı' })
  limit: number;

  @ApiProperty({ description: 'Toplam sayfa sayısı' })
  totalPages: number;
}