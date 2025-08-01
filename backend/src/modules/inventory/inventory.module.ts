import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';

// Controllers
import { InventoryController } from './inventory.controller';
import { SuppliersController } from './suppliers.controller';
import { InventoryRulesController } from './inventory-rules.controller';

// Services
import { InventoryService } from './inventory.service';
import { InventoryTrackingService } from './services/inventory-tracking.service';
import { SupplierManagementService } from './services/supplier-management.service';
import { AutomationRulesService } from './services/automation-rules.service';
import { StockAlertService } from './services/stock-alert.service';
import { ProductSyncService } from './services/product-sync.service';

// Entities
import { InventoryItem } from './entities/inventory-item.entity';
import { Supplier } from './entities/supplier.entity';
import { SupplierProduct } from './entities/supplier-product.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { AutomationRule } from './entities/automation-rule.entity';
import { StockAlert } from './entities/stock-alert.entity';
import { PriceUpdateLog } from './entities/price-update-log.entity';

// External Modules
import { ProductsModule } from '../products/products.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      Supplier,
      SupplierProduct,
      StockMovement,
      AutomationRule,
      StockAlert,
      PriceUpdateLog,
    ]),
    HttpModule.register({
      timeout: 15000,
      maxRedirects: 3,
    }),
    ScheduleModule.forRoot(),
    ProductsModule,
    NotificationModule,
  ],
  controllers: [
    InventoryController,
    SuppliersController,
    InventoryRulesController,
  ],
  providers: [
    InventoryService,
    InventoryTrackingService,
    SupplierManagementService,
    AutomationRulesService,
    StockAlertService,
    ProductSyncService,
  ],
  exports: [
    InventoryService,
    InventoryTrackingService,
    SupplierManagementService,
    AutomationRulesService,
    StockAlertService,
    ProductSyncService,
  ],
})
export class InventoryModule {}