export const AppConfig = () => ({
  app: {
    port: parseInt(process.env.PORT) || 3001,
    environment: process.env.NODE_ENV || 'development',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'supersecretkey',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'refreshsecretkey',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  amazon: {
    accessKey: process.env.AMAZON_ACCESS_KEY || '',
    secretKey: process.env.AMAZON_SECRET_KEY || '',
    associateTag: process.env.AMAZON_ASSOCIATE_TAG || '',
    marketplace: process.env.AMAZON_MARKETPLACE || 'www.amazon.com',
    sellerId: process.env.AMAZON_SELLER_ID || '',
    mwsAuthToken: process.env.AMAZON_MWS_AUTH_TOKEN || '',
  },
  googleTrends: {
    apiKey: process.env.GOOGLE_TRENDS_API_KEY || '',
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  sms: {
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    },
  },
  scraping: {
    proxyUrl: process.env.PROXY_URL || '',
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    rateLimitMs: parseInt(process.env.SCRAPING_RATE_LIMIT_MS) || 2000,
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    huggingfaceApiKey: process.env.HUGGINGFACE_API_KEY || '',
    aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8001',
  },
});