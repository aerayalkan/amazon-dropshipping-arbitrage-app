import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as qrcode from 'qrcode';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);
  private readonly appName = 'Amazon Dropshipping Platform';

  constructor(private readonly configService: ConfigService) {}

  /**
   * 2FA secret oluştur ve QR kod URL'i döndür
   */
  async generateSecret(userEmail: string): Promise<{ secret: string; qrCodeUrl: string }> {
    try {
      // Secret oluştur
      const secret = speakeasy.generateSecret({
        name: userEmail,
        issuer: this.appName,
        length: 32,
      });

      // QR kod URL'i oluştur
      const qrCodeUrl = await this.generateQRCode(secret.otpauth_url!);

      this.logger.log(`2FA secret generated for user: ${userEmail}`);

      return {
        secret: secret.base32!,
        qrCodeUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to generate 2FA secret for ${userEmail}: ${error.message}`);
      throw error;
    }
  }

  /**
   * TOTP kodunu doğrula
   */
  async verify(secret: string, token: string): Promise<boolean> {
    try {
      if (!secret || !token) {
        return false;
      }

      const verified = speakeasy.totp.verify({
        secret,
        token,
        encoding: 'base32',
        window: 2, // ±2 time steps (30 saniye x 2 = 60 saniye tolerans)
      });

      this.logger.debug(`2FA verification result: ${verified}`);
      return verified;
    } catch (error) {
      this.logger.error(`2FA verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * QR kod oluştur
   */
  private async generateQRCode(otpauthUrl: string): Promise<string> {
    try {
      return await qrcode.toDataURL(otpauthUrl);
    } catch (error) {
      this.logger.error(`QR code generation failed: ${error.message}`);
      throw new Error('QR kod oluşturulamadı');
    }
  }

  /**
   * Backup kodları oluştur (opsiyonel özellik)
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // 8 haneli backup kod oluştur
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }

    return codes;
  }

  /**
   * Manuel secret doğrulama (development için)
   */
  verifySecret(secret: string): boolean {
    try {
      // Secret formatını kontrol et
      return /^[A-Z2-7]{32}$/.test(secret);
    } catch (error) {
      return false;
    }
  }
}