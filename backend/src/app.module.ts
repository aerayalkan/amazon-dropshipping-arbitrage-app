import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Configuration
import { DatabaseConfig } from './config/database.config';
import { AppConfig } from './config/app.config';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { RepricingModule } from './modules/repricing/repricing.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AIModule } from './modules/ai/ai.module';
import { AmazonApiModule } from './modules/amazon-api/amazon-api.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [AppConfig],
    }),
    
    // Database
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    
    // Task Scheduling
    ScheduleModule.forRoot(),
    
    // Rate Limiting
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 dakika
      limit: 100, // 100 istek
    }]),
    
    // Feature Modules
    AuthModule,
    ProductsModule,
    InventoryModule,
    PricingModule,
    RepricingModule,
    DashboardModule,
    AIModule,
    AmazonApiModule,
    NotificationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}