import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as helmet from 'helmet';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Güvenlik
  app.use(helmet());
  app.use(compression());
  
  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));
  
  // Global prefix
  app.setGlobalPrefix('api/v1');
  
  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Amazon Dropshipping Platform API')
    .setDescription('Profesyonel Amazon dropshipping yönetim platformu API dokümantasyonu')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Kimlik doğrulama işlemleri')
    .addTag('products', 'Ürün araştırma ve analiz')
    .addTag('inventory', 'Envanter yönetimi')
    .addTag('pricing', 'Fiyatlandırma ve kâr hesabı')
    .addTag('repricing', 'Repricing ve rakip analizi')
    .addTag('dashboard', 'Dashboard ve raporlar')
    .addTag('ai', 'Yapay zeka modülü')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`🚀 Amazon Dropshipping Platform API is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();