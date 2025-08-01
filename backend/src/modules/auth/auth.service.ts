import { 
  Injectable, 
  UnauthorizedException, 
  BadRequestException,
  ConflictException,
  Logger 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { User } from './entities/user.entity';
import { UserSettings } from './entities/user-settings.entity';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

import { 
  RegisterDto, 
  LoginDto, 
  ForgotPasswordDto, 
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyEmailDto,
  Enable2FADto,
  Verify2FADto
} from './dto/auth.dto';

export interface AuthResponse {
  user: Partial<User>;
  accessToken: string;
  refreshToken: string;
  requiresTwoFactor?: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSettings)
    private readonly userSettingsRepository: Repository<UserSettings>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  /**
   * Kullanıcı kaydı
   */
  async register(registerDto: RegisterDto): Promise<{ message: string; verificationToken: string }> {
    try {
      this.logger.log(`Registering user: ${registerDto.email}`);

      // Email kontrolü
      const existingUser = await this.userRepository.findOne({
        where: { email: registerDto.email }
      });

      if (existingUser) {
        throw new ConflictException('Bu email adresi zaten kullanımda');
      }

      // Verification token oluştur
      const verificationToken = crypto.randomBytes(32).toString('hex');

      // Kullanıcı oluştur
      const user = this.userRepository.create({
        email: registerDto.email,
        passwordHash: registerDto.password, // Entity'de hash'lenecek
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        phone: registerDto.phone,
        verificationToken,
        isActive: true,
        isVerified: false,
      });

      const savedUser = await this.userRepository.save(user);

      // Kullanıcı ayarları oluştur
      const userSettings = this.userSettingsRepository.create({
        userId: savedUser.id,
        timezone: registerDto.timezone || 'UTC',
        currency: registerDto.currency || 'USD',
      });

      await this.userSettingsRepository.save(userSettings);

      this.logger.log(`User registered successfully: ${registerDto.email}`);

      return {
        message: 'Kayıt başarılı. Email adresinizi doğrulayın.',
        verificationToken
      };
    } catch (error) {
      this.logger.error(`Registration failed for ${registerDto.email}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Email doğrulama
   */
  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { 
          email: verifyEmailDto.email,
          verificationToken: verifyEmailDto.token 
        }
      });

      if (!user) {
        throw new BadRequestException('Geçersiz doğrulama token\'ı');
      }

      if (user.isVerified) {
        throw new BadRequestException('Email adresi zaten doğrulanmış');
      }

      user.isVerified = true;
      user.verificationToken = null;
      await this.userRepository.save(user);

      this.logger.log(`Email verified for user: ${user.email}`);

      return { message: 'Email adresi başarıyla doğrulandı' };
    } catch (error) {
      this.logger.error(`Email verification failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Giriş yapma
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      this.logger.log(`Login attempt for: ${loginDto.email}`);

      const user = await this.validateUser(loginDto.email, loginDto.password);

      if (!user.isVerified) {
        throw new UnauthorizedException('Email adresinizi doğrulayın');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Hesabınız deaktif edilmiş');
      }

      // 2FA kontrolü
      if (user.twoFactorEnabled) {
        if (!loginDto.twoFactorCode) {
          return {
            user: this.sanitizeUser(user),
            accessToken: '',
            refreshToken: '',
            requiresTwoFactor: true,
          };
        }

        const isValid2FA = await this.twoFactorService.verify(
          user.twoFactorSecret,
          loginDto.twoFactorCode
        );

        if (!isValid2FA) {
          throw new UnauthorizedException('Geçersiz 2FA kodu');
        }
      }

      // Token'lar oluştur
      const { accessToken, refreshToken } = await this.generateTokens(user);

      // Son giriş zamanını güncelle
      user.lastLoginAt = new Date();
      await this.userRepository.save(user);

      this.logger.log(`Login successful for: ${user.email}`);

      return {
        user: this.sanitizeUser(user),
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error(`Login failed for ${loginDto.email}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kullanıcı doğrulama
   */
  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email },
      relations: ['settings'],
    });

    if (!user) {
      throw new UnauthorizedException('Geçersiz email veya şifre');
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw new UnauthorizedException('Geçersiz email veya şifre');
    }

    return user;
  }

  /**
   * Şifre sıfırlama isteği
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { email: forgotPasswordDto.email }
      });

      if (!user) {
        // Güvenlik için hata vermeyelim
        return { message: 'Şifre sıfırlama e-postası gönderildi' };
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetToken = resetToken;
      await this.userRepository.save(user);

      // TODO: Email gönderme servisi entegrasyonu
      this.logger.log(`Password reset requested for: ${user.email}`);

      return { message: 'Şifre sıfırlama e-postası gönderildi' };
    } catch (error) {
      this.logger.error(`Forgot password failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Şifre sıfırlama
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { 
          email: resetPasswordDto.email,
          resetToken: resetPasswordDto.token 
        }
      });

      if (!user) {
        throw new BadRequestException('Geçersiz şifre sıfırlama token\'ı');
      }

      user.passwordHash = resetPasswordDto.newPassword; // Entity'de hash'lenecek
      user.resetToken = null;
      await this.userRepository.save(user);

      this.logger.log(`Password reset successful for: ${user.email}`);

      return { message: 'Şifre başarıyla sıfırlandı' };
    } catch (error) {
      this.logger.error(`Password reset failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Şifre değiştirme
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new UnauthorizedException('Kullanıcı bulunamadı');
      }

      const isValidPassword = await user.validatePassword(changePasswordDto.currentPassword);
      if (!isValidPassword) {
        throw new UnauthorizedException('Mevcut şifre yanlış');
      }

      user.passwordHash = changePasswordDto.newPassword; // Entity'de hash'lenecek
      await this.userRepository.save(user);

      this.logger.log(`Password changed for user: ${user.email}`);

      return { message: 'Şifre başarıyla değiştirildi' };
    } catch (error) {
      this.logger.error(`Password change failed for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 2FA etkinleştir
   */
  async enable2FA(userId: string): Promise<{ qrCodeUrl: string; secret: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new UnauthorizedException('Kullanıcı bulunamadı');
      }

      if (user.twoFactorEnabled) {
        throw new BadRequestException('2FA zaten etkinleştirilmiş');
      }

      const { secret, qrCodeUrl } = await this.twoFactorService.generateSecret(user.email);

      user.twoFactorSecret = secret;
      await this.userRepository.save(user);

      this.logger.log(`2FA setup initiated for user: ${user.email}`);

      return { qrCodeUrl, secret };
    } catch (error) {
      this.logger.error(`2FA enable failed for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 2FA doğrula ve etkinleştir
   */
  async verify2FA(userId: string, verify2FADto: Verify2FADto): Promise<{ message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user || !user.twoFactorSecret) {
        throw new BadRequestException('2FA kurulumu tamamlanmamış');
      }

      const isValid = await this.twoFactorService.verify(
        user.twoFactorSecret,
        verify2FADto.code
      );

      if (!isValid) {
        throw new BadRequestException('Geçersiz 2FA kodu');
      }

      user.twoFactorEnabled = true;
      await this.userRepository.save(user);

      this.logger.log(`2FA enabled for user: ${user.email}`);

      return { message: '2FA başarıyla etkinleştirildi' };
    } catch (error) {
      this.logger.error(`2FA verification failed for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * 2FA devre dışı bırak
   */
  async disable2FA(userId: string, password: string): Promise<{ message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId }
      });

      if (!user) {
        throw new UnauthorizedException('Kullanıcı bulunamadı');
      }

      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        throw new UnauthorizedException('Yanlış şifre');
      }

      user.twoFactorEnabled = false;
      user.twoFactorSecret = null;
      await this.userRepository.save(user);

      this.logger.log(`2FA disabled for user: ${user.email}`);

      return { message: '2FA devre dışı bırakıldı' };
    } catch (error) {
      this.logger.error(`2FA disable failed for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Refresh token
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);
      
      const user = await this.userRepository.findOne({
        where: { id: payload.sub }
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Geçersiz refresh token');
      }

      return this.generateTokens(user);
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`);
      throw new UnauthorizedException('Geçersiz refresh token');
    }
  }

  /**
   * Logout
   */
  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      await this.tokenService.blacklistToken(refreshToken);
      return { message: 'Başarıyla çıkış yapıldı' };
    } catch (error) {
      this.logger.error(`Logout failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kullanıcı profili getir
   */
  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['settings'],
    });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }

    return this.sanitizeUser(user) as User;
  }

  // Private helper methods
  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = { 
      sub: user.id, 
      email: user.email,
      verified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.tokenService.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): Partial<User> {
    const { passwordHash, verificationToken, resetToken, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }
}