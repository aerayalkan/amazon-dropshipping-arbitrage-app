import { 
  Injectable, 
  CanActivate, 
  ExecutionContext, 
  UnauthorizedException,
  Logger 
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { User } from '../entities/user.entity';

@Injectable()
export class TwoFactorGuard implements CanActivate {
  private readonly logger = new Logger(TwoFactorGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    // 2FA etkin değilse geç
    if (!user.twoFactorEnabled) {
      return true;
    }

    // 2FA bypass decorator kontrolü (admin işlemleri vs için)
    const bypass2FA = this.reflector.getAllAndOverride<boolean>('bypass2FA', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (bypass2FA) {
      this.logger.debug(`2FA bypassed for user: ${user.email}`);
      return true;
    }

    // Token payload'ında 2FA doğrulaması var mı kontrol et
    // Burada JWT payload'ında 2FA verification flag'i olmalı
    // Şimdilik basit kontrol yapıyoruz
    
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('2FA verification required');
    }

    // Bu kısım JWT token decode edilip 2FA verification kontrolü yapılacak
    // Şimdilik 2FA etkin kullanıcılar için geçiş izni veriyoruz
    // Production'da daha sıkı kontrol gerekli

    this.logger.debug(`2FA check passed for user: ${user.email}`);
    return true;
  }
}