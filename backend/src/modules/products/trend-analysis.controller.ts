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

import { TrendAnalysisService } from './services/trend-analysis.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('trend-analysis')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('trend-analysis')
export class TrendAnalysisController {
  private readonly logger = new Logger(TrendAnalysisController.name);

  constructor(
    private readonly trendAnalysisService: TrendAnalysisService,
  ) {}

  @Post('analyze-keyword')
  @ApiOperation({
    summary: 'Anahtar kelime trend analizi',
    description: 'Anahtar kelime için kapsamlı trend analizi yapar'
  })
  @ApiResponse({
    status: 200,
    description: 'Trend analizi başarıyla tamamlandı'
  })
  async analyzeKeywordTrend(
    @Body() body: {
      keyword: string;
      categoryId?: string;
    }
  ): Promise<any> {
    this.logger.log(`Analyzing trend for keyword: ${body.keyword}`);
    return this.trendAnalysisService.analyzeKeywordTrend(body.keyword, body.categoryId);
  }

  @Post('compare-keywords')
  @ApiOperation({
    summary: 'Anahtar kelime karşılaştırması',
    description: 'Birden fazla anahtar kelimeyi karşılaştırır'
  })
  @ApiResponse({
    status: 200,
    description: 'Anahtar kelime karşılaştırması tamamlandı'
  })
  async compareKeywords(
    @Body() body: {
      keywords: string[];
      categoryId?: string;
    }
  ): Promise<any> {
    this.logger.log(`Comparing keywords: ${body.keywords.join(', ')}`);
    return this.trendAnalysisService.compareKeywords(body.keywords, body.categoryId);
  }

  @Get('seasonal-trends')
  @ApiOperation({
    summary: 'Mevsimsel trend analizi',
    description: 'Anahtar kelime için mevsimsel trend patternlerini analiz eder'
  })
  @ApiQuery({
    name: 'keyword',
    description: 'Analiz edilecek anahtar kelime'
  })
  @ApiQuery({
    name: 'years',
    description: 'Kaç yıllık veri analizi (varsayılan: 2)',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Mevsimsel trend analizi tamamlandı'
  })
  async analyzeSeasonalTrends(
    @Query('keyword') keyword: string,
    @Query('years') years: number = 2
  ): Promise<any> {
    this.logger.log(`Analyzing seasonal trends for: ${keyword}`);
    return this.trendAnalysisService.analyzeSeasonalTrends(keyword, years);
  }

  @Get('trend-insights')
  @ApiOperation({
    summary: 'Trend içgörüleri',
    description: 'Anahtar kelime için detaylı trend içgörüleri ve tahminler'
  })
  @ApiQuery({
    name: 'keyword',
    description: 'Analiz edilecek anahtar kelime'
  })
  @ApiQuery({
    name: 'categoryId',
    description: 'Kategori ID (opsiyonel)',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Trend içgörüleri başarıyla getirildi'
  })
  async getTrendInsights(
    @Query('keyword') keyword: string,
    @Query('categoryId') categoryId?: string
  ): Promise<any> {
    this.logger.log(`Getting trend insights for: ${keyword}`);
    return this.trendAnalysisService.getTrendInsights(keyword, categoryId);
  }

  @Get('category-trends/:categoryId')
  @ApiOperation({
    summary: 'Kategori trend analizi',
    description: 'Kategori için genel trend analizi ve keyword performansı'
  })
  @ApiResponse({
    status: 200,
    description: 'Kategori trend analizi tamamlandı'
  })
  async analyzeCategoryTrends(
    @Query('categoryId') categoryId: string,
    @Query('months') months: number = 12
  ): Promise<any> {
    this.logger.log(`Analyzing category trends for: ${categoryId}`);
    return this.trendAnalysisService.analyzeCategoryTrends(categoryId, months);
  }

  @Get('competitive-keywords')
  @ApiOperation({
    summary: 'Rakip keyword analizi',
    description: 'Anahtar kelime için rekabet analizi ve fırsat boşlukları'
  })
  @ApiQuery({
    name: 'keyword',
    description: 'Ana anahtar kelime'
  })
  @ApiResponse({
    status: 200,
    description: 'Rekabet analizi tamamlandı'
  })
  async analyzeCompetitiveKeywords(
    @Query('keyword') keyword: string
  ): Promise<any> {
    this.logger.log(`Analyzing competitive keywords for: ${keyword}`);
    return this.trendAnalysisService.analyzeCompetitiveKeywords(keyword);
  }

  @Get('trending-now')
  @ApiOperation({
    summary: 'Şu anda trend olanlar',
    description: 'Güncel olarak trend olan anahtar kelimeleri listeler'
  })
  @ApiQuery({
    name: 'category',
    description: 'Kategori filtresi',
    required: false
  })
  @ApiQuery({
    name: 'limit',
    description: 'Sonuç limiti (varsayılan: 20)',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Trend olan keywords başarıyla listelendi'
  })
  async getTrendingNow(
    @Query('category') category?: string,
    @Query('limit') limit: number = 20
  ): Promise<{
    trending: Array<{
      keyword: string;
      score: number;
      direction: 'up' | 'down' | 'stable';
      change: number;
      category?: string;
    }>;
    updatedAt: Date;
    nextUpdate: Date;
  }> {
    this.logger.log('Getting currently trending keywords');
    
    // Mock data - gerçek implementation yapılacak
    return {
      trending: [
        {
          keyword: 'foldable laptop stand',
          score: 89,
          direction: 'up',
          change: 25,
          category: 'Electronics',
        },
        {
          keyword: 'eco friendly water bottle',
          score: 78,
          direction: 'up',
          change: 18,
          category: 'Home',
        },
        {
          keyword: 'wireless charging pad',
          score: 72,
          direction: 'stable',
          change: 3,
          category: 'Electronics',
        },
      ],
      updatedAt: new Date(),
      nextUpdate: new Date(Date.now() + 3600000), // 1 saat sonra
    };
  }

  @Get('forecast')
  @ApiOperation({
    summary: 'Trend tahmini',
    description: 'Anahtar kelime için gelecek trend tahminleri'
  })
  @ApiQuery({
    name: 'keyword',
    description: 'Tahmin edilecek anahtar kelime'
  })
  @ApiQuery({
    name: 'months',
    description: 'Kaç ay sonrasını tahmin et (varsayılan: 6)',
    required: false
  })
  @ApiResponse({
    status: 200,
    description: 'Trend tahmini tamamlandı'
  })
  async forecastTrend(
    @Query('keyword') keyword: string,
    @Query('months') months: number = 6
  ): Promise<{
    keyword: string;
    currentScore: number;
    forecast: Array<{
      month: number;
      year: number;
      predictedScore: number;
      confidence: number;
      factors: string[];
    }>;
    recommendations: string[];
    riskFactors: string[];
  }> {
    this.logger.log(`Forecasting trend for: ${keyword}`);
    
    // Mock implementation
    const forecast = [];
    const currentDate = new Date();
    
    for (let i = 1; i <= months; i++) {
      const futureDate = new Date(currentDate);
      futureDate.setMonth(futureDate.getMonth() + i);
      
      forecast.push({
        month: futureDate.getMonth() + 1,
        year: futureDate.getFullYear(),
        predictedScore: Math.round(Math.random() * 30 + 60),
        confidence: Math.round((Math.random() * 0.3 + 0.7) * 100) / 100,
        factors: ['Seasonal trend', 'Market growth', 'Competition level'],
      });
    }

    return {
      keyword,
      currentScore: Math.round(Math.random() * 40 + 50),
      forecast,
      recommendations: [
        'Trend yukarı yönlü - yatırım yapılabilir',
        'Mevsimsel faktörler dikkate alınmalı',
        'Rekabet artışı bekleniyor',
      ],
      riskFactors: [
        'Pazar doygunluğu riski',
        'Mevsimsel düşüş olasılığı',
      ],
    };
  }

  @Get('correlation-analysis')
  @ApiOperation({
    summary: 'Korelasyon analizi',
    description: 'Anahtar kelimeler arası korelasyon ve etki analizi'
  })
  @ApiQuery({
    name: 'keywords',
    description: 'Analiz edilecek anahtar kelimeler (virgülle ayrılmış)'
  })
  @ApiResponse({
    status: 200,
    description: 'Korelasyon analizi tamamlandı'
  })
  async analyzeCorrelation(
    @Query('keywords') keywordsString: string
  ): Promise<{
    keywords: string[];
    correlationMatrix: number[][];
    insights: Array<{
      keyword1: string;
      keyword2: string;
      correlation: number;
      relationship: 'strong' | 'moderate' | 'weak';
      insight: string;
    }>;
    recommendations: string[];
  }> {
    const keywords = keywordsString.split(',').map(k => k.trim());
    this.logger.log(`Analyzing correlation for keywords: ${keywords.join(', ')}`);
    
    // Mock implementation
    const correlationMatrix = keywords.map(() => 
      keywords.map(() => Math.round((Math.random() - 0.5) * 200) / 100)
    );

    const insights = [];
    for (let i = 0; i < keywords.length; i++) {
      for (let j = i + 1; j < keywords.length; j++) {
        const correlation = correlationMatrix[i][j];
        const absCorr = Math.abs(correlation);
        
        insights.push({
          keyword1: keywords[i],
          keyword2: keywords[j],
          correlation,
          relationship: absCorr > 0.7 ? 'strong' : absCorr > 0.4 ? 'moderate' : 'weak',
          insight: correlation > 0.5 
            ? 'Bu kelimeler birlikte trend oluyor' 
            : correlation < -0.5 
            ? 'Bu kelimeler ters korelasyonda'
            : 'Zayıf ilişki var',
        });
      }
    }

    return {
      keywords,
      correlationMatrix,
      insights,
      recommendations: [
        'Güçlü korelasyonlu kelimeleri birlikte hedefleyin',
        'Ters korelasyonlu kelimeler için ayrı stratejiler geliştirin',
      ],
    };
  }
}