import { Injectable } from '@nestjs/common';
import { TypeOrmOptionsFactory, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatabaseConfig implements TypeOrmOptionsFactory {
  constructor(private configService: ConfigService) {}

  createTypeOrmOptions(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get('DATABASE_HOST') || 'localhost',
      port: this.configService.get('DATABASE_PORT') || 5432,
      username: this.configService.get('DATABASE_USERNAME') || 'postgres',
      password: this.configService.get('DATABASE_PASSWORD') || 'password',
      database: this.configService.get('DATABASE_NAME') || 'amazon_dropshipping',
      autoLoadEntities: true,
      synchronize: this.configService.get('NODE_ENV') === 'development',
      logging: this.configService.get('NODE_ENV') === 'development',
      ssl: this.configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      subscribers: [__dirname + '/../database/subscribers/*{.ts,.js}'],
    };
  }
}