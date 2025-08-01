import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';

import { CurrencyRate, CurrencyPair, RateSource } from '../entities/currency-rate.entity';

export interface ConversionResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  exchangeRate: number;
  fees?: number;
  totalAmount?: number;
  rateDate: Date;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface RateAnalysis {
  currentRate: number;
  trend: 'up' | 'down' | 'stable' | 'volatile';
  volatilityIndex: number;
  changePercent24h: number;
  changePercent7d: number;
  changePercent30d: number;
  recommendation: {
    action: 'buy' | 'sell' | 'hold' | 'wait';
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };
  forecast?: {
    nextWeek: { min: number; max: number; avg: number };
    nextMonth: { min: number; max: number; avg: number };
    confidence: number;
  };
}

@Injectable()
export class CurrencyConverterService {
  private readonly logger = new Logger(CurrencyConverterService.name);
  private readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'TRY', 'CAD', 'JPY'];
  private rateCache = new Map<string, { rate: CurrencyRate; expiry: Date }>();

  constructor(
    @InjectRepository(CurrencyRate)
    private readonly currencyRateRepository: Repository<CurrencyRate>,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Para birimi dönüştürme
   */
  async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    options?: {
      includeFees?: boolean;
      feePercentage?: number;
      forceRefresh?: boolean;
    }
  ): Promise<ConversionResult> {
    try {
      if (fromCurrency === toCurrency) {
        return {
          fromCurrency,
          toCurrency,
          amount,
          convertedAmount: amount,
          exchangeRate: 1,
          rateDate: new Date(),
          source: 'same_currency',
          confidence: 'high',
        };
      }

      const exchangeRate = await this.getExchangeRate(
        fromCurrency,
        toCurrency,
        options?.forceRefresh
      );

      const convertedAmount = amount * exchangeRate;
      let fees = 0;
      let totalAmount = convertedAmount;

      if (options?.includeFees && options?.feePercentage) {
        fees = convertedAmount * (options.feePercentage / 100);
        totalAmount = convertedAmount + fees;
      }

      const rate = await this.getCurrentRate(fromCurrency, toCurrency);
      
      return {
        fromCurrency,
        toCurrency,
        amount,
        convertedAmount: Math.round(convertedAmount * 100) / 100,
        exchangeRate,
        fees: fees > 0 ? Math.round(fees * 100) / 100 : undefined,
        totalAmount: fees > 0 ? Math.round(totalAmount * 100) / 100 : undefined,
        rateDate: rate?.effectiveDate || new Date(),
        source: rate?.sourceName || 'api',
        confidence: rate?.calculateRateQuality() || 'medium',
      };

    } catch (error) {
      this.logger.error(`Error converting currency: ${error.message}`);
      throw error;
    }
  }

  /**
   * Exchange rate getir
   */
  async getExchangeRate(
    fromCurrency: string,
    toCurrency: string,
    forceRefresh: boolean = false
  ): Promise<number> {
    try {
      const cacheKey = `${fromCurrency}_${toCurrency}`;
      
      // Check cache first
      if (!forceRefresh && this.rateCache.has(cacheKey)) {
        const cached = this.rateCache.get(cacheKey)!;
        if (cached.expiry > new Date()) {
          return cached.rate.exchangeRate;
        }
      }

      // Get from database
      let rate = await this.getCurrentRate(fromCurrency, toCurrency);

      if (!rate || !rate.isRateFresh(60) || forceRefresh) {
        // Fetch fresh rate from API
        rate = await this.fetchAndSaveRate(fromCurrency, toCurrency);
      }

      if (!rate) {
        throw new Error(`Exchange rate not available for ${fromCurrency}/${toCurrency}`);
      }

      // Update cache
      this.rateCache.set(cacheKey, {
        rate,
        expiry: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      });

      return rate.exchangeRate;

    } catch (error) {
      this.logger.error(`Error getting exchange rate: ${error.message}`);
      throw error;
    }
  }

  /**
   * Rate analizi
   */
  async analyzeRate(
    fromCurrency: string,
    toCurrency: string,
    period: number = 30
  ): Promise<RateAnalysis> {
    try {
      const currencyPair = `${fromCurrency}_${toCurrency}` as CurrencyPair;
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const rates = await this.currencyRateRepository.find({
        where: {
          currencyPair,
          effectiveDate: Between(startDate, endDate),
          isActive: true,
        },
        order: { effectiveDate: 'DESC' },
      });

      if (rates.length === 0) {
        throw new Error('Insufficient historical data for analysis');
      }

      const currentRate = rates[0];
      const analysis = this.performRateAnalysis(rates);

      return {
        currentRate: currentRate.exchangeRate,
        trend: currentRate.trendDirection || 'stable',
        volatilityIndex: currentRate.volatilityIndex || 0,
        changePercent24h: this.calculateChangePercent(rates, 1),
        changePercent7d: this.calculateChangePercent(rates, 7),
        changePercent30d: this.calculateChangePercent(rates, 30),
        recommendation: currentRate.getRecommendedAction(),
        forecast: analysis.forecast,
      };

    } catch (error) {
      this.logger.error(`Error analyzing rate: ${error.message}`);
      throw error;
    }
  }

  /**
   * Toplu para birimi dönüştürme
   */
  async convertMultiple(
    conversions: Array<{
      amount: number;
      fromCurrency: string;
      toCurrency: string;
    }>
  ): Promise<ConversionResult[]> {
    const results: ConversionResult[] = [];

    for (const conversion of conversions) {
      try {
        const result = await this.convertCurrency(
          conversion.amount,
          conversion.fromCurrency,
          conversion.toCurrency
        );
        results.push(result);
      } catch (error) {
        this.logger.warn(`Failed to convert ${conversion.fromCurrency} to ${conversion.toCurrency}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Desteklenen para birimleri
   */
  getSupportedCurrencies(): string[] {
    return [...this.supportedCurrencies];
  }

  /**
   * Rate geçmişi
   */
  async getRateHistory(
    fromCurrency: string,
    toCurrency: string,
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<Array<{
    date: Date;
    rate: number;
    change?: number;
    changePercent?: number;
  }>> {
    const currencyPair = `${fromCurrency}_${toCurrency}` as CurrencyPair;
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const rates = await this.currencyRateRepository.find({
      where: {
        currencyPair,
        effectiveDate: Between(startDate, endDate),
        isActive: true,
      },
      order: { effectiveDate: 'ASC' },
    });

    return rates.map((rate, index) => {
      const previous = index > 0 ? rates[index - 1] : null;
      const change = previous ? rate.exchangeRate - previous.exchangeRate : 0;
      const changePercent = previous && previous.exchangeRate > 0 
        ? (change / previous.exchangeRate) * 100 
        : 0;

      return {
        date: rate.effectiveDate,
        rate: rate.exchangeRate,
        change: Math.round(change * 1000000) / 1000000,
        changePercent: Math.round(changePercent * 100) / 100,
      };
    });
  }

  /**
   * Rate alertleri için rate monitoring
   */
  async checkRateAlerts(
    userId: string,
    alerts: Array<{
      fromCurrency: string;
      toCurrency: string;
      targetRate: number;
      condition: 'above' | 'below';
      tolerance?: number;
    }>
  ): Promise<Array<{
    alert: any;
    triggered: boolean;
    currentRate: number;
    targetRate: number;
    difference: number;
  }>> {
    const results = [];

    for (const alert of alerts) {
      try {
        const currentRate = await this.getExchangeRate(
          alert.fromCurrency,
          alert.toCurrency
        );

        const tolerance = alert.tolerance || 0;
        const targetWithTolerance = alert.condition === 'above' 
          ? alert.targetRate - tolerance
          : alert.targetRate + tolerance;

        const triggered = alert.condition === 'above'
          ? currentRate >= targetWithTolerance
          : currentRate <= targetWithTolerance;

        const difference = Math.abs(currentRate - alert.targetRate);

        results.push({
          alert,
          triggered,
          currentRate,
          targetRate: alert.targetRate,
          difference,
        });

      } catch (error) {
        this.logger.warn(`Failed to check rate alert: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Otomatik rate güncelleme (scheduled)
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async updateExchangeRates(): Promise<void> {
    try {
      this.logger.log('Starting scheduled exchange rate update');

      const majorPairs = [
        'USD_EUR', 'USD_GBP', 'USD_TRY', 'USD_JPY',
        'EUR_GBP', 'EUR_TRY', 'GBP_TRY'
      ];

      for (const pair of majorPairs) {
        const [base, quote] = pair.split('_');
        
        try {
          await this.fetchAndSaveRate(base, quote);
          
          // Small delay to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          this.logger.warn(`Failed to update rate for ${pair}: ${error.message}`);
        }
      }

      this.logger.log('Scheduled exchange rate update completed');

    } catch (error) {
      this.logger.error(`Error in scheduled rate update: ${error.message}`);
    }
  }

  // Private helper methods
  private async getCurrentRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<CurrencyRate | null> {
    const currencyPair = `${fromCurrency}_${toCurrency}` as CurrencyPair;
    
    return this.currencyRateRepository.findOne({
      where: {
        currencyPair,
        isActive: true,
      },
      order: { effectiveDate: 'DESC' },
    });
  }

  private async fetchAndSaveRate(
    fromCurrency: string,
    toCurrency: string
  ): Promise<CurrencyRate> {
    try {
      // Try multiple API sources for redundancy
      let rateData = await this.fetchFromExchangeRateAPI(fromCurrency, toCurrency);
      
      if (!rateData) {
        rateData = await this.fetchFromFallbackAPI(fromCurrency, toCurrency);
      }

      if (!rateData) {
        throw new Error('All rate sources failed');
      }

      // Check if we have recent rate from same source
      const existingRate = await this.getCurrentRate(fromCurrency, toCurrency);
      
      if (existingRate && 
          Math.abs(rateData.rate - existingRate.exchangeRate) / existingRate.exchangeRate > 0.05) {
        // Rate changed more than 5% - mark as anomaly
        rateData.anomalyDetected = true;
        rateData.anomalyReason = 'Large rate change detected';
      }

      // Create and save new rate
      const newRate = this.currencyRateRepository.create(
        CurrencyRate.createFromApiResponse({
          baseCurrency: fromCurrency,
          quoteCurrency: toCurrency,
          rate: rateData.rate,
          source: rateData.source,
          timestamp: rateData.timestamp,
        })
      );

      // Add historical context
      if (existingRate) {
        newRate.previousRate = existingRate.exchangeRate;
        newRate.changeAmount = newRate.exchangeRate - existingRate.exchangeRate;
        newRate.changePercentage = (newRate.changeAmount / existingRate.exchangeRate) * 100;
        newRate.updateTrendDirection();
      }

      const savedRate = await this.currencyRateRepository.save(newRate);
      
      // Update historical data
      if (existingRate) {
        savedRate.addHistoricalDataPoint({
          rate: savedRate.exchangeRate,
          high: savedRate.exchangeRate * 1.001, // Mock data
          low: savedRate.exchangeRate * 0.999,
        });
        await this.currencyRateRepository.save(savedRate);
      }

      this.logger.debug(`Updated exchange rate: ${fromCurrency}/${toCurrency} = ${savedRate.exchangeRate}`);
      return savedRate;

    } catch (error) {
      this.logger.error(`Error fetching and saving rate: ${error.message}`);
      throw error;
    }
  }

  private async fetchFromExchangeRateAPI(
    fromCurrency: string,
    toCurrency: string
  ): Promise<{ rate: number; source: string; timestamp?: Date } | null> {
    try {
      // This would use a real exchange rate API like exchangerate-api.com
      // For now, returning mock data
      
      const mockRates: { [key: string]: number } = {
        'USD_TRY': 30.5 + (Math.random() - 0.5) * 0.5,
        'USD_EUR': 0.85 + (Math.random() - 0.5) * 0.02,
        'USD_GBP': 0.73 + (Math.random() - 0.5) * 0.02,
        'EUR_TRY': 35.8 + (Math.random() - 0.5) * 0.8,
        'GBP_TRY': 41.8 + (Math.random() - 0.5) * 0.8,
        'TRY_USD': 1 / 30.5,
        'EUR_USD': 1 / 0.85,
        'GBP_USD': 1 / 0.73,
      };

      const key = `${fromCurrency}_${toCurrency}`;
      const reverseKey = `${toCurrency}_${fromCurrency}`;

      let rate = mockRates[key];
      if (!rate && mockRates[reverseKey]) {
        rate = 1 / mockRates[reverseKey];
      }

      if (!rate) {
        return null;
      }

      return {
        rate,
        source: 'ExchangeRate-API',
        timestamp: new Date(),
      };

    } catch (error) {
      this.logger.warn(`ExchangeRate-API failed: ${error.message}`);
      return null;
    }
  }

  private async fetchFromFallbackAPI(
    fromCurrency: string,
    toCurrency: string
  ): Promise<{ rate: number; source: string; timestamp?: Date } | null> {
    try {
      // Fallback to another API or calculation
      // For now, returning calculated rate with lower confidence
      
      if (fromCurrency === 'USD' && toCurrency === 'TRY') {
        return {
          rate: 30.0 + Math.random() * 2, // Mock fallback rate
          source: 'Fallback-API',
          timestamp: new Date(),
        };
      }

      return null;

    } catch (error) {
      this.logger.warn(`Fallback API failed: ${error.message}`);
      return null;
    }
  }

  private calculateChangePercent(rates: CurrencyRate[], days: number): number {
    if (rates.length === 0) return 0;

    const current = rates[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);

    const historical = rates.find(r => r.effectiveDate <= targetDate);
    
    if (!historical) return 0;

    return ((current.exchangeRate - historical.exchangeRate) / historical.exchangeRate) * 100;
  }

  private performRateAnalysis(rates: CurrencyRate[]): { forecast?: any } {
    if (rates.length < 7) {
      return {};
    }

    // Simple forecast based on recent trend
    const recentRates = rates.slice(0, 7).map(r => r.exchangeRate);
    const avgRate = recentRates.reduce((sum, rate) => sum + rate, 0) / recentRates.length;
    const trend = recentRates[0] > recentRates[recentRates.length - 1] ? 'up' : 'down';
    
    const volatility = this.calculateVolatility(recentRates);
    const trendStrength = Math.abs(recentRates[0] - recentRates[recentRates.length - 1]) / avgRate;

    const forecast = {
      nextWeek: {
        min: avgRate * (1 - volatility / 100),
        max: avgRate * (1 + volatility / 100),
        avg: avgRate,
      },
      nextMonth: {
        min: avgRate * (1 - volatility / 50),
        max: avgRate * (1 + volatility / 50),
        avg: avgRate,
      },
      confidence: Math.max(10, 90 - volatility * 2), // Lower confidence for high volatility
    };

    return { forecast };
  }

  private calculateVolatility(rates: number[]): number {
    if (rates.length < 2) return 0;

    const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
    const variance = rates.reduce((sum, rate) => sum + Math.pow(rate - mean, 2), 0) / rates.length;
    const standardDeviation = Math.sqrt(variance);
    
    return (standardDeviation / mean) * 100; // Return as percentage
  }
}