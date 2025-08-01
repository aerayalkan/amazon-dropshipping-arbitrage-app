import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

// Controllers
import { AIController } from './ai.controller';

// Services
import { TrendPredictionService } from './services/trend-prediction.service';
import { SentimentAnalysisService } from './services/sentiment-analysis.service';
import { SalesForecastingService } from './services/sales-forecasting.service';

// Entities
import { PredictionModel } from './entities/prediction-model.entity';
import { TrendAnalysis } from './entities/trend-analysis.entity';
import { SentimentAnalysis } from './entities/sentiment-analysis.entity';
import { SalesForecast } from './entities/sales-forecast.entity';
import { AITrainingData } from './entities/ai-training-data.entity';

// External Modules
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PredictionModel,
      TrendAnalysis,
      SentimentAnalysis,
      SalesForecast,
      AITrainingData,
    ]),
    HttpModule.register({
      timeout: 30000, // 30 seconds timeout for AI model requests
      maxRedirects: 5,
      retries: 3,
    }),
    AuthModule,
  ],
  controllers: [
    AIController,
  ],
  providers: [
    TrendPredictionService,
    SentimentAnalysisService,
    SalesForecastingService,
  ],
  exports: [
    TrendPredictionService,
    SentimentAnalysisService,
    SalesForecastingService,
    TypeOrmModule,
  ],
})
export class AIModule {}