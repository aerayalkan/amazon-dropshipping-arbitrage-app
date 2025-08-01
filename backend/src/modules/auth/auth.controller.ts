import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from './entities/user.entity';

import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
  VerifyEmailDto,
  Enable2FADto,
  Verify2FADto,
  RefreshTokenDto,
  LogoutDto,
  AuthResponseDto,
  MessageResponseDto,
  VerificationResponseDto,
  TwoFactorSetupResponseDto,
  TokenRefreshResponseDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ 
    summary: 'Kullanıcı kaydı', 
    description: 'Yeni kullanıcı hesabı oluşturur' 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Kayıt başarılı',
    type: VerificationResponseDto 
  })
  @ApiResponse({ 
    status: 409, 
    description: 'Email adresi zaten kullanımda' 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Geçersiz veri' 
  })
  async register(@Body() registerDto: RegisterDto): Promise<VerificationResponseDto> {
    this.logger.log(`Registration attempt for: ${registerDto.email}`);
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ 
    summary: 'Email doğrulama', 
    description: 'Email adresini doğrular' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Email doğrulandı',
    type: MessageResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Geçersiz doğrulama token\'ı' 
  })
  async verifyEmail(@Body() verifyEmailDto: VerifyEmailDto): Promise<MessageResponseDto> {
    this.logger.log(`Email verification attempt for: ${verifyEmailDto.email}`);
    return this.authService.verifyEmail(verifyEmailDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Kullanıcı girişi', 
    description: 'Email ve şifre ile giriş yapar' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Giriş başarılı',
    type: AuthResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Geçersiz kimlik bilgileri' 
  })
  @ApiResponse({ 
    status: 403, 
    description: '2FA kodu gerekli' 
  })
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    this.logger.log(`Login attempt for: ${loginDto.email}`);
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Şifre sıfırlama isteği', 
    description: 'Email ile şifre sıfırlama linki gönderir' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Şifre sıfırlama emaili gönderildi',
    type: MessageResponseDto 
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto): Promise<MessageResponseDto> {
    this.logger.log(`Password reset request for: ${forgotPasswordDto.email}`);
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Şifre sıfırlama', 
    description: 'Token ile şifreyi sıfırlar' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Şifre sıfırlandı',
    type: MessageResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Geçersiz token' 
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto): Promise<MessageResponseDto> {
    this.logger.log(`Password reset attempt for: ${resetPasswordDto.email}`);
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Token yenileme', 
    description: 'Refresh token ile access token yeniler' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token yenilendi',
    type: TokenRefreshResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Geçersiz refresh token' 
  })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<TokenRefreshResponseDto> {
    this.logger.log('Token refresh attempt');
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Çıkış yapma', 
    description: 'Refresh token\'ı geçersiz kılar' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Başarıyla çıkış yapıldı',
    type: MessageResponseDto 
  })
  async logout(@Body() logoutDto: LogoutDto): Promise<MessageResponseDto> {
    this.logger.log('Logout attempt');
    return this.authService.logout(logoutDto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiOperation({ 
    summary: 'Kullanıcı profili', 
    description: 'Giriş yapmış kullanıcının profil bilgileri' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profil bilgileri' 
  })
  async getProfile(@CurrentUser() user: User): Promise<Partial<User>> {
    this.logger.log(`Profile request for user: ${user.email}`);
    return this.authService.getProfile(user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @ApiOperation({ 
    summary: 'Şifre değiştirme', 
    description: 'Mevcut şifre ile yeni şifre belirler' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Şifre değiştirildi',
    type: MessageResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Mevcut şifre yanlış' 
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() changePasswordDto: ChangePasswordDto
  ): Promise<MessageResponseDto> {
    this.logger.log(`Password change request for user: ${userId}`);
    return this.authService.changePassword(userId, changePasswordDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  @ApiOperation({ 
    summary: '2FA kurulumu başlat', 
    description: '2FA için QR kod ve secret döndürür' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '2FA kurulum bilgileri',
    type: TwoFactorSetupResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: '2FA zaten etkinleştirilmiş' 
  })
  async enable2FA(@CurrentUser('id') userId: string): Promise<TwoFactorSetupResponseDto> {
    this.logger.log(`2FA enable request for user: ${userId}`);
    return this.authService.enable2FA(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('2fa/verify')
  @ApiOperation({ 
    summary: '2FA doğrula ve etkinleştir', 
    description: '2FA kodunu doğrular ve etkinleştirir' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '2FA etkinleştirildi',
    type: MessageResponseDto 
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Geçersiz 2FA kodu' 
  })
  async verify2FA(
    @CurrentUser('id') userId: string,
    @Body() verify2FADto: Verify2FADto
  ): Promise<MessageResponseDto> {
    this.logger.log(`2FA verification request for user: ${userId}`);
    return this.authService.verify2FA(userId, verify2FADto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  @ApiOperation({ 
    summary: '2FA devre dışı bırak', 
    description: 'Şifre doğrulama ile 2FA\'yı devre dışı bırakır' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '2FA devre dışı bırakıldı',
    type: MessageResponseDto 
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Yanlış şifre' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        password: {
          type: 'string',
          description: 'Mevcut şifre',
          example: 'Password123!'
        }
      },
      required: ['password']
    }
  })
  async disable2FA(
    @CurrentUser('id') userId: string,
    @Body('password') password: string
  ): Promise<MessageResponseDto> {
    this.logger.log(`2FA disable request for user: ${userId}`);
    return this.authService.disable2FA(userId, password);
  }

  @Public()
  @Get('health')
  @ApiOperation({ 
    summary: 'Auth servis sağlık durumu', 
    description: 'Auth servisinin çalışma durumunu kontrol eder' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Sağlık durumu bilgileri' 
  })
  async getHealth(): Promise<any> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'auth',
      version: '1.0.0',
      uptime: process.uptime(),
    };
  }
}