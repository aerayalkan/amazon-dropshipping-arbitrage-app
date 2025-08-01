import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';

import { 
  SalesForecast, 
  ForecastType, 
  ForecastMethod, 
  ForecastAccuracy,
  SeasonalityType 
} from '../entities/sales-forecast.entity';
import { PredictionModel, ModelType } from '../entities/prediction-model.entity';
import { TrendAnalysis } from '../entities/trend-analysis.entity';

export interface SalesForecastInput {
  historicalSales: Array<{
    date: Date;
    sales: number;
    revenue?: number;
    units?: number;
    price?: number;
  }>;
  forecastPeriod: {
    startDate: Date;
    endDate: Date;
    type: ForecastType;
  };
  externalFactors?: {
    holidays?: string[];
    promotions?: Array<{
      startDate: Date;
      endDate: Date;
      discount: number;
      type: string;
    }>;
    priceChanges?: Array<{
      date: Date;
      newPrice: number;
      oldPrice: number;
    }>;
    marketConditions?: {
      competition: 'low' | 'medium' | 'high';
      demand: 'low' | 'medium' | 'high';
      seasonality: number;
    };
  };
  includeConfidenceIntervals?: boolean;
  includeScenarioAnalysis?: boolean;
}

export interface SalesForecastResult {
  forecastResults: Array<{
    date: Date;
    predicted: number;
    lowerBound: number;
    upperBound: number;
    confidence: number;
    seasonalComponent?: number;
    trendComponent?: number;
  }>;
  aggregateMetrics: {
    totalForecastSales: number;
    averageDailySales: number;
    peakSalesDate: Date;
    peakSalesAmount: number;
    growthRate: number;
  };
  accuracy: {
    modelAccuracy: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    accuracyRating: ForecastAccuracy;
  };
  seasonality?: {
    hasSeasonality: boolean;
    seasonalityType: SeasonalityType;
    seasonalStrength: number;
    seasonalPeaks: Array<{
      period: string;
      multiplier: number;
    }>;
  };
  scenarios?: {
    optimistic: { totalSales: number; probability: number };
    pessimistic: { totalSales: number; probability: number };
    realistic: { totalSales: number; probability: number };
  };
  insights: string[];
  recommendations: string[];
}

@Injectable()
export class SalesForecastingService {
  private readonly logger = new Logger(SalesForecastingService.name);

  constructor(
    @InjectRepository(SalesForecast)
    private readonly salesForecastRepository: Repository<SalesForecast>,
    @InjectRepository(PredictionModel)
    private readonly predictionModelRepository: Repository<PredictionModel>,
    @InjectRepository(TrendAnalysis)
    private readonly trendAnalysisRepository: Repository<TrendAnalysis>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * LSTM ile sales forecasting
   */
  async forecastSalesWithLSTM(
    userId: string,
    asin: string,
    input: SalesForecastInput
  ): Promise<SalesForecastResult> {
    this.logger.log(`Starting LSTM sales forecasting for ASIN ${asin}`);

    try {
      // Veriyi hazırla
      const processedData = await this.prepareTimeSeriesData(input.historicalSales);
      
      // LSTM modeli eğit veya mevcut modeli kullan
      const model = await this.getOrTrainLSTMSalesModel(userId, asin, processedData);
      
      // Forecast yap
      const predictions = await this.runLSTMForecast(model, processedData, input);
      
      // Sonuçları analiz et
      const result = await this.analyzeForecastResults(predictions, input, ForecastMethod.LSTM);
      
      // Kaydet
      await this.saveSalesForecast(userId, asin, input, result, model);
      
      return result;

    } catch (error) {
      this.logger.error(`LSTM sales forecasting failed: ${error.message}`);
      throw new Error(`LSTM sales forecasting failed: ${error.message}`);
    }
  }

  /**
   * Prophet ile sales forecasting
   */
  async forecastSalesWithProphet(
    userId: string,
    asin: string,
    input: SalesForecastInput
  ): Promise<SalesForecastResult> {
    this.logger.log(`Starting Prophet sales forecasting for ASIN ${asin}`);

    try {
      // Prophet formatına dönüştür
      const prophetData = this.prepareProphetData(input.historicalSales);
      
      // Seasonal decomposition
      const seasonalityAnalysis = await this.analyzeSeasonality(input.historicalSales);
      
      // Prophet model konfigürasyonu
      const prophetConfig = this.buildProphetConfig(seasonalityAnalysis, input.externalFactors);
      
      // Prophet modeli eğit
      const model = await this.trainProphetSalesModel(prophetData, prophetConfig);
      
      // Forecast yap
      const predictions = await this.runProphetForecast(model, input);
      
      // Sonuçları analiz et
      const result = await this.analyzeForecastResults(predictions, input, ForecastMethod.PROPHET);
      
      // Seasonality bilgisini ekle
      result.seasonality = seasonalityAnalysis;
      
      // Kaydet
      await this.saveSalesForecast(userId, asin, input, result, model);
      
      return result;

    } catch (error) {
      this.logger.error(`Prophet sales forecasting failed: ${error.message}`);
      throw new Error(`Prophet sales forecasting failed: ${error.message}`);
    }
  }

  /**
   * ARIMA ile sales forecasting
   */
  async forecastSalesWithARIMA(
    userId: string,
    asin: string,
    input: SalesForecastInput
  ): Promise<SalesForecastResult> {
    this.logger.log(`Starting ARIMA sales forecasting for ASIN ${asin}`);

    try {
      // Stationarity kontrolü
      const stationarityTest = await this.testStationarity(input.historicalSales);
      
      // ARIMA parametrelerini otomatik belirle
      const arimaParams = await this.autoARIMA(input.historicalSales, stationarityTest);
      
      // ARIMA modeli eğit
      const model = await this.trainARIMAModel(input.historicalSales, arimaParams);
      
      // Forecast yap
      const predictions = await this.runARIMAForecast(model, input);
      
      // Sonuçları analiz et
      const result = await this.analyzeForecastResults(predictions, input, ForecastMethod.ARIMA);
      
      // Kaydet
      await this.saveSalesForecast(userId, asin, input, result, model);
      
      return result;

    } catch (error) {
      this.logger.error(`ARIMA sales forecasting failed: ${error.message}`);
      throw new Error(`ARIMA sales forecasting failed: ${error.message}`);
    }
  }

  /**
   * Ensemble forecasting (birden fazla modeli birleştir)
   */
  async forecastSalesEnsemble(
    userId: string,
    asin: string,
    input: SalesForecastInput,
    models: ForecastMethod[] = [ForecastMethod.LSTM, ForecastMethod.PROPHET, ForecastMethod.ARIMA]
  ): Promise<SalesForecastResult> {
    this.logger.log(`Starting ensemble sales forecasting for ASIN ${asin}`);

    try {
      const modelResults: { [key: string]: SalesForecastResult } = {};
      const weights: { [key: string]: number } = {};
      
      // Her modeli paralel olarak çalıştır
      const promises = models.map(async (method) => {
        try {
          let result: SalesForecastResult;
          
          switch (method) {
            case ForecastMethod.LSTM:
              result = await this.forecastSalesWithLSTM(userId, asin, input);
              break;
            case ForecastMethod.PROPHET:
              result = await this.forecastSalesWithProphet(userId, asin, input);
              break;
            case ForecastMethod.ARIMA:
              result = await this.forecastSalesWithARIMA(userId, asin, input);
              break;
            default:
              throw new Error(`Unsupported forecast method: ${method}`);
          }
          
          modelResults[method] = result;
          weights[method] = this.calculateModelWeight(result.accuracy.modelAccuracy);
          
        } catch (error) {
          this.logger.warn(`Model ${method} failed in ensemble: ${error.message}`);
          weights[method] = 0;
        }
      });
      
      await Promise.all(promises);
      
      // Ensemble sonucu oluştur
      const ensembleResult = this.combineEnsembleForecasts(modelResults, weights);
      
      // Kaydet
      await this.saveSalesForecast(userId, asin, input, ensembleResult, null);
      
      return ensembleResult;

    } catch (error) {
      this.logger.error(`Ensemble sales forecasting failed: ${error.message}`);
      throw new Error(`Ensemble sales forecasting failed: ${error.message}`);
    }
  }

  /**
   * Demand forecasting (talep tahmini)
   */
  async forecastDemand(
    userId: string,
    asin: string,
    input: {
      historicalDemand: Array<{ date: Date; demand: number; price: number }>;
      priceElasticity?: number;
      futurePrices?: Array<{ date: Date; price: number }>;
      marketFactors?: any;
    }
  ): Promise<{
    demandForecast: Array<{
      date: Date;
      expectedDemand: number;
      price: number;
      priceImpact: number;
      confidence: number;
    }>;
    priceElasticity: number;
    optimalPricing: Array<{
      date: Date;
      optimalPrice: number;
      expectedRevenue: number;
      expectedProfit: number;
    }>;
    insights: string[];
  }> {
    this.logger.log(`Forecasting demand for ASIN ${asin}`);

    try {
      // Price elasticity hesapla
      const elasticity = input.priceElasticity || await this.calculatePriceElasticity(input.historicalDemand);
      
      // Demand forecast modeli oluştur
      const demandModel = await this.buildDemandModel(input.historicalDemand, elasticity);
      
      // Future demand tahmin et
      const demandForecast = await this.predictDemand(demandModel, input.futurePrices, input.marketFactors);
      
      // Optimal pricing hesapla
      const optimalPricing = await this.calculateOptimalPricing(demandForecast, elasticity);
      
      // Insights oluştur
      const insights = this.generateDemandInsights(demandForecast, elasticity);
      
      return {
        demandForecast,
        priceElasticity: elasticity,
        optimalPricing,
        insights,
      };

    } catch (error) {
      this.logger.error(`Demand forecasting failed: ${error.message}`);
      throw new Error(`Demand forecasting failed: ${error.message}`);
    }
  }

  /**
   * Inventory planning recommendations
   */
  async generateInventoryRecommendations(
    userId: string,
    asin: string,
    salesForecast: SalesForecastResult,
    currentStock: number,
    leadTime: number, // days
    serviceLevel: number = 0.95 // 95% service level
  ): Promise<{
    recommendations: Array<{
      date: Date;
      recommendedStock: number;
      safetyStock: number;
      reorderPoint: number;
      orderQuantity?: number;
      rationale: string;
    }>;
    alerts: Array<{
      type: 'stockout_risk' | 'overstock_risk' | 'reorder_needed';
      severity: 'low' | 'medium' | 'high' | 'critical';
      date: Date;
      message: string;
      action: string;
    }>;
    kpis: {
      forecastAccuracy: number;
      expectedTurnover: number;
      stockoutRisk: number;
      totalInvestmentRequired: number;
    };
  }> {
    this.logger.log(`Generating inventory recommendations for ASIN ${asin}`);

    try {
      const recommendations = [];
      const alerts = [];
      
      // Safety stock hesapla
      const demandVariability = this.calculateDemandVariability(salesForecast.forecastResults);
      const safetyStock = this.calculateSafetyStock(demandVariability, leadTime, serviceLevel);
      
      let currentStockLevel = currentStock;
      
      for (const forecast of salesForecast.forecastResults) {
        // Günlük talep düş
        currentStockLevel -= forecast.predicted;
        
        // Reorder point hesapla
        const reorderPoint = (forecast.predicted * leadTime) + safetyStock;
        
        // Önerilen stok seviyesi
        const recommendedStock = Math.max(
          reorderPoint,
          forecast.predicted * 30 // 30 günlük stok
        );
        
        // Sipariş miktarı hesapla
        let orderQuantity = 0;
        if (currentStockLevel <= reorderPoint) {
          orderQuantity = recommendedStock - currentStockLevel;
        }
        
        recommendations.push({
          date: forecast.date,
          recommendedStock,
          safetyStock,
          reorderPoint,
          orderQuantity: orderQuantity > 0 ? orderQuantity : undefined,
          rationale: this.generateStockRationale(currentStockLevel, reorderPoint, forecast),
        });
        
        // Stockout riski kontrol et
        if (currentStockLevel <= 0) {
          alerts.push({
            type: 'stockout_risk',
            severity: 'critical',
            date: forecast.date,
            message: `Stockout predicted on ${forecast.date.toDateString()}`,
            action: `Order ${recommendedStock} units immediately`,
          });
        } else if (currentStockLevel <= reorderPoint) {
          alerts.push({
            type: 'reorder_needed',
            severity: 'high',
            date: forecast.date,
            message: `Reorder point reached`,
            action: `Order ${orderQuantity} units`,
          });
        }
        
        // Sipariş varsa stok güncelle
        if (orderQuantity > 0) {
          currentStockLevel += orderQuantity;
        }
      }
      
      // KPI'ları hesapla
      const kpis = {
        forecastAccuracy: salesForecast.accuracy.modelAccuracy,
        expectedTurnover: this.calculateInventoryTurnover(salesForecast, recommendations),
        stockoutRisk: alerts.filter(a => a.type === 'stockout_risk').length / recommendations.length * 100,
        totalInvestmentRequired: recommendations.reduce((sum, r) => sum + (r.orderQuantity || 0), 0),
      };
      
      return {
        recommendations,
        alerts,
        kpis,
      };

    } catch (error) {
      this.logger.error(`Inventory recommendations failed: ${error.message}`);
      throw new Error(`Inventory recommendations failed: ${error.message}`);
    }
  }

  // Private helper methods
  private async prepareTimeSeriesData(salesData: Array<any>): Promise<any> {
    // Veriyi zaman serisine dönüştür
    const sorted = salesData.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Missing dates için interpolation
    const filledData = this.fillMissingDates(sorted);
    
    // Normalization
    const normalized = this.normalizeTimeSeries(filledData);
    
    return normalized;
  }

  private fillMissingDates(data: Array<any>): Array<any> {
    if (data.length <= 1) return data;
    
    const result = [];
    const start = new Date(data[0].date);
    const end = new Date(data[data.length - 1].date);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const existing = data.find(d => d.date.toDateString() === date.toDateString());
      
      if (existing) {
        result.push(existing);
      } else {
        // Linear interpolation
        const before = data.filter(d => d.date < date).pop();
        const after = data.find(d => d.date > date);
        
        let interpolatedSales = 0;
        if (before && after) {
          const ratio = (date.getTime() - before.date.getTime()) / 
                       (after.date.getTime() - before.date.getTime());
          interpolatedSales = before.sales + (after.sales - before.sales) * ratio;
        } else if (before) {
          interpolatedSales = before.sales;
        } else if (after) {
          interpolatedSales = after.sales;
        }
        
        result.push({
          date: new Date(date),
          sales: interpolatedSales,
          interpolated: true,
        });
      }
    }
    
    return result;
  }

  private normalizeTimeSeries(data: Array<any>): any {
    const sales = data.map(d => d.sales);
    const min = Math.min(...sales);
    const max = Math.max(...sales);
    const range = max - min;
    
    return {
      data: data.map(d => ({
        ...d,
        normalizedSales: range > 0 ? (d.sales - min) / range : 0,
      })),
      stats: { min, max, range },
    };
  }

  private async getOrTrainLSTMSalesModel(
    userId: string,
    asin: string,
    data: any
  ): Promise<PredictionModel> {
    // Mevcut modeli kontrol et
    let model = await this.predictionModelRepository.findOne({
      where: {
        userId,
        modelType: ModelType.LSTM,
        predictionType: 'sales_forecast' as any,
      },
    });

    if (!model || model.needsRetraining()) {
      model = await this.trainLSTMSalesModel(userId, asin, data);
    }

    return model;
  }

  private async trainLSTMSalesModel(
    userId: string,
    asin: string,
    data: any
  ): Promise<PredictionModel> {
    this.logger.log('Training LSTM sales forecasting model');

    // Mock training
    await new Promise(resolve => setTimeout(resolve, 1000));

    const model = this.predictionModelRepository.create({
      userId,
      modelName: `LSTM Sales Forecast - ${asin}`,
      modelType: ModelType.LSTM,
      predictionType: 'sales_forecast' as any,
      accuracy: 0.85 + Math.random() * 0.1,
      lastTrainedAt: new Date(),
      framework: 'tensorflow',
      modelConfig: {
        hyperparameters: {
          learningRate: 0.001,
          epochs: 100,
          batchSize: 32,
          hiddenLayers: [50, 25],
        },
        features: {
          inputFeatures: ['sales', 'date', 'day_of_week', 'month'],
          targetVariable: 'sales',
          timeSeriesLength: 30,
        },
        validation: {
          trainSplit: 0.8,
          validationSplit: 0.1,
          testSplit: 0.1,
        },
      },
    });

    return this.predictionModelRepository.save(model);
  }

  private async runLSTMForecast(
    model: PredictionModel,
    data: any,
    input: SalesForecastInput
  ): Promise<Array<any>> {
    // Mock LSTM forecasting
    const predictions = [];
    const lastSales = data.data[data.data.length - 1].sales;
    
    const forecastDays = Math.ceil(
      (input.forecastPeriod.endDate.getTime() - input.forecastPeriod.startDate.getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    for (let i = 1; i <= forecastDays; i++) {
      const futureDate = new Date(input.forecastPeriod.startDate);
      futureDate.setDate(futureDate.getDate() + i - 1);
      
      // Seasonal effect simulation
      const dayOfYear = Math.floor((futureDate.getTime() - new Date(futureDate.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
      const seasonalEffect = 1 + 0.2 * Math.sin(2 * Math.PI * dayOfYear / 365);
      
      // Trend and noise
      const trend = 1 + (0.001 * i);
      const noise = 1 + (Math.random() - 0.5) * 0.1;
      
      const predicted = lastSales * trend * seasonalEffect * noise;
      
      predictions.push({
        date: new Date(futureDate),
        predicted: Math.max(0, predicted),
        confidence: Math.max(0.5, 0.9 - (i * 0.01)),
        trendComponent: lastSales * trend,
        seasonalComponent: lastSales * seasonalEffect,
      });
    }
    
    return predictions;
  }

  private prepareProphetData(salesData: Array<any>): any {
    return salesData.map(item => ({
      ds: item.date.toISOString().split('T')[0],
      y: item.sales,
    }));
  }

  private async analyzeSeasonality(salesData: Array<any>): Promise<any> {
    // Mock seasonality analysis
    return {
      hasSeasonality: salesData.length > 30,
      seasonalityType: SeasonalityType.WEEKLY,
      seasonalStrength: 0.3,
      seasonalPeaks: [
        { period: 'Monday', multiplier: 1.2 },
        { period: 'Friday', multiplier: 1.1 },
      ],
    };
  }

  private buildProphetConfig(seasonality: any, externalFactors?: any): any {
    return {
      growth: 'linear',
      yearly_seasonality: seasonality.hasSeasonality,
      weekly_seasonality: true,
      daily_seasonality: false,
      seasonality_mode: 'multiplicative',
      holidays: externalFactors?.holidays || [],
    };
  }

  private async trainProphetSalesModel(data: any, config: any): Promise<any> {
    // Mock Prophet training
    await new Promise(resolve => setTimeout(resolve, 800));
    return { config, trained: true };
  }

  private async runProphetForecast(model: any, input: SalesForecastInput): Promise<Array<any>> {
    // Mock Prophet forecasting
    const predictions = [];
    const forecastDays = Math.ceil(
      (input.forecastPeriod.endDate.getTime() - input.forecastPeriod.startDate.getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    for (let i = 0; i < forecastDays; i++) {
      const futureDate = new Date(input.forecastPeriod.startDate);
      futureDate.setDate(futureDate.getDate() + i);
      
      const baseSales = 100;
      const trend = baseSales + (i * 0.5);
      const seasonal = 10 * Math.sin(2 * Math.PI * i / 7); // Weekly seasonality
      const predicted = trend + seasonal + (Math.random() - 0.5) * 5;
      
      predictions.push({
        date: futureDate,
        predicted: Math.max(0, predicted),
        lowerBound: predicted * 0.8,
        upperBound: predicted * 1.2,
        confidence: 0.85,
        trendComponent: trend,
        seasonalComponent: seasonal,
      });
    }
    
    return predictions;
  }

  private async testStationarity(data: Array<any>): Promise<any> {
    // Mock stationarity test (Augmented Dickey-Fuller)
    return {
      isStationary: Math.random() > 0.5,
      adfStatistic: -3.5,
      pValue: 0.03,
      differencing: 1,
    };
  }

  private async autoARIMA(data: Array<any>, stationarity: any): Promise<any> {
    // Mock auto ARIMA parameter selection
    return {
      p: 2, // AR order
      d: stationarity.isStationary ? 0 : 1, // Differencing
      q: 1, // MA order
      seasonal: {
        P: 1,
        D: 1,
        Q: 1,
        s: 7, // Weekly seasonality
      },
    };
  }

  private async trainARIMAModel(data: Array<any>, params: any): Promise<any> {
    // Mock ARIMA training
    await new Promise(resolve => setTimeout(resolve, 600));
    return { params, trained: true };
  }

  private async runARIMAForecast(model: any, input: SalesForecastInput): Promise<Array<any>> {
    // Mock ARIMA forecasting
    const predictions = [];
    const forecastDays = Math.ceil(
      (input.forecastPeriod.endDate.getTime() - input.forecastPeriod.startDate.getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    
    let lastValue = 100; // Mock last sales value
    
    for (let i = 0; i < forecastDays; i++) {
      const futureDate = new Date(input.forecastPeriod.startDate);
      futureDate.setDate(futureDate.getDate() + i);
      
      // ARIMA prediction simulation
      const predicted = lastValue + (Math.random() - 0.5) * 10;
      lastValue = predicted;
      
      predictions.push({
        date: futureDate,
        predicted: Math.max(0, predicted),
        lowerBound: predicted * 0.85,
        upperBound: predicted * 1.15,
        confidence: 0.80,
      });
    }
    
    return predictions;
  }

  private async analyzeForecastResults(
    predictions: Array<any>,
    input: SalesForecastInput,
    method: ForecastMethod
  ): Promise<SalesForecastResult> {
    // Aggregate metrics hesapla
    const totalSales = predictions.reduce((sum, p) => sum + p.predicted, 0);
    const avgDailySales = totalSales / predictions.length;
    
    const peakSales = predictions.reduce((max, current) => 
      current.predicted > max.predicted ? current : max
    );
    
    // Growth rate hesapla
    const firstWeek = predictions.slice(0, 7).reduce((sum, p) => sum + p.predicted, 0) / 7;
    const lastWeek = predictions.slice(-7).reduce((sum, p) => sum + p.predicted, 0) / 7;
    const growthRate = ((lastWeek - firstWeek) / firstWeek) * 100;
    
    // Accuracy assessment
    const modelAccuracy = 85 + Math.random() * 10; // Mock accuracy
    
    const result: SalesForecastResult = {
      forecastResults: predictions.map(p => ({
        date: p.date,
        predicted: p.predicted,
        lowerBound: p.lowerBound || p.predicted * 0.9,
        upperBound: p.upperBound || p.predicted * 1.1,
        confidence: (p.confidence || 0.8) * 100,
        seasonalComponent: p.seasonalComponent,
        trendComponent: p.trendComponent,
      })),
      aggregateMetrics: {
        totalForecastSales: totalSales,
        averageDailySales: avgDailySales,
        peakSalesDate: peakSales.date,
        peakSalesAmount: peakSales.predicted,
        growthRate,
      },
      accuracy: {
        modelAccuracy,
        confidenceLevel: modelAccuracy > 85 ? 'high' : modelAccuracy > 70 ? 'medium' : 'low',
        accuracyRating: this.getAccuracyRating(modelAccuracy),
      },
      insights: this.generateForecastInsights(predictions, growthRate, method),
      recommendations: this.generateForecastRecommendations(predictions, growthRate),
    };

    // Scenario analysis ekle
    if (input.includeScenarioAnalysis) {
      result.scenarios = this.generateScenarios(totalSales);
    }

    return result;
  }

  private getAccuracyRating(accuracy: number): ForecastAccuracy {
    if (accuracy >= 95) return ForecastAccuracy.EXCELLENT;
    if (accuracy >= 85) return ForecastAccuracy.GOOD;
    if (accuracy >= 70) return ForecastAccuracy.FAIR;
    if (accuracy >= 50) return ForecastAccuracy.POOR;
    return ForecastAccuracy.UNRELIABLE;
  }

  private calculateModelWeight(accuracy: number): number {
    // Accuracy'e göre model ağırlığı
    return Math.max(0, (accuracy - 50) / 50); // 50-100% accuracy -> 0-1 weight
  }

  private combineEnsembleForecasts(
    modelResults: { [key: string]: SalesForecastResult },
    weights: { [key: string]: number }
  ): SalesForecastResult {
    const models = Object.keys(modelResults).filter(model => weights[model] > 0);
    
    if (models.length === 0) {
      throw new Error('No successful models in ensemble');
    }
    
    const totalWeight = models.reduce((sum, model) => sum + weights[model], 0);
    
    // Weighted average forecast
    const sampleModel = modelResults[models[0]];
    const combinedForecast = sampleModel.forecastResults.map((_, index) => {
      let weightedSum = 0;
      let weightedLowerBound = 0;
      let weightedUpperBound = 0;
      let weightedConfidence = 0;
      
      models.forEach(model => {
        const weight = weights[model] / totalWeight;
        const prediction = modelResults[model].forecastResults[index];
        
        weightedSum += prediction.predicted * weight;
        weightedLowerBound += prediction.lowerBound * weight;
        weightedUpperBound += prediction.upperBound * weight;
        weightedConfidence += prediction.confidence * weight;
      });
      
      return {
        date: sampleModel.forecastResults[index].date,
        predicted: weightedSum,
        lowerBound: weightedLowerBound,
        upperBound: weightedUpperBound,
        confidence: weightedConfidence,
      };
    });
    
    // Aggregate metrics
    const totalSales = combinedForecast.reduce((sum, f) => sum + f.predicted, 0);
    const avgAccuracy = models.reduce((sum, model) => 
      sum + modelResults[model].accuracy.modelAccuracy * (weights[model] / totalWeight), 0);
    
    return {
      forecastResults: combinedForecast,
      aggregateMetrics: {
        totalForecastSales: totalSales,
        averageDailySales: totalSales / combinedForecast.length,
        peakSalesDate: combinedForecast.reduce((max, current) => 
          current.predicted > max.predicted ? current : max).date,
        peakSalesAmount: Math.max(...combinedForecast.map(f => f.predicted)),
        growthRate: 0, // Would calculate
      },
      accuracy: {
        modelAccuracy: avgAccuracy,
        confidenceLevel: avgAccuracy > 85 ? 'high' : avgAccuracy > 70 ? 'medium' : 'low',
        accuracyRating: this.getAccuracyRating(avgAccuracy),
      },
      insights: [`Ensemble of ${models.length} models with ${avgAccuracy.toFixed(1)}% accuracy`],
      recommendations: ['Monitor ensemble performance and retrain individual models as needed'],
    };
  }

  private async calculatePriceElasticity(
    demandData: Array<{ date: Date; demand: number; price: number }>
  ): Promise<number> {
    // Simple price elasticity calculation
    const priceChanges = [];
    const demandChanges = [];
    
    for (let i = 1; i < demandData.length; i++) {
      const priceChange = (demandData[i].price - demandData[i-1].price) / demandData[i-1].price;
      const demandChange = (demandData[i].demand - demandData[i-1].demand) / demandData[i-1].demand;
      
      if (Math.abs(priceChange) > 0.01) { // Only significant price changes
        priceChanges.push(priceChange);
        demandChanges.push(demandChange);
      }
    }
    
    if (priceChanges.length === 0) return -1.5; // Default elasticity
    
    // Calculate elasticity as demand change / price change
    const elasticity = demandChanges.reduce((sum, d, i) => 
      sum + (d / priceChanges[i]), 0) / demandChanges.length;
    
    return elasticity;
  }

  private generateForecastInsights(
    predictions: Array<any>,
    growthRate: number,
    method: ForecastMethod
  ): string[] {
    const insights = [];
    
    insights.push(`Forecast generated using ${method} model`);
    
    if (growthRate > 10) {
      insights.push(`Strong growth trend identified (${growthRate.toFixed(1)}%)`);
    } else if (growthRate < -10) {
      insights.push(`Declining trend detected (${growthRate.toFixed(1)}%)`);
    } else {
      insights.push('Stable sales pattern expected');
    }
    
    const avgConfidence = predictions.reduce((sum, p) => sum + (p.confidence || 80), 0) / predictions.length;
    insights.push(`Average prediction confidence: ${avgConfidence.toFixed(1)}%`);
    
    return insights;
  }

  private generateForecastRecommendations(
    predictions: Array<any>,
    growthRate: number
  ): string[] {
    const recommendations = [];
    
    if (growthRate > 15) {
      recommendations.push('Prepare for increased demand - consider inventory expansion');
      recommendations.push('Evaluate pricing strategy for growth opportunities');
    } else if (growthRate < -15) {
      recommendations.push('Investigate declining trend causes');
      recommendations.push('Consider promotional activities to boost sales');
    }
    
    const volatility = this.calculatePredictionVolatility(predictions);
    if (volatility > 0.3) {
      recommendations.push('High volatility detected - implement flexible inventory strategy');
    }
    
    return recommendations;
  }

  private calculatePredictionVolatility(predictions: Array<any>): number {
    const values = predictions.map(p => p.predicted);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance) / mean;
  }

  private generateScenarios(baselineSales: number): any {
    return {
      optimistic: {
        totalSales: baselineSales * 1.2,
        probability: 0.25,
      },
      pessimistic: {
        totalSales: baselineSales * 0.8,
        probability: 0.25,
      },
      realistic: {
        totalSales: baselineSales,
        probability: 0.5,
      },
    };
  }

  private async saveSalesForecast(
    userId: string,
    asin: string,
    input: SalesForecastInput,
    result: SalesForecastResult,
    model: PredictionModel | null
  ): Promise<SalesForecast> {
    const forecast = this.salesForecastRepository.create({
      userId,
      asin,
      forecastType: input.forecastPeriod.type,
      forecastMethod: model ? model.modelType as any : ForecastMethod.ENSEMBLE,
      forecastDate: new Date(),
      forecastPeriodStart: input.forecastPeriod.startDate,
      forecastPeriodEnd: input.forecastPeriod.endDate,
      trainingPeriodStart: input.historicalSales[0]?.date || new Date(),
      trainingPeriodEnd: input.historicalSales[input.historicalSales.length - 1]?.date || new Date(),
      historicalData: {
        totalSales: input.historicalSales.reduce((sum, s) => sum + s.sales, 0),
        averageDailySales: input.historicalSales.reduce((sum, s) => sum + s.sales, 0) / input.historicalSales.length,
        salesTrend: result.aggregateMetrics.growthRate > 5 ? 'increasing' : 
                   result.aggregateMetrics.growthRate < -5 ? 'decreasing' : 'stable',
        dataPoints: input.historicalSales.length,
        dataQuality: 90,
        missingDataPercentage: 0,
        outliers: 0,
      },
      forecastResults: result.forecastResults,
      totalForecastSales: result.aggregateMetrics.totalForecastSales,
      averageDailyForecast: result.aggregateMetrics.averageDailySales,
      peakSalesDate: result.aggregateMetrics.peakSalesDate,
      peakSalesAmount: result.aggregateMetrics.peakSalesAmount,
      accuracyPercentage: result.accuracy.modelAccuracy,
      accuracyRating: result.accuracy.accuracyRating,
      modelConfidence: result.accuracy.modelAccuracy,
      modelId: model?.id,
    });

    return this.salesForecastRepository.save(forecast);
  }

  // Additional utility methods
  private calculateDemandVariability(forecastResults: Array<any>): number {
    const values = forecastResults.map(f => f.predicted);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateSafetyStock(
    demandVariability: number,
    leadTime: number,
    serviceLevel: number
  ): number {
    // Z-score for service level (95% = 1.645, 99% = 2.33)
    const zScore = serviceLevel >= 0.99 ? 2.33 : serviceLevel >= 0.95 ? 1.645 : 1.28;
    return zScore * demandVariability * Math.sqrt(leadTime);
  }

  private generateStockRationale(
    currentStock: number,
    reorderPoint: number,
    forecast: any
  ): string {
    if (currentStock <= 0) {
      return 'Critical stockout situation - immediate reorder required';
    } else if (currentStock <= reorderPoint) {
      return 'Stock level below reorder point - replenishment needed';
    } else {
      return 'Stock level adequate for forecasted demand';
    }
  }

  private calculateInventoryTurnover(
    salesForecast: SalesForecastResult,
    recommendations: Array<any>
  ): number {
    const totalSales = salesForecast.aggregateMetrics.totalForecastSales;
    const avgInventory = recommendations.reduce((sum, r) => sum + r.recommendedStock, 0) / recommendations.length;
    return avgInventory > 0 ? totalSales / avgInventory : 0;
  }

  // Additional demand modeling methods
  private async buildDemandModel(
    historicalDemand: Array<{ date: Date; demand: number; price: number }>,
    elasticity: number
  ): Promise<any> {
    // Mock demand model
    return {
      elasticity,
      baselineDemand: historicalDemand.reduce((sum, d) => sum + d.demand, 0) / historicalDemand.length,
      priceCoefficient: elasticity,
    };
  }

  private async predictDemand(
    model: any,
    futurePrices: Array<{ date: Date; price: number }> | undefined,
    marketFactors?: any
  ): Promise<Array<any>> {
    // Mock demand prediction
    return (futurePrices || []).map(pricePoint => ({
      date: pricePoint.date,
      expectedDemand: model.baselineDemand * Math.pow(pricePoint.price / 100, model.elasticity),
      price: pricePoint.price,
      priceImpact: (pricePoint.price - 100) * model.elasticity,
      confidence: 85,
    }));
  }

  private async calculateOptimalPricing(
    demandForecast: Array<any>,
    elasticity: number
  ): Promise<Array<any>> {
    // Mock optimal pricing calculation
    return demandForecast.map(forecast => ({
      date: forecast.date,
      optimalPrice: forecast.price * 1.05, // Mock optimization
      expectedRevenue: forecast.expectedDemand * forecast.price,
      expectedProfit: forecast.expectedDemand * (forecast.price - 50), // Mock cost
    }));
  }

  private generateDemandInsights(
    demandForecast: Array<any>,
    elasticity: number
  ): string[] {
    const insights = [];
    
    insights.push(`Price elasticity: ${elasticity.toFixed(2)}`);
    
    if (Math.abs(elasticity) > 2) {
      insights.push('High price sensitivity - small price changes have large demand impact');
    } else if (Math.abs(elasticity) < 0.5) {
      insights.push('Low price sensitivity - demand relatively stable across price changes');
    }
    
    return insights;
  }
}