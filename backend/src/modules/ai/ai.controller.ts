import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  ValidationPipe,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

import {
  TrendPredictionRequestDto,
  TrendPredictionResponseDto,
  SentimentAnalysisRequestDto,
  SentimentAnalysisResponseDto,
  SalesForecastRequestDto,
  SalesForecastResponseDto,
  InventoryPlanningRequestDto,
  InventoryPlanningResponseDto,
  ModelTrainingRequestDto,
  ModelTrainingResponseDto,
  ModelPerformanceDto,
  DataUploadRequestDto,
  DataUploadResponseDto,
  AnomalyDetectionRequestDto,
  AnomalyDetectionResponseDto,
  AIHealthCheckResponseDto,
  ModelTypeDto,
} from './dto/ai.dto';

import { TrendPredictionService } from './services/trend-prediction.service';
import { SentimentAnalysisService } from './services/sentiment-analysis.service';
import { SalesForecastingService } from './services/sales-forecasting.service';

export interface User {
  id: string;
  email: string;
}

@ApiTags('AI & Machine Learning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AIController {
  constructor(
    private readonly trendPredictionService: TrendPredictionService,
    private readonly sentimentAnalysisService: SentimentAnalysisService,
    private readonly salesForecastingService: SalesForecastingService,
  ) {}

  // Trend Prediction Endpoints
  @Post('trend-prediction')
  @ApiOperation({
    summary: 'Trend tahmini yap',
    description: 'LSTM, Prophet veya ARIMA kullanarak trend tahmini yapar',
  })
  @ApiResponse({
    status: 201,
    description: 'Trend tahmini başarıyla tamamlandı',
    type: TrendPredictionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Geçersiz veri formatı' })
  @ApiResponse({ status: 401, description: 'Yetkilendirme hatası' })
  @HttpCode(HttpStatus.CREATED)
  async predictTrend(
    @CurrentUser() user: User,
    @Body(ValidationPipe) request: TrendPredictionRequestDto,
  ): Promise<TrendPredictionResponseDto> {
    const input = {
      dataPoints: request.dataPoints.map(dp => ({
        date: new Date(dp.date),
        value: dp.value,
      })),
      timeframe: request.timeframe,
      forecastHorizon: request.forecastHorizon,
      includeExternalFactors: request.includeExternalFactors,
      seasonalityDetection: true,
    };

    let result;
    switch (request.modelType) {
      case ModelTypeDto.LSTM:
        result = await this.trendPredictionService.predictTrendWithLSTM(user.id, input);
        break;
      case ModelTypeDto.PROPHET:
        result = await this.trendPredictionService.predictTrendWithProphet(user.id, input);
        break;
      case ModelTypeDto.ENSEMBLE:
        result = await this.trendPredictionService.predictTrendEnsemble(user.id, input);
        break;
      default:
        result = await this.trendPredictionService.predictTrendAuto(user.id, input);
    }

    return {
      trendDirection: result.trendDirection,
      trendStrength: result.trendStrength,
      confidence: result.confidence,
      trendScore: result.trendScore,
      forecast: result.forecast.map(f => ({
        date: f.date.toISOString(),
        predicted: f.predicted,
        lowerBound: f.lowerBound,
        upperBound: f.upperBound,
        confidence: f.confidence,
      })),
      seasonality: result.seasonality,
      anomalies: result.anomalies?.map(a => ({
        date: a.date.toISOString(),
        value: a.value,
        anomalyScore: a.anomalyScore,
        severity: a.severity,
      })),
      insights: result.insights || [],
      recommendations: result.recommendations || [],
    };
  }

  @Post('anomaly-detection')
  @ApiOperation({
    summary: 'Anomali tespiti',
    description: 'Zaman serisi verilerinde anomali tespit eder',
  })
  @ApiResponse({
    status: 201,
    description: 'Anomali tespiti başarıyla tamamlandı',
    type: AnomalyDetectionResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async detectAnomalies(
    @CurrentUser() user: User,
    @Body(ValidationPipe) request: AnomalyDetectionRequestDto,
  ): Promise<AnomalyDetectionResponseDto> {
    const dataPoints = request.dataPoints.map(dp => ({
      date: new Date(dp.date),
      value: dp.value,
    }));

    const anomalies = await this.trendPredictionService.detectAnomalies(
      user.id,
      dataPoints,
      request.method,
    );

    const summary = {
      totalAnomalies: anomalies.length,
      anomalyRate: (anomalies.length / dataPoints.length) * 100,
      criticalCount: anomalies.filter(a => a.severity === 'critical').length,
      highCount: anomalies.filter(a => a.severity === 'high').length,
      mediumCount: anomalies.filter(a => a.severity === 'medium').length,
      lowCount: anomalies.filter(a => a.severity === 'low').length,
    };

    return {
      anomalies: anomalies.map(a => ({
        date: a.date.toISOString(),
        value: a.value,
        anomalyScore: a.anomalyScore,
        severity: a.severity,
        explanation: a.explanation,
      })),
      summary,
      insights: [
        `${summary.totalAnomalies} anomali tespit edildi`,
        `Anomali oranı: %${summary.anomalyRate.toFixed(2)}`,
      ],
      recommendations: summary.criticalCount > 0 
        ? ['Kritik anomaliler acil inceleme gerektirir']
        : ['Düzenli anomali takibi önerilir'],
    };
  }

  @Post('seasonality-analysis')
  @ApiOperation({
    summary: 'Sezonluk analiz',
    description: 'Veri setindeki sezonluk desenleri analiz eder',
  })
  @ApiResponse({ status: 201, description: 'Sezonluk analiz tamamlandı' })
  async analyzeSeasonality(
    @CurrentUser() user: User,
    @Body() request: { asin: string; dataPoints: Array<{ date: string; value: number }> },
  ) {
    const dataPoints = request.dataPoints.map(dp => ({
      date: new Date(dp.date),
      value: dp.value,
    }));

    const result = await this.trendPredictionService.analyzeSeasonality(user.id, dataPoints);

    return {
      hasSeasonality: result.hasSeasonality,
      seasonalPeriods: result.seasonalPeriods,
      seasonalDecomposition: {
        trend: result.seasonalDecomposition.trend.map(t => ({
          date: t.date.toISOString(),
          value: t.value,
        })),
        seasonal: result.seasonalDecomposition.seasonal.map(s => ({
          date: s.date.toISOString(),
          value: s.value,
        })),
        residual: result.seasonalDecomposition.residual.map(r => ({
          date: r.date.toISOString(),
          value: r.value,
        })),
      },
    };
  }

  // Sentiment Analysis Endpoints
  @Post('sentiment-analysis')
  @ApiOperation({
    summary: 'Sentiment analizi',
    description: 'DistilBERT veya RoBERTa kullanarak sentiment analizi yapar',
  })
  @ApiResponse({
    status: 201,
    description: 'Sentiment analizi başarıyla tamamlandı',
    type: SentimentAnalysisResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async analyzeSentiment(
    @CurrentUser() user: User,
    @Body(ValidationPipe) request: SentimentAnalysisRequestDto,
  ): Promise<SentimentAnalysisResponseDto> {
    const input = {
      texts: request.texts.map(t => ({
        id: t.id,
        text: t.text,
        rating: t.rating,
        verified: t.verified,
        date: t.date ? new Date(t.date) : undefined,
        source: t.source,
      })),
      analysisSource: request.analysisSource,
      includeEmotions: request.includeEmotions,
      includeAspects: request.includeAspects,
      compareWithCompetitors: request.compareWithCompetitors,
    };

    let result;
    switch (request.modelType) {
      case ModelTypeDto.DISTILBERT:
        result = await this.sentimentAnalysisService.analyzeSentimentWithDistilBERT(user.id, input);
        break;
      case ModelTypeDto.ROBERTA:
        result = await this.sentimentAnalysisService.analyzeSentimentWithRoBERTa(user.id, input);
        break;
      default:
        result = await this.sentimentAnalysisService.analyzeSentimentWithDistilBERT(user.id, input);
    }

    // Competitor comparison if requested
    let competitorComparison;
    if (request.compareWithCompetitors && request.competitorASINs?.length) {
      const comparison = await this.sentimentAnalysisService.compareCompetitorSentiment(
        user.id,
        request.asin,
        request.competitorASINs,
      );
      
      competitorComparison = {
        ourPosition: comparison.comparison.position,
        marketAverage: comparison.comparison.marketAverage,
        percentileRank: comparison.comparison.percentileRank,
        competitors: comparison.competitors,
      };
    }

    return {
      overallSentiment: result.overallSentiment,
      sentimentScore: result.sentimentScore,
      confidence: result.confidence,
      sentimentDistribution: result.sentimentDistribution,
      emotionAnalysis: result.emotionAnalysis,
      aspectSentiments: result.aspectSentiments,
      competitorComparison,
      insights: result.insights,
      recommendations: result.recommendations,
    };
  }

  @Post('emotion-analysis')
  @ApiOperation({
    summary: 'Emotion analizi',
    description: 'Metinlerdeki duygu durumlarını analiz eder',
  })
  @ApiResponse({ status: 201, description: 'Emotion analizi tamamlandı' })
  async analyzeEmotions(
    @CurrentUser() user: User,
    @Body() request: { texts: Array<{ id: string; text: string }> },
  ) {
    const result = await this.sentimentAnalysisService.analyzeEmotions(user.id, request.texts);
    
    return {
      results: result.map(r => ({
        id: r.id,
        text: r.text,
        primaryEmotion: r.primaryEmotion,
        emotionalIntensity: r.emotionalIntensity,
        emotions: r.emotions,
      })),
    };
  }

  @Post('aspect-sentiment')
  @ApiOperation({
    summary: 'Aspect-based sentiment analizi',
    description: 'Belirli aspectlere göre sentiment analizi yapar',
  })
  @ApiResponse({ status: 201, description: 'Aspect sentiment analizi tamamlandı' })
  async analyzeAspectSentiment(
    @CurrentUser() user: User,
    @Body() request: { 
      texts: Array<{ id: string; text: string }>; 
      aspects?: string[];
    },
  ) {
    const result = await this.sentimentAnalysisService.analyzeAspectBasedSentiment(
      user.id,
      request.texts,
      request.aspects,
    );
    
    return { aspectSentiments: result };
  }

  @Get('sentiment-monitoring/:asin')
  @ApiOperation({
    summary: 'Sentiment takibi',
    description: 'Ürün için real-time sentiment takibi yapar',
  })
  @ApiParam({ name: 'asin', description: 'Amazon ASIN', example: 'B08N5WRWNW' })
  @ApiResponse({ status: 200, description: 'Sentiment takip sonuçları' })
  async monitorSentiment(
    @CurrentUser() user: User,
    @Param('asin') asin: string,
    @Query('negativeSpike', ValidationPipe) negativeSpike: number = 10,
    @Query('overallDrop', ValidationPipe) overallDrop: number = 0.1,
    @Query('reviewCount', ValidationPipe) reviewCount: number = 5,
  ) {
    const thresholds = { negativeSpike, overallDrop, reviewCount };
    
    return this.sentimentAnalysisService.monitorSentimentChanges(user.id, asin, thresholds);
  }

  // Sales Forecasting Endpoints
  @Post('sales-forecast')
  @ApiOperation({
    summary: 'Satış tahmini',
    description: 'LSTM, Prophet veya ARIMA kullanarak satış tahmini yapar',
  })
  @ApiResponse({
    status: 201,
    description: 'Satış tahmini başarıyla tamamlandı',
    type: SalesForecastResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async forecastSales(
    @CurrentUser() user: User,
    @Body(ValidationPipe) request: SalesForecastRequestDto,
  ): Promise<SalesForecastResponseDto> {
    const input = {
      historicalSales: request.historicalSales.map(s => ({
        date: new Date(s.date),
        sales: s.sales,
        revenue: s.revenue,
        units: s.units,
        price: s.price,
      })),
      forecastPeriod: {
        startDate: new Date(request.forecastPeriod.startDate),
        endDate: new Date(request.forecastPeriod.endDate),
        type: request.forecastPeriod.type,
      },
      externalFactors: request.externalFactors ? {
        holidays: request.externalFactors.holidays,
        promotions: request.externalFactors.promotions?.map(p => ({
          startDate: new Date(p.startDate),
          endDate: new Date(p.endDate),
          discount: p.discount,
          type: p.type,
        })),
        priceChanges: request.externalFactors.priceChanges?.map(pc => ({
          date: new Date(pc.date),
          newPrice: pc.newPrice,
          oldPrice: pc.oldPrice,
        })),
      } : undefined,
      includeConfidenceIntervals: request.includeConfidenceIntervals,
      includeScenarioAnalysis: request.includeScenarioAnalysis,
    };

    let result;
    switch (request.modelType) {
      case ModelTypeDto.LSTM:
        result = await this.salesForecastingService.forecastSalesWithLSTM(user.id, request.asin, input);
        break;
      case ModelTypeDto.PROPHET:
        result = await this.salesForecastingService.forecastSalesWithProphet(user.id, request.asin, input);
        break;
      case ModelTypeDto.ARIMA:
        result = await this.salesForecastingService.forecastSalesWithARIMA(user.id, request.asin, input);
        break;
      case ModelTypeDto.ENSEMBLE:
        result = await this.salesForecastingService.forecastSalesEnsemble(user.id, request.asin, input);
        break;
      default:
        result = await this.salesForecastingService.forecastSalesWithLSTM(user.id, request.asin, input);
    }

    return {
      forecastResults: result.forecastResults.map(f => ({
        date: f.date.toISOString(),
        predicted: f.predicted,
        lowerBound: f.lowerBound,
        upperBound: f.upperBound,
        confidence: f.confidence,
        seasonalComponent: f.seasonalComponent,
        trendComponent: f.trendComponent,
      })),
      aggregateMetrics: {
        ...result.aggregateMetrics,
        peakSalesDate: result.aggregateMetrics.peakSalesDate.toISOString(),
      },
      accuracy: result.accuracy,
      seasonality: result.seasonality,
      scenarios: result.scenarios,
      insights: result.insights,
      recommendations: result.recommendations,
    };
  }

  @Post('demand-forecast')
  @ApiOperation({
    summary: 'Talep tahmini',
    description: 'Fiyat elastikiyeti ile talep tahmini yapar',
  })
  @ApiResponse({ status: 201, description: 'Talep tahmini tamamlandı' })
  async forecastDemand(
    @CurrentUser() user: User,
    @Body() request: {
      asin: string;
      historicalDemand: Array<{ date: string; demand: number; price: number }>;
      priceElasticity?: number;
      futurePrices?: Array<{ date: string; price: number }>;
    },
  ) {
    const input = {
      historicalDemand: request.historicalDemand.map(d => ({
        date: new Date(d.date),
        demand: d.demand,
        price: d.price,
      })),
      priceElasticity: request.priceElasticity,
      futurePrices: request.futurePrices?.map(fp => ({
        date: new Date(fp.date),
        price: fp.price,
      })),
    };

    const result = await this.salesForecastingService.forecastDemand(user.id, request.asin, input);

    return {
      demandForecast: result.demandForecast.map(df => ({
        ...df,
        date: df.date.toISOString(),
      })),
      priceElasticity: result.priceElasticity,
      optimalPricing: result.optimalPricing.map(op => ({
        ...op,
        date: op.date.toISOString(),
      })),
      insights: result.insights,
    };
  }

  @Post('inventory-planning')
  @ApiOperation({
    summary: 'Envanter planlama önerileri',
    description: 'Satış tahminlerine göre envanter planlama önerileri oluşturur',
  })
  @ApiResponse({
    status: 201,
    description: 'Envanter planlama önerileri oluşturuldu',
    type: InventoryPlanningResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async planInventory(
    @CurrentUser() user: User,
    @Body(ValidationPipe) request: InventoryPlanningRequestDto,
  ): Promise<InventoryPlanningResponseDto> {
    // Mock sales forecast result - in real implementation, would fetch from database
    const mockSalesForecast = {
      forecastResults: [],
      aggregateMetrics: {
        totalForecastSales: 1000,
        averageDailySales: 33.3,
        peakSalesDate: new Date(),
        peakSalesAmount: 50,
        growthRate: 5,
      },
      accuracy: {
        modelAccuracy: 85,
        confidenceLevel: 'high' as const,
        accuracyRating: 'good' as const,
      },
      insights: [],
      recommendations: [],
    };

    const result = await this.salesForecastingService.generateInventoryRecommendations(
      user.id,
      request.asin,
      mockSalesForecast,
      request.currentStock,
      request.leadTime,
      request.serviceLevel,
    );

    return {
      recommendations: result.recommendations.map(r => ({
        ...r,
        date: r.date.toISOString(),
      })),
      alerts: result.alerts.map(a => ({
        ...a,
        date: a.date.toISOString(),
      })),
      kpis: result.kpis,
    };
  }

  // Model Management Endpoints
  @Post('models/train')
  @ApiOperation({
    summary: 'Model eğitimi başlat',
    description: 'Yeni bir AI modeli eğitimi başlatır',
  })
  @ApiResponse({
    status: 201,
    description: 'Model eğitimi başlatıldı',
    type: ModelTrainingResponseDto,
  })
  @HttpCode(HttpStatus.CREATED)
  async trainModel(
    @CurrentUser() user: User,
    @Body(ValidationPipe) request: ModelTrainingRequestDto,
  ): Promise<ModelTrainingResponseDto> {
    // Mock model training start
    const trainingId = `training_${Date.now()}`;
    
    return {
      modelId: trainingId,
      status: 'training',
      estimatedCompletionTime: 15,
      trainingStartTime: new Date().toISOString(),
      progress: 0,
    };
  }

  @Get('models')
  @ApiOperation({
    summary: 'Model listesi',
    description: 'Kullanıcının tüm modellerini listeler',
  })
  @ApiResponse({ status: 200, description: 'Model listesi', type: [ModelPerformanceDto] })
  async getModels(
    @CurrentUser() user: User,
    @Query('modelType') modelType?: string,
    @Query('status') status?: string,
  ): Promise<ModelPerformanceDto[]> {
    // Mock model list
    return [
      {
        modelId: 'model_123',
        modelName: 'LSTM Sales Forecast v1',
        accuracy: 87.5,
        performanceGrade: 'A',
        reliabilityScore: 92.3,
        lastTrainedAt: new Date().toISOString(),
        needsRetraining: false,
        insights: ['Model performing excellently', 'High accuracy maintained'],
        roi: 250.5,
      },
    ];
  }

  @Get('models/:modelId')
  @ApiOperation({
    summary: 'Model detayları',
    description: 'Belirli bir modelin detaylarını getirir',
  })
  @ApiParam({ name: 'modelId', description: 'Model ID', example: 'model_123' })
  @ApiResponse({ status: 200, description: 'Model detayları', type: ModelPerformanceDto })
  async getModelDetails(
    @CurrentUser() user: User,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ): Promise<ModelPerformanceDto> {
    // Mock model details
    return {
      modelId,
      modelName: 'LSTM Sales Forecast v1',
      accuracy: 87.5,
      performanceGrade: 'A',
      reliabilityScore: 92.3,
      lastTrainedAt: new Date().toISOString(),
      needsRetraining: false,
      insights: ['Model performing excellently', 'High accuracy maintained'],
      roi: 250.5,
    };
  }

  @Put('models/:modelId/retrain')
  @ApiOperation({
    summary: 'Model yeniden eğitimi',
    description: 'Mevcut modeli yeniden eğitir',
  })
  @ApiParam({ name: 'modelId', description: 'Model ID', example: 'model_123' })
  @ApiResponse({ status: 200, description: 'Yeniden eğitim başlatıldı' })
  async retrainModel(
    @CurrentUser() user: User,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ) {
    return {
      modelId,
      status: 'retraining',
      message: 'Model retraining started',
      estimatedCompletionTime: 12,
    };
  }

  @Delete('models/:modelId')
  @ApiOperation({
    summary: 'Model silme',
    description: 'Belirli bir modeli siler',
  })
  @ApiParam({ name: 'modelId', description: 'Model ID', example: 'model_123' })
  @ApiResponse({ status: 200, description: 'Model başarıyla silindi' })
  async deleteModel(
    @CurrentUser() user: User,
    @Param('modelId', ParseUUIDPipe) modelId: string,
  ) {
    return {
      modelId,
      status: 'deleted',
      message: 'Model successfully deleted',
    };
  }

  // Data Management Endpoints
  @Post('data/upload')
  @ApiOperation({
    summary: 'Veri yükleme',
    description: 'Eğitim verisi yükler',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Veri dosyası ve metadata',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        metadata: {
          type: 'string',
          description: 'JSON formatında veri metadata',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Veri başarıyla yüklendi',
    type: DataUploadResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  async uploadData(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
    @Body('metadata') metadata: string,
  ): Promise<DataUploadResponseDto> {
    const parsedMetadata = JSON.parse(metadata) as DataUploadRequestDto;
    
    // Mock upload processing
    return {
      uploadId: `upload_${Date.now()}`,
      status: 'processing',
      fileSize: file.size,
      recordCount: 1500,
      featureCount: 8,
      dataQualityScore: 92.5,
      processingTime: 2500,
    };
  }

  @Get('data')
  @ApiOperation({
    summary: 'Veri setleri listesi',
    description: 'Kullanıcının veri setlerini listeler',
  })
  @ApiResponse({ status: 200, description: 'Veri setleri listesi' })
  async getDatasets(
    @CurrentUser() user: User,
    @Query('dataType') dataType?: string,
    @Query('status') status?: string,
  ) {
    // Mock datasets list
    return [
      {
        id: 'dataset_123',
        name: 'Sales Data Q4 2023',
        dataType: 'time_series',
        recordCount: 1500,
        fileSize: 1048576,
        quality: 92.5,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      },
    ];
  }

  @Get('data/:datasetId')
  @ApiOperation({
    summary: 'Veri seti detayları',
    description: 'Belirli bir veri setinin detaylarını getirir',
  })
  @ApiParam({ name: 'datasetId', description: 'Dataset ID', example: 'dataset_123' })
  @ApiResponse({ status: 200, description: 'Veri seti detayları' })
  async getDatasetDetails(
    @CurrentUser() user: User,
    @Param('datasetId', ParseUUIDPipe) datasetId: string,
  ) {
    // Mock dataset details
    return {
      id: datasetId,
      name: 'Sales Data Q4 2023',
      description: 'Q4 2023 sales data for all products',
      dataType: 'time_series',
      recordCount: 1500,
      featureCount: 8,
      fileSize: 1048576,
      quality: 92.5,
      schema: {
        features: [
          { name: 'date', type: 'datetime', required: true },
          { name: 'sales', type: 'numeric', required: true },
          { name: 'price', type: 'numeric', required: true },
        ],
      },
      statistics: {
        numerical: [
          {
            feature: 'sales',
            mean: 25.5,
            std: 8.2,
            min: 5,
            max: 75,
          },
        ],
      },
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };
  }

  @Delete('data/:datasetId')
  @ApiOperation({
    summary: 'Veri seti silme',
    description: 'Belirli bir veri setini siler',
  })
  @ApiParam({ name: 'datasetId', description: 'Dataset ID', example: 'dataset_123' })
  @ApiResponse({ status: 200, description: 'Veri seti başarıyla silindi' })
  async deleteDataset(
    @CurrentUser() user: User,
    @Param('datasetId', ParseUUIDPipe) datasetId: string,
  ) {
    return {
      datasetId,
      status: 'deleted',
      message: 'Dataset successfully deleted',
    };
  }

  // System Health and Monitoring
  @Get('health')
  @ApiOperation({
    summary: 'AI sistem durumu',
    description: 'AI sisteminin genel sağlık durumunu kontrol eder',
  })
  @ApiResponse({
    status: 200,
    description: 'Sistem durumu',
    type: AIHealthCheckResponseDto,
  })
  async getSystemHealth(): Promise<AIHealthCheckResponseDto> {
    return {
      status: 'healthy',
      activeModels: {
        total: 15,
        healthy: 13,
        training: 1,
        failed: 1,
      },
      systemMetrics: {
        cpuUsage: 65.2,
        memoryUsage: 78.5,
        diskUsage: 42.1,
        responseTime: 150,
      },
      recentActivity: [
        {
          timestamp: new Date().toISOString(),
          activity: 'Model training completed',
          status: 'success',
        },
        {
          timestamp: new Date(Date.now() - 300000).toISOString(),
          activity: 'Sentiment analysis request',
          status: 'success',
        },
      ],
      alerts: [
        {
          severity: 'medium',
          message: 'Model accuracy below threshold for LSTM_v1',
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  @Get('analytics/usage')
  @ApiOperation({
    summary: 'Kullanım analitikleri',
    description: 'AI modülü kullanım istatistiklerini getirir',
  })
  @ApiResponse({ status: 200, description: 'Kullanım analitikleri' })
  async getUsageAnalytics(
    @CurrentUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Mock usage analytics
    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      totalRequests: 1245,
      requestsByType: {
        trendPrediction: 456,
        sentimentAnalysis: 378,
        salesForecasting: 289,
        anomalyDetection: 122,
      },
      averageResponseTime: 1.25,
      successRate: 98.7,
      modelsUsed: {
        LSTM: 445,
        Prophet: 234,
        DistilBERT: 289,
        RoBERTa: 89,
        Ensemble: 188,
      },
      dailyUsage: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString(),
        requests: Math.floor(Math.random() * 50) + 20,
        responseTime: Math.random() * 2 + 0.5,
      })),
    };
  }
}