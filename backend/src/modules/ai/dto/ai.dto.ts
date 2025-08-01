import { IsString, IsOptional, IsArray, IsEnum, IsNumber, IsBoolean, IsDateString, ValidateNested, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Enums
export enum ModelTypeDto {
  LSTM = 'lstm',
  PROPHET = 'prophet',
  ARIMA = 'arima',
  DISTILBERT = 'distilbert',
  ROBERTA = 'roberta',
  ENSEMBLE = 'ensemble',
}

export enum ForecastTypeDto {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
}

export enum AnalysisSourceDto {
  PRODUCT_REVIEWS = 'product_reviews',
  CUSTOMER_FEEDBACK = 'customer_feedback',
  SOCIAL_MEDIA = 'social_media',
  COMPETITOR_ANALYSIS = 'competitor_analysis',
}

// Base DTOs
export class DataPointDto {
  @ApiProperty({ description: 'Tarih', example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Değer', example: 100.5 })
  @IsNumber()
  value: number;
}

export class ExternalFactorsDto {
  @ApiPropertyOptional({ description: 'Tatil günleri', example: ['2024-12-25', '2024-01-01'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  holidays?: string[];

  @ApiPropertyOptional({ description: 'Promosyon dönemleri' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionDto)
  promotions?: PromotionDto[];

  @ApiPropertyOptional({ description: 'Fiyat değişiklikleri' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PriceChangeDto)
  priceChanges?: PriceChangeDto[];
}

export class PromotionDto {
  @ApiProperty({ description: 'Başlangıç tarihi', example: '2024-01-15' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Bitiş tarihi', example: '2024-01-20' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'İndirim oranı', example: 25, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  discount: number;

  @ApiProperty({ description: 'Promosyon tipi', example: 'flash_sale' })
  @IsString()
  type: string;
}

export class PriceChangeDto {
  @ApiProperty({ description: 'Değişiklik tarihi', example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Yeni fiyat', example: 29.99 })
  @IsNumber()
  @Min(0)
  newPrice: number;

  @ApiProperty({ description: 'Eski fiyat', example: 34.99 })
  @IsNumber()
  @Min(0)
  oldPrice: number;
}

// Trend Prediction DTOs
export class TrendPredictionRequestDto {
  @ApiProperty({ description: 'ASIN', example: 'B08N5WRWNW' })
  @IsString()
  asin: string;

  @ApiProperty({ description: 'Veri noktaları', type: [DataPointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DataPointDto)
  dataPoints: DataPointDto[];

  @ApiProperty({ description: 'Zaman dilimi', enum: ['daily', 'weekly', 'monthly'], example: 'daily' })
  @IsEnum(['daily', 'weekly', 'monthly'])
  timeframe: 'daily' | 'weekly' | 'monthly';

  @ApiProperty({ description: 'Tahmin ufku (gün)', example: 30, minimum: 1, maximum: 365 })
  @IsNumber()
  @Min(1)
  @Max(365)
  forecastHorizon: number;

  @ApiProperty({ description: 'Model tipi', enum: ModelTypeDto, example: ModelTypeDto.LSTM })
  @IsEnum(ModelTypeDto)
  modelType: ModelTypeDto;

  @ApiPropertyOptional({ description: 'Dış faktörleri dahil et', example: true })
  @IsOptional()
  @IsBoolean()
  includeExternalFactors?: boolean;

  @ApiPropertyOptional({ description: 'Dış faktörler' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalFactorsDto)
  externalFactors?: ExternalFactorsDto;
}

export class TrendPredictionResponseDto {
  @ApiProperty({ description: 'Trend yönü', example: 'upward' })
  trendDirection: string;

  @ApiProperty({ description: 'Trend gücü', example: 'strong' })
  trendStrength: string;

  @ApiProperty({ description: 'Güven oranı', example: 85.5 })
  confidence: number;

  @ApiProperty({ description: 'Trend skoru', example: 0.15 })
  trendScore: number;

  @ApiProperty({ description: 'Tahmin sonuçları' })
  forecast: Array<{
    date: string;
    predicted: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
  }>;

  @ApiPropertyOptional({ description: 'Sezonluk analiz' })
  seasonality?: {
    hasSeasonality: boolean;
    period: number;
    strength: number;
  };

  @ApiPropertyOptional({ description: 'Anomaliler' })
  anomalies?: Array<{
    date: string;
    value: number;
    anomalyScore: number;
    severity: string;
  }>;

  @ApiProperty({ description: 'İçgörüler', example: ['Strong upward trend detected', 'Seasonal pattern identified'] })
  insights: string[];

  @ApiProperty({ description: 'Öneriler', example: ['Consider increasing inventory', 'Monitor competitor activity'] })
  recommendations: string[];
}

// Sentiment Analysis DTOs
export class SentimentTextDto {
  @ApiProperty({ description: 'Metin ID', example: 'review_123' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Analiz edilecek metin', example: 'This product is amazing! Great quality and fast shipping.' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Yıldız puanı', example: 5, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ description: 'Doğrulanmış satın alma', example: true })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ description: 'Tarih', example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Kaynak', example: 'amazon_review' })
  @IsOptional()
  @IsString()
  source?: string;
}

export class SentimentAnalysisRequestDto {
  @ApiProperty({ description: 'ASIN', example: 'B08N5WRWNW' })
  @IsString()
  asin: string;

  @ApiProperty({ description: 'Ürün adı', example: 'Wireless Bluetooth Headphones' })
  @IsString()
  productName: string;

  @ApiProperty({ description: 'Analiz edilecek metinler', type: [SentimentTextDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SentimentTextDto)
  texts: SentimentTextDto[];

  @ApiProperty({ description: 'Analiz kaynağı', enum: AnalysisSourceDto, example: AnalysisSourceDto.PRODUCT_REVIEWS })
  @IsEnum(AnalysisSourceDto)
  analysisSource: AnalysisSourceDto;

  @ApiProperty({ description: 'Model tipi', enum: [ModelTypeDto.DISTILBERT, ModelTypeDto.ROBERTA], example: ModelTypeDto.DISTILBERT })
  @IsEnum([ModelTypeDto.DISTILBERT, ModelTypeDto.ROBERTA])
  modelType: ModelTypeDto.DISTILBERT | ModelTypeDto.ROBERTA;

  @ApiPropertyOptional({ description: 'Emotion analizi dahil et', example: true })
  @IsOptional()
  @IsBoolean()
  includeEmotions?: boolean;

  @ApiPropertyOptional({ description: 'Aspect-based analiz dahil et', example: true })
  @IsOptional()
  @IsBoolean()
  includeAspects?: boolean;

  @ApiPropertyOptional({ description: 'Rakip karşılaştırması', example: true })
  @IsOptional()
  @IsBoolean()
  compareWithCompetitors?: boolean;

  @ApiPropertyOptional({ description: 'Rakip ASIN\'leri', example: ['B08N5WRWNX', 'B08N5WRWNY'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competitorASINs?: string[];
}

export class SentimentAnalysisResponseDto {
  @ApiProperty({ description: 'Genel sentiment', example: 'positive' })
  overallSentiment: string;

  @ApiProperty({ description: 'Sentiment skoru (0-1)', example: 0.75 })
  sentimentScore: number;

  @ApiProperty({ description: 'Güven oranı', example: 87.5 })
  confidence: number;

  @ApiProperty({ description: 'Sentiment dağılımı' })
  sentimentDistribution: {
    veryPositive: { count: number; percentage: number };
    positive: { count: number; percentage: number };
    neutral: { count: number; percentage: number };
    negative: { count: number; percentage: number };
    veryNegative: { count: number; percentage: number };
  };

  @ApiPropertyOptional({ description: 'Emotion analizi' })
  emotionAnalysis?: {
    primaryEmotion: string;
    emotions: Array<{
      emotion: string;
      score: number;
      confidence: number;
    }>;
  };

  @ApiPropertyOptional({ description: 'Aspect bazlı sentimentler' })
  aspectSentiments?: Array<{
    aspect: string;
    sentiment: string;
    score: number;
    confidence: number;
    mentions: number;
    keywords: string[];
  }>;

  @ApiPropertyOptional({ description: 'Rakip karşılaştırması' })
  competitorComparison?: {
    ourPosition: string;
    marketAverage: number;
    percentileRank: number;
    competitors: Array<{
      asin: string;
      sentiment: number;
      sampleSize: number;
    }>;
  };

  @ApiProperty({ description: 'İçgörüler' })
  insights: string[];

  @ApiProperty({ description: 'Öneriler' })
  recommendations: string[];
}

// Sales Forecasting DTOs
export class SalesDataPointDto {
  @ApiProperty({ description: 'Tarih', example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Satış adedi', example: 15 })
  @IsNumber()
  @Min(0)
  sales: number;

  @ApiPropertyOptional({ description: 'Gelir', example: 449.85 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  revenue?: number;

  @ApiPropertyOptional({ description: 'Birim sayısı', example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  units?: number;

  @ApiPropertyOptional({ description: 'Fiyat', example: 29.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;
}

export class SalesForecastRequestDto {
  @ApiProperty({ description: 'ASIN', example: 'B08N5WRWNW' })
  @IsString()
  asin: string;

  @ApiProperty({ description: 'Ürün adı', example: 'Wireless Bluetooth Headphones' })
  @IsString()
  productName: string;

  @ApiProperty({ description: 'Geçmiş satış verileri', type: [SalesDataPointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesDataPointDto)
  historicalSales: SalesDataPointDto[];

  @ApiProperty({ description: 'Tahmin dönemi' })
  @ValidateNested()
  @Type(() => ForecastPeriodDto)
  forecastPeriod: ForecastPeriodDto;

  @ApiProperty({ description: 'Model tipi', enum: ModelTypeDto, example: ModelTypeDto.LSTM })
  @IsEnum(ModelTypeDto)
  modelType: ModelTypeDto;

  @ApiPropertyOptional({ description: 'Dış faktörler' })
  @IsOptional()
  @ValidateNested()
  @Type(() => ExternalFactorsDto)
  externalFactors?: ExternalFactorsDto;

  @ApiPropertyOptional({ description: 'Güven aralıkları dahil et', example: true })
  @IsOptional()
  @IsBoolean()
  includeConfidenceIntervals?: boolean;

  @ApiPropertyOptional({ description: 'Senaryo analizi dahil et', example: true })
  @IsOptional()
  @IsBoolean()
  includeScenarioAnalysis?: boolean;
}

export class ForecastPeriodDto {
  @ApiProperty({ description: 'Başlangıç tarihi', example: '2024-02-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Bitiş tarihi', example: '2024-02-29' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ description: 'Tahmin tipi', enum: ForecastTypeDto, example: ForecastTypeDto.DAILY })
  @IsEnum(ForecastTypeDto)
  type: ForecastTypeDto;
}

export class SalesForecastResponseDto {
  @ApiProperty({ description: 'Tahmin sonuçları' })
  forecastResults: Array<{
    date: string;
    predicted: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
    seasonalComponent?: number;
    trendComponent?: number;
  }>;

  @ApiProperty({ description: 'Toplam metrikler' })
  aggregateMetrics: {
    totalForecastSales: number;
    averageDailySales: number;
    peakSalesDate: string;
    peakSalesAmount: number;
    growthRate: number;
  };

  @ApiProperty({ description: 'Doğruluk metrikleri' })
  accuracy: {
    modelAccuracy: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    accuracyRating: string;
  };

  @ApiPropertyOptional({ description: 'Sezonluk analiz' })
  seasonality?: {
    hasSeasonality: boolean;
    seasonalityType: string;
    seasonalStrength: number;
    seasonalPeaks: Array<{
      period: string;
      multiplier: number;
    }>;
  };

  @ApiPropertyOptional({ description: 'Senaryo analizi' })
  scenarios?: {
    optimistic: { totalSales: number; probability: number };
    pessimistic: { totalSales: number; probability: number };
    realistic: { totalSales: number; probability: number };
  };

  @ApiProperty({ description: 'İçgörüler' })
  insights: string[];

  @ApiProperty({ description: 'Öneriler' })
  recommendations: string[];
}

// Inventory Planning DTOs
export class InventoryPlanningRequestDto {
  @ApiProperty({ description: 'ASIN', example: 'B08N5WRWNW' })
  @IsString()
  asin: string;

  @ApiProperty({ description: 'Mevcut stok', example: 150 })
  @IsNumber()
  @Min(0)
  currentStock: number;

  @ApiProperty({ description: 'Tedarik süresi (gün)', example: 14 })
  @IsNumber()
  @Min(1)
  @Max(90)
  leadTime: number;

  @ApiProperty({ description: 'Hizmet seviyesi (0.8-0.99)', example: 0.95, minimum: 0.8, maximum: 0.99 })
  @IsNumber()
  @Min(0.8)
  @Max(0.99)
  serviceLevel: number;

  @ApiProperty({ description: 'Satış tahmini ID', example: 'forecast_12345' })
  @IsString()
  salesForecastId: string;
}

export class InventoryPlanningResponseDto {
  @ApiProperty({ description: 'Stok önerileri' })
  recommendations: Array<{
    date: string;
    recommendedStock: number;
    safetyStock: number;
    reorderPoint: number;
    orderQuantity?: number;
    rationale: string;
  }>;

  @ApiProperty({ description: 'Uyarılar' })
  alerts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    date: string;
    message: string;
    action: string;
  }>;

  @ApiProperty({ description: 'KPI\'lar' })
  kpis: {
    forecastAccuracy: number;
    expectedTurnover: number;
    stockoutRisk: number;
    totalInvestmentRequired: number;
  };
}

// Model Management DTOs
export class ModelTrainingRequestDto {
  @ApiProperty({ description: 'Model adı', example: 'LSTM Sales Forecast v2' })
  @IsString()
  modelName: string;

  @ApiProperty({ description: 'Model tipi', enum: ModelTypeDto, example: ModelTypeDto.LSTM })
  @IsEnum(ModelTypeDto)
  modelType: ModelTypeDto;

  @ApiProperty({ description: 'Tahmin tipi', example: 'sales_forecast' })
  @IsString()
  predictionType: string;

  @ApiProperty({ description: 'Eğitim verisi ID', example: 'dataset_12345' })
  @IsString()
  trainingDataId: string;

  @ApiPropertyOptional({ description: 'Model konfigürasyonu' })
  @IsOptional()
  modelConfig?: {
    hyperparameters?: any;
    features?: any;
    validation?: any;
  };

  @ApiPropertyOptional({ description: 'Otomatik yeniden eğitim', example: true })
  @IsOptional()
  @IsBoolean()
  autoRetrain?: boolean;

  @ApiPropertyOptional({ description: 'Yeniden eğitim sıklığı (gün)', example: 30 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  retrainFrequencyDays?: number;
}

export class ModelTrainingResponseDto {
  @ApiProperty({ description: 'Model ID', example: 'model_12345' })
  modelId: string;

  @ApiProperty({ description: 'Eğitim durumu', example: 'training' })
  status: string;

  @ApiProperty({ description: 'Tahmini tamamlanma süresi (dk)', example: 15 })
  estimatedCompletionTime: number;

  @ApiProperty({ description: 'Eğitim başlangıç zamanı', example: '2024-01-15T10:30:00Z' })
  trainingStartTime: string;

  @ApiPropertyOptional({ description: 'İlerleme yüzdesi', example: 25 })
  @IsOptional()
  progress?: number;
}

export class ModelPerformanceDto {
  @ApiProperty({ description: 'Model ID', example: 'model_12345' })
  modelId: string;

  @ApiProperty({ description: 'Model adı', example: 'LSTM Sales Forecast v2' })
  modelName: string;

  @ApiProperty({ description: 'Doğruluk oranı', example: 87.5 })
  accuracy: number;

  @ApiProperty({ description: 'Performans notu', example: 'A' })
  performanceGrade: string;

  @ApiProperty({ description: 'Güvenilirlik skoru', example: 92.3 })
  reliabilityScore: number;

  @ApiProperty({ description: 'Son eğitim tarihi', example: '2024-01-15T08:00:00Z' })
  lastTrainedAt: string;

  @ApiProperty({ description: 'Yeniden eğitim gerekli mi', example: false })
  needsRetraining: boolean;

  @ApiProperty({ description: 'İçgörüler' })
  insights: string[];

  @ApiProperty({ description: 'ROI', example: 250.5 })
  roi: number;
}

// Data Upload DTOs
export class DataUploadRequestDto {
  @ApiProperty({ description: 'Veri seti adı', example: 'Sales Data Q4 2023' })
  @IsString()
  datasetName: string;

  @ApiPropertyOptional({ description: 'Açıklama', example: 'Q4 2023 sales data for all products' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Veri tipi', example: 'time_series' })
  @IsString()
  dataType: string;

  @ApiProperty({ description: 'Veri kaynağı', example: 'file_upload' })
  @IsString()
  dataSource: string;

  @ApiProperty({ description: 'Dosya formatı', example: 'csv' })
  @IsString()
  fileFormat: string;

  @ApiPropertyOptional({ description: 'Etiketler', example: ['sales', 'q4', '2023'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class DataUploadResponseDto {
  @ApiProperty({ description: 'Upload ID', example: 'upload_12345' })
  uploadId: string;

  @ApiProperty({ description: 'Durum', example: 'processing' })
  status: string;

  @ApiProperty({ description: 'Dosya boyutu (bytes)', example: 1048576 })
  fileSize: number;

  @ApiProperty({ description: 'Kayıt sayısı', example: 1500 })
  recordCount: number;

  @ApiProperty({ description: 'Özellik sayısı', example: 8 })
  featureCount: number;

  @ApiProperty({ description: 'Veri kalitesi skoru', example: 92.5 })
  dataQualityScore: number;

  @ApiProperty({ description: 'İşleme süresi (ms)', example: 2500 })
  processingTime: number;
}

// Anomaly Detection DTOs
export class AnomalyDetectionRequestDto {
  @ApiProperty({ description: 'ASIN', example: 'B08N5WRWNW' })
  @IsString()
  asin: string;

  @ApiProperty({ description: 'Veri noktaları', type: [DataPointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DataPointDto)
  dataPoints: DataPointDto[];

  @ApiProperty({ description: 'Anomali tespit yöntemi', enum: ['isolation_forest', 'local_outlier_factor', 'one_class_svm'], example: 'isolation_forest' })
  @IsEnum(['isolation_forest', 'local_outlier_factor', 'one_class_svm'])
  method: 'isolation_forest' | 'local_outlier_factor' | 'one_class_svm';

  @ApiPropertyOptional({ description: 'Duyarlılık seviyesi (0-1)', example: 0.8, minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  sensitivity?: number;
}

export class AnomalyDetectionResponseDto {
  @ApiProperty({ description: 'Tespit edilen anomaliler' })
  anomalies: Array<{
    date: string;
    value: number;
    anomalyScore: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    explanation: string;
  }>;

  @ApiProperty({ description: 'Anomali özeti' })
  summary: {
    totalAnomalies: number;
    anomalyRate: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };

  @ApiProperty({ description: 'İçgörüler' })
  insights: string[];

  @ApiProperty({ description: 'Öneriler' })
  recommendations: string[];
}

// Health Check DTOs
export class AIHealthCheckResponseDto {
  @ApiProperty({ description: 'Sistem durumu', example: 'healthy' })
  status: 'healthy' | 'degraded' | 'unhealthy';

  @ApiProperty({ description: 'Aktif modeller' })
  activeModels: {
    total: number;
    healthy: number;
    training: number;
    failed: number;
  };

  @ApiProperty({ description: 'Sistem metrikleri' })
  systemMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    diskUsage: number;
    responseTime: number;
  };

  @ApiProperty({ description: 'Son güncellemeler' })
  recentActivity: Array<{
    timestamp: string;
    activity: string;
    status: string;
  }>;

  @ApiProperty({ description: 'Uyarılar' })
  alerts: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
  }>;
}