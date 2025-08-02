import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('App')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Get API information' })
  @ApiResponse({ 
    status: 200, 
    description: 'API information',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Amazon Dropshipping API is running!' },
        version: { type: 'string', example: '1.0.0' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
      },
    },
  })
  getHello() {
    return {
      message: 'Amazon Dropshipping API is running!',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('api')
  @ApiOperation({ summary: 'Get API root information' })
  @ApiResponse({ status: 200, description: 'API root information' })
  getApi() {
    return {
      message: 'Amazon Dropshipping API is running!',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
}