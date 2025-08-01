import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as Redis from 'ioredis';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly redis: Redis.Redis;
  private readonly refreshTokenSecret: string;
  private readonly refreshTokenExpiry: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    // Redis connection
    this.redis = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      password: this.configService.get('redis.password'),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    });

    this.refreshTokenSecret = this.configService.get('jwt.refreshSecret');
    this.refreshTokenExpiry = this.configService.get('jwt.refreshExpiresIn');

    this.redis.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected successfully');
    });
  }

  /**
   * Refresh token oluştur
   */
  async generateRefreshToken(userId: string): Promise<string> {
    try {
      const payload = { 
        sub: userId, 
        type: 'refresh',
        jti: crypto.randomUUID(), // Unique token ID
      };

      const refreshToken = this.jwtService.sign(payload, {
        secret: this.refreshTokenSecret,
        expiresIn: this.refreshTokenExpiry,
      });

      // Redis'te sakla (7 gün)
      const redisKey = `refresh_token:${userId}:${payload.jti}`;
      await this.redis.setex(redisKey, 7 * 24 * 60 * 60, refreshToken);

      this.logger.debug(`Refresh token created for user: ${userId}`);
      return refreshToken;
    } catch (error) {
      this.logger.error(`Failed to generate refresh token for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh token doğrula
   */
  async verifyRefreshToken(refreshToken: string): Promise<any> {
    try {
      // JWT doğrula
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshTokenSecret,
      });

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Redis'te var mı kontrol et
      const redisKey = `refresh_token:${payload.sub}:${payload.jti}`;
      const storedToken = await this.redis.get(redisKey);

      if (!storedToken || storedToken !== refreshToken) {
        throw new Error('Token not found in store');
      }

      this.logger.debug(`Refresh token verified for user: ${payload.sub}`);
      return payload;
    } catch (error) {
      this.logger.warn(`Refresh token verification failed: ${error.message}`);
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Token'ı blacklist'e al (logout)
   */
  async blacklistToken(refreshToken: string): Promise<void> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.refreshTokenSecret,
      });

      // Redis'ten sil
      const redisKey = `refresh_token:${payload.sub}:${payload.jti}`;
      await this.redis.del(redisKey);

      // Blacklist'e ekle
      const blacklistKey = `blacklisted_token:${payload.jti}`;
      const ttl = payload.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.setex(blacklistKey, ttl, 'blacklisted');
      }

      this.logger.debug(`Token blacklisted for user: ${payload.sub}`);
    } catch (error) {
      this.logger.error(`Failed to blacklist token: ${error.message}`);
      throw error;
    }
  }

  /**
   * Token blacklist'te mi kontrol et
   */
  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    try {
      const blacklistKey = `blacklisted_token:${tokenId}`;
      const result = await this.redis.get(blacklistKey);
      return result === 'blacklisted';
    } catch (error) {
      this.logger.error(`Failed to check token blacklist: ${error.message}`);
      return false;
    }
  }

  /**
   * Kullanıcının tüm refresh token'larını iptal et
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    try {
      const pattern = `refresh_token:${userId}:*`;
      const keys = await this.redis.keys(pattern);

      if (keys.length > 0) {
        // Tüm token'ları blacklist'e al
        const pipeline = this.redis.pipeline();
        
        for (const key of keys) {
          const token = await this.redis.get(key);
          if (token) {
            try {
              const payload = this.jwtService.verify(token, {
                secret: this.refreshTokenSecret,
              });
              
              const blacklistKey = `blacklisted_token:${payload.jti}`;
              const ttl = payload.exp - Math.floor(Date.now() / 1000);
              if (ttl > 0) {
                pipeline.setex(blacklistKey, ttl, 'blacklisted');
              }
            } catch (err) {
              // Token zaten geçersiz, sadece sil
            }
          }
          pipeline.del(key);
        }

        await pipeline.exec();
      }

      this.logger.log(`All tokens revoked for user: ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to revoke user tokens for ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Ekspired token'ları temizle (cleanup job için)
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      const pattern = 'refresh_token:*';
      const keys = await this.redis.keys(pattern);
      let cleanedCount = 0;

      for (const key of keys) {
        const token = await this.redis.get(key);
        if (token) {
          try {
            this.jwtService.verify(token, {
              secret: this.refreshTokenSecret,
            });
          } catch (error) {
            // Token expired or invalid, remove it
            await this.redis.del(key);
            cleanedCount++;
          }
        }
      }

      this.logger.log(`Cleaned up ${cleanedCount} expired tokens`);
    } catch (error) {
      this.logger.error(`Token cleanup failed: ${error.message}`);
    }
  }

  /**
   * Redis bağlantısını kapat
   */
  async onModuleDestroy() {
    await this.redis.quit();
  }
}