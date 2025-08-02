import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Amazon Dropshipping API is running!';
  }

  getApiInfo() {
    return {
      name: 'Amazon Dropshipping API',
      version: '1.0.0',
      description: 'AI-powered Amazon dropshipping arbitrage platform',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
}