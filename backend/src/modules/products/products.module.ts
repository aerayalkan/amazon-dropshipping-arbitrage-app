import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';

// Controllers
import { ProductsController } from './products.controller';
import { ProductResearchController } from './product-research.controller';
import { TrendAnalysisController } from './trend-analysis.controller';

// Services
import { ProductsService } from './products.service';
import { ProductResearchService } from './services/product-research.service';
import { TrendAnalysisService } from './services/trend-analysis.service';
import { SalesEstimationService } from './services/sales-estimation.service';
import { CategoryAnalysisService } from './services/category-analysis.service';

// Entities
import { Product } from './entities/product.entity';
import { ProductPriceHistory } from './entities/product-price-history.entity';
import { Category } from './entities/category.entity';
import { SalesPrediction } from './entities/sales-prediction.entity';
import { TrendAnalysis } from './entities/trend-analysis.entity';

// External Modules
import { AmazonApiModule } from '../amazon-api/amazon-api.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductPriceHistory,
      Category,
      SalesPrediction,
      TrendAnalysis,
    ]),
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 3,
    }),
    AmazonApiModule,
  ],
  controllers: [
    ProductsController,
    ProductResearchController,
    TrendAnalysisController,
  ],
  providers: [
    ProductsService,
    ProductResearchService,
    TrendAnalysisService,
    SalesEstimationService,
    CategoryAnalysisService,
  ],
  exports: [
    ProductsService,
    ProductResearchService,
    TrendAnalysisService,
    SalesEstimationService,
    CategoryAnalysisService,
  ],
})
export class ProductsModule {}