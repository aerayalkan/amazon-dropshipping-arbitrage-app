import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';

export let app: INestApplication;

beforeAll(async () => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  
  // Configure test app
  const configService = app.get(ConfigService);
  
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  await app.init();
});

afterAll(async () => {
  if (app) {
    await app.close();
  }
});

// Mock implementations
jest.mock('aws-sdk', () => ({
  S3: jest.fn(() => ({
    upload: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Location: 'mocked-s3-url' }),
    }),
  })),
}));

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mocked-message-id' }),
  })),
}));

// Global test helpers
export const createMockUser = () => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'user',
  isActive: true,
  isEmailVerified: true,
  twoFactorEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
});

export const createMockProduct = () => ({
  id: '123e4567-e89b-12d3-a456-426614174001',
  asin: 'B08N5WRWNW',
  title: 'Test Product',
  price: 29.99,
  currency: 'USD',
  category: 'Electronics',
  rating: 4.5,
  reviewCount: 100,
  availability: 'in_stock',
  createdAt: new Date(),
  updatedAt: new Date(),
});