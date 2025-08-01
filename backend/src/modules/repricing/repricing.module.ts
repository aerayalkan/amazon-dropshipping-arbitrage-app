import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

// Entities
import { RepricingRule } from './entities/repricing-rule.entity';
import { RepricingSession } from './entities/repricing-session.entity';
import { CompetitorProduct } from './entities/competitor-product.entity';
import { PriceHistory } from './entities/price-history.entity';
import { BuyBoxHistory } from './entities/buy-box-history.entity';

// Services
import { RepricingEngineService } from './services/repricing-engine.service';
import { CompetitorMonitoringService } from './services/competitor-monitoring.service';
import { BuyBoxAnalyzerService } from './services/buybox-analyzer.service';
import { MarketAnalysisService } from './services/market-analysis.service';
import { PriceOptimizationService } from './services/price-optimization.service';

// Controllers
import { RepricingController } from './repricing.controller';

// External Modules
import { ProductsModule } from '../products/products.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RepricingRule,
      RepricingSession,
      CompetitorProduct,
      PriceHistory,
      BuyBoxHistory,
    ]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    ScheduleModule.forRoot(),
    ProductsModule,
    AuthModule,
  ],
  controllers: [
    RepricingController,
  ],
  providers: [
    RepricingEngineService,
    CompetitorMonitoringService,
    BuyBoxAnalyzerService,
    MarketAnalysisService,
    PriceOptimizationService,
  ],
  exports: [
    RepricingEngineService,
    CompetitorMonitoringService,
    BuyBoxAnalyzerService,
    MarketAnalysisService,
    PriceOptimizationService,
    TypeOrmModule,
  ],
})
export class RepricingModule {
  constructor(
    private readonly repricingEngineService: RepricingEngineService,
    private readonly competitorMonitoringService: CompetitorMonitoringService,
  ) {
    // Module initialization logic can go here
    this.initializeModule();
  }

  private async initializeModule(): Promise<void> {
    // Any startup logic for the repricing module
    console.log('🔄 Repricing & Competitor Analysis Module initialized');
    console.log('📊 Automated repricing engine ready');
    console.log('🕵️ Competitor monitoring active');
    console.log('📦 Buy Box analysis available');
    console.log('📈 Market analysis tools loaded');
    console.log('💡 Price optimization AI ready');
  }
}