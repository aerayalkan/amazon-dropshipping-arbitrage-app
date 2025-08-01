import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { PricingController } from './pricing.controller';

// Services
import { PricingCalculatorService } from './services/pricing-calculator.service';
import { FeeCalculatorService } from './services/fee-calculator.service';
import { CurrencyConverterService } from './services/currency-converter.service';
import { TaxCalculatorService } from './services/tax-calculator.service';
import { ProfitAnalyzerService } from './services/profit-analyzer.service';

// Entities
import { PricingCalculation } from './entities/pricing-calculation.entity';
import { FeeStructure } from './entities/fee-structure.entity';
import { CurrencyRate } from './entities/currency-rate.entity';
import { TaxConfiguration } from './entities/tax-configuration.entity';
import { ProfitAnalysis } from './entities/profit-analysis.entity';

// External Modules
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PricingCalculation,
      FeeStructure,
      CurrencyRate,
      TaxConfiguration,
      ProfitAnalysis,
    ]),
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
      headers: {
        'User-Agent': 'Amazon-Dropshipping-Calculator/1.0',
      },
    }),
    ScheduleModule.forRoot(),
    ProductsModule,
  ],
  controllers: [
    PricingController,
  ],
  providers: [
    PricingCalculatorService,
    FeeCalculatorService,
    CurrencyConverterService,
    TaxCalculatorService,
    ProfitAnalyzerService,
  ],
  exports: [
    PricingCalculatorService,
    FeeCalculatorService,
    CurrencyConverterService,
    TaxCalculatorService,
    ProfitAnalyzerService,
  ],
})
export class PricingModule {}